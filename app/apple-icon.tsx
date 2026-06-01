import { ImageResponse } from "next/og";
import { fetchBrandingFaviconResponse } from "@/lib/site-favicon";

export const dynamic = "force-dynamic";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const branded = await fetchBrandingFaviconResponse();
  if (branded) {
    const buf = await branded.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": branded.headers.get("Content-Type") || "image/png",
        "Cache-Control": branded.headers.get("Cache-Control") || "public, max-age=300",
      },
    });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d1b2a",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#e8b84b",
          }}
        >
          Y
        </div>
      </div>
    ),
    { ...size }
  );
}
