"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { uploadChatImage } from "@/lib/uploadFile";
import Avatar from "@/components/Avatar";
import AppShell from "@/components/AppShell";
import Skeleton from "@/components/Skeleton";
import { staggerStyle } from "@/lib/stagger";

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

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function MessageReactions({ reactions, currentUserId, align, onToggle }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const grouped = {};
  for (const r of reactions || []) {
    if (!grouped[r.emoji]) grouped[r.emoji] = [];
    grouped[r.emoji].push(r.user_id);
  }
  const entries = Object.entries(grouped);

  return (
    <div className={`mt-1 flex flex-wrap items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
      {entries.map(([emoji, userIds]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
            userIds.includes(currentUserId)
              ? "bg-brand-100 text-brand-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          <span>{emoji}</span>
          <span>{userIds.length}</span>
        </button>
      ))}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500"
          aria-label="Add reaction"
        >
          +
        </button>
        {pickerOpen && (
          <div
            className={`absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-full bg-white p-1 shadow-card ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggle(emoji);
                  setPickerOpen(false);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-base hover:bg-slate-100"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
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
          .select(
            "id, body, image_url, created_at, user_id, profiles ( full_name, avatar_url, families ( child_name ) ), message_reactions ( id, emoji, user_id )"
          )
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
            .select("full_name, avatar_url, families ( child_name )")
            .eq("id", payload.new.user_id)
            .single();

          setMessages((prev) => [
            ...prev,
            { ...payload.new, profiles: data || null, message_reactions: [] },
          ]);
          if (payload.new.user_id !== profile.id) markRead();
        }
      )
      // No room_id column on message_reactions to filter by, so this
      // listens broadly and just ignores anything for a message we're not
      // currently showing.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions" },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== payload.new.message_id) return m;
              const existing = m.message_reactions || [];
              // Our own optimistic insert already added a temp row for this
              // user+emoji — replace it with the real one instead of adding
              // a second entry when the realtime echo arrives.
              const tempIdx = existing.findIndex(
                (r) =>
                  String(r.id).startsWith("temp-") &&
                  r.user_id === payload.new.user_id &&
                  r.emoji === payload.new.emoji
              );
              if (tempIdx !== -1) {
                const next = [...existing];
                next[tempIdx] = payload.new;
                return { ...m, message_reactions: next };
              }
              if (existing.some((r) => r.id === payload.new.id)) return m;
              return { ...m, message_reactions: [...existing, payload.new] };
            })
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions" },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => ({
              ...m,
              message_reactions: (m.message_reactions || []).filter(
                (r) => r.id !== payload.old.id
              ),
            }))
          );
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, profile?.id]);

  async function toggleReaction(messageId, emoji) {
    if (!profile?.id) return;
    const supabase = createClient();
    const message = messages.find((m) => m.id === messageId);
    const existing = (message?.message_reactions || []).find(
      (r) => r.emoji === emoji && r.user_id === profile.id
    );

    if (existing) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id !== messageId
            ? m
            : {
                ...m,
                message_reactions: (m.message_reactions || []).filter((r) => r.id !== existing.id),
              }
        )
      );
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      setMessages((prev) =>
        prev.map((m) =>
          m.id !== messageId
            ? m
            : {
                ...m,
                message_reactions: [
                  ...(m.message_reactions || []),
                  { id: tempId, emoji, user_id: profile.id },
                ],
              }
        )
      );
      const { data, error: insertError } = await supabase
        .from("message_reactions")
        .insert({ message_id: messageId, user_id: profile.id, emoji })
        .select("id, emoji, user_id")
        .single();

      if (insertError) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id !== messageId
              ? m
              : { ...m, message_reactions: (m.message_reactions || []).filter((r) => r.id !== tempId) }
          )
        );
      } else if (data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id !== messageId
              ? m
              : {
                  ...m,
                  message_reactions: (m.message_reactions || []).map((r) =>
                    r.id === tempId ? data : r
                  ),
                }
          )
        );
      }
    }
  }

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
            <div className="animate-fade-in-item rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
              No messages yet — say hi!
            </div>
          ) : (
            messages.map((m, i) => {
              const mine = m.user_id === profile?.id;
              return (
                <div
                  key={m.id}
                  className={`animate-fade-in-item flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}
                  style={staggerStyle(i)}
                >
                  <Avatar src={m.profiles?.avatar_url} name={m.profiles?.full_name} size={28} />
                  <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <span className="mb-0.5 px-1 text-[11px] text-slate-400">
                      {mine ? "You" : m.profiles?.full_name || "A parent"}
                      {m.profiles?.families?.child_name
                        ? ` (${m.profiles.families.child_name}'s parent)`
                        : ""}{" "}
                      · {formatTime(m.created_at)}
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
                    <MessageReactions
                      reactions={m.message_reactions}
                      currentUserId={profile?.id}
                      align={mine ? "right" : "left"}
                      onToggle={(emoji) => toggleReaction(m.id, emoji)}
                    />
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
