"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { useUnreadCounts } from "@/lib/useUnreadCounts";
import BottomNav from "./BottomNav";
import InstallPrompt from "./InstallPrompt";
import NotificationsPrompt from "./NotificationsPrompt";

export default function AppShell({ title, backHref, children }) {
  const router = useRouter();
  const { profile } = useProfile();
  const { total: unreadTotal } = useUnreadCounts();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // A fixed-position bottom nav visually detaches and "scrolls with" the
  // page during a touch scroll on iOS Safari (a long-standing WebKit quirk,
  // worse still in standalone/PWA mode) — so instead of overlaying a
  // position: fixed nav on a normally-scrolling document, the whole shell
  // is pinned to the viewport height with overflow hidden, and only <main>
  // scrolls internally. The header and nav are then just ordinary flex
  // items that never need to be "fixed" at all, which is what actually
  // keeps them pinned in place everywhere.
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex-none border-b border-slate-200 bg-white/95 backdrop-blur safe-top">
        <div className="mx-auto grid max-w-lg grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-4">
          <div className="flex min-w-0 items-center">
            {backHref && (
              <button
                onClick={() => router.push(backHref)}
                className="flex-none text-xl leading-none text-slate-400"
                aria-label="Back"
              >
                ‹
              </button>
            )}
          </div>
          <h1 className="truncate text-center text-lg font-bold text-slate-900">{title}</h1>
          <div className="flex justify-end">
            <button
              onClick={handleSignOut}
              className="flex-none text-xs font-medium text-slate-400"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-3 py-5">
          <InstallPrompt />
          <NotificationsPrompt />
          <div className="animate-fade-in">{children}</div>
        </div>
      </main>

      <BottomNav isAdmin={profile?.role === "admin"} unreadCount={unreadTotal} />
    </div>
  );
}
