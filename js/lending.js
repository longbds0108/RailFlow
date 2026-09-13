(function () {
  'use strict';

  if (!window.RailflowDatafeed) return;

  var SYMBOLS = ['BTC', 'ETH', 'SOL', 'LINK', 'HYPE', 'SUI', 'DOGE'];
  var selectedAsset = 'BTC';
  var selectedAction = 'supply';
  var account = null;

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
  });

  window.addEventListener('railflow:portfolio-account', function (event) { renderAccount(event.detail); });
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
