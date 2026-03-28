import { useState, useEffect, useRef, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Backend Railway — change cette URL après déploiement
const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

// Uniswap Arbitrum deep links
const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const uniLink  = (from, to, amt) =>
  `https://app.uniswap.org/#/swap?inputCurrency=${from}&outputCurrency=${to}&exactAmount=${amt}&exactField=input&chain=arbitrum`;

// ─── PRICE SIM (remplacé par vrai prix backend en prod) ───────────────────────
let _m = 0, _p = 0;
function nextSim(p) {
  if (Math.random() < 0.04) _p = (Math.random() < 0.45 ? -1 : 1) * (0.025 + Math.random() * 0.055);
  else _p *= 0.65;
  _m = _m * 0.93 + (Math.random() - 0.5) * 0.003;
  return +(p * (1 + _m + (Math.random() - 0.5) * 0.007 + _p)).toFixed(2);
}

// ─── HOOKS ────────────────────────────────────────────────────────────────────
function useBackend() {
  const [backendOk,  setBackendOk]  = useState(false);
  const [ethPrice,   setEthPrice]   = useState(null);
  const [news,       setNews]       = useState([]);
  const [signals,    setSignals]    = useState([]);
  const [stats,      setStats]      = useState({});
  const [volRatio,   setVolRatio]   = useState(1);

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
      if (newsRes.status  === "fulfilled" && Array.isArray(newsRes.value))  setNews(newsRes.value);
      if (sigRes.status   === "fulfilled" && Array.isArray(sigRes.value))   setSignals(sigRes.value);
      if (statRes.status  === "fulfilled") setStats(statRes.value || {});
    } catch { setBackendOk(false); }
  }, []);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 20000);
    return () => clearInterval(iv);
  }, [poll]);

  return { backendOk, ethPrice, news, signals, stats, volRatio };
}

function useWalletBalance(walletAddress) {
  const [ethBal,  setEthBal]  = useState(null);
  const [usdcBal, setUsdcBal] = useState(null);

  useEffect(() => {
    if (!walletAddress) return;
    const fetchBals = async () => {
      try {
        const rpc = async (method, params) => {
          const res = await fetch("https://arb1.arbitrum.io/rpc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          });
          return (await res.json()).result;
        };
        const ethHex  = await rpc("eth_getBalance", [walletAddress, "latest"]);
        const usdcData = "0x70a08231000000000000000000000000" + walletAddress.slice(2).padStart(64, "0");
        const usdcHex = await rpc("eth_call", [{ to: USDC_ARB, data: usdcData }, "latest"]);
        setEthBal(+(parseInt(ethHex, 16) / 1e18).toFixed(4));
        setUsdcBal(+(parseInt(usdcHex, 16) / 1e6).toFixed(2));
      } catch { /* silencieux si wallet pas encore connecté */ }
    };
    fetchBals();
    const iv = setInterval(fetchBals, 30000);
    return () => clearInterval(iv);
  }, [walletAddress]);

  return { ethBal, usdcBal };
}

// ─── SPARKLINE ────────────────────────────────────────────────────────────────
function Spark({ data, color, h = 36, w = 100 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), r = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / r) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`g${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#g${color.slice(1)})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage() {
  const { login } = usePrivy();
  return (
    <div style={{ minHeight: "100vh", background: "#050810", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        button{cursor:pointer;border:none;font-family:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{opacity:.3}50%{opacity:.7}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "15%", left: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,.12) 0%, transparent 70%)", animation: "glow 5s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "8%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,.08) 0%, transparent 70%)", animation: "glow 7s ease-in-out infinite 2s" }} />
      </div>

      <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp .5s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 40, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-.03em", marginBottom: 8 }}>⟠</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-.02em", marginBottom: 6 }}>Copilote Crypto</div>
          <div style={{ fontSize: 14, color: "#475569" }}>Ton assistant trading ETH personnel</div>
        </div>

        <div style={{ background: "#0c1220", border: "1px solid #1a2438", borderRadius: 20, padding: 28 }}>
          <div style={{ fontSize: 13, color: "#475569", textAlign: "center", marginBottom: 20 }}>
            Connecte-toi pour accéder au dashboard
          </div>
          <button
            onClick={login}
            style={{ width: "100%", padding: "16px", borderRadius: 14, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: "-.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 8px 32px rgba(99,102,241,.35)", transition: "opacity .15s" }}
            onMouseOver={e => e.currentTarget.style.opacity = ".9"}
            onMouseOut={e => e.currentTarget.style.opacity = "1"}
          >
            <span style={{ fontSize: 20 }}>⟠</span>
            Connexion — Google · Email · Wallet
          </button>
          <div style={{ marginTop: 20, display: "flex", gap: 12, justifyContent: "center", fontSize: 11, color: "#1e3a5f" }}>
            <span>🔒 Clé privée jamais exposée</span>
            <span>·</span>
            <span>🛡️ Privy sécurisé</span>
            <span>·</span>
            <span>🔗 Arbitrum</span>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#1e3a5f" }}>
          DyBlue · Copilote v2.0 · Arbitrum · Uniswap V3
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
      <div style={{ padding: "12px 16px", background: "#0c1220", border: "1px solid #1a2438", borderRadius: 12, fontSize: 12, color: "#475569" }}>
        Aucun wallet externe connecté — utilise ton Exodus via Uniswap
      </div>
    );
  }

  return (
    <div style={{ background: "#0c1220", border: "1px solid #1a2438", borderRadius: 14, padding: "14px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: "#334155", marginBottom: 2 }}>WALLET CONNECTÉ</div>
          <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>
            {addr?.slice(0, 8)}...{addr?.slice(-6)}
          </div>
        </div>
        <div style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(52,211,153,.1)", border: "1px solid rgba(52,211,153,.2)", color: "#34d399", fontSize: 10, fontWeight: 600 }}>
          Arbitrum
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { l: "ETH", v: ethBal != null ? `${ethBal}` : "...", s: ethBal != null && ethPrice ? `$${(ethBal * ethPrice).toFixed(0)}` : "" },
          { l: "USDC", v: usdcBal != null ? `$${usdcBal}` : "...", s: "" },
          { l: "Total", v: portfolioUSD != null ? `$${portfolioUSD.toLocaleString()}` : "...", s: "" },
        ].map(r => (
          <div key={r.l} style={{ background: "#070d18", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 9, color: "#334155", marginBottom: 2 }}>{r.l}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{r.v}</div>
            {r.s && <div style={{ fontSize: 9, color: "#475569" }}>{r.s}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <button
          onClick={() => window.open(uniLink(USDC_ARB, "ETH", (usdcBal || 0).toFixed(2)), "_blank")}
          style={{ padding: "9px", borderRadius: 9, background: "rgba(52,211,153,.08)", color: "#34d399", border: "1px solid rgba(52,211,153,.2)", fontSize: 12, fontWeight: 600 }}
        >💚 Acheter ETH</button>
        <button
          onClick={() => window.open(uniLink("ETH", USDC_ARB, (ethBal || 0).toFixed(6)), "_blank")}
          style={{ padding: "9px", borderRadius: 9, background: "rgba(248,113,113,.08)", color: "#f87171", border: "1px solid rgba(248,113,113,.2)", fontSize: 12, fontWeight: 600 }}
        >❤️ Vendre ETH</button>
      </div>
    </div>
  );
}

// ─── NEWS FEED ────────────────────────────────────────────────────────────────
function NewsFeed({ news, signals, stats, volRatio }) {
  const [tab, setTab]       = useState("news");
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? news : news.filter(n => n.sentiment === filter);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 3, background: "#0c1220", border: "1px solid #1a2438", borderRadius: 9, padding: 3 }}>
          {[["news", `📰 News (${news.length})`], ["signals", `⚡ Signaux (${signals.length})`]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: "6px 14px", borderRadius: 6, background: tab === k ? "#1a2438" : "transparent", color: tab === k ? "#f1f5f9" : "#475569", fontSize: 12, fontWeight: 500 }}>{l}</button>
          ))}
        </div>
        {tab === "news" && (
          <div style={{ display: "flex", gap: 4 }}>
            {[["all","Toutes"],["bullish","📈"],["bearish","📉"]].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} style={{ padding: "5px 10px", borderRadius: 20, background: filter === k ? "#6366f1" : "#0c1220", color: filter === k ? "#fff" : "#475569", border: `1px solid ${filter === k ? "#6366f1" : "#1a2438"}`, fontSize: 11 }}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {tab === "news" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ background: "#0c1220", border: "1px solid #1a2438", borderRadius: 12, padding: "40px 20px", textAlign: "center", color: "#334155", fontSize: 12 }}>
              Lance le backend pour voir les news en direct
            </div>
          ) : filtered.map(n => {
            const c = n.sentiment === "bullish" ? "#34d399" : n.sentiment === "bearish" ? "#f87171" : "#64748b";
            return (
              <div key={n.id} style={{ padding: "12px 14px", borderRadius: 11, background: "#0c1220", border: `1px solid ${c}22`, animation: "fadeUp .3s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11 }}>{n.sentiment === "bullish" ? "📈" : n.sentiment === "bearish" ? "📉" : "➡️"}</span>
                  <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{n.source}</span>
                  <span style={{ padding: "1px 6px", borderRadius: 6, background: c + "15", color: c, fontSize: 9, fontWeight: 700 }}>
                    {(n.score || 0) > 0 ? "+" : ""}{(n.score || 0).toFixed(2)}
                  </span>
                  {n.signal && <span style={{ padding: "1px 6px", borderRadius: 6, background: "rgba(251,191,36,.15)", color: "#fbbf24", fontSize: 9, fontWeight: 700 }}>⚡ SIGNAL</span>}
                  <span style={{ marginLeft: "auto", fontSize: 9, color: "#334155" }}>
                    {n.timestamp ? new Date(n.timestamp * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, marginBottom: 6 }}>{n.title}</div>
                <div style={{ display: "flex", gap: 10, fontSize: 10, color: "#334155" }}>
                  <span>Impact <span style={{ color: (n.impact || 0) >= 7 ? "#f87171" : (n.impact || 0) >= 5 ? "#fbbf24" : "#34d399" }}>{n.impact}/10</span></span>
                  <span>Vol <span style={{ color: (n.volume_ratio || 1) >= 2 ? "#f87171" : "#64748b" }}>{(n.volume_ratio || 1).toFixed(1)}x</span></span>
                  {n.move_15min != null && <span>+15min <span style={{ color: n.move_15min > 0 ? "#34d399" : "#f87171" }}>{n.move_15min > 0 ? "+" : ""}{n.move_15min.toFixed(2)}%</span></span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "signals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto" }}>
          {signals.length === 0 ? (
            <div style={{ background: "#0c1220", border: "1px solid #1a2438", borderRadius: 12, padding: "40px 20px", textAlign: "center", color: "#334155", fontSize: 12 }}>
              Aucun signal encore — les signaux apparaissent quand sentiment {">"} 0.65 ET volume {">"} 1.5x
            </div>
          ) : signals.map(s => {
            const isBull = s.direction === "bullish";
            const c = isBull ? "#34d399" : "#f87171";
            return (
              <div key={s.id} style={{ padding: "14px 16px", borderRadius: 12, background: c + "06", border: `1px solid ${c}25` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{isBull ? "🟢" : "🔴"}</span>
                    <div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 800, color: c }}>{isBull ? "SIGNAL HAUSSIER" : "SIGNAL BAISSIER"}</div>
                      <div style={{ fontSize: 10, color: "#475569" }}>{s.source}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, color: c }}>{Math.round((s.confidence || 0) * 100)}%</div>
                    <div style={{ fontSize: 9, color: "#475569" }}>confiance</div>
                  </div>
                </div>
                {s.news_title && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, padding: "6px 10px", background: "#070d18", borderRadius: 7 }}>"{s.news_title}"</div>}
                <div style={{ display: "flex", gap: 10, fontSize: 10 }}>
                  <span style={{ color: "#334155" }}>Vol <span style={{ color: (s.volume_ratio || 1) >= 2 ? "#f87171" : "#fbbf24" }}>{(s.volume_ratio || 1).toFixed(1)}x</span></span>
                  <span style={{ color: "#334155" }}>Prix <span style={{ color: "#94a3b8" }}>${s.price?.toFixed(0)}</span></span>
                  {s.result_15min != null && <span style={{ color: "#334155" }}>+15min <span style={{ color: s.result_15min > 0 ? "#34d399" : "#f87171" }}>{s.result_15min > 0 ? "+" : ""}{s.result_15min.toFixed(2)}%</span></span>}
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

  const [page,        setPage]        = useState("home");
  const [prices,      setPrices]      = useState(() => Array.from({ length: 30 }, () => +(2420 + (Math.random() - 0.5) * 80).toFixed(2)));
  const [chatInput,   setChatInput]   = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef(null);

  // Prix: utilise le vrai prix backend si dispo, sinon simule
  const cur = ethPrice || prices[prices.length - 1];

  useEffect(() => {
    if (ethPrice) {
      setPrices(p => [...p.slice(-99), ethPrice]);
    } else {
      const iv = setInterval(() => setPrices(p => [...p.slice(-99), nextSim(p[p.length - 1])]), 3000);
      return () => clearInterval(iv);
    }
  }, [ethPrice]);

  // Infos user depuis Privy
  const userEmail  = user?.email?.address || user?.google?.email || "";
  const userName   = user?.google?.name || userEmail.split("@")[0] || "Trader";
  const activeWallet = wallets?.[0];

  // Chat copilote
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
  const nav = [
    { key: "home",    emoji: "🏠", label: "Accueil"  },
    { key: "live",    emoji: "📊", label: "Marché"   },
    { key: "news",    emoji: "📡", label: "News"     },
    { key: "wallet",  emoji: "💳", label: "Wallet"   },
    { key: "chat",    emoji: "💬", label: "Copilote" },
  ];

  // ── Loading Privy ─────────────────────────────────────────────────────────
  if (!ready) return (
    <div style={{ minHeight: "100vh", background: "#050810", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 24, height: 24, border: "2px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Non authentifié ───────────────────────────────────────────────────────
  if (!authenticated) return <LoginPage />;

  // ── App principale ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#060a12", color: "#e2e8f0", fontFamily: "'DM Sans',system-ui,sans-serif", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800;900&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        button{cursor:pointer;border:none;font-family:inherit;transition:all .15s}
        button:active{transform:scale(.97)}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1a2438}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .fadein{animation:fadeUp .3s ease}
        .pulse{animation:pulse 2s infinite}
        .card{background:#0c1220;border:1px solid #1a2438;border-radius:14px;padding:18px}
      `}</style>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <div style={{ width: 72, background: "#070d18", borderRight: "1px solid #0f1826", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 20, paddingBottom: 20, gap: 4, position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 100 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 900, color: "#6366f1", marginBottom: 20 }}>⟠</div>
        {nav.map(n => (
          <button key={n.key} onClick={() => setPage(n.key)} style={{ width: 50, height: 50, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: page === n.key ? "#1a2438" : "transparent", border: `1px solid ${page === n.key ? "#1e2d4a" : "transparent"}` }}>
            <span style={{ fontSize: 18 }}>{n.emoji}</span>
            <span style={{ fontSize: 8, color: page === n.key ? "#e2e8f0" : "#334155" }}>{n.label}</span>
          </button>
        ))}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: backendOk ? "#34d399" : "#f87171", boxShadow: backendOk ? "0 0 8px #34d399" : "none" }} className={backendOk ? "pulse" : ""} title={backendOk ? "Backend OK" : "Backend hors ligne"} />
          <button onClick={logout} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.2)", color: "#f87171", fontSize: 13 }} title="Déconnexion">↩</button>
        </div>
      </div>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <div style={{ marginLeft: 72, flex: 1, padding: "24px", maxWidth: 1100 }}>

        {/* HOME */}
        {page === "home" && (
          <div className="fadein">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-.02em" }}>
                  Bonjour {userName} 👋
                </div>
                <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
                  {userEmail || (activeWallet ? `${activeWallet.address.slice(0, 8)}...` : "Copilote Crypto")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ padding: "6px 12px", borderRadius: 8, background: backendOk ? "rgba(52,211,153,.08)" : "rgba(248,113,113,.08)", border: `1px solid ${backendOk ? "rgba(52,211,153,.2)" : "rgba(248,113,113,.2)"}`, color: backendOk ? "#34d399" : "#f87171", fontSize: 11 }}>
                  {backendOk ? "🟢 Backend live" : "🔴 Backend hors ligne"}
                </div>
              </div>
            </div>

            {/* Portfolio hero */}
            <div style={{ background: "linear-gradient(135deg, #0d1929 0%, #0c1220 100%)", border: "1px solid #1a2d4a", borderRadius: 20, padding: "28px 32px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,.1) 0%, transparent 70%)", pointerEvents: "none" }} />
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 8, letterSpacing: ".05em" }}>PRIX ETH MAINTENANT</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 42, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-.03em", marginBottom: 4 }}>
                ${cur.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 13, color: change >= 0 ? "#34d399" : "#f87171", marginBottom: 20 }}>
                {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% récemment
                {backendOk && <span style={{ color: "#334155", marginLeft: 12 }}>· Données réelles Binance</span>}
              </div>
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#334155", marginBottom: 3 }}>Volume spike</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: volRatio >= 2 ? "#f87171" : volRatio >= 1.5 ? "#fbbf24" : "#34d399" }}>{volRatio.toFixed(1)}x</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#334155", marginBottom: 3 }}>News analysées</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{stats.news_analyzed || news.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#334155", marginBottom: 3 }}>Signaux émis</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#fbbf24" }}>{stats.signals_total || signals.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#334155", marginBottom: 3 }}>Précision signaux</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: (stats.signal_accuracy || 0) >= 60 ? "#34d399" : "#f87171" }}>
                    {stats.signal_accuracy != null ? `${stats.signal_accuracy}%` : "—"}
                  </div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <Spark data={prices.slice(-30)} color={change >= 0 ? "#34d399" : "#f87171"} w={140} h={48} />
                </div>
              </div>
            </div>

            {/* Wallet */}
            <div style={{ marginBottom: 16 }}>
              <WalletPanel wallets={wallets} ethPrice={cur} />
            </div>

            {/* Quick actions */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[
                { emoji: "📡", title: "News live", desc: `${news.length} articles analysés`, page: "news", color: "#6366f1" },
                { emoji: "⚡", title: "Signaux", desc: `${signals.length} signaux actifs`, page: "news", color: "#fbbf24" },
                { emoji: "💳", title: "Wallet", desc: activeWallet ? "Connecté ✓" : "Non connecté", page: "wallet", color: "#34d399" },
                { emoji: "💬", title: "Copilote", desc: "Pose une question", page: "chat", color: "#a78bfa" },
              ].map(c => (
                <button key={c.title} onClick={() => setPage(c.page)} className="card" style={{ textAlign: "left", cursor: "pointer" }}
                  onMouseOver={e => e.currentTarget.style.borderColor = c.color + "44"}
                  onMouseOut={e => e.currentTarget.style.borderColor = "#1a2438"}>
                  <span style={{ fontSize: 22, display: "block", marginBottom: 6 }}>{c.emoji}</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginBottom: 2 }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{c.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MARCHÉ */}
        {page === "live" && (
          <div className="fadein">
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 20 }}>Marché en direct 📊</div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 32, fontWeight: 900, color: "#f1f5f9" }}>${cur.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: 12, color: change >= 0 ? "#34d399" : "#f87171", marginTop: 4 }}>{change >= 0 ? "▲" : "▼"} {Math.abs(change)}%</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ background: "#070d18", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 9, color: "#334155", marginBottom: 3 }}>VOLUME SPIKE</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: volRatio >= 2 ? "#f87171" : volRatio >= 1.5 ? "#fbbf24" : "#34d399" }}>{volRatio.toFixed(1)}x</div>
                  </div>
                  <div style={{ background: "#070d18", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 9, color: "#334155", marginBottom: 3 }}>SOURCE PRIX</div>
                    <div style={{ fontSize: 12, color: backendOk ? "#34d399" : "#f87171" }}>{backendOk ? "Binance live" : "Simulation"}</div>
                  </div>
                </div>
              </div>
              <div style={{ width: "100%" }}>
                <Spark data={prices} color={change >= 0 ? "#34d399" : "#f87171"} w={600} h={100} />
              </div>
            </div>

            {!backendOk && (
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.2)", color: "#f87171", fontSize: 12, marginBottom: 14 }}>
                ⚠️ Backend hors ligne — <code>python backend_v2.py</code> — prix simulés
              </div>
            )}
          </div>
        )}

        {/* NEWS */}
        {page === "news" && (
          <div className="fadein">
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 20 }}>News & Signaux 📡</div>
            <div style={{ fontSize: 11, color: "#334155", marginBottom: 16 }}>
              Sources: CryptoPanic · NewsData.io · LunarCrush · Volume Binance
            </div>
            <NewsFeed news={news} signals={signals} stats={stats} volRatio={volRatio} />
          </div>
        )}

        {/* WALLET */}
        {page === "wallet" && (
          <div className="fadein">
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 20 }}>Wallet & Swaps 💳</div>
            <WalletPanel wallets={wallets} ethPrice={cur} />
            <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: "#0c1220", border: "1px solid #1a2438", fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Comment connecter Exodus</div>
              1. Ouvre Exodus sur ton téléphone<br />
              2. Va dans Settings → WalletConnect<br />
              3. Scanne le QR code Privy sur le web<br />
              4. Ton wallet apparaît ici avec tes soldes en direct
            </div>
          </div>
        )}

        {/* CHAT */}
        {page === "chat" && (
          <div className="fadein" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)" }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>Copilote Claude 💬</div>
            <div style={{ fontSize: 12, color: "#334155", marginBottom: 16 }}>
              Claude connaît le prix ETH en direct, les dernières news et tes signaux
            </div>
            <div ref={chatRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {chatHistory.length === 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {["Est-ce que c'est le bon moment pour acheter ?", "Résume les dernières news importantes", `Analyse le prix actuel de $${cur}`].map(q => (
                    <button key={q} onClick={() => { setChatInput(q); }} style={{ padding: "12px 14px", borderRadius: 11, background: "#0c1220", border: "1px solid #1a2438", color: "#64748b", fontSize: 13, textAlign: "left" }}>
                      {q} →
                    </button>
                  ))}
                </div>
              )}
              {chatHistory.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "80%", padding: "12px 16px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#0c1220", border: m.role === "user" ? "none" : "1px solid #1a2438", color: m.role === "user" ? "#fff" : "#e2e8f0", fontSize: 13, lineHeight: 1.6 }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#a78bfa" }}>
                  <div style={{ width: 14, height: 14, border: "2px solid #a78bfa", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                  <span style={{ fontSize: 12 }}>Claude analyse...</span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Pose une question sur le marché..."
                style={{ flex: 1, padding: "14px 18px", borderRadius: 14, background: "#0c1220", border: "1px solid #1a2438", color: "#e2e8f0", fontSize: 14, outline: "none" }}
              />
              <button
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim()}
                style={{ padding: "14px 20px", borderRadius: 14, background: chatLoading || !chatInput.trim() ? "#0c1220" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: chatLoading || !chatInput.trim() ? "#334155" : "#fff", fontSize: 14, fontWeight: 700 }}
              >→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
