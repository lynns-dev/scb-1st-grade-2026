"use client";

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function Avatar({ src, name, size = 40, className = "rounded-full" }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || "Avatar"}
        style={style}
        className={`flex-none object-cover ${className}`}
      />
    );
  }

  return (
    <div
      style={style}
      className={`flex flex-none items-center justify-center bg-brand-100 font-semibold text-brand-600 ${className}`}
    >
      {initials(name)}
    </div>
  );
}
