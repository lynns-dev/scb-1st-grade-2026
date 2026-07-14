"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const { data } = await supabase
        .from("events")
        .select("id, title, description, start_at, end_at, all_day")
        .gte("start_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("start_at", { ascending: true });

      if (active) {
        setEvents(data || []);
        setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const groups = groupByMonth(events);

  return (
    <AppShell title="Calendar">
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
                return (
                  <li key={e.id} className="flex gap-3 rounded-2xl bg-white p-4 shadow-card">
                    <div className="flex w-12 flex-none flex-col items-center justify-center rounded-xl bg-brand-50 py-1.5 text-brand-600">
                      <span className="text-[10px] font-semibold uppercase">
                        {start.toLocaleDateString(undefined, { month: "short" })}
                      </span>
                      <span className="text-lg font-bold leading-none">
                        {start.getDate()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{e.title}</p>
                      <p className="text-xs text-slate-400">
                        {e.all_day
                          ? "All day"
                          : start.toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                      </p>
                      {e.description && (
                        <p className="mt-1 text-sm text-slate-500">{e.description}</p>
                      )}
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
