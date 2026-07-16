"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import AppShell from "@/components/AppShell";
import { SkeletonCards } from "@/components/Skeleton";

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

function ReminderForm({ onCreated }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
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
      body: JSON.stringify({ title, body, publishAt }),
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

  async function refresh() {
    const supabase = createClient();
    const [{ data: r }, { data: e }] = await Promise.all([
      supabase
        .from("reminders")
        .select("id, title, body, publish_at, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("events")
        .select("id, title, start_at")
        .gte("start_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("start_at", { ascending: true }),
    ]);
    setReminders(r || []);
    setEvents(e || []);
  }

  useEffect(() => {
    if (profile?.role === "admin") refresh();
  }, [profile?.role]);

  useEffect(() => {
    if (!profileLoading && profile && profile.role !== "admin") {
      router.replace("/home");
    }
  }, [profileLoading, profile, router]);

  async function deleteReminder(id) {
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    refresh();
  }

  async function deleteEvent(id) {
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    refresh();
  }

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
        <ReminderForm onCreated={refresh} />
        <ul className="space-y-2">
          {reminders.map((r) => {
            const scheduled = new Date(r.publish_at).getTime() > Date.now();
            return (
              <li
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-2xl bg-white p-3 shadow-card"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{r.title}</p>
                  {r.body && <p className="text-xs text-slate-500">{r.body}</p>}
                  {scheduled && (
                    <p className="mt-1 text-xs font-medium text-amber-600">
                      ⏱ Scheduled for{" "}
                      {new Date(r.publish_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteReminder(r.id)}
                  className="flex-none text-xs font-medium text-red-500"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Add a calendar event">
        <EventForm onCreated={refresh} />
        <ul className="space-y-2">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-card"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{e.title}</p>
                <p className="text-xs text-slate-400">
                  {new Date(e.start_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <button
                onClick={() => deleteEvent(e.id)}
                className="flex-none text-xs font-medium text-red-500"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </AppShell>
  );
}
