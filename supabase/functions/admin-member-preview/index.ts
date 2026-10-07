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

    // Verify the currently signed-in Supabase user.
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

    // Service-role client stays server-side.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Verify Studio Admin privileges.
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Admin profile lookup failed:", profileError);

      return json(
        {
          ok: false,
          message: "Could not verify Studio Admin access.",
        },
        500,
      );
    }

    if (!profile?.is_admin) {
      return json({ ok: false, message: "Forbidden." }, 403);
    }

    const body = await req.json().catch(() => ({}));

    const membershipId =
      typeof body?.membership_id === "string"
        ? body.membership_id.trim()
        : "";

    if (!membershipId) {
      return json(
        {
          ok: false,
          message: "membership_id is required.",
        },
        400,
      );
    }

    // Fetch the selected member server-side.
    const { data: membership, error: membershipError } = await admin
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
        expires_at
      `)
      .eq("id", membershipId)
      .maybeSingle();

    if (membershipError) {
      console.error("Membership lookup failed:", membershipError);

      return json(
        {
          ok: false,
          message: "Could not load membership.",
        },
        500,
      );
    }

    if (!membership) {
      return json(
        {
          ok: false,
          message: "Membership not found.",
        },
        404,
      );
    }

   // Generate a cryptographically random, short-lived preview token.
// The raw token is returned to the admin once. Only its SHA-256 hash
// is stored in the database.
const tokenBytes = new Uint8Array(32);
crypto.getRandomValues(tokenBytes);

const previewToken = Array.from(tokenBytes)
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");

const tokenHashBuffer = await crypto.subtle.digest(
  "SHA-256",
  new TextEncoder().encode(previewToken),
);

const tokenHash = Array.from(new Uint8Array(tokenHashBuffer))
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");

const expiresAt = new Date(
  Date.now() + 15 * 60 * 1000,
).toISOString();

// Store only the hash. Never store the raw preview token.
const { data: previewRecord, error: previewError } = await admin
  .from("admin_member_previews")
  .insert({
    admin_user_id: user.id,
    membership_id: membership.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  })
  .select("id, created_at, expires_at")
  .single();

if (previewError) {
  console.error("Could not create member preview:", previewError);

  return json(
    {
      ok: false,
      message: "Could not create member preview.",
    },
    500,
  );
}

return json({
  ok: true,

  // Returned exactly once to the authenticated Studio Admin.
  // This raw value is never stored in the database.
  preview_token: previewToken,

  preview: {
    preview_id: previewRecord.id,
    preview_expires_at: previewRecord.expires_at,

    membership_id: membership.id,
    user_id: membership.user_id,
    customer_email: membership.customer_email,
    plan: membership.plan,
    status: membership.status,
    starts_at: membership.starts_at,
    expires_at: membership.expires_at,
  },
});
  } catch (error) {
    console.error("admin-member-preview failed:", error);

    return json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not start member preview.",
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