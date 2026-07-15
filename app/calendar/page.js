"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { googleCalendarUrl } from "@/lib/googleCalendarLink";
import { uploadEventImage } from "@/lib/uploadFile";
import { startOfWeek, addDays, isSameDay } from "@/lib/dateUtils";
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

function EventCard({ event, profile, onDelete, showDateBadge = true }) {
  const start = new Date(event.start_at);
  const isBirthday = event.event_type === "birthday";
  const mine = event.created_by === profile?.id;

  return (
    <li className="flex gap-3 rounded-2xl bg-white p-4 shadow-card">
      {showDateBadge && (
        <div className="flex w-12 flex-none flex-col items-center justify-center rounded-xl bg-brand-50 py-1.5 text-brand-600">
          <span className="text-[10px] font-semibold uppercase">
            {start.toLocaleDateString(undefined, { month: "short" })}
          </span>
          <span className="text-lg font-bold leading-none">{start.getDate()}</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">
          {isBirthday && "🎂 "}
          {event.title}
        </p>
        <p className="text-xs text-slate-400">
          {event.all_day
            ? "All day"
            : start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        {isBirthday && event.profiles?.full_name && (
          <p className="text-xs text-slate-400">Hosted by {event.profiles.full_name}</p>
        )}
        {event.description && <p className="mt-1 text-sm text-slate-500">{event.description}</p>}
        {event.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.image_url}
            alt={`${event.title} invitation`}
            className="mt-2 max-h-48 w-full rounded-xl object-cover"
          />
        )}
        <div className="mt-2 flex items-center gap-3">
          <a
            href={googleCalendarUrl({
              title: event.title,
              description: event.description,
              location: event.location,
              startAt: event.start_at,
              endAt: event.end_at,
              allDay: event.all_day,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-brand-600"
          >
            Add to Google Calendar
          </a>
          {mine && (
            <button onClick={() => onDelete(event.id)} className="text-xs font-medium text-red-500">
              Delete
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function BirthdayForm({ profile, onCreated, onCancel }) {
  const [title, setTitle] = useState(profile.child_name ? `${profile.child_name}'s Birthday` : "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  function handleImagePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const supabase = createClient();

    let imageUrl = null;
    if (imageFile) {
      try {
        imageUrl = await uploadEventImage(supabase, profile.id, imageFile);
      } catch (uploadError) {
        setSaving(false);
        setError(uploadError.message || "Couldn't upload that image.");
        return;
      }
    }

    const allDay = !time;
    const startAt = time ? new Date(`${date}T${time}`) : new Date(`${date}T00:00`);

    const { error: insertError } = await supabase.from("events").insert({
      title,
      description: description || null,
      location: location || null,
      image_url: imageUrl,
      start_at: startAt.toISOString(),
      all_day: allDay,
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
      <div className="flex gap-2">
        <input
          required
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-1/2 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="Time (optional)"
          className="w-1/2 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>
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

      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-sm font-medium text-brand-600"
        >
          {imagePreview ? "Change invitation image" : "+ Add an invitation image (optional)"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImagePick}
        />
        {imagePreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagePreview}
            alt="Invitation preview"
            className="mt-2 max-h-40 w-full rounded-xl object-cover"
          />
        )}
      </div>

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

function WeekView({ events, profile, onDelete }) {
  const todayWeekStart = startOfWeek(new Date());
  const [weekStart, setWeekStart] = useState(todayWeekStart);
  const today = new Date();
  const canGoBack = weekStart.getTime() > todayWeekStart.getTime();

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];
  const label =
    weekStart.getMonth() === weekEnd.getMonth()
      ? `Week of ${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-100 px-2 py-2.5">
        <button
          onClick={() => canGoBack && setWeekStart(addDays(weekStart, -7))}
          disabled={!canGoBack}
          className="px-2 text-lg text-slate-400 disabled:opacity-30"
          aria-label="Previous week"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="px-2 text-lg text-slate-400"
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      {days.map((day) => {
        const dayEvents = events.filter((e) => isSameDay(new Date(e.start_at), day));
        const isToday = isSameDay(day, today);

        return (
          <div key={day.toISOString()} className={`mb-3 rounded-2xl p-3 ${isToday ? "bg-brand-50" : ""}`}>
            <p className={`mb-2 text-sm font-bold ${isToday ? "text-brand-700" : "text-slate-900"}`}>
              {day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              {isToday && <span className="ml-1.5 text-[10px] font-semibold uppercase text-brand-500">Today</span>}
            </p>
            {dayEvents.length === 0 ? (
              <p className="text-xs text-slate-400">No events</p>
            ) : (
              <ul className="space-y-2">
                {dayEvents.map((e) => (
                  <EventCard key={e.id} event={e} profile={profile} onDelete={onDelete} showDateBadge={false} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ events, profile, onDelete }) {
  const groups = groupByMonth(events);

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
        No upcoming events yet.
      </div>
    );
  }

  return Array.from(groups.entries()).map(([month, monthEvents]) => (
    <section key={month} className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{month}</h2>
      <ul className="space-y-3">
        {monthEvents.map((e) => (
          <EventCard key={e.id} event={e} profile={profile} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  ));
}

export default function CalendarPage() {
  const { profile } = useProfile();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBirthdayForm, setShowBirthdayForm] = useState(false);
  const [view, setView] = useState("week");

  async function refresh() {
    const supabase = createClient();
    const { data } = await supabase
      .from("events")
      .select(
        "id, title, description, location, image_url, event_type, start_at, end_at, all_day, created_by, profiles ( full_name )"
      )
      .gte("start_at", startOfWeek(new Date()).toISOString())
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

      <div className="mb-4 flex rounded-xl bg-slate-100 p-1">
        {["week", "month"].map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold capitalize ${
              view === v ? "bg-white text-brand-600 shadow-sm" : "text-slate-500"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : view === "week" ? (
        <WeekView events={events} profile={profile} onDelete={handleDelete} />
      ) : (
        <MonthView events={events} profile={profile} onDelete={handleDelete} />
      )}
    </AppShell>
  );
}
