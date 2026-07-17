export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatEventDate(iso, allDay) {
  const d = new Date(iso);
  const opts = allDay
    ? { weekday: "short", month: "short", day: "numeric" }
    : { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  return d.toLocaleString("en-US", opts);
}

// Builds the weekly digest email. Kept as plain, readable HTML — no external
// email-template library needed for something this simple.
export function buildDigestEmail({ reminders, events, appUrl }) {
  const reminderRows = reminders.length
    ? reminders
        .map(
          (r) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eef0f8;">
          <div style="font-weight:600;color:#1c2140;">${escapeHtml(r.title)}</div>
          ${r.body ? `<div style="color:#5b6178;font-size:14px;margin-top:2px;">${escapeHtml(r.body)}</div>` : ""}
        </td>
      </tr>`
        )
        .join("")
    : `<tr><td style="padding:10px 0;color:#8a8fa3;">No reminders posted this week.</td></tr>`;

  const eventRows = events.length
    ? events
        .map(
          (e) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eef0f8;">
          <div style="font-weight:600;color:#1c2140;">${e.event_type === "birthday" ? "🎂 " : ""}${escapeHtml(e.title)}</div>
          <div style="color:#5b6178;font-size:14px;margin-top:2px;">${formatEventDate(e.start_at, e.all_day)}${e.location ? ` · ${escapeHtml(e.location)}` : ""}</div>
        </td>
      </tr>`
        )
        .join("")
    : `<tr><td style="padding:10px 0;color:#8a8fa3;">Nothing new on the calendar.</td></tr>`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;color:#1c2140;margin:0 0 4px;">This week in 1st grade</h1>
    <p style="color:#8a8fa3;font-size:13px;margin:0 0 20px;">Weekly digest from your classroom app</p>

    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.02em;color:#8a8fa3;margin:0 0 4px;">Reminders</h2>
    <table width="100%" cellpadding="0" cellspacing="0">${reminderRows}</table>

    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.02em;color:#8a8fa3;margin:24px 0 4px;">Coming up</h2>
    <table width="100%" cellpadding="0" cellspacing="0">${eventRows}</table>

    ${
      appUrl
        ? `<p style="margin-top:28px;"><a href="${escapeHtml(appUrl)}" style="background:#4f7eae;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600;display:inline-block;">Open the app</a></p>`
        : ""
    }
  </div>`;

  const text = [
    "This week in 1st grade",
    "",
    "Reminders:",
    ...(reminders.length ? reminders.map((r) => `- ${r.title}${r.body ? `: ${r.body}` : ""}`) : ["(none)"]),
    "",
    "Coming up:",
    ...(events.length
      ? events.map((e) => `- ${e.title} (${formatEventDate(e.start_at, e.all_day)})`)
      : ["(none)"]),
  ].join("\n");

  return { html, text };
}
