// ─── main.jsx ────────────────────────────────────────────────────────────────
// Point d'entrée — wrappe tout avec PrivyProvider

import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App";
import "./index.css";

// App ID Privy (public, peut rester dans le code)
const PRIVY_APP_ID = "cmnanm19h00yx0cifvajmt165";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "google", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#6366f1",
          logo: "https://i.imgur.com/placeholder.png",
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          createOnLogin: "off", // On utilise Exodus, pas de wallet embedded
        },
        // Arbitrum comme réseau par défaut
        defaultChain: {
          id: 42161,
          name: "Arbitrum One",
          network: "arbitrum",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: ["https://arb1.arbitrum.io/rpc"] } },
        },
        supportedChains: [
          {
            id: 42161,
            name: "Arbitrum One",
            network: "arbitrum",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: { default: { http: ["https://arb1.arbitrum.io/rpc"] } },
          },
        ],
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>
);
