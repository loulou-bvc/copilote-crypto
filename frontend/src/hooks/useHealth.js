import { useState, useEffect } from "react";
import { BACKEND } from "@/lib/config";

export function useHealth() {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`${BACKEND}/health`);
        setHealth(await r.json());
      } catch { setHealth(null); }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);
  return health;
}
