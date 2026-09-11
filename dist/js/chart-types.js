(function () {
  'use strict';

  // Chart-style picker definitions (icons + labels), matching the layout
  // of TradingView's own chart-type menu (grouped: bar-style, line-style,
  // area-style, block-style, then Heikin Ashi on its own). The actual
  // rendering for each style is wired in js/trade.js, which maps each id
  // to a Lightweight Charts series type + a data transform.

  var ICONS = {
    bars: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M6 3v14M6 6h3M6 12H3M14 5v10M14 7h3M14 13h-3"/></svg>',
    candles: '<svg viewBox="0 0 20 20"><path d="M6 2v4M6 14v4M14 3v3M14 12v5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><rect x="4" y="6" width="4" height="8" rx="1" fill="currentColor"/><rect x="12" y="6" width="4" height="6" rx="1" fill="currentColor"/></svg>',
    hollow: '<svg viewBox="0 0 20 20"><path d="M6 2v4M6 14v4M14 3v3M14 12v5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><rect x="4" y="6" width="4" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="12" y="6" width="4" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    line: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14l4-5 3 3 7-8"/></svg>',
    'line-markers': '<svg viewBox="0 0 20 20"><path d="M3 14l4-5 3 3 7-8" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="3" cy="14" r="1.3" fill="currentColor"/><circle cx="7" cy="9" r="1.3" fill="currentColor"/><circle cx="10" cy="12" r="1.3" fill="currentColor"/><circle cx="17" cy="4" r="1.3" fill="currentColor"/></svg>',
    step: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h4v-4h4v-3h4v-4h2"/></svg>',
    area: '<svg viewBox="0 0 20 20"><path d="M3 14l4-5 3 3 7-8v13H3z" fill="currentColor" opacity=".35"/><path d="M3 14l4-5 3 3 7-8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'hlc-area': '<svg viewBox="0 0 20 20"><path d="M3 11l4-4 3 2 7-6v10l-7 3-3-2-4 3z" fill="currentColor" opacity=".28"/><path d="M3 6l4 4 3-2 7 5" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>',
    baseline: '<svg viewBox="0 0 20 20"><line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2" opacity=".6"/><path d="M3 12l4 3 3-4 7 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 8l4-3 3 2 7-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    columns: '<svg viewBox="0 0 20 20"><rect x="3" y="10" width="3" height="7" fill="currentColor"/><rect x="8.5" y="5" width="3" height="12" fill="currentColor"/><rect x="14" y="8" width="3" height="9" fill="currentColor"/></svg>',
    highlow: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M6 3v14M6 8H4M6 12h2M14 5v10M14 8h2M14 12h-2"/></svg>',
    'heikin-ashi': '<svg viewBox="0 0 20 20"><path d="M6 2v4M6 14v4M14 3v3M14 12v5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><rect x="4" y="6" width="4" height="8" rx="2" fill="currentColor"/><rect x="12" y="6" width="4" height="6" rx="2" fill="currentColor"/></svg>'
  };

  var TYPES = [
    { id: 'bars', label: 'Bars' },
    { id: 'candles', label: 'Candles' },
    { id: 'hollow', label: 'Hollow candles' },
    { id: 'line', label: 'Line', newGroup: true },
    { id: 'line-markers', label: 'Line with markers' },
    { id: 'step', label: 'Step line' },
    { id: 'area', label: 'Area', newGroup: true },
    { id: 'hlc-area', label: 'HLC area' },
    { id: 'baseline', label: 'Baseline' },
    { id: 'columns', label: 'Columns', newGroup: true },
    { id: 'highlow', label: 'High-low' },
    { id: 'heikin-ashi', label: 'Heikin Ashi', newGroup: true }
  ];

  function labelFor(id) {
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].id === id) return TYPES[i].label;
    return id;
  }

  window.RailflowChartTypes = { list: TYPES, icons: ICONS, label: labelFor };
})();
