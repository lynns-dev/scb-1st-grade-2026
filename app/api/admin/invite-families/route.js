import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";
import { buildInviteEmail } from "@/lib/inviteEmail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Invites one or more families at once. Each family gets its own new
// `families` row up front (so the invite already has a family_id/
// invite_code to hand out) — every email in that group gets a signup link
// pre-filled with both the classroom invite code and the family code, so
// whichever of them signs up first joins that same family, and anyone else
// in the group who signs up afterward links to it too instead of creating
// a duplicate (see app/api/auth/signup).
export const POST = withApiError(async (request) => {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.CLASSROOM_PARENT_INVITE_CODE) {
    return NextResponse.json(
      { error: "CLASSROOM_PARENT_INVITE_CODE isn't set" },
      { status: 500 }
    );
  }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json(
      { error: "Email isn't configured yet (RESEND_API_KEY / RESEND_FROM_EMAIL)" },
      { status: 503 }
    );
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL isn't set" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const families = Array.isArray(body?.families) ? body.families : [];

  const cleanedFamilies = families
    .map((f) => {
      const emails = Array.isArray(f?.emails)
        ? [...new Set(f.emails.map((e) => e?.trim().toLowerCase()).filter(Boolean))]
        : [];
      return { emails };
    })
    .filter((f) => f.emails.length > 0);

  if (cleanedFamilies.length === 0) {
    return NextResponse.json({ error: "Add at least one family with an email" }, { status: 400 });
  }

  const invalid = cleanedFamilies.flatMap((f) => f.emails).filter((e) => !EMAIL_RE.test(e));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `These don't look like valid emails: ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const messages = [];

  for (const family of cleanedFamilies) {
    const { data: familyRow, error: familyError } = await admin
      .from("families")
      .insert({})
      .select("invite_code")
      .single();

    if (familyError) {
      return NextResponse.json({ error: familyError.message }, { status: 500 });
    }

    for (const email of family.emails) {
      const signupUrl = new URL("/signup", appUrl);
      signupUrl.searchParams.set("inviteCode", process.env.CLASSROOM_PARENT_INVITE_CODE);
      signupUrl.searchParams.set("familyCode", familyRow.invite_code);
      signupUrl.searchParams.set("email", email);

      const { html, text } = buildInviteEmail({ signupUrl: signupUrl.toString() });
      messages.push({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: "You're invited to The Village",
        html,
        text,
      });
    }
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const { error } = await resend.batch.send(batch);
    if (!error) sent += batch.length;
  }

  return NextResponse.json({
    ok: true,
    families: cleanedFamilies.length,
    emailsSent: sent,
    emailsTotal: messages.length,
  });
});
