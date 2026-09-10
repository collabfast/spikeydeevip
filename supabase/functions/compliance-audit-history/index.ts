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

type HistoryFilters = {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
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
        message: "Compliance audit history service is not configured.",
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

  let filters: HistoryFilters = {};

  if (req.method === "POST") {
    try {
      const body = await req.json();

      if (body && typeof body === "object") {
        filters = body as HistoryFilters;
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
  }

  const action =
    typeof filters.action === "string"
      ? filters.action.trim()
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
    typeof filters.entityId === "string"
      ? filters.entityId.trim()
      : "";

  const from = parseIsoDate(filters.from);
  const to = parseIsoDate(filters.to);

  if (filters.from && !from) {
    return json(
      {
        ok: false,
        message: "Invalid start date.",
      },
      400
    );
  }

  if (filters.to && !to) {
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

  const requestedLimit = Number(filters.limit ?? 100);

  const limit =
    Number.isFinite(requestedLimit)
      ? Math.min(
          Math.max(Math.floor(requestedLimit), 1),
          250
        )
      : 100;

  let query = supabaseAdmin
    .from("compliance_audit_log")
    .select(`
      id,
      user_id,
      action,
      entity_type,
      entity_id,
      details,
      created_at
    `)
    .in("action", [...ALLOWED_ACTIONS])
    .order("created_at", { ascending: false })
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
      "Could not load compliance audit history:",
      eventsError
    );

    return json(
      {
        ok: false,
        message: "Could not load compliance audit history.",
      },
      500
    );
  }

  return json({
    ok: true,
    events: events ?? [],
    count: events?.length ?? 0,
    filters: {
      action: action || null,
      entityId: entityId || null,
      from,
      to,
      limit,
    },
    checkedAt: new Date().toISOString(),
  });
});