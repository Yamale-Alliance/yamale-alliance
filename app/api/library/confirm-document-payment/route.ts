import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDepositStatus, isDepositCompleted } from "@/lib/pawapay";
import { getCompletedLomiCheckoutMetadata } from "@/lib/lomi-checkout";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * After checkout redirect: ensure the document purchase row exists (and includes `law_id`)
 * even if the payment webhook is delayed. Idempotent on `stripe_session_id`.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = body.session_id as string | undefined;
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    let resolvedKind: string | undefined;
    let lawId: string | undefined;

    const lomiMd = await getCompletedLomiCheckoutMetadata(sessionId);
    if (lomiMd) {
      if (lomiMd.clerk_user_id !== userId) {
        return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
      }
      resolvedKind = lomiMd.kind;
      lawId = lomiMd.law_id?.trim() || undefined;
    } else {
      const deposit = await getDepositStatus(sessionId);
      if (!deposit || !isDepositCompleted(deposit.status)) {
        return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
      }

      const clerkUserId = deposit.metadata?.clerk_user_id;
      if (clerkUserId !== userId) {
        return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
      }

      resolvedKind = deposit.metadata?.kind;
      lawId = deposit.metadata?.law_id?.trim() || undefined;
    }

    if (resolvedKind !== "payg_document") {
      return NextResponse.json({ error: "Not a document purchase session" }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const { data: existing, error: checkError } = await (supabase.from("pay_as_you_go_purchases") as any)
      .select("id, law_id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (checkError) {
      console.error("confirm-document-payment check:", checkError);
    }

    if (!existing) {
      const { error: insertError } = await (supabase.from("pay_as_you_go_purchases") as any).insert({
        user_id: userId,
        item_type: "document",
        quantity: 1,
        stripe_session_id: sessionId,
        law_id: lawId ?? null,
      });

      if (insertError) {
        console.error("confirm-document-payment insert:", insertError);
        return NextResponse.json(
          { error: "Failed to record purchase", details: insertError.message },
          { status: 500 }
        );
      }
    } else if (lawId && !(existing as { law_id?: string | null }).law_id) {
      const { error: updateError } = await (supabase.from("pay_as_you_go_purchases") as any)
        .update({ law_id: lawId })
        .eq("id", (existing as { id: string }).id);

      if (updateError) {
        console.error("confirm-document-payment update law_id:", updateError);
      }
    }

    const { data: verify } = await (supabase.from("pay_as_you_go_purchases") as any)
      .select("id, law_id")
      .eq("user_id", userId)
      .eq("item_type", "document")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      kind: "payg_document",
      recorded: !!verify,
      law_id: (verify as { law_id?: string | null } | null)?.law_id ?? lawId ?? null,
    });
  } catch (err) {
    console.error("confirm-document-payment:", err);
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
