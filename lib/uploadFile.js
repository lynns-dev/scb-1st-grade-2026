// Uploads a file to a public Storage bucket under the user's own folder
// (storage RLS policies only allow writes inside `${auth.uid()}/...` for
// both the `avatars` and `event-images` buckets — see supabase/schema.sql)
// and returns its public URL.
export async function uploadPublicFile(supabase, bucket, userId, file) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, cacheControl: "3600" });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return publicUrl;
}

export function uploadAvatar(supabase, userId, file) {
  return uploadPublicFile(supabase, "avatars", userId, file);
}

export function uploadChildPhoto(supabase, userId, file) {
  return uploadPublicFile(supabase, "avatars", userId, file);
}

export function uploadEventImage(supabase, userId, file) {
  return uploadPublicFile(supabase, "event-images", userId, file);
}

export function uploadChatImage(supabase, userId, file) {
  return uploadPublicFile(supabase, "chat-images", userId, file);
}

export function uploadReminderAttachment(supabase, userId, file) {
  return uploadPublicFile(supabase, "reminder-attachments", userId, file);
}

export function uploadPhoto(supabase, userId, file) {
  return uploadPublicFile(supabase, "photos", userId, file);
}
