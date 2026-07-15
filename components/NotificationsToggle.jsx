"use client";

import { useEffect, useState } from "react";
import {
  isPushSupported,
  getPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pushClient";

export default function NotificationsToggle() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSupported(isPushSupported());
    getPushSubscription().then((sub) => setEnabled(!!sub));
  }, []);

  async function handleToggle() {
    setBusy(true);
    setError("");

    try {
      if (enabled) {
        await unsubscribeFromPush();
        setEnabled(false);
      } else {
        await subscribeToPush();
        setEnabled(true);
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="mb-6 flex items-center justify-between rounded-2xl bg-white p-4 shadow-card">
      <div>
        <p className="text-sm font-semibold text-slate-900">🔔 Notifications</p>
        <p className="text-xs text-slate-500">
          {enabled ? "You'll get alerts for new reminders and chat." : "Get alerted for new reminders and chat messages."}
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <button
        onClick={handleToggle}
        disabled={busy}
        className={`flex-none rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-50 ${
          enabled ? "bg-slate-100 text-slate-600" : "bg-brand-500 text-white"
        }`}
      >
        {busy ? "…" : enabled ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}
