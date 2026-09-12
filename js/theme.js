(function () {
  'use strict';

  var STORAGE_KEY = 'railflow-theme';
  var root = document.documentElement;

  function readTheme() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch (error) {
      // Fall back to the system preference when storage is unavailable.
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#F4F7F8' : '#06080b');
    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      var nextLabel = theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng';
      button.setAttribute('aria-label', nextLabel);
      button.setAttribute('title', nextLabel);
      button.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    });
    if (persist) {
      try { window.localStorage.setItem(STORAGE_KEY, theme); } catch (error) { /* no-op */ }
    }
  }

  applyTheme(readTheme(), false);

  function init() {
    applyTheme(root.getAttribute('data-theme') || readTheme(), false);
    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      if (button.dataset.themeBound === 'true') return;
      button.dataset.themeBound = 'true';
      button.addEventListener('click', function () {
        applyTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
