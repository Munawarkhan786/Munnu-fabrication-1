/* =========================================================
   SECURITY — Password + DevTools block + Copy protection
   ========================================================= */

(function() {
  "use strict";

  var APP_PASSWORD = "mk786sheet";

  /* ---------- PASSWORD CHECK ---------- */

  function checkPassword() {
    var input = document.getElementById("password-input");
    if (!input) return false;

    if (input.value === APP_PASSWORD) {
      try {
        sessionStorage.setItem("_ok", "1");
      } catch (e) {}
      hideLoginScreen();
      return true;
    } else {
      var err = document.getElementById("login-error");
      if (err) err.textContent = "❌ Galat password";
      input.value = "";
      return false;
    }
  }

  function showLoginScreen() {
    var ls = document.getElementById("login-screen");
    var ac = document.getElementById("app-content");
    if (ls) ls.style.display = "flex";
    if (ac) ac.style.display = "none";
  }

  function hideLoginScreen() {
    var ls = document.getElementById("login-screen");
    var ac = document.getElementById("app-content");
    if (ls) ls.style.display = "none";
    if (ac) ac.style.display = "block";
  }

  /* ---------- KEYBOARD BLOCK ---------- */

  function blockKeyboard() {
    document.addEventListener("keydown", function(e) {

      var key = e.key || "";
      var code = e.keyCode || 0;

      /* F12 */
      if (key === "F12" || code === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      /* Ctrl+Shift+I / J / C */
      if (e.ctrlKey && e.shiftKey &&
          ["I","i","J","j","C","c"].indexOf(key) !== -1) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      /* Ctrl+U (View Source) */
      if (e.ctrlKey && (key === "U" || key === "u")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      /* Ctrl+S (Save) */
      if (e.ctrlKey && (key === "S" || key === "s")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      /* Ctrl+P (Print) */
      if (e.ctrlKey && (key === "P" || key === "p")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

    }, true);
  }

  /* ---------- RIGHT CLICK BLOCK ---------- */

  function blockRightClick() {
    document.addEventListener("contextmenu", function(e) {
      e.preventDefault();
      return false;
    });
  }

  /* ---------- TEXT SELECTION BLOCK ---------- */

  function blockSelection() {
    document.addEventListener("selectstart", function(e) {
      var target = e.target;
      if (!target) return;

      var tag = target.tagName;

      /* Input/textarea mein selection allow */
      if (tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT") {
        return true;
      }

      e.preventDefault();
      return false;
    });
  }

  /* ---------- CONSOLE BLOCK ---------- */

  function blockConsole() {
    try {
      var noop = function() {};
      console.log = noop;
      console.info = noop;
      console.warn = noop;
      console.debug = noop;
      console.table = noop;
      /* console.error NOT blocked — bugs system needs it */
    } catch (e) {}
  }

  /* ---------- DEVTOOLS DETECT ---------- */

  function detectDevTools() {
    var threshold = 160;
    var wDiff = window.outerWidth - window.innerWidth;
    var hDiff = window.outerHeight - window.innerHeight;

    if (wDiff > threshold || hDiff > threshold) {
      blockUser();
    }
  }

  function blockUser() {
    try {
      sessionStorage.removeItem("_ok");
    } catch (e) {}

    document.body.innerHTML =
      '<div style="background:#0f1419;color:#fbbf24;' +
      'font-family:sans-serif;display:flex;align-items:center;' +
      'justify-content:center;height:100vh;text-align:center;' +
      'padding:20px;">' +
        '<div>' +
          '<h1 style="font-size:24px;margin-bottom:10px;">' +
            '🚫 Access Denied' +
          '</h1>' +
          '<p style="font-size:14px;color:#888;">' +
            'DevTools detected. Reloading...' +
          '</p>' +
        '</div>' +
      '</div>';

    setTimeout(function() {
      window.location.reload();
    }, 2000);
  }

  /* ---------- INIT ---------- */

  function init() {

    /* Session check */
    var ok = null;
    try {
      ok = sessionStorage.getItem("_ok");
    } catch (e) {}

    if (ok === "1") {
      hideLoginScreen();
    } else {
      showLoginScreen();
    }

    /* Login button */
    var loginBtn = document.getElementById("login-btn");
    if (loginBtn) {
      loginBtn.onclick = checkPassword;
    }

    /* Enter key */
    var passInput = document.getElementById("password-input");
    if (passInput) {
      passInput.addEventListener("keypress", function(e) {
        if (e.key === "Enter") checkPassword();
      });
    }

    /* Protection */
    blockKeyboard();
    blockRightClick();
    blockSelection();
    blockConsole();

    /* DevTools detect — har 1 second */
    setInterval(detectDevTools, 1000);
  }

  /* ---------- EXPOSE ---------- */

  window.Security = {
    init: init,
    check: checkPassword,
    show: showLoginScreen,
    hide: hideLoginScreen
  };

})();
