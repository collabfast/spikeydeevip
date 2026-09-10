import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) {
      console.error("Missing required environment variable.");
      return json({ ok: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ ok: false, error: "UNAUTHORIZED" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: isAdmin, error: adminError } =
      await userClient.rpc("current_user_is_admin");

    if (adminError || isAdmin !== true) {
      console.error("Admin check failed:", adminError);
      return json({ ok: false, error: "FORBIDDEN" }, 403);
    }

    const body = await req.json().catch(() => null);
    const applicationId =
      typeof body?.applicationId === "string"
        ? body.applicationId.trim()
        : "";

    if (!applicationId) {
      return json({ ok: false, error: "APPLICATION_ID_REQUIRED" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: application, error: applicationError } = await admin
      .from("model_applications")
      .select(
        "id, stage_name, email, status, accepted_email_sent_at, accepted_email_message_id"
      )
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationError) {
      console.error("Application lookup failed:", applicationError);
      return json({ ok: false, error: "APPLICATION_LOOKUP_FAILED" }, 500);
    }

    if (!application) {
      return json({ ok: false, error: "APPLICATION_NOT_FOUND" }, 404);
    }

    if (application.status !== "accepted") {
      return json({ ok: false, error: "APPLICATION_NOT_ACCEPTED" }, 409);
    }

    if (application.accepted_email_sent_at) {
      return json({
        ok: true,
        alreadySent: true,
        sentAt: application.accepted_email_sent_at,
        messageId: application.accepted_email_message_id ?? null,
      });
    }

    const applicantName =
      String(application.stage_name || "").trim() || "there";
    const applicantEmail = String(application.email || "").trim();

    if (!applicantEmail) {
      return json({ ok: false, error: "APPLICATION_EMAIL_MISSING" }, 409);
    }

    const subject = "Your SpikeyDeeVIP model application has been accepted";

    const html = `
      <div style="margin:0;padding:32px 16px;background:#080808;font-family:Arial,Helvetica,sans-serif;color:#f5f5f5;">
        <div style="max-width:620px;margin:0 auto;background:#111;border:1px solid #2b2b2b;border-radius:16px;overflow:hidden;">
          <div style="padding:30px 32px;border-bottom:1px solid #262626;">
            <div style="font-size:12px;font-weight:800;letter-spacing:2px;color:#e7bb45;">SPIKEYDEE VIP CASTING</div>
            <h1 style="margin:14px 0 0;font-size:30px;line-height:1.15;color:#ffffff;">You’ve been accepted.</h1>
          </div>

          <div style="padding:30px 32px;color:#cfcfcf;font-size:16px;line-height:1.7;">
            <p style="margin-top:0;">Hi ${escapeHtml(applicantName)},</p>

            <p>
              We reviewed your SpikeyDeeVIP model application and would like to move forward with you.
            </p>

            <p>
              A member of the studio team will contact you separately with next steps, scheduling, production details, and any required identity, age, consent, or compliance documentation before filming.
            </p>

            <div style="margin:26px 0;padding:18px 20px;border:1px solid rgba(231,187,69,.28);border-radius:12px;background:#16140d;">
              <strong style="color:#e7bb45;">Important:</strong>
              <span style="color:#d8d8d8;">
                Do not email sensitive identification documents in reply to this message unless the studio provides an approved secure method.
              </span>
            </div>

            <p style="margin-bottom:0;">
              — SpikeyDeeVIP Casting
            </p>
          </div>
        </div>
      </div>
    `;

    const textBody = [
      `Hi ${applicantName},`,
      "",
      "We reviewed your SpikeyDeeVIP model application and would like to move forward with you.",
      "",
      "A member of the studio team will contact you separately with next steps, scheduling, production details, and any required identity, age, consent, or compliance documentation before filming.",
      "",
      "Important: Do not email sensitive identification documents in reply to this message unless the studio provides an approved secure method.",
      "",
      "— SpikeyDeeVIP Casting",
    ].join("\n");

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SpikeyDeeVIP Casting <no-reply@auth.spikeydeevip.com>",
        to: [applicantEmail],
        subject,
        html,
        text: textBody,
      }),
    });

    const resendBody = await resendResponse.json().catch(() => ({}));

    if (!resendResponse.ok) {
      console.error("Resend acceptance email failed:", resendBody);
      return json(
        {
          ok: false,
          error: "EMAIL_SEND_FAILED",
        },
        502
      );
    }

    const messageId =
      typeof resendBody?.id === "string" ? resendBody.id : null;
    const sentAt = new Date().toISOString();

    const { error: markSentError } = await admin
      .from("model_applications")
      .update({
        accepted_email_sent_at: sentAt,
        accepted_email_message_id: messageId,
        updated_at: sentAt,
      })
      .eq("id", application.id)
      .is("accepted_email_sent_at", null);

    if (markSentError) {
      console.error(
        "Email sent but acceptance tracking update failed:",
        markSentError
      );

      return json({
        ok: true,
        alreadySent: false,
        trackingWarning: true,
        messageId,
      });
    }

    return json({
      ok: true,
      alreadySent: false,
      messageId,
      sentAt,
    });
  } catch (error) {
    console.error("Unexpected acceptance email error:", error);
    return json({ ok: false, error: "UNEXPECTED_ERROR" }, 500);
  }
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
