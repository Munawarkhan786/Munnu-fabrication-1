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

  var WORKER_URL = 'https://munnu-fabrication-worker.munawarkhan487.workers.dev';
  var API_KEY = 'munnu-secret-2026-xyz-987';
  var STORAGE_KEY = 'munnu_geometry_data_v1';

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
      if (data && data.version) {
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
        // Purana data safe rahega — null nahi karte
        return null;
      }

      var data = await response.json();

      // Naya data store
      window.currentGeometryData = data;

      // localStorage me save (refresh pe rahega)
      saveGeometryToStorage(data);

      console.log("✅ Geometry data aa gaya + save ho gaya");
      return data;

    } catch (err) {
      console.error('❌ Fetch error:', err);
      // Purana data safe rahega
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
