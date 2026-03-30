export const BACKEND = import.meta.env.VITE_BACKEND_URL || "https://copilote-crypto-production.up.railway.app";
export const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
export const ARB_RPC  = "https://arb1.arbitrum.io/rpc";

export function uniLink(addr) {
  return `https://app.uniswap.org/#/swap?chain=arbitrum&outputCurrency=${addr}`;
}
