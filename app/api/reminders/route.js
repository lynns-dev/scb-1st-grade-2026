import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";
import { notifyNewReminder } from "@/lib/notifyAllParents";

export const POST = withApiError(async (request) => {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  if (!body?.title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reminders")
    .insert({
      title: body.title,
      body: body.body || null,
      week_of: body.weekOf || new Date().toISOString().slice(0, 10),
      created_by: auth.profile.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notifyNewReminder(admin, { title: data.title, excludeUserId: auth.profile.id });

  return NextResponse.json({ reminder: data });
});
