import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
    console.log("STATUS 0: REQUEST ENTERED", req.method);
    
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
console.log("STATUS 1: before auth.getUser");
const {
  data: { user },
  error: userError,
} = await userClient.auth.getUser();
console.log("STATUS 2: after auth.getUser", {
  hasUser: Boolean(user),
  userError: userError?.message ?? null,
});
if (userError || !user) {
  return json({ ok: false, message: "Unauthorized." }, 401);
}

    const body = await req.json().catch(() => ({}));

    const previewToken =
      typeof body?.preview_token === "string"
        ? body.preview_token.trim()
        : "";

    if (!previewToken) {
      return json(
        {
          ok: false,
          message: "preview_token is required.",
        },
        400,
      );
    }

    // Hash the supplied token. The raw token is never stored in the DB.
    const tokenHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(previewToken),
    );

    const tokenHash = Array.from(new Uint8Array(tokenHashBuffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
console.log("STATUS 3: before preview lookup");
    // Find an active preview session.
    const { data: preview, error: previewError } = await admin
      .from("admin_member_previews")
      .select(`
        id,
        admin_user_id,
        membership_id,
        created_at,
        expires_at,
        ended_at
      `)
      .eq("token_hash", tokenHash)
      .maybeSingle();

      console.log("STATUS 4: after preview lookup", {
  hasPreview: Boolean(preview),
  previewError: previewError?.message ?? null,
});

    if (previewError) {
      console.error("Preview lookup failed:", previewError);

      return json(
        {
          ok: false,
          message: "Could not verify member preview.",
        },
        500,
      );
    }

    if (!preview) {
      return json(
        {
          ok: false,
          message: "Invalid preview.",
        },
        401,
      );
    }

    if (preview.ended_at) {
      return json(
        {
          ok: false,
          message: "This preview has ended.",
        },
        401,
      );
    }

    const previewExpiresAt = new Date(preview.expires_at);

    if (
      Number.isNaN(previewExpiresAt.getTime()) ||
      previewExpiresAt.getTime() <= Date.now()
    ) {
      return json(
        {
          ok: false,
          message: "This preview has expired.",
        },
        401,
      );
    }

    // Confirm the admin who created this preview is STILL an admin.
    const { data: adminProfile, error: adminProfileError } = await admin
      .from("profiles")
      .select("id, is_admin")
      .eq("id", preview.admin_user_id)
      .maybeSingle();

    if (adminProfileError) {
      console.error(
        "Preview admin verification failed:",
        adminProfileError,
      );

      return json(
        {
          ok: false,
          message: "Could not verify preview authorization.",
        },
        500,
      );
    }

    if (!adminProfile?.is_admin) {
      return json(
        {
          ok: false,
          message: "Preview authorization is no longer valid.",
        },
        403,
      );
    }
// The preview can only be used by the same admin who created it.
if (preview.admin_user_id !== user.id) {
  return json(
    {
      ok: false,
      message: "This preview belongs to another administrator.",
    },
    403,
  );
}
    // Load the membership fresh every time.
    // We do NOT trust membership data embedded in the browser.
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
        expires_at,
        created_at,
        updated_at
      `)
      .eq("id", preview.membership_id)
      .maybeSingle();

    if (membershipError) {
      console.error("Preview membership lookup failed:", membershipError);

      return json(
        {
          ok: false,
          message: "Could not load preview membership.",
        },
        500,
      );
    }

    if (!membership) {
      return json(
        {
          ok: false,
          message: "Preview membership no longer exists.",
        },
        404,
      );
    }

    const expiresAt = membership.expires_at
      ? new Date(membership.expires_at)
      : null;

    const expired =
      expiresAt !== null &&
      !Number.isNaN(expiresAt.getTime()) &&
      expiresAt.getTime() <= Date.now();

    const accessActive =
      membership.status === "active" && !expired;

    return json({
      ok: true,
      preview: {
        preview_id: preview.id,
        preview_expires_at: preview.expires_at,

        membership_id: membership.id,
        user_id: membership.user_id,
        customer_email: membership.customer_email,

        plan: membership.plan,
        status: membership.status,
        starts_at: membership.starts_at,
        expires_at: membership.expires_at,

        access_active: accessActive,
        expired,
      },
    });
  } catch (error) {
    console.error("admin-member-preview-status failed:", error);

    return json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not verify member preview.",
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