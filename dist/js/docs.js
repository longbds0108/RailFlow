(function () {
  'use strict';
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-section]'));
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-doc]'));
  var previous = document.getElementById('docsPrevious');
  var next = document.getElementById('docsNext');
  var progress = document.getElementById('docsProgress');
  var active = 0;

  function show(index, updateHash) {
    active = Math.max(0, Math.min(sections.length - 1, index));
    sections.forEach(function (section, i) { section.classList.toggle('is-active', i === active); });
    buttons.forEach(function (button, i) { button.classList.toggle('is-active', i === active); if (i === active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
    previous.disabled = active === 0;
    next.disabled = active === sections.length - 1;
    progress.textContent = String(active + 1).padStart(2, '0') + ' / ' + String(sections.length).padStart(2, '0');
    if (updateHash) history.replaceState(null, '', '#' + sections[active].dataset.section);
    sections[active].focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  buttons.forEach(function (button, i) { button.addEventListener('click', function () { show(i, true); }); });
  previous.addEventListener('click', function () { show(active - 1, true); });
  next.addEventListener('click', function () { show(active + 1, true); });
  var requested = location.hash.slice(1);
  var requestedIndex = sections.findIndex(function (section) { return section.dataset.section === requested; });
  show(requestedIndex >= 0 ? requestedIndex : 0, false);
})();
