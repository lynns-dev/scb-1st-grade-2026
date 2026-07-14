import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";

// Verifies the caller's session against Supabase and loads their profile row.
// Use at the top of any API route that needs to know who's asking and whether
// they're the room admin, since RLS alone doesn't gate our service-role writes.
export async function requireProfile() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not signed in", status: 401 };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "No profile found", status: 401 };
  }

  return { profile };
}

export async function requireAdmin() {
  const result = await requireProfile();
  if (result.error) return result;
  if (result.profile.role !== "admin") {
    return { error: "Admin access required", status: 403 };
  }
  return result;
}
