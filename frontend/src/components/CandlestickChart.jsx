import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, HistogramSeries } from "lightweight-charts";

const CHART_THEME = {
  background:      { type: "solid", color: "#0c1220" },
  textColor:       "#94a3b8",
  grid: {
    vertLines:   { color: "rgba(255,255,255,0.04)" },
    horzLines:   { color: "rgba(255,255,255,0.04)" },
  },
  crosshair: {
    vertLine:   { color: "#6366f1", width: 1, style: 1 },
    horzLine:   { color: "#6366f1", width: 1, style: 1 },
  },
  timeScale: {
    borderColor:         "rgba(255,255,255,0.08)",
    timeVisible:         true,
    secondsVisible:      false,
  },
  rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
};

export function CandlestickChart({ candles = [] }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const candleRef    = useRef(null);
  const volRef       = useRef(null);

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width:  containerRef.current.clientWidth,
      height: 320,
      layout: CHART_THEME,
    });
    chartRef.current = chart;

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor:          "#34d399",
      downColor:        "#f87171",
      borderUpColor:    "#34d399",
      borderDownColor:  "#f87171",
      wickUpColor:      "#34d399",
      wickDownColor:    "#f87171",
    });

    volRef.current = chart.addSeries(HistogramSeries, {
      color:            "#6366f1",
      priceFormat:      { type: "volume" },
      priceScaleId:     "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  // Update data
  useEffect(() => {
    if (!candleRef.current || !volRef.current || !candles.length) return;
    candleRef.current.setData(candles);
    volRef.current.setData(
      candles.map(c => ({
        time:  c.time,
        value: c.volume,
        color: c.close >= c.open ? "rgba(52,211,153,0.4)" : "rgba(248,113,113,0.4)",
      }))
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: 320, borderRadius: 8, overflow: "hidden" }}
    />
  );
}
