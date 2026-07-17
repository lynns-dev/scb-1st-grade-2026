"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function WishlistSettingsForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("classroom_settings")
      .select("wishlist_url")
      .eq("id", true)
      .single()
      .then(({ data }) => {
        setUrl(data?.wishlist_url || "");
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wishlistUrl: url }),
    });
    const data = await res.json().catch(() => ({}));

    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't save that link.");
      return;
    }
    setUrl(data.settings?.wishlist_url || "");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-2xl bg-white p-4 shadow-card">
      <p className="text-xs text-slate-500">
        Paste your Amazon wishlist link (or any shopping list link) — it shows up as a Wishlist
        card on everyone&apos;s Home screen. Leave blank and save to hide it again.
      </p>
      <input
        type="text"
        placeholder="https://www.amazon.com/hz/wishlist/ls/..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {saved && <p className="text-xs font-medium text-brand-600">✅ Saved</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
