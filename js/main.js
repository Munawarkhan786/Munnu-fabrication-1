/* =========================================================
   MAIN — APP STARTER
   =========================================================

   MODULE ORDER:

   1. Bugs
   2. Security
   3. Sheet
   4. Settings
   5. Flat
   6. ThreeD
   7. Result
   8. UI

   IMPORTANT:
   - Core / Geometry pehle index.html se load hote hain.
   - Main sirf modules ko initialize karta hai.
   - Engineering calculation MAIN mein nahi hoti.
   - GeometryEngine MASTER calculation engine hai.
   ========================================================= */

(function () {
  "use strict";

  // =========================================================
  // MODULE LIST
  // =========================================================

  var MODULES = [
    {
      name: "Bugs",
      label: "🐛 Bugs",
      priority: 1
    },
    {
      name: "Security",
      label: "🔒 Security",
      priority: 2
    },
    {
      name: "Sheet",
      label: "📝 Sheet",
      priority: 3
    },
    {
      name: "Settings",
      label: "⚙️ Settings",
      priority: 4
    },
    {
      name: "Flat",
      label: "📐 Flat",
      priority: 5
    },
    {
      name: "ThreeD",
      label: "📦 3D",
      priority: 6
    },
    {
      name: "Result",
      label: "✂️ Result",
      priority: 7
    },
    {
      name: "UI",
      label: "🎨 UI",
      priority: 8
    }
  ];

  // =========================================================
  // SORT MODULES
  // =========================================================

  function sortModules() {

    MODULES.sort(function (a, b) {

      return (
        (a.priority || 999) -
        (b.priority || 999)
      );
    });
  }

  // =========================================================
  // CHECK CORE
  // =========================================================

  function checkCore() {

    var ok = true;

    // -------------------------------------------------------
    // GeometryEngine
    // -------------------------------------------------------

    if (
      !window.GeometryEngine ||
      typeof window.GeometryEngine.analyze !== "function"
    ) {

      console.error(
        "❌ GeometryEngine missing or invalid."
      );

      ok = false;
    }

    // -------------------------------------------------------
    // Storage
    // -------------------------------------------------------

    if (!window.Storage) {

      console.warn(
        "⚠️ Storage module not available."
      );
    }

    // -------------------------------------------------------
    // AppState / state
    // -------------------------------------------------------

    if (
      !window.AppState &&
      !window.state
    ) {

      console.warn(
        "⚠️ App state not found."
      );
    }

    return ok;
  }

  // =========================================================
  // LOAD PERSISTED DATA
  // =========================================================

  function loadPersistedData() {

    if (!window.Storage) {

      console.warn(
        "⚠️ Storage unavailable — starting fresh."
      );

      return;
    }

    // -------------------------------------------------------
    // SETTINGS
    // -------------------------------------------------------

    try {

      if (
        typeof window.Storage.loadSettings ===
        "function"
      ) {

        window.Storage.loadSettings();

        console.log(
          "✅ Settings loaded"
        );
      }

    } catch (err) {

      console.error(
        "❌ Settings load error:",
        err
      );

      if (window.Bugs) {

        window.Bugs.log(
          "main.loadSettings",
          err.message,
          err.stack
        );
      }
    }

    // -------------------------------------------------------
    // APP DATA
    // -------------------------------------------------------

    try {

      if (
        typeof window.Storage.load ===
        "function"
      ) {

        window.Storage.load();

        console.log(
          "✅ App data loaded"
        );
      }

    } catch (err) {

      console.error(
        "❌ App data load error:",
        err
      );

      if (window.Bugs) {

        window.Bugs.log(
          "main.load",
          err.message,
          err.stack
        );
      }
    }
  }

  // =========================================================
  // INIT ONE MODULE
  // =========================================================

  function initModule(mod) {

    var module =
      window[mod.name];

    // -------------------------------------------------------
    // MODULE MISSING
    // -------------------------------------------------------

    if (!module) {

      console.warn(
        "⚠️ Module missing: " +
        mod.name
      );

      return false;
    }

    // -------------------------------------------------------
    // INIT MISSING
    // -------------------------------------------------------

    if (
      typeof module.init !==
      "function"
    ) {

      console.warn(
        "⚠️ No init() in: " +
        mod.name
      );

      return false;
    }

    // -------------------------------------------------------
    // INIT
    // -------------------------------------------------------

    try {

      module.init();

      console.log(
        "✅ " +
        mod.label +
        " initialized"
      );

      return true;

    } catch (err) {

      console.error(
        "❌ " +
        mod.name +
        ".init error:",
        err
      );

      if (window.Bugs) {

        try {

          window.Bugs.log(
            mod.name + ".init",
            err.message,
            err.stack
          );

        } catch (bugErr) {

          console.error(
            "Bug logger error:",
            bugErr
          );
        }
      }

      return false;
    }
  }

  // =========================================================
  // INIT ALL MODULES
  // =========================================================

  function initModules() {

    sortModules();

    var success = 0;
    var failed = 0;

    MODULES.forEach(
      function (mod) {

        var result =
          initModule(mod);

        if (result) {

          success++;

        } else {

          failed++;
        }
      }
    );

    // -------------------------------------------------------
    // FINAL STATUS
    // -------------------------------------------------------

    console.log(
      "🎉 App ready! " +
      success +
      " ok, " +
      failed +
      " failed"
    );

    // -------------------------------------------------------
    // APP READY EVENT
    // -------------------------------------------------------

    try {

      window.dispatchEvent(
        new CustomEvent(
          "appReady",
          {
            detail: {
              success: success,
              failed: failed
            }
          }
        )
      );

    } catch (err) {

      console.warn(
        "⚠️ appReady event failed:",
        err
      );
    }
  }

  // =========================================================
  // FINAL DRAW
  // =========================================================

  function initialDraw() {

    // -------------------------------------------------------
    // Flat
    // -------------------------------------------------------

    try {

      if (
        window.Flat &&
        typeof window.Flat.draw ===
        "function"
      ) {

        window.Flat.draw();
      }

    } catch (err) {

      console.error(
        "❌ Initial Flat draw error:",
        err
      );

      if (window.Bugs) {

        window.Bugs.log(
          "main.flatDraw",
          err.message,
          err.stack
        );
      }
    }

    // -------------------------------------------------------
    // 3D
    // -------------------------------------------------------

    try {

      if (
        window.ThreeD &&
        typeof window.ThreeD.draw ===
        "function"
      ) {

        // 3D tab hidden ho sakta hai,
        // isliye draw fail ho toh app crash nahi karega.
        window.ThreeD.draw();
      }

    } catch (err) {

      console.error(
        "❌ Initial 3D draw error:",
        err
      );

      if (window.Bugs) {

        window.Bugs.log(
          "main.threeDDraw",
          err.message,
          err.stack
        );
      }
    }

    // -------------------------------------------------------
    // Result
    // -------------------------------------------------------

    try {

      if (
        window.Result &&
        typeof window.Result.render ===
        "function"
      ) {

        window.Result.render();
      }

    } catch (err) {

      console.error(
        "❌ Initial Result render error:",
        err
      );

      if (window.Bugs) {

        window.Bugs.log(
          "main.resultRender",
          err.message,
          err.stack
        );
      }
    }
  }

  // =========================================================
  // BOOT
  // =========================================================

  function boot() {

    console.log(
      "🚀 Sheet Marking Tool starting..."
    );

    // -------------------------------------------------------
    // CORE CHECK
    // -------------------------------------------------------

    var coreOK =
      checkCore();

    if (!coreOK) {

      console.error(
        "❌ Core/Geometry problem. " +
        "App will continue for debugging."
      );
    }

    // -------------------------------------------------------
    // LOAD SAVED DATA
    // -------------------------------------------------------

    loadPersistedData();

    // -------------------------------------------------------
    // WAIT FOR DOM
    // -------------------------------------------------------

    setTimeout(
      function () {

        initModules();

        // Small delay so modules can finish
        // their DOM setup first.
        setTimeout(
          initialDraw,
          50
        );

      },
      50
    );
  }

  // =========================================================
  // START
  // =========================================================

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      boot
    );

  } else {

    boot();
  }

})();
