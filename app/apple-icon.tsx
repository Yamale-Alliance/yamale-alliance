import { ImageResponse } from "next/og";
import { readStaticAppleTouchIconResponse } from "@/lib/site-favicon-static";

export const dynamic = "force-dynamic";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const staticIcon = await readStaticAppleTouchIconResponse();
  if (staticIcon) return staticIcon;

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
