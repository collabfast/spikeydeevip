import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return json({ ok: false, message: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Missing required Supabase environment variables.");
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, message: "Unauthorized." }, 401);
    }

    // Verify the caller's Supabase session.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ ok: false, message: "Unauthorized." }, 401);
    }

    // Verify that this user is actually a Studio Admin.
    // This uses the same profiles table already used by the app.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

 const { data: profile, error: profileError } = await admin
  .from("profiles")
  .select("id, is_admin")
  .eq("id", user.id)
  .maybeSingle();  

    if (profileError) {
      console.error("Studio admin profile lookup failed:", profileError);
      return json(
        { ok: false, message: "Could not verify Studio Admin access." },
        500,
      );
    }

  if (!profile?.is_admin) {
  return json({ ok: false, message: "Forbidden." }, 403);
}

    // Service-role query stays server-side and bypasses member RLS.
    const { data: memberships, error: membershipsError } = await admin
      .from("memberships")
      .select(`
        id,
        user_id,
        customer_email,
        checkout_id,
        ccbill_subscription_id,
        ccbill_transaction_id,
        plan,
        status,
        starts_at,
        expires_at,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false });

    if (membershipsError) {
      throw membershipsError;
    }

    const rows = memberships ?? [];

    const subscriptionIds = rows
      .map((membership) => membership.ccbill_subscription_id)
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      );

    let webhookEvents: Array<{
      event_type: string | null;
      subscription_id: string | null;
      transaction_id: string | null;
      created_at: string | null;
    }> = [];

    if (subscriptionIds.length > 0) {
      const { data, error } = await admin
        .from("ccbill_webhook_events")
        .select(`
          event_type,
          subscription_id,
          transaction_id,
          created_at
        `)
        .in("subscription_id", subscriptionIds)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      webhookEvents = data ?? [];
    }

    const latestEventBySubscription = new Map<
      string,
      {
        event_type: string | null;
        transaction_id: string | null;
        created_at: string | null;
      }
    >();

    for (const event of webhookEvents) {
      if (
        event.subscription_id &&
        !latestEventBySubscription.has(event.subscription_id)
      ) {
        latestEventBySubscription.set(event.subscription_id, {
          event_type: event.event_type,
          transaction_id: event.transaction_id,
          created_at: event.created_at,
        });
      }
    }

    const members = rows.map((membership) => {
      const latest = membership.ccbill_subscription_id
        ? latestEventBySubscription.get(
            membership.ccbill_subscription_id,
          )
        : undefined;

      return {
        ...membership,
        latest_ccbill_event: latest?.event_type ?? null,
        latest_ccbill_transaction_id:
          latest?.transaction_id ?? null,
        latest_ccbill_event_at: latest?.created_at ?? null,
      };
    });

    return json({
      ok: true,
      members,
    });
  } catch (error) {
    console.error("studio-members-billing failed:", error);

    return json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not load member billing.",
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