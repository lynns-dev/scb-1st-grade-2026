// Uploads a profile picture to the `avatars` Storage bucket under the
// user's own folder (storage RLS policies only allow writes inside
// `${auth.uid()}/...`, see supabase/schema.sql) and returns its public URL.
export async function uploadAvatar(supabase, userId, file) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600" });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  return publicUrl;
}
