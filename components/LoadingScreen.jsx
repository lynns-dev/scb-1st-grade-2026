import Logo from "./Logo";

// Shown only for the very first profile fetch of the session (see
// lib/useProfile.js's hasLoadedOnce flag) — covers the moment where, without
// this, the page would briefly render with nothing to show yet (e.g. Home's
// greeting falling back to "there" before the real name arrives), which
// reads as broken rather than as loading.
export default function LoadingScreen() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-brand-50">
      <Logo size={72} className="animate-bounce-soft rounded-2xl shadow-card" />
      <p className="text-sm font-medium text-brand-600">The Village</p>
    </div>
  );
}
