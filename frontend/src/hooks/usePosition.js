import { useState, useEffect } from "react";

const STORAGE_KEY = "openPosition";
const HISTORY_KEY = "tradeHistory";

export function usePosition(currentPrice) {
  const [position, setPosition] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
  });
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
  });

  // Live P&L
  const [pnl, setPnl] = useState(null);
  useEffect(() => {
    if (!position || !currentPrice) { setPnl(null); return; }
    const { type, entryPrice, size } = position;
    const direction = type === "long" ? 1 : -1;
    const pnlPct = ((currentPrice - entryPrice) / entryPrice) * 100 * direction;
    const pnlUsd = pnlPct / 100 * size;
    setPnl({ pct: pnlPct, usd: pnlUsd });
  }, [position, currentPrice]);

  function openPosition(pos) {
    const p = { ...pos, id: crypto.randomUUID(), openedAt: Date.now() };
    setPosition(p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }

  function closePosition() {
    if (!position || !currentPrice) return;
    const { type, entryPrice, size } = position;
    const direction = type === "long" ? 1 : -1;
    const pnlPct = ((currentPrice - entryPrice) / entryPrice) * 100 * direction;
    const pnlUsd = pnlPct / 100 * size;
    const closed = {
      ...position,
      exitPrice: currentPrice,
      closedAt: Date.now(),
      pnlPct,
      pnlUsd,
      duration: Date.now() - position.openedAt,
    };
    const newHistory = [closed, ...history];
    setHistory(newHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    setPosition(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }

  return { position, pnl, history, openPosition, closePosition, clearHistory };
}
