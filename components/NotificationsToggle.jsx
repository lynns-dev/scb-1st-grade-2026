"use client";

import { useEffect, useState } from "react";
import { isIOS, isStandalone } from "@/lib/platform";
import {
  isPushSupported,
  getPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pushClient";

export default function NotificationsToggle() {
  const [supported, setSupported] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSupported(isPushSupported());
    setNeedsInstall(isIOS() && !isStandalone());
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

  if (needsInstall) {
    return (
      <div className="mb-6 rounded-2xl bg-white p-4 shadow-card">
        <p className="text-sm font-semibold text-slate-900">🔔 Notifications</p>
        <p className="mt-1 text-xs text-slate-500">
          On iPhone, notifications only work once this app is added to your Home Screen: tap the
          Share button, then &quot;Add to Home Screen&quot; — then come back here to turn them on.
        </p>
      </div>
    );
  }

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
