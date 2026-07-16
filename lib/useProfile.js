"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Loads the signed-in user's full profile row for client components.
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
        .select(
          "id, email, full_name, phone, avatar_url, role, family_id, families ( child_name, child_avatar_url )"
        )
        .eq("id", user.id)
        .single();

      if (active) {
        setProfile(
          data && {
            ...data,
            child_name: data.families?.child_name || null,
            child_avatar_url: data.families?.child_avatar_url || null,
          }
        );
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
