"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Loads the signed-in user's profile row (name, role) for client components.
// Pages are already gated by middleware, so by the time this runs there's a
// session — this just fills in who they are and whether they're the admin.
export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (active) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, child_name, role")
        .eq("id", user.id)
        .single();

      if (active) {
        setProfile(data);
        setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return { profile, loading };
}
