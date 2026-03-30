import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { ChevronDown, User, Bot, Sliders, Bell, BarChart2, Server, Check, X } from "lucide-react";
import { useSignalConfig } from "@/hooks/useSignalConfig";
import { useHealth } from "@/hooks/useHealth";
import { BACKEND } from "@/lib/config";

function SectionCard({ id, title, icon: Icon, open, onToggle, children }) {
  return (
    <div style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
      <button onClick={onToggle} style={{
        width: "100%", padding: "16px 20px", display: "flex", alignItems: "center",
        justifyContent: "space-between", background: "transparent", border: "none", cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon size={16} color="#6366f1" />
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{title}</span>
        </div>
        <ChevronDown size={16} color="#475569" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div style={{ padding: "0 20px 20px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "16px 0" }} />;
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      <span style={{ fontSize: 13, color: "#475569" }}>{label}</span>
      <span style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: "#94a3b8" }}>{value || "—"}</span>
    </div>
  );
}

const SLIDERS = [
  { key: "min_sentiment_score", label: "Seuil sentiment", min: 0.1, max: 1.0, step: 0.05, fmt: v => v.toFixed(2), hint: "Score sentiment minimum pour un signal" },
  { key: "min_volume_spike", label: "Pic de volume", min: 1.0, max: 5.0, step: 0.1, fmt: v => `${v.toFixed(1)}×`, hint: "Ratio volume vs moyenne" },
  { key: "min_impact", label: "Score d'impact", min: 1, max: 10, step: 0.5, fmt: v => `${v}/10`, hint: "Impact minimum de l'article" },
  { key: "cooldown_seconds", label: "Cooldown", min: 60, max: 3600, step: 60, fmt: v => `${Math.round(v / 60)}min`, hint: "Délai entre deux signaux" },
];

const CURRENCIES = [
  { code: "USD", symbol: "$", label: "Dollar US" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "BTC", symbol: "₿", label: "Bitcoin" },
];

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"];

export function Settings() {
  const { user, logout } = usePrivy();
  const { config, setConfig, save, saving, saveStatus, reset } = useSignalConfig();
  const health = useHealth();

  const [open, setOpen] = useState("compte");
  const toggle = (id) => setOpen(o => o === id ? null : id);

  const [llmState, setLlmState] = useState(null);
  const [llmSwitching, setLlmSwitching] = useState(false);

  const [chartInterval, setChartInterval] = useState(() => localStorage.getItem("chartInterval") || "5m");
  const [currency, setCurrency] = useState(() => localStorage.getItem("displayCurrency") || "USD");

  const [priceAlerts, setPriceAlerts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("priceAlerts") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    fetch(`${BACKEND}/api/llm`).then(r => r.json()).then(setLlmState).catch(() => {});
  }, []);

  async function switchLLM(provider) {
    setLlmSwitching(true);
    try {
      const r = await fetch(`${BACKEND}/api/llm/switch`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const d = await r.json();
      if (d.ok) setLlmState(s => ({ ...s, active: d.active }));
    } catch {}
    setLlmSwitching(false);
  }

  function saveInterval(v) { setChartInterval(v); localStorage.setItem("chartInterval", v); }
  function saveCurrency(v) { setCurrency(v); localStorage.setItem("displayCurrency", v); }

  function clearAlerts() {
    setPriceAlerts([]);
    localStorage.removeItem("priceAlerts");
  }

  function clearCache() {
    localStorage.removeItem("priceAlerts");
    localStorage.removeItem("chartInterval");
    localStorage.removeItem("displayCurrency");
    localStorage.removeItem("openPosition");
    setPriceAlerts([]);
    setChartInterval("5m");
    setCurrency("USD");
  }

  function exportSignals() {
    fetch(`${BACKEND}/api/signals?limit=200`)
      .then(r => r.json())
      .then(data => {
        const header = "date,direction,price,confidence,result_15min,correct_15min\n";
        const rows = data.map(s => `${s.created_at},${s.direction},${s.price_at_signal},${s.confidence},${s.result_15min ?? ""},${s.correct_15min ?? ""}`).join("\n");
        const blob = new Blob([header + rows], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `signaux_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
      })
      .catch(() => alert("Backend hors ligne"));
  }

  const userEmail = user?.email?.address || user?.google?.email || "";
  const walletAddr = user?.wallet?.address || "";
  const userId = user?.id ? user.id.slice(0, 20) + "…" : "—";

  const apiKeys = [
    { label: "CryptoPanic", ok: health?.cryptopanic_ok },
    { label: "NewsData.io", ok: health?.newsdata_ok },
    { label: "LunarCrush", ok: health?.lunarcrush_ok },
    { label: "Claude", ok: health?.claude_ok },
    { label: "Gemini", ok: health?.gemini_ok },
    { label: "Telegram", ok: health?.telegram_enabled },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 720, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Réglages</h1>
        <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Compte, IA, signaux, interface et système</p>
      </div>

      {/* ── Section 1: Compte ── */}
      <SectionCard id="compte" title="Compte" icon={User} open={open === "compte"} onToggle={() => toggle("compte")}>
        <div style={{ marginTop: 12 }}>
          {userEmail && <InfoRow label="Email" value={userEmail} />}
          {walletAddr && <InfoRow label="Wallet" value={`${walletAddr.slice(0,10)}···${walletAddr.slice(-6)}`} />}
          <InfoRow label="ID Privy" value={userId} />
          <InfoRow label="Comptes liés" value={`${user?.linkedAccounts?.length || 0} compte(s)`} />
          <button onClick={logout} style={{
            marginTop: 16, padding: "10px 20px", background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.25)", borderRadius: 8, color: "#f87171",
            fontSize: 13, fontWeight: 500, cursor: "pointer", width: "100%",
          }}>
            Déconnexion
          </button>
        </div>
      </SectionCard>

      {/* ── Section 2: IA ── */}
      <SectionCard id="ia" title="Assistant IA" icon={Bot} open={open === "ia"} onToggle={() => toggle("ia")}>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>Modèle actif</div>
          <div style={{ display: "flex", gap: 10 }}>
            {["claude", "gemini"].map(p => {
              const active = llmState?.active === p;
              const stats = llmState?.stats?.[p] || { calls: 0, errors: 0 };
              return (
                <button key={p} onClick={() => switchLLM(p)} disabled={llmSwitching}
                  style={{
                    flex: 1, padding: "14px", borderRadius: 10, cursor: "pointer",
                    background: active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)"}`,
                    boxShadow: active ? "0 0 16px rgba(99,102,241,0.2)" : "none",
                    textAlign: "left",
                  }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: active ? "#818cf8" : "#64748b", textTransform: "capitalize" }}>
                    {active ? "●" : "○"} {p === "claude" ? "Claude" : "Gemini"}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace", marginTop: 6 }}>
                    {stats.calls} appels · {stats.errors} erreurs
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {/* ── Section 3: Signaux ── */}
      <SectionCard id="signals" title="Paramètres des signaux" icon={Sliders} open={open === "signals"} onToggle={() => toggle("signals")}>
        <div style={{ marginTop: 16 }}>
          {SLIDERS.map(s => (
            <div key={s.key} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>{s.label}</span>
                  <div style={{ fontSize: 11, color: "#334155", marginTop: 2 }}>{s.hint}</div>
                </div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: "#818cf8", fontWeight: 600 }}>
                  {s.fmt(config[s.key] ?? s.min)}
                </span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step}
                value={config[s.key] ?? s.min}
                onChange={e => setConfig(c => ({ ...c, [s.key]: parseFloat(e.target.value) }))}
                style={{ width: "100%", accentColor: "#6366f1", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#334155", marginTop: 2 }}>
                <span>{s.fmt(s.min)}</span><span>{s.fmt(s.max)}</span>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={reset} style={{
              flex: 1, padding: "10px", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
              color: "#64748b", cursor: "pointer", fontSize: 13,
            }}>Réinitialiser</button>
            <button onClick={() => save(config)} disabled={saving} style={{
              flex: 2, padding: "10px",
              background: saving ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #818cf8)",
              border: "none", borderRadius: 8, color: "white",
              fontWeight: 600, cursor: saving ? "default" : "pointer", fontSize: 13,
            }}>
              {saving ? "Sauvegarde…" : "Sauvegarder"}
            </button>
          </div>
          {saveStatus && (
            <div style={{
              marginTop: 10, padding: "8px 12px", borderRadius: 6, fontSize: 12,
              background: saveStatus === "ok" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
              color: saveStatus === "ok" ? "#34d399" : "#f87171",
              border: `1px solid ${saveStatus === "ok" ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
            }}>
              {saveStatus === "ok" ? "✓ Paramètres sauvegardés" : "✗ Erreur lors de la sauvegarde"}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Section 4: Notifications ── */}
      <SectionCard id="notifs" title="Notifications" icon={Bell} open={open === "notifs"} onToggle={() => toggle("notifs")}>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>Alertes de prix actives ({priceAlerts.length})</div>
          {priceAlerts.length === 0 ? (
            <div style={{ fontSize: 13, color: "#334155", padding: "12px 0" }}>Aucune alerte configurée — crée-en depuis la page Marché</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {priceAlerts.map((a, i) => (
                <div key={i} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6, fontSize: 13, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
                  ETH {a.dir === "above" ? ">" : "<"} ${a.threshold?.toLocaleString()} {a.fired ? "✓" : ""}
                </div>
              ))}
            </div>
          )}
          {priceAlerts.length > 0 && (
            <button onClick={clearAlerts} style={{
              padding: "8px 16px", background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6,
              color: "#f87171", cursor: "pointer", fontSize: 12,
            }}>Effacer toutes les alertes</button>
          )}
          <Divider />
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>Telegram</div>
          <div style={{
            padding: "10px 14px", borderRadius: 8, fontSize: 13,
            background: health?.telegram_enabled ? "rgba(52,211,153,0.08)" : "rgba(251,191,36,0.08)",
            border: `1px solid ${health?.telegram_enabled ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.2)"}`,
            color: health?.telegram_enabled ? "#34d399" : "#fbbf24",
          }}>
            {health?.telegram_enabled
              ? "✓ Telegram configuré — les signaux sont envoyés automatiquement"
              : "⚠ Non configuré — ajoute TELEGRAM_TOKEN et TELEGRAM_CHAT_ID dans les variables d'environnement Railway"}
          </div>
        </div>
      </SectionCard>

      {/* ── Section 5: Interface ── */}
      <SectionCard id="ui" title="Graphiques & Interface" icon={BarChart2} open={open === "ui"} onToggle={() => toggle("ui")}>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>Intervalle par défaut</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            {INTERVALS.map(iv => (
              <button key={iv} onClick={() => saveInterval(iv)} style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                background: chartInterval === iv ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${chartInterval === iv ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)"}`,
                color: chartInterval === iv ? "#818cf8" : "#64748b",
              }}>{iv}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>Devise d'affichage</div>
          <div style={{ display: "flex", gap: 6 }}>
            {CURRENCIES.map(c => (
              <button key={c.code} onClick={() => saveCurrency(c.code)} style={{
                flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer", textAlign: "center",
                background: currency === c.code ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${currency === c.code ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.06)"}`,
                color: currency === c.code ? "#818cf8" : "#64748b",
              }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{c.symbol}</div>
                <div style={{ fontSize: 11 }}>{c.code}</div>
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Section 6: Système ── */}
      <SectionCard id="system" title="Système" icon={Server} open={open === "system"} onToggle={() => toggle("system")}>
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", display: "inline-block",
              background: health ? "#34d399" : "#f87171",
            }} />
            <span style={{ fontSize: 13, color: health ? "#34d399" : "#f87171" }}>
              Backend {health ? "en ligne" : "hors ligne"}
            </span>
            {health?.timestamp && (
              <span style={{ fontSize: 11, color: "#334155", fontFamily: "'DM Mono', monospace" }}>
                · {new Date(health.timestamp * 1000).toLocaleTimeString("fr-FR")}
              </span>
            )}
          </div>

          <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>Clés API</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 20 }}>
            {apiKeys.map(({ label, ok }) => (
              <div key={label} style={{
                padding: "8px 10px", borderRadius: 6, fontSize: 12,
                background: ok ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                border: `1px solid ${ok ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)"}`,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {ok !== undefined
                  ? (ok ? <Check size={11} color="#34d399" /> : <X size={11} color="#f87171" />)
                  : <span style={{ width: 11 }} />}
                <span style={{ color: ok ? "#34d399" : "#f87171" }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={exportSignals} style={{
              padding: "9px 16px", background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8,
              color: "#818cf8", cursor: "pointer", fontSize: 13,
            }}>
              ↓ Exporter signaux (CSV)
            </button>
            <button onClick={clearCache} style={{
              padding: "9px 16px", background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8,
              color: "#f87171", cursor: "pointer", fontSize: 13,
            }}>
              Vider le cache local
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
