import { useEffect, useMemo, useRef, useState } from 'react';
import { useBalance, usePublicClient, useReadContract, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { vaultAbi } from './vaultAbi.js';
import { VAULT_ADDRESS } from './vault.js';
import { arcTestnet } from './chain.js';
import { CIRCLE_APP_ID } from './circleConfig.js';
import { requestContractExecution } from './circleApi.js';
import { useCircleWallet } from './useCircleWallet.js';
import { shortAddress } from './address.js';
import { getVaultLogs } from './vaultLogs.js';

function formatUsdc(value, digits = 4) {
  if (value === undefined || value === null) return '—';
  return Number(formatEther(value)).toLocaleString('en-US', { maximumFractionDigits: digits });
}

function formatNum(value, digits = 4) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function parsePositiveDecimal(value) {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) return NaN;
  const number = Number(value);
  return number > 0 ? number : NaN;
}

// Strips floating-point noise from a quick-percent fill (e.g. 33.333333333336).
function trimAmount(n) {
  if (!Number.isFinite(n) || n <= 0) return '';
  return Number(n.toFixed(6)).toString();
}

async function waitForChange(refetch, previousValue, attempts = 8, delayMs = 2500) {
  for (let i = 0; i < attempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const result = await refetch();
    if (result?.data !== undefined && result.data !== previousValue) return;
  }
}

function formatDate(timestampSeconds) {
  return new Date(timestampSeconds * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const RANGE_SECONDS = { '1D': 86400, '1W': 7 * 86400, '1M': 30 * 86400, '1Y': 365 * 86400, ALL: Infinity };

function RangeTabs({ options, value, onChange }) {
  return (
    <div className="vault-tabs" role="tablist">
      {options.map((option) => (
        <button key={option} type="button" role="tab" aria-selected={value === option} className={value === option ? 'is-active' : ''} onClick={() => onChange(option)}>{option}</button>
      ))}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="vault-copy"
      aria-label="Copy address"
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}

// Reads every Deposited/Withdrawn log for the whole contract (no account
// filter) to build protocol-wide numbers — total value locked's history,
// how many distinct addresses have ever deposited, how old the vault is.
// These are real on-chain facts anyone can see, shown regardless of
// whether a wallet is connected, mirroring the always-visible market
// stats a real vault marketplace shows before you connect.
function useGlobalVaultStats(publicClient) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!publicClient || !VAULT_ADDRESS) { setLoading(false); return; }
    (async () => {
      try {
        const [deposits, withdrawals] = await Promise.all([
          getVaultLogs(publicClient, 'Deposited'),
          getVaultLogs(publicClient, 'Withdrawn'),
        ]);
        const blockTimes = new Map();
        async function timeOf(blockNumber) {
          if (!blockTimes.has(blockNumber)) {
            const block = await publicClient.getBlock({ blockNumber });
            blockTimes.set(blockNumber, Number(block.timestamp));
          }
          return blockTimes.get(blockNumber);
        }
        const rows = [];
        for (const log of deposits) rows.push({ type: 'Deposit', amount: log.args.amount, account: log.args.account, timestamp: await timeOf(log.blockNumber) });
        for (const log of withdrawals) rows.push({ type: 'Withdraw', amount: log.args.amount, account: log.args.account, timestamp: await timeOf(log.blockNumber) });
        rows.sort((a, b) => a.timestamp - b.timestamp);
        if (!cancelled) setEvents(rows);
      } catch (err) {
        console.error('[VaultPage] could not load protocol-wide vault history:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [publicClient]);

  const depositorCount = useMemo(() => new Set(events.filter((e) => e.type === 'Deposit').map((e) => e.account.toLowerCase())).size, [events]);
  const firstDeposit = useMemo(() => events.find((e) => e.type === 'Deposit')?.timestamp ?? null, [events]);

  return { events, loading, depositorCount, firstDeposit };
}

// Mounted into #wallet-vault-root on vault.html. The public hero/vault-card
// section (TVL, depositor count, protocol chart) reads straight from the
// chain and needs no connected wallet; the deposit/withdraw panel on the
// right and the personal Transfers table need a connected wallet with a
// Circle wallet. There is no APR/PnL/Sharpe-ratio panel anywhere — this
// vault has no yield mechanism, it's a plain collateral escrow that funds
// the demo trading engine in js/trade.js, so every number shown is either
// a real balance or a real transaction, never a fabricated return.
export function VaultPage() {
  const { address, isConnected, onArc, circleWallet, checking, status, autoError, setUpWallet, ensureSession, ensureSdk } = useCircleWallet({ autoCreate: true });
  const publicClient = usePublicClient();

  const [mode, setMode] = useState('deposit');
  const [busyStep, setBusyStep] = useState('');
  const [error, setError] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [chartRange, setChartRange] = useState('ALL');
  const [transferRange, setTransferRange] = useState('ALL');

  const chartElRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const panelRef = useRef(null);
  const amountInputRef = useRef(null);

  const { data: vaultTvl } = useBalance({ address: VAULT_ADDRESS || undefined, query: { enabled: !!VAULT_ADDRESS } });
  const globalStats = useGlobalVaultStats(publicClient);

  const { data: externalBalance } = useBalance({ address, query: { enabled: onArc } });
  const { data: circleBalance, refetch: refetchCircleBalance } = useBalance({ address: circleWallet?.address, query: { enabled: onArc && !!circleWallet } });
  const { data: collateral, refetch: refetchCollateral } = useReadContract({
    address: VAULT_ADDRESS || undefined,
    abi: vaultAbi,
    functionName: 'collateralOf',
    args: circleWallet ? [circleWallet.address] : undefined,
    query: { enabled: onArc && !!VAULT_ADDRESS && !!circleWallet },
  });

  const { sendTransaction, data: topUpHash, isPending: topUpSubmitting } = useSendTransaction();
  const { isLoading: topUpConfirming, isSuccess: topUpConfirmed } = useWaitForTransactionReceipt({ hash: topUpHash });
  useEffect(() => {
    if (!topUpConfirmed) return;
    refetchCircleBalance();
    setTopUpAmount('');
  }, [topUpConfirmed]);

  async function loadEvents() {
    if (!publicClient || !circleWallet || !VAULT_ADDRESS) { setEvents([]); return; }
    setLoadingEvents(true);
    try {
      const [deposits, withdrawals] = await Promise.all([
        getVaultLogs(publicClient, 'Deposited', { account: circleWallet.address }),
        getVaultLogs(publicClient, 'Withdrawn', { account: circleWallet.address }),
      ]);
      const blockTimes = new Map();
      async function timeOf(blockNumber) {
        if (!blockTimes.has(blockNumber)) {
          const block = await publicClient.getBlock({ blockNumber });
          blockTimes.set(blockNumber, Number(block.timestamp));
        }
        return blockTimes.get(blockNumber);
      }
      const rows = [];
      for (const log of deposits) rows.push({ type: 'Deposit', amount: log.args.amount, txHash: log.transactionHash, timestamp: await timeOf(log.blockNumber) });
      for (const log of withdrawals) rows.push({ type: 'Withdraw', amount: log.args.amount, txHash: log.transactionHash, timestamp: await timeOf(log.blockNumber) });
      rows.sort((a, b) => b.timestamp - a.timestamp);
      setEvents(rows);
    } catch (err) {
      console.error('[VaultPage] could not load transfer history:', err);
    } finally {
      setLoadingEvents(false);
    }
  }

  useEffect(() => { loadEvents(); }, [circleWallet, publicClient]);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const transferEvents = useMemo(() => {
    const cutoff = nowSeconds - RANGE_SECONDS[transferRange];
    return events.filter((e) => e.timestamp >= cutoff);
  }, [events, transferRange]);

  // Real protocol-wide TVL history built from every Deposited/Withdrawn
  // log ever emitted — never a fabricated returns curve, since this vault
  // has nothing generating a return.
  useEffect(() => {
    if (!chartElRef.current || !window.LightweightCharts) return;
    if (!chartRef.current) {
      chartRef.current = window.LightweightCharts.createChart(chartElRef.current, {
        layout: { background: { color: 'transparent' }, textColor: '#7f8c9b', fontSize: 11 },
        grid: { vertLines: { color: '#182129' }, horzLines: { color: '#182129' } },
        rightPriceScale: { borderColor: '#1c2b35' },
        timeScale: { borderColor: '#1c2b35', timeVisible: true },
        autoSize: true,
      });
      seriesRef.current = chartRef.current.addSeries(window.LightweightCharts.AreaSeries, {
        lineColor: '#5ee3c4', topColor: 'rgba(94,227,196,.32)', bottomColor: 'rgba(94,227,196,0)',
      });
    }
    const cutoff = nowSeconds - RANGE_SECONDS[chartRange];
    let running = 0;
    const seen = new Set();
    const points = [];
    for (const event of globalStats.events) {
      running += (event.type === 'Deposit' ? 1 : -1) * Number(formatEther(event.amount));
      if (event.timestamp < cutoff) continue;
      let time = event.timestamp;
      while (seen.has(time)) time += 1;
      seen.add(time);
      points.push({ time, value: running });
    }
    seriesRef.current.setData(points);
    chartRef.current.timeScale().fitContent();
  }, [globalStats.events, chartRange]);

  if (!VAULT_ADDRESS) {
    return <p className="collateral-note">The Railflow vault contract hasn't been deployed on Arc Testnet yet.</p>;
  }

  const collateralUsdc = collateral !== undefined ? Number(formatEther(collateral)) : 0;
  const deposits = events.filter((e) => e.type === 'Deposit');
  const totalDeposited = deposits.reduce((sum, e) => sum + Number(formatEther(e.amount)), 0);
  const busy = busyStep !== '';
  const tvlUsdc = vaultTvl ? Number(formatEther(vaultTvl.value)) : 0;
  const vaultAgeDays = globalStats.firstDeposit ? Math.max(0, Math.floor((nowSeconds - globalStats.firstDeposit) / 86400)) : null;
  const vaultShare = tvlUsdc > 0 ? (collateralUsdc / tvlUsdc) * 100 : 0;
  const hasPosition = !!circleWallet && collateralUsdc > 0;

  const externalBalanceUsdc = externalBalance ? Number(formatEther(externalBalance.value)) : 0;
  const circleBalanceUsdc = circleBalance ? Number(formatEther(circleBalance.value)) : 0;
  const maxForMode = mode === 'deposit' ? circleBalanceUsdc : collateralUsdc;
  const amountForMode = mode === 'deposit' ? depositAmount : withdrawAmount;
  const setAmountForMode = mode === 'deposit' ? setDepositAmount : setWithdrawAmount;

  function focusPanel(nextMode) {
    if (nextMode) setMode(nextMode);
    panelRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
    amountInputRef.current?.focus();
  }

  function handleTopUp(event) {
    event.preventDefault();
    setError('');
    const value = parsePositiveDecimal(topUpAmount);
    if (Number.isNaN(value)) return setError('Enter a valid top-up amount greater than zero.');
    if (externalBalance && value > externalBalanceUsdc) return setError('Amount exceeds your external wallet balance.');
    sendTransaction({ to: circleWallet.address, value: parseEther(topUpAmount) });
  }

  async function handleSetUp() {
    setError('');
    setBusyStep('wallet');
    try {
      await setUpWallet();
    } catch (err) {
      setError(err.message || 'Could not start Circle wallet setup.');
    } finally {
      setBusyStep('');
    }
  }

  async function runContractExecution({ abiFunctionSignature, abiParameters, amount, stepName, onDone }) {
    setError('');
    setBusyStep(stepName);
    try {
      const data = await ensureSession();
      const sdk = ensureSdk();
      const { challengeId } = await requestContractExecution({
        userToken: data.userToken,
        walletId: circleWallet.id,
        contractAddress: VAULT_ADDRESS,
        abiFunctionSignature,
        abiParameters,
        amount,
      });
      const previousCollateral = collateral;
      sdk.execute(challengeId, async (err, result) => {
        if (err || !result || result.status !== 'COMPLETE') {
          setError((err && err.message) || 'Transaction was not completed.');
          setBusyStep('');
          return;
        }
        onDone();
        await waitForChange(refetchCollateral, previousCollateral);
        refetchCircleBalance();
        loadEvents();
        setBusyStep('');
      });
    } catch (err) {
      setError(err.message || 'Something went wrong starting the transaction.');
      setBusyStep('');
    }
  }

  function handleDeposit(event) {
    event.preventDefault();
    const value = parsePositiveDecimal(depositAmount);
    if (Number.isNaN(value)) return setError('Enter a valid deposit amount greater than zero.');
    if (value > circleBalanceUsdc) return setError('Amount exceeds your Circle wallet balance — top up first.');
    runContractExecution({ stepName: 'deposit', abiFunctionSignature: 'deposit()', abiParameters: [], amount: depositAmount, onDone: () => setDepositAmount('') });
  }

  function handleWithdraw(event) {
    event.preventDefault();
    const value = parsePositiveDecimal(withdrawAmount);
    if (Number.isNaN(value)) return setError('Enter a valid withdraw amount greater than zero.');
    if (value > collateralUsdc) return setError('Amount exceeds your deposited collateral.');
    const tradeState = window.RailflowTradeState;
    if (tradeState && value > tradeState.availableMargin) return setError('Amount exceeds your available (unused) demo margin — close positions or cancel orders first.');
    runContractExecution({ stepName: 'withdraw', abiFunctionSignature: 'withdraw(uint256)', abiParameters: [parseEther(withdrawAmount).toString()], amount: undefined, onDone: () => setWithdrawAmount('') });
  }

  function handleModeSubmit(event) {
    return mode === 'deposit' ? handleDeposit(event) : handleWithdraw(event);
  }

  return (
    <div className="vault-page">
      <section className="vault-hero">
        <div className="vault-hero__copy">
          <div className="vault-hero__eyebrow">Vault</div>
          <h1>Deposit USDC. Fund your demo trading margin.</h1>
          <p>Railflow's vault is a single, self-custodial collateral escrow on Arc Testnet — real testnet USDC in, real testnet USDC out. It has no lending, liquidation, or market-making activity, so it earns no yield: depositing simply funds your available margin in <a href="trade.html">Trade</a>.</p>
        </div>
        <div className="vault-hero__pills">
          <div className="vault-pill"><span className="vault-pill__value mono">{formatNum(tvlUsdc, 2)}</span><span className="vault-pill__label">Total value locked</span></div>
          <div className="vault-pill"><span className="vault-pill__value mono">{globalStats.loading ? '…' : globalStats.depositorCount}</span><span className="vault-pill__label">Depositors</span></div>
          <div className="vault-pill"><span className="vault-pill__value mono">{vaultAgeDays !== null ? vaultAgeDays + 'd' : '—'}</span><span className="vault-pill__label">Vault age</span></div>
        </div>
      </section>

      {hasPosition && (
        <section className="vault-position">
          <div className="vault-position__stats">
            <div><span className="vault-position__label">Your vault balance</span><span className="mono">{formatUsdc(collateral)} USDC</span></div>
            <div><span className="vault-position__label">Total deposited</span><span className="mono">{formatNum(totalDeposited)} USDC</span></div>
            <div><span className="vault-position__label">Vault share</span><span className="mono">{formatNum(vaultShare, 3)}%</span></div>
          </div>
          <div className="vault-position__actions">
            <button type="button" className="place-order" onClick={() => focusPanel('deposit')}>Deposit more</button>
            <button type="button" className="small-button" onClick={() => focusPanel('withdraw')}>Withdraw</button>
          </div>
        </section>
      )}

      <div className="vault-grid">
        <section className="vault-card">
          <div className="vault-card__head">
            <span className="vault-icon">RF</span>
            <div>
              <h2>Railflow Vault<span className="vault-badge">Self-custodial</span></h2>
              <p className="mono vault-address">{shortAddress(VAULT_ADDRESS)}<CopyButton text={VAULT_ADDRESS} /><a className="text-link" href={'https://testnet.arcscan.app/address/' + VAULT_ADDRESS} target="_blank" rel="noopener noreferrer">View on Arcscan ↗</a></p>
            </div>
          </div>
          <p className="vault-desc">Plain escrow contract — deposit and withdraw your own testnet USDC any time. No strategy quotes the book, no positions are absorbed, and no fee is taken beyond network gas.</p>
          <div className="vault-metrics">
            <div><dt>TVL</dt><dd className="mono">{formatNum(tvlUsdc, 2)} USDC</dd></div>
            <div><dt>Yield</dt><dd className="mono">None</dd></div>
            <div><dt>Lock window</dt><dd className="mono">None</dd></div>
            <div><dt>Deposit fee</dt><dd className="mono">0.000%</dd></div>
          </div>
          <div className="vault-card__chart-head">
            <span>Total value locked</span>
            <RangeTabs options={['1D', '1W', '1M', '1Y', 'ALL']} value={chartRange} onChange={setChartRange} />
          </div>
          <div className="vault-chart" ref={chartElRef}></div>
          <div className="vault-perf__legend"><span className="vault-perf__dot"></span>Total value locked, across all depositors</div>
        </section>

        <aside className="vault-panel" ref={panelRef}>
          {!CIRCLE_APP_ID ? (
            <p className="collateral-note">Circle Wallets isn't configured yet (missing app ID), so the vault can't be managed from here right now.</p>
          ) : !isConnected ? (
            <p className="collateral-note">Connect your external wallet first — it's used to fund your Circle wallet, which then deposits into the vault.</p>
          ) : !onArc ? (
            <p className="collateral-note">Switch your wallet to Arc Testnet to manage your vault position.</p>
          ) : !circleWallet ? (
            <>
              <h2>Set up your Circle wallet</h2>
              <p className="vault-desc">Your Circle wallet is a separate, PIN-secured wallet that actually holds and deposits your collateral. It's funded from the external wallet you connected.</p>
              {checking && !autoError && (
                <p className="collateral-note">
                  {status === 'session' && 'Starting a Circle session…'}
                  {status === 'device' && 'Connecting to Circle…'}
                  {status === 'wallets' && 'Checking for an existing wallet…'}
                  {status === 'creating' && 'Requesting wallet creation…'}
                  {status === 'awaiting-pin' && 'Set a PIN in the panel that should now be showing on this page — if nothing appeared, an ad-blocker or content blocker may be preventing Circle\'s embedded frame from loading.'}
                  {!['session', 'device', 'wallets', 'creating', 'awaiting-pin'].includes(status) && 'Setting up your Circle wallet…'}
                </p>
              )}
              {autoError && (
                <>
                  <p className="collateral-error">{autoError}</p>
                  <button type="button" className="place-order" disabled={busy} onClick={handleSetUp}>
                    {busyStep === 'wallet' ? 'Setting up…' : 'Try again'}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <p className="mono vault-address">Circle wallet {shortAddress(circleWallet.address)}<CopyButton text={circleWallet.address} /></p>

              <form onSubmit={handleTopUp} className="collateral-form vault-topup">
                <label htmlFor="vaultTopUp">Top up Circle wallet (from external wallet) — bal {formatNum(externalBalanceUsdc)}</label>
                <div className="collateral-field">
                  <input id="vaultTopUp" className="mono" type="text" inputMode="decimal" placeholder="0.00" value={topUpAmount} disabled={busy || topUpSubmitting || topUpConfirming} onChange={(e) => setTopUpAmount(e.target.value)} />
                  <button type="submit" className="small-button" disabled={busy || topUpSubmitting || topUpConfirming}>{topUpSubmitting || topUpConfirming ? 'Sending…' : 'Send'}</button>
                </div>
              </form>

              <div className="vault-panel__tabs">
                <button type="button" className={mode === 'deposit' ? 'is-active' : ''} onClick={() => setMode('deposit')}>Deposit</button>
                <button type="button" className={mode === 'withdraw' ? 'is-active' : ''} onClick={() => setMode('withdraw')}>Withdraw</button>
              </div>

              <form onSubmit={handleModeSubmit} className="collateral-form">
                <div className="vault-amount-head">
                  <label htmlFor="vaultAmount">Amount</label>
                  <span className="mono">Bal {formatNum(maxForMode)} USDC</span>
                </div>
                <div className="collateral-field">
                  <input ref={amountInputRef} id="vaultAmount" className="mono" type="text" inputMode="decimal" placeholder="0.00" value={amountForMode} disabled={busy} onChange={(e) => setAmountForMode(e.target.value)} />
                </div>
                <div className="quick-pct">
                  {[25, 50, 75, 100].map((pct) => (
                    <button key={pct} type="button" disabled={busy || maxForMode <= 0} onClick={() => setAmountForMode(trimAmount((maxForMode * pct) / 100))}>{pct === 100 ? 'Max' : pct + '%'}</button>
                  ))}
                </div>

                <dl className="vault-panel__info">
                  <div><dt>Your vault share</dt><dd className="mono">{formatNum(vaultShare, 3)}%</dd></div>
                  <div><dt>Lock window</dt><dd className="mono">None</dd></div>
                  <div><dt>Performance fee</dt><dd className="mono">None</dd></div>
                  <div><dt>Deposit fee</dt><dd className="mono">0.000%</dd></div>
                </dl>

                <button type="submit" className="place-order" disabled={busy}>
                  {busyStep === mode
                    ? (mode === 'deposit' ? 'Depositing…' : 'Withdrawing…')
                    : (amountForMode ? `${mode === 'deposit' ? 'Deposit' : 'Withdraw'} ${amountForMode} USDC` : (mode === 'deposit' ? 'Deposit' : 'Withdraw'))}
                </button>
                <p className="vault-disclaimer">Real testnet transaction, signed by your Circle wallet. This vault does not generate yield — your balance only ever reflects your own deposits and withdrawals.</p>
              </form>

              {error && <p className="collateral-error">{error}</p>}
            </>
          )}

          <div className="how-it-works">
            <div className="how-it-works__head">How the vault works</div>
            <div className="how-it-works__step"><span>1</span><p>Your USDC moves from your Circle wallet into the RailflowVault contract on Arc Testnet.</p></div>
            <div className="how-it-works__step"><span>2</span><p>The contract just holds it under your address — funding your available margin in <a href="trade.html">Trade</a>. No strategy, lending, or liquidation activity touches it.</p></div>
            <div className="how-it-works__step"><span>3</span><p>Withdraw any amount, any time — there's no lock window and no performance fee.</p></div>
          </div>

          <div className="vault-risk">⚠ This vault has no yield, insurance, or lending activity. Deposits/withdrawals are real testnet transactions; your balance only ever changes from your own actions.</div>
        </aside>
      </div>

      {circleWallet && (
        <section className="vault-transfers">
          <div className="vault-main__head">
            <h2>Transfers</h2>
            <RangeTabs options={['1D', '1W', '1M', '1Y', 'ALL']} value={transferRange} onChange={setTransferRange} />
          </div>
          {loadingEvents ? (
            <p className="collateral-note">Loading transfer history…</p>
          ) : transferEvents.length === 0 ? (
            <p className="collateral-note">You have no deposits to the vault.</p>
          ) : (
            <table className="vault-table">
              <thead><tr><th>Action</th><th>Status</th><th>Amount</th><th>Updated at</th><th>Transaction details</th></tr></thead>
              <tbody>
                {transferEvents.map((event) => (
                  <tr key={event.txHash + event.type}>
                    <td>{event.type}</td>
                    <td>Confirmed</td>
                    <td className="mono">{formatUsdc(event.amount)} USD</td>
                    <td className="mono">{formatDate(event.timestamp)}</td>
                    <td><a href={'https://testnet.arcscan.app/tx/' + event.txHash} target="_blank" rel="noopener noreferrer">View ↗</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
