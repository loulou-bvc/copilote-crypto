import { useState, useEffect } from "react";
import { BACKEND } from "@/lib/config";
import { CheckCircle, XCircle, Clock } from "lucide-react";

export function History() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND}/api/signals?limit=50`)
      .then(r => r.json())
      .then(data => { setSignals(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const total   = signals.length;
  const correct = signals.filter(s => s.correct_15min === 1).length;
  const accuracy = total ? ((correct / total) * 100).toFixed(1) : null;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Historique des signaux</h1>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { label: "Total signaux", value: total },
          { label: "Précision 15min", value: accuracy ? `${accuracy}%` : "—" },
          { label: "Corrects", value: correct },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1, background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontFamily: "'DM Mono', monospace", color: "#f1f5f9" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 70px 70px 70px", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#475569" }}>
          <span>DATE</span><span>DIR.</span><span>PRIX</span><span>CONF.</span><span>+15MIN</span><span>OK?</span>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 32, color: "#475569", fontSize: 14 }}>Chargement…</div>
        ) : signals.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "#334155", fontSize: 14 }}>Aucun signal enregistré</div>
        ) : (
          signals.map((s, i) => {
            const up = s.direction === "bullish";
            const ok = s.correct_15min === 1;
            const pending = s.correct_15min === null;
            const date = s.created_at ? new Date(s.created_at * 1000).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
            return (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1fr 80px 100px 70px 70px 70px",
                padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
                fontSize: 13, alignItems: "center",
              }}>
                <span style={{ color: "#64748b", fontSize: 12 }}>{date}</span>
                <span style={{ color: up ? "#34d399" : "#f87171", fontWeight: 600 }}>{up ? "▲ Bull" : "▼ Bear"}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", color: "#94a3b8" }}>
                  ${parseFloat(s.price_at_signal || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </span>
                <span style={{ fontFamily: "'DM Mono', monospace", color: "#64748b" }}>{s.confidence}%</span>
                <span style={{ fontFamily: "'DM Mono', monospace", color: s.result_15min > 0 ? "#34d399" : s.result_15min < 0 ? "#f87171" : "#475569" }}>
                  {s.result_15min !== null ? `${s.result_15min > 0 ? "+" : ""}${parseFloat(s.result_15min).toFixed(2)}%` : "—"}
                </span>
                <span>
                  {pending ? <Clock size={14} color="#475569" /> : ok ? <CheckCircle size={14} color="#34d399" /> : <XCircle size={14} color="#f87171" />}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
