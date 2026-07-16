// Shared by InstallPrompt and NotificationsPrompt — both need to know
// whether we're already running as an installed home-screen app, and
// whether we're on iOS (where Web Push only works once installed).
export function isStandalone() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true)
  );
}

export function isIOS() {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}
