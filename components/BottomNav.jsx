"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  home: (
    <path d="M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  chat: (
    <path d="M4 4h16v12H8l-4 4V4Z" />
  ),
  admin: (
    <>
      <path d="M12 3.5 14.5 9l6 .6-4.5 4 1.3 5.9L12 16.7l-5.3 2.8L8 13.6l-4.5-4 6-.6Z" />
      <circle cx="12" cy="11" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  directory: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6M16 4.5c1.7.4 3 2 3 3.9s-1.3 3.5-3 3.9M20.5 20c0-2.8-1.8-5.1-4.2-5.8" />
    </>
  ),
};

// "The Village" brand: one blueberry tone across the row, with the Admin
// tab picked out in honey (gold) — a star, matching the room admin's
// special role rather than being just another item in the row.
const COLORS = {
  home: { fg: "text-brand-600", bg: "bg-brand-100" },
  calendar: { fg: "text-brand-600", bg: "bg-brand-100" },
  chat: { fg: "text-brand-600", bg: "bg-brand-100" },
  directory: { fg: "text-brand-600", bg: "bg-brand-100" },
  admin: { fg: "text-accent-600", bg: "bg-accent-100" },
};

const GRID_COLS = { 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" };

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </svg>
  );
}

export default function BottomNav({ isAdmin, unreadCount = 0 }) {
  const pathname = usePathname();

  const items = [
    { href: "/home", label: "Home", icon: "home" },
    { href: "/calendar", label: "Calendar", icon: "calendar" },
    { href: "/chat", label: "Chat", icon: "chat" },
    { href: "/directory", label: "Directory", icon: "directory" },
  ];

  if (isAdmin) {
    items.push({ href: "/admin", label: "Admin", icon: "admin" });
  }

  const activeIndex = items.findIndex((item) => pathname?.startsWith(item.href));
  const activeColor = activeIndex >= 0 ? COLORS[items[activeIndex].icon] : null;

  return (
    <nav className="flex-none border-t border-slate-200 bg-white/95 backdrop-blur safe-bottom">
      <div className="relative mx-auto max-w-lg">
        {/* Shared highlight pill — slides left/right to sit under whichever
            tab is active, instead of each tab drawing its own static
            background. transform is relative to the pill's own width (set
            to one grid column via inline style), so translateX(N * 100%)
            always lands it exactly on column N regardless of item count. */}
        <div
          className="pointer-events-none absolute left-0 top-3 flex justify-center transition-transform duration-300 ease-out"
          style={{
            width: `${100 / items.length}%`,
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
            opacity: activeIndex >= 0 ? 1 : 0,
          }}
          aria-hidden="true"
        >
          <span
            className={`h-11 w-11 rounded-full transition-colors duration-300 ${activeColor?.bg || ""}`}
          />
        </div>

        <div className={`grid ${GRID_COLS[items.length] || "grid-cols-4"}`}>
          {items.map((item) => {
            const active = pathname?.startsWith(item.href);
            const color = COLORS[item.icon];
            return (
              /* active:scale-90 gives an immediate press response on tap
                 (scales down, then eases back on release via the same
                 transition) so the button feels responsive right away —
                 separate from the sliding highlight pill above, which only
                 reflects the currently active route. */
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-3 text-[11px] transition-all duration-150 ease-out active:scale-90 ${color.fg}`}
              >
                <span className="relative flex h-11 w-11 items-center justify-center">
                  <Icon name={item.icon} />
                  {item.icon === "chat" && unreadCount > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
                <span className={active ? "font-semibold" : "font-medium text-slate-500"}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
