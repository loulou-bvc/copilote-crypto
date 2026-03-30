import { useState, useEffect } from "react";
import { useBinancePrice } from "@/hooks/useBinancePrice";
import { usePosition } from "@/hooks/usePosition";
import { useBackend } from "@/hooks/useBackend";
import { BACKEND } from "@/lib/config";
import { toast } from "sonner";

const TABS = ["Avant", "Pendant", "Après"];

// Calculate support/resistance from klines
function calcSR(candles) {
  if (!candles || candles.length < 5) return { support: null, resistance: null };
  const last20 = candles.slice(-20);
  const highs = last20.map(c => c.high ?? c.close);
  const lows  = last20.map(c => c.low  ?? c.close);
  return {
    resistance: Math.max(...highs),
    support:    Math.min(...lows),
  };
}

// Conviction score 0-100
function calcConviction(signals, fearGreed, volRatio) {
  let score = 50;
  const last = signals?.[0];
  if (last) {
    score += last.direction === "bullish" ? 20 : -20;
    score += (last.confidence - 50) * 0.3;
  }
  const fg = parseInt(fearGreed?.data?.[0]?.value ?? 50);
  if (fg < 30) score -= 10;
  if (fg > 70) score += 10;
  if (volRatio > 1.5) score += 10;
  if (volRatio < 0.8) score -= 10;
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function Strategy({ candles }) {
  const [tab, setTab] = useState("Avant");
  const { price, change24h } = useBinancePrice();
  const { position, pnl, history, openPosition, closePosition, clearHistory } = usePosition(price);
  const { signals, fearGreed, volRatio } = useBackend();

  const sr = calcSR(candles);
  const conviction = calcConviction(signals, fearGreed, volRatio);
  const lastSignal = signals?.[0];

  // TP/SL alert
  useEffect(() => {
    if (!position || !price) return;
    if (position.tp && price >= position.tp) {
      toast.success(`🎯 Take-profit atteint ! ETH = $${price.toLocaleString()}`);
    }
    if (position.sl && price <= position.sl) {
      toast.error(`🛑 Stop-loss atteint ! ETH = $${price.toLocaleString()}`);
    }
  }, [price, position]);

  // Form state
  const [form, setForm] = useState({
    type: "long", size: "", tp: "", sl: "", note: "",
  });

  function handleOpen() {
    if (!form.size) return;
    openPosition({
      type: form.type,
      entryPrice: price,
      size: parseFloat(form.size),
      tp: form.tp ? parseFloat(form.tp) : null,
      sl: form.sl ? parseFloat(form.sl) : null,
      note: form.note,
      signalId: lastSignal?.id ?? null,
    });
    setForm({ type: "long", size: "", tp: "", sl: "", note: "" });
    toast.success("Position ouverte !");
  }

  function handleClose() {
    closePosition();
    toast("Position fermée");
  }

  function exportTrades() {
    const header = "date_ouverture,date_cloture,type,entree,sortie,taille,pnl_pct,pnl_usd,duree_min\n";
    const rows = history.map(t => [
      new Date(t.openedAt).toISOString(),
      new Date(t.closedAt).toISOString(),
      t.type, t.entryPrice, t.exitPrice, t.size,
      t.pnlPct?.toFixed(2), t.pnlUsd?.toFixed(2),
      Math.round(t.duration / 60000),
    ].join(",")).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `trades_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  const totalPnl = history.reduce((acc, t) => acc + (t.pnlUsd || 0), 0);
  const wins = history.filter(t => t.pnlUsd > 0).length;
  const winRate = history.length ? ((wins / history.length) * 100).toFixed(1) : null;

  const inputStyle = {
    width: "100%", padding: "10px 12px",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8, color: "#f1f5f9", fontSize: 14, outline: "none",
    fontFamily: "'DM Mono', monospace",
    boxSizing: "border-box",
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Stratégie</h1>
        <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Avant · Pendant · Après votre trade</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 4 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "9px", borderRadius: 7, border: "none", cursor: "pointer",
            background: tab === t ? "rgba(99,102,241,0.2)" : "transparent",
            color: tab === t ? "#818cf8" : "#475569",
            fontSize: 13, fontWeight: tab === t ? 600 : 400,
          }}>{t}</button>
        ))}
      </div>

      {/* ── AVANT ── */}
      {tab === "Avant" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Conviction gauge */}
          <div style={{
            background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14, padding: 24,
          }}>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>Score de conviction</div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ position: "relative", width: 80, height: 80 }}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                  <circle cx="40" cy="40" r="32" fill="none"
                    stroke={conviction > 60 ? "#34d399" : conviction < 40 ? "#f87171" : "#fbbf24"}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${conviction * 2.01} 201`}
                    transform="rotate(-90 40 40)"
                  />
                  <text x="40" y="45" textAnchor="middle" fill="white" fontSize="18" fontFamily="DM Mono" fontWeight="600">
                    {conviction}
                  </text>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: conviction > 60 ? "#34d399" : conviction < 40 ? "#f87171" : "#fbbf24", marginBottom: 4 }}>
                  {conviction > 70 ? "Fort signal" : conviction > 55 ? "Signal modéré" : conviction < 40 ? "Signal faible" : "Neutre"}
                </div>
                <div style={{ fontSize: 12, color: "#475569" }}>Composite sentiment + volume + Fear&Greed + IA</div>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>Checklist pré-trade</div>
            {[
              { label: "IA bullish ?", ok: lastSignal?.direction === "bullish" },
              { label: "Volume > 1.5× moy ?", ok: volRatio > 1.5 },
              { label: "Confiance signal > 70% ?", ok: (lastSignal?.confidence ?? 0) > 70 },
              { label: "Fear & Greed < 75 ?", ok: parseInt(fearGreed?.data?.[0]?.value ?? 50) < 75 },
              { label: "Prix > support ?", ok: price && sr.support ? price > sr.support : null },
            ].map(({ label, ok }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <span style={{ fontSize: 16 }}>{ok === null ? "⬜" : ok ? "✅" : "❌"}</span>
                <span style={{ fontSize: 13, color: ok ? "#f1f5f9" : "#475569" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Support / Résistance */}
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "Résistance 20 bougies", val: sr.resistance, color: "#f87171" },
              { label: "Support 20 bougies", val: sr.support, color: "#34d399" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ flex: 1, background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px" }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 20, fontFamily: "'DM Mono', monospace", color }}>
                  {val ? `$${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
                </div>
                {price && val && (
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                    {label.includes("Rés") ? "+" : ""}{(((val - price) / price) * 100).toFixed(2)}% du prix actuel
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Last signal detail */}
          {lastSignal && (
            <div style={{
              background: lastSignal.direction === "bullish" ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)",
              border: `1px solid ${lastSignal.direction === "bullish" ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
              borderRadius: 12, padding: 16,
            }}>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>Dernier signal IA</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: lastSignal.direction === "bullish" ? "#34d399" : "#f87171", marginBottom: 4 }}>
                    {lastSignal.direction === "bullish" ? "🟢 Haussier" : "🔴 Baissier"}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{lastSignal.note || "Aucune note"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#94a3b8" }}>{lastSignal.confidence}% conf.</div>
                  <div style={{ fontSize: 11, color: "#334155", marginTop: 2 }}>{lastSignal.provider}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PENDANT ── */}
      {tab === "Pendant" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {position ? (
            <>
              {/* Live position card */}
              <div style={{
                background: "rgba(12,18,32,0.95)",
                border: `1px solid ${pnl?.usd >= 0 ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                borderRadius: 16, padding: 24,
                boxShadow: `0 0 30px ${pnl?.usd >= 0 ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>Position {position.type.toUpperCase()} ouverte</div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>
                      Entrée : <span style={{ fontFamily: "'DM Mono', monospace", color: "#94a3b8" }}>${position.entryPrice?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 28, fontFamily: "'DM Mono', monospace", fontWeight: 600, color: pnl?.usd >= 0 ? "#34d399" : "#f87171" }}>
                      {pnl ? `${pnl.usd >= 0 ? "+" : ""}${pnl.usd.toFixed(2)}$` : "—"}
                    </div>
                    <div style={{ fontSize: 14, fontFamily: "'DM Mono', monospace", color: pnl?.usd >= 0 ? "#34d399" : "#f87171" }}>
                      {pnl ? `${pnl.pct >= 0 ? "+" : ""}${pnl.pct.toFixed(3)}%` : ""}
                    </div>
                  </div>
                </div>

                {/* TP/SL progress */}
                {(position.tp || position.sl) && price && (
                  <div style={{ marginBottom: 20 }}>
                    {position.tp && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginBottom: 4 }}>
                          <span>Take-profit</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", color: "#34d399" }}>${position.tp.toLocaleString()}</span>
                        </div>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                          <div style={{
                            height: "100%", borderRadius: 2, background: "#34d399",
                            width: `${Math.min(100, Math.max(0, ((price - position.entryPrice) / (position.tp - position.entryPrice)) * 100))}%`,
                          }} />
                        </div>
                      </div>
                    )}
                    {position.sl && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginBottom: 4 }}>
                          <span>Stop-loss</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", color: "#f87171" }}>${position.sl.toLocaleString()}</span>
                        </div>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                          <div style={{
                            height: "100%", borderRadius: 2, background: "#f87171",
                            width: `${Math.min(100, Math.max(0, ((position.entryPrice - price) / (position.entryPrice - position.sl)) * 100))}%`,
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Duration + size */}
                <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: "#475569" }}>Taille : <span style={{ fontFamily: "'DM Mono', monospace", color: "#94a3b8" }}>${position.size?.toLocaleString()}</span></div>
                  <div style={{ fontSize: 12, color: "#475569" }}>Durée : <span style={{ fontFamily: "'DM Mono', monospace", color: "#94a3b8" }}>{Math.round((Date.now() - position.openedAt) / 60000)}min</span></div>
                </div>

                {position.note && <div style={{ fontSize: 12, color: "#475569", marginBottom: 16, fontStyle: "italic" }}>"{position.note}"</div>}

                <button onClick={handleClose} style={{
                  width: "100%", padding: "12px",
                  background: pnl?.usd >= 0 ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                  border: `1px solid ${pnl?.usd >= 0 ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                  borderRadius: 10, color: pnl?.usd >= 0 ? "#34d399" : "#f87171",
                  fontWeight: 700, cursor: "pointer", fontSize: 15,
                }}>
                  Fermer la position ({pnl ? `${pnl.usd >= 0 ? "+" : ""}${pnl.usd.toFixed(2)}$` : "—"})
                </button>
              </div>
            </>
          ) : (
            /* Open position form */
            <div style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 20 }}>Ouvrir une position (paper trading)</div>

              {/* Long / Short */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {["long", "short"].map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={{
                    flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
                    background: form.type === t ? (t === "long" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)") : "rgba(255,255,255,0.03)",
                    border: `1px solid ${form.type === t ? (t === "long" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)") : "rgba(255,255,255,0.06)"}`,
                    color: form.type === t ? (t === "long" ? "#34d399" : "#f87171") : "#64748b",
                    fontWeight: 600, fontSize: 14,
                  }}>
                    {t === "long" ? "▲ Long" : "▼ Short"}
                  </button>
                ))}
              </div>

              {/* Prix d'entrée (readonly) */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 6 }}>Prix d'entrée (live)</label>
                <div style={{ ...inputStyle, background: "rgba(99,102,241,0.06)", color: "#818cf8", padding: "10px 12px" }}>
                  ${price?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "—"}
                </div>
              </div>

              {/* Taille */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 6 }}>Taille (USDT)</label>
                <input type="number" placeholder="ex: 500" value={form.size}
                  onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
                  style={inputStyle} />
              </div>

              {/* TP / SL */}
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: "#34d399", display: "block", marginBottom: 6 }}>Take-profit $</label>
                  <input type="number" placeholder="optionnel" value={form.tp}
                    onChange={e => setForm(f => ({ ...f, tp: e.target.value }))}
                    style={{ ...inputStyle, borderColor: "rgba(52,211,153,0.15)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: "#f87171", display: "block", marginBottom: 6 }}>Stop-loss $</label>
                  <input type="number" placeholder="optionnel" value={form.sl}
                    onChange={e => setForm(f => ({ ...f, sl: e.target.value }))}
                    style={{ ...inputStyle, borderColor: "rgba(248,113,113,0.15)" }} />
                </div>
              </div>

              {/* Note */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 6 }}>Note (optionnel)</label>
                <input type="text" placeholder="ex: signal haussier fort + volume spike" value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  style={inputStyle} />
              </div>

              <button onClick={handleOpen} disabled={!form.size || !price} style={{
                width: "100%", padding: "13px",
                background: form.type === "long" ? "linear-gradient(135deg, #34d399, #10b981)" : "linear-gradient(135deg, #f87171, #ef4444)",
                border: "none", borderRadius: 10, color: "white",
                fontWeight: 700, cursor: "pointer", fontSize: 15,
                opacity: !form.size || !price ? 0.5 : 1,
              }}>
                {form.type === "long" ? "▲ Ouvrir Long" : "▼ Ouvrir Short"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── APRÈS ── */}
      {tab === "Après" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Stats globales */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { label: "Total trades", value: history.length },
              { label: "Win rate", value: winRate ? `${winRate}%` : "—" },
              { label: "P&L total", value: `${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}$`, color: totalPnl >= 0 ? "#34d399" : "#f87171" },
              { label: "Meilleur trade", value: history.length ? `+${Math.max(...history.map(t => t.pnlUsd || 0)).toFixed(2)}$` : "—", color: "#34d399" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1, minWidth: 120, background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 20, fontFamily: "'DM Mono', monospace", color: color || "#f1f5f9", fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Export + clear */}
          {history.length > 0 && (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={exportTrades} style={{
                padding: "9px 16px", background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8,
                color: "#818cf8", cursor: "pointer", fontSize: 13,
              }}>↓ Exporter (CSV)</button>
              <button onClick={clearHistory} style={{
                padding: "9px 16px", background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8,
                color: "#f87171", cursor: "pointer", fontSize: 13,
              }}>Effacer l'historique</button>
            </div>
          )}

          {/* Trade history table */}
          <div style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 80px 80px 70px", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#475569" }}>
              <span>DATE</span><span>TYPE</span><span>ENTRÉE</span><span>SORTIE</span><span>P&L</span><span>DURÉE</span>
            </div>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#334155", fontSize: 13 }}>
                Aucun trade fermé pour l'instant
              </div>
            ) : (
              history.map((t, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr 60px 80px 80px 80px 70px",
                  padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)",
                  fontSize: 12, alignItems: "center",
                }}>
                  <span style={{ color: "#64748b" }}>{new Date(t.closedAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  <span style={{ color: t.type === "long" ? "#34d399" : "#f87171", fontWeight: 600 }}>{t.type === "long" ? "▲" : "▼"}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: "#94a3b8" }}>${t.entryPrice?.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: "#94a3b8" }}>${t.exitPrice?.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: t.pnlUsd >= 0 ? "#34d399" : "#f87171", fontWeight: 600 }}>
                    {t.pnlUsd >= 0 ? "+" : ""}{t.pnlUsd?.toFixed(2)}$
                  </span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: "#64748b" }}>{Math.round(t.duration / 60000)}min</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
