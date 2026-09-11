(function () {
  'use strict';

  var markets = {
    BTC: { name: 'Bitcoin', price: 112480.50, oracle: 112479.80, change: 2.14, funding: 0.0041, interest: '$38.2M', volume: '$214.6M', maxLev: 50, step: 0.5 },
    ETH: { name: 'Ethereum', price: 4182.30, oracle: 4182.12, change: 1.08, funding: 0.0026, interest: '$21.7M', volume: '$98.2M', maxLev: 50, step: 0.05 },
    SOL: { name: 'Solana', price: 214.86, oracle: 214.84, change: -0.92, funding: -0.0013, interest: '$12.4M', volume: '$46.8M', maxLev: 25, step: 0.01 }
  };
  var state = { market: 'BTC', timeframe: '15m', side: 'long', type: 'limit', activity: 'positions', leverage: 10 };
  var $ = function (id) { return document.getElementById(id); };
  var format = function (value, digits) { return Number(value).toLocaleString('en-US', { minimumFractionDigits: digits === undefined ? 2 : digits, maximumFractionDigits: digits === undefined ? 2 : digits }); };
  var money = function (value) { return '$' + format(value); };

  function drawChart() {
    var price = markets[state.market].price;
    var frame = ['1m', '5m', '15m', '1h', '4h', '1d'].indexOf(state.timeframe);
    var candles = [];
    var chart = '<line x1="20" x2="980" y1="116" y2="116" stroke="#243640" stroke-dasharray="3 3"/><line x1="20" x2="980" y1="222" y2="222" stroke="#1c2b35" stroke-dasharray="3 3"/>';
    var previous = 231;
    for (var i = 0; i < 44; i++) {
      var x = 27 + i * 22;
      var close = 232 - i * 2.77 + Math.sin(i * .49 + frame * .3) * 7 + Math.sin(i * 1.3) * 2.4;
      var open = previous;
      var high = Math.min(open, close) - 8 - (i % 5) * 2.2;
      var low = Math.max(open, close) + 7 + (i % 4) * 3.5;
      var color = close <= open ? '#32cc9a' : '#ff6678';
      chart += '<g><line x1="' + x + '" y1="' + high + '" x2="' + x + '" y2="' + low + '" stroke="' + color + '" stroke-opacity=".56" stroke-width="1.2"/><rect x="' + (x - 7.5) + '" y="' + Math.min(open, close) + '" width="15" height="' + Math.max(2.6, Math.abs(open - close)) + '" rx=".7" fill="' + color + '"/></g>';
      candles.push({ o: price * (1 + (116 - open) / 18000), h: price * (1 + (116 - high) / 18000), l: price * (1 + (116 - low) / 18000), c: price * (1 + (116 - close) / 18000) });
      previous = close;
    }
    $('priceChart').innerHTML = chart;
    $('priceChart').setAttribute('aria-label', 'Simulated ' + state.market + ' perpetual ' + state.timeframe + ' candlestick chart');
    $('chartOhlc').innerHTML = '<span>O <b>' + format(price * .99754, 1) + '</b></span><span>H <b>' + format(price * 1.001867, 1) + '</b></span><span>L <b>' + format(price * .995568, 1) + '</b></span><span>C <b class="up">' + format(price, 1) + '</b></span>';
    $('chartCanvas').onpointermove = function (event) {
      var rect = $('chartCanvas').getBoundingClientRect();
      var candle = candles[Math.min(43, Math.max(0, Math.round(((event.clientX - rect.left) / rect.width * 1000 - 27) / 22)))];
      $('chartTooltip').textContent = 'O ' + format(candle.o) + '  H ' + format(candle.h) + '  L ' + format(candle.l) + '  C ' + format(candle.c);
      $('chartTooltip').hidden = false;
    };
    $('chartCanvas').onpointerleave = function () { $('chartTooltip').hidden = true; };
  }

  function drawOrderbook() {
    var market = markets[state.market];
    var step = Number($('bookPrecision').value);
    var askSizes = [4.812, 2.140, 3.026, 1.408, .962, 2.204, 1.118];
    var bidSizes = [1.884, 3.407, .960, 2.612, 1.340, 4.028, 1.712];
    var askOffsets = [11, 10, 8, 6, 4, 2, 1];
    var bidOffsets = [1, 3, 5, 8, 11, 14, 17];
    function rows(sizes, isAsk) {
      var total = 0;
      return sizes.map(function (size, i) {
        total += size;
        var level = market.price + (isAsk ? askOffsets[i] : -bidOffsets[i]) * step;
        var depth = [59, 44, 65, 28, 34, 53, 40][i];
        return '<button type="button" class="book-row ' + (isAsk ? 'ask' : 'bid') + '" style="--depth:' + depth + '%" data-book-price="' + level.toFixed(2) + '" aria-label="Use price ' + format(level) + '"><span>' + format(level, state.market === 'BTC' ? 1 : 2) + '</span><span>' + format(size, 3) + '</span><span>' + format(total) + '</span></button>';
      }).join('');
    }
    $('bookAsks').innerHTML = rows(askSizes, true);
    $('bookBids').innerHTML = rows(bidSizes, false);
    $('bookMark').textContent = format(market.price);
    $('bookSpread').textContent = 'spread ' + format(step * 2, state.market === 'BTC' ? 1 : 2);
  }

  var account;
  var nextId = 10;
  var toastTimer;

  function resetAccount() {
    // These opening balances reproduce the supplied demo account snapshot.
    account = {
      cash: 10258.227,
      positions: [
        { id: 1, market: 'BTC', side: 'long', leverage: 10, quantity: .482, entry: 109204, liquidation: 101980.4, margin: 1456.02 },
        { id: 2, market: 'SOL', side: 'short', leverage: 5, quantity: 128, entry: 219.4, liquidation: 251.8, margin: 770 }
      ],
      orders: [{ id: 3, market: 'BTC', side: 'long', type: 'limit', price: 110000, size: 500, leverage: 10, margin: 50 }],
      fills: [],
      claimed: false
    };
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
  function estimatedLiq(price, side, leverage) { return price * (1 + (side === 'long' ? -1 : 1) * (.891 / leverage)); }
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
    $('liquidationPrice').textContent = validPrice ? format(estimatedLiq(price, state.side, state.leverage)) : '—';
    $('estimatedFee').textContent = feeRate(price) === 0 ? '0.000%' : '0.025%';
    $('leverageValue').textContent = state.leverage + 'x';
    $('leverage').style.setProperty('--range-progress', ((state.leverage - 1) / (markets[state.market].maxLev - 1) * 100) + '%');
    $('leverage').setAttribute('aria-valuetext', state.leverage + ' times');
    $('submitOrder').textContent = (state.side === 'long' ? 'Buy / Long ' : 'Sell / Short ') + state.market + '-PERP';
    $('submitOrder').classList.toggle('is-short', state.side === 'short');
    $('marginUsage').textContent = format(equity() > 0 ? usedMargin() / equity() * 100 : 0, 1) + '%';
    $('maintenanceMargin').textContent = money(account.positions.reduce(function (sum, p) { return sum + p.margin / 2; }, 0));
    $('positionCount').textContent = account.positions.length;
    $('orderCount').textContent = account.orders.length;
  }

  function sideLabel(side) { return '<span class="side-badge is-' + side + '">' + side + '</span>'; }
  function table(headers, rows, emptyText) {
    return '<table class="activity-table"><thead><tr>' + headers.map(function (head, index) { return '<th' + (index > 0 ? ' class="ta-r"' : '') + '>' + head + '</th>'; }).join('') + '</tr></thead><tbody>' + (rows || '<tr><td class="empty-state" colspan="' + headers.length + '">' + emptyText + '</td></tr>') + '</tbody></table>';
  }
  function drawActivity() {
    var rows;
    if (state.activity === 'positions') {
      rows = account.positions.map(function (p) {
        var profit = pnl(p);
        return '<tr><td><span class="position-pair">' + sideLabel(p.side) + '<span>' + p.market + '-PERP</span><small class="mono">' + p.leverage + 'x</small></span></td><td class="mono ta-r">' + format(p.quantity, p.quantity < 1 ? 3 : 1) + ' ' + p.market + '</td><td class="mono ta-r">' + format(p.entry) + '</td><td class="mono ta-r">' + format(markets[p.market].price) + '</td><td class="mono ta-r liq-value">' + format(p.liquidation) + '</td><td class="mono ta-r ' + (profit >= 0 ? 'up' : 'down') + '">' + signedMoney(profit) + '</td><td><button type="button" class="small-button" data-close="' + p.id + '" aria-label="Close ' + p.market + ' ' + p.side + ' position">Close</button></td></tr>';
      }).join('');
      $('activityPanel').innerHTML = table(['Position', 'Size', 'Entry', 'Mark', 'Liq.', 'UPNL', '<span class="sr-only">Actions</span>'], rows, 'No open positions. Place a market order to start trading.');
    } else if (state.activity === 'orders') {
      rows = account.orders.map(function (o) {
        return '<tr><td><span class="position-pair">' + sideLabel(o.side) + o.market + '-PERP</span></td><td class="mono ta-r">' + (o.type === 'stop' ? 'Stop market' : 'Limit') + '</td><td class="mono ta-r">' + format(o.price) + '</td><td class="mono ta-r">' + money(o.size) + '</td><td class="mono ta-r">' + o.leverage + 'x</td><td><button type="button" class="small-button" data-cancel="' + o.id + '" aria-label="Cancel ' + o.market + ' order">Cancel</button></td></tr>';
      }).join('');
      $('activityPanel').innerHTML = table(['Order', 'Type', 'Price / trigger', 'Size', 'Leverage', '<span class="sr-only">Actions</span>'], rows, 'No open orders. Limit and stop orders will appear here.');
    } else if (state.activity === 'fills') {
      rows = account.fills.map(function (f) {
        return '<tr><td>' + f.market + '-PERP</td><td>' + sideLabel(f.side) + '</td><td class="mono ta-r">' + format(f.price) + '</td><td class="mono ta-r">' + money(f.size) + '</td><td class="mono ta-r">' + money(f.fee) + '</td><td class="mono ta-r">' + f.time + '</td></tr>';
      }).join('');
      $('activityPanel').innerHTML = table(['Market', 'Side', 'Price', 'Size', 'Fee', 'Time'], rows, 'No fills in this session. Executed trades will appear here.');
    } else {
      $('activityPanel').innerHTML = table(['Market', 'Rate', 'Payment', 'Time'], '', 'No funding payments in this demo session. Funding rates above are sample data.');
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
    error('');
    updateSummary();
  }

  function selectMarket(symbol) {
    state.market = symbol;
    var market = markets[symbol];
    document.title = symbol + '-PERP · Railflow';
    $('marketSymbol').innerHTML = symbol + '-PERP <span class="chevron" aria-hidden="true">▾</span>';
    $('marketName').textContent = market.name + ' perpetual';
    $('marketMaxLev').textContent = market.maxLev + 'x';
    $('markPrice').textContent = format(market.price);
    $('marketChange').textContent = (market.change >= 0 ? '+' : '') + format(market.change) + '%';
    $('marketChange').className = 'mono ' + (market.change >= 0 ? 'up' : 'down');
    $('oraclePrice').textContent = format(market.oracle);
    $('marketFunding').textContent = (market.funding >= 0 ? '+' : '') + format(market.funding, 4) + '%';
    $('marketFunding').className = 'mono ' + (market.funding >= 0 ? 'up' : 'down');
    $('marketInterest').textContent = market.interest;
    $('marketVolume').textContent = market.volume;
    $('orderPrice').value = format(market.price);
    $('leverage').max = market.maxLev;
    state.leverage = Math.min(state.leverage, market.maxLev);
    $('leverage').value = state.leverage;
    $('bookPrecision').innerHTML = [1, 2, 10].map(function (multiple) { var step = market.step * multiple; return '<option value="' + step + '">' + step + '</option>'; }).join('');
    $('marketMenu').innerHTML = Object.keys(markets).map(function (key) { return '<button type="button" data-market="' + key + '" aria-pressed="' + (key === symbol) + '"><span>' + key + '-PERP</span><span class="mono">' + format(markets[key].price) + '</span></button>'; }).join('');
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
      account.positions.push({ id: nextId++, market: state.market, side: state.side, leverage: state.leverage, quantity: size / mark, entry: mark, liquidation: estimatedLiq(mark, state.side, state.leverage), margin: margin });
      recordFill(state.market, state.side, mark, size, fee);
      setActivity('positions');
      notify(state.market + ' ' + state.side + ' position opened · ' + money(size) + ' simulated.');
    } else {
      account.orders.push({ id: nextId++, market: state.market, side: state.side, type: state.type, price: price, size: size, leverage: state.leverage, margin: margin + fee });
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
      var size = position.quantity * markets[position.market].price;
      var fee = size * .00025;
      account.cash += pnl(position) - fee;
      recordFill(position.market, position.side === 'long' ? 'short' : 'long', markets[position.market].price, size, fee);
      account.positions = account.positions.filter(function (p) { return p.id !== position.id; });
      notify(position.market + ' demo position closed. Margin released.');
    } else if (cancel) {
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
    $(id).addEventListener('input', function () { error(''); updateSummary(); });
    $(id).addEventListener('blur', function () { var amount = parseAmount($(id).value); if (Number.isFinite(amount) && amount > 0) $(id).value = format(amount); updateSummary(); });
  });
  $('leverage').addEventListener('input', function () { state.leverage = Number(this.value); error(''); updateSummary(); });
  $('useMid').addEventListener('click', function () { $('orderPrice').value = format(markets[state.market].price); error(''); updateSummary(); });
  $('bookPrecision').addEventListener('change', drawOrderbook);
  ['bookAsks', 'bookBids'].forEach(function (id) {
    $(id).addEventListener('click', function (event) { var button = event.target.closest('[data-book-price]'); if (button) { setOrderType('limit'); $('orderPrice').value = format(Number(button.dataset.bookPrice)); updateSummary(); } });
  });
  $('marketPicker').addEventListener('click', function () { toggleMenu('marketPicker', 'marketMenu'); toggleMenu('walletButton', 'walletMenu', false); });
  $('marketMenu').addEventListener('click', function (event) { var button = event.target.closest('[data-market]'); if (button) { selectMarket(button.dataset.market); toggleMenu('marketPicker', 'marketMenu', false); $('marketPicker').focus(); } });
  $('walletButton').addEventListener('click', function () { toggleMenu('walletButton', 'walletMenu'); toggleMenu('marketPicker', 'marketMenu', false); });
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.wallet-wrap')) toggleMenu('walletButton', 'walletMenu', false);
    if (!event.target.closest('.market-picker-wrap')) toggleMenu('marketPicker', 'marketMenu', false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (!$('walletMenu').hidden) { toggleMenu('walletButton', 'walletMenu', false); $('walletButton').focus(); }
      if (!$('marketMenu').hidden) { toggleMenu('marketPicker', 'marketMenu', false); $('marketPicker').focus(); }
    }
  });
  $('portfolioLink').addEventListener('click', function () { setActivity('positions', true); $('portfolio').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' }); });
  $('vaultsLink').addEventListener('click', function () { dialog('Vaults', '<p>Vaults are not available in this trading demo. You can explore trading with the simulated funds in your margin account.</p><button type="button" class="place-order" data-dialog-dismiss>Back to trading</button>'); });
  $('accountDetails').addEventListener('click', function () { dialog('Demo account', '<p>This preview uses a simulated wallet and sample market data. No blockchain account is connected. Balances reset when you reload the page.</p><dl class="trade-summary"><div><dt>Equity</dt><dd class="mono">' + money(equity()) + '</dd></div><div><dt>Available margin</dt><dd class="mono">' + money(available()) + '</dd></div><div><dt>Open positions</dt><dd class="mono">' + account.positions.length + '</dd></div></dl>'); });
  $('faucetLink').addEventListener('click', function () { dialog('Testnet faucet', '<p>Add 10,000 simulated USDC to this demo account. Available once per session.</p><button type="button" class="place-order" id="claimFunds"' + (account.claimed ? ' disabled' : '') + '>' + (account.claimed ? 'Already claimed this session' : 'Claim 10,000 test USDC') + '</button>'); });
  $('dialogContent').addEventListener('click', function (event) {
    if (event.target.closest('[data-dialog-dismiss]')) $('infoDialog').close();
    if (event.target.id === 'claimFunds' && !account.claimed) { account.cash += 10000; account.claimed = true; updateSummary(); $('infoDialog').close(); notify('10,000 simulated USDC added to your margin account.'); }
  });
  $('closeDialog').addEventListener('click', function () { $('infoDialog').close(); });
  $('infoDialog').addEventListener('click', function (event) { if (event.target === this) { var rect = this.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.close(); } });
  $('resetDemo').addEventListener('click', function () { resetAccount(); state.leverage = 10; $('leverage').value = 10; $('orderSize').value = '5,000'; selectMarket('BTC'); setActivity('positions'); toggleMenu('walletButton', 'walletMenu', false); notify('Demo account reset.'); });

  resetAccount();
  selectMarket('BTC');
  drawActivity();
})();
