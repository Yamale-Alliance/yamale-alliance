import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export function isSupportEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function sendTransactionalEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!resend || !process.env.EMAIL_FROM?.trim()) {
    console.warn("[support-email] RESEND_API_KEY or EMAIL_FROM unset — email not sent.");
    return { ok: false, skipped: true };
  }
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM.trim(),
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[support-email]", msg);
    return { ok: false, error: msg };
  }
}

export async function notifyAdminNewTicket(params: {
  ticketId: string;
  title: string;
  contactName: string;
  contactEmail: string;
  descriptionPreview: string;
}): Promise<void> {
  const inbox = process.env.SUPPORT_INBOX_EMAIL?.trim();
  if (!inbox) {
    console.warn("[support-email] SUPPORT_INBOX_EMAIL unset — admin not notified.");
    return;
  }
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "";
  const adminLink = base ? `${base}/admin-panel/support/${params.ticketId}` : "";
  await sendTransactionalEmail({
    to: inbox,
    subject: `[Support] ${params.title}`,
    html: `
      <p><strong>New support ticket</strong></p>
      <p><strong>Title:</strong> ${escapeHtml(params.title)}</p>
      <p><strong>From:</strong> ${escapeHtml(params.contactName)} &lt;${escapeHtml(params.contactEmail)}&gt;</p>
      <p><strong>Preview:</strong></p>
      <pre style="white-space:pre-wrap;font-family:sans-serif;">${escapeHtml(params.descriptionPreview.slice(0, 2000))}</pre>
      ${adminLink ? `<p><a href="${adminLink}">Open in admin panel</a></p>` : ""}
    `,
    text: `New ticket: ${params.title}\nFrom: ${params.contactName} <${params.contactEmail}>\n\n${params.descriptionPreview.slice(0, 2000)}${adminLink ? `\n\nAdmin: ${adminLink}` : ""}`,
  });
}

export async function notifyUserTicketReply(params: {
  to: string;
  ticketTitle: string;
  excerpt: string;
  ticketId: string;
}): Promise<void> {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "";
  const link = base ? `${base}/account/support/${params.ticketId}` : "";
  await sendTransactionalEmail({
    to: params.to,
    subject: `Re: ${params.ticketTitle} — Yamalé support`,
    html: `
      <p>You have a new reply on your support request <strong>${escapeHtml(params.ticketTitle)}</strong>.</p>
      <blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:12px 0;">${escapeHtml(params.excerpt.slice(0, 1500))}</blockquote>
      ${link ? `<p><a href="${link}">View ticket</a></p>` : ""}
    `,
    text: `New reply on: ${params.ticketTitle}\n\n${params.excerpt.slice(0, 1500)}${link ? `\n\n${link}` : ""}`,
  });
}

export async function notifyAdminUserReply(params: {
  ticketId: string;
  title: string;
  userEmail: string;
  excerpt: string;
}): Promise<void> {
  const inbox = process.env.SUPPORT_INBOX_EMAIL?.trim();
  if (!inbox) return;
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "";
  const adminLink = base ? `${base}/admin-panel/support/${params.ticketId}` : "";
  await sendTransactionalEmail({
    to: inbox,
    subject: `[Support] User replied: ${params.title}`,
    html: `
      <p><strong>User replied</strong> on ticket <strong>${escapeHtml(params.title)}</strong> (${escapeHtml(params.userEmail)}).</p>
      <pre style="white-space:pre-wrap;">${escapeHtml(params.excerpt.slice(0, 2000))}</pre>
      ${adminLink ? `<p><a href="${adminLink}">Open ticket</a></p>` : ""}
    `,
    text: `User replied on ${params.title}\n${params.excerpt.slice(0, 2000)}${adminLink ? `\n${adminLink}` : ""}`,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
