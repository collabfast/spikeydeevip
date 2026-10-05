import { createClient } from "npm:@supabase/supabase-js@2";

const CCBILL_FLEXFORM_URL =
  "https://api.ccbill.com/wap-frontflex/flexforms/4319ea1d-3d94-49cd-bcee-b67b46c2db44";

const CCBILL_SUBACCOUNT = "0006";
const CURRENCY_CODE = "840";
const INITIAL_PERIOD = "30";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders(),
    });
  }

  try {
    if (req.method !== "POST") {
      return json(
        { ok: false, message: "Method not allowed." },
        405,
      );
    }

    // -----------------------------
    // 1. Authenticate the member
    // -----------------------------

    const authorization =
      req.headers.get("Authorization") ?? "";

    if (!authorization.startsWith("Bearer ")) {
      return json(
        { ok: false, message: "Authentication required." },
        401,
      );
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL")!;

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const dynamicPricingKey =
      Deno.env.get("CCBILL_DYNAMIC_PRICING_KEY");

    if (!dynamicPricingKey) {
      throw new Error(
        "Missing CCBILL_DYNAMIC_PRICING_KEY secret.",
      );
    }

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const token = authorization.replace(
      /^Bearer\s+/i,
      "",
    );

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);

    if (userError || !user) {
      return json(
        { ok: false, message: "Invalid session." },
        401,
      );
    }

    // -----------------------------
    // 2. Read attachment ID only
    // -----------------------------

    const body = await req.json();

    const attachmentId = String(
      body?.attachment_id ?? "",
    ).trim();

    if (!attachmentId) {
      return json(
        {
          ok: false,
          message: "Missing attachment_id.",
        },
        400,
      );
    }

    // -----------------------------
    // 3. Load attachment + message
    //
    // Price comes from DATABASE.
    // Never trust a browser-supplied price.
    // -----------------------------

    const {
      data: attachment,
      error: attachmentError,
    } = await admin
      .from("message_attachments")
      .select(`
        id,
        message_id,
        price_cents,
        is_paid,
        messages!inner (
          id,
          conversation_id
        )
      `)
      .eq("id", attachmentId)
      .single();
console.log("ATTACHMENT LOOKUP", {
  attachmentId,
  attachment,
  attachmentError,
});
    if (attachmentError || !attachment) {
      return json(
        {
          ok: false,
          message: "Attachment not found.",
        },
        404,
      );
    }

    if (
      attachment.is_paid !== true ||
      !Number.isInteger(attachment.price_cents) ||
      attachment.price_cents < 100 ||
      attachment.price_cents > 29900
    ) {
      return json(
        {
          ok: false,
          message:
            "This attachment is not available as paid media.",
        },
        400,
      );
    }

    const messageRelation = Array.isArray(
        attachment.messages,
      )
      ? attachment.messages[0]
      : attachment.messages;

    const conversationId =
      messageRelation?.conversation_id;

    if (!conversationId) {
      throw new Error(
        "Attachment has no conversation.",
      );
    }

    // -----------------------------
    // 4. Verify this member belongs
    //    to the conversation
    // -----------------------------

    const {
      data: conversation,
      error: conversationError,
    } = await admin
      .from("conversations")
      .select("id, member_id")
      .eq("id", conversationId)
      .eq("member_id", user.id)
      .maybeSingle();

    if (conversationError) {
      throw conversationError;
    }

    if (!conversation) {
      return json(
        {
          ok: false,
          message:
            "You do not have access to this attachment.",
        },
        403,
      );
    }

    // -----------------------------
    // 5. Check existing purchase
    // -----------------------------

    const {
      data: existingPurchase,
      error: existingError,
    } = await admin
      .from("message_attachment_purchases")
      .select("id, status")
      .eq("attachment_id", attachmentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingPurchase?.status === "paid") {
      return json({
        ok: true,
        alreadyPurchased: true,
      });
    }

    // -----------------------------
    // 6. Create/update pending purchase
    // -----------------------------

    const amountCents =
      attachment.price_cents;

    const {
      data: purchase,
      error: purchaseError,
    } = await admin
      .from("message_attachment_purchases")
      .upsert(
        {
          attachment_id: attachmentId,
          user_id: user.id,
          amount_cents: amountCents,
          status: "pending",
        },
        {
          onConflict: "attachment_id,user_id",
        },
      )
      .select("id")
      .single();

    if (purchaseError || !purchase?.id) {
      throw new Error(
        purchaseError?.message ??
          "Could not create purchase.",
      );
    }

    // -----------------------------
    // 7. Generate CCBill formDigest
    // -----------------------------

    const initialPrice =
      (amountCents / 100).toFixed(2);

    const digestSource =
      initialPrice +
      INITIAL_PERIOD +
      CURRENCY_CODE +
      dynamicPricingKey;

    const formDigest =
  md5(digestSource);

    // -----------------------------
    // 8. Build Sandbox CCBill URL
    // -----------------------------

    const checkoutUrl =
      new URL(CCBILL_FLEXFORM_URL);

    checkoutUrl.searchParams.set(
      "clientSubacc",
      CCBILL_SUBACCOUNT,
    );

    checkoutUrl.searchParams.set(
      "initialPrice",
      initialPrice,
    );

    checkoutUrl.searchParams.set(
      "initialPeriod",
      INITIAL_PERIOD,
    );

    checkoutUrl.searchParams.set(
      "currencyCode",
      CURRENCY_CODE,
    );

    checkoutUrl.searchParams.set(
      "formDigest",
      formDigest,
    );

    // Custom identifiers we need back
    // from CCBill after payment.
    checkoutUrl.searchParams.set(
      "attachment_id",
      attachmentId,
    );

    checkoutUrl.searchParams.set(
      "purchase_id",
      purchase.id,
    );
console.log("CCBILL CHECKOUT URL", checkoutUrl.toString());
    return json({
      ok: true,
      checkoutUrl: checkoutUrl.toString(),
    });
  } catch (error) {
    console.error(
      "CCBill message checkout error:",
      error,
    );

    return json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not start media checkout.",
      },
      500,
    );
  }
});

function md5(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const originalLength = bytes.length;
  const bitLength = originalLength * 8;

  const paddedLength =
    (((originalLength + 8) >>> 6) + 1) * 64;

  const buffer = new Uint8Array(paddedLength);
  buffer.set(bytes);
  buffer[originalLength] = 0x80;

  const view = new DataView(buffer.buffer);

  view.setUint32(
    paddedLength - 8,
    bitLength >>> 0,
    true,
  );

  view.setUint32(
    paddedLength - 4,
    Math.floor(bitLength / 0x100000000),
    true,
  );

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const s = [
    7, 12, 17, 22, 7, 12, 17, 22,
    7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20,
    5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23,
    4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21,
    6, 10, 15, 21, 6, 10, 15, 21,
  ];

  const K = Array.from(
    { length: 64 },
    (_, i) =>
      Math.floor(
        Math.abs(Math.sin(i + 1)) * 0x100000000,
      ) >>> 0,
  );

  const rotateLeft = (x: number, n: number) =>
    ((x << n) | (x >>> (32 - n))) >>> 0;

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const M = new Array<number>(16);

    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(offset + j * 4, true);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;

      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }

      const oldD = D;

      D = C;
      C = B;

      const sum =
        (A + F + K[i] + M[g]) >>> 0;

      B =
        (B + rotateLeft(sum, s[i])) >>> 0;

      A = oldD;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const toHexLE = (value: number) =>
    [0, 8, 16, 24]
      .map((shift) =>
        ((value >>> shift) & 0xff)
          .toString(16)
          .padStart(2, "0")
      )
      .join("");

  return (
    toHexLE(a0) +
    toHexLE(b0) +
    toHexLE(c0) +
    toHexLE(d0)
  );
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
  };
}

function json(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json",
      },
    },
  );
}


function md5(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const originalLength = bytes.length;
  const bitLength = originalLength * 8;

  const paddedLength =
    (((originalLength + 8) >>> 6) + 1) * 64;

  const buffer = new Uint8Array(paddedLength);
  buffer.set(bytes);
  buffer[originalLength] = 0x80;

  const view = new DataView(buffer.buffer);

  view.setUint32(
    paddedLength - 8,
    bitLength >>> 0,
    true,
  );

  view.setUint32(
    paddedLength - 4,
    Math.floor(bitLength / 0x100000000),
    true,
  );

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const s = [
    7, 12, 17, 22, 7, 12, 17, 22,
    7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20,
    5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23,
    4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21,
    6, 10, 15, 21, 6, 10, 15, 21,
  ];

  const K = Array.from(
    { length: 64 },
    (_, i) =>
      Math.floor(
        Math.abs(Math.sin(i + 1)) * 0x100000000,
      ) >>> 0,
  );

  const rotateLeft = (x: number, n: number) =>
    ((x << n) | (x >>> (32 - n))) >>> 0;

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const M = new Array<number>(16);

    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(offset + j * 4, true);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;

      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }

      const oldD = D;

      D = C;
      C = B;

      const sum =
        (A + F + K[i] + M[g]) >>> 0;

      B =
        (B + rotateLeft(sum, s[i])) >>> 0;

      A = oldD;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const toHexLE = (value: number) =>
    [0, 8, 16, 24]
      .map((shift) =>
        ((value >>> shift) & 0xff)
          .toString(16)
          .padStart(2, "0")
      )
      .join("");

  return (
    toHexLE(a0) +
    toHexLE(b0) +
    toHexLE(c0) +
    toHexLE(d0)
  );
}