import { Home, BarChart3, Newspaper, Wallet, MessageSquare } from "lucide-react";

const NAV = [
  { id: "home",    label: "Accueil",  Icon: Home          },
  { id: "market",  label: "Marché",   Icon: BarChart3     },
  { id: "news",    label: "News",     Icon: Newspaper     },
  { id: "wallet",  label: "Wallet",   Icon: Wallet        },
  { id: "chat",    label: "Chat",     Icon: MessageSquare },
];

export function MobileNav({ page, setPage }) {
  return (
    <nav style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      height: 64,
      background: "rgba(12,18,32,0.98)",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-around",
      paddingBottom: "env(safe-area-inset-bottom)",
      zIndex: 50,
      backdropFilter: "blur(12px)",
    }}>
      {NAV.map(({ id, label, Icon }) => {
        const active = page === id;
        return (
          <button
            key={id}
            onClick={() => setPage(id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "8px 16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: active ? "#818cf8" : "#475569",
              flex: 1,
            }}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
