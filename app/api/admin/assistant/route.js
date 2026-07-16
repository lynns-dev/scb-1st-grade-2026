import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { tools, buildExecutor } from "@/lib/assistantTools";
import { withApiError } from "@/lib/apiError";

const MODEL = "claude-sonnet-5";
const MAX_TURNS = 6;

const SYSTEM_PROMPT = `You are the classroom assistant for "SCB 1st Grade 2026". You help the room
parent (an admin, not a developer) manage weekly reminders and calendar events for the
other families by chatting with her in plain English. She is not technical — respond
conversationally, confirm what you did in a short sentence, and never mention tools,
JSON, or ids unless she asks for them directly.

Today's date is ${new Date().toDateString()}. Resolve relative dates ("next Friday",
"in two weeks") against that. When she asks to change or remove something and you
aren't sure which item she means, use the list tools first and ask her to confirm
before deleting anything. Keep reminders short and parent-friendly. You only manage
reminders and events — you have no access to parent accounts, chat messages, or
anything outside this classroom app.

Reminders can be scheduled ahead of time: create_reminder's publishAt argument controls
when it goes live. If she just says what to post, post it immediately (omit publishAt).
If she says something like "schedule this for Monday" or "don't post this until next
week," set publishAt to that date/time instead — it'll stay hidden from parents and
won't be emailed or pushed until then. Note in your reply when something is scheduled
rather than posted right away, so she doesn't think you forgot.`;

export const POST = withApiError(async (request) => {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "The assistant isn't configured yet — ask your developer to set ANTHROPIC_API_KEY." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const message = body?.message?.trim();
  const history = Array.isArray(body?.history) ? body.history : [];

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const adminClient = createAdminClient();
  const execute = buildExecutor(adminClient, auth.profile.id);

  const messages = [...history, { role: "user", content: message }];
  const actions = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      const reply = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      return NextResponse.json({ reply, actions, history: messages });
    }

    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const result = await execute(block.name, block.input || {});
      actions.push({ tool: block.name, input: block.input, result });
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return NextResponse.json({
    reply: "I made some updates but ran out of steps to fully confirm — mind checking the reminders and calendar lists?",
    actions,
    history: messages,
  });
});
