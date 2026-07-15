import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";

// Admin-only: create an invite-only chat room and add specific parents to
// it. The creating admin is always added too, so she can post in rooms she
// makes. Everyone still has the one default "Main Chat" (see schema.sql) —
// this is strictly for extra, scoped rooms (e.g. a single grade's carpool
// group).
export const POST = withApiError(async (request) => {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const memberIds = Array.isArray(body?.memberIds) ? body.memberIds : [];

  if (!name) {
    return NextResponse.json({ error: "Room name is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: room, error: roomError } = await admin
    .from("chat_rooms")
    .insert({ name, created_by: auth.profile.id, is_default: false })
    .select()
    .single();

  if (roomError) return NextResponse.json({ error: roomError.message }, { status: 500 });

  const memberRows = Array.from(new Set([auth.profile.id, ...memberIds])).map((userId) => ({
    room_id: room.id,
    user_id: userId,
  }));

  const { error: memberError } = await admin.from("chat_room_members").insert(memberRows);

  if (memberError) {
    await admin.from("chat_rooms").delete().eq("id", room.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ room });
});
