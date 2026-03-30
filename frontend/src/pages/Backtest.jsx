import { useState, useEffect } from "react";
import { BACKEND } from "@/lib/config";
import { SparkLine } from "@/components/SparkLine";

const DAYS_OPTIONS = [7, 14, 30, 60, 90];

export function Backtest() {
  const [days, setDays]     = useState(30);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND}/api/backtest?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Backtest des signaux</h1>
        <div style={{ display: "flex", gap: 4 }}>
          {DAYS_OPTIONS.map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: "6px 12px", borderRadius: 6,
              background: days === d ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
              border: days === d ? "1px solid rgba(99,102,241,0.4)" : "1px solid transparent",
              color: days === d ? "#818cf8" : "#64748b",
              cursor: "pointer", fontSize: 12,
            }}>{d}j</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#475569" }}>Analyse en cours…</div>
      ) : !data ? (
        <div style={{ textAlign: "center", padding: 48, color: "#334155", fontSize: 14 }}>
          Backend hors ligne ou aucune donnée disponible
        </div>
      ) : (
        <>
          {/* Global stats */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { label: "Win rate 15min", value: data.win_rate_15min ? `${(data.win_rate_15min * 100).toFixed(1)}%` : "—", color: "#34d399" },
              { label: "Win rate 1h",    value: data.win_rate_1h    ? `${(data.win_rate_1h    * 100).toFixed(1)}%` : "—", color: "#34d399" },
              { label: "P&L moyen",      value: data.avg_pnl        ? `${data.avg_pnl > 0 ? "+" : ""}${data.avg_pnl.toFixed(2)}%` : "—", color: data?.avg_pnl > 0 ? "#34d399" : "#f87171" },
              { label: "Total signaux",  value: data.total ?? "—",   color: "#6366f1" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1, minWidth: 120, background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 24, fontFamily: "'DM Mono', monospace", color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Capital curve */}
          {data.capital_curve?.length > 1 && (
            <div style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 12 }}>Courbe du capital hypothétique (1 ETH par signal)</div>
              <SparkLine data={data.capital_curve} color="#6366f1" height={80} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono', monospace" }}>
                  Début: {data.capital_curve[0].toFixed(3)} ETH
                </span>
                <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: data.capital_curve.at(-1) > data.capital_curve[0] ? "#34d399" : "#f87171" }}>
                  Fin: {data.capital_curve.at(-1).toFixed(3)} ETH
                </span>
              </div>
            </div>
          )}

          {/* By confidence bucket */}
          {data.by_confidence?.length > 0 && (
            <div style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>
                Résultats par niveau de confiance
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px", padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 11, color: "#475569" }}>
                <span>SEUIL</span><span>WIN%</span><span>P&L MOY</span><span>SIGNAUX</span>
              </div>
              {data.by_confidence.map((bucket, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr 80px 80px 80px",
                  padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
                  fontSize: 13, alignItems: "center",
                }}>
                  <span style={{ color: "#94a3b8" }}>{bucket.range}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: bucket.win_rate > 0.5 ? "#34d399" : "#f87171" }}>
                    {(bucket.win_rate * 100).toFixed(1)}%
                  </span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: bucket.avg_pnl > 0 ? "#34d399" : "#f87171" }}>
                    {bucket.avg_pnl > 0 ? "+" : ""}{bucket.avg_pnl.toFixed(2)}%
                  </span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: "#64748b" }}>{bucket.count}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
