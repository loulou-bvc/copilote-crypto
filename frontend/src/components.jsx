// ─── LLMSwitcher.jsx ──────────────────────────────────────────────────────────
// Composant pour switcher entre Claude et Gemini depuis le dashboard

import { useState, useEffect, useCallback } from "react";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export function LLMSwitcher() {
  const [llmState,   setLlmState]   = useState({ active: "claude", stats: {} });
  const [switching,  setSwitching]  = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchLLMState = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/api/llm`);
      const data = await res.json();
      setLlmState(data);
      setLastUpdate(new Date());
    } catch { /* backend peut être hors ligne */ }
  }, []);

  useEffect(() => {
    fetchLLMState();
    const iv = setInterval(fetchLLMState, 30000);
    return () => clearInterval(iv);
  }, [fetchLLMState]);

  const switchLLM = async (provider) => {
    if (switching || provider === llmState.active) return;
    setSwitching(true);
    try {
      const res = await fetch(`${BACKEND}/api/llm/switch`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.ok) {
        setLlmState(s => ({ ...s, active: data.active }));
      }
    } catch { /* erreur silencieuse */ }
    setSwitching(false);
  };

  const claudeStats = llmState.stats?.claude || { calls: 0, errors: 0 };
  const geminiStats = llmState.stats?.gemini || { calls: 0, errors: 0 };

  const LLMCard = ({ provider, label, icon, color, stats }) => {
    const isActive = llmState.active === provider;
    const errRate  = stats.calls > 0 ? Math.round(stats.errors / stats.calls * 100) : 0;
    return (
      <button
        onClick={() => switchLLM(provider)}
        disabled={switching}
        style={{
          flex:       1,
          padding:    "14px 16px",
          borderRadius: 12,
          textAlign:  "left",
          background: isActive ? color + "12" : "#070d18",
          border:     `1px solid ${isActive ? color + "40" : "#1a2438"}`,
          cursor:     switching ? "wait" : "pointer",
          transition: "all .2s",
          boxShadow:  isActive ? `0 0 20px ${color}18` : "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 800, color: isActive ? color : "#94a3b8" }}>{label}</span>
          </div>
          {isActive && (
            <span style={{ padding: "2px 8px", borderRadius: 8, background: color + "20", color, fontSize: 9, fontWeight: 700 }}>
              ACTIF
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 10 }}>
          <span style={{ color: "#334155" }}>Appels <span style={{ color: "#94a3b8", fontFamily: "'DM Mono',monospace" }}>{stats.calls}</span></span>
          <span style={{ color: "#334155" }}>Erreurs <span style={{ color: errRate > 10 ? "#f87171" : "#34d399" }}>{stats.errors}</span></span>
          {stats.calls > 0 && <span style={{ color: "#334155" }}>Taux <span style={{ color: errRate > 10 ? "#f87171" : "#34d399" }}>{errRate}%</span></span>}
        </div>
      </button>
    );
  };

  return (
    <div style={{ background: "#0c1220", border: "1px solid #1a2438", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Modèle IA</div>
          <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>
            {lastUpdate ? `Mis à jour ${lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "Chargement..."}
          </div>
        </div>
        <button
          onClick={fetchLLMState}
          style={{ padding: "4px 10px", borderRadius: 7, background: "#070d18", border: "1px solid #1a2438", color: "#475569", fontSize: 10 }}
        >
          {switching ? "..." : "↻"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <LLMCard
          provider="claude" label="Claude" icon="🟣"
          color="#8b5cf6"
          stats={claudeStats}
        />
        <LLMCard
          provider="gemini" label="Gemini" icon="🔵"
          color="#3b82f6"
          stats={geminiStats}
        />
      </div>

      <div style={{ marginTop: 12, padding: "8px 12px", background: "#070d18", borderRadius: 8, fontSize: 10, color: "#334155" }}>
        Le modèle actif analyse chaque signal avant qu'il soit émis et envoyé sur Telegram.
        Gemini est plus rapide, Claude est plus précis pour le trading.
      </div>
    </div>
  );
}

// ─── HealthPanel.jsx ─────────────────────────────────────────────────────────
// Panel de santé du backend avec état de toutes les APIs

export function HealthPanel() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND}/health`);
        setHealth(await res.json());
      } catch { setHealth(null); }
    };
    poll();
    const iv = setInterval(poll, 30000);
    return () => clearInterval(iv);
  }, []);

  if (!health) return (
    <div style={{ background: "#0c1220", border: "1px solid rgba(248,113,113,.2)", borderRadius: 14, padding: "14px 16px", fontSize: 12, color: "#f87171" }}>
      🔴 Backend hors ligne — <code style={{ fontSize: 10 }}>python backend_v3.py</code>
    </div>
  );

  const apis = health.apis || {};
  const apiList = [
    { key: "cryptopanic",  label: "CryptoPanic",  emoji: "📰" },
    { key: "newsdata",     label: "NewsData.io",  emoji: "📡" },
    { key: "lunarcrush",   label: "LunarCrush",   emoji: "🌙" },
    { key: "claude",       label: "Claude",       emoji: "🟣" },
    { key: "gemini",       label: "Gemini",       emoji: "🔵" },
    { key: "telegram",     label: "Telegram",     emoji: "✈️" },
  ];

  return (
    <div style={{ background: "#0c1220", border: "1px solid #1a2438", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>État du système</div>
        <span style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(52,211,153,.1)", border: "1px solid rgba(52,211,153,.2)", color: "#34d399", fontSize: 10, fontWeight: 700 }}>
          🟢 EN LIGNE
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
        {apiList.map(({ key, label, emoji }) => (
          <div key={key} style={{ padding: "8px 10px", borderRadius: 8, background: "#070d18", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12 }}>{emoji}</span>
            <div>
              <div style={{ fontSize: 9, color: "#334155" }}>{label}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: apis[key] ? "#34d399" : "#f87171" }}>
                {apis[key] ? "✓ OK" : "✗ Manquant"}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#334155" }}>
        <span>News <span style={{ color: "#94a3b8" }}>{health.news_stored || 0}</span></span>
        <span>Signaux <span style={{ color: "#fbbf24" }}>{health.signals_stored || 0}</span></span>
        <span>LLM <span style={{ color: health.llm_active === "claude" ? "#8b5cf6" : "#3b82f6" }}>{health.llm_active?.toUpperCase()}</span></span>
        <span>Vol <span style={{ color: (health.volume_ratio || 1) >= 2 ? "#f87171" : "#34d399" }}>{(health.volume_ratio || 1).toFixed(1)}x</span></span>
      </div>
    </div>
  );
}

// ─── main.jsx FINAL ──────────────────────────────────────────────────────────
// Intègre WalletConnect dans Privy

export const MAIN_JSX = `
import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PrivyProvider
      appId="cmnanm19h00yx0cifvajmt165"
      config={{
        loginMethods: ["email", "google", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#6366f1",
        },
        embeddedWallets: { createOnLogin: "off" },
        // WalletConnect — Project ID dans les env vars
        walletConnectCloudProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
        defaultChain: {
          id: 42161,
          name: "Arbitrum One",
          network: "arbitrum",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: ["https://arb1.arbitrum.io/rpc"] } },
        },
        supportedChains: [{
          id: 42161, name: "Arbitrum One", network: "arbitrum",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: ["https://arb1.arbitrum.io/rpc"] } },
        }],
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>
);
`;
