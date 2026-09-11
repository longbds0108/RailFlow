import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useBalance } from 'wagmi';
import { shortAddress } from './address.js';

function BalanceChip({ address }) {
  const { data, isLoading } = useBalance({ address });
  const text = isLoading
    ? 'Loading…'
    : data
    ? Number(data.formatted).toLocaleString('en-US', { maximumFractionDigits: 4 })
    : '—';
  return (
    <span className="wallet-equity">
      <span className="micro-label">Wallet USDC</span>
      <span className="mono wallet-balance-value">{text}</span>
    </span>
  );
}

// Mounted into #wallet-trade-root (inside the .wallet-wrap container in
// trade.html's header). Reuses the .wallet-button / .wallet-equity /
// .wallet-avatar / .chevron classes already defined in css/trade.css.
// Clicking a connected wallet opens RainbowKit's own account modal
// (balance, copy address, explorer link, disconnect, network switch)
// instead of a hand-rolled dropdown.
export function TradeWalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, openAccountModal, mounted }) => {
        const connected = mounted && account && chain;
        const state = !mounted || !connected ? 'disconnected' : chain.unsupported ? 'wrong-network' : 'connected';
        return (
          <button
            type="button"
            className="wallet-button"
            data-state={state}
            aria-haspopup="dialog"
            onClick={() => {
              if (!mounted) return;
              if (!connected) return openConnectModal();
              if (chain.unsupported) return openChainModal();
              openAccountModal();
            }}
          >
            {state === 'connected' && <BalanceChip address={account.address} />}
            {state === 'connected' && <span className="wallet-avatar" aria-hidden="true"></span>}
            <span className="mono wallet-address">
              {state === 'disconnected' ? 'Connect wallet' : state === 'wrong-network' ? 'Wrong network' : shortAddress(account.address)}
            </span>
            <span className="chevron" aria-hidden="true">▾</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
