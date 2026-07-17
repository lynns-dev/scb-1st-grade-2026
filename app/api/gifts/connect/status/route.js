import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

// Any signed-in parent can check this — the "give a gift" flow needs to
// know whether it's even possible right now. Only ever returns booleans,
// never the underlying Stripe account id.
export const GET = withApiError(async () => {
  const auth = await requireProfile();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("payout_accounts")
    .select("id, stripe_account_id, charges_enabled, payouts_enabled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ connected: false, ready: false });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ connected: true, ready: false });
  }

  const stripe = getStripe();
  const remote = await stripe.accounts.retrieve(account.stripe_account_id);
  // Only `payouts_enabled` actually gates this app: the connected account
  // only ever receives transfers (see app/api/gifts/connect), it never
  // processes its own charges, so `charges_enabled` — which tracks the
  // card_payments capability we deliberately didn't request — isn't
  // relevant here and would otherwise permanently block "ready".
  const ready = Boolean(remote.payouts_enabled);

  if (remote.charges_enabled !== account.charges_enabled || remote.payouts_enabled !== account.payouts_enabled) {
    await admin
      .from("payout_accounts")
      .update({ charges_enabled: remote.charges_enabled, payouts_enabled: remote.payouts_enabled })
      .eq("id", account.id);
  }

  return NextResponse.json({ connected: true, ready });
});
