export type ConfirmDayPassPaymentResult = {
  ok: boolean;
  pending?: boolean;
  error?: string;
  expiresAt?: string;
};

/** Confirm pawaPay / Lomi day pass after redirect. Retries once when deposit is still pending. */
export async function confirmDayPassPayment(sessionId: string): Promise<ConfirmDayPassPaymentResult> {
  const body = { session_id: sessionId };

  const confirmOnce = () =>
    fetch("/api/payments/confirm-day-pass", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let res = await confirmOnce();
  let data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    pending?: boolean;
    error?: string;
    expiresAt?: string;
  };

  if (!res.ok && res.status === 503 && data.pending) {
    await new Promise((r) => setTimeout(r, 2500));
    res = await confirmOnce();
    data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      pending?: boolean;
      error?: string;
      expiresAt?: string;
    };
  }

  if (res.ok && data.ok) {
    return { ok: true, expiresAt: data.expiresAt };
  }

  return {
    ok: false,
    pending: data.pending,
    error: data.error ?? "Payment not completed",
  };
}
