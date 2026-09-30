import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
let webhookEventId: string | null = null;
  try {
    const requestUrl = new URL(req.url);

   const urlEventType =
  requestUrl.searchParams.get("eventType");

const urlClientAccnum =
  requestUrl.searchParams.get("clientAccnum");

const urlClientSubacc =
  requestUrl.searchParams.get("clientSubacc");

   const body = await readPayload(req);

const eventType =
  urlEventType ??
  getValue(body, "eventType") ??
  "";

const clientAccnum =
  urlClientAccnum ??
  getValue(body, "clientAccnum") ??
  "";

const clientSubacc =
  urlClientSubacc ??
  getValue(body, "clientSubacc") ??
  "";

const subscriptionId =
  getValue(body, "subscriptionId");

const transactionId =
  getValue(body, "transactionId");

    if (!eventType) {
      return new Response("Missing eventType", { status: 400 });
    }

    if (!subscriptionId) {
      return new Response("Missing subscriptionId", { status: 400 });
    }

    /*
     * IMPORTANT:
     * Validate that this webhook belongs to our CCBill account/subaccount.
     */
    const expectedAccnum =
      Deno.env.get("CCBILL_CLIENT_ACCNUM") ?? "";

    const expectedSubacc =
      Deno.env.get("CCBILL_CLIENT_SUBACC") ?? "";

    if (
      expectedAccnum &&
      clientAccnum &&
      clientAccnum !== expectedAccnum
    ) {
      console.error("Invalid CCBill client account", {
        clientAccnum,
      });

      return new Response("Unauthorized", { status: 401 });
    }

    if (
      expectedSubacc &&
      clientSubacc &&
      normalizeSubacc(clientSubacc) !==
        normalizeSubacc(expectedSubacc)
    ) {
      console.error("Invalid CCBill subaccount", {
        clientSubacc,
      });

      return new Response("Unauthorized", { status: 401 });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
/*
 * RECORD WEBHOOK EVENT
 *
 * The unique event_type + transaction_id index prevents the same
 * CCBill transaction from being processed more than once.
 */

if (transactionId) {
  const {
    data: existingEvent,
    error: existingEventError,
  } = await admin
    .from("ccbill_webhook_events")
    .select("id, processed")
    .eq("event_type", eventType)
    .eq("transaction_id", transactionId)
    .maybeSingle();

  if (existingEventError) {
    throw new Error(existingEventError.message);
  }

  if (existingEvent?.processed) {
    console.log("Duplicate CCBill webhook ignored", {
      eventType,
      transactionId,
    });

    return new Response("OK", { status: 200 });
  }

  if (existingEvent) {
    webhookEventId = existingEvent.id;
  } else {
    const {
      data: createdEvent,
      error: createEventError,
    } = await admin
      .from("ccbill_webhook_events")
      .insert({
        event_type: eventType,
        subscription_id: subscriptionId,
        transaction_id: transactionId,
        client_accnum: clientAccnum || null,
        client_subacc: clientSubacc || null,
        payload: body,
        processed: false,
      })
      .select("id")
      .single();

    if (createEventError) {
      /*
       * Another invocation may have inserted the same transaction
       * at nearly the same time. Re-check before failing.
       */
      const {
        data: duplicateEvent,
        error: duplicateLookupError,
      } = await admin
        .from("ccbill_webhook_events")
        .select("id, processed")
        .eq("event_type", eventType)
        .eq("transaction_id", transactionId)
        .maybeSingle();

      if (duplicateLookupError || !duplicateEvent) {
        throw new Error(createEventError.message);
      }

      if (duplicateEvent.processed) {
        console.log("Duplicate CCBill webhook ignored", {
          eventType,
          transactionId,
        });

        return new Response("OK", { status: 200 });
      }

      webhookEventId = duplicateEvent.id;
    } else {
      webhookEventId = createdEvent.id;
    }
  }
}
/*
 * Atomically claim this webhook event before changing membership access.
 * Only one invocation may process a given event.
 */
if (webhookEventId) {
  const {
    data: claimed,
    error: claimError,
  } = await admin.rpc(
    "claim_ccbill_webhook_event",
    {
      p_event_id: webhookEventId,
    },
  );

  if (claimError) {
    throw new Error(claimError.message);
  }

  if (!claimed) {
    console.log(
      "CCBill webhook already claimed or processed; skipping.",
      {
        eventType,
        transactionId,
        webhookEventId,
      },
    );

    return new Response("OK", { status: 200 });
  }
}
    /*
     * Find the membership belonging to this CCBill subscription.
     */
    const {
      data: membership,
      error: membershipError,
    } = await admin
      .from("memberships")
      .select("*")
      .eq("ccbill_subscription_id", subscriptionId)
      .maybeSingle();

    if (membershipError) {
      throw new Error(membershipError.message);
    }

if (!membership) {
  console.error(
    "No membership found for CCBill subscription:",
    subscriptionId,
  );

  if (webhookEventId) {
    const { error: releaseError } =
      await admin.rpc(
        "release_ccbill_webhook_event",
        {
          p_event_id: webhookEventId,
        },
      );

    if (releaseError) {
      throw new Error(
        `Could not release unmatched CCBill webhook: ${releaseError.message}`,
      );
    }
  }

  return new Response("OK", { status: 200 });
}

    /*
     * SUCCESSFUL REBILL
     */
    if (eventType === "RenewalSuccess") {
      const now = new Date();

      /*
       * A successful recurring 30-day payment grants another
       * 30 days of access.
       *
       * If the current membership is still active, extend from its
       * existing expiration. If it already expired, extend from now.
       */
      const currentExpiration =
        membership.expires_at
          ? new Date(membership.expires_at)
          : null;

      const extensionStart =
        currentExpiration &&
        currentExpiration.getTime() > now.getTime()
          ? currentExpiration
          : now;

      const newExpiration =
        new Date(extensionStart);

      newExpiration.setUTCDate(
        newExpiration.getUTCDate() + 30,
      );

      const updatedAt = now.toISOString();

      const {
        error: updateMembershipError,
      } = await admin
        .from("memberships")
        .update({
          status: "active",
          expires_at: newExpiration.toISOString(),
          ccbill_transaction_id:
            transactionId ??
            membership.ccbill_transaction_id,
          updated_at: updatedAt,
        })
        .eq("id", membership.id);

      if (updateMembershipError) {
        throw new Error(updateMembershipError.message);
      }

      /*
       * Keep protected-content entitlement synchronized.
       */
      const {
        error: entitlementError,
      } = await admin
        .from("entitlements")
        .update({
          status: "active",
          expires_at: newExpiration.toISOString(),
          updated_at: updatedAt,
        })
        .eq("access_session_id", membership.id);

      if (entitlementError) {
        throw new Error(entitlementError.message);
      }
if (webhookEventId) {
  const { error: markProcessedError } =
    await admin
      .from("ccbill_webhook_events")
      .update({
        processed: true,
        processing: false,
        processed_at: updatedAt,
      })
      .eq("id", webhookEventId);

  if (markProcessedError) {
    throw new Error(markProcessedError.message);
  }
}
      console.log("CCBill renewal processed", {
        subscriptionId,
        transactionId,
        newExpiration: newExpiration.toISOString(),
      });

      return new Response("OK", { status: 200 });
    }
/*
 * SUBSCRIPTION CANCELLATION
 *
 * Cancellation stops future rebilling, but the customer keeps access
 * through the expiration date they already paid for.
 */
if (eventType === "Cancellation") {
  const updatedAt = new Date().toISOString();

  const { error: cancellationError } =
    await admin
      .from("memberships")
      .update({
        updated_at: updatedAt,
      })
      .eq("id", membership.id);

  if (cancellationError) {
    throw new Error(cancellationError.message);
  }

  if (webhookEventId) {
    const { error: markProcessedError } =
      await admin
        .from("ccbill_webhook_events")
        .update({
          processed: true,
          processing: false,
          processed_at: updatedAt,
        })
        .eq("id", webhookEventId);

    if (markProcessedError) {
      throw new Error(markProcessedError.message);
    }
  }

  console.log("CCBill cancellation processed", {
    subscriptionId,
    transactionId,
    expiresAt: membership.expires_at,
  });

  return new Response("OK", { status: 200 });
}
/*
 * SUBSCRIPTION EXPIRATION
 *
 * The paid subscription has expired, so protected-content access ends.
 */
if (eventType === "Expiration") {
  const updatedAt = new Date().toISOString();

  const { error: expirationError } =
    await admin
      .from("memberships")
      .update({
        status: "expired",
        updated_at: updatedAt,
      })
      .eq("id", membership.id);

  if (expirationError) {
    throw new Error(expirationError.message);
  }

  const { error: entitlementError } =
    await admin
      .from("entitlements")
      .update({
        status: "expired",
        updated_at: updatedAt,
      })
      .eq("access_session_id", membership.id);

  if (entitlementError) {
    throw new Error(entitlementError.message);
  }

  if (webhookEventId) {
    const { error: markProcessedError } =
      await admin
        .from("ccbill_webhook_events")
        .update({
          processed: true,
          processing: false,
          processed_at: updatedAt,
        })
        .eq("id", webhookEventId);

    if (markProcessedError) {
      throw new Error(markProcessedError.message);
    }
  }

  console.log("CCBill expiration processed", {
    subscriptionId,
    transactionId,
  });

  return new Response("OK", { status: 200 });
}
/*
 * RENEWAL FAILURE
 *
 * A failed rebill does not immediately remove already-paid access.
 * Keep the existing membership/entitlement expiration unchanged.
 */
if (eventType === "RenewalFailure") {
  const updatedAt = new Date().toISOString();

  if (webhookEventId) {
    const { error: markProcessedError } =
      await admin
        .from("ccbill_webhook_events")
        .update({
          processed: true,
          processing: false,
          processed_at: updatedAt,
        })
        .eq("id", webhookEventId);

    if (markProcessedError) {
      throw new Error(markProcessedError.message);
    }
  }

  console.log("CCBill renewal failure processed", {
    subscriptionId,
    transactionId,
    currentExpiration: membership.expires_at,
  });

  return new Response("OK", { status: 200 });
}
/*
 * REFUND / CHARGEBACK
 *
 * The payment supporting this membership has been reversed.
 * Revoke protected-content access immediately.
 */
if (
  eventType === "Refund" ||
  eventType === "Chargeback"
) {
  const updatedAt = new Date().toISOString();

  const reversedStatus =
    eventType === "Chargeback"
      ? "chargeback"
      : "refunded";

  const { error: membershipReversalError } =
    await admin
      .from("memberships")
      .update({
        status: reversedStatus,
        updated_at: updatedAt,
      })
      .eq("id", membership.id);

  if (membershipReversalError) {
    throw new Error(membershipReversalError.message);
  }

  const { error: entitlementReversalError } =
    await admin
      .from("entitlements")
      .update({
        status: "cancelled",
        updated_at: updatedAt,
      })
      .eq("access_session_id", membership.id);

  if (entitlementReversalError) {
    throw new Error(entitlementReversalError.message);
  }

  if (webhookEventId) {
    const { error: markProcessedError } =
      await admin
        .from("ccbill_webhook_events")
        .update({
          processed: true,
          processing: false,
          processed_at: updatedAt,
        })
        .eq("id", webhookEventId);

    if (markProcessedError) {
      throw new Error(markProcessedError.message);
    }
  }

  console.log("CCBill payment reversal processed", {
    eventType,
    subscriptionId,
    transactionId,
  });

  return new Response("OK", { status: 200 });
}
    /*
     * We will implement these next.
     * For now acknowledge them without modifying access.
     */
    if (webhookEventId) {
  const { error: releaseError } =
    await admin.rpc(
      "release_ccbill_webhook_event",
      {
        p_event_id: webhookEventId,
      },
    );

  if (releaseError) {
    throw new Error(
      `Could not release unhandled CCBill webhook: ${releaseError.message}`,
    );
  }
}
    console.log("CCBill webhook acknowledged", {
      eventType,
      subscriptionId,
      transactionId,
    });

    return new Response("OK", { status: 200 });
} catch (error) {
  console.error("CCBill webhook error:", error);

  if (webhookEventId) {
    try {
      const recoveryAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );

      const { error: releaseError } =
        await recoveryAdmin.rpc(
          "release_ccbill_webhook_event",
          {
            p_event_id: webhookEventId,
          },
        );

      if (releaseError) {
        console.error(
          "Could not release failed CCBill webhook claim:",
          releaseError.message,
        );
      } else {
        console.log(
          "Released failed CCBill webhook claim:",
          webhookEventId,
        );
      }
    } catch (releaseError) {
      console.error(
        "CCBill webhook claim recovery failed:",
        releaseError,
      );
    }
  }

  return new Response(
    error instanceof Error
      ? error.message
      : "Server error",
    { status: 500 },
  );
}
});

async function readPayload(
  req: Request,
): Promise<Record<string, unknown>> {
  const contentType =
    req.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    return await req.json() as Record<string, unknown>;
  }

  const raw = await req.text();
  const params = new URLSearchParams(raw);

  return Object.fromEntries(params.entries());
}

function getValue(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  return null;
}

function normalizeSubacc(value: string) {
  return String(Number(value));
}