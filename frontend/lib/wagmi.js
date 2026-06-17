import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import { ARC_TESTNET, ENV } from "./config";

// Arc Testnet chain for viem/wagmi, built from config.
export const arcTestnet = defineChain(ARC_TESTNET);

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected({ target: "metaMask" })],
  transports: {
    [arcTestnet.id]: http(ENV.rpcUrl),
  },
  ssr: true,
});
