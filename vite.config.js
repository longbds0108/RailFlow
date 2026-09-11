import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

// Builds the wallet-connect React island. RainbowKit's built-in wallet list
// (Coinbase, MetaMask, Ledger, etc.) dynamic-imports each connector's SDK on
// demand, so code-splitting is kept (not inlined) — a visitor only downloads
// the specific wallet's code once they pick it in the connect modal.
// scripts/build-widget.mjs copies the whole output directory (entry chunk,
// lazy chunks, and the extracted CSS) into wallet-widget/ at the project
// root; index.html and trade.html load wallet-widget/main.js as a
// <script type="module"> and wallet-widget/main.css as a stylesheet.
export default defineConfig({
  plugins: [react()],
  envDir: root,
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    outDir: '.vite-widget',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(root, 'src/wallet-widget/main.jsx'),
      output: {
        format: 'es',
        entryFileNames: 'main.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'main[extname]',
      },
    },
  },
});
