import express from 'express';
import { circleClient } from './circleClient.mjs';

// Minimal proxy between the browser and Circle's User-Controlled Wallets
// API. The browser never sees CIRCLE_API_KEY — it only ever receives a
// short-lived userToken/encryptionKey pair (Circle's own mechanism for
// letting a frontend authenticate to the hosted PIN UI without the API
// key), plus challengeIds it hands to @circle-fin/w3s-pw-web-sdk.
//
// Run with `npm run server` (defaults to PORT 8787). The frontend's
// CircleWalletPanel talks to this over NEXT_PUBLIC_CIRCLE_BACKEND_URL.
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-token');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function asyncRoute(handler) {
  return (req, res, next) => handler(req, res).catch(next);
}

// userId must be a stable, deterministic, >=5 char identifier — derived by
// the frontend from the connected external wallet's address, so the same
// wallet always maps to the same Circle user across sessions.
app.post('/api/circle/session', asyncRoute(async (req, res) => {
  const { userId } = req.body || {};
  if (!userId || typeof userId !== 'string' || userId.length < 5) {
    return res.status(400).json({ error: 'userId must be a string of at least 5 characters.' });
  }
  try {
    await circleClient.getUser({ userId });
  } catch (err) {
    if (err.status !== 404) throw err;
    await circleClient.createUser({ userId });
  }
  const { data } = await circleClient.createUserToken({ userId });
  res.json({ userId, userToken: data.userToken, encryptionKey: data.encryptionKey });
}));

app.get('/api/circle/wallets', asyncRoute(async (req, res) => {
  const userToken = req.get('x-user-token');
  if (!userToken) return res.status(400).json({ error: 'Missing x-user-token header.' });
  const { data } = await circleClient.listWallets({ userToken, blockchain: 'ARC-TESTNET' });
  res.json({ wallets: data.wallets || [] });
}));

// Returns a challengeId for the frontend's W3SSdk.execute() to run — the
// user sets their PIN and the wallet is created inside Circle's hosted UI,
// this endpoint never sees the PIN itself.
app.post('/api/circle/wallets', asyncRoute(async (req, res) => {
  const userToken = req.get('x-user-token');
  if (!userToken) return res.status(400).json({ error: 'Missing x-user-token header.' });
  const { data } = await circleClient.createUserPinWithWallets({
    userToken,
    blockchains: ['ARC-TESTNET'],
    accountType: 'EOA',
  });
  res.json({ challengeId: data.challengeId });
}));

// Same challenge/PIN pattern as wallet creation, but for calling a
// contract function (deposit/withdraw on RailflowVault) from an existing
// Circle wallet.
app.post('/api/circle/contract-execution', asyncRoute(async (req, res) => {
  const userToken = req.get('x-user-token');
  if (!userToken) return res.status(400).json({ error: 'Missing x-user-token header.' });
  const { walletId, contractAddress, abiFunctionSignature, abiParameters, amount, feeLevel } = req.body || {};
  if (!walletId || !contractAddress || !abiFunctionSignature) {
    return res.status(400).json({ error: 'walletId, contractAddress, and abiFunctionSignature are required.' });
  }
  const { data } = await circleClient.createUserTransactionContractExecutionChallenge({
    userToken,
    walletId,
    contractAddress,
    abiFunctionSignature,
    abiParameters: abiParameters || [],
    ...(amount ? { amount } : {}),
    fee: { type: 'level', config: { feeLevel: feeLevel || 'MEDIUM' } },
  });
  res.json({ challengeId: data.challengeId });
}));

app.get('/api/circle/transactions/:id', asyncRoute(async (req, res) => {
  const userToken = req.get('x-user-token');
  if (!userToken) return res.status(400).json({ error: 'Missing x-user-token header.' });
  const { data } = await circleClient.getTransaction({ id: req.params.id, userToken });
  res.json({ transaction: data.transaction });
}));

app.use((err, req, res, next) => {
  console.error('[circle backend]', err.message || err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => console.log('Circle Wallets backend listening on http://localhost:' + port));
