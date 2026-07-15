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

function NewRoomForm({ parents, onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/chat-rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, memberIds: Array.from(selected) }),
    });
    const data = await res.json();

    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't create the room.");
      return;
    }
    onCreated(data.room);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-2xl bg-white p-4 shadow-card">
      <p className="text-sm font-semibold text-slate-900">New chat room</p>
      <input
        required
        placeholder="Room name (e.g. Field Trip Carpool)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Invite parents</p>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-2">
          {parents.map((p) => (
            <label key={p.id} className="flex items-center gap-2 py-1 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {p.full_name}
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create room"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ChatPage() {
  const { profile } = useProfile();
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [parents, setParents] = useState([]);
  const bottomRef = useRef(null);

  async function loadRooms(preferId) {
    const supabase = createClient();
    const { data } = await supabase
      .from("chat_rooms")
      .select("id, name, is_default")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    const list = data || [];
    setRooms(list);

    if (preferId && list.some((r) => r.id === preferId)) {
      setActiveRoomId(preferId);
    } else if (!list.some((r) => r.id === activeRoomId)) {
      setActiveRoomId(list.find((r) => r.is_default)?.id || list[0]?.id || null);
    }
  }

  useEffect(() => {
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile?.role === "admin") {
      createClient()
        .from("profiles")
        .select("id, full_name")
        .neq("id", profile.id)
        .order("full_name", { ascending: true })
        .then(({ data }) => setParents(data || []));
    }
  }, [profile?.role, profile?.id]);

  useEffect(() => {
    if (!activeRoomId) return;
    let active = true;
    const supabase = createClient();
    setLoading(true);

    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("id, body, created_at, user_id, profiles ( full_name, avatar_url, child_name )")
        .eq("room_id", activeRoomId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (active) {
        setMessages(data || []);
        setLoading(false);
      }
    }

    load();

    const channel = supabase
      .channel(`room-${activeRoomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${activeRoomId}` },
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
  }, [activeRoomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !profile || !activeRoomId) return;

    setSending(true);
    setDraft("");

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, roomId: activeRoomId }),
    });

    setSending(false);
    if (!res.ok) setDraft(body);
  }

  return (
    <AppShell title="Chat">
      {rooms.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveRoomId(r.id)}
              className={`flex-none rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                r.id === activeRoomId
                  ? "bg-brand-500 text-white"
                  : "bg-white text-slate-500 shadow-card"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {profile?.role === "admin" && !showNewRoom && (
        <button
          onClick={() => setShowNewRoom(true)}
          className="mb-4 text-xs font-medium text-brand-600"
        >
          + New room
        </button>
      )}

      {profile?.role === "admin" && showNewRoom && (
        <NewRoomForm
          parents={parents}
          onCancel={() => setShowNewRoom(false)}
          onCreated={(room) => {
            setShowNewRoom(false);
            loadRooms(room.id);
          }}
        />
      )}

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
