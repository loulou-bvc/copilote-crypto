import { useState, useEffect, useRef, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const uniLink = (from, to, amt) =>
  `https://app.uniswap.org/#/swap?inputCurrency=${from}&outputCurrency=${to}&exactAmount=${amt}&exactField=input&chain=arbitrum`;

// ─── PRICE SIM ────────────────────────────────────────────────────────────────
let _m = 0, _p = 0;
function nextSim(p) {
  if (Math.random() < 0.04) _p = (Math.random() < 0.45 ? -1 : 1) * (0.025 + Math.random() * 0.055);
  else _p *= 0.65;
  _m = _m * 0.93 + (Math.random() - 0.5) * 0.003;
  return +(p * (1 + _m + (Math.random() - 0.5) * 0.007 + _p)).toFixed(2);
}

// ─── HOOKS ────────────────────────────────────────────────────────────────────
function useBackend() {
  const [backendOk, setBackendOk] = useState(false);
  const [ethPrice, setEthPrice] = useState(null);
  const [news, setNews] = useState([]);
  const [signals, setSignals] = useState([]);
  const [stats, setStats] = useState({});
  const [volRatio, setVolRatio] = useState(1);

  const poll = useCallback(async () => {
    try {
      const [priceRes, newsRes, sigRes, statRes] = await Promise.allSettled([
        fetch(`${BACKEND}/api/price`).then(r => r.json()),
        fetch(`${BACKEND}/api/news?limit=30`).then(r => r.json()),
        fetch(`${BACKEND}/api/signals`).then(r => r.json()),
        fetch(`${BACKEND}/api/stats`).then(r => r.json()),
      ]);
      if (priceRes.status === "fulfilled" && priceRes.value?.price) {
        setEthPrice(priceRes.value.price);
        setVolRatio(priceRes.value.volume_ratio || 1);
        setBackendOk(true);
      }
      if (newsRes.status === "fulfilled" && Array.isArray(newsRes.value)) setNews(newsRes.value);
      if (sigRes.status === "fulfilled" && Array.isArray(sigRes.value)) setSignals(sigRes.value);
      if (statRes.status === "fulfilled") setStats(statRes.value || {});
    } catch { setBackendOk(false); }
  }, []);

  useEffect(() => { poll(); const iv = setInterval(poll, 20000); return () => clearInterval(iv); }, [poll]);
  return { backendOk, ethPrice, news, signals, stats, volRatio };
}

function useWalletBalance(walletAddress) {
  const [ethBal, setEthBal] = useState(null);
  const [usdcBal, setUsdcBal] = useState(null);

  useEffect(() => {
    if (!walletAddress) return;
    const fetchBals = async () => {
      try {
        const rpc = async (method, params) => {
          const res = await fetch("https://arb1.arbitrum.io/rpc", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          });
          return (await res.json()).result;
        };
        const ethHex = await rpc("eth_getBalance", [walletAddress, "latest"]);
        const usdcData = "0x70a08231000000000000000000000000" + walletAddress.slice(2).padStart(64, "0");
        const usdcHex = await rpc("eth_call", [{ to: USDC_ARB, data: usdcData }, "latest"]);
        setEthBal(+(parseInt(ethHex, 16) / 1e18).toFixed(4));
        setUsdcBal(+(parseInt(usdcHex, 16) / 1e6).toFixed(2));
      } catch { /* silencieux */ }
    };
    fetchBals();
    const iv = setInterval(fetchBals, 30000);
    return () => clearInterval(iv);
  }, [walletAddress]);

  return { ethBal, usdcBal };
}

// ─── SPARKLINE (responsive via ResizeObserver) ────────────────────────────────
function Spark({ data, color, h = 48 }) {
  const containerRef = useRef(null);
  const [w, setW] = useState(300);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const validData = data && data.length >= 2;
  const gradId = `g${color.replace(/[^a-z0-9]/gi, "")}`;

  if (!validData) return <div ref={containerRef} style={{ width: "100%", height: h }} />;

  const min = Math.min(...data), max = Math.max(...data), r = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / r) * (h - 2) - 1}`).join(" ");

  return (
    <div ref={containerRef} style={{ width: "100%", lineHeight: 0 }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gradId})`} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 20, radius = 6 }) {
  return <div style={{ width: w, height: h, borderRadius: radius, background: "#0f1929", animation: "shimmer 1.5s infinite", backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg, #0f1929 25%, #162035 50%, #0f1929 75%)" }} />;
}

// ─── PRICE DISPLAY ────────────────────────────────────────────────────────────
function PriceNum({ value, size = 40, color = "#f1f5f9", prefix = "$" }) {
  if (value == null) return <Skeleton w={160} h={size * 0.8} radius={8} />;
  return (
    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: size, fontWeight: 500, color, letterSpacing: "-.02em" }}>
      {prefix}{typeof value === "number" ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
    </span>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage() {
  const { login } = usePrivy();
  return (
    <div style={{ minHeight: "100vh", background: "#060a12", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Syne:wght@700;800;900&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        button{cursor:pointer;border:none;font-family:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{opacity:.2}50%{opacity:.55}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "8%", left: "8%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,.13) 0%, transparent 65%)", animation: "glow 6s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "8%", right: "5%", width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,.08) 0%, transparent 65%)", animation: "glow 9s ease-in-out infinite 3s" }} />
      </div>

      <div style={{ width: "100%", maxWidth: 440, animation: "fadeUp .5s ease", position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(99,102,241,.15)", border: "1px solid rgba(99,102,241,.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 26, fontFamily: "'Syne',sans-serif", fontWeight: 900, color: "#6366f1" }}>⟠</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 30, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-.03em", marginBottom: 8 }}>Copilote Crypto</div>
          <div style={{ fontSize: 15, color: "#475569" }}>Ton assistant trading ETH personnel</div>
        </div>

        <div style={{ background: "#0c1220", border: "1px solid #1e2d4a", borderRadius: 24, padding: "32px", boxShadow: "0 32px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(99,102,241,.06), 0 8px 32px rgba(99,102,241,.08)" }}>
          <button
            onClick={login}
            style={{ width: "100%", padding: "18px", borderRadius: 14, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: "-.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, boxShadow: "0 8px 32px rgba(99,102,241,.4)", transition: "opacity .15s, transform .15s", border: "none" }}
            onMouseOver={e => { e.currentTarget.style.opacity = ".9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseOut={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}
          >
            <span style={{ fontSize: 22 }}>⟠</span>
            Connexion — Google · Email · Wallet
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, marginTop: 28, paddingTop: 24, borderTop: "1px solid #111c30" }}>
            {[["🔒", "Clé privée", "sécurisée"], ["🛡️", "Privy", "Auth"], ["🔗", "Arbitrum", "One"]].map(([icon, l1, l2]) => (
              <div key={l1} style={{ textAlign: "center", padding: "8px 4px" }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>{l1}</div>
                <div style={{ fontSize: 10, color: "#334155" }}>{l2}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#1e3a5f", letterSpacing: ".04em" }}>
          DyBlue · Copilote v3.0 · Arbitrum · Uniswap V3
        </div>
      </div>
    </div>
  );
}

// ─── WALLET PANEL ─────────────────────────────────────────────────────────────
function WalletPanel({ wallets, ethPrice }) {
  const activeWallet = wallets?.[0];
  const addr = activeWallet?.address;
  const { ethBal, usdcBal } = useWalletBalance(addr);
  const portfolioUSD = ethBal != null && ethPrice ? +(ethBal * ethPrice + (usdcBal || 0)).toFixed(2) : null;

  if (!activeWallet) {
    return (
      <div style={{ padding: "28px 24px", background: "#0c1220", border: "1px solid #1a2438", borderRadius: 16, textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "#0f1929", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, margin: "0 auto 12px" }}>💳</div>
        <div style={{ fontSize: 14, color: "#475569", marginBottom: 4 }}>Aucun wallet connecté</div>
        <div style={{ fontSize: 12, color: "#334155" }}>Connecte Exodus via WalletConnect pour voir tes soldes</div>
      </div>
    );
  }

  return (
    <div style={{ background: "#0c1220", border: "1px solid #1a2438", borderRadius: 16, padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 10, color: "#334155", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 5 }}>Wallet connecté</div>
          <div style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Mono', monospace", letterSpacing: ".02em" }}>
            {addr?.slice(0, 10)}···{addr?.slice(-8)}
          </div>
        </div>
        <div style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.18)", color: "#34d399", fontSize: 12, fontWeight: 600 }}>
          Arbitrum One
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { l: "ETH", v: ethBal, fmt: v => `${v}`, sub: ethBal != null && ethPrice ? `≈ $${(ethBal * ethPrice).toFixed(0)}` : null },
          { l: "USDC", v: usdcBal, fmt: v => `$${v}`, sub: "Stablecoin" },
          { l: "Total", v: portfolioUSD, fmt: v => `$${v.toLocaleString()}`, sub: "Portfolio" },
        ].map(r => (
          <div key={r.l} style={{ background: "#070d18", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "#334155", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>{r.l}</div>
            {r.v != null
              ? <div style={{ fontSize: 15, fontWeight: 500, color: "#f1f5f9", fontFamily: "'DM Mono', monospace", marginBottom: 3 }}>{r.fmt(r.v)}</div>
              : <Skeleton h={18} radius={4} />
            }
            {r.sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{r.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button
          onClick={() => window.open(uniLink(USDC_ARB, "ETH", (usdcBal || 0).toFixed(2)), "_blank")}
          style={{ padding: "12px", borderRadius: 12, background: "rgba(52,211,153,.07)", color: "#34d399", border: "1px solid rgba(52,211,153,.18)", fontSize: 13, fontWeight: 600, transition: "background .15s" }}
          onMouseOver={e => e.currentTarget.style.background = "rgba(52,211,153,.14)"}
          onMouseOut={e => e.currentTarget.style.background = "rgba(52,211,153,.07)"}
        >↑ Acheter ETH</button>
        <button
          onClick={() => window.open(uniLink("ETH", USDC_ARB, (ethBal || 0).toFixed(6)), "_blank")}
          style={{ padding: "12px", borderRadius: 12, background: "rgba(248,113,113,.07)", color: "#f87171", border: "1px solid rgba(248,113,113,.18)", fontSize: 13, fontWeight: 600, transition: "background .15s" }}
          onMouseOver={e => e.currentTarget.style.background = "rgba(248,113,113,.14)"}
          onMouseOut={e => e.currentTarget.style.background = "rgba(248,113,113,.07)"}
        >↓ Vendre ETH</button>
      </div>
    </div>
  );
}

// ─── NEWS FEED ────────────────────────────────────────────────────────────────
function NewsFeed({ news, signals }) {
  const [tab, setTab] = useState("news");
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? news : news.filter(n => n.sentiment === filter);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 2, background: "#070d18", border: "1px solid #111c30", borderRadius: 12, padding: 3 }}>
          {[["news", "News", news.length], ["signals", "Signaux", signals.length]].map(([k, l, count]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: tab === k ? 600 : 400,
              background: tab === k ? "#0f1929" : "transparent",
              color: tab === k ? "#f1f5f9" : "#475569",
              display: "flex", alignItems: "center", gap: 8, border: `1px solid ${tab === k ? "#1e2d4a" : "transparent"}`,
              transition: "all .15s",
            }}>
              {l}
              <span style={{ background: tab === k ? "rgba(99,102,241,.2)" : "#0c1220", color: tab === k ? "#a5b4fc" : "#334155", borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {tab === "news" && (
          <div style={{ display: "flex", gap: 6 }}>
            {[["all", "Toutes"], ["bullish", "📈 Haussier"], ["bearish", "📉 Baissier"]].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                background: filter === k ? "#6366f1" : "transparent",
                color: filter === k ? "#fff" : "#475569",
                border: `1px solid ${filter === k ? "#6366f1" : "#1a2438"}`,
                transition: "all .15s",
              }}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {tab === "news" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 540, overflowY: "auto", paddingRight: 2 }}>
          {filtered.length === 0 ? (
            <div style={{ background: "#0c1220", border: "1px solid #1a2438", borderRadius: 16, padding: "52px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
              <div style={{ fontSize: 14, color: "#475569" }}>Lance le backend pour voir les news en direct</div>
            </div>
          ) : filtered.map(n => {
            const isBull = n.sentiment === "bullish", isBear = n.sentiment === "bearish";
            const c = isBull ? "#34d399" : isBear ? "#f87171" : "#475569";
            return (
              <div key={n.id} style={{ padding: "15px 18px", borderRadius: 14, background: "#0c1220", borderLeft: `3px solid ${c}`, border: `1px solid ${c}22`, borderLeftColor: c, animation: "fadeUp .3s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                  <span style={{ fontSize: 13 }}>{isBull ? "📈" : isBear ? "📉" : "➡️"}</span>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{n.source}</span>
                  <span style={{ padding: "2px 8px", borderRadius: 6, background: c + "16", color: c, fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                    {(n.score || 0) > 0 ? "+" : ""}{(n.score || 0).toFixed(2)}
                  </span>
                  {n.signal && <span style={{ padding: "2px 7px", borderRadius: 5, background: "rgba(251,191,36,.12)", color: "#fbbf24", fontSize: 10, fontWeight: 700, letterSpacing: ".04em" }}>⚡ SIGNAL</span>}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "#334155", fontFamily: "'DM Mono', monospace" }}>
                    {n.timestamp ? new Date(n.timestamp * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.55, marginBottom: 10 }}>{n.title}</div>
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#475569" }}>
                  <span>Impact <span style={{ color: (n.impact || 0) >= 7 ? "#f87171" : (n.impact || 0) >= 5 ? "#fbbf24" : "#34d399", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{n.impact}/10</span></span>
                  <span>Vol <span style={{ color: (n.volume_ratio || 1) >= 2 ? "#f87171" : (n.volume_ratio || 1) >= 1.5 ? "#fbbf24" : "#64748b", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{(n.volume_ratio || 1).toFixed(1)}×</span></span>
                  {n.move_15min != null && <span>+15min <span style={{ color: n.move_15min > 0 ? "#34d399" : "#f87171", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{n.move_15min > 0 ? "+" : ""}{n.move_15min.toFixed(2)}%</span></span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "signals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 540, overflowY: "auto", paddingRight: 2 }}>
          {signals.length === 0 ? (
            <div style={{ background: "#0c1220", border: "1px solid #1a2438", borderRadius: 16, padding: "52px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
              <div style={{ fontSize: 14, color: "#475569", maxWidth: 280, margin: "0 auto" }}>
                Aucun signal — conditions : sentiment {">"} 0.65 ET volume {">"} 1.5×
              </div>
            </div>
          ) : signals.map(s => {
            const isBull = s.direction === "bullish";
            const c = isBull ? "#34d399" : "#f87171";
            return (
              <div key={s.id} style={{ padding: "18px 20px", borderRadius: 16, background: c + "07", border: `1px solid ${c}25`, borderLeft: `3px solid ${c}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: c + "16", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                      {isBull ? "🟢" : "🔴"}
                    </div>
                    <div>
                      <div style={{ display: "inline-block", padding: "3px 8px", borderRadius: 6, background: c + "16", color: c, fontSize: 11, fontWeight: 700, letterSpacing: ".05em", marginBottom: 4 }}>
                        {isBull ? "HAUSSIER" : "BAISSIER"}
                      </div>
                      <div style={{ fontSize: 12, color: "#475569" }}>{s.source}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 500, color: c, lineHeight: 1 }}>{Math.round((s.confidence || 0) * 100)}%</div>
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 3, letterSpacing: ".06em", textTransform: "uppercase" }}>confiance</div>
                  </div>
                </div>
                {s.news_title && (
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12, padding: "8px 12px", background: "#070d18", borderRadius: 8, lineHeight: 1.55 }}>
                    "{s.news_title}"
                  </div>
                )}
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#475569" }}>
                  <span>Vol <span style={{ color: (s.volume_ratio || 1) >= 2 ? "#f87171" : "#fbbf24", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{(s.volume_ratio || 1).toFixed(1)}×</span></span>
                  <span>Prix <span style={{ color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>${s.price?.toFixed(0)}</span></span>
                  {s.result_15min != null && <span>+15min <span style={{ color: s.result_15min > 0 ? "#34d399" : "#f87171", fontFamily: "'DM Mono', monospace" }}>{s.result_15min > 0 ? "+" : ""}{s.result_15min.toFixed(2)}%</span></span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const { backendOk, ethPrice, news, signals, stats, volRatio } = useBackend();

  const [page, setPage] = useState("home");
  const [prices, setPrices] = useState(() =>
    Array.from({ length: 40 }, () => +(2420 + (Math.random() - 0.5) * 80).toFixed(2))
  );
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef(null);

  const cur = ethPrice || prices[prices.length - 1];

  useEffect(() => {
    if (ethPrice) { setPrices(p => [...p.slice(-99), ethPrice]); }
    else {
      const iv = setInterval(() => setPrices(p => [...p.slice(-99), nextSim(p[p.length - 1])]), 3000);
      return () => clearInterval(iv);
    }
  }, [ethPrice]);

  const userEmail = user?.email?.address || user?.google?.email || "";
  const userName = user?.google?.name || userEmail.split("@")[0] || "Trader";
  const activeWallet = wallets?.[0];

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatLoading(true);
    setChatHistory(h => [...h, { role: "user", content: msg }]);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 400,
          system: `Tu es le copilote crypto de ${userName}. Contexte: Prix ETH $${cur}, ${backendOk ? `${news.length} news analysées, ${signals.length} signaux récents` : "backend hors ligne"}. Réponds en français, concis, sans jargon.`,
          messages: [...chatHistory, { role: "user", content: msg }],
        }),
      });
      const data = await res.json();
      const reply = data.content?.find(b => b.type === "text")?.text || "Erreur de connexion.";
      setChatHistory(h => [...h, { role: "assistant", content: reply }]);
      setTimeout(() => chatRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 100);
    } catch {
      setChatHistory(h => [...h, { role: "assistant", content: "Erreur — vérifie ta connexion." }]);
    }
    setChatLoading(false);
  }, [chatInput, chatLoading, chatHistory, userName, cur, backendOk, news, signals]);

  const change = prices.length > 1 ? +((cur - prices[0]) / prices[0] * 100).toFixed(2) : 0;
  const isUp = change >= 0;
  const chartColor = isUp ? "#34d399" : "#f87171";

  const nav = [
    { key: "home",   icon: "⌂",  label: "Accueil",   section: null },
    { key: "live",   icon: "◎",  label: "Marché",    section: "TRADING" },
    { key: "news",   icon: "◉",  label: "News",      section: null },
    { key: "wallet", icon: "◫",  label: "Wallet",    section: "COMPTE" },
    { key: "chat",   icon: "◌",  label: "Copilote",  section: null },
  ];

  if (!ready) return (
    <div style={{ minHeight: "100vh", background: "#060a12", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, border: "2.5px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!authenticated) return <LoginPage />;

  // Section labels in nav
  const navWithSections = [];
  let lastSection = undefined;
  for (const item of nav) {
    if (item.section !== null && item.section !== lastSection) {
      navWithSections.push({ type: "section", label: item.section });
      lastSection = item.section;
    }
    navWithSections.push({ type: "item", ...item });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#060a12", color: "#e2e8f0", fontFamily: "'DM Sans',system-ui,sans-serif", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Syne:wght@700;800;900&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        button{cursor:pointer;border:none;font-family:inherit;transition:all .15s}
        button:active{transform:scale(.97)}
        input:focus{outline:none}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1a2438;border-radius:4px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes livepulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
        @keyframes dotpulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        .fadein{animation:fadeUp .35s ease}

        /* Sidebar nav */
        .nav-btn{
          display:flex;align-items:center;gap:10px;
          width:100%;padding:9px 14px;border-radius:10px;
          background:transparent;border:none;text-align:left;
          font-size:13px;font-weight:500;color:#475569;
          cursor:pointer;transition:all .15s;position:relative;
        }
        .nav-btn:hover{background:rgba(99,102,241,.07);color:#94a3b8}
        .nav-btn.active{background:rgba(99,102,241,.12);color:#818cf8;font-weight:600}
        .nav-btn.active::before{content:'';position:absolute;left:-12px;top:50%;transform:translateY(-50%);width:3px;height:18px;background:#6366f1;border-radius:0 3px 3px 0}

        /* Action cards */
        .action-card{background:#0c1220;border:1px solid #1a2438;border-radius:16px;padding:22px;text-align:left;cursor:pointer;width:100%;transition:all .15s}
        .action-card:hover{border-color:#243354;background:#0e1b2e;transform:translateY(-1px)}

        /* Mobile */
        @media(max-width:768px){
          .sidebar{display:none !important}
          .main{margin-left:0 !important;max-width:100vw !important;padding-bottom:80px !important}
          .mobile-nav{display:flex !important}
        }
        @media(min-width:769px){.mobile-nav{display:none !important}}
      `}</style>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <div className="sidebar" style={{ width: 240, background: "#070d18", borderRight: "1px solid #111c30", display: "flex", flexDirection: "column", padding: "20px 12px", position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 100, overflowY: "auto" }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 14px 28px" }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(99,102,241,.15)", border: "1px solid rgba(99,102,241,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontFamily: "'Syne',sans-serif", fontWeight: 900, color: "#6366f1", flexShrink: 0 }}>⟠</div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-.02em" }}>Copilote</div>
            <div style={{ fontSize: 10, color: "#334155", letterSpacing: ".04em" }}>Crypto · v3.0</div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, paddingLeft: 0 }}>
          {navWithSections.map((item, i) =>
            item.type === "section" ? (
              <div key={`s-${i}`} style={{ fontSize: 10, color: "#1e3a5f", letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600, padding: "16px 14px 6px" }}>{item.label}</div>
            ) : (
              <button key={item.key} onClick={() => setPage(item.key)} className={`nav-btn${page === item.key ? " active" : ""}`}>
                <span style={{ fontSize: 15, width: 18, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                {item.label}
                {item.key === "news" && news.length > 0 && (
                  <span style={{ marginLeft: "auto", background: "rgba(99,102,241,.18)", color: "#a5b4fc", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{news.length}</span>
                )}
                {item.key === "news" && signals.length > 0 && (
                  <span style={{ marginLeft: news.length > 0 ? 4 : "auto", background: "rgba(251,191,36,.12)", color: "#fbbf24", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>⚡{signals.length}</span>
                )}
              </button>
            )
          )}
        </nav>

        {/* Bottom */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, borderTop: "1px solid #111c30" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: backendOk ? "rgba(52,211,153,.06)" : "rgba(248,113,113,.06)", border: `1px solid ${backendOk ? "rgba(52,211,153,.14)" : "rgba(248,113,113,.14)"}` }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: backendOk ? "#34d399" : "#f87171", flexShrink: 0, animation: backendOk ? "livepulse 2.5s ease-in-out infinite" : "none" }} />
            <span style={{ fontSize: 11, color: backendOk ? "#34d399" : "#f87171", fontWeight: 500 }}>{backendOk ? "Backend live" : "Hors ligne"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
            </div>
            <button onClick={logout} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(248,113,113,.07)", border: "1px solid rgba(248,113,113,.18)", color: "#f87171", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }} title="Déconnexion">↩</button>
          </div>
        </div>
      </div>

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <div className="main" style={{ marginLeft: 240, flex: 1, padding: "32px 36px", maxWidth: "calc(100vw - 240px)" }}>

        {/* ── HOME ───────────────────────────────────────────────────────── */}
        {page === "home" && (
          <div className="fadein">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
              <div>
                <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-.03em", marginBottom: 4 }}>Bonjour {userName} 👋</h1>
                <p style={{ fontSize: 13, color: "#475569" }}>
                  {userEmail || (activeWallet ? `${activeWallet.address.slice(0, 10)}···` : "Bienvenue sur ton dashboard")}
                </p>
              </div>
              <div style={{ fontSize: 12, color: "#334155", textAlign: "right", paddingTop: 4 }}>
                {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            </div>

            {/* ETH Hero card */}
            <div style={{ background: "linear-gradient(160deg, #0e1d30 0%, #0a1120 100%)", border: "1px solid #1e2d4a", borderRadius: 22, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden", boxShadow: "0 0 0 1px rgba(99,102,241,.06), 0 8px 32px rgba(99,102,241,.08), 0 32px 64px rgba(0,0,0,.35)" }}>
              <div style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,.1) 0%, transparent 65%)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: -40, left: "35%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,.05) 0%, transparent 65%)", pointerEvents: "none" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
                <div>
                  <div style={{ fontSize: 10, color: "#334155", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>Prix ETH / USD</div>
                  <PriceNum value={cur} size={46} />
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: chartColor, fontWeight: 500 }}>
                      {isUp ? "▲" : "▼"} {Math.abs(change)}%
                    </span>
                    <span style={{ fontSize: 12, color: "#334155" }}>
                      {backendOk ? "· Binance live" : "· Simulation locale"}
                    </span>
                  </div>
                </div>
                <div style={{ width: 200, paddingTop: 4 }}>
                  <Spark data={prices.slice(-40)} color={chartColor} h={64} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginTop: 28, paddingTop: 24, borderTop: "1px solid #131f35" }}>
                {[
                  { l: "Volume spike", v: `${volRatio.toFixed(2)}×`, c: volRatio >= 2 ? "#f87171" : volRatio >= 1.5 ? "#fbbf24" : "#34d399" },
                  { l: "News analysées", v: stats.news_analyzed ?? news.length, c: "#a5b4fc" },
                  { l: "Signaux émis", v: stats.signals_total ?? signals.length, c: "#fbbf24" },
                  { l: "Précision", v: stats.signal_accuracy != null ? `${stats.signal_accuracy}%` : "—", c: (stats.signal_accuracy || 0) >= 60 ? "#34d399" : "#94a3b8" },
                ].map(s => (
                  <div key={s.l}>
                    <div style={{ fontSize: 10, color: "#334155", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>{s.l}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 500, color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Wallet */}
            <div style={{ marginBottom: 20 }}>
              <WalletPanel wallets={wallets} ethPrice={cur} />
            </div>

            {/* Quick actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { icon: "📡", title: "News live", desc: `${news.length} articles depuis CryptoPanic, NewsData.io & LunarCrush`, page: "news", accent: "#6366f1" },
                { icon: "⚡", title: "Signaux de trading", desc: `${signals.length} signal${signals.length > 1 ? "aux" : ""} actif${signals.length > 1 ? "s" : ""} — sentiment + volume Binance`, page: "news", accent: "#fbbf24" },
                { icon: "💳", title: "Wallet & Swaps", desc: activeWallet ? `${activeWallet.address.slice(0, 10)}··· · Arbitrum One` : "Connecte ton wallet Exodus via WalletConnect", page: "wallet", accent: "#34d399" },
                { icon: "💬", title: "Copilote Claude", desc: "Pose une question sur le marché en temps réel", page: "chat", accent: "#a78bfa" },
              ].map(c => (
                <button key={c.title} className="action-card" onClick={() => setPage(c.page)}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: c.accent + "16", border: `1px solid ${c.accent}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 14 }}>{c.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>{c.title}</div>
                  <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.55 }}>{c.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── MARCHÉ ─────────────────────────────────────────────────────── */}
        {page === "live" && (
          <div className="fadein">
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-.02em", marginBottom: 4 }}>Marché en direct</h1>
              <p style={{ fontSize: 13, color: "#475569" }}>ETH/USDT · Arbitrum · {backendOk ? "Données Binance en temps réel" : "Simulation locale"}</p>
            </div>

            {/* Main chart card */}
            <div style={{ background: "#0c1220", border: "1px solid #1a2438", borderRadius: 20, padding: "24px 28px 20px", marginBottom: 16, boxShadow: "0 0 0 1px rgba(99,102,241,.04), 0 8px 32px rgba(0,0,0,.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#334155", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>Prix ETH / USD</div>
                  <PriceNum value={cur} size={42} />
                  <div style={{ marginTop: 6, fontFamily: "'DM Mono', monospace", fontSize: 13, color: chartColor, fontWeight: 500 }}>
                    {isUp ? "▲" : "▼"} {Math.abs(change)}%
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ background: "#070d18", border: "1px solid #111c30", borderRadius: 12, padding: "12px 18px" }}>
                    <div style={{ fontSize: 10, color: "#334155", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Volume spike</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 500, color: volRatio >= 2 ? "#f87171" : volRatio >= 1.5 ? "#fbbf24" : "#34d399" }}>{volRatio.toFixed(2)}×</div>
                  </div>
                  <div style={{ background: "#070d18", border: "1px solid #111c30", borderRadius: 12, padding: "12px 18px" }}>
                    <div style={{ fontSize: 10, color: "#334155", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Source</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: backendOk ? "#34d399" : "#f87171", animation: backendOk ? "livepulse 2.5s infinite" : "none" }} />
                      <span style={{ fontSize: 14, color: backendOk ? "#34d399" : "#f87171", fontWeight: 600 }}>{backendOk ? "Binance" : "Simulation"}</span>
                    </div>
                  </div>
                </div>
              </div>
              <Spark data={prices} color={chartColor} h={120} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {[
                { l: "News analysées", v: stats.news_analyzed ?? news.length, c: "#a5b4fc", s: "dernières 24h" },
                { l: "Signaux actifs", v: signals.length, c: "#fbbf24", s: "seuil sentiment ≥ 0.65" },
                { l: "Précision signaux", v: stats.signal_accuracy != null ? `${stats.signal_accuracy}%` : "—", c: (stats.signal_accuracy || 0) >= 60 ? "#34d399" : "#94a3b8", s: "sur signaux fermés" },
              ].map(s => (
                <div key={s.l} style={{ background: "#0c1220", border: "1px solid #1a2438", borderRadius: 14, padding: "18px 20px" }}>
                  <div style={{ fontSize: 10, color: "#334155", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>{s.l}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 500, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{s.s}</div>
                </div>
              ))}
            </div>

            {!backendOk && (
              <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: 12, background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.18)", color: "#f87171", fontSize: 13 }}>
                ⚠️ Backend hors ligne — lance <code style={{ background: "rgba(248,113,113,.12)", padding: "1px 7px", borderRadius: 5, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>python backend_v3.py</code>
              </div>
            )}
          </div>
        )}

        {/* ── NEWS ───────────────────────────────────────────────────────── */}
        {page === "news" && (
          <div className="fadein">
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-.02em", marginBottom: 4 }}>News & Signaux</h1>
              <p style={{ fontSize: 13, color: "#475569" }}>Sources : CryptoPanic · NewsData.io · LunarCrush · RSS CoinDesk</p>
            </div>
            <NewsFeed news={news} signals={signals} />
          </div>
        )}

        {/* ── WALLET ─────────────────────────────────────────────────────── */}
        {page === "wallet" && (
          <div className="fadein">
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-.02em", marginBottom: 4 }}>Wallet & Swaps</h1>
              <p style={{ fontSize: 13, color: "#475569" }}>Arbitrum One · Uniswap V3</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <WalletPanel wallets={wallets} ethPrice={cur} />
            </div>
            <div style={{ background: "#0c1220", border: "1px solid #1a2438", borderRadius: 16, padding: "22px 24px" }}>
              <div style={{ fontSize: 12, color: "#475569", letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 18 }}>Comment connecter Exodus</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  ["01", "Ouvre Exodus sur ton téléphone"],
                  ["02", "Va dans Settings → WalletConnect"],
                  ["03", "Scanne le QR code Privy sur le web"],
                  ["04", "Ton wallet apparaît ici avec tes soldes en direct"],
                ].map(([step, text]) => (
                  <div key={step} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#6366f1", fontWeight: 500, paddingTop: 2, flexShrink: 0 }}>{step}</div>
                    <div style={{ width: 1, background: "#111c30", alignSelf: "stretch", flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CHAT ───────────────────────────────────────────────────────── */}
        {page === "chat" && (
          <div className="fadein" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-.02em", marginBottom: 4 }}>Copilote Claude</h1>
              <p style={{ fontSize: 13, color: "#475569" }}>
                Connaît le prix ETH (<span style={{ fontFamily: "'DM Mono', monospace", color: "#94a3b8" }}>${cur.toFixed(0)}</span>), les {news.length} dernières news et tes {signals.length} signaux
              </p>
            </div>

            <div ref={chatRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, marginBottom: 16, paddingRight: 2 }}>
              {chatHistory.length === 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "#334155", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Suggestions</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      "Est-ce que c'est le bon moment pour acheter de l'ETH ?",
                      "Résume les dernières news importantes du marché",
                      `Analyse le prix actuel de $${cur.toFixed(0)} et donne une perspective`,
                    ].map(q => (
                      <button key={q} onClick={() => setChatInput(q)} style={{ padding: "14px 18px", borderRadius: 12, background: "#0c1220", border: "1px solid #1a2438", color: "#64748b", fontSize: 13, textAlign: "left", lineHeight: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
                        onMouseOver={e => { e.currentTarget.style.borderColor = "#243354"; e.currentTarget.style.color = "#94a3b8"; }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = "#1a2438"; e.currentTarget.style.color = "#64748b"; }}
                      >
                        <span>{q}</span>
                        <span style={{ color: "#1e3a5f", flexShrink: 0 }}>→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatHistory.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 10 }}>
                  {m.role === "assistant" && (
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#fff", flexShrink: 0, marginTop: 2, fontFamily: "'Syne',sans-serif" }}>⟠</div>
                  )}
                  <div style={{ maxWidth: "74%", padding: "13px 18px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: m.role === "user" ? "linear-gradient(135deg, #4f52cc, #7c3aed)" : "#0f1929", border: m.role === "user" ? "none" : "1px solid #1a2438", color: "#f1f5f9", fontSize: 14, lineHeight: 1.65, boxShadow: m.role === "user" ? "0 4px 20px rgba(99,102,241,.25)" : "none" }}>
                    {m.content}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "'Syne',sans-serif", fontWeight: 900, color: "#fff" }}>⟠</div>
                  <div style={{ padding: "14px 18px", background: "#0f1929", border: "1px solid #1a2438", borderRadius: "18px 18px 18px 4px", display: "flex", gap: 5, alignItems: "center" }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", animation: `dotpulse 1.4s ease-in-out ${i * 0.18}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Pose une question sur le marché…"
                style={{ flex: 1, padding: "15px 20px", borderRadius: 16, background: "#0c1220", border: "1px solid #1a2438", color: "#e2e8f0", fontSize: 14, transition: "border-color .15s" }}
                onFocus={e => e.target.style.borderColor = "#6366f1"}
                onBlur={e => e.target.style.borderColor = "#1a2438"}
              />
              <button
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim()}
                style={{ padding: "15px 22px", borderRadius: 16, fontSize: 16, fontWeight: 700, background: chatLoading || !chatInput.trim() ? "#0c1220" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: chatLoading || !chatInput.trim() ? "#334155" : "#fff", border: `1px solid ${chatLoading || !chatInput.trim() ? "#1a2438" : "transparent"}`, boxShadow: chatLoading || !chatInput.trim() ? "none" : "0 4px 20px rgba(99,102,241,.35)" }}
              >→</button>
            </div>
          </div>
        )}
      </div>

      {/* ── MOBILE BOTTOM NAV ─────────────────────────────────────────────── */}
      <div className="mobile-nav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#070d18", borderTop: "1px solid #111c30", padding: "6px 0 2px", zIndex: 100, justifyContent: "space-around" }}>
        {nav.filter(n => n.type !== "section").map(n => (
          <button key={n.key} onClick={() => setPage(n.key)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 10px", borderRadius: 10, background: "transparent", border: "none", color: page === n.key ? "#818cf8" : "#475569", fontSize: 10, fontWeight: page === n.key ? 600 : 400 }}>
            <span style={{ fontSize: 20 }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}
