import { useLogin } from "@privy-io/react-auth";

export function Login() {
  const { login } = useLogin();
  return (
    <div style={{
      minHeight: "100svh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "rgb(6 10 18)",
    }}>
      <div style={{
        background: "rgba(12,18,32,0.95)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 16,
        padding: "48px 40px",
        width: "100%",
        maxWidth: 400,
        textAlign: "center",
        boxShadow: "0 0 40px rgba(99,102,241,0.1)",
        animation: "fadeUp 0.4s ease both",
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚡</div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
            CopiloteCrypto
          </h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            Signaux ETH en temps réel propulsés par IA
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {[
            { icon: "🤖", text: "Analyse IA multi-sources" },
            { icon: "📊", text: "Graphiques TradingView live" },
            { icon: "🔔", text: "Alertes prix instantanées" },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8, textAlign: "left" }}>
              <span>{icon}</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>{text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={login}
          style={{
            width: "100%", padding: "14px", borderRadius: 10,
            background: "linear-gradient(135deg, #6366f1, #818cf8)",
            border: "none", color: "white", fontSize: 15,
            fontWeight: 600, cursor: "pointer",
            boxShadow: "0 4px 24px rgba(99,102,241,0.4)",
            transition: "all 0.2s ease",
          }}
        >
          Se connecter
        </button>
        <p style={{ marginTop: 12, fontSize: 12, color: "#334155" }}>
          Email · Google · Wallet crypto
        </p>
      </div>
    </div>
  );
}
