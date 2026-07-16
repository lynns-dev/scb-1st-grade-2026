import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";
import { sendPushToUsers } from "@/lib/pushNotify";

// Chat sends go through here (rather than a direct client-side insert) so we
// have a server-side hook to fan out push notifications to the other room
// members. Room access is re-checked here the same way the RLS policy on
// `messages` would, since the service role client bypasses RLS entirely.
export const POST = withApiError(async (request) => {
  const auth = await requireProfile();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const text = body?.body?.trim() || "";
  const imageUrl = body?.imageUrl || null;
  const roomId = body?.roomId;

  if ((!text && !imageUrl) || !roomId) {
    return NextResponse.json(
      { error: "A message needs text or a photo, and a room" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: room } = await admin
    .from("chat_rooms")
    .select("id, name, is_default")
    .eq("id", roomId)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  let memberIds = [];
  if (room.is_default) {
    const { data: allProfiles } = await admin.from("profiles").select("id");
    memberIds = (allProfiles || []).map((p) => p.id);
  } else {
    const { data: isMember } = await admin
      .from("chat_room_members")
      .select("user_id")
      .eq("room_id", roomId)
      .eq("user_id", auth.profile.id)
      .maybeSingle();

    if (!isMember) {
      return NextResponse.json({ error: "You're not in this room" }, { status: 403 });
    }

    const { data: members } = await admin
      .from("chat_room_members")
      .select("user_id")
      .eq("room_id", roomId);
    memberIds = (members || []).map((m) => m.user_id);
  }

  const { data: message, error } = await admin
    .from("messages")
    .insert({ body: text || null, image_url: imageUrl, user_id: auth.profile.id, room_id: roomId })
    .select("id, body, image_url, created_at, user_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Awaited (not fire-and-forget) — a serverless function can be frozen the
  // instant it returns a response, which would silently drop a detached
  // push send.
  try {
    await sendPushToUsers(
      memberIds,
      {
        title: room.is_default ? auth.profile.full_name : `${room.name}: ${auth.profile.full_name}`,
        body: text
          ? text.length > 120
            ? `${text.slice(0, 117)}...`
            : text
          : "📷 Sent a photo",
        url: "/chat",
      },
      { excludeUserId: auth.profile.id }
    );
  } catch {
    // Push is a best-effort enhancement — the message itself already saved.
  }

  return NextResponse.json({ message });
});
