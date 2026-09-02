import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders(),
    });
  }

  try {
    const body = await req.json();
    const checkoutId = String(body?.checkoutId ?? "");
    const password = String(body?.password ?? "");

    if (!checkoutId) {
      return json({ ok: false, message: "Missing checkout ID." }, 400);
    }

    if (password.length < 8) {
      return json(
        {
          ok: false,
          message: "Password must contain at least 8 characters.",
        },
        400,
      );
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

    const { data: checkout, error: checkoutError } =
      await admin
        .from("membership_checkouts")
        .select("*")
        .eq("id", checkoutId)
        .single();

    if (checkoutError || !checkout) {
      return json({ ok: false, message: "Checkout not found." }, 404);
    }

    if (checkout.status !== "paid") {
      return json(
        {
          ok: false,
          message: "CCBill has not confirmed this payment yet.",
        },
        409,
      );
    }

    const { data: membership, error: membershipError } =
      await admin
        .from("memberships")
        .select("*")
        .eq("checkout_id", checkoutId)
        .single();

    if (membershipError || !membership) {
      return json(
        {
          ok: false,
          message: "Paid membership record not found.",
        },
        404,
      );
    }

    const email =
      String(checkout.customer_email)
        .trim()
        .toLowerCase();

    let userId =
      membership.user_id ??
      checkout.user_id ??
      null;

    if (userId) {
      const { error } =
        await admin.auth.admin.updateUserById(
          userId,
          {
            password,
            email_confirm: true,
          },
        );

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            membership_plan: membership.plan,
          },
        });

      if (createError) {
        // If this email already has a Supabase account, locate it and
        // attach the paid membership instead of creating a duplicate.
        userId = await findUserIdByEmail(admin, email);

        if (!userId) {
          throw new Error(createError.message);
        }

        const { error: updateError } =
          await admin.auth.admin.updateUserById(
            userId,
            {
              password,
              email_confirm: true,
            },
          );

        if (updateError) {
          throw new Error(updateError.message);
        }
      } else {
        userId = created.user?.id ?? null;
      }
    }

    if (!userId) {
      throw new Error("Could not resolve member user ID.");
    }

    const now = new Date().toISOString();

    const { error: updateMembershipError } =
      await admin
        .from("memberships")
        .update({
          user_id: userId,
          updated_at: now,
        })
        .eq("id", membership.id);

    if (updateMembershipError) {
      throw new Error(updateMembershipError.message);
    }

    const { error: updateCheckoutError } =
      await admin
        .from("membership_checkouts")
        .update({
          user_id: userId,
          account_created_at: now,
          updated_at: now,
        })
        .eq("id", checkoutId);

    if (updateCheckoutError) {
      throw new Error(updateCheckoutError.message);
    }

    return json({
      ok: true,
      email,
      plan: membership.plan,
      expiresAt: membership.expires_at,
      accessSessionId: membership.id,
    });
  } catch (error) {
    console.error(error);

    return json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not create member account.",
      },
      500,
    );
  }
});

async function findUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } =
      await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });

    if (error) {
      throw new Error(error.message);
    }

    const user = data.users.find(
      (candidate) =>
        candidate.email?.toLowerCase() === email,
    );

    if (user) {
      return user.id;
    }

    if (data.users.length < 200) {
      break;
    }
  }

  return null;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}
