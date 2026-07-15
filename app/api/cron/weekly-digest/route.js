import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDigestEmail } from "@/lib/digestEmail";
import { withApiError } from "@/lib/apiError";

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Triggered weekly by Vercel Cron (see vercel.json). Vercel automatically
// sends `Authorization: Bearer $CRON_SECRET` on cron-triggered requests when
// CRON_SECRET is set, so we just check that — this also lets you trigger a
// digest manually (e.g. with curl) using the same secret while testing.
export const GET = withApiError(async (request) => {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const weekStart = startOfWeek(new Date()).toISOString().slice(0, 10);
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [{ data: reminders }, { data: events }, { data: profiles }] = await Promise.all([
    admin
      .from("reminders")
      .select("title, body")
      .gte("week_of", weekStart)
      .order("created_at", { ascending: false }),
    admin
      .from("events")
      .select("title, start_at, all_day")
      .gte("start_at", now.toISOString())
      .lte("start_at", weekAhead.toISOString())
      .order("start_at", { ascending: true }),
    admin.from("profiles").select("email"),
  ]);

  const recipients = (profiles || []).map((p) => p.email).filter(Boolean);

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: "No recipients yet" });
  }

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json(
      { error: "Email isn't configured yet (RESEND_API_KEY / RESEND_FROM_EMAIL)" },
      { status: 503 }
    );
  }

  const { html, text } = buildDigestEmail({
    reminders: reminders || [],
    events: events || [],
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const subject = `This week in 1st grade — ${(reminders || []).length} reminder${
    (reminders || []).length === 1 ? "" : "s"
  }, ${(events || []).length} upcoming event${(events || []).length === 1 ? "" : "s"}`;

  const batches = [];
  for (let i = 0; i < recipients.length; i += 100) {
    batches.push(recipients.slice(i, i + 100));
  }

  let sent = 0;
  for (const batch of batches) {
    const { error } = await resend.batch.send(
      batch.map((to) => ({
        from: process.env.RESEND_FROM_EMAIL,
        to,
        subject,
        html,
        text,
      }))
    );
    if (!error) sent += batch.length;
  }

  return NextResponse.json({ ok: true, sent, total: recipients.length });
});
