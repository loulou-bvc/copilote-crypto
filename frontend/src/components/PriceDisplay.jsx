import { cn } from "@/lib/utils";

export function Skeleton({ className }) {
  return (
    <span
      className={cn("inline-block rounded animate-pulse bg-white/10", className)}
      style={{
        background: "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 75%)",
        backgroundSize: "200% auto",
        animation: "shimmer 1.8s linear infinite",
      }}
    />
  );
}

export function PriceNum({ value, decimals = 2, prefix = "", suffix = "", className = "", fallbackWidth = "6ch" }) {
  if (value === null || value === undefined) {
    return <Skeleton style={{ width: fallbackWidth, height: "1em", display: "inline-block" }} />;
  }
  const formatted = typeof value === "number"
    ? value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : value;
  return (
    <span
      className={className}
      style={{ fontFamily: "'DM Mono', monospace", ...( className ? {} : {}) }}
    >
      {prefix}{formatted}{suffix}
    </span>
  );
}
