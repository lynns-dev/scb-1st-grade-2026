"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { googleCalendarUrl } from "@/lib/googleCalendarLink";
import { startOfWeek } from "@/lib/dateUtils";
import AppShell from "@/components/AppShell";
import Avatar from "@/components/Avatar";
import { SkeletonCards } from "@/components/Skeleton";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function HomePage() {
  const { profile } = useProfile();
  const [reminders, setReminders] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const weekStart = startOfWeek(new Date()).toISOString().slice(0, 10);

      const [{ data: remindersData }, { data: eventsData }] = await Promise.all([
        supabase
          .from("reminders")
          .select("id, title, body, week_of, created_at")
          .gte("week_of", weekStart)
          .lte("publish_at", new Date().toISOString())
          .order("created_at", { ascending: false }),
        supabase
          .from("events")
          .select("id, title, description, location, start_at, end_at, all_day, event_type")
          .gte("start_at", new Date().toISOString())
          .order("start_at", { ascending: true })
          .limit(3),
      ]);

      if (active) {
        setReminders(remindersData || []);
        setEvents(eventsData || []);
        setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell title="This week">
      {profile?.child_name && (
        <div className="mb-6 flex flex-col items-center text-center">
          <Avatar src={profile.child_avatar_url} name={profile.child_name} size={96} />
          <p className="mt-3 text-xl font-bold text-slate-900">{profile.child_name}</p>
          <p className="text-sm text-slate-500">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </p>
        </div>
      )}

      {!profile?.child_name && (
        <p className="mb-5 text-sm text-slate-500">
          Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </p>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Weekly reminders
        </h2>
        {loading ? (
          <SkeletonCards count={2} />
        ) : reminders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
            No reminders posted yet this week.
          </div>
        ) : (
          <ul className="space-y-3">
            {reminders.map((r) => (
              <li key={r.id} className="rounded-2xl bg-white p-4 shadow-card">
                <p className="font-semibold text-slate-900">{r.title}</p>
                {r.body && <p className="mt-1 text-sm text-slate-500">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Coming up
          </h2>
          <Link href="/calendar" className="text-xs font-medium text-brand-600">
            View calendar
          </Link>
        </div>
        {loading ? (
          <SkeletonCards count={2} />
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
            Nothing on the calendar yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="rounded-2xl bg-white p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">
                    {e.event_type === "birthday" && "🎂 "}
                    {e.title}
                  </span>
                  <span className="text-xs text-slate-400">{formatDate(e.start_at)}</span>
                </div>
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
                  className="mt-1 inline-block text-xs font-medium text-brand-600"
                >
                  Add to Google Calendar
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
