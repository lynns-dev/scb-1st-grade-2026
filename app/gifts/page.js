"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";
import { SkeletonCards } from "@/components/Skeleton";
import { staggerStyle } from "@/lib/stagger";

function currency(cents) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function GiftsPage() {
  const [collections, setCollections] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const [{ data: collectionsData }, { data: contributions }] = await Promise.all([
        supabase
          .from("gift_collections")
          .select("id, title, note, target_cents, closed_at, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("gift_contributions").select("collection_id, amount_cents, status"),
      ]);

      const nextTotals = {};
      for (const c of contributions || []) {
        if (c.status !== "succeeded") continue;
        nextTotals[c.collection_id] = (nextTotals[c.collection_id] || 0) + c.amount_cents;
      }

      if (active) {
        setCollections(collectionsData || []);
        setTotals(nextTotals);
        setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell title="Gifts">
      <p className="mb-4 text-sm text-slate-500">
        Chip in for a teacher gift or class fundraiser — funds go straight to whoever&apos;s
        collecting, no cash or Venmo requests needed.
      </p>

      {loading ? (
        <SkeletonCards count={2} />
      ) : collections.length === 0 ? (
        <div className="animate-fade-in-item rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
          No gift collections right now.
        </div>
      ) : (
        <ul className="space-y-3">
          {collections.map((c, i) => {
            const raised = totals[c.id] || 0;
            return (
              <li key={c.id} className="animate-fade-in-item" style={staggerStyle(i)}>
                <Link
                  href={`/gifts/${c.id}`}
                  className="block rounded-2xl bg-white p-4 shadow-card"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{c.title}</p>
                    {c.closed_at && (
                      <span className="flex-none text-xs font-medium text-slate-400">Closed</span>
                    )}
                  </div>
                  {c.note && <p className="mt-1 text-sm text-slate-500">{c.note}</p>}
                  <p className="mt-2 text-sm font-medium text-brand-600">
                    {currency(raised)} raised
                    {c.target_cents ? ` of ${currency(c.target_cents)} goal` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
