"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";
import Avatar from "@/components/Avatar";
import { SkeletonCards } from "@/components/Skeleton";
import { staggerStyle } from "@/lib/stagger";

const QUICK_AMOUNTS = [10, 20, 50, 100];

function currency(cents) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function GiftCollectionPage({ params }) {
  return (
    <Suspense fallback={null}>
      <GiftCollectionContent params={params} />
    </Suspense>
  );
}

function GiftCollectionContent({ params }) {
  const collectionId = params.id;
  const searchParams = useSearchParams();
  const justGave = searchParams.get("success") === "1";

  const [collection, setCollection] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const supabase = createClient();
    const [{ data: collectionData }, { data: contributionsData }] = await Promise.all([
      supabase
        .from("gift_collections")
        .select("id, title, note, target_cents, closed_at")
        .eq("id", collectionId)
        .single(),
      supabase
        .from("gift_contributions")
        .select("id, amount_cents, note, created_at, profiles ( full_name, avatar_url )")
        .eq("collection_id", collectionId)
        .eq("status", "succeeded")
        .order("created_at", { ascending: false }),
    ]);

    setCollection(collectionData || null);
    setContributions(contributionsData || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId]);

  const raised = contributions.reduce((sum, c) => sum + c.amount_cents, 0);

  async function handleSend(e) {
    e.preventDefault();
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter an amount first.");
      return;
    }

    setSending(true);
    setError("");

    const res = await fetch("/api/gifts/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId, amount: dollars, note }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.url) {
      setSending(false);
      setError(data.error || "Couldn't start checkout.");
      return;
    }

    window.location.href = data.url;
  }

  if (loading) {
    return (
      <AppShell title="Gift" backHref="/gifts">
        <SkeletonCards count={2} />
      </AppShell>
    );
  }

  if (!collection) {
    return (
      <AppShell title="Gift" backHref="/gifts">
        <p className="text-sm text-slate-400">This collection couldn&apos;t be found.</p>
      </AppShell>
    );
  }

  // A single running index across every animated block on the page (banner,
  // stat card, form, contributor list), so the entrance reads as one
  // top-to-bottom cascade instead of each piece popping in on its own.
  let cardIndex = 0;

  return (
    <AppShell title={collection.title} backHref="/gifts">
      {justGave && (
        <div
          className="animate-fade-in-item mb-4 rounded-2xl bg-brand-50 p-4 text-center shadow-card"
          style={staggerStyle(cardIndex++)}
        >
          <p className="text-sm font-semibold text-brand-700">🎉 Thank you!</p>
          <p className="mt-0.5 text-xs text-brand-600">
            Your gift is on its way — it may take a few days to fully clear if you paid by bank
            transfer.
          </p>
        </div>
      )}

      <div
        className="animate-fade-in-item mb-4 rounded-2xl bg-white p-4 shadow-card"
        style={staggerStyle(cardIndex++)}
      >
        {collection.note && <p className="text-sm text-slate-600">{collection.note}</p>}
        <p className="mt-2 text-lg font-bold text-slate-900">
          {currency(raised)}
          <span className="ml-1 text-sm font-normal text-slate-400">
            raised{collection.target_cents ? ` of ${currency(collection.target_cents)} goal` : ""}
          </span>
        </p>
      </div>

      {!collection.closed_at ? (
        <form
          onSubmit={handleSend}
          className="animate-fade-in-item mb-4 space-y-3 rounded-2xl bg-white p-4 shadow-card"
          style={staggerStyle(cardIndex++)}
        >
          <div className="flex gap-2">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(String(a))}
                className={`flex-1 rounded-xl border px-2 py-2 text-sm font-semibold ${
                  amount === String(a)
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                ${a}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
            <span className="text-lg text-slate-400">$</span>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="1"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-lg font-semibold outline-none"
            />
          </div>
          <input
            placeholder="Add a note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-xl bg-brand-500 px-4 py-3 text-base font-semibold text-white shadow-card transition active:scale-[0.99] disabled:opacity-50"
          >
            {sending ? "Redirecting…" : "Send gift"}
          </button>
        </form>
      ) : (
        <div
          className="animate-fade-in-item mb-4 rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400"
          style={staggerStyle(cardIndex++)}
        >
          This collection is closed.
        </div>
      )}

      {contributions.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Who&apos;s given
          </h2>
          <ul className="space-y-2">
            {contributions.map((c) => (
              <li
                key={c.id}
                className="animate-fade-in-item flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card"
                style={staggerStyle(cardIndex++)}
              >
                <Avatar src={c.profiles?.avatar_url} name={c.profiles?.full_name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {c.profiles?.full_name || "A parent"}{" "}
                    <span className="font-semibold text-brand-600">{currency(c.amount_cents)}</span>
                  </p>
                  {c.note && <p className="truncate text-xs text-slate-500">{c.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
