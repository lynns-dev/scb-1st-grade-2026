import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";

// Any signed-in parent can update their own contact info and avatar — but
// only these specific columns. Routing through the service role here (with
// an explicit whitelist) instead of a client-side RLS UPDATE policy means a
// parent can never slip `role` or someone else's `id` into the payload.
export const PATCH = withApiError(async (request) => {
  const auth = await requireProfile();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const updates = {};
  if (typeof body.phone === "string") updates.phone = body.phone.trim() || null;
  if (typeof body.childName === "string") updates.child_name = body.childName.trim() || null;
  if (typeof body.avatarUrl === "string") updates.avatar_url = body.avatarUrl.trim() || null;
  if (typeof body.childAvatarUrl === "string") updates.child_avatar_url = body.childAvatarUrl.trim() || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", auth.profile.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
});
