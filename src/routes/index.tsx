import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Bizim Oyun — Ozzy & Su için" },
      {
        name: "description",
        content: "Ozzy ve Su için hazırlanmış kişisel çift oyunu.",
      },
      { property: "og:title", content: "Bizim Oyun — Ozzy & Su için" },
      {
        property: "og:description",
        content: "Ozzy ve Su için hazırlanmış kişisel çift oyunu.",
      },
    ],
  }),
});

function Landing() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("bizimOyun.activeSession");
      setHasSession(!!raw && raw !== "null");
    } catch {
      setHasSession(false);
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 50% -10%, #3a1420 0%, #10090c 55%, #0a0508 100%)",
        color: "#f5ead8",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: "100%",
          textAlign: "center",
          padding: "40px 28px",
          border: "1px solid #26151d",
          borderRadius: 24,
          background: "linear-gradient(180deg, rgba(38,21,29,0.6), rgba(16,9,12,0.6))",
          backdropFilter: "blur(8px)",
          boxShadow: "0 40px 80px -30px rgba(167, 55, 82, 0.45)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.3em",
            color: "#d9af61",
            marginBottom: 12,
            textTransform: "uppercase",
          }}
        >
          Sadece ikimiz için
        </div>
        <h1
          style={{
            fontSize: 44,
            margin: 0,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#f5ead8",
          }}
        >
          Bizim Oyun
        </h1>
        <div
          style={{
            marginTop: 8,
            fontSize: 18,
            color: "#d9af61",
            fontStyle: "italic",
          }}
        >
          Ozzy & Su için
        </div>
        <p
          style={{
            marginTop: 20,
            color: "#bbaeb2",
            lineHeight: 1.6,
            fontSize: 15,
          }}
        >
          Sohbetten yakınlaşmaya, oyundan anılara uzanan; sadece bize ait, her
          gece biraz daha derinleşen küçük bir oyun.
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 28,
          }}
        >
          <a
            href="/bizim-oyun.html?v=15"
            style={{
              display: "block",
              padding: "16px 20px",
              borderRadius: 14,
              background: "linear-gradient(135deg, #a73752, #7d2138)",
              color: "#f5ead8",
              fontWeight: 600,
              fontSize: 16,
              textDecoration: "none",
              boxShadow: "0 12px 30px -12px rgba(167,55,82,0.8)",
            }}
          >
            Oyuna Başla
          </a>
          {hasSession && (
            <a
              href="/bizim-oyun.html?v=15#/home?resume=1"
              style={{
                display: "block",
                padding: "14px 20px",
                borderRadius: 14,
                background: "transparent",
                color: "#d9af61",
                fontWeight: 600,
                fontSize: 15,
                textDecoration: "none",
                border: "1px solid #d9af61",
              }}
            >
              Son Oyuna Devam Et
            </a>
          )}
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 12,
            color: "#7a6a70",
          }}
        >
          Hiçbir veri sunucuya gönderilmez. Her şey senin tarayıcında kalır.
        </div>
      </div>
    </div>
  );
}
