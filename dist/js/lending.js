(function () {
  'use strict';

  if (!window.RailflowDatafeed) return;

  var SYMBOLS = ['BTC', 'ETH', 'SOL', 'LINK', 'HYPE', 'SUI', 'DOGE'];

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
  }

  document.querySelectorAll('.lending-row-action').forEach(function (button) {
    button.addEventListener('click', function () {
      var asset = button.dataset.asset;
      var row = document.querySelector('[data-live-row="' + asset + '"]');
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  start();
  window.addEventListener('pagehide', function () {
    if (window.railflowLendingSub) {
      window.RailflowDatafeed.unsubscribeMarkets(window.railflowLendingSub);
      window.railflowLendingSub = null;
    }
  });
  window.addEventListener('pageshow', function (event) { if (event.persisted) start(); });
})();
