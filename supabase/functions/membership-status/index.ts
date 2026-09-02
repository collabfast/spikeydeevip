import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders(),
    });
  }

  try {
    const body = await req.json();
    const checkoutId = String(body?.checkoutId ?? "");

    if (!checkoutId) {
      return json(
        {
          ok: false,
          status: "failed",
          message: "Missing checkout ID.",
        },
        400,
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

    const { data: checkout, error } =
      await admin
        .from("membership_checkouts")
        .select(
          "id, customer_email, plan, status, ccbill_subscription_id"
        )
        .eq("id", checkoutId)
        .single();

    if (error || !checkout) {
      return json(
        {
          ok: false,
          status: "failed",
          message: "Checkout not found.",
        },
        404,
      );
    }

    if (checkout.status !== "paid") {
      return json({
        ok: true,
        status: checkout.status,
        plan: checkout.plan,
      });
    }

    const { data: membership } =
      await admin
        .from("memberships")
        .select("id, expires_at")
        .eq("checkout_id", checkoutId)
        .maybeSingle();

    return json({
      ok: true,
      status: "paid",
      plan: checkout.plan,
      email: checkout.customer_email,
      expiresAt: membership?.expires_at ?? null,
      accessSessionId: membership?.id ?? null,
    });
  } catch (error) {
    console.error(error);

    return json(
      {
        ok: false,
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Could not check membership.",
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
