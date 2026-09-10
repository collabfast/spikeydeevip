import { createClient } from "npm:@supabase/supabase-js@2";

type PaidPlan =
  | "two_day_pass"
  | "thirty_day"
  | "twelve_month"
  | "lifetime";

const PLAN_URL_ENV: Record<PaidPlan, string> = {
  lifetime: "CCBILL_LIFETIME_URL",
  twelve_month: "CCBILL_12_MONTH_URL",
  thirty_day: "CCBILL_30_DAY_URL",
  two_day_pass: "CCBILL_2_DAY_URL",
};

const allowedPlans = new Set<PaidPlan>([
  "lifetime",
  "twelve_month",
  "thirty_day",
  "two_day_pass",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders(),
    });
  }

  try {
    const body = await req.json();
const plan = body?.plan as PaidPlan;
const checkOnly = body?.checkOnly === true;
const email = String(body?.email ?? "")
  .trim()
  .toLowerCase();

    if (!checkOnly && !allowedPlans.has(plan)) {
  return json({ ok: false, message: "Invalid membership plan." }, 400);
}

    if (!/^\\S+@\\S+\\.\\S+$/.test(email)) {
      return json({ ok: false, message: "Invalid email address." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    // Prevent a customer from accidentally buying a second membership
    // with an email address that already has active, unexpired access.
    const { data: existingMemberships, error: membershipLookupError } =
      await admin
        .from("memberships")
        .select("id, plan, status, expires_at, customer_email")
        .eq("customer_email", email)
        .eq("status", "active")
        .order("created_at", { ascending: false });

    if (membershipLookupError) {
      console.error(
        "Could not check for an existing membership:",
        membershipLookupError,
      );

      return json(
        {
          ok: false,
          message:
            "We could not verify your membership status right now. Please try again.",
        },
        500,
      );
    }

    const now = Date.now();

    const activeMembership =
      existingMemberships?.find((membership) => {
        // Null expiration is treated as non-expiring access.
        if (!membership.expires_at) {
          return true;
        }

        const expiration = new Date(
          membership.expires_at,
        ).getTime();

        return (
          Number.isFinite(expiration) &&
          expiration > now
        );
      }) ?? null;

    if (activeMembership) {
      // Return 200 intentionally so the frontend receives this exact
      // customer-friendly message in `data` instead of a generic
      // Edge Function invocation error.
      return json({
        ok: false,
        code: "ACTIVE_MEMBERSHIP_EXISTS",
        message:
          "You already have an active SpikeyDeeVIP membership under this email. Please log in to your existing account instead. If you forgot your password, use Reset Password.",
      });
    }
if (checkOnly) {
  return json({
    ok: true,
    available: true,
  });
}
    const checkoutBaseUrl =
      Deno.env.get(PLAN_URL_ENV[plan]) ?? "";

    if (!checkoutBaseUrl) {
      return json(
        {
          ok: false,
          message: `Missing ${PLAN_URL_ENV[plan]} Edge Function secret.`,
        },
        500,
      );
    }

    const { data: checkout, error } = await admin
      .from("membership_checkouts")
      .insert({
        customer_email: email,
        plan,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !checkout?.id) {
      throw new Error(
        error?.message ?? "Could not create checkout record.",
      );
    }

    const url = new URL(checkoutBaseUrl);

    // CCBill recognizes "email" as a payment-form variable.
    url.searchParams.set("email", email);

    // Background Post returns custom values passed into the signup form.
    // Configure CCBill to preserve this checkout_id field.
    url.searchParams.set("checkout_id", checkout.id);

    return json({
      ok: true,
      checkoutId: checkout.id,
      checkoutUrl: url.toString(),
    });
  } catch (error) {
    console.error(error);

    return json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not start checkout.",
      },
      500,
    );
  }
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}
