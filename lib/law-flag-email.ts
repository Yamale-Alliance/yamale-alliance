import { lawFlagCategoryLabel } from "@/lib/law-flag-categories";
import { sendTransactionalEmail } from "@/lib/support-email";

export type LawFlagEmailPayload = {
  flagId: string;
  lawId: string;
  lawTitle: string;
  lawCountry: string | null;
  lawCategory: string | null;
  issueCategory: string;
  issueDetails: string | null;
  userName: string | null;
  userEmail: string | null;
};

/**
 * Notify admin inbox when a user flags a law. Uses Resend when RESEND_API_KEY + EMAIL_FROM
 * + SUPPORT_INBOX_EMAIL are set (same as support tickets).
 */
export async function notifyAdminLawFlag(params: LawFlagEmailPayload): Promise<void> {
  const inbox = process.env.SUPPORT_INBOX_EMAIL?.trim();
  if (!inbox) {
    console.warn("[law-flag-email] SUPPORT_INBOX_EMAIL unset — admin not emailed.");
    return;
  }

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "";
  const adminLink = base ? `${base}/admin-panel/law-flags/${params.flagId}` : "";
  const libraryLink = base ? `${base}/library/${params.lawId}` : "";
  const categoryLabel = lawFlagCategoryLabel(params.issueCategory);
  const scope = [params.lawCountry, params.lawCategory].filter(Boolean).join(" · ");

  await sendTransactionalEmail({
    to: inbox,
    subject: `[Law flag] ${params.lawTitle}`,
    html: `
      <p><strong>New law flag</strong></p>
      <p><strong>Law:</strong> ${escapeHtml(params.lawTitle)}${scope ? ` (${escapeHtml(scope)})` : ""}</p>
      <p><strong>Issue:</strong> ${escapeHtml(categoryLabel)}</p>
      <p><strong>From:</strong> ${escapeHtml(params.userName || "User")}${
        params.userEmail ? ` &lt;${escapeHtml(params.userEmail)}&gt;` : ""
      }</p>
      ${
        params.issueDetails
          ? `<p><strong>Details:</strong></p><pre style="white-space:pre-wrap;font-family:sans-serif;">${escapeHtml(params.issueDetails.slice(0, 4000))}</pre>`
          : ""
      }
      ${libraryLink ? `<p><a href="${libraryLink}">View law in library</a></p>` : ""}
      ${adminLink ? `<p><a href="${adminLink}">Open flag in admin panel</a></p>` : ""}
    `,
    text: [
      `New law flag: ${params.lawTitle}`,
      scope ? `Scope: ${scope}` : "",
      `Issue: ${categoryLabel}`,
      `From: ${params.userName || "User"}${params.userEmail ? ` <${params.userEmail}>` : ""}`,
      params.issueDetails ? `\n${params.issueDetails.slice(0, 4000)}` : "",
      libraryLink ? `\nLibrary: ${libraryLink}` : "",
      adminLink ? `\nAdmin: ${adminLink}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
