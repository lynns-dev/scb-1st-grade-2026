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
};

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </svg>
  );
}

export default function BottomNav({ isAdmin }) {
  const pathname = usePathname();

  const items = [
    { href: "/home", label: "Home", icon: "home" },
    { href: "/calendar", label: "Calendar", icon: "calendar" },
    { href: "/chat", label: "Chat", icon: "chat" },
  ];

  if (isAdmin) {
    items.push({ href: "/admin", label: "Admin", icon: "admin" });
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur safe-bottom">
      <div className={`mx-auto grid max-w-sm ${items.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {items.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                active ? "text-brand-600" : "text-slate-400"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
