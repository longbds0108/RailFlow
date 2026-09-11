(function () {
  'use strict';
  // TradingView's public per-symbol logo CDN — covers every market Railflow
  // lists, including newer/smaller-cap ones (HYPE, SUI, LINK) that older
  // open-source icon sets don't have. No key required.
  // A few symbols use a locally hosted override instead (e.g. a specific
  // brand asset supplied for HYPE) — checked first.
  var OVERRIDES = { HYPE: 'img/hype-logo.jpg' };

  function logoUrl(symbol) {
    var key = String(symbol).toUpperCase();
    if (OVERRIDES[key]) return OVERRIDES[key];
    return 'https://s3-symbol-logo.tradingview.com/crypto/XTVC' + key + '.svg';
  }
  window.RailflowTokenIcons = { logoUrl: logoUrl };
})();
