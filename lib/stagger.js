// Returns an inline style for a staggered entrance animation. Caps the delay
// after a handful of items so a long list (chat history, etc.) doesn't make
// the last rows wait seconds to appear — they just join the leading edge.
export function staggerStyle(index, { step = 40, max = 8 } = {}) {
  return { animationDelay: `${Math.min(index, max) * step}ms` };
}
