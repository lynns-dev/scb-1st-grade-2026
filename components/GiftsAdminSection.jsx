"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { staggerStyle } from "@/lib/stagger";

function currency(cents) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function PayoutAccountStatus({ status, onConnect, connecting }) {
  if (status === "loading") return null;

  if (status === "ready") {
    return (
      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card">
        <div>
          <p className="text-sm font-semibold text-slate-900">✅ Payouts are set up</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Gifts route straight to the connected bank account.
          </p>
        </div>
        <button
          onClick={onConnect}
          disabled={connecting}
          className="flex-none rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
        >
          {connecting ? "…" : "Reassign"}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-2xl bg-white p-4 shadow-card">
      <p className="text-sm font-semibold text-slate-900">🏦 Connect a bank account</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Whoever should receive gifts (you, the teacher, this year&apos;s room parent) needs to link
        a bank account through Stripe before you can start a collection. Takes a few minutes.
      </p>
      <button
        onClick={onConnect}
        disabled={connecting}
        className="mt-3 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {connecting ? "Redirecting…" : "Connect payout account"}
      </button>
    </div>
  );
}

function CollectionForm({ disabled, onCreated }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/gifts/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, note, targetAmount: targetAmount || null }),
    });
    const data = await res.json().catch(() => ({}));

    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't start that collection.");
      return;
    }
    setTitle("");
    setNote("");
    setTargetAmount("");
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-2 rounded-2xl bg-white p-4 shadow-card">
      <input
        required
        disabled={disabled}
        placeholder="e.g. Holiday gift for Ms. Alvarez"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
      />
      <textarea
        disabled={disabled}
        placeholder="Note for parents (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
      />
      <input
        type="number"
        min="1"
        step="1"
        disabled={disabled}
        placeholder="Target amount (optional)"
        value={targetAmount}
        onChange={(e) => setTargetAmount(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={disabled || saving}
        className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Starting…" : "Start collection"}
      </button>
      {disabled && (
        <p className="text-xs text-slate-400">Connect a payout account above first.</p>
      )}
    </form>
  );
}

export default function GiftsAdminSection() {
  const [payoutStatus, setPayoutStatus] = useState("loading");
  const [connecting, setConnecting] = useState(false);
  const [collections, setCollections] = useState([]);
  const [totals, setTotals] = useState({});

  async function refresh() {
    const supabase = createClient();

    const statusRes = await fetch("/api/gifts/connect/status");
    const statusData = await statusRes.json().catch(() => ({}));
    setPayoutStatus(statusData.ready ? "ready" : "not_ready");

    const { data: collectionsData } = await supabase
      .from("gift_collections")
      .select("id, title, note, target_cents, closed_at, created_at")
      .order("created_at", { ascending: false });
    setCollections(collectionsData || []);

    const { data: contributions } = await supabase
      .from("gift_contributions")
      .select("collection_id, amount_cents, status");
    const nextTotals = {};
    for (const c of contributions || []) {
      if (c.status !== "succeeded") continue;
      nextTotals[c.collection_id] = (nextTotals[c.collection_id] || 0) + c.amount_cents;
    }
    setTotals(nextTotals);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/gifts/connect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setConnecting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setConnecting(false);
    }
  }

  async function handleClose(id) {
    await fetch(`/api/gifts/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ close: true }),
    });
    refresh();
  }

  return (
    <div>
      <PayoutAccountStatus status={payoutStatus} onConnect={handleConnect} connecting={connecting} />
      <CollectionForm disabled={payoutStatus !== "ready"} onCreated={refresh} />

      {collections.length > 0 && (
        <ul className="space-y-2">
          {collections.map((c, i) => (
            <li
              key={c.id}
              className="animate-fade-in-item rounded-2xl bg-white p-3 shadow-card"
              style={staggerStyle(i)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {c.title} {c.closed_at && <span className="text-xs text-slate-400">(closed)</span>}
                  </p>
                  {c.note && <p className="text-xs text-slate-500">{c.note}</p>}
                  <p className="mt-1 text-xs font-medium text-brand-600">
                    {currency(totals[c.id] || 0)} raised
                    {c.target_cents ? ` of ${currency(c.target_cents)}` : ""}
                  </p>
                </div>
                {!c.closed_at && (
                  <button
                    onClick={() => handleClose(c.id)}
                    className="flex-none text-xs font-medium text-red-500"
                  >
                    Close
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
