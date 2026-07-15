"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import AppShell from "@/components/AppShell";

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

export default function ChatListPage() {
  const { profile } = useProfile();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [parents, setParents] = useState([]);

  async function loadRooms() {
    const supabase = createClient();
    const { data } = await supabase
      .from("chat_rooms")
      .select("id, name, is_default")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    setRooms(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadRooms();
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

  return (
    <AppShell title="Chat">
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
          onCreated={() => {
            setShowNewRoom(false);
            loadRooms();
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {rooms.map((r) => (
            <li key={r.id}>
              <Link
                href={`/chat/${r.id}`}
                className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-pink-100 text-lg text-pink-600">
                    💬
                  </span>
                  <span className="font-semibold text-slate-900">
                    {r.is_default ? "Main Chat" : r.name}
                  </span>
                </div>
                <span className="text-slate-300">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
