import { createClient } from "npm:@supabase/supabase-js@2";

type PaidPlan =
  | "two_day_pass"
  | "thirty_day"
  | "twelve_month"
  | "lifetime";

const EXPECTED_INITIAL_PRICE: Record<PaidPlan, number> = {
  lifetime: 275.0,
  twelve_month: 119.88,
  thirty_day: 29.99,
  two_day_pass: 0.99,
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const requestUrl = new URL(req.url);
    const suppliedSecret =
      requestUrl.searchParams.get("hook_secret") ?? "";
    const expectedSecret =
      Deno.env.get("CCBILL_POSTBACK_SECRET") ?? "";

    if (
      !expectedSecret ||
      suppliedSecret.length === 0 ||
      suppliedSecret !== expectedSecret
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = await readPayload(req);

    const expectedAccnum =
      Deno.env.get("CCBILL_CLIENT_ACCNUM") ?? "";
    const expectedSubacc =
      Deno.env.get("CCBILL_CLIENT_SUBACC") ?? "";

    const postedAccnum =
      getValue(payload, "clientAccnum", "clientAccnum");
    const postedSubacc =
      getValue(payload, "clientSubacc", "clientSubacc");

    if (
      expectedAccnum &&
      postedAccnum &&
      postedAccnum !== expectedAccnum
    ) {
      return new Response("Invalid client account", { status: 403 });
    }

    if (
      expectedSubacc &&
      postedSubacc &&
      normalizeSubacc(postedSubacc) !== normalizeSubacc(expectedSubacc)
    ) {
      return new Response("Invalid client subaccount", { status: 403 });
    }

    const checkoutId =
      getValue(
        payload,
        "checkout_id",
        "X-checkout_id",
        "x-checkout_id",
        "checkoutId",
      ) ?? "";

    const subscriptionId =
      getValue(
        payload,
        "subscription_id",
        "subscriptionId",
      ) ?? "";

    if (!checkoutId || !subscriptionId) {
      console.error("Missing checkout correlation", payload);
      return new Response("Missing checkout_id or subscription_id", {
        status: 400,
      });
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

    const { data: checkout, error: checkoutError } =
      await admin
        .from("membership_checkouts")
        .select("*")
        .eq("id", checkoutId)
        .single();

    if (checkoutError || !checkout) {
      return new Response("Unknown checkout", { status: 404 });
    }

    const plan = checkout.plan as PaidPlan;

    const postedEmail =
      String(
        getValue(payload, "email", "customer_email") ?? ""
      )
        .trim()
        .toLowerCase();

    if (
      postedEmail &&
      postedEmail !==
        String(checkout.customer_email).trim().toLowerCase()
    ) {
      return new Response("Email mismatch", { status: 403 });
    }

    const initialPriceRaw =
      getValue(payload, "initialPrice", "initial_price");
    const initialPrice =
      initialPriceRaw ? Number(initialPriceRaw) : NaN;

    if (
      Number.isFinite(initialPrice) &&
      Math.abs(initialPrice - EXPECTED_INITIAL_PRICE[plan]) > 0.01
    ) {
      console.error("Unexpected CCBill amount", {
        checkoutId,
        plan,
        initialPrice,
      });

      return new Response("Unexpected transaction amount", {
        status: 403,
      });
    }

    const now = new Date();
    const expiresAt = calculateExpiration(plan, now);

    const transactionId =
      getValue(
        payload,
        "transactionId",
        "transaction_id",
        "reservationId",
      ) ?? null;

    const { error: updateCheckoutError } =
      await admin
        .from("membership_checkouts")
        .update({
          status: "paid",
          ccbill_subscription_id: subscriptionId,
          ccbill_transaction_id: transactionId,
          amount:
            Number.isFinite(initialPrice)
              ? initialPrice
              : EXPECTED_INITIAL_PRICE[plan],
          paid_at: now.toISOString(),
          raw_post: payload,
          updated_at: now.toISOString(),
        })
        .eq("id", checkoutId);

    if (updateCheckoutError) {
      throw new Error(updateCheckoutError.message);
    }

    const { error: membershipError } =
      await admin
        .from("memberships")
        .upsert(
          {
            customer_email: checkout.customer_email,
            checkout_id: checkoutId,
            ccbill_subscription_id: subscriptionId,
            ccbill_transaction_id: transactionId,
            plan,
            status: "active",
            starts_at: now.toISOString(),
            expires_at: expiresAt,
            updated_at: now.toISOString(),
          },
          {
            onConflict: "ccbill_subscription_id",
          },
        );

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(error);

    return new Response(
      error instanceof Error
        ? error.message
        : "Server error",
      { status: 500 },
    );
  }
});

function calculateExpiration(
  plan: PaidPlan,
  start: Date,
): string | null {
  const expires = new Date(start);

  if (plan === "lifetime") {
    return null;
  }

  if (plan === "twelve_month") {
    expires.setUTCFullYear(expires.getUTCFullYear() + 1);
    return expires.toISOString();
  }

  if (plan === "thirty_day") {
    expires.setUTCDate(expires.getUTCDate() + 30);
    return expires.toISOString();
  }

  expires.setUTCDate(expires.getUTCDate() + 2);
  return expires.toISOString();
}

async function readPayload(req: Request) {
  const contentType =
    req.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    return await req.json() as Record<string, unknown>;
  }

  const raw = await req.text();
  const params = new URLSearchParams(raw);
  const result: Record<string, string> = {};

  for (const [key, value] of params.entries()) {
    result[key] = value;
  }

  return result;
}

function getValue(
  payload: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = payload[key];

    if (
      typeof value === "string" ||
      typeof value === "number"
    ) {
      return String(value);
    }
  }

  return null;
}

function normalizeSubacc(value: string) {
  return String(Number(value));
}
