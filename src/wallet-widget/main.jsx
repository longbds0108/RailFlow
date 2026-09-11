import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { Providers } from './Providers.jsx';
import { HomeConnectButton } from './HomeConnectButton.jsx';
import { TradeWalletButton } from './TradeWalletButton.jsx';
import { ConnectionBar } from './ConnectionBar.jsx';

// One bundle serves both pages. Each page only has the mount points it
// needs, so most of these portals are no-ops on any given page. All three
// share a single Providers tree so wallet state stays in sync between the
// header button and the connection bar on trade.html.
function App() {
  const home = document.getElementById('wallet-home-root');
  const tradeButton = document.getElementById('wallet-trade-root');
  const connectionBar = document.getElementById('wallet-connection-root');
  return (
    <Providers>
      {home && createPortal(<HomeConnectButton />, home)}
      {tradeButton && createPortal(<TradeWalletButton />, tradeButton)}
      {connectionBar && createPortal(<ConnectionBar />, connectionBar)}
    </Providers>
  );
}

const mount = document.createElement('div');
mount.id = 'wallet-widget-root';
document.body.appendChild(mount);
createRoot(mount).render(<App />);
