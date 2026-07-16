import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";

export const POST = withApiError(async (request) => {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const title = body?.title?.trim();
  let url = body?.url?.trim();

  if (!title || !url) {
    return NextResponse.json({ error: "Title and URL are required" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("links")
    .insert({ title, url, created_by: auth.profile.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data });
});
