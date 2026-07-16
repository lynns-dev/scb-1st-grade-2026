import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyNewReminder } from "@/lib/notifyAllParents";
import { withApiError } from "@/lib/apiError";

// Triggered daily by Vercel Cron (see vercel.json). Scheduled reminders
// (publish_at in the future when created) are already invisible to parents
// until publish_at passes — that part just falls out of the read queries in
// app/home and the weekly digest. This route's only job is the push
// notification: find reminders whose publish_at has arrived but haven't
// been notified about yet, and send those out.
//
// Note: Vercel's free/Hobby plan only runs cron jobs once a day, so a
// reminder scheduled for e.g. 2pm may not actually push until the next
// time this runs — it'll still *appear* in the app right at 2pm, the push
// just trails by up to a day on that plan. Upgrade to Pro for tighter
// timing if that matters.
export const GET = withApiError(async (request) => {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: due } = await admin
    .from("reminders")
    .select("id, title, created_by")
    .lte("publish_at", new Date().toISOString())
    .is("notified_at", null);

  for (const reminder of due || []) {
    try {
      await notifyNewReminder(admin, {
        title: reminder.title,
        excludeUserId: reminder.created_by,
      });
    } catch {
      // Best-effort — still mark it notified below so we don't retry forever.
    }
    await admin
      .from("reminders")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", reminder.id);
  }

  return NextResponse.json({ ok: true, published: (due || []).length });
});
