import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json(
      {
        ok: false,
        message: "Method not allowed.",
      },
      405,
    );
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      {
        ok: false,
        message: "Compliance health service is not configured.",
      },
      500,
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  if (!token) {
    return json(
      {
        ok: false,
        message: "Unauthorized.",
      },
      401,
    );
  }

  const supabaseAdmin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return json(
      {
        ok: false,
        message: "Unauthorized.",
      },
      401,
    );
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    return json(
      {
        ok: false,
        message: "Admin access required.",
      },
      403,
    );
  }

  const {
    count: totalDocuments,
    error: documentsError,
  } = await supabaseAdmin
    .from("compliance_documents")
    .select("id", {
      count: "exact",
      head: true,
    });

  if (documentsError) {
    return json(
      {
        ok: false,
        message: "Could not load compliance document count.",
      },
      500,
    );
  }

  const {
    data: activeFailures,
    error: failuresError,
  } = await supabaseAdmin
    .from("compliance_backup_alert_state")
    .select(
      `
        id,
        document_id,
        failure_reason,
        first_failed_at,
        last_failed_at,
        consecutive_failures,
        initial_alert_sent_at,
        escalation_alert_sent_at
      `,
    )
    .is("recovered_at", null)
    .order("last_failed_at", {
      ascending: false,
    });

  if (failuresError) {
    return json(
      {
        ok: false,
        message: "Could not load compliance failure state.",
      },
      500,
    );
  }

  const {
    data: latestAudit,
    error: auditError,
  } = await supabaseAdmin
    .from("compliance_audit_log")
    .select(
      `
        id,
        action,
        entity_id,
        details,
        created_at
      `,
    )
    .in("action", [
      "backup_integrity_verified",
      "backup_integrity_failed",
    ])
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (auditError) {
    return json(
      {
        ok: false,
        message: "Could not load latest integrity activity.",
      },
      500,
    );
  }

  const failures = activeFailures ?? [];

  const escalatedFailures = failures.filter(
    (failure) =>
      Boolean(failure.escalation_alert_sent_at) ||
      Number(failure.consecutive_failures ?? 0) >= 3,
  );

  const status =
    failures.length === 0
      ? "healthy"
      : escalatedFailures.length > 0
        ? "critical"
        : "warning";

  return json({
    ok: true,

    status,

    totalDocuments:
      totalDocuments ?? 0,

    activeFailures:
      failures.length,

    escalatedFailures:
      escalatedFailures.length,

    lastIntegrityActivity:
      latestAudit?.created_at ?? null,

    lastIntegrityAction:
      latestAudit?.action ?? null,

    failures,

    checkedAt:
      new Date().toISOString(),
  });
});