function pad(n) {
  return String(n).padStart(2, "0");
}

function dateOnly(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function dateTime(d) {
  return (
    dateOnly(d) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

// Builds a "quick add" Google Calendar link — no OAuth/API needed, just a
// pre-filled event form Google opens for the parent to confirm and save.
export function googleCalendarUrl({ title, description, location, startAt, endAt, allDay }) {
  const start = new Date(startAt);
  let dates;

  if (allDay) {
    const end = endAt ? new Date(endAt) : new Date(start.getTime() + 24 * 60 * 60 * 1000);
    dates = `${dateOnly(start)}/${dateOnly(end)}`;
  } else {
    const end = endAt ? new Date(endAt) : new Date(start.getTime() + 60 * 60 * 1000);
    dates = `${dateTime(start)}/${dateTime(end)}`;
  }

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates,
  });
  if (description) params.set("details", description);
  if (location) params.set("location", location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
