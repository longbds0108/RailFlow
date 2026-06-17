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
    // Optional wallet connector deps that we don't use — stub them so the
    // bundler doesn't fail on missing peer packages.
    config.resolve.alias = {
      ...config.resolve.alias,
      "porto/internal": false,
      porto: false,
      "@coinbase/wallet-sdk": false,
      "@metamask/connect-evm": false,
      "@metamask/sdk": false,
      "@safe-global/safe-apps-sdk": false,
      "@safe-global/safe-apps-provider": false,
      "@walletconnect/ethereum-provider": false,
      "@base-org/account": false,
      accounts: false,
    };
    return config;
  },
};

export default nextConfig;
