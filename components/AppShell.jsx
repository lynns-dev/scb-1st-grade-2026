"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import BottomNav from "./BottomNav";

export default function AppShell({ title, children }) {
  const router = useRouter();
  const { profile } = useProfile();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur safe-top">
        <div className="mx-auto flex max-w-sm items-center justify-between px-5 py-4">
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          <button
            onClick={handleSignOut}
            className="text-xs font-medium text-slate-400"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-sm px-5 py-5">{children}</main>

      <BottomNav isAdmin={profile?.role === "admin"} />
    </div>
  );
}
