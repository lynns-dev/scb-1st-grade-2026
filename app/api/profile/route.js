import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";

// Any signed-in parent can update their own contact info/avatar (on their
// profile row) and their child's name/photo (on the shared family row, so
// it stays in sync for a co-parent linked to the same family). Routing
// through the service role here (with an explicit whitelist) instead of a
// client-side RLS UPDATE policy means a parent can never slip `role` or
// someone else's `id`/`family_id` into the payload.
export const PATCH = withApiError(async (request) => {
  const auth = await requireProfile();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const profileUpdates = {};
  if (typeof body.phone === "string") profileUpdates.phone = body.phone.trim() || null;
  if (typeof body.avatarUrl === "string") profileUpdates.avatar_url = body.avatarUrl.trim() || null;

  const familyUpdates = {};
  if (typeof body.childName === "string") familyUpdates.child_name = body.childName.trim() || null;
  if (typeof body.childAvatarUrl === "string") {
    familyUpdates.child_avatar_url = body.childAvatarUrl.trim() || null;
  }

  if (Object.keys(profileUpdates).length === 0 && Object.keys(familyUpdates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await admin.from("profiles").update(profileUpdates).eq("id", auth.profile.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Object.keys(familyUpdates).length > 0) {
    const { error } = await admin
      .from("families")
      .update(familyUpdates)
      .eq("id", auth.profile.family_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: profile, error: fetchError } = await admin
    .from("profiles")
    .select(
      "id, email, full_name, phone, avatar_url, role, family_id, families ( child_name, child_avatar_url )"
    )
    .eq("id", auth.profile.id)
    .single();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  return NextResponse.json({
    profile: {
      ...profile,
      child_name: profile.families?.child_name || null,
      child_avatar_url: profile.families?.child_avatar_url || null,
    },
  });
});
