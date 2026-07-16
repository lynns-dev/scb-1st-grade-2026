// "The Village" mark: a single flat house silhouette — dusty blueberry
// background, warm honey house. Kept as one shared component so the app
// icon, login screen, and signup screen never drift out of sync.
export default function Logo({ size = 56, className = "" }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label="The Village"
      className={className}
    >
      <rect width="512" height="512" rx="112" className="fill-brand-500" />
      <path
        d="M150,296 L256,140 L362,296 L336,296 L336,396 L176,396 L176,296 Z"
        className="fill-accent-500"
      />
    </svg>
  );
}
