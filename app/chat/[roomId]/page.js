"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import Avatar from "@/components/Avatar";
import AppShell from "@/components/AppShell";

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChatRoomPage({ params }) {
  const roomId = params.roomId;
  const { profile } = useProfile();
  const [roomName, setRoomName] = useState("Chat");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    setLoading(true);

    async function load() {
      const [{ data: room }, { data: msgs }] = await Promise.all([
        supabase.from("chat_rooms").select("name, is_default").eq("id", roomId).single(),
        supabase
          .from("messages")
          .select("id, body, created_at, user_id, profiles ( full_name, avatar_url, child_name )")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true })
          .limit(200),
      ]);

      if (active) {
        setRoomName(room?.is_default ? "Main Chat" : room?.name || "Chat");
        setMessages(msgs || []);
        setLoading(false);
      }
    }

    load();

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const { data } = await supabase
            .from("profiles")
            .select("full_name, avatar_url, child_name")
            .eq("id", payload.new.user_id)
            .single();

          setMessages((prev) => [...prev, { ...payload.new, profiles: data || null }]);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !profile) return;

    setSending(true);
    setDraft("");

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, roomId }),
    });

    setSending(false);
    if (!res.ok) setDraft(body);
  }

  return (
    <AppShell title={roomName} backHref="/chat">
      <div className="flex flex-col pb-20">
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
              No messages yet — say hi!
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.user_id === profile?.id;
              return (
                <div key={m.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                  <Avatar src={m.profiles?.avatar_url} name={m.profiles?.full_name} size={28} />
                  <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <span className="mb-0.5 px-1 text-[11px] text-slate-400">
                      {mine ? "You" : m.profiles?.full_name || "A parent"}
                      {m.profiles?.child_name ? ` (${m.profiles.child_name}'s parent)` : ""} ·{" "}
                      {formatTime(m.created_at)}
                    </span>
                    <div
                      className={`max-w-[75vw] rounded-2xl px-4 py-2 text-sm shadow-card ${
                        mine ? "bg-brand-500 text-white" : "bg-white text-slate-900"
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={handleSend}
        className="fixed inset-x-0 bottom-16 z-10 mx-auto flex max-w-sm gap-2 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the room…"
          className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-card disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </AppShell>
  );
}
