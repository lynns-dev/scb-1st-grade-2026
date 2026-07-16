import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";

export const PATCH = withApiError(async (request, { params }) => {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const updates = {};
  if (typeof body.title === "string") {
    if (!body.title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    updates.title = body.title.trim();
  }
  if (typeof body.body === "string") updates.body = body.body.trim() || null;
  if ("attachmentUrl" in body) {
    updates.attachment_url = body.attachmentUrl || null;
    updates.attachment_name = body.attachmentName || null;
  }
  if (body.publishAt) {
    const publishAt = new Date(body.publishAt);
    if (Number.isNaN(publishAt.getTime())) {
      return NextResponse.json({ error: "Invalid schedule date" }, { status: 400 });
    }
    updates.publish_at = publishAt.toISOString();
    updates.week_of = body.weekOf || publishAt.toISOString().slice(0, 10);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reminders")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminder: data });
});

export const DELETE = withApiError(async (request, { params }) => {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("reminders").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
