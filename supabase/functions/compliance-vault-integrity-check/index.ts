import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") ?? "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";
const R2_ENDPOINT = (Deno.env.get("R2_ENDPOINT") ?? "").replace(/\/+$/, "");
const R2_BUCKET = Deno.env.get("R2_BUCKET") ?? "";
const COMPLIANCE_CRON_SECRET =
  Deno.env.get("COMPLIANCE_CRON_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const COMPLIANCE_ALERT_EMAIL =
  Deno.env.get("COMPLIANCE_ALERT_EMAIL") ?? "";
const SOURCE_BUCKET = "compliance-vault";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
"authorization, x-client-info, apikey, content-type, x-compliance-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function writeAudit(
  supabaseAdmin: ReturnType<typeof createClient>,
  action: string,
  documentId: string,
  details: Record<string, unknown>,
) {
  const { error } = await supabaseAdmin
    .from("compliance_audit_log")
    .insert({
      user_id: null,
      action,
      entity_type: "compliance_document_backup",
      entity_id: documentId,
      details,
    });

  if (error) {
    console.error("Audit insertion failed:", error);
  }
}
async function sendComplianceFailureAlert(
  failed: number,
  checked: number,
  results: Array<Record<string, unknown>>,
) {
  if (!RESEND_API_KEY || !COMPLIANCE_ALERT_EMAIL) {
    console.error("Compliance alert email is not configured.");
    return;
  }

  const failedResults = results.filter((result) => result.ok === false);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SpikeyDeeVIP Compliance <no-reply@auth.spikeydeevip.com>",
      to: [COMPLIANCE_ALERT_EMAIL],
      subject: "URGENT: SpikeyDeeVIP compliance backup integrity failure",
      text: [
        "A compliance backup integrity check detected a failure.",
        "",
        `Documents checked: ${checked}`,
        `Failures: ${failed}`,
        `Time: ${new Date().toISOString()}`,
        "",
        "Failed records:",
        JSON.stringify(failedResults, null, 2),
        "",
        "Review the Supabase compliance audit log and Cloudflare R2 backup immediately.",
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      "Compliance alert email failed:",
      response.status,
      errorText,
    );
  }
}
async function registerComplianceFailure(
  supabaseAdmin: ReturnType<typeof createClient>,
  documentId: string,
  failureReason: string,
) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("compliance_backup_alert_state")
    .select(
      "id, consecutive_failures, initial_alert_sent_at, escalation_alert_sent_at, recovered_at",
    )
    .eq("document_id", documentId)
    .eq("failure_reason", failureReason)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("compliance_backup_alert_state")
      .insert({
        document_id: documentId,
        failure_reason: failureReason,
        consecutive_failures: 1,
        first_failed_at: new Date().toISOString(),
        last_failed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return {
      action: "initial" as const,
      state: inserted,
    };
  }

  const nextCount =
    existing.recovered_at
      ? 1
      : (existing.consecutive_failures ?? 0) + 1;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("compliance_backup_alert_state")
    .update({
      consecutive_failures: nextCount,
      last_failed_at: new Date().toISOString(),
      recovered_at: null,
      updated_at: new Date().toISOString(),
      ...(existing.recovered_at
        ? {
            first_failed_at: new Date().toISOString(),
            initial_alert_sent_at: null,
            escalation_alert_sent_at: null,
          }
        : {}),
    })
    .eq("id", existing.id)
    .select()
    .single();

  if (updateError) {
    throw updateError;
  }

  if (existing.recovered_at) {
    return {
      action: "initial" as const,
      state: updated,
    };
  }

  if (
    nextCount >= 3 &&
    !existing.escalation_alert_sent_at
  ) {
    return {
      action: "escalation" as const,
      state: updated,
    };
  }

  return {
    action: "none" as const,
    state: updated,
  };
}
async function markComplianceRecovered(
  supabaseAdmin: ReturnType<typeof createClient>,
  documentId: string,
) {
  const { data: activeFailures, error: loadError } = await supabaseAdmin
    .from("compliance_backup_alert_state")
    .select(
      "id, failure_reason, consecutive_failures, initial_alert_sent_at, escalation_alert_sent_at",
    )
    .eq("document_id", documentId)
    .is("recovered_at", null);

  if (loadError) {
    throw loadError;
  }

  if (!activeFailures || activeFailures.length === 0) {
    return [];
  }

  const recoveredAt = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("compliance_backup_alert_state")
    .update({
      recovered_at: recoveredAt,
      updated_at: recoveredAt,
    })
    .eq("document_id", documentId)
    .is("recovered_at", null);

  if (updateError) {
    throw updateError;
  }

  return activeFailures;
}
async function markComplianceAlertSent(
  supabaseAdmin: ReturnType<typeof createClient>,
  stateId: string,
  alertType: "initial" | "escalation",
) {
  const now = new Date().toISOString();

  const updates =
    alertType === "initial"
      ? {
          initial_alert_sent_at: now,
          updated_at: now,
        }
      : {
          escalation_alert_sent_at: now,
          updated_at: now,
        };

  const { error } = await supabaseAdmin
    .from("compliance_backup_alert_state")
    .update(updates)
    .eq("id", stateId);

  if (error) {
    throw error;
  }
}
async function sendComplianceRecoveryAlert(
  documentId: string,
  storagePath: string,
  recoveredFailures: Array<Record<string, unknown>>,
) {
  if (!RESEND_API_KEY || !COMPLIANCE_ALERT_EMAIL) {
    console.error("Compliance recovery email is not configured.");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SpikeyDeeVIP Compliance <no-reply@auth.spikeydeevip.com>",
      to: [COMPLIANCE_ALERT_EMAIL],
      subject: "RESOLVED: SpikeyDeeVIP compliance backup integrity restored",
      text: [
        "A previously failing compliance backup has recovered.",
        "",
        `Document ID: ${documentId}`,
        `Storage path: ${storagePath}`,
        `Recovered at: ${new Date().toISOString()}`,
        "",
        "Previous failure records:",
        JSON.stringify(recoveredFailures, null, 2),
        "",
        "The latest integrity check passed successfully.",
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "Compliance recovery email failed:",
      response.status,
      errorText,
    );
  }
}
Deno.serve(async (req) => {
if (req.method === "OPTIONS") {
  return new Response("ok", {
    headers: corsHeaders,
  });
}
const cronSecret = req.headers.get("x-compliance-cron-secret") ?? "";

const hasValidCronSecret =
  COMPLIANCE_CRON_SECRET &&
  cronSecret === COMPLIANCE_CRON_SECRET;
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

  let authorizedUserId: string | null = null;

if (!hasValidCronSecret) {
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

  authorizedUserId = user.id;
}
  if (req.method !== "POST") {
    return json(
      {
        ok: false,
        message: "Method not allowed.",
      },
      405,
    );
  }

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_ENDPOINT ||
    !R2_BUCKET
    || !COMPLIANCE_CRON_SECRET
  ) {
    return json(
      {
        ok: false,
        message: "Integrity checker is not fully configured.",
      },
      500,
    );
  }



  const r2 = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const { data: documents, error: documentsError } =
    await supabaseAdmin
      .from("compliance_documents")
      .select("id, storage_path")
      .order("created_at", { ascending: true });

  if (documentsError) {
    console.error("Could not load compliance documents:", documentsError);

    return json(
      {
        ok: false,
        message: "Could not load compliance documents.",
      },
      500,
    );
  }

  const results: Array<Record<string, unknown>> = [];

  let verified = 0;
  let failed = 0;

  for (const document of documents ?? []) {
    const storagePath = document.storage_path;

    try {
      const { data: sourceFile, error: sourceError } =
        await supabaseAdmin.storage
          .from(SOURCE_BUCKET)
          .download(storagePath);

      if (sourceError || !sourceFile) {
        failed++;

        await writeAudit(
          supabaseAdmin,
          "backup_integrity_failed",
          document.id,
          {
            compliance_document_id: document.id,
            storage_path: storagePath,
            reason:
              sourceError?.message ??
              "Supabase source file could not be read.",
            scheduled_check: true,
          },
        );

        results.push({
          documentId: document.id,
          storagePath,
          ok: false,
          reason: "source_unavailable",
        });
const alertState = await registerComplianceFailure(
  supabaseAdmin,
  document.id,
  "source_unavailable",
);

if (alertState.action === "initial") {
  await sendComplianceFailureAlert(
    1,
    1,
    [
      {
        documentId: document.id,
        storagePath,
        ok: false,
        reason: "source_unavailable",
      },
    ],
  );

  await markComplianceAlertSent(
    supabaseAdmin,
    alertState.state.id,
    "initial",
  );
}

if (alertState.action === "escalation") {
  await sendComplianceFailureAlert(
    1,
    1,
    [
      {
        documentId: document.id,
        storagePath,
        ok: false,
        reason: "source_unavailable",
        escalation: true,
        consecutiveFailures:
          alertState.state.consecutive_failures,
      },
    ],
  );

  await markComplianceAlertSent(
    supabaseAdmin,
    alertState.state.id,
    "escalation",
  );
}
        continue;
      }

      const sourceBytes =
        new Uint8Array(await sourceFile.arrayBuffer());

      const sourceSha256 =
        await sha256Hex(sourceBytes);

      const r2ObjectUrl =
        `${R2_ENDPOINT}/${encodeURIComponent(R2_BUCKET)}/${encodeStoragePath(storagePath)}`;

      const r2Response = await r2.fetch(
        r2ObjectUrl,
        {
          method: "GET",
        },
      );

      if (!r2Response.ok) {
        failed++;

        const errorText = await r2Response.text();

        await writeAudit(
          supabaseAdmin,
          "backup_integrity_failed",
          document.id,
          {
            compliance_document_id: document.id,
            storage_path: storagePath,
            r2_bucket: R2_BUCKET,
            r2_key: storagePath,
            reason:
              `R2 GET failed with ${r2Response.status}`,
            response: errorText.slice(0, 500),
            source_sha256: sourceSha256,
            scheduled_check: true,
          },
        );

        results.push({
          documentId: document.id,
          storagePath,
          ok: false,
          reason: "backup_unavailable",
          status: r2Response.status,
        });
const alertState = await registerComplianceFailure(
  supabaseAdmin,
  document.id,
  "backup_unavailable",
);

if (alertState.action === "initial") {
  await sendComplianceFailureAlert(
    1,
    1,
    [
      {
        documentId: document.id,
        storagePath,
        ok: false,
        reason: "backup_unavailable",
        status: r2Response.status,
      },
    ],
  );

  await markComplianceAlertSent(
    supabaseAdmin,
    alertState.state.id,
    "initial",
  );
}

if (alertState.action === "escalation") {
  await sendComplianceFailureAlert(
    1,
    1,
    [
      {
        documentId: document.id,
        storagePath,
        ok: false,
        reason: "backup_unavailable",
        status: r2Response.status,
        escalation: true,
        consecutiveFailures:
          alertState.state.consecutive_failures,
      },
    ],
  );

  await markComplianceAlertSent(
    supabaseAdmin,
    alertState.state.id,
    "escalation",
  );
}
        continue;
      }

      const r2Bytes =
        new Uint8Array(await r2Response.arrayBuffer());

      const r2Sha256 =
        await sha256Hex(r2Bytes);

      const integrityVerified =
        sourceSha256 === r2Sha256;

      if (!integrityVerified) {
        failed++;

        await writeAudit(
          supabaseAdmin,
          "backup_integrity_failed",
          document.id,
          {
            compliance_document_id: document.id,
            storage_path: storagePath,
            r2_bucket: R2_BUCKET,
            r2_key: storagePath,
            source_sha256: sourceSha256,
            r2_sha256: r2Sha256,
            integrity_verified: false,
            scheduled_check: true,
          },
        );

        results.push({
          documentId: document.id,
          storagePath,
          ok: false,
          reason: "hash_mismatch",
          sourceSha256,
          r2Sha256,
        });
const alertState = await registerComplianceFailure(
  supabaseAdmin,
  document.id,
  "hash_mismatch",
);

if (alertState.action === "initial") {
  await sendComplianceFailureAlert(
    1,
    1,
    [
      {
        documentId: document.id,
        storagePath,
        ok: false,
        reason: "hash_mismatch",
        sourceSha256,
        r2Sha256,
      },
    ],
  );

  await markComplianceAlertSent(
    supabaseAdmin,
    alertState.state.id,
    "initial",
  );
}

if (alertState.action === "escalation") {
  await sendComplianceFailureAlert(
    1,
    1,
    [
      {
        documentId: document.id,
        storagePath,
        ok: false,
        reason: "hash_mismatch",
        sourceSha256,
        r2Sha256,
        escalation: true,
        consecutiveFailures:
          alertState.state.consecutive_failures,
      },
    ],
  );

  await markComplianceAlertSent(
    supabaseAdmin,
    alertState.state.id,
    "escalation",
  );
}
        continue;
      }

      verified++;

      await writeAudit(
        supabaseAdmin,
        "backup_integrity_verified",
        document.id,
        {
          compliance_document_id: document.id,
          storage_path: storagePath,
          r2_bucket: R2_BUCKET,
          r2_key: storagePath,
          byte_length: sourceBytes.byteLength,
          source_sha256: sourceSha256,
          r2_sha256: r2Sha256,
          integrity_verified: true,
          scheduled_check: true,
        },
      );

      results.push({
        documentId: document.id,
        storagePath,
        ok: true,
        integrityVerified: true,
        sourceSha256,
        r2Sha256,
      });
   const recoveredFailures = await markComplianceRecovered(
  supabaseAdmin,
  document.id,
);

if (recoveredFailures.length > 0) {
  await sendComplianceRecoveryAlert(
    document.id,
    storagePath,
    recoveredFailures,
  );
}
    } catch (error) {
      failed++;

      const message =
        error instanceof Error
          ? error.message
          : "Unknown integrity-check error.";

      await writeAudit(
        supabaseAdmin,
        "backup_integrity_failed",
        document.id,
        {
          compliance_document_id: document.id,
          storage_path: storagePath,
          reason: message,
          scheduled_check: true,
        },
      );

      results.push({
        documentId: document.id,
        storagePath,
        ok: false,
        reason: "unexpected_error",
        message,
      });
      const alertState = await registerComplianceFailure(
  supabaseAdmin,
  document.id,
  "unexpected_error",
);

if (alertState.action === "initial") {
  await sendComplianceFailureAlert(
    1,
    1,
    [
      {
        documentId: document.id,
        storagePath,
        ok: false,
        reason: "unexpected_error",
        message,
      },
    ],
  );

  await markComplianceAlertSent(
    supabaseAdmin,
    alertState.state.id,
    "initial",
  );
}

if (alertState.action === "escalation") {
  await sendComplianceFailureAlert(
    1,
    1,
    [
      {
        documentId: document.id,
        storagePath,
        ok: false,
        reason: "unexpected_error",
        message,
        escalation: true,
        consecutiveFailures:
          alertState.state.consecutive_failures,
      },
    ],
  );

  await markComplianceAlertSent(
    supabaseAdmin,
    alertState.state.id,
    "escalation",
  );
}
    }
  }

  return json({
    ok: failed === 0,
    checked: documents?.length ?? 0,
    verified,
    failed,
    checkedAt: new Date().toISOString(),
    results,
  });
});