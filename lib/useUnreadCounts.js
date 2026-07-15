"use client";

import { useEffect, useState } from "react";

// Fetches unread chat counts once per mount. Every page renders its own
// <AppShell>, so this naturally re-fetches on every navigation — good
// enough freshness without a persistent subscription.
export function useUnreadCounts() {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let active = true;

    fetch("/api/chat-rooms/unread")
      .then((res) => (res.ok ? res.json() : { counts: {} }))
      .then((data) => {
        if (active) setCounts(data.counts || {});
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return { counts, total };
}
