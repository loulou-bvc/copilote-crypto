import { useState, useEffect } from "react";
import { BACKEND } from "@/lib/config";
import { RefreshCw, Info } from "lucide-react";

export function Correlations() {
  const [data, setData]       = useState(null);
  const [health, setHealth]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND}/api/correlations`).then(r => r.json()),
      fetch(`${BACKEND}/health`).then(r => r.json()),
    ]).then(([corr, h]) => { setData(corr); setHealth(h); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sources = data?.by_source ? Object.entries(data.by_source).filter(([, s]) => Object.keys(s).length > 0) : [];
  const hasData = sources.length > 0;

  function AccuracyBar({ value }) {
    const color = value > 55 ? "#34d399" : value < 45 ? "#f87171" : "#fbbf24";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 60, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, flexShrink: 0 }}>
          <div style={{ height: "100%", width: `${Math.min(100, value)}%`, background: color, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color }}>{value.toFixed(0)}%</span>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Corrélations</h1>
        <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Quelle source d'actualité prédit le mieux les mouvements ETH ?</p>
      </div>

      {/* Explanation banner */}
      <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 10 }}>
        <Info size={16} color="#6366f1" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
          Cette page mesure la <strong style={{ color: "#94a3b8" }}>précision de chaque source d'actualité</strong> par type de sentiment.
          Une source bullish avec 65%+ de précision signifie que le prix ETH monte effectivement dans les 15min après ses articles positifs.
          Les données apparaissent au fur et à mesure que des signaux sont générés et que leurs résultats (15min, 1h) sont mesurés.
        </div>
      </div>

      {/* Signal accuracy global */}
      {data?.signals && (
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>Précision globale des signaux</div>
            <div style={{ fontSize: 28, fontFamily: "'DM Mono', monospace", color: data.signals.accuracy > 55 ? "#34d399" : data.signals.accuracy < 45 ? "#f87171" : "#fbbf24" }}>
              {data.signals.total > 0 ? `${data.signals.accuracy?.toFixed(1)}%` : "—"}
            </div>
            <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>sur {data.signals.total} signal(s) analysé(s)</div>
          </div>
          <div style={{ flex: 1, background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>News collectées</div>
            <div style={{ fontSize: 28, fontFamily: "'DM Mono', monospace", color: "#f1f5f9" }}>{health?.news_stored ?? "—"}</div>
            <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>en base de données</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#475569" }}>Chargement…</div>
      ) : !hasData ? (
        <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fbbf24", marginBottom: 8 }}>Données insuffisantes</div>
          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
            Les corrélations se calculent <strong style={{ color: "#f1f5f9" }}>15 minutes et 1 heure après</strong> chaque signal généré,
            en comparant la direction du signal avec le mouvement réel du prix ETH.
            <br /><br />
            Pour l'instant : <strong style={{ color: "#fbbf24" }}>{health?.news_stored ?? 0} news collectées</strong>, <strong style={{ color: "#f87171" }}>{health?.signals_stored ?? 0} signaux générés</strong>.
            <br />
            Va dans <strong style={{ color: "#818cf8" }}>Backtest → Lancer l'analyse IA</strong> ou attend que le backend génère automatiquement des signaux.
          </div>
        </div>
      ) : (
        sources.map(([source, sentiments]) => (
          <div key={source} style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>{source}</div>
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 1fr 50px 1fr", padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 11, color: "#475569" }}>
              <span>SENTIMENT</span><span>MVT 15MIN</span><span>MVT 1H</span><span>NB</span><span>PRÉCISION</span>
            </div>
            {Object.entries(sentiments).map(([sentiment, stats]) => {
              const color = sentiment === "bullish" ? "#34d399" : sentiment === "bearish" ? "#f87171" : "#94a3b8";
              return (
                <div key={sentiment} style={{ display: "grid", gridTemplateColumns: "90px 1fr 1fr 50px 1fr", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 12, alignItems: "center" }}>
                  <span style={{ color, fontWeight: 600 }}>{sentiment}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: (stats.avg_move_15min ?? 0) >= 0 ? "#34d399" : "#f87171" }}>
                    {stats.avg_move_15min != null ? `${stats.avg_move_15min > 0 ? "+" : ""}${stats.avg_move_15min.toFixed(2)}%` : "—"}
                  </span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: (stats.avg_move_1h ?? 0) >= 0 ? "#34d399" : "#f87171" }}>
                    {stats.avg_move_1h != null ? `${stats.avg_move_1h > 0 ? "+" : ""}${stats.avg_move_1h.toFixed(2)}%` : "—"}
                  </span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: "#64748b" }}>{stats.count ?? 0}</span>
                  {stats.accuracy != null ? <AccuracyBar value={stats.accuracy} /> : <span style={{ color: "#334155", fontSize: 11 }}>En attente</span>}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
