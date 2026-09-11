(function () {
  'use strict';

  var markets = {
    BTC: { name: 'Bitcoin', price: 112480.50, oracle: 112479.80, change: 2.14, funding: 0.0041, interest: '$38.2M', volume: '$214.6M', maxLev: 50, step: 0.5 },
    ETH: { name: 'Ethereum', price: 4182.30, oracle: 4182.12, change: 1.08, funding: 0.0026, interest: '$21.7M', volume: '$98.2M', maxLev: 50, step: 0.05 },
    SOL: { name: 'Solana', price: 214.86, oracle: 214.84, change: -0.92, funding: -0.0013, interest: '$12.4M', volume: '$46.8M', maxLev: 25, step: 0.01 }
  };
  var state = { market: 'BTC', timeframe: '15m', chartType: 'candles', side: 'long', type: 'limit', activity: 'positions', leverage: 10, marginMode: 'cross', priceDirty: false };
  // Fraction of a position's initial margin held back as maintenance margin
  // once opened (matches the 0.891 "loss before liquidation" constant used
  // by the isolated liquidation-price estimate below: 1 - 0.891 = 0.109).
  var MAINT_MARGIN_RATIO = 0.109;
  var $ = function (id) { return document.getElementById(id); };
  var format = function (value, digits) { return Number(value).toLocaleString('en-US', { minimumFractionDigits: digits === undefined ? 2 : digits, maximumFractionDigits: digits === undefined ? 2 : digits }); };
  var money = function (value) { return '$' + format(value); };

  function formatCompactUsd(value) {
    if (!Number.isFinite(value)) return '—';
    if (value >= 1e9) return '$' + format(value / 1e9, 1) + 'B';
    if (value >= 1e6) return '$' + format(value / 1e6, 1) + 'M';
    if (value >= 1e3) return '$' + format(value / 1e3, 1) + 'K';
    return money(value);
  }

  var chart, priceSeries, volumeSeries, chartSub, tickerSub;

  function ensureChart() {
    if (chart) return;
    chart = LightweightCharts.createChart($('priceChart'), {
      layout: { background: { color: 'transparent' }, textColor: '#7f8c9b', fontSize: 11 },
      grid: { vertLines: { color: '#182129' }, horzLines: { color: '#182129' } },
      rightPriceScale: { borderColor: '#1c2b35' },
      timeScale: { borderColor: '#1c2b35', timeVisible: true, secondsVisible: false },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      autoSize: true
    });
    volumeSeries = chart.addSeries(LightweightCharts.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume' });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    // priceSeries changes type when the chart-style picker is used, so this
    // reads the variable fresh on every move rather than closing over one
    // fixed series, and handles both OHLC-shaped and single-value-shaped
    // series data.
    chart.subscribeCrosshairMove(function (param) {
      var point = param && param.time && priceSeries && param.seriesData && param.seriesData.get(priceSeries);
      if (!point) { $('chartTooltip').hidden = true; return; }
      $('chartTooltip').textContent = point.open !== undefined
        ? 'O ' + format(point.open) + '  H ' + format(point.high) + '  L ' + format(point.low) + '  C ' + format(point.close)
        : 'Price ' + format(point.value);
      $('chartTooltip').hidden = false;
    });
  }

  function updateOhlc(bar) {
    var up = bar.close >= bar.open;
    $('chartOhlc').innerHTML = '<span>O <b>' + format(bar.open, 1) + '</b></span><span>H <b>' + format(bar.high, 1) + '</b></span><span>L <b>' + format(bar.low, 1) + '</b></span><span>C <b class="' + (up ? 'up' : 'down') + '">' + format(bar.close, 1) + '</b></span>';
  }

  // ---- Chart style (Bars/Candles/Line/Area/.../Heikin Ashi) ----
  // The OHLC toolbar readout always reflects the raw candle regardless of
  // style — only the plotted series changes shape. Heikin Ashi is a
  // transform of the whole history (each bar depends on the previous HA
  // bar), so its live updates re-run the transform over the kept history
  // rather than patching a single point; every other style updates in
  // place, which is cheap enough at ~150 bars either way.
  function heikinAshi(candles) {
    var out = [];
    var prevOpen, prevClose;
    for (var i = 0; i < candles.length; i++) {
      var c = candles[i];
      var haClose = (c.open + c.high + c.low + c.close) / 4;
      var haOpen = i === 0 ? (c.open + c.close) / 2 : (prevOpen + prevClose) / 2;
      out.push({ time: c.time, open: haOpen, high: Math.max(c.high, haOpen, haClose), low: Math.min(c.low, haOpen, haClose), close: haClose });
      prevOpen = haOpen;
      prevClose = haClose;
    }
    return out;
  }
  function toLineData(candles) { return candles.map(function (c) { return { time: c.time, value: c.close }; }); }
  function toHlcAreaData(candles) { return candles.map(function (c) { return { time: c.time, value: (c.high + c.low + c.close) / 3 }; }); }
  function toColumnData(candles) {
    return candles.map(function (c, i) {
      var prevClose = i > 0 ? candles[i - 1].close : c.open;
      return { time: c.time, value: c.close, color: c.close >= prevClose ? '#32cc9a' : '#ff6678' };
    });
  }

  function buildSeriesFor(type) {
    switch (type) {
      case 'bars': return chart.addSeries(LightweightCharts.BarSeries, { upColor: '#32cc9a', downColor: '#ff6678' });
      case 'hollow': return chart.addSeries(LightweightCharts.CandlestickSeries, { upColor: 'rgba(0,0,0,0)', downColor: '#ff6678', borderVisible: true, borderUpColor: '#32cc9a', borderDownColor: '#ff6678', wickUpColor: '#32cc9a', wickDownColor: '#ff6678' });
      case 'line': return chart.addSeries(LightweightCharts.LineSeries, { color: '#5ee3c4', lineWidth: 2 });
      case 'line-markers': return chart.addSeries(LightweightCharts.LineSeries, { color: '#5ee3c4', lineWidth: 2, pointMarkersVisible: true });
      case 'step': return chart.addSeries(LightweightCharts.LineSeries, { color: '#5ee3c4', lineWidth: 2, lineType: LightweightCharts.LineType.WithSteps });
      case 'area': case 'hlc-area': return chart.addSeries(LightweightCharts.AreaSeries, { lineColor: '#5ee3c4', topColor: 'rgba(94,227,196,.32)', bottomColor: 'rgba(94,227,196,0)' });
      case 'baseline': return chart.addSeries(LightweightCharts.BaselineSeries, { topLineColor: '#32cc9a', bottomLineColor: '#ff6678', topFillColor1: 'rgba(50,204,154,.28)', topFillColor2: 'rgba(50,204,154,0)', bottomFillColor1: 'rgba(255,102,120,0)', bottomFillColor2: 'rgba(255,102,120,.28)' });
      case 'columns': return chart.addSeries(LightweightCharts.HistogramSeries, { priceFormat: { type: 'price', precision: 2, minMove: 0.01 } });
      case 'highlow': return chart.addSeries(LightweightCharts.BarSeries, { upColor: '#32cc9a', downColor: '#ff6678', openVisible: false });
      case 'heikin-ashi': return chart.addSeries(LightweightCharts.CandlestickSeries, { upColor: '#32cc9a', downColor: '#ff6678', borderVisible: false, wickUpColor: '#32cc9a', wickDownColor: '#ff6678' });
      default: return chart.addSeries(LightweightCharts.CandlestickSeries, { upColor: '#32cc9a', downColor: '#ff6678', borderVisible: false, wickUpColor: '#32cc9a', wickDownColor: '#ff6678', priceFormat: { type: 'price', precision: 2, minMove: 0.01 } });
    }
  }

  function dataForType(type, candles) {
    switch (type) {
      case 'bars': case 'hollow': case 'highlow': return candles;
      case 'heikin-ashi': return heikinAshi(candles);
      case 'hlc-area': return toHlcAreaData(candles);
      case 'columns': return toColumnData(candles);
      case 'line': case 'line-markers': case 'step': case 'area': case 'baseline': return toLineData(candles);
      default: return candles;
    }
  }

  var lastHistory;

  function applyChartType(type) {
    state.chartType = type;
    if (priceSeries) { chart.removeSeries(priceSeries); priceSeries = null; }
    priceSeries = buildSeriesFor(type);
    if (lastHistory) priceSeries.setData(dataForType(type, lastHistory.candles));
    $('chartTypeIcon').innerHTML = window.RailflowChartTypes.icons[type] || window.RailflowChartTypes.icons.candles;
    $('chartTypeButton').setAttribute('aria-label', 'Chart type: ' + window.RailflowChartTypes.label(type));
    document.querySelectorAll('#chartTypeMenu [data-chart-type]').forEach(function (button) {
      button.setAttribute('aria-checked', String(button.dataset.chartType === type));
    });
  }

  function upsertCandle(candle) {
    if (!lastHistory) return;
    var candles = lastHistory.candles;
    var last = candles[candles.length - 1];
    if (last && last.time === candle.time) candles[candles.length - 1] = candle;
    else candles.push(candle);
  }

  function applyLiveTick(candle) {
    if (!priceSeries) return;
    var type = state.chartType;
    if (type === 'heikin-ashi') { priceSeries.setData(heikinAshi(lastHistory.candles)); return; }
    if (type === 'bars' || type === 'hollow' || type === 'highlow') { priceSeries.update(candle); return; }
    if (type === 'hlc-area') { priceSeries.update({ time: candle.time, value: (candle.high + candle.low + candle.close) / 3 }); return; }
    if (type === 'columns') {
      var candles = lastHistory.candles;
      var idx = candles.length - 1;
      var prevClose = idx > 0 ? candles[idx - 1].close : candle.open;
      priceSeries.update({ time: candle.time, value: candle.close, color: candle.close >= prevClose ? '#32cc9a' : '#ff6678' });
      return;
    }
    // line, line-markers, step, area, baseline, and the plain candlestick default
    if (type === 'line' || type === 'line-markers' || type === 'step' || type === 'area' || type === 'baseline') {
      priceSeries.update({ time: candle.time, value: candle.close });
      return;
    }
    priceSeries.update(candle);
  }

  function initChartTypeMenu() {
    var groups = [];
    window.RailflowChartTypes.list.forEach(function (item) {
      if (item.newGroup || !groups.length) groups.push([]);
      groups[groups.length - 1].push(item);
    });
    $('chartTypeMenu').innerHTML = groups.map(function (group) {
      return '<div class="chart-type-menu-group">' + group.map(function (item) {
        return '<button type="button" role="menuitemradio" data-chart-type="' + item.id + '" aria-checked="' + (item.id === state.chartType) + '">' + window.RailflowChartTypes.icons[item.id] + '<span>' + item.label + '</span></button>';
      }).join('') + '</div>';
    }).join('');
  }

  var chartRequest = 0;

  async function drawChart() {
    ensureChart();
    if (chartSub) { window.RailflowDatafeed.unsubscribeBars(chartSub); chartSub = null; }
    var market = state.market;
    var timeframe = state.timeframe;
    var requestId = ++chartRequest;
    var history = await window.RailflowDatafeed.getBars(market, timeframe, markets[market].price, 150);
    // The user may have switched market/timeframe again while this request
    // was in flight; a stale response must not overwrite the newer one.
    if (requestId !== chartRequest) return;
    lastHistory = history;
    applyChartType(state.chartType);
    volumeSeries.setData(history.volumes);
    chart.timeScale().fitContent();
    var lastCandle = history.candles[history.candles.length - 1];
    var lastVolume = history.volumes[history.volumes.length - 1];
    updateOhlc(lastCandle);
    chartSub = window.RailflowDatafeed.subscribeBars(market, timeframe, lastCandle, lastVolume, function (candle, volume) {
      if (requestId !== chartRequest) return;
      upsertCandle(candle);
      volumeSeries.update(volume);
      applyLiveTick(candle);
      updateOhlc(candle);
      if (market === state.market) { markets[market].price = candle.close; renderMarketStrip(market); syncOrderPriceLive(market, candle.close); updateSummary(); drawActivity(); }
    });
    $('priceChart').setAttribute('aria-label', market + ' perpetual ' + timeframe + ' ' + window.RailflowChartTypes.label(state.chartType) + ' chart, live from Binance Futures');
  }

  // Real depth from Binance Futures (see js/chart-datafeed.js). Levels are
  // grouped into price buckets sized by the precision dropdown — asks
  // round up to their bucket, bids round down, the same convention real
  // order-book "group by" controls use — then re-rendered from the last
  // book on a precision change without waiting for the next tick.
  var bookSub, lastBook;

  function groupLevels(levels, step, isAsk) {
    var buckets = [];
    var index = {};
    levels.forEach(function (level) {
      var bucketPrice = (isAsk ? Math.ceil(level.price / step) : Math.floor(level.price / step)) * step;
      var key = bucketPrice.toFixed(8);
      if (!(key in index)) { index[key] = { price: bucketPrice, qty: 0 }; buckets.push(index[key]); }
      index[key].qty += level.qty;
    });
    return buckets;
  }

  function renderOrderBook(book) {
    var digits = state.market === 'BTC' ? 1 : state.market === 'ETH' ? 2 : 3;
    var step = Number($('bookPrecision').value);
    var asks = groupLevels(book.asks, step, true).slice(0, 7).reverse();
    var bids = groupLevels(book.bids, step, false).slice(0, 7);
    var maxQty = Math.max.apply(null, asks.concat(bids).map(function (l) { return l.qty; }).concat([0.0001]));
    function rows(levels, isAsk) {
      var total = 0;
      return levels.map(function (level) {
        total += level.qty;
        var depth = Math.min(100, Math.round(level.qty / maxQty * 100));
        return '<button type="button" class="book-row ' + (isAsk ? 'ask' : 'bid') + '" style="--depth:' + depth + '%" data-book-price="' + level.price.toFixed(8) + '" aria-label="Use price ' + format(level.price, digits) + '"><span>' + format(level.price, digits) + '</span><span>' + format(level.qty, 3) + '</span><span>' + format(total) + '</span></button>';
      }).join('');
    }
    $('bookAsks').innerHTML = rows(asks, true);
    $('bookBids').innerHTML = rows(bids, false);
    var bestBid = book.bids[0] ? book.bids[0].price : markets[state.market].price;
    var bestAsk = book.asks[0] ? book.asks[0].price : markets[state.market].price;
    $('bookMark').textContent = format((bestBid + bestAsk) / 2, digits);
    $('bookSpread').textContent = 'spread ' + format(bestAsk - bestBid, digits);
    var bidTotal = bids.reduce(function (sum, l) { return sum + l.qty; }, 0);
    var askTotal = asks.reduce(function (sum, l) { return sum + l.qty; }, 0);
    var bidPct = bidTotal + askTotal > 0 ? Math.round(bidTotal / (bidTotal + askTotal) * 100) : 50;
    $('bookBalanceFill').style.width = bidPct + '%';
    $('bookBalanceTrack').setAttribute('aria-label', 'Buy depth ' + bidPct + ' percent, sell depth ' + (100 - bidPct) + ' percent');
    $('bookBalanceText').textContent = bidPct + ' / ' + (100 - bidPct);
  }

  function drawOrderbook() {
    if (bookSub) { window.RailflowDatafeed.unsubscribeOrderBook(bookSub); bookSub = null; }
    var symbol = state.market;
    lastBook = null;
    bookSub = window.RailflowDatafeed.subscribeOrderBook(symbol, function (book) {
      if (symbol !== state.market) return;
      lastBook = book;
      renderOrderBook(book);
    });
  }

  var account;
  var nextId = 10;
  var toastTimer;

  function resetAccount() {
    // Starts with no positions or orders — those only appear once you place
    // a demo trade through the order form. Claim demo USDC via the faucet
    // dialog before trading.
    account = { cash: 0, positions: [], orders: [], orderHistory: [], fills: [], fundingHistory: [], realizedPnl: [], claimed: false };
  }

  function pnl(position) { return (markets[position.market].price - position.entry) * position.quantity * (position.side === 'long' ? 1 : -1); }
  function equity() { return account.cash + account.positions.reduce(function (sum, p) { return sum + pnl(p); }, 0); }
  function usedMargin() { return account.positions.concat(account.orders).reduce(function (sum, p) { return sum + p.margin; }, 0); }
  function available() { return Math.max(0, equity() - usedMargin()); }
  function parseAmount(value) {
    var raw = value.trim();
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,8})?$/.test(raw)) return NaN;
    return Number(raw.replace(/,/g, ''));
  }
  function signedMoney(value) { return (value >= 0 ? '+' : '−') + money(Math.abs(value)); }
  // Isolated: this position's own reserved margin is its only backstop, so
  // its liquidation price is fixed at entry regardless of the rest of the
  // account (real isolated-margin behavior).
  function estimatedLiq(price, side, leverage) { return price * (1 + (side === 'long' ? -1 : 1) * (.891 / leverage)); }
  function maintMargin(position) { return position.margin * MAINT_MARGIN_RATIO; }
  // Cross: every cross position shares the account's cash and every other
  // cross position's live P&L as its margin backstop, so its liquidation
  // price moves as the rest of the account moves. Solves for the price of
  // this one position (others' mark prices held constant) at which total
  // cross equity drops to total cross maintenance margin. `excludeId` keeps
  // an existing position from being double-counted in the "other cross
  // positions" sums it also belongs to.
  function crossLiquidationPrice(entry, side, quantity, margin, excludeId) {
    var others = account.positions.filter(function (p) { return p.marginMode === 'cross' && p.id !== excludeId; });
    var totalMaint = others.reduce(function (sum, p) { return sum + maintMargin(p); }, 0) + margin * MAINT_MARGIN_RATIO;
    var othersPnl = others.reduce(function (sum, p) { return sum + pnl(p); }, 0);
    var budget = account.cash + othersPnl - totalMaint;
    var sign = side === 'long' ? 1 : -1;
    return Math.max(0, entry - sign * budget / quantity);
  }
  // Binance settles funding every 8h, on the hour, at 00:00/08:00/16:00 UTC.
  // Rather than fabricate a running funding number, a position only accrues
  // funding when a real settlement boundary is actually crossed while it's
  // open, using whatever the live funding rate is at that moment — so most
  // demo sessions (shorter than 8h) genuinely show $0.00, which is correct,
  // not a placeholder.
  function fundingEpoch(ts) { return Math.floor(ts / (8 * 60 * 60 * 1000)); }
  function applyFundingIfDue(position) {
    var currentEpoch = fundingEpoch(Date.now());
    if (currentEpoch <= position.lastFundingEpoch) return;
    var epochsElapsed = currentEpoch - position.lastFundingEpoch;
    var market = markets[position.market];
    var notional = position.quantity * market.price;
    var rate = market.funding / 100;
    var sign = position.side === 'long' ? -1 : 1; // longs pay shorts when funding is positive
    var payment = notional * rate * sign * epochsElapsed;
    position.fundingPaid += payment;
    account.cash += payment;
    account.fundingHistory.unshift({ market: position.market, side: position.side, rate: market.funding, payment: payment, time: new Date().toLocaleTimeString('en-GB', { hour12: false }) });
    position.lastFundingEpoch = currentEpoch;
  }
  function feeRate(price) {
    var market = markets[state.market];
    var takesLiquidity = state.type === 'limit' && (state.side === 'long' ? price >= market.price + market.step : price <= market.price - market.step);
    return state.type !== 'limit' || takesLiquidity ? .00025 : 0;
  }
  function notify(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimer = setTimeout(function () { $('toast').hidden = true; }, 4200);
  }
  function error(message, input) {
    $('orderError').textContent = message;
    $('orderError').hidden = !message;
    ['orderPrice', 'orderSize'].forEach(function (id) { $(id).removeAttribute('aria-invalid'); });
    if (input) { $(input).setAttribute('aria-invalid', 'true'); $(input).focus(); }
  }

  function updateSummary() {
    var size = parseAmount($('orderSize').value);
    var price = state.type === 'market' ? markets[state.market].price : parseAmount($('orderPrice').value);
    var validSize = Number.isFinite(size) && size > 0;
    var validPrice = Number.isFinite(price) && price > 0;
    $('headerEquity').textContent = money(equity());
    $('availableBalance').textContent = money(available());
    $('requiredMargin').textContent = validSize ? money(size / state.leverage) : '—';
    var liqReady = state.marginMode === 'isolated' ? validPrice : (validPrice && validSize);
    $('liquidationPrice').textContent = liqReady
      ? format(state.marginMode === 'isolated'
        ? estimatedLiq(price, state.side, state.leverage)
        : crossLiquidationPrice(price, state.side, size / price, size / state.leverage))
      : '—';
    $('estimatedFee').textContent = feeRate(price) === 0 ? '0.000%' : '0.025%';
    $('marginModeNote').textContent = state.marginMode === 'isolated'
      ? 'Isolated: only this position\'s own reserved margin backs it. Its liquidation price is fixed at entry and losses can\'t exceed the margin you allocate to it.'
      : 'Cross: shared margin backs every cross position, so a position\'s liquidation price moves with your whole account.';
    $('leverageValue').textContent = state.leverage + 'x';
    $('leverage').style.setProperty('--range-progress', ((state.leverage - 1) / (markets[state.market].maxLev - 1) * 100) + '%');
    $('leverage').setAttribute('aria-valuetext', state.leverage + ' times');
    $('submitOrder').textContent = 'Demo · ' + (state.side === 'long' ? 'Buy / Long ' : 'Sell / Short ') + state.market + '-PERP';
    $('submitOrder').classList.toggle('is-short', state.side === 'short');
    $('marginUsage').textContent = format(equity() > 0 ? usedMargin() / equity() * 100 : 0, 1) + '%';
    $('maintenanceMargin').textContent = money(account.positions.reduce(function (sum, p) { return sum + maintMargin(p); }, 0));
    $('positionCount').textContent = account.positions.length;
    $('orderCount').textContent = account.orders.length;
    $('claimBanner').hidden = account.claimed;
  }

  function sideLabel(side) { return '<span class="side-badge is-' + side + '">' + side + '</span>'; }
  function table(headers, rows, emptyText) {
    return '<table class="activity-table"><thead><tr>' + headers.map(function (head, index) { return '<th' + (index > 0 ? ' class="ta-r"' : '') + '>' + head + '</th>'; }).join('') + '</tr></thead><tbody>' + (rows || '<tr><td class="empty-state" colspan="' + headers.length + '">' + emptyText + '</td></tr>') + '</tbody></table>';
  }
  function moneyCell(value, allowZeroColor) {
    if (!allowZeroColor && value === 0) return '<td class="mono ta-r">' + money(0) + '</td>';
    return '<td class="mono ta-r ' + (value >= 0 ? 'up' : 'down') + '">' + signedMoney(value) + '</td>';
  }

  function drawActivity() {
    var rows;
    // Funding accrues in real time regardless of which tab is on screen, so
    // it must run on every render, not just while the Positions tab is open.
    account.positions.forEach(applyFundingIfDue);
    if (state.activity === 'positions') {
      rows = account.positions.map(function (p) {
        var isolated = p.marginMode === 'isolated';
        // Isolated risk is capped at the position's own reserved margin;
        // cross P&L flows straight from mark price since the whole account
        // backs it.
        var profit = isolated ? Math.max(pnl(p), -p.margin) : pnl(p);
        var liq = isolated ? p.liquidation : crossLiquidationPrice(p.entry, p.side, p.quantity, p.margin, p.id);
        var mark = markets[p.market].price;
        return '<tr><td><span class="position-pair">' + sideLabel(p.side) + '<span>' + p.market + '-PERP</span><small class="mono">' + p.leverage + 'x · ' + (isolated ? 'Isolated' : 'Cross') + '</small></span></td>'
          + '<td class="mono ta-r">' + format(p.quantity, p.quantity < 1 ? 3 : 1) + ' ' + p.market + '</td>'
          + '<td class="mono ta-r">' + format(mark) + '</td>'
          + '<td class="mono ta-r">' + money(p.quantity * mark) + '</td>'
          + '<td class="mono ta-r">' + format(p.entry) + '</td>'
          + '<td class="mono ta-r liq-value">' + format(liq) + '</td>'
          + '<td class="mono ta-r">' + money(p.margin) + '</td>'
          + moneyCell(p.fundingPaid)
          + moneyCell(profit, true)
          + moneyCell(0)
          + '<td><button type="button" class="small-button" data-close="' + p.id + '" aria-label="Close ' + p.market + ' ' + p.side + ' position">Close</button></td></tr>';
      }).join('');
      $('activityPanel').innerHTML = table(['Instrument', 'Quantity', 'Mark', 'Value', 'Entry Price', 'Liq. Price', 'Margin', 'Funding', 'UPNL', 'RPNL', '<span class="sr-only">Actions</span>'], rows, 'No open positions. Place a market order to start trading.');
    } else if (state.activity === 'orders') {
      rows = account.orders.map(function (o) {
        return '<tr><td><span class="position-pair">' + sideLabel(o.side) + o.market + '-PERP</span></td><td class="mono ta-r">' + (o.type === 'stop' ? 'Stop market' : 'Limit') + '</td><td class="mono ta-r">' + format(o.price) + '</td><td class="mono ta-r">' + money(o.size) + '</td><td class="mono ta-r">' + o.leverage + 'x · ' + (o.marginMode === 'isolated' ? 'Isolated' : 'Cross') + '</td><td><button type="button" class="small-button" data-cancel="' + o.id + '" aria-label="Cancel ' + o.market + ' order">Cancel</button></td></tr>';
      }).join('');
      $('activityPanel').innerHTML = table(['Instrument', 'Type', 'Price / trigger', 'Size', 'Leverage', '<span class="sr-only">Actions</span>'], rows, 'No open orders. Limit and stop orders will appear here.');
    } else if (state.activity === 'trades') {
      rows = account.fills.map(function (f) {
        return '<tr><td>' + f.market + '-PERP</td><td>' + sideLabel(f.side) + '</td><td class="mono ta-r">' + format(f.price) + '</td><td class="mono ta-r">' + money(f.size) + '</td><td class="mono ta-r">' + money(f.fee) + '</td><td class="mono ta-r">' + f.time + '</td></tr>';
      }).join('');
      $('activityPanel').innerHTML = table(['Instrument', 'Side', 'Price', 'Size', 'Fee', 'Time'], rows, 'No trades in this session. Executed orders will appear here.');
    } else if (state.activity === 'orderHistory') {
      rows = account.orderHistory.map(function (o) {
        return '<tr><td><span class="position-pair">' + sideLabel(o.side) + o.market + '-PERP</span></td><td class="mono ta-r">' + (o.type === 'stop' ? 'Stop market' : 'Limit') + '</td><td class="mono ta-r">' + format(o.price) + '</td><td class="mono ta-r">' + money(o.size) + '</td><td class="mono ta-r">' + o.status + '</td><td class="mono ta-r">' + o.time + '</td></tr>';
      }).join('');
      $('activityPanel').innerHTML = table(['Instrument', 'Type', 'Price / trigger', 'Size', 'Status', 'Time'], rows, 'No order history yet. Cancelled and filled orders will appear here.');
    } else if (state.activity === 'funding') {
      rows = account.fundingHistory.map(function (f) {
        return '<tr><td>' + f.market + '-PERP</td><td class="mono ta-r">' + (f.rate >= 0 ? '+' : '') + format(f.rate, 4) + '%</td>' + moneyCell(f.payment, true) + '<td class="mono ta-r">' + f.time + '</td></tr>';
      }).join('');
      $('activityPanel').innerHTML = table(['Instrument', 'Rate', 'Payment', 'Time'], rows, 'No funding payments yet. Funding settles every 8h using Binance\'s real live rate — a position only shows a payment once it stays open across an actual settlement.');
    } else {
      rows = account.realizedPnl.map(function (r) {
        return '<tr><td><span class="position-pair">' + sideLabel(r.side) + r.market + '-PERP</span></td><td class="mono ta-r">' + format(r.quantity, r.quantity < 1 ? 3 : 1) + ' ' + r.market + '</td><td class="mono ta-r">' + format(r.entry) + '</td><td class="mono ta-r">' + format(r.exit) + '</td>' + moneyCell(r.pnl, true) + '<td class="mono ta-r">' + r.time + '</td></tr>';
      }).join('');
      $('activityPanel').innerHTML = table(['Instrument', 'Quantity', 'Entry Price', 'Exit Price', 'RPNL', 'Time'], rows, 'No realized PNL yet. Closing a position will log it here.');
    }
  }

  function setActivity(name, focus) {
    state.activity = name;
    document.querySelectorAll('[data-activity]').forEach(function (button) {
      var active = button.dataset.activity === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus();
    });
    $('activityPanel').setAttribute('aria-labelledby', 'tab-' + name);
    drawActivity();
  }

  function setOrderType(type) {
    state.type = type;
    document.querySelectorAll('[data-order-type]').forEach(function (button) {
      var active = button.dataset.orderType === type;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('priceField').hidden = type === 'market';
    $('marketPriceNote').hidden = type !== 'market';
    $('priceLabel').textContent = type === 'stop' ? 'Trigger price' : 'Price';
    // Re-entering Limit/Stop should resume tracking the live market price
    // unless the user types their own value again.
    if (type !== 'market') { $('orderPrice').value = format(markets[state.market].price); state.priceDirty = false; }
    error('');
    updateSummary();
  }

  // Keeps the Limit/Stop price field tracking the live market price until
  // the user actually types their own value into it (state.priceDirty,
  // set by the input listener below) — so it never sits on a stale seed
  // price, but also never fights someone mid-edit.
  function syncOrderPriceLive(symbol, price) {
    if (symbol !== state.market || state.type === 'market' || state.priceDirty) return;
    $('orderPrice').value = format(price);
  }

  function renderMarketStrip(symbol) {
    var market = markets[symbol];
    $('markPrice').textContent = format(market.price);
    $('marketChange').textContent = (market.change >= 0 ? '+' : '') + format(market.change) + '%';
    $('marketChange').className = 'mono ' + (market.change >= 0 ? 'up' : 'down');
    $('oraclePrice').textContent = format(market.oracle);
    $('marketFunding').textContent = (market.funding >= 0 ? '+' : '') + format(market.funding, 4) + '%';
    $('marketFunding').className = 'mono ' + (market.funding >= 0 ? 'up' : 'down');
    $('marketInterest').textContent = market.interest;
    $('marketVolume').textContent = market.volume;
    $('bookMark').textContent = format(market.price);
    document.querySelectorAll('#marketMenu [data-market]').forEach(function (button) {
      var priceEl = button.querySelector('.mono');
      if (priceEl) priceEl.textContent = format(markets[button.dataset.market].price);
    });
  }

  // Tracks every tradable market (not just the one currently on screen) so
  // a position's Mark/UPNL stays accurate even while you're viewing a
  // different market's chart — started once, for the whole session.
  function startMarketTracking() {
    if (tickerSub) { window.RailflowDatafeed.unsubscribeMarkets(tickerSub); tickerSub = null; }
    tickerSub = window.RailflowDatafeed.subscribeMarkets(Object.keys(markets), function (symbol, ticker) {
      if (!markets[symbol]) return;
      // The WebSocket path can deliver price/change before open interest's
      // separate REST poll resolves; only overwrite fields that arrived.
      if (ticker.price !== undefined) markets[symbol].price = ticker.price;
      if (ticker.oraclePrice !== undefined) markets[symbol].oracle = ticker.oraclePrice;
      if (ticker.changePercent !== undefined) markets[symbol].change = ticker.changePercent;
      if (ticker.fundingRate !== undefined) markets[symbol].funding = ticker.fundingRate;
      if (ticker.openInterestUsd !== undefined) markets[symbol].interest = formatCompactUsd(ticker.openInterestUsd);
      if (ticker.volumeUsd !== undefined) markets[symbol].volume = formatCompactUsd(ticker.volumeUsd);
      if (symbol === state.market) { renderMarketStrip(symbol); syncOrderPriceLive(symbol, markets[symbol].price); updateSummary(); }
      drawActivity(); // keeps Positions' Mark/UPNL live for every open market, not just the selected one
    });
  }

  function selectMarket(symbol) {
    state.market = symbol;
    var market = markets[symbol];
    document.title = symbol + '-PERP · Railflow';
    $('marketSymbol').innerHTML = symbol + '-PERP <span class="chevron" aria-hidden="true">▾</span>';
    $('marketName').textContent = market.name + ' perpetual';
    $('marketMaxLev').textContent = market.maxLev + 'x';
    $('marketLogo').src = window.RailflowTokenIcons.logoUrl(symbol);
    $('marketLogo').alt = symbol;
    $('orderPrice').value = format(market.price);
    state.priceDirty = false;
    $('leverage').max = market.maxLev;
    state.leverage = Math.min(state.leverage, market.maxLev);
    $('leverage').value = state.leverage;
    $('bookPrecision').innerHTML = [1, 2, 10].map(function (multiple) { var step = market.step * multiple; return '<option value="' + step + '">' + step + '</option>'; }).join('');
    $('marketMenu').innerHTML = Object.keys(markets).map(function (key) { return '<button type="button" data-market="' + key + '" aria-pressed="' + (key === symbol) + '"><span class="market-menu-item"><img class="tick" src="' + window.RailflowTokenIcons.logoUrl(key) + '" alt="" width="20" height="20" loading="lazy"><span>' + key + '-PERP</span></span><span class="mono">' + format(markets[key].price) + '</span></button>'; }).join('');
    renderMarketStrip(symbol);
    error('');
    drawChart();
    drawOrderbook();
    updateSummary();
  }

  function dialog(title, content) {
    $('dialogTitle').textContent = title;
    $('dialogContent').innerHTML = content;
    $('infoDialog').showModal();
  }
  function toggleMenu(buttonId, menuId, open) {
    var isOpen = open === undefined ? $(menuId).hidden : open;
    $(menuId).hidden = !isOpen;
    $(buttonId).setAttribute('aria-expanded', String(isOpen));
  }
  function recordFill(market, side, price, size, fee) {
    account.fills.unshift({ market: market, side: side, price: price, size: size, fee: fee, time: new Date().toLocaleTimeString('en-GB', { hour12: false }) });
  }

  $('orderForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var size = parseAmount($('orderSize').value);
    var price = state.type === 'market' ? markets[state.market].price : parseAmount($('orderPrice').value);
    if (!Number.isFinite(size) || size < 10) return error('Enter a size of at least 10 USDC.', 'orderSize');
    if (!Number.isFinite(price) || price <= 0) return error('Enter a valid price greater than zero.', 'orderPrice');
    var mark = markets[state.market].price;
    if (state.type === 'stop' && (state.side === 'long' ? price <= mark : price >= mark)) return error('Set the trigger ' + (state.side === 'long' ? 'above' : 'below') + ' the current market price.', 'orderPrice');
    var marketable = state.type === 'market' || (state.type === 'limit' && (state.side === 'long' ? price >= mark + markets[state.market].step : price <= mark - markets[state.market].step));
    var fee = marketable || state.type === 'stop' ? size * .00025 : 0;
    var margin = size / state.leverage;
    if (margin + fee > available() + .000001) return error('Insufficient available margin. Reduce size or adjust leverage.', 'orderSize');
    error('');
    if (marketable) {
      account.cash -= fee;
      account.positions.push({ id: nextId++, market: state.market, side: state.side, leverage: state.leverage, quantity: size / mark, entry: mark, liquidation: estimatedLiq(mark, state.side, state.leverage), margin: margin, marginMode: state.marginMode, fundingPaid: 0, lastFundingEpoch: fundingEpoch(Date.now()) });
      recordFill(state.market, state.side, mark, size, fee);
      setActivity('positions');
      notify(state.market + ' ' + state.side + ' position opened · ' + money(size) + ' simulated (' + (state.marginMode === 'isolated' ? 'isolated' : 'cross') + ' margin).');
    } else {
      account.orders.push({ id: nextId++, market: state.market, side: state.side, type: state.type, price: price, size: size, leverage: state.leverage, margin: margin + fee, marginMode: state.marginMode });
      setActivity('orders');
      notify(state.type === 'stop' ? 'Demo stop order placed. Cancel it in Open orders.' : 'Demo limit order placed. Margin reserved.');
    }
    updateSummary();
  });

  $('activityPanel').addEventListener('click', function (event) {
    var close = event.target.closest('[data-close]');
    var cancel = event.target.closest('[data-cancel]');
    if (close) {
      var position = account.positions.find(function (p) { return p.id === Number(close.dataset.close); });
      if (!position) return;
      applyFundingIfDue(position); // settle any pending funding before realizing P&L
      var exitPrice = markets[position.market].price;
      var size = position.quantity * exitPrice;
      var fee = size * .00025;
      var profit = position.marginMode === 'isolated' ? Math.max(pnl(position), -position.margin) : pnl(position);
      account.cash += profit - fee;
      recordFill(position.market, position.side === 'long' ? 'short' : 'long', exitPrice, size, fee);
      account.realizedPnl.unshift({ market: position.market, side: position.side, quantity: position.quantity, entry: position.entry, exit: exitPrice, pnl: profit, time: new Date().toLocaleTimeString('en-GB', { hour12: false }) });
      account.positions = account.positions.filter(function (p) { return p.id !== position.id; });
      notify(position.market + ' demo position closed. Margin released.');
    } else if (cancel) {
      var order = account.orders.find(function (o) { return o.id === Number(cancel.dataset.cancel); });
      if (order) account.orderHistory.unshift({ market: order.market, side: order.side, type: order.type, price: order.price, size: order.size, status: 'Cancelled', time: new Date().toLocaleTimeString('en-GB', { hour12: false }) });
      account.orders = account.orders.filter(function (o) { return o.id !== Number(cancel.dataset.cancel); });
      notify('Demo order cancelled. Reserved margin released.');
    } else return;
    drawActivity();
    updateSummary();
  });

  document.querySelectorAll('[data-side]').forEach(function (button) {
    button.addEventListener('click', function () {
      state.side = button.dataset.side;
      document.querySelectorAll('[data-side]').forEach(function (option) { var active = option === button; option.classList.toggle('is-active', active); option.setAttribute('aria-pressed', String(active)); });
      error('');
      updateSummary();
    });
  });
  document.querySelectorAll('[data-order-type]').forEach(function (button) { button.addEventListener('click', function () { setOrderType(button.dataset.orderType); }); });
  document.querySelectorAll('[data-margin-mode]').forEach(function (button) {
    button.addEventListener('click', function () {
      state.marginMode = button.dataset.marginMode;
      document.querySelectorAll('[data-margin-mode]').forEach(function (option) { var active = option === button; option.classList.toggle('is-active', active); option.setAttribute('aria-pressed', String(active)); });
      updateSummary();
    });
  });
  document.querySelectorAll('[data-timeframe]').forEach(function (button) {
    button.addEventListener('click', function () {
      state.timeframe = button.dataset.timeframe;
      document.querySelectorAll('[data-timeframe]').forEach(function (option) { var active = option === button; option.classList.toggle('is-active', active); option.setAttribute('aria-pressed', String(active)); });
      drawChart();
    });
  });
  document.querySelectorAll('[data-activity]').forEach(function (button, index, buttons) {
    button.addEventListener('click', function () { setActivity(button.dataset.activity); });
    button.addEventListener('keydown', function (event) {
      var next;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next !== undefined) { event.preventDefault(); setActivity(buttons[next].dataset.activity, true); }
    });
  });
  document.querySelectorAll('[data-size-percent]').forEach(function (button) {
    button.addEventListener('click', function () {
      var price = state.type === 'market' ? markets[state.market].price : parseAmount($('orderPrice').value);
      var rate = feeRate(price);
      var size = available() / (1 / state.leverage + rate) * Number(button.dataset.sizePercent) / 100;
      $('orderSize').value = format(Math.floor(size * 100) / 100);
      document.querySelectorAll('[data-size-percent]').forEach(function (option) { option.classList.toggle('is-active', option === button); });
      error('');
      updateSummary();
    });
  });
  ['orderPrice', 'orderSize'].forEach(function (id) {
    $(id).addEventListener('input', function () { if (id === 'orderPrice') state.priceDirty = true; error(''); updateSummary(); });
    $(id).addEventListener('blur', function () { var amount = parseAmount($(id).value); if (Number.isFinite(amount) && amount > 0) $(id).value = format(amount); updateSummary(); });
  });
  $('leverage').addEventListener('input', function () { state.leverage = Number(this.value); error(''); updateSummary(); });
  $('useMid').addEventListener('click', function () { $('orderPrice').value = format(markets[state.market].price); state.priceDirty = false; error(''); updateSummary(); });
  $('bookPrecision').addEventListener('change', function () { if (lastBook) renderOrderBook(lastBook); });
  ['bookAsks', 'bookBids'].forEach(function (id) {
    $(id).addEventListener('click', function (event) { var button = event.target.closest('[data-book-price]'); if (button) { setOrderType('limit'); $('orderPrice').value = format(Number(button.dataset.bookPrice)); updateSummary(); } });
  });
  $('marketPicker').addEventListener('click', function () { toggleMenu('marketPicker', 'marketMenu'); toggleMenu('chartTypeButton', 'chartTypeMenu', false); });
  $('marketMenu').addEventListener('click', function (event) { var button = event.target.closest('[data-market]'); if (button) { selectMarket(button.dataset.market); toggleMenu('marketPicker', 'marketMenu', false); $('marketPicker').focus(); } });
  $('chartTypeButton').addEventListener('click', function () { toggleMenu('chartTypeButton', 'chartTypeMenu'); toggleMenu('marketPicker', 'marketMenu', false); });
  $('chartTypeMenu').addEventListener('click', function (event) {
    var button = event.target.closest('[data-chart-type]');
    if (!button) return;
    applyChartType(button.dataset.chartType);
    chart.timeScale().fitContent();
    toggleMenu('chartTypeButton', 'chartTypeMenu', false);
    $('chartTypeButton').focus();
  });
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.market-picker-wrap')) toggleMenu('marketPicker', 'marketMenu', false);
    if (!event.target.closest('.chart-type-picker')) toggleMenu('chartTypeButton', 'chartTypeMenu', false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !$('marketMenu').hidden) { toggleMenu('marketPicker', 'marketMenu', false); $('marketPicker').focus(); }
    if (event.key === 'Escape' && !$('chartTypeMenu').hidden) { toggleMenu('chartTypeButton', 'chartTypeMenu', false); $('chartTypeButton').focus(); }
  });
  $('portfolioLink').addEventListener('click', function () { setActivity('positions', true); $('portfolio').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' }); });
  $('vaultsLink').addEventListener('click', function () { dialog('Vaults', '<p>Vaults are not available in this trading demo. You can explore trading with the simulated funds in your margin account.</p><button type="button" class="place-order" data-dialog-dismiss>Back to trading</button>'); });
  $('accountDetails').addEventListener('click', function () { dialog('Demo account', '<p>These positions and balances belong to a simulated trading account, separate from your connected wallet. Demo balances reset when you reload the page.</p><dl class="trade-summary"><div><dt>Demo equity</dt><dd class="mono">' + money(equity()) + '</dd></div><div><dt>Demo available margin</dt><dd class="mono">' + money(available()) + '</dd></div><div><dt>Demo open positions</dt><dd class="mono">' + account.positions.length + '</dd></div></dl>'); });
  $('faucetLink').addEventListener('click', function () { dialog('USDC test funds', '<p>To fund your actual wallet, open Circle Faucet, select Arc Testnet, and enter your wallet address.</p><a class="btn btn--primary wallet-faucet-link" href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer">Open Circle Faucet</a><div class="wallet-menu-divider"></div><p>For the trading demo, add 10,000 simulated USDC once per session. This does not send tokens to your wallet.</p><button type="button" class="place-order" id="claimFunds"' + (account.claimed ? ' disabled' : '') + '>' + (account.claimed ? 'Demo funds already added' : 'Add 10,000 demo USDC') + '</button>'); });
  function claimDemoFunds() {
    if (account.claimed) return;
    account.cash += 10000;
    account.claimed = true;
    updateSummary();
    notify('10,000 simulated USDC added to your margin account.');
  }
  $('dialogContent').addEventListener('click', function (event) {
    if (event.target.closest('[data-dialog-dismiss]')) $('infoDialog').close();
    if (event.target.id === 'claimFunds' && !account.claimed) { claimDemoFunds(); $('infoDialog').close(); }
  });
  $('claimInline').addEventListener('click', claimDemoFunds);
  $('closeDialog').addEventListener('click', function () { $('infoDialog').close(); });
  $('infoDialog').addEventListener('click', function (event) { if (event.target === this) { var rect = this.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.close(); } });
  $('resetDemo').addEventListener('click', function () {
    resetAccount();
    state.leverage = 10;
    state.marginMode = 'cross';
    $('leverage').value = 10;
    $('orderSize').value = '5,000';
    document.querySelectorAll('[data-margin-mode]').forEach(function (option) { var active = option.dataset.marginMode === 'cross'; option.classList.toggle('is-active', active); option.setAttribute('aria-pressed', String(active)); });
    selectMarket('BTC');
    setActivity('positions');
    notify('Demo account reset.');
  });

  initChartTypeMenu();
  resetAccount();
  selectMarket('BTC');
  drawActivity();
  startMarketTracking();

  window.addEventListener('pagehide', function () {
    if (chartSub) { window.RailflowDatafeed.unsubscribeBars(chartSub); chartSub = null; }
    if (bookSub) { window.RailflowDatafeed.unsubscribeOrderBook(bookSub); bookSub = null; }
    if (tickerSub) { window.RailflowDatafeed.unsubscribeMarkets(tickerSub); tickerSub = null; }
  });
  // A page the browser restores from the back/forward cache (clicking Back
  // after visiting index.html, for example) doesn't re-run this script —
  // the WebSockets above were already closed by pagehide, so the chart,
  // order book, and Positions' live Mark/UPNL would otherwise sit frozen.
  // Re-running the same setup calls is safe: each tears down whatever
  // subscription it already holds before creating a new one.
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    drawChart();
    drawOrderbook();
    startMarketTracking();
  });
})();
