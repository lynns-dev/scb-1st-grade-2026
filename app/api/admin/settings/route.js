import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";

export const PATCH = withApiError(async (request) => {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  let wishlistUrl = body?.wishlistUrl?.trim() || null;
  if (wishlistUrl && !/^https?:\/\//i.test(wishlistUrl)) {
    wishlistUrl = `https://${wishlistUrl}`;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("classroom_settings")
    .update({ wishlist_url: wishlistUrl, updated_at: new Date().toISOString() })
    .eq("id", true)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
});
