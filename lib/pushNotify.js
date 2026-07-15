import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  if (
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY ||
    !process.env.VAPID_SUBJECT
  ) {
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}

// Sends a push notification to every subscribed device for the given
// users (skipping excludeUserId, typically whoever triggered the event).
// Silently does nothing if VAPID keys aren't configured — push is an
// optional enhancement, not something that should ever break a reminder
// or chat message from being saved.
export async function sendPushToUsers(userIds, payload, { excludeUserId } = {}) {
  if (!ensureConfigured()) return;

  const targetIds = userIds.filter((id) => id !== excludeUserId);
  if (targetIds.length === 0) return;

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", targetIds);

  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);
  const stale = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          stale.push(sub.id);
        }
      }
    })
  );

  if (stale.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", stale);
  }
}
