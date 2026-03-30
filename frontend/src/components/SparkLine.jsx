import { useRef, useEffect, useState } from "react";

export function SparkLine({ data = [], color = "#6366f1", height = 48 }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(200);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  if (!data.length) return <div ref={ref} style={{ height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const W = width - pad * 2;
  const H = height - pad * 2;

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * W;
    const y = pad + H - ((v - min) / range) * H;
    return `${x},${y}`;
  });

  const area = `M${pts.join("L")}L${pad + W},${pad + H}L${pad},${pad + H}Z`;
  const line = `M${pts.join("L")}`;

  return (
    <div ref={ref} style={{ height, width: "100%" }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        <defs>
          <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0"    />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#sg-${color.replace("#","")})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
