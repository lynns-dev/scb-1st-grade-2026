"use client";

// Single-column accordion: one full-width button per section, tap to open
// its content in place — only one section's content shows at a time, so on
// a small screen you're not scrolling past several forms/lists to find the
// one you want. Shared between Admin and Directory.
export default function AccordionSection({ id, title, icon, activeId, onToggle, children }) {
  const isOpen = activeId === id;

  return (
    <div className="mb-3">
      <button
        onClick={() => onToggle(isOpen ? null : id)}
        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left shadow-card transition-colors ${
          isOpen ? "bg-brand-500 text-white" : "bg-white text-slate-900"
        }`}
      >
        <span className="text-lg leading-none">{icon}</span>
        <span className="flex-1 text-sm font-semibold">{title}</span>
        <span className={`text-lg leading-none transition-transform ${isOpen ? "rotate-180" : ""}`}>
          ⌄
        </span>
      </button>
      {isOpen && <div className="mt-2 animate-fade-in-item">{children}</div>}
    </div>
  );
}
