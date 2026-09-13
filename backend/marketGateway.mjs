import { WebSocket, WebSocketServer } from 'ws';

const SYMBOLS = { BTC: 'btcusdt', ETH: 'ethusdt', SOL: 'solusdt' };
const PAIRS = Object.fromEntries(Object.entries(SYMBOLS).map(([symbol, pair]) => [pair, symbol]));
const BINANCE_STREAM = 'wss://fstream.binance.com/stream?streams=';
const BINANCE_REST = 'https://fapi.binance.com/fapi/v1';
const STALE_AFTER_MS = 3000;

function emptyMarket(symbol) {
  return { symbol, mark: null, oracle: null, funding: null, change: null, volume: null, bids: [], asks: [], candle: null, updatedAt: 0 };
}

export class MarketDataGateway {
  constructor() {
    this.clients = new Set();
    this.markets = Object.fromEntries(Object.keys(SYMBOLS).map((symbol) => [symbol, emptyMarket(symbol)]));
    this.socket = null;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.lastMessageAt = 0;
    this.status = 'reconnecting';
    this.statusTimer = setInterval(() => this.broadcastStatus(), 1000);
    this.restTimer = setInterval(() => this.pollReferenceData(), 2000);
    this.pollReferenceData();
  }

  streamUrl() {
    const streams = Object.values(SYMBOLS).flatMap((pair) => [
      `${pair}@markPrice@1s`,
      `${pair}@ticker`,
      `${pair}@depth20@100ms`,
      `${pair}@kline_1m`,
    ]);
    return BINANCE_STREAM + streams.join('/');
  }

  attach(server) {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on('connection', (client) => this.addClient(client));
    server.on('upgrade', (request, socket, head) => {
      if (new URL(request.url, 'http://localhost').pathname !== '/ws/markets') return;
      this.wss.handleUpgrade(request, socket, head, (client) => this.wss.emit('connection', client, request));
    });
    this.connectBinance();
  }

  addClient(client) {
    this.clients.add(client);
    client.send(JSON.stringify({ type: 'snapshot', status: this.currentStatus(), markets: this.markets }));
    client.on('close', () => this.clients.delete(client));
    client.on('error', () => this.clients.delete(client));
  }

  connectBinance() {
    clearTimeout(this.reconnectTimer);
    this.status = 'reconnecting';
    let socket;
    try { socket = new WebSocket(this.streamUrl()); } catch (error) { return this.scheduleReconnect(); }
    this.socket = socket;
    socket.on('open', () => {
      this.reconnectAttempt = 0;
      this.status = 'live';
      this.broadcastStatus();
    });
    socket.on('message', (raw) => this.handleBinanceMessage(raw));
    socket.on('error', () => this.handleBinanceClose());
    socket.on('close', () => this.handleBinanceClose());
  }

  handleBinanceClose() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.close();
    this.socket = null;
    this.status = 'reconnecting';
    this.broadcastStatus();
    this.scheduleReconnect();
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(30000, 1000 * (2 ** this.reconnectAttempt++));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectBinance();
    }, delay);
  }

  handleBinanceMessage(raw) {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    const data = message?.data;
    const streamPair = message?.stream?.split('@')[0];
    const rawPair = data?.s || data?.k?.s || streamPair;
    if (!rawPair) return;
    const symbol = PAIRS[rawPair.toLowerCase()];
    if (!symbol) return;
    const market = this.markets[symbol];
    const eventTime = Number(data.E || data.T || Date.now());
    // Depth updates arrive much more frequently than mark price, ticker and
    // kline events. Do not compare their timestamps across event types or a
    // newer depth packet would incorrectly discard the slower streams.
    market.updatedAt = Math.max(market.updatedAt, eventTime);
    this.lastMessageAt = Date.now();
    if (data.e === 'markPriceUpdate') {
      market.mark = Number(data.p);
      market.oracle = Number(data.i);
      market.funding = Number(data.r) * 100;
    } else if (data.e === '24hrTicker') {
      market.change = Number(data.P);
      market.volume = Number(data.q);
    } else if (data.e === 'depthUpdate') {
      market.bids = data.b?.map(([price, quantity]) => ({ price: Number(price), quantity: Number(quantity) })) || [];
      market.asks = data.a?.map(([price, quantity]) => ({ price: Number(price), quantity: Number(quantity) })) || [];
    } else if (data.e === 'kline') {
      const k = data.k;
      market.candle = { time: Math.floor(k.t / 1000), open: Number(k.o), high: Number(k.h), low: Number(k.l), close: Number(k.c), volume: Number(k.v) };
    }
    this.status = 'live';
    this.broadcast({ type: 'market', status: this.currentStatus(), symbol, market });
  }

  async pollReferenceData() {
    const results = await Promise.allSettled(Object.entries(SYMBOLS).map(async ([symbol, pair]) => {
      const [premiumResponse, tickerResponse] = await Promise.all([
        fetch(BINANCE_REST + '/premiumIndex?symbol=' + pair.toUpperCase()),
        fetch(BINANCE_REST + '/ticker/24hr?symbol=' + pair.toUpperCase()),
      ]);
      if (!premiumResponse.ok || !tickerResponse.ok) throw new Error('reference data request failed');
      const premium = await premiumResponse.json();
      const ticker = await tickerResponse.json();
      const market = this.markets[symbol];
      market.mark = Number(premium.markPrice);
      market.oracle = Number(premium.indexPrice);
      market.funding = Number(premium.lastFundingRate) * 100;
      market.change = Number(ticker.priceChangePercent);
      market.volume = Number(ticker.quoteVolume);
      market.updatedAt = Date.now();
      this.lastMessageAt = Date.now();
      this.status = 'live';
      this.broadcast({ type: 'market', status: this.currentStatus(), symbol, market });
    }));
    if (results.every((result) => result.status === 'rejected') && !this.lastMessageAt) this.status = 'reconnecting';
  }

  currentStatus() {
    if (this.status === 'reconnecting') return 'reconnecting';
    if (!this.lastMessageAt || Date.now() - this.lastMessageAt > STALE_AFTER_MS) return 'delayed';
    return 'live';
  }

  broadcastStatus() {
    this.broadcast({ type: 'status', status: this.currentStatus(), updatedAt: this.lastMessageAt || null });
  }

  broadcast(payload) {
    const encoded = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(encoded);
    }
  }

  snapshot() {
    return { status: this.currentStatus(), updatedAt: this.lastMessageAt || null, markets: this.markets };
  }
}
