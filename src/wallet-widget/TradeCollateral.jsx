import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useReadContract, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { encodeFunctionData, formatEther, parseEther } from 'viem';
import { arcTestnet } from './chain.js';
import { VAULT_ADDRESS } from './vault.js';
import { vaultAbi } from './vaultAbi.js';

function formatUsdc(value) {
  if (value === undefined || value === null) return '—';
  return Number(formatEther(value)).toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function parsePositiveDecimal(value) {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) return NaN;
  const number = Number(value);
  return number > 0 ? number : NaN;
}

function trimAmount(value) {
  if (!Number.isFinite(value) || value <= 0) return '';
  return Number(value.toFixed(6)).toString();
}

export function TradeCollateral() {
  const { address, isConnected, chainId } = useAccount();
  const onArc = isConnected && chainId === arcTestnet.id;
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const { data: walletBalance, refetch: refetchWalletBalance } = useBalance({ address, query: { enabled: onArc && !!address } });
  const { data: collateral, refetch: refetchCollateral } = useReadContract({
    address: VAULT_ADDRESS || undefined,
    abi: vaultAbi,
    functionName: 'collateralOf',
    args: address ? [address] : undefined,
    query: { enabled: onArc && !!VAULT_ADDRESS && !!address },
  });
  const { sendTransaction, data: hash, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const walletUsdc = walletBalance ? Number(formatEther(walletBalance.value)) : 0;
  const busy = isPending || isConfirming;

  useEffect(() => {
    if (!isSuccess) return;
    setAmount('');
    setError('');
    refetchWalletBalance();
    refetchCollateral();
  }, [isSuccess]);

  async function handleDeposit(event) {
    event.preventDefault();
    setError('');
    const value = parsePositiveDecimal(amount);
    if (Number.isNaN(value)) return setError('Enter a valid amount greater than zero.');
    if (value > walletUsdc) return setError('Amount exceeds your wallet balance.');
    try {
      await sendTransaction({
        to: VAULT_ADDRESS,
        data: encodeFunctionData({ abi: vaultAbi, functionName: 'deposit' }),
        value: parseEther(amount),
      });
    } catch (err) {
      setError(err.shortMessage || err.message || 'Transaction could not be submitted.');
    }
  }

  return (
    <section className="trade-collateral" aria-label="Collateral Vault">
      <div className="trade-collateral__heading">
        <div className="trade-collateral__title">
          <span className="trade-collateral__status-dot" aria-hidden="true" />
          <div>
            <span className="trade-collateral__eyebrow">Collateral Vault</span>
            <h2>Fund demo margin</h2>
          </div>
        </div>
        <a className="trade-collateral__vault-link" href="vault.html">Vault ↗</a>
      </div>

      {!isConnected ? (
        <ConnectButton.Custom>
          {({ openConnectModal, mounted }) => (
            <button type="button" className="trade-collateral__connect" onClick={() => mounted && openConnectModal()}>
              Connect wallet to deposit
            </button>
          )}
        </ConnectButton.Custom>
      ) : !onArc ? (
        <ConnectButton.Custom>
          {({ openChainModal, mounted }) => (
            <button type="button" className="trade-collateral__connect" onClick={() => mounted && openChainModal()}>
              Switch to Arc Testnet
            </button>
          )}
        </ConnectButton.Custom>
      ) : (
        <>
          <div className="trade-collateral__stats">
            <div><span>Wallet</span><strong className="mono">{formatUsdc(walletBalance?.value)} <small>USDC</small></strong></div>
            <div><span>In vault</span><strong className="mono">{formatUsdc(collateral)} <small>USDC</small></strong></div>
          </div>
          <form className="trade-collateral__form" onSubmit={handleDeposit}>
            <div className="trade-collateral__input-wrap">
              <input className="trade-collateral__amount mono" type="text" inputMode="decimal" placeholder="0.00" value={amount} disabled={busy} onChange={(event) => setAmount(event.target.value)} aria-label="USDC deposit amount" />
              <span>USDC</span>
            </div>
            <button type="button" className="trade-collateral__max" disabled={busy || walletUsdc <= 0} onClick={() => setAmount(trimAmount(walletUsdc))}>Max</button>
            <button type="submit" className="trade-collateral__deposit" disabled={busy || !VAULT_ADDRESS}>
              {busy ? 'Confirming…' : 'Deposit'}
            </button>
          </form>
          {error && <p className="trade-collateral__error" role="alert">{error}</p>}
          <p className="trade-collateral__note"><span aria-hidden="true">●</span> Arc Testnet · wallet signature required</p>
        </>
      )}
    </section>
  );
}
