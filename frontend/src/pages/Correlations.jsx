import { useState, useEffect } from "react";
import { BACKEND } from "@/lib/config";

export function Correlations() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND}/api/correlations`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sources = data?.by_source ? Object.entries(data.by_source) : [];

  function AccuracyBar({ value }) {
    const color = value > 55 ? "#34d399" : value < 45 ? "#f87171" : "#fbbf24";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 60, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, flexShrink: 0 }}>
          <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color }}>{value.toFixed(0)}%</span>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Corrélations</h1>
        <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Performance des sources d'actualités par sentiment</p>
      </div>

      {/* Signal accuracy global */}
      {data?.signals && (
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>Précision globale signaux</div>
            <div style={{ fontSize: 28, fontFamily: "'DM Mono', monospace", color: data.signals.accuracy > 55 ? "#34d399" : "#f87171" }}>
              {data.signals.accuracy?.toFixed(1)}%
            </div>
          </div>
          <div style={{ flex: 1, background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>Total signaux analysés</div>
            <div style={{ fontSize: 28, fontFamily: "'DM Mono', monospace", color: "#f1f5f9" }}>{data.signals.total}</div>
          </div>
        </div>
      )}

      {/* Table by source */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#475569" }}>Chargement…</div>
      ) : sources.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#334155", fontSize: 14 }}>
          Pas encore assez de données — les corrélations se calculent après 15min/1h
        </div>
      ) : (
        sources.map(([source, sentiments]) => (
          <div key={source} style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>
              {source}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 70px 70px 1fr 50px", padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 11, color: "#475569" }}>
              <span>SENTIMENT</span><span>MVT 15MIN</span><span>MVT 1H</span><span>COUNT</span><span>PRÉCISION</span><span></span>
            </div>
            {Object.entries(sentiments).map(([sentiment, stats]) => {
              const color = sentiment === "bullish" ? "#34d399" : sentiment === "bearish" ? "#f87171" : "#94a3b8";
              return (
                <div key={sentiment} style={{
                  display: "grid", gridTemplateColumns: "90px 1fr 70px 70px 1fr 50px",
                  padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)",
                  fontSize: 12, alignItems: "center",
                }}>
                  <span style={{ color, fontWeight: 600 }}>{sentiment}</span>
                  <span style={{
                    fontFamily: "'DM Mono', monospace",
                    color: (stats.avg_move_15min ?? 0) > 0 ? "#34d399" : "#f87171",
                  }}>
                    {stats.avg_move_15min != null ? `${stats.avg_move_15min > 0 ? "+" : ""}${stats.avg_move_15min.toFixed(2)}%` : "—"}
                  </span>
                  <span style={{
                    fontFamily: "'DM Mono', monospace",
                    color: (stats.avg_move_1h ?? 0) > 0 ? "#34d399" : "#f87171",
                  }}>
                    {stats.avg_move_1h != null ? `${stats.avg_move_1h > 0 ? "+" : ""}${stats.avg_move_1h.toFixed(2)}%` : "—"}
                  </span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: "#64748b" }}>{stats.count ?? 0}</span>
                  {stats.accuracy != null ? <AccuracyBar value={stats.accuracy} /> : <span style={{ color: "#334155" }}>—</span>}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
