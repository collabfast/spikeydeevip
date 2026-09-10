import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ACTIONS = [
  "document_uploaded",
  "document_backup_confirmed",
  "document_backup_failed",
  "backup_completed",
  "backup_already_exists",
  "backup_failed",
  "backup_integrity_verified",
  "backup_integrity_failed",
] as const;

type AllowedAction = (typeof ALLOWED_ACTIONS)[number];

type ExportRequest = {
  action?: AllowedAction | "";
  entityId?: string;
  from?: string;
  to?: string;
  limit?: number;
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

function parseIsoDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        ok: false,
        message: "Method not allowed.",
      },
      405
    );
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      {
        ok: false,
        message: "Compliance audit export service is not configured.",
      },
      500
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
      401
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
    }
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
      401
    );
  }

  const { data: profile, error: profileError } =
    await supabaseAdmin
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
      403
    );
  }

  let body: ExportRequest = {};

  try {
    const requestBody = await req.json();

    if (requestBody && typeof requestBody === "object") {
      body = requestBody as ExportRequest;
    }
  } catch {
    return json(
      {
        ok: false,
        message: "Invalid request body.",
      },
      400
    );
  }

  const action =
    typeof body.action === "string"
      ? body.action.trim()
      : "";

  if (
    action &&
    !ALLOWED_ACTIONS.includes(action as AllowedAction)
  ) {
    return json(
      {
        ok: false,
        message: "Invalid compliance action filter.",
      },
      400
    );
  }

  const entityId =
    typeof body.entityId === "string"
      ? body.entityId.trim()
      : "";

  const from = parseIsoDate(body.from);
  const to = parseIsoDate(body.to);

  if (body.from && !from) {
    return json(
      {
        ok: false,
        message: "Invalid start date.",
      },
      400
    );
  }

  if (body.to && !to) {
    return json(
      {
        ok: false,
        message: "Invalid end date.",
      },
      400
    );
  }

  if (
    from &&
    to &&
    new Date(from).getTime() > new Date(to).getTime()
  ) {
    return json(
      {
        ok: false,
        message: "Start date must be before end date.",
      },
      400
    );
  }

  const requestedLimit = Number(body.limit ?? 1000);

  const limit =
    Number.isFinite(requestedLimit)
      ? Math.min(
          Math.max(Math.floor(requestedLimit), 1),
          5000
        )
      : 1000;

  let query = supabaseAdmin
    .from("compliance_audit_log")
    .select(`
      id,
      user_id,
      action,
      entity_type,
      entity_id,
      created_at
    `)
    .in("action", [...ALLOWED_ACTIONS])
    .order("created_at", {
      ascending: false,
    })
    .limit(limit);

  if (action) {
    query = query.eq("action", action);
  }

  if (entityId) {
    query = query.eq("entity_id", entityId);
  }

  if (from) {
    query = query.gte("created_at", from);
  }

  if (to) {
    query = query.lte("created_at", to);
  }

  const { data: events, error: eventsError } =
    await query;

  if (eventsError) {
    console.error(
      "Could not export compliance audit history:",
      eventsError
    );

    return json(
      {
        ok: false,
        message: "Could not export compliance audit history.",
      },
      500
    );
  }

  const rows = events ?? [];

  const csvHeader = [
    "event_id",
    "created_at",
    "action",
    "entity_type",
    "entity_id",
    "user_id",
  ];

  const csvRows = rows.map((event) =>
    [
      event.id,
      event.created_at,
      event.action,
      event.entity_type,
      event.entity_id,
      event.user_id,
    ]
      .map(escapeCsv)
      .join(",")
  );

  const csv = [
    csvHeader.join(","),
    ...csvRows,
  ].join("\n");

  const timestamp =
    new Date()
      .toISOString()
      .replaceAll(":", "-")
      .replaceAll(".", "-");

  return json({
    ok: true,
    filename:
      `spikeydeevip-compliance-audit-${timestamp}.csv`,
    csv,
    count: rows.length,
    filters: {
      action: action || null,
      entityId: entityId || null,
      from,
      to,
      limit,
    },
    generatedAt: new Date().toISOString(),
  });
});