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
const purchaseId =
  getValue(
    payload,
    "purchase_id",
    "purchaseId",
  ) ?? "";

const attachmentId =
  getValue(
    payload,
    "attachment_id",
    "attachmentId",
  ) ?? "";
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

 if (!purchaseId && (!checkoutId || !subscriptionId)) {
  console.error("Missing payment correlation", payload);
  return new Response(
    "Missing purchase_id or membership checkout correlation",
    { status: 400 },
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
// ---------------------------------
// Paid message attachment purchase
// ---------------------------------
if (purchaseId) {
  if (!attachmentId) {
    return new Response("Missing attachment_id", {
      status: 400,
    });
  }

  const {
    data: purchase,
    error: purchaseError,
  } = await admin
    .from("message_attachment_purchases")
    .select("*")
    .eq("id", purchaseId)
    .single();

  if (purchaseError || !purchase) {
    console.error("Message purchase not found", {
      purchaseId,
      purchaseError,
    });

    return new Response("Unknown message purchase", {
      status: 404,
    });
  }

  if (String(purchase.attachment_id) !== attachmentId) {
    console.error("Attachment mismatch", {
      purchaseId,
      expected: purchase.attachment_id,
      received: attachmentId,
    });

    return new Response("Attachment mismatch", {
      status: 403,
    });
  }

  const initialPriceRaw =
    getValue(payload, "initialPrice", "initial_price");

  const initialPrice =
    initialPriceRaw ? Number(initialPriceRaw) : NaN;

  const expectedAmount =
    Number(purchase.amount_cents) / 100;

  if (
    Number.isFinite(initialPrice) &&
    Math.abs(initialPrice - expectedAmount) > 0.01
  ) {
    console.error("Unexpected message purchase amount", {
      purchaseId,
      initialPrice,
      expectedAmount,
    });

    return new Response(
      "Unexpected transaction amount",
      { status: 403 },
    );
  }

  const transactionId =
    getValue(
      payload,
      "transactionId",
      "transaction_id",
      "reservationId",
    ) ?? null;

  const paidAt = new Date().toISOString();

  const { error: updatePurchaseError } =
    await admin
      .from("message_attachment_purchases")
      .update({
        status: "paid",
        ccbill_transaction_id: transactionId,
        paid_at: paidAt,
      })
      .eq("id", purchaseId);

  if (updatePurchaseError) {
    throw new Error(updatePurchaseError.message);
  }

  console.log("MESSAGE ATTACHMENT PURCHASE PAID", {
    purchaseId,
    attachmentId,
    transactionId,
  });

  return new Response("OK", { status: 200 });
}
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
const responseDigest =
  getValue(
    payload,
    "responseDigest",
    "response_digest",
  ) ?? "";

const ccbillSubscriptionId =
  getValue(
    payload,
    "subscriptionId",
    "subscription_id",
  ) ?? "";

const dynamicPricingKey =
  Deno.env.get("CCBILL_DYNAMIC_PRICING_KEY") ?? "";

if (
  !responseDigest ||
  !ccbillSubscriptionId ||
  !dynamicPricingKey
) {
  console.error("Missing CCBill digest verification data", {
    purchaseId,
    hasResponseDigest: Boolean(responseDigest),
    hasSubscriptionId: Boolean(ccbillSubscriptionId),
    hasDynamicPricingKey: Boolean(dynamicPricingKey),
  });

  return new Response(
    "Missing CCBill verification data",
    { status: 403 },
  );
}

const expectedResponseDigest =
  md5(
    ccbillSubscriptionId +
    "1" +
    dynamicPricingKey
  );

if (
  responseDigest.toLowerCase() !==
  expectedResponseDigest.toLowerCase()
) {
  console.error("Invalid CCBill responseDigest", {
    purchaseId,
    ccbillSubscriptionId,
  });

  return new Response(
    "Invalid CCBill responseDigest",
    { status: 403 },
  );
}
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
    // Send the account-setup email only once per checkout.
    // Email failure must NOT cause the CCBill approval callback to fail.
    if (!checkout.setup_email_sent_at) {
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");

        if (!resendApiKey) {
          console.error(
            "RESEND_API_KEY is missing; account setup email was not sent.",
          );
        } else {
          const setupUrl =
            `https://spikeydeevip.com/checkout/return?checkout_id=${encodeURIComponent(
              checkoutId,
            )}`;

          const resendResponse = await fetch(
            "https://api.resend.com/emails",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "SpikeyDeeVIP <no-reply@auth.spikeydeevip.com>",
                to: [checkout.customer_email],
                subject: "Set up your SpikeyDeeVIP account",
                html: `
                  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;line-height:1.6;">
                    <h2>Your SpikeyDeeVIP membership is active</h2>

                    <p>
                      Your payment has been confirmed. Finish setting up your
                      member account by choosing your password.
                    </p>

                    <p style="margin:32px 0;">
                      <a
                        href="${setupUrl}"
                        style="background:#000;color:#fff;text-decoration:none;padding:14px 22px;border-radius:6px;display:inline-block;font-weight:600;"
                      >
                        Set Up Your Account
                      </a>
                    </p>

                    <p>
                      After creating your password, you'll be able to sign in
                      and access your membership.
                    </p>

                    <p style="font-size:13px;color:#666;">
                      If you did not purchase a SpikeyDeeVIP membership,
                      you can ignore this email.
                    </p>

                    <p>— SpikeyDeeVIP</p>
                  </div>
                `,
                text: [
                  "Your SpikeyDeeVIP membership is active.",
                  "",
                  "Your payment has been confirmed.",
                  "Set up your account and choose your password here:",
                  setupUrl,
                  "",
                  "— SpikeyDeeVIP",
                ].join("\n"),
              }),
            },
          );

          if (!resendResponse.ok) {
            const resendBody =
              await resendResponse.text().catch(() => "");

            console.error(
              "Account setup email failed:",
              resendResponse.status,
              resendBody,
            );
          } else {
            const emailSentAt = new Date().toISOString();

            const { error: emailTimestampError } =
              await admin
                .from("membership_checkouts")
                .update({
                  setup_email_sent_at: emailSentAt,
                  updated_at: emailSentAt,
                })
                .eq("id", checkoutId);

            if (emailTimestampError) {
              console.error(
                "Account setup email sent, but setup_email_sent_at could not be saved:",
                emailTimestampError.message,
              );
            } else {
              console.log(
                "Account setup email sent:",
                checkout.customer_email,
              );
            }
          }
        }
      } catch (emailError) {
        console.error(
          "Account setup email error:",
          emailError,
        );
      }
    } else {
      console.log(
        "Account setup email already sent; skipping:",
        checkoutId,
      );
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
