import { useState, useEffect } from "react";
import { USDC_ARB, ARB_RPC } from "@/lib/config";

async function rpc(method, params) {
  const r = await fetch(ARB_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  return j.result;
}

export function useWalletBalance(address) {
  const [balances, setBalances] = useState({ eth: null, usdc: null });

  useEffect(() => {
    if (!address) return;
    async function load() {
      try {
        const [ethHex, usdcHex] = await Promise.all([
          rpc("eth_getBalance", [address, "latest"]),
          rpc("eth_call", [{
            to: USDC_ARB,
            data: "0x70a08231" + address.replace("0x", "").padStart(64, "0"),
          }, "latest"]),
        ]);
        const eth  = parseInt(ethHex,  16) / 1e18;
        const usdc = parseInt(usdcHex, 16) / 1e6;
        setBalances({ eth, usdc });
      } catch (e) {
        console.error("useWalletBalance:", e);
      }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [address]);

  return balances;
}
