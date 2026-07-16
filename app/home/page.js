"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { googleCalendarUrl } from "@/lib/googleCalendarLink";
import { startOfWeek } from "@/lib/dateUtils";
import AppShell from "@/components/AppShell";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";
import { SkeletonCards } from "@/components/Skeleton";
import { staggerStyle } from "@/lib/stagger";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

function formatEventTime(iso, allDay) {
  if (allDay) return "All day";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDateBadge(iso) {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: d.getDate(),
  };
}

const QUICK_LINKS = [
  {
    href: "/calendar",
    label: "Calendar",
    tint: "brand",
    icon: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M3.5 10h17" />
      </>
    ),
  },
  {
    href: "/chat",
    label: "Chat",
    tint: "accent",
    icon: <path d="M4 4h16v12H8l-4 4V4Z" />,
  },
  {
    href: "/directory",
    label: "Directory",
    tint: "brand",
    icon: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6M16 4.5c1.7.4 3 2 3 3.9s-1.3 3.5-3 3.9M20.5 20c0-2.8-1.8-5.1-4.2-5.8" />
      </>
    ),
  },
  {
    href: "/directory#links",
    label: "Links",
    tint: "accent",
    icon: <path d="M4 7h16M4 12h16M4 17h10" />,
  },
];

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
          .select(
            "id, title, body, week_of, created_at, attachment_url, attachment_name, profiles ( full_name )"
          )
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

  const firstName = profile?.full_name ? profile.full_name.split(" ")[0] : "";

  return (
    <AppShell title="Home">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{getGreeting()}</p>
          <p className="truncate text-3xl font-bold text-slate-900">{firstName || "there"}</p>
        </div>
        {profile?.child_name ? (
          <Avatar
            src={profile.child_avatar_url}
            name={profile.child_name}
            size={56}
            className="flex-none rounded-2xl shadow-card"
          />
        ) : (
          <Logo size={56} className="flex-none rounded-2xl shadow-card" />
        )}
      </div>

      <section className="mb-6">
        {loading ? (
          <SkeletonCards count={2} />
        ) : reminders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
            No reminders posted yet this week.
          </div>
        ) : (
          <ul className="space-y-3">
            {reminders.map((r, i) => (
              <li
                key={r.id}
                className="animate-fade-in-item rounded-2xl bg-brand-500 p-4 text-white shadow-card"
                style={staggerStyle(i)}
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-brand-100">
                  This week
                </p>
                <p className="mt-1 font-semibold text-white">{r.title}</p>
                {r.body && <p className="mt-1 text-sm text-white/85">{r.body}</p>}
                {r.profiles?.full_name && (
                  <p className="mt-2 text-xs text-white/70">From {r.profiles.full_name}</p>
                )}
                {r.attachment_url && (
                  <a
                    href={r.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-semibold text-white underline"
                  >
                    📎 {r.attachment_name || "View attachment"}
                  </a>
                )}
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
            {events.map((e, i) => {
              const badge = formatDateBadge(e.start_at);
              return (
                <li
                  key={e.id}
                  className="animate-fade-in-item flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card"
                  style={staggerStyle(i)}
                >
                  <div className="flex h-14 w-14 flex-none flex-col items-center justify-center rounded-xl bg-accent-100 text-accent-800">
                    <span className="text-[10px] font-bold uppercase tracking-wide">
                      {badge.month}
                    </span>
                    <span className="text-lg font-bold leading-none">{badge.day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">
                      {e.event_type === "birthday" && "🎉 "}
                      {e.title}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {formatEventTime(e.start_at, e.all_day)}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
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
                      className="mt-0.5 inline-block text-xs font-medium text-brand-600"
                    >
                      Add to Google Calendar
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        {QUICK_LINKS.map((q, i) => (
          <Link
            key={q.href}
            href={q.href}
            className="animate-fade-in-item flex flex-col rounded-2xl bg-white p-4 shadow-card"
            style={staggerStyle(i)}
          >
            <span
              className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                q.tint === "brand" ? "bg-brand-100 text-brand-600" : "bg-accent-100 text-accent-700"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {q.icon}
              </svg>
            </span>
            <p className="font-semibold text-slate-900">{q.label}</p>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
