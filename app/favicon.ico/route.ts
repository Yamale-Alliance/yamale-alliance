import { fetchBrandingFaviconResponse } from "@/lib/site-favicon";

export const dynamic = "force-dynamic";

/** Serves admin-uploaded favicon at /favicon.ico. */
export async function GET() {
  const branded = await fetchBrandingFaviconResponse();
  if (branded) return branded;

  return new Response(null, {
    status: 302,
    headers: { Location: "/icon" },
  });
}
