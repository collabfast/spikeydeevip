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