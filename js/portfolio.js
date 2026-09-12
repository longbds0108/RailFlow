(function () {
  'use strict';

  var SYMBOLS = ['BTC', 'ETH', 'SOL', 'LINK', 'HYPE', 'SUI', 'DOGE'];
  var ARC_SCAN_API = 'https://api-testnet.arc-scan.org/api';
  var ARC_SCAN_EXPLORER = 'https://testnet.arc-scan.org';
  var account = null;
  var marketSub = null;
  var historyTimer = null;

  function formatPrice(value) {
    var digits = value >= 100 ? 2 : value >= 1 ? 3 : 5;
    return Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function formatNumber(value, digits) {
    return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
  }

  function compactAddress(address) {
    return address ? address.slice(0, 8) + '…' + address.slice(-6) : 'Not connected';
  }

  function formatNativeAmount(raw) {
    if (raw === undefined || raw === null || raw === '') return '0';
    try {
      var value = BigInt(String(raw));
      var scale = 1000000000000000000n;
      var whole = value / scale;
      var fraction = (value % scale).toString().padStart(18, '0').slice(0, 4).replace(/0+$/, '');
      return whole.toString() + (fraction ? '.' + fraction : '');
    } catch (err) {
      return '—';
    }
  }

  function relativeType(tx, address) {
    var from = String(tx.from || '').toLowerCase();
    var to = String(tx.to || '').toLowerCase();
    var normalized = address.toLowerCase();
    if (from === normalized && to === normalized) return { label: 'Self', className: 'portfolio-direction--self' };
    if (from === normalized) return { label: 'Sent', className: 'portfolio-direction--sent' };
    return { label: 'Received', className: 'portfolio-direction--received' };
  }

  function setAccountState(detail) {
    account = detail || null;
    var connected = !!(account && account.address && account.isConnected);
    var onArc = connected && account.onArc;
    var state = document.getElementById('portfolioAccountState');
    var addressEl = document.getElementById('portfolioWalletAddress');
    var titleEl = document.getElementById('portfolioWalletTitle');
    var balanceEl = document.getElementById('portfolioWalletBalance');
    var balanceMeta = document.getElementById('portfolioWalletBalanceMeta');
    var networkMeta = document.getElementById('portfolioNetworkMeta');
    var copyButton = document.getElementById('portfolioCopyAddress');
    var refreshButton = document.getElementById('portfolioRefresh');
    var explorerLink = document.getElementById('portfolioExplorerLink');
    if (addressEl) addressEl.textContent = connected ? compactAddress(account.address) : 'Not connected';
    if (titleEl) titleEl.textContent = onArc ? 'Connected wallet' : connected ? 'Wrong network' : 'Connect to sync';
    if (balanceEl) balanceEl.textContent = account && account.balance ? formatNumber(account.balance, 4) + ' USDC' : '—';
    if (balanceMeta) balanceMeta.textContent = onArc ? 'Live native balance' : connected ? 'Switch to Arc Testnet' : 'Waiting for Arc Testnet wallet';
    if (networkMeta) networkMeta.textContent = onArc ? 'Arc Testnet · chain 5042002' : connected ? 'Wrong network' : 'Arc Testnet · chain 5042002';
    if (copyButton) { copyButton.disabled = !connected; copyButton.onclick = connected ? function () { navigator.clipboard?.writeText(account.address); } : null; }
    if (refreshButton) refreshButton.disabled = !onArc;
    if (explorerLink) explorerLink.href = onArc ? ARC_SCAN_EXPLORER + '/address/' + account.address : ARC_SCAN_EXPLORER;
    if (state) {
      state.innerHTML = '<span class="portfolio-live-dot"></span>' + (onArc ? 'WALLET SYNCED' : connected ? 'SWITCH TO ARC TESTNET' : 'CONNECT A WALLET TO SYNC');
    }
    if (onArc) {
      loadHistory();
      if (historyTimer) clearInterval(historyTimer);
      historyTimer = setInterval(loadHistory, 30000);
    } else {
      if (historyTimer) clearInterval(historyTimer);
      historyTimer = null;
      renderHistory([]);
      setHistoryStatus(connected ? 'Switch wallet to Arc Testnet' : 'Connect wallet to load history');
    }
  }

  function updateVaultCollateral() {
    var value = document.getElementById('portfolioVaultBalance');
    var meta = document.getElementById('portfolioVaultBalanceMeta');
    var vault = window.RailflowVault;
    if (!value || !meta) return;
    if (vault && vault.ready) {
      value.textContent = Number(vault.collateral || 0).toLocaleString('en-US', { maximumFractionDigits: 4 }) + ' USDC';
      meta.textContent = 'Linked Circle wallet collateral';
    } else if (vault && vault.configured) {
      value.textContent = '—';
      meta.textContent = 'Set up a Circle wallet to view collateral';
    } else {
      value.textContent = '—';
      meta.textContent = 'Vault not configured';
    }
  }

  function setHistoryStatus(text) {
    var status = document.getElementById('portfolioHistoryStatus');
    if (status) status.textContent = text;
  }

  function renderHistory(transactions) {
    var body = document.getElementById('portfolioHistoryBody');
    var count = document.getElementById('portfolioTransactionCount');
    var meta = document.getElementById('portfolioTransactionMeta');
    if (count) count.textContent = account && account.onArc ? String(transactions.length) : '—';
    if (meta) meta.textContent = account && account.onArc ? 'Latest 50 from Arcscan' : 'Arcscan history';
    if (!body) return;
    if (!transactions.length) {
      body.innerHTML = '<tr><td colspan="6" class="portfolio-empty-state">' + (account && account.onArc ? 'No indexed transactions found for this address.' : 'Connect a wallet on Arc Testnet to view verified history.') + '</td></tr>';
      return;
    }
    var address = account.address.toLowerCase();
    body.innerHTML = transactions.map(function (tx) {
      var type = relativeType(tx, address);
      var failed = String(tx.isError || '0') !== '0' || String(tx.txreceipt_status || '1') === '0';
      var method = tx.functionName ? String(tx.functionName).split('(')[0] : (tx.input && tx.input !== '0x' ? 'Contract call' : 'Native transfer');
      var time = tx.timeStamp ? new Date(Number(tx.timeStamp) * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      var amount = formatNativeAmount(tx.value);
      return '<tr>' +
        '<td><span class="portfolio-history-hash"><a href="' + ARC_SCAN_EXPLORER + '/tx/' + tx.hash + '" target="_blank" rel="noopener noreferrer" class="mono">' + compactAddress(tx.hash) + '</a><small>' + method + '</small></span></td>' +
        '<td><span class="portfolio-direction ' + type.className + '">' + type.label + '</span></td>' +
        '<td><span class="portfolio-transaction-amount mono">' + amount + ' USDC</span><small class="portfolio-transaction-amount"><small>native value · 18 decimals</small></small></td>' +
        '<td><span class="portfolio-tx-status ' + (failed ? 'is-failed' : '') + '">' + (failed ? 'Failed' : 'Success') + '</span></td>' +
        '<td class="mono">' + time + '</td>' +
        '<td><a href="' + ARC_SCAN_EXPLORER + '/tx/' + tx.hash + '" target="_blank" rel="noopener noreferrer" aria-label="View transaction on Arcscan">↗</a></td>' +
        '</tr>';
    }).join('');
  }

  async function loadHistory() {
    if (!account || !account.address || !account.onArc) return;
    setHistoryStatus('Syncing Arcscan…');
    try {
      var params = new URLSearchParams({ module: 'account', action: 'txlist', address: account.address, startblock: '0', endblock: '99999999', page: '1', offset: '50', sort: 'desc' });
      var response = await fetch(ARC_SCAN_API + '?' + params.toString());
      if (!response.ok) throw new Error('Arcscan HTTP ' + response.status);
      var data = await response.json();
      if (data.status !== '1') {
        if (data.message === 'No transactions found' || data.result === 'No transactions found') {
          renderHistory([]);
          setHistoryStatus('No indexed transactions');
          return;
        }
        throw new Error(data.result || data.message || 'Arcscan returned no transaction list.');
      }
      if (!Array.isArray(data.result)) throw new Error('Arcscan returned no transaction list.');
      renderHistory(data.result);
      var sync = document.getElementById('portfolioLastSync');
      if (sync) sync.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setHistoryStatus('Synced just now');
    } catch (err) {
      renderHistory([]);
      setHistoryStatus('History unavailable · retry');
      var body = document.getElementById('portfolioHistoryBody');
      if (body) body.innerHTML = '<tr><td colspan="6" class="portfolio-empty-state">Could not load Arcscan history right now. <button type="button" class="portfolio-inline-retry" id="portfolioInlineRetry">Retry</button></td></tr>';
      var retry = document.getElementById('portfolioInlineRetry');
      if (retry) retry.addEventListener('click', loadHistory);
      console.warn('[portfolio] transaction history unavailable:', err.message);
    }
  }

  function startMarkets() {
    if (!window.RailflowDatafeed) return;
    if (marketSub) window.RailflowDatafeed.unsubscribeMarkets(marketSub);
    marketSub = window.RailflowDatafeed.subscribeMarkets(SYMBOLS, function (symbol, ticker) {
      if (!ticker || !Number.isFinite(ticker.price)) return;
      var digits = ticker.price >= 100 ? 2 : ticker.price >= 1 ? 3 : 5;
      document.querySelectorAll('[data-live-price="' + symbol + '"]').forEach(function (el) { el.textContent = formatPrice(ticker.price, digits); });
      document.querySelectorAll('[data-live-change="' + symbol + '"]').forEach(function (el) {
        if (ticker.changePercent === undefined) return;
        el.textContent = (ticker.changePercent >= 0 ? '+' : '') + formatNumber(ticker.changePercent, 2) + '%';
        el.classList.remove('up', 'down');
        el.classList.add(ticker.changePercent >= 0 ? 'up' : 'down');
      });
      var status = document.getElementById('portfolioFeedStatus');
      if (status) status.textContent = 'LIVE PRICES';
    });
  }

  document.addEventListener('railflow:portfolio-account', function (event) { setAccountState(event.detail); });
  window.addEventListener('railflow:vault-updated', updateVaultCollateral);
  var refresh = document.getElementById('portfolioRefresh');
  if (refresh) refresh.addEventListener('click', loadHistory);
  startMarkets();
  updateVaultCollateral();
  if (window.RailflowPortfolio) setAccountState(window.RailflowPortfolio);
  window.addEventListener('pagehide', function () {
    if (marketSub) { window.RailflowDatafeed.unsubscribeMarkets(marketSub); marketSub = null; }
    if (historyTimer) { clearInterval(historyTimer); historyTimer = null; }
  });
  window.addEventListener('pageshow', function (event) { if (event.persisted) { startMarkets(); if (window.RailflowPortfolio) setAccountState(window.RailflowPortfolio); } });
})();
