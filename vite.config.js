import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
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
//
// nodePolyfills() is required by @circle-fin/w3s-pw-web-sdk: it pulls in
// jsonwebtoken (just for a client-side JWT decode(), no crypto needed) whose
// own dependency `jws` extends Node's `stream` classes via `util.inherits`.
// Vite doesn't polyfill Node builtins by default (unlike webpack), so
// without this plugin `require('stream')` resolves to nothing and the whole
// bundle throws "Object prototype may only be an Object or null: undefined"
// the instant the module graph is evaluated — silently taking down every
// other component in the same React tree (RainbowKit's connect button
// included), not just the Circle-related pieces.
export default defineConfig({
  plugins: [react(), nodePolyfills()],
  envDir: root,
  // The bundle is served from wallet-widget/, not the site root, so
  // Rollup's own asset/CSS-preload URL construction (which otherwise
  // assumes base '/') needs to resolve relative to the script's own
  // location instead.
  base: './',
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
