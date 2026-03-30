import { Home, BarChart3, Newspaper, Wallet, MessageSquare, LogOut, TrendingUp, History, FlaskConical, Settings, LineChart, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "home",    label: "Accueil",    Icon: Home          },
  { id: "market",  label: "Marché",     Icon: BarChart3     },
  { id: "news",    label: "Actualités", Icon: Newspaper     },
  { id: "wallet",  label: "Portefeuille", Icon: Wallet      },
  { id: "chat",    label: "Assistant",  Icon: MessageSquare },
  { id: "history", label: "Historique", Icon: History       },
  { id: "backtest",    label: "Backtest",    Icon: FlaskConical },
  { id: "strategy",    label: "Stratégie",   Icon: LineChart    },
  { id: "correlations",label: "Corrélations",Icon: Activity     },
  { id: "settings",    label: "Réglages",    Icon: Settings     },
];

export function Sidebar({ page, setPage, onLogout, wsConnected }) {
  return (
    <aside
      style={{
        width: 240,
        minHeight: "100svh",
        background: "rgba(12,18,32,0.95)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 0",
        gap: 4,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: "0 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18, color: "#f1f5f9" }}>
            CopiloteCrypto
          </span>
        </div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: wsConnected ? "#34d399" : "#475569",
            display: "inline-block",
            animation: wsConnected ? "livepulse 2s ease-in-out infinite" : "none",
          }} />
          <span style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace" }}>
            {wsConnected ? "LIVE" : "offline"}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 12px 0", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map(({ id, label, Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 8,
                border: "none",
                background: active ? "rgba(99,102,241,0.15)" : "transparent",
                color: active ? "#818cf8" : "#64748b",
                borderLeft: active ? "3px solid #6366f1" : "3px solid transparent",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                width: "100%",
                textAlign: "left",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: "12px 12px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={onLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: "#64748b",
            cursor: "pointer",
            fontSize: 14,
            width: "100%",
            textAlign: "left",
          }}
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
