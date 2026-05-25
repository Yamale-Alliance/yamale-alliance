/** Parse `Query log: <uuid>` from auto-flag `issue_details` text. */
export function parseQueryLogIdFromIssueDetails(issueDetails: string | null | undefined): string | null {
  if (!issueDetails?.trim()) return null;
  const m = issueDetails.match(/Query log:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m?.[1] ?? null;
}
