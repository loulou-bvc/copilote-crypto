import { useState, useEffect } from "react";

export function useKlines(interval = "5m", limit = 60) {
  const [result, setResult] = useState({ closes: [], candles: [] });

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=${interval}&limit=${limit}`
        );
        const data = await r.json();
        const closes = data.map(k => parseFloat(k[4]));
        const candles = data.map(k => ({
          time:   Math.floor(k[0] / 1000),
          open:   parseFloat(k[1]),
          high:   parseFloat(k[2]),
          low:    parseFloat(k[3]),
          close:  parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }));
        setResult({ closes, candles });
      } catch (e) {
        console.error("useKlines error:", e);
      }
    }
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [interval, limit]);

  return result;
}
