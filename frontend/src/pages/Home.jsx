import { PriceNum, Skeleton } from "@/components/PriceDisplay";
import { SparkLine } from "@/components/SparkLine";
import { TrendingUp, TrendingDown } from "lucide-react";

function StatCard({ label, value, sub, color = "#6366f1", glow = false }) {
  return (
    <div style={{
      background: "rgba(12,18,32,0.9)",
      border: `1px solid ${glow ? color + "40" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 12, padding: "20px",
      boxShadow: glow ? `0 0 20px ${color}20` : "none",
      flex: 1, minWidth: 160,
    }}>
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontFamily: "'DM Mono', monospace", fontWeight: 500, color: "white" }}>
        {value ?? <Skeleton style={{ width: "4ch", height: "1em", display: "inline-block" }} />}
      </div>
      {sub && <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function FearGreedGauge({ data }) {
  if (!data) return null;
  const val = parseInt(data.data?.[0]?.value ?? 50);
  const label = data.data?.[0]?.value_classification ?? "Neutral";
  const color = val < 25 ? "#f87171" : val < 45 ? "#fb923c" : val < 55 ? "#fbbf24" : val < 75 ? "#34d399" : "#10b981";
  return (
    <div style={{
      background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, padding: 20, textAlign: "center",
    }}>
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>Fear & Greed Index</div>
      <div style={{ position: "relative", display: "inline-block" }}>
        <svg width="120" height="70" viewBox="0 0 120 70">
          <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
          <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${val * 1.57} 157`} />
          <text x="60" y="58" textAnchor="middle" fill="white" fontSize="20" fontFamily="DM Mono" fontWeight="500">{val}</text>
        </svg>
      </div>
      <div style={{ fontSize: 13, color, fontWeight: 600, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export function Home({ price, change24h, high24h, low24h, vol24h, closes, signals, fearGreed, volRatio }) {
  const up = (change24h ?? 0) >= 0;

  const lastSignal = signals?.[0];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>
          Tableau de bord
        </h1>
        <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>ETH/USDT · Arbitrum</p>
      </div>

      {/* Price hero */}
      <div style={{
        background: "rgba(12,18,32,0.95)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 16, padding: "28px 28px 20px",
        boxShadow: "0 0 40px rgba(99,102,241,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>ETH / USDT</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 42, fontFamily: "'DM Mono', monospace", fontWeight: 500, color: "#f1f5f9" }}>
                {price ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <Skeleton style={{ width: "8ch", height: "1em", display: "inline-block" }} />}
              </span>
              {change24h !== null && (
                <span style={{ fontSize: 16, fontFamily: "'DM Mono', monospace", color: up ? "#34d399" : "#f87171", display: "flex", alignItems: "center", gap: 4 }}>
                  {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {up ? "+" : ""}{change24h?.toFixed(2)}%
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
              <span style={{ fontSize: 12, color: "#475569" }}>H: <span style={{ color: "#34d399", fontFamily: "'DM Mono', monospace" }}>${high24h?.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></span>
              <span style={{ fontSize: 12, color: "#475569" }}>B: <span style={{ color: "#f87171", fontFamily: "'DM Mono', monospace" }}>${low24h?.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></span>
              <span style={{ fontSize: 12, color: "#475569" }}>Vol: <span style={{ fontFamily: "'DM Mono', monospace", color: "#94a3b8" }}>${vol24h ? (vol24h / 1e9).toFixed(2) + "B" : "—"}</span></span>
            </div>
          </div>
          {lastSignal && (
            <div style={{
              background: lastSignal.direction === "bullish" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
              border: `1px solid ${lastSignal.direction === "bullish" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
              borderRadius: 10, padding: "12px 16px",
            }}>
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>Dernier signal IA</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: lastSignal.direction === "bullish" ? "#34d399" : "#f87171" }}>
                {lastSignal.direction === "bullish" ? "🟢 Haussier" : "🔴 Baissier"}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                Conf. {lastSignal.confidence}%
              </div>
            </div>
          )}
        </div>
        <div style={{ marginTop: 16 }}>
          <SparkLine data={closes} color={up ? "#34d399" : "#f87171"} height={72} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Volume ratio" value={volRatio ? `${volRatio.toFixed(2)}x` : null} sub="vs moyenne 20j" color="#6366f1" glow={volRatio > 1.5} />
        {fearGreed?.data?.[0] && (
          <FearGreedGauge data={fearGreed} />
        )}
        <StatCard label="Signaux 24h" value={signals?.length ?? null} sub="derniers signaux" color="#fbbf24" />
      </div>
    </div>
  );
}
