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
  if (typeof body.description === "string") updates.description = body.description.trim() || null;
  if (typeof body.location === "string") updates.location = body.location.trim() || null;
  if (body.startAt) {
    const startAt = new Date(body.startAt);
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json({ error: "Invalid start date/time" }, { status: 400 });
    }
    updates.start_at = startAt.toISOString();
  }
  if (typeof body.endAt === "string") {
    if (body.endAt) {
      const endAt = new Date(body.endAt);
      if (Number.isNaN(endAt.getTime())) {
        return NextResponse.json({ error: "Invalid end date/time" }, { status: 400 });
      }
      updates.end_at = endAt.toISOString();
    } else {
      updates.end_at = null;
    }
  }
  if (typeof body.allDay === "boolean") updates.all_day = body.allDay;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("events")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
});

export const DELETE = withApiError(async (request, { params }) => {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("events").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
