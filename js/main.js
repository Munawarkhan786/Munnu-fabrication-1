/* =========================================================
   MAIN.JS — APP STARTER (V2)
   =========================================================
   - Worker se EK BAAR fetch (Calculate pe)
   - Data localStorage me SAVE (refresh/browser band pe bhi rahega)
   - Sirf naya Calculate pe purana data REPLACE
   - Error pe purana data safe
   ========================================================= */

(function () {
  "use strict";

  /* =========================================================
     WORKER SETUP
     ========================================================= */

  var CFG = window.MUNNU_CONFIG || {};
  var WORKER_URL = CFG.WORKER_URL || "";
  var API_KEY = CFG.API_KEY || "";
  var TIMEOUT_MS = CFG.TIMEOUT_MS || 20000;
  var STORAGE_KEY = 'munnu_geometry_data_v2';
  var MIN_VERSION_TAG = "V8_3";   // purana data (V8.2) dobara calculate hoga
  var calcCounter = 0;

  window.currentGeometryData = null;

  /* =========================================================
     LOCAL STORAGE — SAVE / LOAD
     ========================================================= */

  function saveGeometryToStorage(data) {
    if (!data) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log("💾 Geometry data saved to localStorage");
    } catch (err) {
      console.warn("⚠️ Storage save failed:", err);
    }
  }

  function loadGeometryFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      var data = JSON.parse(raw);
      if (data && data.version && String(data.version).indexOf(MIN_VERSION_TAG) >= 0) {
        console.log("✅ Geometry data loaded from localStorage");
        return data;
      }

      return null;
    } catch (err) {
      console.warn("⚠️ Storage load failed:", err);
      return null;
    }
  }

  function clearGeometryStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log("🗑️ Geometry storage cleared");
    } catch (err) { /* ignore */ }
  }

  /* =========================================================
     FETCH GEOMETRY FROM WORKER
     ========================================================= */

  function setStatus(kind, text) {
    var el = document.getElementById("calc-status");
    if (!el) return;
    if (!text) { el.style.display = "none"; el.textContent = ""; return; }
    el.className = "calc-status " + (kind || "");
    el.textContent = text;
    el.style.display = "block";
  }

  function explainHttp(status) {
    if (status === 404) return "Worker nahi mila (404). Worker ka URL badla/delete hua hoga — js/config.js me WORKER_URL check karo.";
    if (status === 401) return "API key galat hai (401). js/config.js ki API_KEY aur Worker ki key same honi chahiye.";
    if (status === 403) return "Origin allow nahi hai (403). Worker ke ALLOWED_ORIGINS me website ka link daalo.";
    if (status === 429) return "Bahut zyada requests (429). Thodi der baad try karo.";
    if (status >= 500) return "Worker me error (" + status + "). Worker ka log dekho.";
    return "Worker error " + status;
  }

  function warningsText(data) {
    var list = (data && data.warnings) || [];
    var keep = list.filter(function (w) {
      return w.code === "NO_ZERO_BASE" || w.code === "MULTI_BASE" ||
        w.code === "NEEDS_BOTH_SIDES" || w.code === "ANGLE_MISSING" ||
        w.code === "SIZE_INVALID" || w.code === "SIZE_ZERO";
    });
    return keep.map(function (w) { return w.message; }).join("  ");
  }

  async function fetchGeometryData() {
    var state = window.AppState || window.state || {};
    var myCall = ++calcCounter;

    if (!WORKER_URL) {
      setStatus("error", "Worker URL set nahi hai. js/config.js me WORKER_URL daalo.");
      return null;
    }

    var controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;

    try {
      console.log("🔄 Worker se data fetch...");
      setStatus("", "⏳ Calculate ho raha hai...");

      var response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          settings: state.settings || window.settings || {},
          lenLines: state.lenLines || [],
          depLines: state.depLines || []
        }),
        signal: controller ? controller.signal : undefined
      });

      if (!response.ok) {
        console.error('❌ Worker error:', response.status);
        setStatus("error", "❌ " + explainHttp(response.status) + " (purana data dikh raha hai)");
        return null;
      }

      var data = await response.json();

      /* purani (slow) call ka jawab naye ko overwrite na kare */
      if (myCall !== calcCounter) { return null; }

      var errs = data && data.validation && data.validation.errors;
      if (errs && errs.length && errs[0].code !== "NO_INPUT") {
        setStatus("error", "❌ " + errs.map(function (e) { return e.message; }).join(" | "));
      } else {
        var wt = warningsText(data);
        if (wt) { setStatus("warn", "⚠ " + wt); }
        else { setStatus("ok", "✅ Calculate ho gaya"); setTimeout(function () {
          var el = document.getElementById("calc-status");
          if (el && el.classList.contains("ok")) { setStatus("", ""); }
        }, 2500); }
      }

      window.currentGeometryData = data;
      saveGeometryToStorage(data);

      console.log("✅ Geometry data aa gaya + save ho gaya");
      return data;

    } catch (err) {
      console.error('❌ Fetch error:', err);
      var msg = (err && err.name === "AbortError")
        ? "Worker ne " + Math.round(TIMEOUT_MS / 1000) + " sec me jawab nahi diya."
        : "Worker tak pahunch nahi paaye (internet ya Worker URL/CORS).";
      setStatus("error", "❌ " + msg + " (purana data dikh raha hai)");
      return null;
    } finally {
      if (timer) { clearTimeout(timer); }
    }
  }

  /* =========================================================
     MODULE LIST
     ========================================================= */

  var MODULES = [
    { name: "Bugs",     label: "🐛 Bugs",     priority: 1 },
    { name: "Security", label: "🔒 Security", priority: 2 },
    { name: "Sheet",    label: "📝 Sheet",    priority: 3 },
    { name: "Settings", label: "⚙️ Settings", priority: 4 },
    { name: "Flat",     label: "📐 Flat",     priority: 5 },
    { name: "ThreeD",   label: "📦 3D",       priority: 6 },
    { name: "Result",   label: "✂️ Result",   priority: 7 },
    { name: "UI",       label: "🎨 UI",       priority: 8 }
  ];

  function sortModules() {
    MODULES.sort(function (a, b) {
      return (a.priority || 999) - (b.priority || 999);
    });
  }

  /* =========================================================
     CHECK CORE
     ========================================================= */

  function checkCore() {
    var ok = true;

    if (!window.Storage) {
      console.warn("⚠️ Storage module not available.");
    }

    if (!window.AppState && !window.state) {
      console.warn("⚠️ App state not found.");
    }

    return ok;
  }

  /* =========================================================
     LOAD PERSISTED DATA
     ========================================================= */

  function loadPersistedData() {
    if (!window.Storage) {
      console.warn("⚠️ Storage unavailable.");
      return;
    }

    try {
      if (typeof window.Storage.loadSettings === "function") {
        window.Storage.loadSettings();
        console.log("✅ Settings loaded");
      }
    } catch (err) {
      console.error("❌ Settings load error:", err);
    }

    try {
      if (typeof window.Storage.load === "function") {
        window.Storage.load();
        console.log("✅ App data loaded");
      }
    } catch (err) {
      console.error("❌ App data load error:", err);
    }
  }

  /* =========================================================
     INIT ONE MODULE
     ========================================================= */

  function initModule(mod) {
    var module = window[mod.name];

    if (!module) {
      console.warn("⚠️ Module missing: " + mod.name);
      return false;
    }

    if (typeof module.init !== "function") {
      console.warn("⚠️ No init() in: " + mod.name);
      return false;
    }

    try {
      var result = module.init();

      if (result && typeof result.then === "function") {
        result.catch(function (err) {
          console.error("❌ " + mod.name + ".init async error:", err);
        });
      }

      console.log("✅ " + mod.label + " initialized");
      return true;

    } catch (err) {
      console.error("❌ " + mod.name + ".init error:", err);
      return false;
    }
  }

  /* =========================================================
     INIT ALL MODULES
     ========================================================= */

  function initModules() {
    sortModules();

    var success = 0;
    var failed = 0;

    MODULES.forEach(function (mod) {
      var result = initModule(mod);
      if (result) { success++; } else { failed++; }
    });

    console.log("🎉 App ready! " + success + " ok, " + failed + " failed");

    try {
      window.dispatchEvent(new CustomEvent("appReady", {
        detail: { success: success, failed: failed }
      }));
    } catch (err) {
      console.warn("⚠️ appReady event failed:", err);
    }
  }

  /* =========================================================
     DRAW ALL VIEWS
     ========================================================= */

  function drawAll() {
    /* lines ki list dobara (BASE auto chip naye data se) */
    try {
      if (window.Sheet && typeof window.Sheet.render === "function") {
        window.Sheet.render();
      }
    } catch (err) {
      console.error("❌ Sheet render error:", err);
    }

    try {
      if (window.Flat && typeof window.Flat.draw === "function") {
        window.Flat.draw();
      }
    } catch (err) {
      console.error("❌ Flat draw error:", err);
    }

    try {
      if (window.ThreeD && typeof window.ThreeD.draw === "function") {
        window.ThreeD.draw();
      }
    } catch (err) {
      console.error("❌ 3D draw error:", err);
    }

    try {
      if (window.Result && typeof window.Result.render === "function") {
        window.Result.render();
      }
    } catch (err) {
      console.error("❌ Result render error:", err);
    }
  }

  /* =========================================================
     CALCULATE — UI se call hoga
     ---------------------------------------------------------
     EK BAAR fetch → sab views draw
     ========================================================= */

  async function calculate() {
    console.log("⚙️ Calculate shuru...");

    // Worker se naya data fetch (EK BAAR)
    var data = await fetchGeometryData();

    if (!data) {
      console.warn("⚠️ Data nahi aaya — purana data dikha rahe hain");

      // Purana data agar hai, to wahi dikhao
      if (window.currentGeometryData) {
        drawAll();
      }

      return window.currentGeometryData;
    }

    // Sab views update karo
    drawAll();

    console.log("✅ Sab views update");
    return data;
  }

  /* =========================================================
     BOOT
     ========================================================= */

  async function boot() {
    console.log("🚀 Sheet Marking Tool starting...");

    checkCore();
    loadPersistedData();

    // PEHLE localStorage se data load karo
    var saved = loadGeometryFromStorage();

    if (saved) {
      window.currentGeometryData = saved;
      console.log("✅ Purana geometry data mil gaya — views update karenge");
    } else {
      console.log("📭 Koi saved data nahi — khaali views");
    }

    setTimeout(function () {
      initModules();
      setTimeout(drawAll, 50);
    }, 50);
  }

  /* =========================================================
     START
     ========================================================= */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.Main = {
    fetchGeometryData: fetchGeometryData,
    calculate: calculate,
    drawAll: drawAll,
    loadGeometryFromStorage: loadGeometryFromStorage,
    clearGeometryStorage: clearGeometryStorage
  };

})();
