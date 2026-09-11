(function () {
  'use strict';

  // Wires the homepage's Markets table and hero mock panel to real prices
  // via js/chart-datafeed.js's subscribeMarkets (Binance Futures combined
  // WebSocket market streams — markPrice + ticker — with an automatic
  // fallback to REST polling if the stream is unavailable). Each row's
  // static numbers are just the initial/offline state until the first
  // update arrives.
  if (!window.RailflowDatafeed) return;

  var SYMBOLS = ['BTC', 'ETH', 'SOL', 'LINK', 'HYPE', 'SUI', 'DOGE'];
  var format = function (value, digits) { return Number(value).toLocaleString('en-US', { minimumFractionDigits: digits === undefined ? 2 : digits, maximumFractionDigits: digits === undefined ? 2 : digits }); };

  function priceDigits(price) {
    if (price >= 100) return 2;
    if (price >= 1) return 3;
    return 5;
  }

  function formatCompactUsd(value) {
    if (!Number.isFinite(value)) return '—';
    if (value >= 1e9) return '$' + format(value / 1e9, 1) + 'B';
    if (value >= 1e6) return '$' + format(value / 1e6, 1) + 'M';
    if (value >= 1e3) return '$' + format(value / 1e3, 1) + 'K';
    return '$' + format(value);
  }

  // ---- Markets table ----
  var rows = {};
  document.querySelectorAll('#markets [data-market]').forEach(function (row) { rows[row.dataset.market] = row; });

  // The static numbers baked into index.html are just placeholder markup —
  // on a real page load they can sit stale for a few seconds before the
  // first live tick arrives (Binance's WebSocket stream occasionally opens
  // but then delivers nothing on some networks; js/chart-datafeed.js falls
  // back to REST polling after a short watchdog timeout). Showing those
  // stale numbers as if they were current would be exactly the kind of
  // fabricated-looking price this app is built to avoid, so blank
  // everything to a neutral "loading" placeholder immediately and let the
  // first real update (WS or REST) fill it in.
  function showLoadingState() {
    Object.keys(rows).forEach(function (symbol) {
      var row = rows[symbol];
      ['price', 'change', 'funding', 'interest'].forEach(function (field) {
        var el = row.querySelector('[data-field="' + field + '"]');
        if (!el) return;
        el.textContent = '…';
        el.classList.remove('up', 'down');
      });
    });
    if (!panel) return;
    var priceEl = panel.querySelector('.panel__price .price');
    var chgEl = panel.querySelector('.panel__price .price-chg');
    if (priceEl) priceEl.textContent = '…';
    if (chgEl) { chgEl.textContent = '…'; chgEl.classList.remove('up', 'down'); }
    var mid = panel.querySelector('.ob-mid span:first-child');
    if (mid) mid.textContent = '…';
    var entry = panel.querySelector('.order-summary div:first-child span:last-child');
    if (entry) entry.textContent = '…';
    var liq = panel.querySelector('.order-summary div:nth-child(2) span:last-child');
    if (liq) liq.textContent = '…';
    panel.querySelectorAll('.ob-row span:first-child').forEach(function (el) { el.textContent = '…'; });
  }

  function updateRow(symbol, ticker) {
    var row = rows[symbol];
    if (!row) return;
    var digits = priceDigits(ticker.price);
    var priceEl = row.querySelector('[data-field="price"]');
    var changeEl = row.querySelector('[data-field="change"]');
    var fundingEl = row.querySelector('[data-field="funding"]');
    var interestEl = row.querySelector('[data-field="interest"]');
    if (priceEl) priceEl.textContent = format(ticker.price, digits);
    if (changeEl && ticker.changePercent !== undefined) {
      changeEl.textContent = (ticker.changePercent >= 0 ? '+' : '') + format(ticker.changePercent) + '%';
      changeEl.className = 'ta-r ' + (ticker.changePercent >= 0 ? 'up' : 'down');
    }
    if (fundingEl && ticker.fundingRate !== undefined) {
      fundingEl.textContent = (ticker.fundingRate >= 0 ? '+' : '') + format(ticker.fundingRate, 4) + '%';
      fundingEl.className = 'ta-r ' + (ticker.fundingRate >= 0 ? 'up' : 'down');
    }
    if (interestEl && ticker.openInterestUsd !== undefined) interestEl.textContent = formatCompactUsd(ticker.openInterestUsd);
  }

  // ---- Hero mock panel (BTC) ----
  var panel = document.querySelector('.panel');
  var askOffsets = [0.00005, 0.00003, 0.00001]; // top row = farthest from mid, matches the original mock's spacing
  var bidOffsets = [0.00002, 0.00004, 0.00006];

  function updateHero(ticker) {
    if (!panel) return;
    var digits = priceDigits(ticker.price);
    var priceEl = panel.querySelector('.panel__price .price');
    var chgEl = panel.querySelector('.panel__price .price-chg');
    if (priceEl) priceEl.textContent = format(ticker.price, digits);
    if (chgEl && ticker.changePercent !== undefined) {
      chgEl.textContent = (ticker.changePercent >= 0 ? '+' : '') + format(ticker.changePercent) + '%';
      chgEl.className = 'mono price-chg ' + (ticker.changePercent >= 0 ? 'up' : 'down');
    }
    var mid = panel.querySelector('.ob-mid span:first-child');
    if (mid) mid.textContent = format(ticker.price, digits);
    var entry = panel.querySelector('.order-summary div:first-child span:last-child');
    if (entry) entry.textContent = format(ticker.price, digits);
    var liq = panel.querySelector('.order-summary div:nth-child(2) span:last-child');
    if (liq) liq.textContent = format(ticker.price * (1 - 0.891 / 20), digits); // matches the panel's example: 20x long
    panel.querySelectorAll('.ob-row.ask span:first-child').forEach(function (el, i) { el.textContent = format(ticker.price * (1 + (askOffsets[i] || 0.00001)), digits); });
    panel.querySelectorAll('.ob-row.bid span:first-child').forEach(function (el, i) { el.textContent = format(ticker.price * (1 - (bidOffsets[i] || 0.00006)), digits); });
  }

  showLoadingState();

  var sub;
  function start() {
    if (sub) window.RailflowDatafeed.unsubscribeMarkets(sub);
    sub = window.RailflowDatafeed.subscribeMarkets(SYMBOLS, function (symbol, ticker) {
      updateRow(symbol, ticker);
      if (symbol === 'BTC') updateHero(ticker);
    });
  }
  start();

  window.addEventListener('pagehide', function () { if (sub) { window.RailflowDatafeed.unsubscribeMarkets(sub); sub = null; } });
  // A page the browser restores from the back/forward cache (clicking Back
  // after visiting trade.html, for example) doesn't re-run this script —
  // it's the exact DOM/JS state from before, frozen — but its WebSocket was
  // already closed by pagehide above, so without this the table and hero
  // panel would just sit there showing whatever was last on screen forever.
  window.addEventListener('pageshow', function (event) { if (event.persisted) start(); });
})();
