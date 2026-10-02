/* =========================================================
   MAIN — Entry point
   Sab modules load hone ke baad init karta hai
   ========================================================= */

(function() {
  "use strict";

  /* ---------- MODULE LIST ---------- */

  var MODULES = [
    { name: "Bugs",     label: "🐛 Bugs",     priority: 1 },
    { name: "Security", label: "🔒 Security", priority: 2 },
    { name: "Sheet",    label: "📐 Sheet",    priority: 3 },
    { name: "Flat",     label: "📏 Flat",     priority: 4 },
    { name: "ThreeD",   label: "📦 3D",       priority: 5 },
    { name: "Result",   label: "✂️ Result",   priority: 6 },
    { name: "UI",       label: "🎨 UI",       priority: 7 }
  ];

  /* ---------- INIT ALL MODULES ---------- */

  function initModules() {

    MODULES.sort(function(a, b) {
      return (a.priority || 999) - (b.priority || 999);
    });

    var success = 0;
    var failed = 0;

    MODULES.forEach(function(mod) {

      var module = window[mod.name];

      if (!module) {
        console.warn("⚠️ Module missing: " + mod.name);
        failed++;
        return;
      }

      if (typeof module.init !== "function") {
        console.warn("⚠️ No init() in: " + mod.name);
        failed++;
        return;
      }

      try {
        module.init();
        console.log("✅ " + mod.label + " initialized");
        success++;
      } catch (err) {
        console.error("❌ " + mod.name + ".init error:", err.message);
        if (window.Bugs) {
          window.Bugs.log(
            mod.name + ".init",
            err.message,
            err.stack
          );
        }
        failed++;
      }
    });

    console.log("🎉 App ready! " + success + " ok, " + failed + " failed");

    window.dispatchEvent(new CustomEvent("appReady", {
      detail: { success: success, failed: failed }
    }));
  }

  /* ---------- STORAGE LOAD ---------- */

  function loadPersistedData() {
    if (window.Storage) {
      try {
        window.Storage.loadSettings();
        window.Storage.load();
      } catch (err) {
        if (window.Bugs) {
          window.Bugs.log("main.load", err.message, err.stack);
        }
      }
    }
  }

  /* ---------- BOOT ---------- */

  function boot() {

    console.log("🚀 Sheet Marking Tool starting...");

    loadPersistedData();

    setTimeout(initModules, 50);
  }

  /* ---------- START ---------- */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
