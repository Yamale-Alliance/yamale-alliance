import { ImageResponse } from "next/og";
import { fetchBrandingFaviconResponse } from "@/lib/site-favicon";

export const dynamic = "force-dynamic";
export const size = { width: 48, height: 48 };
export const contentType = "image/x-icon";

export default async function Icon() {
  const branded = await fetchBrandingFaviconResponse();
  if (branded) return branded;

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
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "linear-gradient(135deg, #c8922a 0%, #e8b84b 100%)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
