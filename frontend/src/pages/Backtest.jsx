import { useState, useEffect } from "react";
import { BACKEND } from "@/lib/config";
import { SparkLine } from "@/components/SparkLine";
import { RefreshCw, AlertCircle, CheckCircle, Info } from "lucide-react";

const DAYS_OPTIONS = [7, 14, 30, 60, 90];

export function Backtest() {
  const [days, setDays]       = useState(30);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [health, setHealth]   = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState(null);

  // Fetch health status (shows news_stored, signals_stored)
  useEffect(() => {
    fetch(`${BACKEND}/health`)
      .then(r => r.json())
      .then(setHealth)
      .catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    fetch(`${BACKEND}/api/backtest?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }

  useEffect(() => { load(); }, [days]);

  // Trigger manual analysis of recent news
  async function triggerAnalysis() {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      // Fetch recent news and analyze top 3
      const newsRes = await fetch(`${BACKEND}/api/news?limit=3`);
      const news = await newsRes.json();
      if (!news.length) {
        setTriggerMsg({ ok: false, text: "Aucune news disponible à analyser" });
        setTriggering(false);
        return;
      }
      const results = await Promise.allSettled(
        news.map(n => fetch(`${BACKEND}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: n.title, source: n.source }),
        }).then(r => r.json()))
      );
      const ok = results.filter(r => r.status === "fulfilled").length;
      setTriggerMsg({ ok: true, text: `${ok} analyse(s) lancée(s). Attends 10-20s puis recharge.` });
      setTimeout(() => { load(); setHealth(h => h); }, 15000);
    } catch (e) {
      setTriggerMsg({ ok: false, text: "Erreur lors du déclenchement" });
    }
    setTriggering(false);
  }

  const hasData = data && data.total > 0;
  const backendOk = health !== null;

  const card = (label, value, color) => (
    <div style={{ flex: 1, minWidth: 120, background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontFamily: "'DM Mono', monospace", color: color || "#f1f5f9", fontWeight: 500 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Backtest</h1>
          <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Performance historique des signaux IA sur ETH/USDT</p>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {DAYS_OPTIONS.map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12,
              background: days === d ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
              border: days === d ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.06)",
              color: days === d ? "#818cf8" : "#64748b",
            }}>{d}j</button>
          ))}
        </div>
      </div>

      {/* System status banner */}
      <div style={{
        background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12, padding: "14px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: backendOk ? "#34d399" : "#f87171", display: "inline-block" }} />
            <span style={{ fontSize: 13, color: "#94a3b8" }}>Backend {backendOk ? "en ligne" : "hors ligne"}</span>
          </div>
          {health && (
            <>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                📰 <span style={{ color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>{health.news_stored}</span> news collectées
              </div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                ⚡ <span style={{ color: health.signals_stored > 0 ? "#34d399" : "#fbbf24", fontFamily: "'DM Mono', monospace" }}>{health.signals_stored}</span> signaux générés
              </div>
            </>
          )}
        </div>
        <button onClick={load} disabled={loading} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8,
          color: "#818cf8", cursor: loading ? "default" : "pointer", fontSize: 12,
          opacity: loading ? 0.5 : 1,
        }}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Actualiser
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#475569", fontSize: 14 }}>Chargement…</div>
      ) : !backendOk ? (
        <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 12, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 16, color: "#f87171", marginBottom: 8 }}>Backend hors ligne</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Le backtest nécessite que le serveur Railway soit en ligne.</div>
        </div>
      ) : !hasData ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Explanation card */}
          <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <Info size={18} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fbbf24", marginBottom: 6 }}>Aucune donnée de backtest disponible</div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                  Le backtest se base sur les signaux générés automatiquement par l'IA.
                  Le backend a collecté <strong style={{ color: "#f1f5f9" }}>{health?.news_stored || 0} articles</strong> mais n'a pas encore émis de signal de trading.
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.8, marginLeft: 28 }}>
              Un signal est généré quand <strong style={{ color: "#94a3b8" }}>toutes ces conditions</strong> sont réunies :
              <ul style={{ margin: "8px 0 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
                <li>Score sentiment ≥ seuil configuré (voir Réglages → Paramètres des signaux)</li>
                <li>Volume spike ≥ seuil configuré</li>
                <li>Score d'impact ≥ seuil configuré</li>
                <li>Délai de cooldown respecté entre les signaux</li>
              </ul>
            </div>
          </div>

          {/* Manual trigger */}
          <div style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 8 }}>Forcer une analyse manuelle</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.5 }}>
              Lance une analyse IA sur les 3 dernières news collectées. Si les seuils sont atteints,
              un signal sera créé et apparaîtra dans l'historique.
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={triggerAnalysis} disabled={triggering || !backendOk} style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, #6366f1, #818cf8)",
                border: "none", borderRadius: 8, color: "white",
                fontWeight: 600, cursor: triggering ? "default" : "pointer",
                fontSize: 13, opacity: triggering ? 0.6 : 1,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <RefreshCw size={14} style={{ animation: triggering ? "spin 1s linear infinite" : "none" }} />
                {triggering ? "Analyse en cours…" : "Lancer l'analyse IA"}
              </button>
              <span style={{ fontSize: 12, color: "#334155" }}>
                ou baisse les seuils dans{" "}
                <span style={{ color: "#6366f1" }}>Réglages → Paramètres des signaux</span>
              </span>
            </div>
            {triggerMsg && (
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 8, fontSize: 13,
                background: triggerMsg.ok ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                border: `1px solid ${triggerMsg.ok ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
                color: triggerMsg.ok ? "#34d399" : "#f87171",
              }}>
                {triggerMsg.ok ? "✓" : "✗"} {triggerMsg.text}
              </div>
            )}
          </div>

          {/* How backtest works */}
          <div style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 12 }}>Comment fonctionne le backtest ?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { step: "1", text: "L'IA analyse les news et génère des signaux (bullish/bearish) avec un niveau de confiance" },
                { step: "2", text: "Le backend mesure automatiquement le mouvement du prix ETH 15 minutes et 1 heure après chaque signal" },
                { step: "3", text: "Le backtest calcule le win rate (signaux corrects) et la courbe de P&L hypothétique" },
                { step: "4", text: "Les résultats s'améliorent au fur et à mesure que les signaux s'accumulent (minimum ~20 pour des stats fiables)" },
              ].map(({ step, text }) => (
                <div key={step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{step}</span>
                  <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {card("Win rate 15min", data.win_rate_15min ? `${(data.win_rate_15min * 100).toFixed(1)}%` : "—", data.win_rate_15min > 0.5 ? "#34d399" : "#f87171")}
            {card("Win rate 1h",    data.win_rate_1h    ? `${(data.win_rate_1h    * 100).toFixed(1)}%` : "—", data.win_rate_1h > 0.5 ? "#34d399" : "#f87171")}
            {card("P&L moyen",      data.avg_pnl != null ? `${data.avg_pnl > 0 ? "+" : ""}${data.avg_pnl.toFixed(2)}%` : "—", data.avg_pnl > 0 ? "#34d399" : "#f87171")}
            {card("Signaux analysés", data.total ?? "—", "#6366f1")}
          </div>

          {data.capital_curve?.length > 1 && (
            <div style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 12 }}>Courbe du capital hypothétique (1 ETH par signal)</div>
              <SparkLine data={data.capital_curve} color="#6366f1" height={80} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono', monospace" }}>Début: {data.capital_curve[0].toFixed(3)} ETH</span>
                <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: data.capital_curve.at(-1) > data.capital_curve[0] ? "#34d399" : "#f87171" }}>
                  Fin: {data.capital_curve.at(-1).toFixed(3)} ETH
                </span>
              </div>
            </div>
          )}

          {data.by_confidence?.length > 0 && (
            <div style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>Résultats par niveau de confiance</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px", padding: "8px 16px", fontSize: 11, color: "#475569", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span>SEUIL</span><span>WIN%</span><span>P&L MOY</span><span>SIGNAUX</span>
              </div>
              {data.by_confidence.map((b, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 13 }}>
                  <span style={{ color: "#94a3b8" }}>{b.range}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: b.win_rate > 0.5 ? "#34d399" : "#f87171" }}>{(b.win_rate * 100).toFixed(1)}%</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: b.avg_pnl > 0 ? "#34d399" : "#f87171" }}>{b.avg_pnl > 0 ? "+" : ""}{b.avg_pnl.toFixed(2)}%</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: "#64748b" }}>{b.count}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
