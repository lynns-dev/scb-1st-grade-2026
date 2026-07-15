import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";

// Anyone can call this route, but it only ever creates an account when the
// supplied invite code matches one of the two codes the room admin shares
// with classroom families (a plain parent code, and a separate admin code
// for the room parent). No public signup without a valid code.
export const POST = withApiError(async (request) => {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, password, fullName, childName, inviteCode } = body;

  if (!email || !password || !fullName || !inviteCode) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  let role;
  if (inviteCode === process.env.CLASSROOM_ADMIN_INVITE_CODE) {
    role = "admin";
  } else if (inviteCode === process.env.CLASSROOM_PARENT_INVITE_CODE) {
    role = "parent";
  } else {
    return NextResponse.json({ error: "Invite code not recognized" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    const message = createError.message.includes("already registered")
      ? "An account with that email already exists — try logging in instead."
      : createError.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    email,
    full_name: fullName,
    child_name: childName || null,
    role,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, role });
});
