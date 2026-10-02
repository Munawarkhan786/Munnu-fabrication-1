/* =========================================================
   BUGS — Error logger + viewer
   Global error catch + localStorage save
   ========================================================= */

(function() {
  "use strict";

  var BUGS_KEY = "sheetMarking_bugs_v1";
  var MAX_BUGS = 50;

  /* ---------- LOG ERROR ---------- */

  function log(source, message, stack) {

    var bug = {
      time: new Date().toISOString(),
      source: String(source || "unknown"),
      message: String(message || "Unknown error"),
      stack: String(stack || "")
    };

    try {
      var bugs = JSON.parse(localStorage.getItem(BUGS_KEY) || "[]");
      bugs.unshift(bug);
      if (bugs.length > MAX_BUGS) bugs = bugs.slice(0, MAX_BUGS);
      localStorage.setItem(BUGS_KEY, JSON.stringify(bugs));
    } catch (e) {}

    console.warn("🐛 BUG:", source, message);

    updateBadge();
  }

  /* ---------- GET ALL ---------- */

  function getAll() {
    try {
      return JSON.parse(localStorage.getItem(BUGS_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  /* ---------- COUNT ---------- */

  function count() {
    return getAll().length;
  }

  /* ---------- CLEAR ---------- */

  function clear() {
    try {
      localStorage.removeItem(BUGS_KEY);
    } catch (e) {}
    updateBadge();
    render();
  }

  /* ---------- BADGE ---------- */

  function updateBadge() {
    var badge = document.getElementById("bugs-count");
    if (!badge) return;
    var c = count();
    badge.textContent = c;
    badge.style.display = c > 0 ? "inline-block" : "none";
  }

  /* ---------- RENDER ---------- */

  function render() {
    var container = document.getElementById("bugs-list");
    if (!container) return;

    var bugs = getAll();

    if (!bugs.length) {
      container.innerHTML =
        '<div class="empty-hint">✅ Koi error nahi</div>';
      return;
    }

    container.innerHTML = bugs.map(function(bug, i) {

      var time = new Date(bug.time);
      var timeStr = time.toLocaleString();

      return (
        '<div class="result-box" ' +
          'style="border-left-color:#dc2626;">' +
          '<div class="corner-title">🐛 #' + (i + 1) + '</div>' +
          '<div class="result-row">' +
            '<span class="label">Time</span>' +
            '<span class="value">' + timeStr + '</span>' +
          '</div>' +
          '<div class="result-row">' +
            '<span class="label">Source</span>' +
            '<span class="value red">' + bug.source + '</span>' +
          '</div>' +
          '<div class="result-row">' +
            '<span class="label">Message</span>' +
            '<span class="value">' + bug.message + '</span>' +
          '</div>' +
          '<details style="margin-top:8px;">' +
            '<summary style="color:#888;font-size:11px;' +
              'cursor:pointer;">📋 Stack</summary>' +
            '<pre style="background:#0a0d14;padding:8px;' +
              'border-radius:6px;font-size:9px;color:#aaa;' +
              'overflow-x:auto;margin-top:6px;' +
              'white-space:pre-wrap;">' +
              bug.stack +
            '</pre>' +
          '</details>' +
        '</div>'
      );
    }).join("");
  }

  /* ---------- GLOBAL ERROR CATCHER ---------- */

  window.addEventListener("error", function(event) {
    log(
      event.filename || "unknown",
      event.message,
      event.error ? event.error.stack : ""
    );
  });

  window.addEventListener("unhandledrejection", function(event) {
    log(
      "promise",
      event.reason ? String(event.reason) : "Unhandled",
      event.reason && event.reason.stack ? event.reason.stack : ""
    );
  });

  /* ---------- INIT ---------- */

  function init() {
    updateBadge();
    render();
  }

  /* ---------- EXPOSE ---------- */

  window.Bugs = {
    log: log,
    getAll: getAll,
    count: count,
    clear: clear,
    render: render,
    init: init
  };

})();
