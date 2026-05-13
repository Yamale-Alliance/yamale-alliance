import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { getDepositStatus, isDepositCompleted } from "@/lib/pawapay";
import { getCompletedLomiCheckoutMetadata, pollCompletedLomiCheckoutMetadata } from "@/lib/lomi-checkout";
import { getSupabaseServer } from "@/lib/supabase/server";
import { LOMI_PAYG_AI_QUERY_SESSION_COOKIE } from "@/lib/lomi-payg-ai-query-cookie";

/**
 * After pawaPay redirect: confirm pay-as-you-go AI query payment from session_id and record purchase.
 * After Lomi redirect: use `from_lomi_cookie: true` (session id is stored in an HttpOnly cookie at checkout creation).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const fromLomiCookie = body.from_lomi_cookie === true;
    let sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
    const placeholder =
      sessionId === "{CHECKOUT_SESSION_ID}" || decodeURIComponent(sessionId) === "{CHECKOUT_SESSION_ID}";
    if (placeholder) {
      sessionId = "";
    }

    if ((!sessionId || sessionId.length === 0) && fromLomiCookie) {
      const jar = await cookies();
      sessionId = jar.get(LOMI_PAYG_AI_QUERY_SESSION_COOKIE)?.value?.trim() ?? "";
    }

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: fromLomiCookie ? "Checkout return expired or missing. Wait a moment and refresh, or open pricing to try again." : "session_id required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Webhook may have recorded the purchase before Lomi GET shows "completed".
    const { data: alreadyPurchased } = await (supabase.from("pay_as_you_go_purchases") as any)
      .select("id")
      .eq("user_id", userId)
      .eq("item_type", "ai_query")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (alreadyPurchased) {
      const res = NextResponse.json({
        ok: true,
        kind: "payg_ai_query",
        recorded: true,
        purchaseId: alreadyPurchased.id,
      });
      res.cookies.set(LOMI_PAYG_AI_QUERY_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }

    let resolvedKind: string | undefined;

    const lomiMd = fromLomiCookie
      ? await pollCompletedLomiCheckoutMetadata(sessionId)
      : await getCompletedLomiCheckoutMetadata(sessionId);
    if (lomiMd) {
      const mdUserId = String(lomiMd.clerk_user_id || "").trim();
      if (mdUserId.length > 0 && mdUserId !== userId) {
        return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
      }
      // Some Lomi accounts omit metadata fields on immediate read-after-redirect.
      // For this endpoint we only confirm AI PAYG, so default to payg_ai_query on cookie-based Lomi return.
      resolvedKind = String(lomiMd.kind || "").trim() || (fromLomiCookie ? "payg_ai_query" : "");
    } else {
      const deposit = await getDepositStatus(sessionId);
      if (!deposit || !isDepositCompleted(deposit.status)) {
        return NextResponse.json(
          {
            error:
              "Payment not completed yet. Wait a few seconds and refresh this page, or open AI Research again from the menu.",
          },
          { status: 409 }
        );
      }

      const clerkUserId = deposit.metadata?.clerk_user_id;
      if (clerkUserId !== userId) {
        return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
      }

      resolvedKind = deposit.metadata?.kind;
    }

    if (resolvedKind !== "payg_ai_query") {
      return NextResponse.json({ error: "Not an AI query purchase session" }, { status: 400 });
    }

    const { data: existing, error: checkError } = await (supabase.from("pay_as_you_go_purchases") as any)
      .select("id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing purchase:", checkError);
    }

    if (!existing) {
      const { data: inserted, error: insertError } = await (supabase.from("pay_as_you_go_purchases") as any)
        .insert({
          user_id: userId,
          item_type: "ai_query",
          quantity: 1,
          stripe_session_id: sessionId,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting pay-as-you-go purchase:", insertError);
        return NextResponse.json({ error: "Failed to record purchase", details: insertError.message }, { status: 500 });
      }

      console.log("Pay-as-you-go AI query purchase recorded:", inserted);
    } else {
      console.log("Pay-as-you-go purchase already exists for session:", sessionId);
    }

    const { data: verify } = await (supabase.from("pay_as_you_go_purchases") as any)
      .select("id, quantity")
      .eq("user_id", userId)
      .eq("item_type", "ai_query")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    const res = NextResponse.json({
      ok: true,
      kind: "payg_ai_query",
      recorded: !!verify,
      purchaseId: verify?.id,
    });
    res.cookies.set(LOMI_PAYG_AI_QUERY_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    console.error("AI query confirm payment error:", err);
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
