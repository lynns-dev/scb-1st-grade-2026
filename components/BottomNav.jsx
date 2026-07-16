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
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </>
  ),
  directory: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6M16 4.5c1.7.4 3 2 3 3.9s-1.3 3.5-3 3.9M20.5 20c0-2.8-1.8-5.1-4.2-5.8" />
    </>
  ),
};

// Each tab gets its own color, Brightwheel-style, instead of one uniform
// brand color — makes the row easier to scan at a glance.
const COLORS = {
  home: { fg: "#2563eb", bg: "#dbeafe" }, // blue
  calendar: { fg: "#0d9488", bg: "#ccfbf1" }, // teal
  chat: { fg: "#db2777", bg: "#fce7f3" }, // pink
  directory: { fg: "#7c3aed", bg: "#ede9fe" }, // violet
  admin: { fg: "#d97706", bg: "#fef3c7" }, // amber
};

const GRID_COLS = { 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" };

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur safe-bottom">
      <div className={`mx-auto grid max-w-lg ${GRID_COLS[items.length] || "grid-cols-4"}`}>
        {items.map((item) => {
          const active = pathname?.startsWith(item.href);
          const color = COLORS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors duration-200"
              style={{ color: color.fg }}
            >
              <span className="relative flex h-8 w-8 items-center justify-center">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200"
                  style={{ backgroundColor: active ? color.bg : "transparent" }}
                >
                  <Icon name={item.icon} />
                </span>
                {item.icon === "chat" && unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-500 px-1 text-[9px] font-bold text-white">
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
    </nav>
  );
}
