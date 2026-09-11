import { execFileSync } from 'node:child_process';
import { cp, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staging = resolve(root, '.vite-widget');
const destination = resolve(root, 'wallet-widget');

execFileSync('npx', ['vite', 'build'], { cwd: root, stdio: 'inherit' });

// Copies the whole output (entry, lazily-imported wallet-connector chunks,
// and the extracted CSS) — not just main.js — since RainbowKit's wallet
// list is code-split and only fetched on demand.
await rm(destination, { recursive: true, force: true });
await cp(staging, destination, { recursive: true });
await rm(staging, { recursive: true, force: true });

console.log('Built wallet-widget/ from src/wallet-widget/.');
