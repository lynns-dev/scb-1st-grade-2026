import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";

// Returns the caller's own family invite code — deliberately not exposed
// through the general families read (see supabase/schema.sql), so a parent
// can only ever see their own code to share, not anyone else's.
export const GET = withApiError(async () => {
  const auth = await requireProfile();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("families")
    .select("invite_code")
    .eq("id", auth.profile.family_id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inviteCode: data.invite_code });
});
