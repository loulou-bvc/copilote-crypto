// ─── App.jsx ─────────────────────────────────────────────────────────────────
import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect } from "react";
import { Toaster, toast } from "sonner";

import { useBinancePrice } from "@/hooks/useBinancePrice";
import { useKlines } from "@/hooks/useKlines";
import { useBackend } from "@/hooks/useBackend";

import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Login } from "@/pages/Login";
import { Home } from "@/pages/Home";
import { Market } from "@/pages/Market";
import { News } from "@/pages/News";
import { Wallet } from "@/pages/Wallet";
import { Chat } from "@/pages/Chat";
import { History } from "@/pages/History";
import { Backtest } from "@/pages/Backtest";
import { Settings } from "@/pages/Settings";
import { Strategy } from "@/pages/Strategy";
import { Correlations } from "@/pages/Correlations";

export default function App() {
  const { ready, authenticated, logout } = usePrivy();
  const [page, setPage] = useState("home");

  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const { price, change24h, high24h, low24h, vol24h, connected } = useBinancePrice();
  const { closes, candles } = useKlines("5m", 60);
  const { news, signals, stats, volRatio, fearGreed, online } = useBackend();

  // Alert checking
  useEffect(() => {
    if (!price) return;
    const raw = localStorage.getItem("priceAlerts");
    if (!raw) return;
    const alerts = JSON.parse(raw);
    let changed = false;
    const updated = alerts.map(a => {
      if (a.fired) return a;
      const triggered = a.dir === "above" ? price >= a.threshold : price <= a.threshold;
      if (triggered) {
        toast(`🔔 ETH ${a.dir === "above" ? ">" : "<"} $${a.threshold.toLocaleString()}`, {
          description: `Prix actuel: $${price.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
          duration: 8000,
        });
        changed = true;
        return { ...a, fired: true };
      }
      return a;
    });
    if (changed) localStorage.setItem("priceAlerts", JSON.stringify(updated));
  }, [price]);

  if (!ready) return (
    <div style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", background: "rgb(6 10 18)" }}>
      <div style={{ width: 32, height: 32, border: "2px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (!authenticated) return <Login />;

  const pages = {
    home:     <Home price={price} change24h={change24h} high24h={high24h} low24h={low24h} vol24h={vol24h} closes={closes} signals={signals} fearGreed={fearGreed} volRatio={volRatio} />,
    market:   <Market price={price} change24h={change24h} />,
    news:     <News news={news} signals={signals} online={online} />,
    wallet:   <Wallet ethPrice={price} />,
    chat:     <Chat />,
    history:      <History />,
    backtest:     <Backtest />,
    settings:     <Settings />,
    strategy:     <Strategy candles={candles} />,
    correlations: <Correlations />,
  };

  return (
    <div style={{ display: "flex", minHeight: "100svh" }}>
      <Toaster position="top-right" theme="dark" richColors />
      {!isMobile && <Sidebar page={page} setPage={setPage} onLogout={logout} wsConnected={connected} />}
      <main style={{ flex: 1, overflowY: "auto", background: "rgb(6 10 18)", paddingBottom: isMobile ? 64 : 0 }}>
        {pages[page] ?? pages.home}
        {isMobile && <MobileNav page={page} setPage={setPage} />}
      </main>
    </div>
  );
}
