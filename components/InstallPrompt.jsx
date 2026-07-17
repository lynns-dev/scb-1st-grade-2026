"use client";

import { useEffect, useState } from "react";
import { isStandalone, isIOS } from "@/lib/platform";

const DISMISS_KEY = "install-prompt-dismissed";

export default function InstallPrompt() {
  const [dismissed, setDismissed] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    setDismissed(false);
    if (isIOS()) setShowIosHint(true);

    function handleBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (dismissed || (!deferredPrompt && !showIosHint)) return null;

  return (
    <div className="animate-fade-in-item mx-auto mb-4 max-w-lg rounded-2xl bg-brand-50 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand-700">📲 Install this app</p>
          {deferredPrompt ? (
            <p className="mt-0.5 text-xs text-brand-600">
              Add it to your home screen for one-tap access, just like a regular app.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-brand-600">
              Tap the Share button, then &quot;Add to Home Screen&quot;.
            </p>
          )}
        </div>
        <button onClick={dismiss} className="flex-none text-xs font-medium text-brand-400">
          Dismiss
        </button>
      </div>
      {deferredPrompt && (
        <button
          onClick={handleInstallClick}
          className="mt-3 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white"
        >
          Install
        </button>
      )}
    </div>
  );
}
