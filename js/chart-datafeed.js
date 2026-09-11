(function () {
  'use strict';

  // Real market data for BTC/ETH/SOL/LINK/HYPE/SUI/DOGE from Binance's
  // public USDⓈ-M Futures API — no key required, CORS-open (verified with
  // curl), and it's a perpetuals API (mark price, funding rate, open
  // interest), the right shape for a perp DEX demo rather than a spot feed.
  // Live prices/funding/24h stats come from the combined WebSocket market
  // streams documented at developers.binance.com/en/docs/catalog/
  // core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/market
  // (<symbol>@markPrice + <symbol>@ticker over one connection); open
  // interest has no push stream in that set, so it's polled over REST.
  //
  // getBars/subscribeBars/unsubscribeBars keep the shape TradingView's own
  // tutorials use (see "Implement a Datafeed": tradingview.com/charting-
  // library-docs/latest/tutorials/implement_datafeed_tutorial/).
  // tradingview/charting-library-examples on GitHub is just framework
  // scaffolding for the private Advanced Charting Library — every example
  // there wires `datafeed: new window.Datafeeds.UDFCompatibleDatafeed(url)`
  // against a UDF backend you're assumed to already have (see
  // react-javascript/src/components/TVChartContainer/index.jsx); it ships
  // no real price-fetching code itself and the actual UDF datafeed adapter
  // lives inside the private charting_library repo. Since Railflow has
  // neither that private library nor a UDF backend, this file plays the
  // same role — history + live subscription — directly against Binance.
  // If Railflow later gets Advanced Charting Library access, only this
  // file needs replacing; js/trade.js and js/home-prices.js only call the
  // methods exported at the bottom.
  //
  // Every network call falls back to a deterministic simulated generator,
  // or to REST polling, on failure (offline, rate-limited, blocked) so the
  // demo never breaks.

  var FUTURES_SYMBOL = { BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', LINK: 'LINKUSDT', HYPE: 'HYPEUSDT', SUI: 'SUIUSDT', DOGE: 'DOGEUSDT' };
  var REST_BASE = 'https://fapi.binance.com/fapi/v1';
  var WS_BASE = 'wss://fstream.binance.com/ws';
  var STREAM_BASE = 'wss://fstream.binance.com/stream?streams=';
  var RESOLUTION_SECONDS = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
  var UP_VOLUME = 'rgba(55,211,155,.45)';
  var DOWN_VOLUME = 'rgba(255,92,108,.45)';
  var TICKER_POLL_MS = 10000;
  var OPEN_INTEREST_POLL_MS = 20000;

  // ---- History: GET /fapi/v1/klines ----
  function toCandle(row) {
    return { time: Math.floor(row[0] / 1000), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]) };
  }

  async function fetchKlines(symbol, resolution, barCount) {
    var pair = FUTURES_SYMBOL[symbol];
    if (!pair) throw new Error('No Binance Futures pair for ' + symbol);
    var url = REST_BASE + '/klines?symbol=' + pair + '&interval=' + resolution + '&limit=' + barCount;
    var response = await fetch(url);
    if (!response.ok) throw new Error('klines request failed: ' + response.status);
    var rows = await response.json();
    var candles = rows.map(toCandle);
    var volumes = candles.map(function (c) { return { time: c.time, value: c.volume, color: c.close >= c.open ? UP_VOLUME : DOWN_VOLUME }; });
    return { candles: candles, volumes: volumes };
  }

  // ---- Live bars: <symbol>@kline_<resolution> WebSocket stream ----
  // A network in between (proxy, VPN, restrictive firewall) can let the
  // WebSocket handshake succeed while silently dropping the data frames
  // that follow, so "connected" alone isn't proof the stream is alive.
  // One watchdog timer, re-armed on open and on every message, covers both
  // "never connects" and "connects but goes silent" the same way.
  var STREAM_SILENCE_MS = 4000;

  function openKlineStream(symbol, resolution, onCandle, onFail) {
    var pair = FUTURES_SYMBOL[symbol];
    if (!pair || typeof WebSocket === 'undefined') { onFail(); return null; }
    var socket;
    try {
      socket = new WebSocket(WS_BASE + '/' + pair.toLowerCase() + '@kline_' + resolution);
    } catch (err) {
      onFail();
      return null;
    }
    var settled = false;
    var watchdog;
    function fail() {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      onFail();
      try { socket.close(); } catch (err) {}
    }
    function armWatchdog() {
      clearTimeout(watchdog);
      watchdog = setTimeout(fail, STREAM_SILENCE_MS);
    }
    armWatchdog();
    socket.onopen = armWatchdog;
    socket.onmessage = function (event) {
      if (settled) return;
      armWatchdog();
      var payload;
      try { payload = JSON.parse(event.data); } catch (err) { return; }
      var k = payload && payload.k;
      if (!k) return;
      onCandle({ time: Math.floor(k.t / 1000), open: Number(k.o), high: Number(k.h), low: Number(k.l), close: Number(k.c), volume: Number(k.v) });
    };
    socket.onerror = fail;
    socket.onclose = fail;
    return socket;
  }

  // ---- Order book: GET /fapi/v1/depth + <symbol>@depth<levels>@100ms WebSocket ----
  // bids/asks come back pre-sorted by Binance: bids highest price first,
  // asks lowest price first (best price first on both sides).
  var BOOK_LEVELS = 20;

  function toLevels(rows) {
    return rows.map(function (row) { return { price: Number(row[0]), qty: Number(row[1]) }; });
  }

  async function fetchOrderBook(symbol) {
    var pair = FUTURES_SYMBOL[symbol];
    if (!pair) throw new Error('No Binance Futures pair for ' + symbol);
    var response = await fetch(REST_BASE + '/depth?symbol=' + pair + '&limit=' + BOOK_LEVELS);
    if (!response.ok) throw new Error('depth request failed: ' + response.status);
    var data = await response.json();
    return { bids: toLevels(data.bids), asks: toLevels(data.asks) };
  }

  var bookSubs = {};
  var bookNextId = 1;

  function subscribeOrderBook(symbol, onUpdate) {
    var id = 'book' + bookNextId++;
    var record = { closed: false };
    bookSubs[id] = record;

    function pollFallback() {
      function tick() {
        fetchOrderBook(symbol).then(function (book) { if (!record.closed) onUpdate(book); }).catch(function (err) {
          console.warn('[chart-datafeed] Binance order book unavailable for ' + symbol + ':', err.message);
        });
      }
      tick();
      record.timer = setInterval(tick, 2000);
    }

    var pair = FUTURES_SYMBOL[symbol];
    if (!pair || typeof WebSocket === 'undefined') { pollFallback(); return id; }

    var socket;
    try { socket = new WebSocket(WS_BASE + '/' + pair.toLowerCase() + '@depth' + BOOK_LEVELS + '@100ms'); } catch (err) { pollFallback(); return id; }

    var settled = false;
    var watchdog;
    function fail() {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      try { socket.close(); } catch (err) {}
      if (!record.closed) pollFallback();
    }
    function armWatchdog() { clearTimeout(watchdog); watchdog = setTimeout(fail, STREAM_SILENCE_MS); }
    armWatchdog();
    socket.onopen = armWatchdog;
    socket.onmessage = function (event) {
      if (settled) return;
      armWatchdog();
      var payload;
      try { payload = JSON.parse(event.data); } catch (err) { return; }
      if (!payload || !payload.b || !payload.a) return;
      onUpdate({ bids: toLevels(payload.b), asks: toLevels(payload.a) });
    };
    socket.onerror = fail;
    socket.onclose = fail;
    record.socket = socket;
    return id;
  }

  function unsubscribeOrderBook(id) {
    var record = bookSubs[id];
    if (!record) return;
    record.closed = true;
    if (record.timer) clearInterval(record.timer);
    if (record.socket) { try { record.socket.close(); } catch (err) {} }
    delete bookSubs[id];
  }

  // ---- Market-strip numbers: mark price, funding rate, open interest, 24h stats ----
  async function fetchTicker(symbol) {
    var pair = FUTURES_SYMBOL[symbol];
    if (!pair) throw new Error('No Binance Futures pair for ' + symbol);
    var responses = await Promise.all([
      fetch(REST_BASE + '/premiumIndex?symbol=' + pair),
      fetch(REST_BASE + '/openInterest?symbol=' + pair),
      fetch(REST_BASE + '/ticker/24hr?symbol=' + pair)
    ]);
    responses.forEach(function (r) { if (!r.ok) throw new Error('ticker request failed: ' + r.status); });
    var premium = await responses[0].json();
    var openInterest = await responses[1].json();
    var stats = await responses[2].json();
    var markPrice = Number(premium.markPrice);
    // Binance's lastFundingRate is the real rate for its 8h settlement
    // period, as a fraction (e.g. 0.00005434 = 0.005434%); *100 converts it
    // to the percentage this UI displays. Shown as-is — no /8 "hourly"
    // approximation, since that would just be a fabricated number wearing
    // a real one's clothes. The UI is labelled "Funding 8h" to match.
    var funding = Number(premium.lastFundingRate) * 100;
    return {
      price: markPrice,
      oraclePrice: Number(premium.indexPrice),
      fundingRate: funding,
      openInterestUsd: Number(openInterest.openInterest) * markPrice,
      changePercent: Number(stats.priceChangePercent),
      volumeUsd: Number(stats.quoteVolume)
    };
  }

  async function fetchOpenInterestUsd(symbol) {
    var pair = FUTURES_SYMBOL[symbol];
    var responses = await Promise.all([fetch(REST_BASE + '/openInterest?symbol=' + pair), fetch(REST_BASE + '/ticker/price?symbol=' + pair)]);
    responses.forEach(function (r) { if (!r.ok) throw new Error('openInterest request failed: ' + r.status); });
    var oi = await responses[0].json();
    var priceRow = await responses[1].json();
    return Number(oi.openInterest) * Number(priceRow.price);
  }

  var marketSubs = {};
  var marketNextId = 1;

  // REST-polling fallback used both when WebSocket is unavailable up front
  // and when the combined stream connects but then falls silent.
  function pollMarkets(record, symbols, onUpdate) {
    function tick() {
      symbols.forEach(function (symbol) {
        fetchTicker(symbol).then(function (t) { if (!record.closed) onUpdate(symbol, t); }).catch(function (err) {
          console.warn('[chart-datafeed] Binance ticker unavailable for ' + symbol + ':', err.message);
        });
      });
    }
    tick();
    record.timer = setInterval(tick, TICKER_POLL_MS);
  }

  // symbols: array of our market codes (e.g. ['BTC','ETH']). onUpdate is
  // called as (symbol, {price, oraclePrice, fundingRate, changePercent,
  // volumeUsd, openInterestUsd}) — the same shape getTicker() resolves to,
  // whichever source (WS or REST) produced it.
  function subscribeMarkets(symbols, onUpdate) {
    var id = 'mkt' + marketNextId++;
    var record = { closed: false };
    marketSubs[id] = record;
    var pairs = symbols.map(function (s) { return FUTURES_SYMBOL[s]; }).filter(Boolean);
    var pairToSymbol = {};
    symbols.forEach(function (s) { if (FUTURES_SYMBOL[s]) pairToSymbol[FUTURES_SYMBOL[s]] = s; });

    // A throwing listener must not silently stop future ticks — for this
    // symbol or (since a WS message is handled inline) any other symbol
    // sharing the connection.
    function safeUpdate(symbol, entry) {
      try { onUpdate(symbol, entry); } catch (err) { console.error('[chart-datafeed] subscribeMarkets listener threw for ' + symbol + ':', err); }
    }

    function startOpenInterestPolling() {
      function tick() {
        symbols.forEach(function (symbol) {
          fetchOpenInterestUsd(symbol).then(function (usd) {
            if (record.closed) return;
            var entry = record.latest[symbol] || (record.latest[symbol] = {});
            entry.openInterestUsd = usd;
            if (entry.price !== undefined && entry.changePercent !== undefined) safeUpdate(symbol, entry);
          }).catch(function () {});
        });
      }
      tick();
      record.oiTimer = setInterval(tick, OPEN_INTEREST_POLL_MS);
    }

    if (!pairs.length || typeof WebSocket === 'undefined') { pollMarkets(record, symbols, safeUpdate); return id; }

    var url = STREAM_BASE + pairs.map(function (p) { return p.toLowerCase() + '@markPrice@1s'; }).concat(pairs.map(function (p) { return p.toLowerCase() + '@ticker'; })).join('/');
    var socket;
    try { socket = new WebSocket(url); } catch (err) { pollMarkets(record, symbols, safeUpdate); return id; }

    var settled = false;
    var watchdog;
    record.latest = {};
    function fail() {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      try { socket.close(); } catch (err) {}
      if (!record.closed) pollMarkets(record, symbols, safeUpdate);
    }
    function armWatchdog() { clearTimeout(watchdog); watchdog = setTimeout(fail, STREAM_SILENCE_MS); }
    armWatchdog();
    socket.onopen = armWatchdog;
    socket.onmessage = function (event) {
      if (settled) return;
      armWatchdog();
      var payload;
      try { payload = JSON.parse(event.data); } catch (err) { return; }
      var data = payload && payload.data;
      if (!data || !data.s) return;
      var symbol = pairToSymbol[data.s];
      if (!symbol) return;
      var entry = record.latest[symbol] || (record.latest[symbol] = {});
      if (data.e === 'markPriceUpdate') {
        entry.price = Number(data.p);
        entry.oraclePrice = Number(data.i);
        entry.fundingRate = Number(data.r) * 100; // fraction -> percent, see fetchTicker's comment (real 8h rate, no approximation)
      } else if (data.e === '24hrTicker') {
        entry.changePercent = Number(data.P);
        entry.volumeUsd = Number(data.q);
      }
      if (entry.price !== undefined && entry.changePercent !== undefined) safeUpdate(symbol, entry);
    };
    socket.onerror = fail;
    socket.onclose = fail;
    record.socket = socket;
    startOpenInterestPolling();
    return id;
  }

  function unsubscribeMarkets(id) {
    var record = marketSubs[id];
    if (!record) return;
    record.closed = true;
    if (record.timer) clearInterval(record.timer);
    if (record.oiTimer) clearInterval(record.oiTimer);
    if (record.socket) { try { record.socket.close(); } catch (err) {} }
    delete marketSubs[id];
  }

  // ---- Deterministic simulated fallback (used only if Binance is unreachable) ----
  function seededRandom(seed) {
    var value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return function () {
      value = value * 16807 % 2147483647;
      return (value - 1) / 2147483646;
    };
  }
  function hashSeed(text) {
    var hash = 0;
    for (var i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    return hash || 1;
  }
  function simulateHistory(symbol, resolution, lastPrice, barCount) {
    var stepSeconds = RESOLUTION_SECONDS[resolution] || 900;
    var random = seededRandom(hashSeed(symbol + '|' + resolution));
    var now = Math.floor(Date.now() / 1000);
    var alignedNow = now - (now % stepSeconds);
    var candles = [];
    var volumes = [];
    var price = lastPrice * (1 - (random() - 0.3) * 0.12);
    for (var i = 0; i < barCount; i++) {
      var time = alignedNow - (barCount - 1 - i) * stepSeconds;
      var drift = Math.sin(i * 0.28) * lastPrice * 0.0035;
      var noise = (random() - 0.5) * lastPrice * 0.006;
      var open = price;
      var close = i === barCount - 1 ? lastPrice : open + drift + noise;
      var high = Math.max(open, close) + random() * lastPrice * 0.0025;
      var low = Math.min(open, close) - random() * lastPrice * 0.0025;
      var volume = lastPrice * (0.4 + random() * 1.6);
      candles.push({ time: time, open: open, high: high, low: low, close: close });
      volumes.push({ time: time, value: volume, color: close >= open ? UP_VOLUME : DOWN_VOLUME });
      price = close;
    }
    return { candles: candles, volumes: volumes };
  }

  var liveSubs = {};
  var liveNextId = 1;

  function simulateLive(id, symbol, resolution, lastCandle, lastVolume, onTick) {
    var stepSeconds = RESOLUTION_SECONDS[resolution] || 900;
    var random = seededRandom(hashSeed(symbol + '|' + resolution + '|' + id));
    var candle = Object.assign({}, lastCandle);
    var volume = lastVolume ? lastVolume.value : candle.close * 0.6;
    liveSubs[id].timer = setInterval(function () {
      var now = Math.floor(Date.now() / 1000);
      var barTime = now - (now % stepSeconds);
      var move = candle.close * (random() - 0.5) * 0.0018;
      var close = candle.close + move;
      if (barTime > candle.time) {
        candle = { time: barTime, open: candle.close, high: Math.max(candle.close, close), low: Math.min(candle.close, close), close: close };
        volume = candle.close * (0.4 + random() * 1.6);
      } else {
        candle = { time: candle.time, open: candle.open, high: Math.max(candle.high, close), low: Math.min(candle.low, close), close: close };
        volume += candle.close * random() * 0.15;
      }
      onTick(candle, { time: candle.time, value: volume, color: candle.close >= candle.open ? UP_VOLUME : DOWN_VOLUME });
    }, 1800);
  }

  // ---- Public API used by js/trade.js ----
  async function getBars(symbol, resolution, lastPrice, barCount) {
    var count = barCount || 150;
    try {
      return await fetchKlines(symbol, resolution, count);
    } catch (err) {
      console.warn('[chart-datafeed] Binance history unavailable, using simulated data:', err.message);
      return simulateHistory(symbol, resolution, lastPrice, count);
    }
  }

  function subscribeBars(symbol, resolution, lastCandle, lastVolume, onTick) {
    var id = 'sub' + liveNextId++;
    liveSubs[id] = { closed: false };
    var wrappedTick = function (candle) {
      if (liveSubs[id] && !liveSubs[id].closed) onTick(candle, { time: candle.time, value: candle.volume || 0, color: candle.close >= candle.open ? UP_VOLUME : DOWN_VOLUME });
    };
    var socket = openKlineStream(symbol, resolution, wrappedTick, function () {
      if (liveSubs[id] && !liveSubs[id].closed && !liveSubs[id].timer) simulateLive(id, symbol, resolution, lastCandle, lastVolume, onTick);
    });
    if (liveSubs[id]) liveSubs[id].socket = socket;
    return id;
  }

  function unsubscribeBars(id) {
    var record = liveSubs[id];
    if (!record) return;
    record.closed = true;
    if (record.timer) clearInterval(record.timer);
    if (record.socket) { try { record.socket.close(); } catch (err) {} }
    delete liveSubs[id];
  }

  window.RailflowDatafeed = {
    getBars: getBars,
    subscribeBars: subscribeBars,
    unsubscribeBars: unsubscribeBars,
    getTicker: fetchTicker,
    subscribeMarkets: subscribeMarkets,
    unsubscribeMarkets: unsubscribeMarkets,
    getOrderBook: fetchOrderBook,
    subscribeOrderBook: subscribeOrderBook,
    unsubscribeOrderBook: unsubscribeOrderBook
  };
})();
