/* =========================================================
   MAIN.JS — APP STARTER
   =========================================================
   Geometry ab CLOUDFLARE WORKER pe hai (server pe).

   main.js:
   - Worker se EK BAAR fetch karta hai
   - window.currentGeometryData me store karta hai
   - flat.js / 3d.js / result.js usko use karte hain
   ========================================================= */

(function () {
  "use strict";

  /* =========================================================
     WORKER SETUP
     ========================================================= */

  var WORKER_URL = 'https://munnu-fabrication-worker.munawarkhan487.workers.dev';
  var API_KEY = 'munnu-secret-2026-xyz-987';


  /* =========================================================
     GLOBAL DATA STORE
     ========================================================= */

  window.currentGeometryData = null;


  /* =========================================================
     FETCH GEOMETRY FROM WORKER (EK BAAR)
     ========================================================= */

  async function fetchGeometryData() {
    var state = window.AppState || window.state || {};

    try {
      console.log("🔄 Worker se data fetch...");

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
        })
      });

      if (!response.ok) {
        console.error('❌ Worker error:', response.status);
        window.currentGeometryData = null;
        return null;
      }

      var data = await response.json();
      window.currentGeometryData = data;

      console.log("✅ Geometry data ready");
      return data;

    } catch (err) {
      console.error('❌ Fetch error:', err);
      window.currentGeometryData = null;
      return null;
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
     CALCULATE — 1 fetch + sab draw
     ========================================================= */

  async function calculate() {
    console.log("⚙️ Calculate...");

    var data = await fetchGeometryData();

    if (!data) {
      console.warn("⚠️ Data nahi aaya");
      return null;
    }

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

    await fetchGeometryData();

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
    drawAll: drawAll
  };

})();
