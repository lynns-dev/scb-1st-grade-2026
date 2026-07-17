"use client";

import { useEffect, useState } from "react";
import { isIOS, isStandalone } from "@/lib/platform";
import { isPushSupported, getPushSubscription, subscribeToPush } from "@/lib/pushClient";

const DISMISS_KEY = "notifications-prompt-dismissed";

// Surfaces the "turn on notifications" ask automatically, right after
// signup or the first time someone opens the app — instead of leaving it
// buried as an opt-in toggle on the Directory tab that most people never
// find. Skipped entirely on iOS unless the app is already installed to the
// Home Screen, since Web Push there only works in standalone mode; the
// InstallPrompt banner already covers nudging them to install first.
export default function NotificationsPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPushSupported()) return;
    if (isIOS() && !isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (typeof Notification !== "undefined" && Notification.permission !== "default") return;

    getPushSubscription().then((sub) => {
      if (!sub) setVisible(true);
    });
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function handleEnable() {
    setBusy(true);
    setError("");
    try {
      await subscribeToPush();
      dismiss();
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="animate-fade-in-item mx-auto mb-4 max-w-lg rounded-2xl bg-brand-50 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand-700">🔔 Turn on notifications</p>
          <p className="mt-0.5 text-xs text-brand-600">
            Get alerted the moment a new reminder or chat message goes out.
          </p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
        <button onClick={dismiss} className="flex-none text-xs font-medium text-brand-400">
          Not now
        </button>
      </div>
      <button
        onClick={handleEnable}
        disabled={busy}
        className="mt-3 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Turning on…" : "Turn on"}
      </button>
    </div>
  );
}
