(function () {
  'use strict';

  if (!window.RailflowDatafeed) return;

  var SYMBOLS = ['BTC', 'ETH', 'SOL', 'LINK', 'HYPE', 'SUI', 'DOGE'];
  var selectedAsset = 'BTC';
  var selectedAction = 'supply';
  var account = null;
  var marketState = null;

  function priceDigits(price) {
    if (price >= 100) return 2;
    if (price >= 1) return 3;
    return 5;
  }

  function format(value, digits) {
    return Number(value).toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function formatBalance(value) {
    if (!Number.isFinite(value)) return '—';
    return Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' USDC';
  }

  function formatToken(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' USDC' : '—';
  }

  function formatApy(bps) {
    var number = Number(bps);
    return Number.isFinite(number) ? (number / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + '%' : '—';
  }

  function updateActionButton() {
    var button = document.getElementById('lendingActionButton');
    var note = document.getElementById('lendingActionNote');
    var input = document.getElementById('lendingAmount');
    if (!button) return;
    var amount = input ? Number(input.value.replace(',', '.')) : NaN;
    var connected = marketState && marketState.enabled;
    var busy = marketState && marketState.isBusy;
    var capacity = marketState && marketState.position ? Number(marketState.position.borrowCapacity) : NaN;
    var balance = account && account.balance ? Number(account.balance) : NaN;
    var valid = connected && Number.isFinite(amount) && amount > 0 && (selectedAction === 'borrow' ? (!Number.isFinite(capacity) || amount <= capacity) : (!Number.isFinite(balance) || amount <= balance));
    button.disabled = !valid || !!busy;
    button.textContent = busy ? 'Confirming…' : (selectedAction === 'borrow' ? 'Borrow USDC' : 'Supply USDC');
    if (note && marketState && marketState.error) note.textContent = marketState.error;
  }

  function renderMarketState(detail) {
    marketState = detail || null;
    var market = marketState && marketState.market;
    var position = marketState && marketState.position;
    var suppliedEl = document.getElementById('lendingTotalSupplied');
    var borrowedEl = document.getElementById('lendingTotalBorrowed');
    var utilizationEl = document.getElementById('lendingUtilization');
    var statusEl = document.getElementById('lendingMarketStatus');
    var poolStateEl = document.getElementById('lendingPoolState');
    var supplyApyEl = document.getElementById('lendingSupplyApy');
    var borrowApyEl = document.getElementById('lendingBorrowApy');
    var capacityEl = document.getElementById('lendingBorrowCapacity');
    if (suppliedEl) suppliedEl.textContent = market ? formatToken(market.totalSupplied) : '—';
    if (borrowedEl) borrowedEl.textContent = market ? formatToken(market.totalBorrowed) : '—';
    if (utilizationEl) utilizationEl.textContent = market ? formatApy(market.utilizationBps) : '—';
    if (supplyApyEl) supplyApyEl.textContent = market ? formatApy(market.supplyApyBps) : '—';
    if (borrowApyEl) borrowApyEl.textContent = market ? formatApy(market.borrowApyBps) : '—';
    if (capacityEl) capacityEl.textContent = position ? formatToken(position.borrowCapacity) : '—';
    if (statusEl) statusEl.textContent = marketState && marketState.enabled ? 'LIVE' : 'CONNECT WALLET';
    if (poolStateEl) poolStateEl.textContent = market ? 'On-chain money market' : 'Waiting for wallet';
    if (marketState && marketState.isConfirmed) {
      var note = document.getElementById('lendingActionNote');
      if (note) note.textContent = 'Transaction confirmed on Arc Testnet.';
    }
    updateActionButton();
  }

  function renderAccount(detail) {
    account = detail || null;
    var onArc = !!(account && account.isConnected && account.onArc);
    var balance = onArc && account.balance ? Number(account.balance) : NaN;
    var balanceEl = document.getElementById('lendingBalance');
    var stateEl = document.getElementById('lendingWalletState');
    var input = document.getElementById('lendingAmount');
    if (balanceEl) balanceEl.textContent = selectedAction === 'supply' ? 'Wallet ' + formatBalance(balance) : 'Borrow capacity —';
    if (stateEl) {
      stateEl.textContent = onArc ? 'Arc Testnet · ' + formatBalance(balance) :
        (account && account.isConnected ? 'Switch to Arc Testnet' : 'Not connected');
    }
    if (input) input.max = selectedAction === 'supply' && Number.isFinite(balance) ? String(balance) : '';
  }

  function renderLendingChart(symbol) {
    var candles = document.getElementById('lendingCandles');
    var emptyEl = document.getElementById('lendingChartEmpty');
    var titleEl = document.getElementById('lendingChartTitle');
    var statusEl = document.getElementById('lendingChartStatus');
    if (candles) candles.replaceChildren();
    if (emptyEl) emptyEl.textContent = 'Lending candle history unavailable';
    if (titleEl) titleEl.textContent = symbol + ' lending rates';
    if (statusEl) statusEl.textContent = 'POOL DATA PENDING';
  }

  function updateLiveValue(symbol, ticker) {
    var price = ticker.price;
    var change = ticker.changePercent;
    var digits = priceDigits(price);
    document.querySelectorAll('[data-live-price="' + symbol + '"]').forEach(function (el) {
      el.textContent = format(price, digits);
      el.classList.remove('is-loading');
    });
    document.querySelectorAll('[data-live-change="' + symbol + '"]').forEach(function (el) {
      if (change === undefined) return;
      el.textContent = (change >= 0 ? '+' : '') + format(change, 2) + '%';
      el.classList.remove('up', 'down');
      el.classList.add(change >= 0 ? 'up' : 'down');
    });
  }

  function start() {
    if (window.railflowLendingSub) window.RailflowDatafeed.unsubscribeMarkets(window.railflowLendingSub);
    var status = document.getElementById('lendingFeedStatus');
    window.railflowLendingSub = window.RailflowDatafeed.subscribeMarkets(SYMBOLS, function (symbol, ticker) {
      if (ticker && Number.isFinite(ticker.price)) {
        updateLiveValue(symbol, ticker);
        if (status) status.textContent = 'LIVE MARKETS';
      }
    });
    renderLendingChart(selectedAsset);
  }

  document.querySelectorAll('.lending-row-action').forEach(function (button) {
    button.addEventListener('click', function () {
      var asset = button.dataset.asset;
      selectedAsset = asset;
      var row = document.querySelector('[data-live-row="' + asset + '"]');
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      renderLendingChart(asset);
    });
  });

  document.querySelectorAll('[data-lending-action]').forEach(function (button) {
    button.addEventListener('click', function () {
      selectedAction = button.dataset.lendingAction;
      document.querySelectorAll('[data-lending-action]').forEach(function (tab) {
        var active = tab === button;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      renderAccount(account);
    });
  });

  var amountInput = document.getElementById('lendingAmount');
  if (amountInput) amountInput.addEventListener('input', function () {
    this.value = this.value.replace(/[^0-9.,]/g, '').replace(/(.*)\.(?=.*\.)/g, '$1');
    updateActionButton();
  });

  var actionButton = document.getElementById('lendingActionButton');
  if (actionButton) actionButton.addEventListener('click', function () {
    var amount = amountInput ? amountInput.value.replace(',', '.') : '';
    window.dispatchEvent(new CustomEvent('railflow:lending-submit', { detail: { action: selectedAction, amount: amount } }));
  });

  window.addEventListener('railflow:portfolio-account', function (event) { renderAccount(event.detail); });
  window.addEventListener('railflow:lending-state', function (event) { renderMarketState(event.detail); });
  if (window.RailflowPortfolio) renderAccount(window.RailflowPortfolio);

  start();
  window.addEventListener('pagehide', function () {
    if (window.railflowLendingSub) {
      window.RailflowDatafeed.unsubscribeMarkets(window.railflowLendingSub);
      window.railflowLendingSub = null;
    }
  });
  window.addEventListener('pageshow', function (event) { if (event.persisted) start(); });
})();
