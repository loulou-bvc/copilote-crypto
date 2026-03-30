import { useState } from "react";
import { CandlestickChart } from "@/components/CandlestickChart";
import { useKlines } from "@/hooks/useKlines";
import { Skeleton } from "@/components/PriceDisplay";
import { Bell, X } from "lucide-react";

const INTERVALS = [
  { label: "1m",  value: "1m",  limit: 60 },
  { label: "5m",  value: "5m",  limit: 60 },
  { label: "15m", value: "15m", limit: 60 },
  { label: "1h",  value: "1h",  limit: 48 },
  { label: "4h",  value: "4h",  limit: 42 },
  { label: "1j",  value: "1d",  limit: 30 },
];

function AlertModal({ price, onClose, onAdd }) {
  const [dir, setDir] = useState("above");
  const [threshold, setThreshold] = useState(price ? Math.round(price) : "");
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        background: "rgb(12,18,32)", border: "1px solid rgba(99,102,241,0.3)",
        borderRadius: 16, padding: 28, width: 360,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 600 }}>Créer une alerte</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["above", "below"].map(d => (
            <button key={d} onClick={() => setDir(d)} style={{
              flex: 1, padding: "8px", borderRadius: 8,
              background: dir === d ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
              border: dir === d ? "1px solid rgba(99,102,241,0.4)" : "1px solid transparent",
              color: dir === d ? "#818cf8" : "#64748b", cursor: "pointer", fontSize: 13,
            }}>
              {d === "above" ? "▲ Au-dessus" : "▼ En-dessous"}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 6 }}>Prix seuil (USDT)</label>
          <input
            type="number"
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "#f1f5f9", fontSize: 15,
              fontFamily: "'DM Mono', monospace", outline: "none",
            }}
            placeholder="ex: 2100"
          />
        </div>
        <button
          onClick={() => { if (threshold) { onAdd({ dir, threshold: parseFloat(threshold) }); onClose(); } }}
          style={{
            width: "100%", padding: "12px",
            background: "linear-gradient(135deg, #6366f1, #818cf8)",
            border: "none", borderRadius: 8, color: "white",
            fontWeight: 600, cursor: "pointer", fontSize: 14,
          }}
        >
          Créer l'alerte
        </button>
      </div>
    </div>
  );
}

export function Market({ price, change24h }) {
  const [activeInterval, setActiveInterval] = useState("5m");
  const [limit, setLimit]     = useState(60);
  const { candles }           = useKlines(activeInterval, limit);
  const [showAlert, setShowAlert] = useState(false);
  const [alerts, setAlerts]   = useState(() => JSON.parse(localStorage.getItem("priceAlerts") || "[]"));

  const up = (change24h ?? 0) >= 0;

  function addAlert(a) {
    const newAlert = { id: crypto.randomUUID(), ...a, created: Date.now(), fired: false };
    const next = [...alerts, newAlert];
    setAlerts(next);
    localStorage.setItem("priceAlerts", JSON.stringify(next));
  }

  function removeAlert(id) {
    const next = alerts.filter(a => a.id !== id);
    setAlerts(next);
    localStorage.setItem("priceAlerts", JSON.stringify(next));
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {showAlert && <AlertModal price={price} onClose={() => setShowAlert(false)} onAdd={addAlert} />}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Marché</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 20, fontFamily: "'DM Mono', monospace", color: "#f1f5f9" }}>
              {price ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
            </span>
            {change24h !== null && (
              <span style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: up ? "#34d399" : "#f87171" }}>
                {up ? "+" : ""}{change24h?.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowAlert(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 16px", background: "rgba(99,102,241,0.1)",
            border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8,
            color: "#818cf8", cursor: "pointer", fontSize: 13, fontWeight: 500,
          }}
        >
          <Bell size={14} /> Alerte prix
        </button>
      </div>

      {/* Interval tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        {INTERVALS.map(iv => (
          <button key={iv.value} onClick={() => { setActiveInterval(iv.value); setLimit(iv.limit); }}
            style={{
              padding: "6px 12px", borderRadius: 6,
              background: activeInterval === iv.value ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
              border: activeInterval === iv.value ? "1px solid rgba(99,102,241,0.4)" : "1px solid transparent",
              color: activeInterval === iv.value ? "#818cf8" : "#64748b",
              cursor: "pointer", fontSize: 12,
            }}>
            {iv.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
        <CandlestickChart candles={candles} />
      </div>

      {/* Active alerts */}
      {alerts.length > 0 && (
        <div style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 12 }}>Alertes actives ({alerts.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map(a => (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
              }}>
                <span style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
                  ETH {a.dir === "above" ? ">" : "<"} ${a.threshold.toLocaleString()}
                </span>
                <button onClick={() => removeAlert(a.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
