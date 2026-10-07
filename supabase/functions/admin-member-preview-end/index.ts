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

    // Verify the currently signed-in user.
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

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Confirm this user is still a Studio Admin.
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Admin verification failed:", profileError);

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

    const tokenHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(previewToken),
    );

    const tokenHash = Array.from(new Uint8Array(tokenHashBuffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    // Only allow the admin who created the preview to end it.
    const { data: preview, error: previewError } = await admin
      .from("admin_member_previews")
      .select("id, admin_user_id, ended_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (previewError) {
      console.error("Preview lookup failed:", previewError);

      return json(
        {
          ok: false,
          message: "Could not find member preview.",
        },
        500,
      );
    }

    if (!preview) {
      return json(
        {
          ok: false,
          message: "Preview not found.",
        },
        404,
      );
    }

    if (preview.admin_user_id !== user.id) {
      return json({ ok: false, message: "Forbidden." }, 403);
    }

    if (!preview.ended_at) {
      const { error: endError } = await admin
        .from("admin_member_previews")
        .update({
          ended_at: new Date().toISOString(),
        })
        .eq("id", preview.id)
        .is("ended_at", null);

      if (endError) {
        console.error("Could not end member preview:", endError);

        return json(
          {
            ok: false,
            message: "Could not end member preview.",
          },
          500,
        );
      }
    }

    return json({
      ok: true,
      ended: true,
    });
  } catch (error) {
    console.error("admin-member-preview-end failed:", error);

    return json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not end member preview.",
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