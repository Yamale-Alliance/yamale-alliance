import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site-seo";

export const runtime = "edge";
export const alt = SITE.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          background: "linear-gradient(145deg, #0D1B2A 0%, #1E3148 55%, #0D1B2A 100%)",
          color: "#f4f1eb",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            fontWeight: 700,
            color: "#E8B84B",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Yamalé Legal Platform
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.15,
            maxWidth: 900,
          }}
        >
          {SITE.tagline}
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 26,
            lineHeight: 1.45,
            color: "rgba(244, 241, 235, 0.82)",
            maxWidth: 880,
          }}
        >
          African legal library · AfCFTA tools · AI research · The Yamalé Vault · Find a Lawyer
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 22,
            color: "#C8922A",
            fontWeight: 600,
          }}
        >
          yamalelegal.com
        </div>
      </div>
    ),
    { ...size }
  );
}
