/* =========================================================
   SECURITY.JS — Login / Access System

   HTML IDs:
   login-screen
   password-input
   login-btn
   login-error
   app-content

   Kaam:
   1. Password check
   2. Login screen show/hide
   3. Login session maintain
   4. Logout support
   5. Wrong password error
   6. Bugs system ke saath compatible
   ========================================================= */

(function () {
  "use strict";

  // =========================================================
  // SECURITY SETTINGS
  // =========================================================

  var LOGIN_KEY = "sheetMarking_loggedIn_v1";

  /*
    IMPORTANT:
    Yeh client-side login hai.
    Browser app ko completely secure nahi banata.
    Sirf normal app access ke liye hai.
  */

  var APP_PASSWORD = "1234";

  // =========================================================
  // ELEMENT SHORTCUT
  // =========================================================

  function getEl(id) {
    return document.getElementById(id);
  }

  // =========================================================
  // SHOW LOGIN
  // =========================================================

  function showLogin() {

    var loginScreen = getEl("login-screen");
    var appContent = getEl("app-content");

    if (loginScreen) {
      loginScreen.style.display = "flex";
    }

    if (appContent) {
      appContent.style.display = "none";
    }

    clearError();

    var passwordInput = getEl("password-input");

    if (passwordInput) {
      setTimeout(function () {
        passwordInput.focus();
      }, 100);
    }
  }

  // =========================================================
  // SHOW APP
  // =========================================================

  function showApp() {

    var loginScreen = getEl("login-screen");
    var appContent = getEl("app-content");

    if (loginScreen) {
      loginScreen.style.display = "none";
    }

    if (appContent) {
      appContent.style.display = "block";
    }

    clearError();
  }

  // =========================================================
  // ERROR MESSAGE
  // =========================================================

  function showError(message) {

    var errorEl = getEl("login-error");

    if (!errorEl) {
      return;
    }

    errorEl.textContent = message || "Password galat hai.";

    errorEl.style.display = "block";
  }

  // =========================================================
  // CLEAR ERROR
  // =========================================================

  function clearError() {

    var errorEl = getEl("login-error");

    if (!errorEl) {
      return;
    }

    errorEl.textContent = "";
    errorEl.style.display = "none";
  }

  // =========================================================
  // GET PASSWORD
  // =========================================================

  function getPassword() {

    var input = getEl("password-input");

    if (!input) {
      return "";
    }

    return String(input.value || "").trim();
  }

  // =========================================================
  // CHECK PASSWORD
  // =========================================================

  function checkPassword(password) {

    return password === APP_PASSWORD;
  }

  // =========================================================
  // SAVE LOGIN SESSION
  // =========================================================

  function saveSession() {

    try {

      localStorage.setItem(
        LOGIN_KEY,
        "true"
      );

    } catch (error) {

      if (window.Bugs) {
        window.Bugs.capture(
          error,
          "SECURITY",
          "Login session save failed"
        );
      }

    }
  }

  // =========================================================
  // CHECK LOGIN SESSION
  // =========================================================

  function hasSession() {

    try {

      return localStorage.getItem(LOGIN_KEY) === "true";

    } catch (error) {

      if (window.Bugs) {
        window.Bugs.capture(
          error,
          "SECURITY",
          "Login session read failed"
        );
      }

      return false;
    }
  }

  // =========================================================
  // LOGIN
  // =========================================================

  function login() {

    clearError();

    var password = getPassword();

    if (!password) {

      showError("Password daalo.");

      return false;
    }

    if (!checkPassword(password)) {

      showError("❌ Password galat hai.");

      var input = getEl("password-input");

      if (input) {
        input.value = "";
        input.focus();
      }

      if (window.Bugs) {
        window.Bugs.log(
          "Wrong password attempt",
          "SECURITY"
        );
      }

      return false;
    }

    saveSession();

    showApp();

    // Password field clear
    var passwordInput = getEl("password-input");

    if (passwordInput) {
      passwordInput.value = "";
    }

    return true;
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  function logout() {

    try {

      localStorage.removeItem(LOGIN_KEY);

    } catch (error) {

      if (window.Bugs) {
        window.Bugs.capture(
          error,
          "SECURITY",
          "Logout session clear failed"
        );
      }

    }

    showLogin();
  }

  // =========================================================
  // LOGIN BUTTON
  // =========================================================

  function bindLoginButton() {

    var button = getEl("login-btn");

    if (!button) {
      return;
    }

    button.addEventListener("click", function () {
      login();
    });
  }

  // =========================================================
  // ENTER KEY SUPPORT
  // =========================================================

  function bindPasswordEnter() {

    var input = getEl("password-input");

    if (!input) {
      return;
    }

    input.addEventListener("keydown", function (event) {

      if (event.key === "Enter") {

        event.preventDefault();

        login();
      }

    });
  }

  // =========================================================
  // INITIAL LOGIN STATE
  // =========================================================

  function checkSession() {

    if (hasSession()) {
      showApp();
    } else {
      showLogin();
    }
  }

  // =========================================================
  // INIT
  // =========================================================

  function init() {

    bindLoginButton();

    bindPasswordEnter();

    checkSession();
  }

  // =========================================================
  // PUBLIC API
  // =========================================================

  window.Security = {

    init: init,

    login: login,

    logout: logout,

    isLoggedIn: hasSession,

    showLogin: showLogin,

    showApp: showApp
  };

})();
