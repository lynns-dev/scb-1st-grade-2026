import { escapeHtml } from "./digestEmail";

// The invited family's signup link already has both the classroom invite
// code and (if they're joining an existing family group) the family code
// baked in as query params, so signing up is close to one tap — name,
// email, password, submit.
export function buildInviteEmail({ signupUrl }) {
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;color:#1c2140;margin:0 0 4px;">You're invited to The Village</h1>
    <p style="color:#5b6178;font-size:14px;line-height:1.5;margin:0 0 20px;">
      Our classroom's parent app — reminders, the shared calendar, room chat,
      and a way to chip in for teacher gifts, all in one place.
    </p>
    <p style="margin-top:8px;">
      <a href="${escapeHtml(signupUrl)}" style="background:#4f7eae;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600;display:inline-block;">
        Join the classroom
      </a>
    </p>
    <p style="color:#8a8fa3;font-size:12px;margin-top:20px;">
      If the button doesn't work, copy and paste this link:<br />
      <a href="${escapeHtml(signupUrl)}" style="color:#4f7eae;">${escapeHtml(signupUrl)}</a>
    </p>
  </div>`;

  const text = [
    "You're invited to The Village",
    "",
    "Our classroom's parent app — reminders, the shared calendar, room chat,",
    "and a way to chip in for teacher gifts, all in one place.",
    "",
    `Join here: ${signupUrl}`,
  ].join("\n");

  return { html, text };
}
