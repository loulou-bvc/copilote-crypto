import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import { BACKEND } from "@/lib/config";

const STARTERS = [
  "Quel est le sentiment du marché en ce moment ?",
  "Analyse les derniers signaux ETH",
  "Dois-je acheter ou vendre ?",
  "Explique le Fear & Greed index actuel",
];

export function Chat() {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Bonjour ! Je suis votre copilote crypto. Posez-moi vos questions sur ETH, les signaux ou le marché.",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text) {
    const q = text || input.trim();
    if (!q) return;
    setInput("");
    setMessages(m => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const data = await r.json();
      setMessages(m => [...m, { role: "assistant", content: data.response ?? data.answer ?? data.signal ?? JSON.stringify(data) }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "⚠ Backend hors ligne. Impossible de répondre pour l'instant." }]);
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", height: "calc(100svh - 48px)", gap: 16 }}>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Assistant IA</h1>

      {/* Starter prompts */}
      {messages.length === 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {STARTERS.map(s => (
            <button key={s} onClick={() => send(s)} style={{
              padding: "8px 14px", background: "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.2)", borderRadius: 20,
              color: "#818cf8", cursor: "pointer", fontSize: 13,
            }}>{s}</button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: m.role === "user" ? "rgba(99,102,241,0.2)" : "rgba(52,211,153,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {m.role === "user" ? <User size={14} color="#818cf8" /> : <Bot size={14} color="#34d399" />}
            </div>
            <div style={{
              maxWidth: "72%", padding: "12px 14px", borderRadius: 12,
              background: m.role === "user" ? "rgba(99,102,241,0.15)" : "rgba(12,18,32,0.9)",
              border: `1px solid ${m.role === "user" ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.06)"}`,
              fontSize: 14, color: "#cbd5e1", lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(52,211,153,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={14} color="#34d399" />
            </div>
            <div style={{ padding: "12px 14px", background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block", animation: `dotpulse 1.4s ease-in-out ${i*0.16}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Posez votre question…"
          style={{
            flex: 1, padding: "12px 16px",
            background: "rgba(12,18,32,0.9)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, color: "#f1f5f9", fontSize: 14, outline: "none",
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          style={{
            padding: "12px 16px", background: "linear-gradient(135deg, #6366f1, #818cf8)",
            border: "none", borderRadius: 10, color: "white", cursor: "pointer",
            opacity: !input.trim() || loading ? 0.5 : 1,
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
