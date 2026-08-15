"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import { wagmiConfig } from "../lib/wagmi";
import { ConfigProvider } from "./ConfigProvider";

// Accent matches --color-primary / --color-primary-contrast in globals.css so
// the connect button fits RailFlow's dark theme.
const rainbowKitTheme = darkTheme({
  accentColor: "#5b8cff",
  accentColorForeground: "#08101f",
  borderRadius: "medium",
});

export default function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowKitTheme}>
          <ConfigProvider>{children}</ConfigProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
