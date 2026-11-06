import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon (/apple-icon.png). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f3ee" }}>
        <svg width="132" height="132" viewBox="0 0 64 64">
          <path d="M32 4 L38 32 L32 28 L26 32 Z" fill="#d4552b" />
          <path d="M32 60 L26 32 L32 36 L38 32 Z" fill="#16181d" />
          <path d="M4 32 L32 26 L28 32 L32 38 Z" fill="#16181d" />
          <path d="M60 32 L32 38 L36 32 L32 26 Z" fill="#16181d" />
        </svg>
      </div>
    ),
    size
  );
}
