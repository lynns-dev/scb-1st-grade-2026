"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { uploadChatImage } from "@/lib/uploadFile";
import Avatar from "@/components/Avatar";
import AppShell from "@/components/AppShell";
import Skeleton from "@/components/Skeleton";

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageImage({ src }) {
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="mb-1 block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Shared photo" className="max-h-64 w-full rounded-xl object-cover" />
    </a>
  );
}

export default function ChatRoomPage({ params }) {
  const roomId = params.roomId;
  const { profile } = useProfile();
  const [roomName, setRoomName] = useState("Chat");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    const supabase = createClient();
    setLoading(true);

    function markRead() {
      supabase
        .from("chat_read_state")
        .upsert(
          { user_id: profile.id, room_id: roomId, last_read_at: new Date().toISOString() },
          { onConflict: "user_id,room_id" }
        )
        .then(() => {});
    }

    async function load() {
      const [{ data: room }, { data: msgs }] = await Promise.all([
        supabase.from("chat_rooms").select("name, is_default").eq("id", roomId).single(),
        supabase
          .from("messages")
          .select("id, body, image_url, created_at, user_id, profiles ( full_name, avatar_url, child_name )")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true })
          .limit(200),
      ]);

      if (active) {
        setRoomName(room?.is_default ? "Main Chat" : room?.name || "Chat");
        setMessages(msgs || []);
        setLoading(false);
        markRead();
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
          if (payload.new.user_id !== profile.id) markRead();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, profile?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleImagePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if ((!body && !imageFile) || !profile) return;

    setSending(true);
    setError("");

    let imageUrl = null;
    if (imageFile) {
      try {
        const supabase = createClient();
        imageUrl = await uploadChatImage(supabase, profile.id, imageFile);
      } catch (uploadError) {
        setSending(false);
        setError(uploadError.message || "Couldn't upload that photo.");
        return;
      }
    }

    setDraft("");
    clearImage();

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, imageUrl, roomId }),
    });

    setSending(false);
    if (!res.ok) {
      setDraft(body);
      setError("Couldn't send that message.");
    }
  }

  return (
    <AppShell title={roomName} backHref="/chat">
      <div className="flex flex-col pb-32">
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="ml-auto h-10 w-1/2" />
              <Skeleton className="h-10 w-3/5" />
            </div>
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
                      {m.image_url && <MessageImage src={m.image_url} />}
                      {m.body}
                    </div>
                    {m.image_url && (
                      <a
                        href={m.image_url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 px-1 text-[11px] font-medium text-brand-600"
                      >
                        ⬇ Save photo
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-lg border-t border-slate-200 bg-white/95 backdrop-blur">
        {imagePreview && (
          <div className="flex items-center gap-2 px-3 pt-2">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Attachment preview" className="h-14 w-14 rounded-lg object-cover" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-xs text-white"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          </div>
        )}
        {error && <p className="px-3 pt-2 text-xs text-red-600">{error}</p>}
        <form onSubmit={handleSend} className="flex gap-2 px-3 py-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-none rounded-full border border-slate-200 bg-white px-3 py-2.5 text-lg shadow-sm"
            aria-label="Attach a photo"
          >
            📷
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message the room…"
            className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            disabled={sending || (!draft.trim() && !imageFile)}
            className="flex-none rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-card disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </AppShell>
  );
}
