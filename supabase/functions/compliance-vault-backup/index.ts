import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") ?? "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";
const R2_ENDPOINT = (Deno.env.get("R2_ENDPOINT") ?? "").replace(/\/+$/, "");
const R2_BUCKET = Deno.env.get("R2_BUCKET") ?? "";

const SOURCE_BUCKET = "compliance-vault";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type BackupRequest = {
  documentId?: string;
  storagePath?: string;
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
  userId: string,
  action: string,
  details: Record<string, unknown>,
) {
  try {
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: userId,
      action,
      entity_type: "compliance_document_backup",
      entity_id:
        typeof details.compliance_document_id === "string"
          ? details.compliance_document_id
          : null,
      details,
    });
  } catch {
    // Never hide the actual backup result because audit insertion failed.
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, message: "Method not allowed." }, 405);
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
      { ok: false, message: "Backup service is not fully configured." },
      500,
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    return json({ ok: false, message: "Unauthorized." }, 401);
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

  const token = authHeader.slice("Bearer ".length).trim();

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return json({ ok: false, message: "Unauthorized." }, 401);
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.is_admin !== true) {
    return json({ ok: false, message: "Admin access required." }, 403);
  }

  let body: BackupRequest;

  try {
    body = await req.json();
  } catch {
    return json({ ok: false, message: "Invalid JSON body." }, 400);
  }

  const documentId = body.documentId?.trim();
  const suppliedStoragePath = body.storagePath?.trim();

  if (!documentId && !suppliedStoragePath) {
    return json(
      {
        ok: false,
        message: "documentId or storagePath is required.",
      },
      400,
    );
  }

  let documentQuery = supabaseAdmin
    .from("compliance_documents")
    .select("id, storage_path, original_filename, document_type");

  if (documentId) {
    documentQuery = documentQuery.eq("id", documentId);
  } else {
    documentQuery = documentQuery.eq("storage_path", suppliedStoragePath!);
  }

  const { data: documentRow, error: documentError } =
    await documentQuery.maybeSingle();

  if (documentError) {
    console.error("Compliance document lookup failed:", {
      message: documentError.message,
      code: documentError.code,
      details: documentError.details,
      hint: documentError.hint,
      documentId: documentId ?? null,
      storagePath: suppliedStoragePath ?? null,
    });

    return json(
      {
        ok: false,
        message: "Could not validate the compliance document.",
      },
      500,
    );
  }

  if (!documentRow) {
    return json(
      {
        ok: false,
        message: documentId
          ? "No compliance document record exists for this document ID."
          : "No compliance document record exists for this storage path.",
      },
      404,
    );
  }

  const storagePath = documentRow.storage_path;

  const { data: sourceFile, error: downloadError } =
    await supabaseAdmin.storage.from(SOURCE_BUCKET).download(storagePath);

  if (downloadError || !sourceFile) {
    await writeAudit(supabaseAdmin, user.id, "backup_failed", {
      compliance_document_id: documentRow.id,
      storage_path: storagePath,
      reason: downloadError?.message ?? "Source file unavailable.",
    });

    return json(
      {
        ok: false,
        message: "Could not read the file from the compliance vault.",
      },
      500,
    );
  }

  const bytes = new Uint8Array(await sourceFile.arrayBuffer());
  const sourceSha256 = await sha256Hex(bytes);

  const r2ObjectUrl =
    `${R2_ENDPOINT}/${encodeURIComponent(R2_BUCKET)}/${encodeStoragePath(storagePath)}`;

  const r2 = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const headResponse = await r2.fetch(r2ObjectUrl, {
    method: "HEAD",
  });

  if (headResponse.ok) {
    const existingResponse = await r2.fetch(r2ObjectUrl, {
      method: "GET",
    });

    if (!existingResponse.ok) {
      const errorText = await existingResponse.text();

      await writeAudit(supabaseAdmin, user.id, "backup_integrity_failed", {
        compliance_document_id: documentRow.id,
        storage_path: storagePath,
        reason: `R2 GET failed with ${existingResponse.status}`,
        response: errorText.slice(0, 500),
        source_sha256: sourceSha256,
      });

      return json(
        {
          ok: false,
          message: "The existing R2 backup could not be read for integrity verification.",
        },
        502,
      );
    }

    const existingBytes = new Uint8Array(await existingResponse.arrayBuffer());
    const r2Sha256 = await sha256Hex(existingBytes);
    const integrityVerified = sourceSha256 === r2Sha256;

    if (!integrityVerified) {
      await writeAudit(supabaseAdmin, user.id, "backup_integrity_failed", {
        compliance_document_id: documentRow.id,
        storage_path: storagePath,
        r2_key: storagePath,
        source_sha256: sourceSha256,
        r2_sha256: r2Sha256,
        integrity_verified: false,
      });

      return json(
        {
          ok: false,
          message: "Backup integrity verification failed. The R2 copy does not match the Supabase original.",
          integrityVerified: false,
          sourceSha256,
          r2Sha256,
        },
        409,
      );
    }

    await writeAudit(supabaseAdmin, user.id, "backup_already_exists", {
      compliance_document_id: documentRow.id,
      storage_path: storagePath,
      r2_key: storagePath,
      source_sha256: sourceSha256,
      r2_sha256: r2Sha256,
      integrity_verified: true,
    });

    await writeAudit(supabaseAdmin, user.id, "backup_integrity_verified", {
      compliance_document_id: documentRow.id,
      storage_path: storagePath,
      r2_bucket: R2_BUCKET,
      r2_key: storagePath,
      byte_length: bytes.byteLength,
      source_sha256: sourceSha256,
      r2_sha256: r2Sha256,
      integrity_verified: true,
    });

    return json({
      ok: true,
      alreadyBackedUp: true,
      integrityVerified: true,
      documentId: documentRow.id,
      storagePath,
      r2Key: storagePath,
      bytes: bytes.byteLength,
      sourceSha256,
      r2Sha256,
    });
  }

  if (headResponse.status !== 404) {
    const errorText = await headResponse.text();

    await writeAudit(supabaseAdmin, user.id, "backup_failed", {
      compliance_document_id: documentRow.id,
      storage_path: storagePath,
      reason: `R2 HEAD failed with ${headResponse.status}`,
      response: errorText.slice(0, 500),
      source_sha256: sourceSha256,
    });

    return json(
      {
        ok: false,
        message: "Could not verify the destination backup bucket.",
      },
      502,
    );
  }

  const contentType = sourceFile.type || "application/octet-stream";

  const putResponse = await r2.fetch(r2ObjectUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-meta-source-bucket": SOURCE_BUCKET,
      "x-amz-meta-source-path": storagePath,
      "x-amz-meta-compliance-document-id": documentRow.id,
      "x-amz-meta-source-sha256": sourceSha256,
    },
    body: bytes,
  });

  if (!putResponse.ok) {
    const errorText = await putResponse.text();

    await writeAudit(supabaseAdmin, user.id, "backup_failed", {
      compliance_document_id: documentRow.id,
      storage_path: storagePath,
      reason: `R2 PUT failed with ${putResponse.status}`,
      response: errorText.slice(0, 500),
      source_sha256: sourceSha256,
    });

    return json(
      {
        ok: false,
        message:
          "The compliance document could not be copied to the backup vault.",
      },
      502,
    );
  }

  // Read the newly-created R2 copy back and hash it independently.
  const verifyResponse = await r2.fetch(r2ObjectUrl, {
    method: "GET",
  });

  if (!verifyResponse.ok) {
    const errorText = await verifyResponse.text();

    await writeAudit(supabaseAdmin, user.id, "backup_integrity_failed", {
      compliance_document_id: documentRow.id,
      storage_path: storagePath,
      reason: `R2 verification GET failed with ${verifyResponse.status}`,
      response: errorText.slice(0, 500),
      source_sha256: sourceSha256,
    });

    return json(
      {
        ok: false,
        message: "The R2 backup was written but could not be verified.",
      },
      502,
    );
  }

  const verifiedBytes = new Uint8Array(await verifyResponse.arrayBuffer());
  const r2Sha256 = await sha256Hex(verifiedBytes);
  const integrityVerified = sourceSha256 === r2Sha256;

  if (!integrityVerified) {
    await writeAudit(supabaseAdmin, user.id, "backup_integrity_failed", {
      compliance_document_id: documentRow.id,
      storage_path: storagePath,
      r2_bucket: R2_BUCKET,
      r2_key: storagePath,
      source_sha256: sourceSha256,
      r2_sha256: r2Sha256,
      integrity_verified: false,
    });

    return json(
      {
        ok: false,
        message: "Backup integrity verification failed. The R2 copy does not match the Supabase original.",
        integrityVerified: false,
        sourceSha256,
        r2Sha256,
      },
      409,
    );
  }

  await writeAudit(supabaseAdmin, user.id, "backup_completed", {
    compliance_document_id: documentRow.id,
    storage_path: storagePath,
    r2_bucket: R2_BUCKET,
    r2_key: storagePath,
    byte_length: bytes.byteLength,
    content_type: contentType,
    source_sha256: sourceSha256,
    r2_sha256: r2Sha256,
    integrity_verified: true,
  });

  await writeAudit(supabaseAdmin, user.id, "backup_integrity_verified", {
    compliance_document_id: documentRow.id,
    storage_path: storagePath,
    r2_bucket: R2_BUCKET,
    r2_key: storagePath,
    byte_length: bytes.byteLength,
    source_sha256: sourceSha256,
    r2_sha256: r2Sha256,
    integrity_verified: true,
  });

  return json({
    ok: true,
    alreadyBackedUp: false,
    integrityVerified: true,
    documentId: documentRow.id,
    storagePath,
    r2Key: storagePath,
    bytes: bytes.byteLength,
    sourceSha256,
    r2Sha256,
  });
});
