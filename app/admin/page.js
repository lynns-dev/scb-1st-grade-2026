"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { uploadReminderAttachment } from "@/lib/uploadFile";
import AppShell from "@/components/AppShell";
import { SkeletonCards } from "@/components/Skeleton";
import { staggerStyle } from "@/lib/stagger";

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function AssistantPanel({ onAction }) {
  const [thread, setThread] = useState([
    {
      role: "assistant",
      text: "Hi! Tell me what to add or change — e.g. \"remind everyone to bring $5 for the book fair Friday\" or \"add an event for the field trip on Oct 3rd, 9am–2pm.\"",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const historyRef = useRef([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length]);

  async function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setError("");
    setThread((t) => [...t, { role: "user", text }]);
    setDraft("");
    setSending(true);

    try {
      const res = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: historyRef.current }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      historyRef.current = data.history || historyRef.current;
      setThread((t) => [...t, { role: "assistant", text: data.reply || "Done." }]);
      if (data.actions?.length) onAction?.();
    } catch {
      setError("Couldn't reach the assistant. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="mb-3 max-h-72 space-y-3 overflow-y-auto">
        {thread.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                m.role === "user" ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {sending && <p className="text-xs text-slate-400">Thinking…</p>}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a command…"
          className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function AttachmentPicker({ userId, attachmentUrl, attachmentName, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  async function handlePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);

    try {
      const supabase = createClient();
      const publicUrl = await uploadReminderAttachment(supabase, userId, file);
      onChange({ attachmentUrl: publicUrl, attachmentName: file.name });
    } catch (err) {
      setError(err.message || "Couldn't upload that file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      {attachmentUrl ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <span className="min-w-0 truncate text-slate-700">📎 {attachmentName || "Attachment"}</span>
          <button
            type="button"
            onClick={() => onChange({ attachmentUrl: "", attachmentName: "" })}
            className="flex-none text-xs font-medium text-red-500"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-brand-600 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "📎 Attach a file (optional)"}
        </button>
      )}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handlePick} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ReminderForm({ onCreated, userId }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const publishAt = scheduleDate
      ? new Date(`${scheduleDate}T${scheduleTime || "08:00"}`).toISOString()
      : undefined;

    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, publishAt, attachmentUrl, attachmentName }),
    });
    const data = await res.json().catch(() => ({}));

    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't post that reminder.");
      return;
    }
    setTitle("");
    setBody("");
    setScheduleDate("");
    setScheduleTime("");
    setAttachmentUrl("");
    setAttachmentName("");
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-2 rounded-2xl bg-white p-4 shadow-card">
      <input
        required
        placeholder="Reminder title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <textarea
        placeholder="Details (optional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <AttachmentPicker
        userId={userId}
        attachmentUrl={attachmentUrl}
        attachmentName={attachmentName}
        onChange={({ attachmentUrl: url, attachmentName: name }) => {
          setAttachmentUrl(url);
          setAttachmentName(name);
        }}
      />
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">
          Schedule for later (optional — leave blank to post now)
        </p>
        <div className="flex gap-2">
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="w-1/2 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <input
            type="time"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            disabled={!scheduleDate}
            className="w-1/2 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : scheduleDate ? "Schedule reminder" : "Post reminder"}
      </button>
    </form>
  );
}

function ReminderRow({ reminder, index, onChanged, userId }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(reminder.title);
  const [body, setBody] = useState(reminder.body || "");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState(reminder.attachment_url || "");
  const [attachmentName, setAttachmentName] = useState(reminder.attachment_name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const scheduled = new Date(reminder.publish_at).getTime() > Date.now();

  function startEdit() {
    setTitle(reminder.title);
    setBody(reminder.body || "");
    const d = new Date(reminder.publish_at);
    setScheduleDate(d.toISOString().slice(0, 10));
    setScheduleTime(d.toTimeString().slice(0, 5));
    setAttachmentUrl(reminder.attachment_url || "");
    setAttachmentName(reminder.attachment_name || "");
    setError("");
    setEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const publishAt = scheduleDate
      ? new Date(`${scheduleDate}T${scheduleTime || "08:00"}`).toISOString()
      : undefined;

    const res = await fetch(`/api/reminders/${reminder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, publishAt, attachmentUrl, attachmentName }),
    });
    const data = await res.json().catch(() => ({}));

    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't save changes.");
      return;
    }
    setEditing(false);
    onChanged();
  }

  async function handleDelete() {
    await fetch(`/api/reminders/${reminder.id}`, { method: "DELETE" });
    onChanged();
  }

  if (editing) {
    return (
      <li className="rounded-2xl bg-white p-3 shadow-card">
        <form onSubmit={handleSave} className="space-y-2">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <AttachmentPicker
            userId={userId}
            attachmentUrl={attachmentUrl}
            attachmentName={attachmentName}
            onChange={({ attachmentUrl: url, attachmentName: name }) => {
              setAttachmentUrl(url);
              setAttachmentName(name);
            }}
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-1/2 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-1/2 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className="animate-fade-in-item flex items-start justify-between gap-3 rounded-2xl bg-white p-3 shadow-card"
      style={staggerStyle(index)}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{reminder.title}</p>
        {reminder.body && <p className="text-xs text-slate-500">{reminder.body}</p>}
        {reminder.attachment_url && (
          <p className="mt-1 text-xs font-medium text-brand-600">
            📎 {reminder.attachment_name || "Attachment"}
          </p>
        )}
        {scheduled && (
          <p className="mt-1 text-xs font-medium text-amber-600">
            ⏱ Scheduled for{" "}
            {new Date(reminder.publish_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
      <div className="flex flex-none gap-3">
        <button onClick={startEdit} className="text-xs font-medium text-brand-600">
          Edit
        </button>
        <button onClick={handleDelete} className="text-xs font-medium text-red-500">
          Delete
        </button>
      </div>
    </li>
  );
}

function LinkForm({ onCreated }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, url }),
    });
    const data = await res.json().catch(() => ({}));

    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't add that link.");
      return;
    }
    setTitle("");
    setUrl("");
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-2 rounded-2xl bg-white p-4 shadow-card">
      <input
        required
        placeholder="Link title (e.g. School supply list)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <input
        required
        placeholder="URL (e.g. https://...)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Adding…" : "Add link"}
      </button>
    </form>
  );
}

function LinkRow({ link, index, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(link.title);
  const [url, setUrl] = useState(link.url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setTitle(link.title);
    setUrl(link.url);
    setError("");
    setEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch(`/api/links/${link.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, url }),
    });
    const data = await res.json().catch(() => ({}));

    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't save changes.");
      return;
    }
    setEditing(false);
    onChanged();
  }

  async function handleDelete() {
    await fetch(`/api/links/${link.id}`, { method: "DELETE" });
    onChanged();
  }

  if (editing) {
    return (
      <li className="rounded-2xl bg-white p-3 shadow-card">
        <form onSubmit={handleSave} className="space-y-2">
          <input
            required
            placeholder="Link title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <input
            required
            placeholder="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className="animate-fade-in-item flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-card"
      style={staggerStyle(index)}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{link.title}</p>
        <p className="truncate text-xs text-slate-400">{link.url}</p>
      </div>
      <div className="flex flex-none gap-3">
        <button onClick={startEdit} className="text-xs font-medium text-brand-600">
          Edit
        </button>
        <button onClick={handleDelete} className="text-xs font-medium text-red-500">
          Delete
        </button>
      </div>
    </li>
  );
}

function toLocalDateTimeInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EventRow({ event, index, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || "");
  const [location, setLocation] = useState(event.location || "");
  const [startAt, setStartAt] = useState("");
  const [allDay, setAllDay] = useState(event.all_day);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setTitle(event.title);
    setDescription(event.description || "");
    setLocation(event.location || "");
    setStartAt(toLocalDateTimeInput(event.start_at));
    setAllDay(event.all_day);
    setError("");
    setEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        location,
        startAt: new Date(startAt).toISOString(),
        allDay,
      }),
    });
    const data = await res.json().catch(() => ({}));

    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't save changes.");
      return;
    }
    setEditing(false);
    onChanged();
  }

  async function handleDelete() {
    await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    onChanged();
  }

  if (editing) {
    return (
      <li className="rounded-2xl bg-white p-3 shadow-card">
        <form onSubmit={handleSave} className="space-y-2">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <input
            required
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <input
            placeholder="Location (optional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <textarea
            placeholder="Details (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            All day
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className="animate-fade-in-item flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-card"
      style={staggerStyle(index)}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{event.title}</p>
        <p className="text-xs text-slate-400">
          {event.all_day
            ? "All day"
            : new Date(event.start_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      </div>
      <div className="flex flex-none gap-3">
        <button onClick={startEdit} className="text-xs font-medium text-brand-600">
          Edit
        </button>
        <button onClick={handleDelete} className="text-xs font-medium text-red-500">
          Delete
        </button>
      </div>
    </li>
  );
}

function EventForm({ onCreated }) {
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, startAt: new Date(startAt).toISOString(), location }),
    });
    setSaving(false);
    if (res.ok) {
      setTitle("");
      setStartAt("");
      setLocation("");
      onCreated();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-2 rounded-2xl bg-white p-4 shadow-card">
      <input
        required
        placeholder="Event title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <input
        required
        type="datetime-local"
        value={startAt}
        onChange={(e) => setStartAt(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <input
        placeholder="Location (optional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Adding…" : "Add event"}
      </button>
    </form>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const [reminders, setReminders] = useState([]);
  const [events, setEvents] = useState([]);
  const [links, setLinks] = useState([]);

  async function refresh() {
    const supabase = createClient();
    const [{ data: r }, { data: e }, { data: l }] = await Promise.all([
      supabase
        .from("reminders")
        .select("id, title, body, publish_at, attachment_url, attachment_name, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("events")
        .select("id, title, description, location, start_at, all_day")
        .gte("start_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("start_at", { ascending: true }),
      supabase.from("links").select("id, title, url").order("created_at", { ascending: true }),
    ]);
    setReminders(r || []);
    setEvents(e || []);
    setLinks(l || []);
  }

  useEffect(() => {
    if (profile?.role === "admin") refresh();
  }, [profile?.role]);

  useEffect(() => {
    if (!profileLoading && profile && profile.role !== "admin") {
      router.replace("/home");
    }
  }, [profileLoading, profile, router]);

  if (profileLoading || !profile) {
    return (
      <AppShell title="Admin">
        <SkeletonCards count={3} height="h-20" />
      </AppShell>
    );
  }

  if (profile.role !== "admin") {
    return null;
  }

  return (
    <AppShell title="Admin">
      <Section title="Ask the assistant">
        <AssistantPanel onAction={refresh} />
      </Section>

      <Section title="Post a reminder">
        <ReminderForm onCreated={refresh} userId={profile.id} />
        <ul className="space-y-2">
          {reminders.map((r, i) => (
            <ReminderRow key={r.id} reminder={r} index={i} onChanged={refresh} userId={profile.id} />
          ))}
        </ul>
      </Section>

      <Section title="Add a calendar event">
        <EventForm onCreated={refresh} />
        <ul className="space-y-2">
          {events.map((e, i) => (
            <EventRow key={e.id} event={e} index={i} onChanged={refresh} />
          ))}
        </ul>
      </Section>

      <Section title="Manage links">
        <LinkForm onCreated={refresh} />
        <ul className="space-y-2">
          {links.map((l, i) => (
            <LinkRow key={l.id} link={l} index={i} onChanged={refresh} />
          ))}
        </ul>
      </Section>
    </AppShell>
  );
}
