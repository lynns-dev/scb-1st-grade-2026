import { NextResponse } from "next/server";

// Every API route is wrapped in this so a thrown error (a missing env var,
// a Supabase/Anthropic/Resend client failing to construct, etc.) always
// comes back as JSON. Without it, an unhandled exception falls through to
// the platform's own HTML error page, and `await res.json()` on the client
// blows up with "Unexpected token '<'" instead of showing the real cause.
export function withApiError(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Unexpected server error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
