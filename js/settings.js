/* =========================================================
   SETTINGS.JS — Material / Thickness / Bend Settings
   ---------------------------------------------------------
   RESPONSIBILITY:
   - Material select
   - Thickness select
   - V-die
   - Radius
   - K-factor
   - Springback
   - Relief
   - Save settings

   IMPORTANT:
   - No geometry calculation here
   - No BA / BD calculation here
   - Geometry calculation belongs to geometry.js
   ========================================================= */

(function () {
  "use strict";

  /* =======================================================
     HELPERS
     ======================================================= */

  function $(id) {
    return document.getElementById(id);
  }

  function getState() {
    return window.AppState || window.state || {};
  }

  function getSettings() {
    var state = getState();

    if (!state.settings || typeof state.settings !== "object") {
      state.settings = {};
    }

    return state.settings;
  }

  function setStatus(message, type) {
    var el = document.querySelector(".save-status");

    if (!el) {
      return;
    }

    el.textContent = message || "";

    el.classList.remove(
      "saved",
      "saving",
      "failed"
    );

    if (type) {
      el.classList.add(type);
    }
  }

  function numberValue(id, fallback) {
    var el = $(id);

    if (!el) {
      return fallback;
    }

    var value = parseFloat(el.value);

    return isFinite(value) ? value : fallback;
  }

  /* =======================================================
     DEFAULT SETTINGS
     ======================================================= */

  var DEFAULTS = {
    material: "SS304",
    thickness: 0.8,
    vDie: 6,
    radius: 0.8,
    kfactor: 0.44,
    springback: 0.5,
    relief: 1.6
  };

  /* =======================================================
     MATERIAL K-FACTOR
     ======================================================= */

  var MATERIAL_K = {
    SS304: 0.44,
    SS202: 0.45
  };

  /* =======================================================
     FIND SETTING INPUT
     -------------------------------------------------------
     Supports the existing IDs if present.
     ======================================================= */

  function findInput(names) {
    for (var i = 0; i < names.length; i++) {
      var el = $(names[i]);

      if (el) {
        return el;
      }
    }

    return null;
  }

  function getMaterialInput() {
    return findInput([
      "material",
      "material-select",
      "setting-material"
    ]);
  }

  function getThicknessInput() {
    return findInput([
      "thickness",
      "thickness-input",
      "setting-thickness"
    ]);
  }

  function getVDieInput() {
    return findInput([
      "v-die",
      "vdie",
      "vDie",
      "setting-vdie"
    ]);
  }

  function getRadiusInput() {
    return findInput([
      "radius",
      "bend-radius",
      "setting-radius"
    ]);
  }

  function getKFactorInput() {
    return findInput([
      "k-factor",
      "kfactor",
      "kFactor",
      "setting-kfactor"
    ]);
  }

  function getSpringbackInput() {
    return findInput([
      "springback",
      "spring-back",
      "setting-springback"
    ]);
  }

  function getReliefInput() {
    return findInput([
      "relief",
      "corner-relief",
      "setting-relief"
    ]);
  }

  /* =======================================================
     READ SETTINGS FROM UI
     ======================================================= */

  function readUI() {
    var materialInput = getMaterialInput();

    var material =
      materialInput && materialInput.value
        ? materialInput.value
        : DEFAULTS.material;

    var settings = {
      material: material,

      thickness: numberValue(
        getId(getThicknessInput()),
        DEFAULTS.thickness
      ),

      vDie: numberValue(
        getId(getVDieInput()),
        DEFAULTS.vDie
      ),

      radius: numberValue(
        getId(getRadiusInput()),
        DEFAULTS.radius
      ),

      kfactor: numberValue(
        getId(getKFactorInput()),
        MATERIAL_K[material] || DEFAULTS.kfactor
      ),

      springback: numberValue(
        getId(getSpringbackInput()),
        DEFAULTS.springback
      ),

      relief: numberValue(
        getId(getReliefInput()),
        DEFAULTS.relief
      )
    };

    return sanitize(settings);
  }

  /*
    Convert element to ID for numberValue().
  */
  function getId(element) {
    return element ? element.id : null;
  }

  /* =======================================================
     SANITIZE
     ======================================================= */

  function sanitize(settings) {
    var s = settings || {};

    var material =
      s.material === "SS202"
        ? "SS202"
        : "SS304";

    var thickness = parseFloat(s.thickness);
    var vDie = parseFloat(s.vDie);
    var radius = parseFloat(s.radius);
    var kfactor = parseFloat(s.kfactor);
    var springback = parseFloat(s.springback);
    var relief = parseFloat(s.relief);

    if (!isFinite(thickness) || thickness <= 0) {
      thickness = DEFAULTS.thickness;
    }

    if (!isFinite(vDie) || vDie <= 0) {
      vDie = DEFAULTS.vDie;
    }

    if (!isFinite(radius) || radius <= 0) {
      radius = DEFAULTS.radius;
    }

    if (!isFinite(kfactor) || kfactor <= 0) {
      kfactor =
        MATERIAL_K[material] ||
        DEFAULTS.kfactor;
    }

    if (!isFinite(springback) || springback < 0) {
      springback = DEFAULTS.springback;
    }

    if (!isFinite(relief) || relief < 0) {
      relief = DEFAULTS.relief;
    }

    return {
      material: material,
      thickness: thickness,
      vDie: vDie,
      radius: radius,
      kfactor: kfactor,
      springback: springback,
      relief: relief
    };
  }

  /* =======================================================
     PUT SETTINGS INTO UI
     ======================================================= */

  function fill(settings) {
    var s = sanitize(
      settings || getSettings()
    );

    var materialInput = getMaterialInput();
    var thicknessInput = getThicknessInput();
    var vDieInput = getVDieInput();
    var radiusInput = getRadiusInput();
    var kInput = getKFactorInput();
    var springInput = getSpringbackInput();
    var reliefInput = getReliefInput();

    if (materialInput) {
      materialInput.value = s.material;
    }

    if (thicknessInput) {
      thicknessInput.value = s.thickness;
    }

    if (vDieInput) {
      vDieInput.value = s.vDie;
    }

    if (radiusInput) {
      radiusInput.value = s.radius;
    }

    if (kInput) {
      kInput.value = s.kfactor;
    }

    if (springInput) {
      springInput.value = s.springback;
    }

    if (reliefInput) {
      reliefInput.value = s.relief;
    }

    updateButtons(s);
  }

  /* =======================================================
     MATERIAL BUTTONS
     ======================================================= */

  function updateButtons(settings) {
    var materialButtons =
      document.querySelectorAll(".material-btn");

    materialButtons.forEach(function (button) {
      var value =
        button.dataset.material ||
        button.dataset.value ||
        button.value ||
        button.textContent.trim();

      button.classList.toggle(
        "active",
        normalizeMaterial(value) === settings.material
      );
    });

    var thicknessButtons =
      document.querySelectorAll(".thickness-btn");

    thicknessButtons.forEach(function (button) {
      var value =
        button.dataset.thickness ||
        button.dataset.value ||
        button.value;

      var num = parseFloat(value);

      button.classList.toggle(
        "active",
        isFinite(num) &&
        Math.abs(num - settings.thickness) < 0.0001
      );
    });
  }

  function normalizeMaterial(value) {
    var text = String(value || "")
      .toUpperCase()
      .replace(/\s+/g, "");

    if (text.indexOf("202") !== -1) {
      return "SS202";
    }

    return "SS304";
  }

  function selectMaterial(material) {
    var settings = getSettings();

    settings.material =
      normalizeMaterial(material);

    /*
      Material default K-factor.
      User can still manually change it.
    */
    settings.kfactor =
      MATERIAL_K[settings.material] ||
      DEFAULTS.kfactor;

    fill(settings);
    save();

    setStatus("Saved", "saved");
  }

  function selectThickness(value) {
    var thickness = parseFloat(value);

    if (!isFinite(thickness) || thickness <= 0) {
      return;
    }

    var settings = getSettings();

    settings.thickness = thickness;

    fill(settings);
    save();

    setStatus("Saved", "saved");
  }

  /* =======================================================
     BUTTON EVENTS
     ======================================================= */

  function initMaterialButtons() {
    var buttons =
      document.querySelectorAll(".material-btn");

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var value =
          button.dataset.material ||
          button.dataset.value ||
          button.value ||
          button.textContent;

        selectMaterial(value);
      });
    });
  }

  function initThicknessButtons() {
    var buttons =
      document.querySelectorAll(".thickness-btn");

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var value =
          button.dataset.thickness ||
          button.dataset.value ||
          button.value;

        selectThickness(value);
      });
    });
  }

  /* =======================================================
     INPUT EVENTS
     ======================================================= */

  function initInputs() {
    var inputs = [
      getThicknessInput(),
      getVDieInput(),
      getRadiusInput(),
      getKFactorInput(),
      getSpringbackInput(),
      getReliefInput()
    ];

    inputs.forEach(function (input) {
      if (!input) {
        return;
      }

      input.addEventListener("change", function () {
        save();
      });

      input.addEventListener("blur", function () {
        save();
      });
    });

    var materialInput = getMaterialInput();

    if (materialInput) {
      materialInput.addEventListener(
        "change",
        function () {
          selectMaterial(materialInput.value);
        }
      );
    }
  }

  /* =======================================================
     SAVE
     ======================================================= */

  function save() {
    var settings = readUI();

    var state = getState();

    state.settings = settings;

    setStatus("Saving...", "saving");

    try {
      /*
        Use existing Core / Storage if available.
      */

      if (
        window.Storage &&
        typeof window.Storage.saveSettings === "function"
      ) {
        window.Storage.saveSettings(settings);
      } else if (
        window.Storage &&
        typeof window.Storage.save === "function"
      ) {
        window.Storage.save();
      } else if (
        window.Core &&
        typeof window.Core.save === "function"
      ) {
        window.Core.save();
      } else {
        localStorage.setItem(
          "sheetMarking_settings_v2",
          JSON.stringify(settings)
        );
      }

      setStatus("Saved", "saved");

    } catch (error) {
      setStatus("Save failed", "failed");

      if (
        window.Bugs &&
        typeof window.Bugs.error === "function"
      ) {
        window.Bugs.error(
          "Settings save failed",
          error
        );
      }

      console.error(
        "Settings save failed:",
        error
      );
    }

    refreshViews();
  }

  /* =======================================================
     REFRESH VIEWS
     ======================================================= */

  function refreshViews() {
    try {
      if (
        window.FlatView &&
        typeof window.FlatView.draw === "function"
      ) {
        window.FlatView.draw();
      } else if (
        window.Flat &&
        typeof window.Flat.draw === "function"
      ) {
        window.Flat.draw();
      }
    } catch (error) {
      console.warn(
        "Flat refresh failed:",
        error
      );
    }

    try {
      if (
        window.ThreeD &&
        typeof window.ThreeD.draw === "function"
      ) {
        window.ThreeD.draw();
      }
    } catch (error) {
      console.warn(
        "3D refresh failed:",
        error
      );
    }

    try {
      if (
        window.Result &&
        typeof window.Result.render === "function"
      ) {
        window.Result.render();
      }
    } catch (error) {
      console.warn(
        "Result refresh failed:",
        error
      );
    }
  }

  /* =======================================================
     LOAD SAVED SETTINGS
     ======================================================= */

  function loadSaved() {
    var state = getState();

    /*
      If core already loaded settings,
      use those first.
    */
    if (
      state.settings &&
      typeof state.settings === "object" &&
      Object.keys(state.settings).length > 0
    ) {
      state.settings = sanitize(
        state.settings
      );

      fill(state.settings);
      return;
    }

    /*
      Fallback localStorage.
    */
    try {
      var raw =
        localStorage.getItem(
          "sheetMarking_settings_v2"
        );

      if (raw) {
        var saved = JSON.parse(raw);

        state.settings =
          sanitize(saved);

        fill(state.settings);
        return;
      }
    } catch (error) {
      console.warn(
        "Settings load failed:",
        error
      );
    }

    /*
      Nothing saved → defaults.
    */
    state.settings =
      sanitize(DEFAULTS);

    fill(state.settings);
  }

  /* =======================================================
     INIT
     ======================================================= */

  function init() {
    try {
      loadSaved();

      initMaterialButtons();
      initThicknessButtons();
      initInputs();

      /*
        Final UI sync.
      */
      fill(getSettings());

    } catch (error) {
      console.error(
        "Settings initialization failed:",
        error
      );

      if (
        window.Bugs &&
        typeof window.Bugs.error === "function"
      ) {
        window.Bugs.error(
          "Settings initialization failed",
          error
        );
      }
    }
  }

  /* =======================================================
     PUBLIC API
     ======================================================= */

  window.Settings = {
    init: init,
    fill: fill,
    save: save,
    load: loadSaved,
    get: function () {
      return sanitize(getSettings());
    }
  };

})();
