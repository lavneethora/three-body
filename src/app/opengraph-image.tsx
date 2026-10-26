import { ImageResponse } from "next/og";

export const alt = "Three Body: an N-body gravity simulator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card that shows when a link is posted.
 *
 * Drawn rather than screenshotted: the canvas needs a live WebGL context, so
 * it cannot be rendered here. This is a flat stand-in using the same palette
 * as the app, built from shapes that the image renderer supports.
 */
export default function Image() {
  const orbit = (size: number, opacity: number) => ({
    position: "absolute" as const,
    width: size,
    height: size,
    borderRadius: size,
    border: `2px solid rgba(255,255,255,${opacity})`,
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#05060a",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 90,
            top: 75,
            width: 480,
            height: 480,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={orbit(460, 0.08)} />
          <div style={orbit(320, 0.12)} />
          <div style={orbit(180, 0.16)} />

          {/* Three suns. */}
          <div
            style={{
              position: "absolute",
              width: 74,
              height: 74,
              borderRadius: 74,
              background: "#fff6de",
              boxShadow: "0 0 70px 24px rgba(255,236,190,0.55)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 38,
              top: 128,
              width: 40,
              height: 40,
              borderRadius: 40,
              background: "#ffd2a0",
              boxShadow: "0 0 44px 14px rgba(255,196,130,0.45)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 52,
              bottom: 104,
              width: 30,
              height: 30,
              borderRadius: 30,
              background: "#ffb0b0",
              boxShadow: "0 0 36px 12px rgba(255,150,150,0.4)",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 70px",
            maxWidth: 650,
          }}
        >
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: -3,
              lineHeight: 1.05,
            }}
          >
            Three Body
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 29,
              color: "rgba(255,255,255,0.68)",
              lineHeight: 1.35,
            }}
          >
            Place stars and planets, then watch gravity decide what happens.
          </div>
          <div
            style={{
              marginTop: 30,
              fontSize: 21,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            Real masses · real orbits · genuinely chaotic
          </div>
        </div>
      </div>
    ),
    size,
  );
}
