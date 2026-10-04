/* =========================================================
   BUGS.JS — Error Log System

   Kaam:
   1. JavaScript errors pakadna
   2. Error count dikhana
   3. Bugs panel mein errors dikhana
   4. Errors clear karna
   5. Main.js / UI.js ke liye simple API dena

   HTML IDs:
   bugs-toggle
   bugs-count
   bugs-panel
   bugs-close
   bugs-list
   bugs-clear
   ========================================================= */

(function () {
  "use strict";

  // =========================================================
  // INTERNAL ERROR LIST
  // =========================================================

  var errors = [];

  var MAX_ERRORS = 100;

  // =========================================================
  // ELEMENT SHORTCUT
  // =========================================================

  function getEl(id) {
    return document.getElementById(id);
  }

  // =========================================================
  // TIME
  // =========================================================

  function getTime() {
    var now = new Date();

    return now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  // =========================================================
  // SAFE TEXT
  // HTML injection se bachne ke liye
  // =========================================================

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // =========================================================
  // ADD ERROR
  // =========================================================

  function addError(message, source, extra) {

    var item = {
      id: Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      time: getTime(),
      message: String(message || "Unknown error"),
      source: String(source || "APP"),
      extra: extra ? String(extra) : ""
    };

    errors.push(item);

    // Maximum limit
    if (errors.length > MAX_ERRORS) {
      errors.shift();
    }

    render();
    updateBadge();

    return item;
  }

  // =========================================================
  // LOG
  // =========================================================

  function log(message, source, extra) {
    return addError(message, source, extra);
  }

  // =========================================================
  // ERROR OBJECT KO TEXT MEIN CONVERT KARNA
  // =========================================================

  function normalizeError(error) {

    if (!error) {
      return "Unknown error";
    }

    if (error instanceof Error) {
      return error.message || error.name || "JavaScript Error";
    }

    if (typeof error === "object") {
      try {
        return JSON.stringify(error);
      } catch (e) {
        return "Unknown object error";
      }
    }

    return String(error);
  }

  // =========================================================
  // CATCH ERROR
  // =========================================================

  function capture(error, source, extra) {

    var message = normalizeError(error);

    return addError(
      message,
      source || "APP",
      extra || ""
    );
  }

  // =========================================================
  // COUNT
  // =========================================================

  function count() {
    return errors.length;
  }

  // =========================================================
  // GET ALL
  // =========================================================

  function getAll() {
    return errors.slice();
  }

  // =========================================================
  // CLEAR
  // =========================================================

  function clear() {
    errors = [];

    render();
    updateBadge();
  }

  // =========================================================
  // BADGE UPDATE
  // =========================================================

  function updateBadge() {

    var toggle = getEl("bugs-toggle");
    var badge = getEl("bugs-count");

    if (badge) {
      badge.textContent = String(errors.length);
    }

    if (toggle) {

      if (errors.length > 0) {
        toggle.style.display = "inline-flex";
      } else {
        toggle.style.display = "none";
      }

    }
  }

  // =========================================================
  // RENDER BUG LIST
  // =========================================================

  function render() {

    var list = getEl("bugs-list");

    if (!list) {
      return;
    }

    // No errors
    if (errors.length === 0) {

      list.innerHTML =
        '<div class="empty-hint">✅ Koi error nahi</div>';

      return;
    }

    var html = "";

    // Newest first
    for (var i = errors.length - 1; i >= 0; i--) {

      var item = errors[i];

      html += '<div class="bug-item">';

      html +=
        '<div class="bug-top">' +
          '<span class="bug-source">' +
            escapeHTML(item.source) +
          '</span>' +
          '<span class="bug-time">' +
            escapeHTML(item.time) +
          '</span>' +
        '</div>';

      html +=
        '<div class="bug-message">' +
          '❌ ' +
          escapeHTML(item.message) +
        '</div>';

      if (item.extra) {

        html +=
          '<div class="bug-extra">' +
            escapeHTML(item.extra) +
          '</div>';

      }

      html += '</div>';
    }

    list.innerHTML = html;
  }

  // =========================================================
  // OPEN PANEL
  // =========================================================

  function openPanel() {

    var panel = getEl("bugs-panel");

    if (!panel) {
      return;
    }

    panel.classList.remove("hidden");

    render();
  }

  // =========================================================
  // CLOSE PANEL
  // =========================================================

  function closePanel() {

    var panel = getEl("bugs-panel");

    if (!panel) {
      return;
    }

    panel.classList.add("hidden");
  }

  // =========================================================
  // BUTTON EVENTS
  // =========================================================

  function bindEvents() {

    var toggle = getEl("bugs-toggle");
    var close = getEl("bugs-close");
    var clearBtn = getEl("bugs-clear");

    if (toggle) {

      toggle.addEventListener("click", function () {
        openPanel();
      });

    }

    if (close) {

      close.addEventListener("click", function () {
        closePanel();
      });

    }

    if (clearBtn) {

      clearBtn.addEventListener("click", function () {
        clear();
      });

    }
  }

  // =========================================================
  // GLOBAL JAVASCRIPT ERROR
  // =========================================================

  function installGlobalErrorHandler() {

    window.addEventListener("error", function (event) {

      // Apne logger se dobara error create na ho
      if (!event) {
        return;
      }

      var message =
        event.message ||
        "JavaScript error";

      var source = "JS";

      var extra = "";

      if (event.filename) {
        extra += event.filename;

        if (event.lineno) {
          extra += ":" + event.lineno;
        }

        if (event.colno) {
          extra += ":" + event.colno;
        }
      }

      addError(message, source, extra);
    });

    // Promise / async errors
    window.addEventListener("unhandledrejection", function (event) {

      var reason = event && event.reason;

      addError(
        normalizeError(reason),
        "PROMISE",
        "Unhandled Promise Rejection"
      );

    });
  }

  // =========================================================
  // INIT
  // =========================================================

  function init() {

    bindEvents();

    installGlobalErrorHandler();

    render();

    updateBadge();
  }

  // =========================================================
  // PUBLIC API
  // =========================================================

  window.Bugs = {

    init: init,

    log: log,

    capture: capture,

    add: addError,

    count: count,

    getAll: getAll,

    clear: clear,

    render: render,

    open: openPanel,

    close: closePanel
  };

})();
