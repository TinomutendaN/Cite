import { ImageResponse } from "next/og";

export const alt = "Cite: ask your company's documents and see the source for every answer.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#F2EEE5",
          fontFamily: "Helvetica, Arial, sans-serif",
          color: "#242424",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: "#242424",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div style={{ fontSize: 34 }}>Cite</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "8px 18px",
              borderRadius: 999,
              background: "#E9E1D5",
              color: "#6B5B4B",
              fontSize: 20,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Company knowledge assistant
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
              maxWidth: 980,
            }}
          >
            Ask your company’s documents. See the source for every answer.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              padding: "14px 30px",
              borderRadius: 14,
              background: "#CC8D51",
              color: "#1F1A16",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            Try it now →
          </div>
          <div style={{ fontSize: 24, color: "#4A4440" }}>No sign-up. Nothing to upload.</div>
        </div>
      </div>
    ),
    size,
  );
}
