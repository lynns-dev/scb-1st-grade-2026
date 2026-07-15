"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { googleCalendarUrl } from "@/lib/googleCalendarLink";
import AppShell from "@/components/AppShell";

function groupByMonth(events) {
  const groups = new Map();
  for (const event of events) {
    const key = new Date(event.start_at).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  return groups;
}

function BirthdayForm({ profile, onCreated, onCancel }) {
  const [title, setTitle] = useState(profile.child_name ? `${profile.child_name}'s Birthday` : "");
  const [startAt, setStartAt] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { error: insertError } = await supabase.from("events").insert({
      title,
      description: description || null,
      location: location || null,
      start_at: new Date(startAt).toISOString(),
      event_type: "birthday",
      created_by: profile.id,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onCreated();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 space-y-2 rounded-2xl border border-brand-100 bg-white p-4 shadow-card"
    >
      <p className="mb-1 text-sm font-semibold text-slate-900">🎂 New birthday invite</p>
      <input
        required
        placeholder="e.g. Emma's Birthday Party"
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
        placeholder="Details — RSVP info, etc. (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Posting…" : "Post invite"}
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

export default function CalendarPage() {
  const { profile } = useProfile();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBirthdayForm, setShowBirthdayForm] = useState(false);

  async function refresh() {
    const supabase = createClient();
    const { data } = await supabase
      .from("events")
      .select("id, title, description, location, event_type, start_at, end_at, all_day, created_by, profiles ( full_name )")
      .gte("start_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("start_at", { ascending: true });

    setEvents(data || []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleDelete(id) {
    const supabase = createClient();
    await supabase.from("events").delete().eq("id", id);
    refresh();
  }

  const groups = groupByMonth(events);

  return (
    <AppShell title="Calendar">
      {profile && !showBirthdayForm && (
        <button
          onClick={() => setShowBirthdayForm(true)}
          className="mb-6 w-full rounded-2xl border border-dashed border-brand-200 bg-brand-50 py-3 text-sm font-semibold text-brand-600"
        >
          🎂 Post a birthday invite
        </button>
      )}

      {profile && showBirthdayForm && (
        <BirthdayForm
          profile={profile}
          onCancel={() => setShowBirthdayForm(false)}
          onCreated={() => {
            setShowBirthdayForm(false);
            refresh();
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
          No upcoming events yet.
        </div>
      ) : (
        Array.from(groups.entries()).map(([month, monthEvents]) => (
          <section key={month} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              {month}
            </h2>
            <ul className="space-y-3">
              {monthEvents.map((e) => {
                const start = new Date(e.start_at);
                const isBirthday = e.event_type === "birthday";
                const mine = e.created_by === profile?.id;

                return (
                  <li key={e.id} className="flex gap-3 rounded-2xl bg-white p-4 shadow-card">
                    <div className="flex w-12 flex-none flex-col items-center justify-center rounded-xl bg-brand-50 py-1.5 text-brand-600">
                      <span className="text-[10px] font-semibold uppercase">
                        {start.toLocaleDateString(undefined, { month: "short" })}
                      </span>
                      <span className="text-lg font-bold leading-none">{start.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">
                        {isBirthday && "🎂 "}
                        {e.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {e.all_day
                          ? "All day"
                          : start.toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                        {e.location ? ` · ${e.location}` : ""}
                      </p>
                      {isBirthday && e.profiles?.full_name && (
                        <p className="text-xs text-slate-400">Hosted by {e.profiles.full_name}</p>
                      )}
                      {e.description && (
                        <p className="mt-1 text-sm text-slate-500">{e.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3">
                        <a
                          href={googleCalendarUrl({
                            title: e.title,
                            description: e.description,
                            location: e.location,
                            startAt: e.start_at,
                            endAt: e.end_at,
                            allDay: e.all_day,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-brand-600"
                        >
                          Add to Google Calendar
                        </a>
                        {mine && (
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="text-xs font-medium text-red-500"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </AppShell>
  );
}
