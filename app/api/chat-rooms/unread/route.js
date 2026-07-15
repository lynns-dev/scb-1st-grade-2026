import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";

// Returns { counts: { [roomId]: unreadCount } } for every room the caller
// belongs to. "Unread" = messages from other people newer than the caller's
// last_read_at for that room (or all of them, if they've never opened it).
export const GET = withApiError(async () => {
  const auth = await requireProfile();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createAdminClient();

  const [{ data: rooms }, { data: memberships }, { data: readState }] = await Promise.all([
    admin.from("chat_rooms").select("id, is_default"),
    admin.from("chat_room_members").select("room_id").eq("user_id", auth.profile.id),
    admin.from("chat_read_state").select("room_id, last_read_at").eq("user_id", auth.profile.id),
  ]);

  const memberRoomIds = new Set((memberships || []).map((m) => m.room_id));
  const myRooms = (rooms || []).filter((r) => r.is_default || memberRoomIds.has(r.id));
  const readMap = new Map((readState || []).map((r) => [r.room_id, r.last_read_at]));

  const counts = {};
  await Promise.all(
    myRooms.map(async (room) => {
      const since = readMap.get(room.id) || "1970-01-01T00:00:00Z";
      const { count } = await admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("room_id", room.id)
        .gt("created_at", since)
        .neq("user_id", auth.profile.id);
      counts[room.id] = count || 0;
    })
  );

  return NextResponse.json({ counts });
});
