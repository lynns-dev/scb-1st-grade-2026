// Shared between the calendar form, home/calendar cards, and the email
// digest so the icon/label for each parent-postable invite type only lives
// in one place.
export const EVENT_TYPE_ICONS = {
  birthday: "🎂",
  playdate: "🛝",
  fun: "🎉",
};

export const INVITE_TYPES = [
  { id: "birthday", label: "Birthday", icon: "🎂", placeholder: "e.g. Emma's Birthday Party" },
  { id: "playdate", label: "Playdate", icon: "🛝", placeholder: "e.g. Playdate at the park" },
  { id: "fun", label: "Fun event", icon: "🎉", placeholder: "e.g. Pumpkin patch trip" },
];
