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
    const email = String(body?.email ?? "")
      .trim()
      .toLowerCase();

    if (!allowedPlans.has(plan)) {
      return json({ ok: false, message: "Invalid membership plan." }, 400);
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return json({ ok: false, message: "Invalid email address." }, 400);
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
