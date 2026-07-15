// Tool definitions + executors for the admin AI assistant. Scope is
// deliberately narrow — it can only read/write the reminders and events
// tables for this one classroom, nothing else (no user management, no
// deleting accounts, no arbitrary queries).

export const tools = [
  {
    name: "list_reminders",
    description:
      "List existing weekly reminders, most recent first. Use this to find a reminder's id before updating or deleting it.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max rows to return, default 20" },
      },
    },
  },
  {
    name: "create_reminder",
    description:
      "Post a new quick weekly reminder that parents see on their home screen and get emailed in the weekly digest.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short reminder headline" },
        body: { type: "string", description: "Optional longer detail" },
        weekOf: {
          type: "string",
          description: "ISO date (YYYY-MM-DD) for the Monday of the week this reminder applies to. Defaults to the current week.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "delete_reminder",
    description: "Delete a reminder by id.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "list_events",
    description:
      "List calendar events from today onward, soonest first. Use this to find an event's id before updating or deleting it.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max rows to return, default 20" },
      },
    },
  },
  {
    name: "create_event",
    description: "Add a new event to the shared classroom calendar.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        location: { type: "string", description: "Optional location, e.g. a room or address." },
        startAt: {
          type: "string",
          description: "ISO 8601 date-time (or date, for all-day events) the event starts.",
        },
        endAt: { type: "string", description: "Optional ISO 8601 end date-time." },
        allDay: { type: "boolean" },
      },
      required: ["title", "startAt"],
    },
  },
  {
    name: "delete_event",
    description: "Delete a calendar event by id.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
];

export function buildExecutor(adminClient, createdBy) {
  return async function execute(name, input) {
    switch (name) {
      case "list_reminders": {
        const { data, error } = await adminClient
          .from("reminders")
          .select("id, title, body, week_of, created_at")
          .order("created_at", { ascending: false })
          .limit(input.limit || 20);
        if (error) return { error: error.message };
        return { reminders: data };
      }

      case "create_reminder": {
        const { data, error } = await adminClient
          .from("reminders")
          .insert({
            title: input.title,
            body: input.body || null,
            week_of: input.weekOf || new Date().toISOString().slice(0, 10),
            created_by: createdBy,
          })
          .select()
          .single();
        if (error) return { error: error.message };
        return { reminder: data };
      }

      case "delete_reminder": {
        const { error } = await adminClient.from("reminders").delete().eq("id", input.id);
        if (error) return { error: error.message };
        return { ok: true };
      }

      case "list_events": {
        const { data, error } = await adminClient
          .from("events")
          .select("id, title, description, location, event_type, start_at, end_at, all_day")
          .gte("start_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order("start_at", { ascending: true })
          .limit(input.limit || 20);
        if (error) return { error: error.message };
        return { events: data };
      }

      case "create_event": {
        const { data, error } = await adminClient
          .from("events")
          .insert({
            title: input.title,
            description: input.description || null,
            location: input.location || null,
            start_at: input.startAt,
            end_at: input.endAt || null,
            all_day: !!input.allDay,
            created_by: createdBy,
          })
          .select()
          .single();
        if (error) return { error: error.message };
        return { event: data };
      }

      case "delete_event": {
        const { error } = await adminClient.from("events").delete().eq("id", input.id);
        if (error) return { error: error.message };
        return { ok: true };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  };
}
