/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lean runtime image for Docker (.next/standalone).
  output: "standalone",
  // Circle App Kit / wallet libs reference optional node deps; keep webpack happy.
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // wagmi's optional "Base Account" connector pulls in Coinbase's CDP SDK for
    // x402 payments, whose @x402/* deps aren't installed and aren't needed for
    // wallet connect — stub the one package that reaches for them.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@coinbase/cdp-sdk": false,
      // React Native-only storage backend that @metamask/sdk references for its
      // mobile deep-linking path; unused and unresolvable in a web bundle.
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;
