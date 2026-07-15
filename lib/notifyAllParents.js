import { sendPushToUsers } from "@/lib/pushNotify";

// Shared by the manual reminder form and the Claude assistant's
// create_reminder tool — both want the same "tell everyone" push.
export async function notifyNewReminder(admin, { title, excludeUserId }) {
  const { data: profiles } = await admin.from("profiles").select("id");
  const ids = (profiles || []).map((p) => p.id);

  try {
    await sendPushToUsers(
      ids,
      { title: "New reminder", body: title, url: "/home" },
      { excludeUserId }
    );
  } catch {
    // Best-effort — the reminder itself already saved.
  }
}
