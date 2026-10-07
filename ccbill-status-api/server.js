import http from "node:http";

const PORT = Number(process.env.PORT || 3000);

const CCBILL_URL =
  "https://datalink.ccbill.com/utils/subscriptionManagement.cgi";

const CLIENT_ACCNUM = "954348";
const CLIENT_SUBACC = "0006";

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });

  res.end(JSON.stringify(body, null, 2));
}

function getXmlValue(xml, tag) {
  const match = xml.match(
    new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i")
  );

  return match ? match[1].trim() : null;
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(
      req.url || "/",
      `http://${req.headers.host || "localhost"}`
    );

    // Simple health check.
    if (requestUrl.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "spikeydeevip-ccbill-status-api",
      });
    }

    // READ ONLY CCBill subscription lookup.
    if (
      req.method === "GET" &&
      requestUrl.pathname === "/ccbill/subscription-status"
    ) {
      const subscriptionId =
        requestUrl.searchParams.get("subscriptionId")?.trim();

      if (!subscriptionId) {
        return sendJson(res, 400, {
          ok: false,
          message: "Missing subscriptionId.",
        });
      }

      if (!/^\d+$/.test(subscriptionId)) {
        return sendJson(res, 400, {
          ok: false,
          message: "Invalid subscriptionId.",
        });
      }

      const username = process.env.CCBILL_DATALINK_USERNAME;
      const password = process.env.CCBILL_DATALINK_PASSWORD;

      if (!username || !password) {
        return sendJson(res, 500, {
          ok: false,
          message: "CCBill Data Link credentials are not configured.",
        });
      }

      const ccbillUrl = new URL(CCBILL_URL);

      ccbillUrl.searchParams.set("clientAccnum", CLIENT_ACCNUM);
      ccbillUrl.searchParams.set("clientSubacc", CLIENT_SUBACC);
      ccbillUrl.searchParams.set("username", username);
      ccbillUrl.searchParams.set("password", password);

      // IMPORTANT: this is READ ONLY.
      ccbillUrl.searchParams.set(
        "action",
        "viewSubscriptionStatus"
      );

      ccbillUrl.searchParams.set(
        "subscriptionId",
        subscriptionId
      );

      ccbillUrl.searchParams.set("returnXML", "1");

      const ccbillResponse = await fetch(ccbillUrl, {
        method: "GET",
        headers: {
          Accept: "application/xml,text/xml,text/plain",
        },
      });

      const xml = await ccbillResponse.text();

      if (!ccbillResponse.ok) {
        return sendJson(res, 502, {
          ok: false,
          message: "CCBill request failed.",
          httpStatus: ccbillResponse.status,
        });
      }

      const subscriptionStatus =
        getXmlValue(xml, "subscriptionStatus");

      // CCBill sometimes returns an error/result code rather than
      // the normal subscription fields.
      if (subscriptionStatus === null) {
        return sendJson(res, 502, {
          ok: false,
          message: "CCBill did not return subscription status.",
          result: getXmlValue(xml, "results"),
        });
      }

      const statusNumber = Number(subscriptionStatus);

      let statusMeaning = "unknown";

      if (statusNumber === 0) {
        statusMeaning = "inactive";
      } else if (statusNumber === 1) {
        statusMeaning = "active_cancelled";
      } else if (statusNumber === 2) {
        statusMeaning = "active";
      }

      return sendJson(res, 200, {
        ok: true,
        subscriptionId,

        ccbill: {
          subscriptionStatus: statusNumber,
          statusMeaning,

          recurringSubscription:
            getXmlValue(xml, "recurringSubscription"),

          timesRebilled:
            Number(getXmlValue(xml, "timesRebilled") || 0),

          signupDate:
            getXmlValue(xml, "signupDate"),

          expirationDate:
            getXmlValue(xml, "expirationDate"),

          cancelDate:
            getXmlValue(xml, "cancelDate"),

          refundsIssued:
            Number(getXmlValue(xml, "refundsIssued") || 0),

          voidsIssued:
            Number(getXmlValue(xml, "voidsIssued") || 0),

          chargebacksIssued:
            Number(
              getXmlValue(xml, "chargebacksIssued") || 0
            ),
        },
      });
    }
// ---------------------------------------------------------
// READ-ONLY AUDIT: ALL TWO-DAY PASS SUBSCRIPTIONS
// ---------------------------------------------------------
if (
  req.method === "GET" &&
  requestUrl.pathname === "/ccbill/audit-two-day-passes"
) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const username = process.env.CCBILL_DATALINK_USERNAME;
  const password = process.env.CCBILL_DATALINK_PASSWORD;

  if (!supabaseUrl || !supabaseKey) {
    return sendJson(res, 500, {
      ok: false,
      message: "Supabase server credentials are not configured.",
    });
  }

  if (!username || !password) {
    return sendJson(res, 500, {
      ok: false,
      message: "CCBill Data Link credentials are not configured.",
    });
  }

  // Read memberships from Supabase.
  const membershipsUrl = new URL(
    "/rest/v1/memberships",
    supabaseUrl
  );

  membershipsUrl.searchParams.set(
    "select",
    "id,customer_email,ccbill_subscription_id,ccbill_transaction_id,plan,status,starts_at,expires_at,updated_at"
  );

  membershipsUrl.searchParams.set(
    "plan",
    "eq.two_day_pass"
  );

  membershipsUrl.searchParams.set(
    "ccbill_subscription_id",
    "not.is.null"
  );

  membershipsUrl.searchParams.set(
    "order",
    "starts_at.asc"
  );

  const membershipsResponse = await fetch(membershipsUrl, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  if (!membershipsResponse.ok) {
    const errorText = await membershipsResponse.text();

    console.error(
      "Supabase memberships audit read failed:",
      membershipsResponse.status,
      errorText
    );

    return sendJson(res, 502, {
      ok: false,
      message: "Could not read memberships from Supabase.",
      httpStatus: membershipsResponse.status,
    });
  }

  const allMemberships = await membershipsResponse.json();

const memberships = allMemberships;

  const auditResults = [];

  for (const membership of memberships) {
    const subscriptionId =
      membership.ccbill_subscription_id;

    try {
      const ccbillUrl = new URL(CCBILL_URL);

      ccbillUrl.searchParams.set(
        "clientAccnum",
        CLIENT_ACCNUM
      );

      ccbillUrl.searchParams.set(
        "clientSubacc",
        CLIENT_SUBACC
      );

      ccbillUrl.searchParams.set(
        "username",
        username
      );

      ccbillUrl.searchParams.set(
        "password",
        password
      );

      ccbillUrl.searchParams.set(
        "action",
        "viewSubscriptionStatus"
      );

      ccbillUrl.searchParams.set(
        "subscriptionId",
        subscriptionId
      );

      ccbillUrl.searchParams.set(
        "returnXML",
        "1"
      );
// Pace CCBill Data Link requests.
// Sending subscription-status lookups back-to-back can cause
// subsequent lookups to fail even though the credentials are valid.
await new Promise((resolve) => setTimeout(resolve, 1500));
      const ccbillResponse = await fetch(ccbillUrl, {
        method: "GET",
        headers: {
          Accept: "application/xml,text/xml,text/plain",
        },
      });

      const xml = await ccbillResponse.text();

      if (!ccbillResponse.ok) {
        auditResults.push({
          customer_email: membership.customer_email,
          subscription_id: subscriptionId,
          supabase: {
            status: membership.status,
            starts_at: membership.starts_at,
            expires_at: membership.expires_at,
          },
          ccbill: null,
          audit: {
            out_of_sync: null,
            reason: `CCBill HTTP ${ccbillResponse.status}`,
          },
        });

        continue;
      }

      const rawStatus =
        getXmlValue(xml, "subscriptionStatus");

      if (rawStatus === null) {
        auditResults.push({
          customer_email: membership.customer_email,
          subscription_id: subscriptionId,
          supabase: {
            status: membership.status,
            starts_at: membership.starts_at,
            expires_at: membership.expires_at,
          },
          ccbill: null,
          audit: {
            out_of_sync: null,
            reason: "CCBill status unavailable",
          },
        });

        continue;
      }

      const statusNumber = Number(rawStatus);

      let statusMeaning = "unknown";

      if (statusNumber === 0) {
        statusMeaning = "inactive";
      } else if (statusNumber === 1) {
        statusMeaning = "active_cancelled";
      } else if (statusNumber === 2) {
        statusMeaning = "active";
      }

      const recurringRaw =
        getXmlValue(xml, "recurringSubscription");

      const recurring =
        recurringRaw === "1";

      const timesRebilled =
        Number(
          getXmlValue(xml, "timesRebilled") || 0
        );

      const now = Date.now();

      const supabaseExpiration =
        membership.expires_at
          ? new Date(membership.expires_at).getTime()
          : null;

      const supabaseExpired =
        supabaseExpiration !== null &&
        supabaseExpiration < now;

      let outOfSync = false;
      let reason = "OK";

// CCBill is active AND has actually rebilled, but our
// Supabase access has already expired.
//
// IMPORTANT:
// subscriptionStatus === 2 alone does NOT prove a renewal.
// A newly-created recurring subscription can remain active
// while timesRebilled is still 0.
if (
  statusNumber === 2 &&
  timesRebilled > 0 &&
  supabaseExpired
) {
  outOfSync = true;
  reason =
    "CCBill successfully rebilled but Supabase access has expired";
}

      // Supabase says expired while CCBill says active.
// CCBill is inactive/cancelled.
//
// Do NOT treat cancellation by itself as an immediate access failure.
// If CCBill supplies a future expirationDate, the customer remains
// entitled through that paid-through date.
else if (statusNumber === 0) {
  const rawExpirationDate =
  getXmlValue(xml, "expirationDate");

  let ccbillExpiration = null;

  if (
    typeof rawExpirationDate === "string" &&
    /^\d{14}$/.test(rawExpirationDate)
  ) {
    const year = Number(rawExpirationDate.slice(0, 4));
    const month = Number(rawExpirationDate.slice(4, 6)) - 1;
    const day = Number(rawExpirationDate.slice(6, 8));
    const hour = Number(rawExpirationDate.slice(8, 10));
    const minute = Number(rawExpirationDate.slice(10, 12));
    const second = Number(rawExpirationDate.slice(12, 14));

    ccbillExpiration = Date.UTC(
      year,
      month,
      day,
      hour,
      minute,
      second
    );
  }

  const ccbillAccessExpired =
    ccbillExpiration !== null &&
    ccbillExpiration <= now;

  if (
    ccbillAccessExpired &&
    membership.status === "active" &&
    !supabaseExpired
  ) {
    outOfSync = true;
    reason =
      "CCBill paid-through period expired but Supabase still grants active access";
  }
}

      // CCBill says inactive but Supabase still grants access.
      else if (
        statusNumber === 0 &&
        membership.status === "active" &&
        !supabaseExpired
      ) {
        outOfSync = true;
        reason =
          "CCBill inactive but Supabase still grants active access";
      }

      auditResults.push({
        customer_email: membership.customer_email,
        subscription_id: subscriptionId,

        supabase: {
          membership_id: membership.id,
          status: membership.status,
          starts_at: membership.starts_at,
          expires_at: membership.expires_at,
          transaction_id:
            membership.ccbill_transaction_id,
        },

        ccbill: {
          subscriptionStatus: statusNumber,
          statusMeaning,
          recurringSubscription: recurring,
          timesRebilled,

          signupDate:
            getXmlValue(xml, "signupDate"),

          expirationDate:
            getXmlValue(xml, "expirationDate"),

          cancelDate:
            getXmlValue(xml, "cancelDate"),

          refundsIssued:
            Number(
              getXmlValue(xml, "refundsIssued") || 0
            ),

          voidsIssued:
            Number(
              getXmlValue(xml, "voidsIssued") || 0
            ),

          chargebacksIssued:
            Number(
              getXmlValue(xml, "chargebacksIssued") || 0
            ),
        },

        audit: {
          out_of_sync: outOfSync,
          reason,
        },
      });
    } catch (error) {
      console.error(
        "Audit failed for subscription:",
        subscriptionId,
        error
      );

      auditResults.push({
        customer_email: membership.customer_email,
        subscription_id: subscriptionId,
        ccbill: null,
        audit: {
          out_of_sync: null,
          reason: "CCBill lookup failed",
        },
      });
    }
  }

  const mismatches = auditResults.filter(
    (row) => row.audit.out_of_sync === true
  );

  const errors = auditResults.filter(
    (row) => row.audit.out_of_sync === null
  );

  return sendJson(res, 200, {
    ok: true,
    readOnly: true,

    summary: {
      subscriptions_checked: auditResults.length,
      in_sync:
        auditResults.length -
        mismatches.length -
        errors.length,
      out_of_sync: mismatches.length,
      lookup_errors: errors.length,
    },

    mismatches,
    all: auditResults,
  });
}
    return sendJson(res, 404, {
      ok: false,
      message: "Not found.",
    });
  } catch (error) {
    console.error("CCBill status API error:", error);

    return sendJson(res, 500, {
      ok: false,
      message: "Internal server error.",
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`CCBill status API listening on port ${PORT}`);
});