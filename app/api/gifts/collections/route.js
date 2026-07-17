import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";

export const POST = withApiError(async (request) => {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const title = body?.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const targetCents =
    body?.targetAmount != null && body.targetAmount !== ""
      ? Math.round(Number(body.targetAmount) * 100)
      : null;
  if (targetCents != null && (!Number.isFinite(targetCents) || targetCents <= 0)) {
    return NextResponse.json({ error: "Target amount must be a positive number" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: payoutAccount } = await admin
    .from("payout_accounts")
    .select("id, payouts_enabled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payoutAccount || !payoutAccount.payouts_enabled) {
    return NextResponse.json(
      { error: "Connect a payout account before starting a gift collection." },
      { status: 400 }
    );
  }

  const { data, error } = await admin
    .from("gift_collections")
    .insert({
      title,
      note: body?.note?.trim() || null,
      target_cents: targetCents,
      payout_account_id: payoutAccount.id,
      created_by: auth.profile.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ collection: data });
});
