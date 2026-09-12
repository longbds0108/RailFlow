import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets';

// Only ever runs on the server: the API key must never reach the browser.
// Get one from the Circle Developer Console (console.circle.com) — a
// Testnet/Sandbox key is enough for Arc Testnet.
const apiKey = process.env.CIRCLE_API_KEY;
if (!apiKey) {
  throw new Error('Set CIRCLE_API_KEY in .env before starting the backend (see console.circle.com).');
}

export const circleClient = initiateUserControlledWalletsClient({ apiKey });
