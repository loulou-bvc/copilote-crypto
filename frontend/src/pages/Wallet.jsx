import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { Skeleton } from "@/components/PriceDisplay";
import { ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";
import { uniLink, USDC_ARB } from "@/lib/config";

export function Wallet({ ethPrice }) {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const addr = wallets?.[0]?.address;
  const { eth, usdc } = useWalletBalance(addr);
  const [copied, setCopied] = useState(false);

  const ethVal  = eth  !== null && ethPrice ? eth  * ethPrice : null;
  const totalVal = (ethVal ?? 0) + (usdc ?? 0);

  function copy() {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Portefeuille</h1>
        <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Arbitrum One</p>
      </div>

      {/* Address */}
      {addr && (
        <div style={{ background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
            {addr.slice(0, 8)}...{addr.slice(-6)}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copy} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}>
              {copied ? <Check size={15} color="#34d399" /> : <Copy size={15} />}
            </button>
            <a href={`https://arbiscan.io/address/${addr}`} target="_blank" rel="noreferrer" style={{ color: "#475569" }}>
              <ExternalLink size={15} />
            </a>
          </div>
        </div>
      )}

      {/* Total */}
      <div style={{
        background: "rgba(12,18,32,0.95)", border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 16, padding: "24px", textAlign: "center",
        boxShadow: "0 0 30px rgba(99,102,241,0.08)",
      }}>
        <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>Valeur totale estimée</div>
        <div style={{ fontSize: 36, fontFamily: "'DM Mono', monospace", fontWeight: 500, color: "#f1f5f9" }}>
          {totalVal ? `$${totalVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <Skeleton style={{ width: "8ch", height: "1em", display: "inline-block" }} />}
        </div>
      </div>

      {/* Balances */}
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { label: "Ethereum", symbol: "ETH", bal: eth, val: ethVal, color: "#6366f1", emoji: "⟠" },
          { label: "USD Coin", symbol: "USDC", bal: usdc, val: usdc, color: "#3b82f6", emoji: "◎" },
        ].map(({ label, symbol, bal, val, color, emoji }) => (
          <div key={symbol} style={{
            flex: 1, background: "rgba(12,18,32,0.9)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12, padding: "18px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>{emoji}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>{symbol}</div>
                <div style={{ fontSize: 11, color: "#475569" }}>{label}</div>
              </div>
            </div>
            <div style={{ fontSize: 22, fontFamily: "'DM Mono', monospace", color: "#f1f5f9", marginBottom: 4 }}>
              {bal !== null ? bal.toFixed(4) : <Skeleton style={{ width: "5ch", height: "1em", display: "inline-block" }} />}
            </div>
            <div style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono', monospace" }}>
              {val !== null ? `≈ $${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
            </div>
            <a href={uniLink(symbol === "USDC" ? USDC_ARB : "ETH")} target="_blank" rel="noreferrer" style={{
              display: "inline-block", marginTop: 12, padding: "7px 14px",
              background: `${color}15`, border: `1px solid ${color}30`,
              borderRadius: 6, color: color, fontSize: 12, textDecoration: "none",
            }}>
              Swap sur Uniswap ↗
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
