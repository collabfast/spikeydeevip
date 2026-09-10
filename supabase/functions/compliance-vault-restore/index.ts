import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const R2_ACCESS_KEY_ID =
  Deno.env.get("R2_ACCESS_KEY_ID") ?? "";

const R2_SECRET_ACCESS_KEY =
  Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";

const R2_ENDPOINT =
  Deno.env.get("R2_ENDPOINT") ?? "";

const R2_BUCKET =
  Deno.env.get("R2_BUCKET") ?? "";

const SOURCE_BUCKET = "compliance-vault";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

async function sha256Hex(data: Uint8Array) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
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

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_ENDPOINT ||
    !R2_BUCKET
  ) {
    return json(
      {
        ok: false,
        message:
          "Compliance restore service is not configured.",
      },
      500
    );
  }

  const authHeader =
    req.headers.get("Authorization") ?? "";

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

  if (
    profileError ||
    !profile?.is_admin
  ) {
    return json(
      {
        ok: false,
        message: "Admin access required.",
      },
      403
    );
  }

  let body: {
    documentId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json(
      {
        ok: false,
        message: "Invalid request body.",
      },
      400
    );
  }

  const documentId =
    typeof body?.documentId === "string"
      ? body.documentId.trim()
      : "";

  if (!documentId) {
    return json(
      {
        ok: false,
        message: "documentId is required.",
      },
      400
    );
  }

  const {
    data: documentRecord,
    error: documentError,
  } = await supabaseAdmin
    .from("compliance_documents")
    .select(`
      id,
      storage_path,
      original_filename,
      document_type,
      performer_id,
      production_id,
      archived_at
    `)
    .eq("id", documentId)
    .single();

  if (
    documentError ||
    !documentRecord
  ) {
    return json(
      {
        ok: false,
        message:
          "Compliance document record was not found.",
      },
      404
    );
  }

  const storagePath =
    documentRecord.storage_path;

  if (!storagePath) {
    return json(
      {
        ok: false,
        message:
          "Compliance document has no storage path.",
      },
      400
    );
  }

  /*
   * IMPORTANT:
   * Never overwrite an existing primary compliance
   * object automatically.
   */
  const {
    data: existingPrimary,
    error: existingPrimaryError,
  } = await supabaseAdmin.storage
    .from(SOURCE_BUCKET)
    .download(storagePath);

  if (
    existingPrimary &&
    !existingPrimaryError
  ) {
    const existingBytes =
      new Uint8Array(
        await existingPrimary.arrayBuffer()
      );

    return json({
      ok: true,
      restored: false,
      alreadyPresent: true,
      documentId,
      storagePath,
      sha256:
        await sha256Hex(existingBytes),
      message:
        "Primary compliance document already exists. No restore was performed.",
    });
  }

  const aws = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey:
      R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const normalizedEndpoint =
    R2_ENDPOINT.replace(/\/+$/, "");

  const encodedKey = storagePath
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const r2Url =
    `${normalizedEndpoint}/${R2_BUCKET}/${encodedKey}`;

  const signedRequest =
    await aws.sign(r2Url, {
      method: "GET",
    });

  const r2Response =
    await fetch(signedRequest);

  if (!r2Response.ok) {
    await supabaseAdmin
      .from("compliance_audit_log")
      .insert({
        user_id: user.id,
        action: "backup_restore_failed",
        entity_type:
          "compliance_document",
        entity_id: documentId,
        details: {
          storage_path: storagePath,
          reason:
            `R2 returned HTTP ${r2Response.status}`,
        },
      });

    return json(
      {
        ok: false,
        message:
          "Backup object could not be retrieved from R2.",
      },
      404
    );
  }

  const backupBytes =
    new Uint8Array(
      await r2Response.arrayBuffer()
    );

  if (!backupBytes.length) {
    return json(
      {
        ok: false,
        message:
          "R2 backup object was empty.",
      },
      500
    );
  }

  const backupHash =
    await sha256Hex(backupBytes);

  const contentType =
    r2Response.headers.get(
      "content-type"
    ) ?? "application/octet-stream";

  const {
    error: uploadError,
  } = await supabaseAdmin.storage
    .from(SOURCE_BUCKET)
    .upload(
      storagePath,
      backupBytes,
      {
        contentType,
        upsert: false,
      }
    );

  if (uploadError) {
    console.error(
      "Compliance restore upload failed:",
      uploadError
    );

    await supabaseAdmin
      .from("compliance_audit_log")
      .insert({
        user_id: user.id,
        action: "backup_restore_failed",
        entity_type:
          "compliance_document",
        entity_id: documentId,
        details: {
          storage_path: storagePath,
          reason:
            uploadError.message,
        },
      });

    return json(
      {
        ok: false,
        message:
          "Could not restore the compliance document into primary storage.",
      },
      500
    );
  }

  /*
   * Download the restored object again and verify
   * it matches the R2 backup exactly.
   */
  const {
    data: restoredObject,
    error: restoredError,
  } = await supabaseAdmin.storage
    .from(SOURCE_BUCKET)
    .download(storagePath);

  if (
    restoredError ||
    !restoredObject
  ) {
    return json(
      {
        ok: false,
        message:
          "Document was restored but verification could not be completed.",
      },
      500
    );
  }

  const restoredBytes =
    new Uint8Array(
      await restoredObject.arrayBuffer()
    );

  const restoredHash =
    await sha256Hex(restoredBytes);

  if (
    restoredHash !== backupHash
  ) {
    await supabaseAdmin
      .from("compliance_audit_log")
      .insert({
        user_id: user.id,
        action:
          "backup_restore_integrity_failed",
        entity_type:
          "compliance_document",
        entity_id: documentId,
        details: {
          storage_path: storagePath,
          backup_sha256:
            backupHash,
          restored_sha256:
            restoredHash,
        },
      });

    return json(
      {
        ok: false,
        message:
          "Restore completed but SHA-256 verification failed.",
      },
      500
    );
  }

  await supabaseAdmin
    .from("compliance_audit_log")
    .insert({
      user_id: user.id,
      action: "backup_restore_completed",
      entity_type:
        "compliance_document",
      entity_id: documentId,
      details: {
        storage_path: storagePath,
        sha256: restoredHash,
        source: "cloudflare_r2",
        destination:
          "supabase_compliance_vault",
      },
    });

  return json({
    ok: true,
    restored: true,
    alreadyPresent: false,
    integrityVerified: true,
    documentId,
    storagePath,
    sha256: restoredHash,
    message:
      "Compliance document restored from R2 and SHA-256 verification passed.",
  });
});