import { useState, useEffect } from "react";
import { BACKEND } from "@/lib/config";

const DEFAULTS = {
  min_sentiment_score: 0.65,
  min_volume_spike: 1.5,
  min_impact: 6.0,
  cooldown_seconds: 300,
};

export function useSignalConfig() {
  const [config, setConfig] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // "ok" | "error" | null

  useEffect(() => {
    fetch(`${BACKEND}/api/config`)
      .then(r => r.json())
      .then(data => setConfig({ ...DEFAULTS, ...data }))
      .catch(() => {});
  }, []);

  const save = async (newConfig) => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`${BACKEND}/api/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      const data = await res.json();
      if (data.ok) { setConfig(data.config); setSaveStatus("ok"); }
      else setSaveStatus("error");
    } catch { setSaveStatus("error"); }
    setSaving(false);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const reset = () => setConfig(DEFAULTS);

  return { config, setConfig, save, saving, saveStatus, reset, DEFAULTS };
}
