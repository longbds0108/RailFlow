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
  const collateralUsdc = collateral !== undefined ? Number(formatEther(collateral)) : 0;
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
        <div>
          <span className="trade-collateral__eyebrow">Collateral Vault</span>
          <h2>Fund your demo margin</h2>
        </div>
        <a className="text-link" href="vault.html">Open Vault ↗</a>
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
            <div><span>Wallet balance</span><strong className="mono">{formatUsdc(walletBalance?.value)} USDC</strong></div>
            <div><span>Collateral</span><strong className="mono">{formatUsdc(collateral)} USDC</strong></div>
          </div>
          <form className="trade-collateral__form" onSubmit={handleDeposit}>
            <div className="trade-collateral__input-wrap">
              <input className="mono" type="text" inputMode="decimal" placeholder="Amount" value={amount} disabled={busy} onChange={(event) => setAmount(event.target.value)} aria-label="USDC deposit amount" />
              <span>USDC</span>
            </div>
            <button type="button" className="trade-collateral__max" disabled={busy || walletUsdc <= 0} onClick={() => setAmount(trimAmount(walletUsdc))}>Max</button>
            <button type="submit" className="trade-collateral__deposit" disabled={busy || !VAULT_ADDRESS}>
              {busy ? 'Confirming…' : amount ? `Deposit ${amount} USDC` : 'Deposit USDC'}
            </button>
          </form>
          {error && <p className="trade-collateral__error" role="alert">{error}</p>}
          <p className="trade-collateral__note">Deposit is signed directly by your wallet on Arc Testnet. Trading P&amp;L is simulated.</p>
        </>
      )}
    </section>
  );
}
