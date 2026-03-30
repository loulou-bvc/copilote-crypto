import { useState, useEffect } from "react";
import { BACKEND } from "@/lib/config";

export function useBackend() {
  const [state, setState] = useState({
    news: [], signals: [], stats: null,
    volRatio: null, fearGreed: null, online: null,
  });

  useEffect(() => {
    async function poll() {
      try {
        const [newsR, sigR, statsR, fgR] = await Promise.allSettled([
          fetch(`${BACKEND}/api/news?limit=20`).then(r => r.json()),
          fetch(`${BACKEND}/api/signals?limit=10`).then(r => r.json()),
          fetch(`${BACKEND}/api/stats`).then(r => r.json()),
          fetch(`${BACKEND}/api/feargreed`).then(r => r.json()),
        ]);

        const news    = newsR.status    === "fulfilled" ? newsR.value    : [];
        const signals = sigR.status     === "fulfilled" ? sigR.value     : [];
        const stats   = statsR.status   === "fulfilled" ? statsR.value   : null;
        const fg      = fgR.status      === "fulfilled" ? fgR.value      : null;

        const volRatio = stats?.volume_ratio ?? null;
        setState({ news, signals, stats, volRatio, fearGreed: fg, online: true });
      } catch {
        setState(s => ({ ...s, online: false }));
      }
    }
    poll();
    const id = setInterval(poll, 20_000);
    return () => clearInterval(id);
  }, []);

  return state;
}
