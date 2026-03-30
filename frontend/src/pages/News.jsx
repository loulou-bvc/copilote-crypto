import { useState } from "react";

const TABS = ["Tout", "Bullish", "Bearish", "Signaux"];

function NewsCard({ item }) {
  const badgeColor = item.sentiment === "bullish" ? { bg: "rgba(52,211,153,0.1)", color: "#34d399", border: "rgba(52,211,153,0.2)" }
    : item.sentiment === "bearish" ? { bg: "rgba(248,113,113,0.1)", color: "#f87171", border: "rgba(248,113,113,0.2)" }
    : { bg: "rgba(99,102,241,0.1)", color: "#818cf8", border: "rgba(99,102,241,0.2)" };

  const ago = item.created_at ? Math.floor((Date.now() - new Date(item.created_at).getTime()) / 60000) : null;

  return (
    <div style={{
      background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10, padding: "14px 16px",
      transition: "border-color 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: "#475569" }}>
          {item.source} {ago !== null && `· il y a ${ago < 60 ? ago + "min" : Math.floor(ago/60) + "h"}`}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 8px",
          borderRadius: 20, background: badgeColor.bg,
          color: badgeColor.color, border: `1px solid ${badgeColor.border}`,
          whiteSpace: "nowrap",
        }}>
          {item.sentiment}
        </span>
      </div>
      <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.5, marginBottom: 8 }}>
        {item.title}
      </div>
      {item.summary && (
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
          {item.summary}
        </div>
      )}
      {item.score !== undefined && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ height: 3, flex: 1, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${Math.abs(item.score) * 100}%`, background: badgeColor.color, borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace" }}>
            {(item.score * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}

function SignalCard({ sig }) {
  const up = sig.direction === "bullish";
  return (
    <div style={{
      background: up ? "rgba(52,211,153,0.05)" : "rgba(248,113,113,0.05)",
      border: `1px solid ${up ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
      borderRadius: 10, padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: up ? "#34d399" : "#f87171" }}>
          {up ? "🟢 Signal Haussier" : "🔴 Signal Baissier"}
        </span>
        <span style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: "#94a3b8" }}>
          {sig.confidence}% conf.
        </span>
      </div>
      {sig.reasoning && (
        <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{sig.reasoning}</p>
      )}
      {sig.price_at_signal && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#475569", fontFamily: "'DM Mono', monospace" }}>
          Prix: ${parseFloat(sig.price_at_signal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
      )}
    </div>
  );
}

export function News({ news = [], signals = [], online }) {
  const [tab, setTab] = useState("Tout");

  const filtered = tab === "Signaux" ? [] : news.filter(n =>
    tab === "Tout" ? true :
    tab === "Bullish" ? n.sentiment === "bullish" :
    tab === "Bearish" ? n.sentiment === "bearish" : true
  );

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Actualités</h1>
          {online === false && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#fbbf24", display: "flex", alignItems: "center", gap: 6 }}>
              ⚠ Backend hors ligne — données non disponibles
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 14px", borderRadius: 20,
            background: tab === t ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
            border: tab === t ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.06)",
            color: tab === t ? "#818cf8" : "#64748b",
            cursor: "pointer", fontSize: 13,
          }}>{t}{t === "Signaux" ? ` (${signals.length})` : ""}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tab === "Signaux"
          ? signals.map((s, i) => <SignalCard key={i} sig={s} />)
          : filtered.map((n, i) => <NewsCard key={i} item={n} />)
        }
        {(tab === "Signaux" ? signals : filtered).length === 0 && (
          <div style={{ textAlign: "center", color: "#334155", padding: "48px 0", fontSize: 14 }}>
            {online === false ? "Backend hors ligne" : "Aucune donnée disponible"}
          </div>
        )}
      </div>
    </div>
  );
}
