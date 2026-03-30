import { useState, useEffect, useRef } from "react";

export function useBinancePrice() {
  const [data, setData] = useState({
    price: null, change24h: null, high24h: null,
    low24h: null, vol24h: null, connected: false,
  });
  const wsRef = useRef(null);
  const retryRef = useRef(null);

  useEffect(() => {
    let dead = false;

    function connect() {
      const ws = new WebSocket("wss://stream.binance.com:9443/ws/ethusdt@ticker");
      wsRef.current = ws;
      ws.onopen = () => { if (!dead) setData(d => ({ ...d, connected: true })); };
      ws.onmessage = (e) => {
        if (dead) return;
        const t = JSON.parse(e.data);
        setData({
          price: parseFloat(t.c),
          change24h: parseFloat(t.P),
          high24h: parseFloat(t.h),
          low24h: parseFloat(t.l),
          vol24h: parseFloat(t.q),
          connected: true,
        });
      };
      ws.onclose = () => {
        if (dead) return;
        setData(d => ({ ...d, connected: false }));
        retryRef.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    }

    // REST fallback on first load
    fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT")
      .then(r => r.json())
      .then(t => {
        if (!dead) setData({
          price: parseFloat(t.lastPrice),
          change24h: parseFloat(t.priceChangePercent),
          high24h: parseFloat(t.highPrice),
          low24h: parseFloat(t.lowPrice),
          vol24h: parseFloat(t.quoteVolume),
          connected: false,
        });
      }).catch(() => {});

    connect();
    return () => {
      dead = true;
      clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, []);

  return data;
}
