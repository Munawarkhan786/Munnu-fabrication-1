/* =========================================================
   SETTINGS.JS — Material / Thickness / Bend Settings
   ---------------------------------------------------------
   Data ab window.currentGeometryData se aata hai
   (main.js Worker se EK BAAR fetch karta hai).
   ========================================================= */

(function () {
  "use strict";

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

    if (!el) return;

    el.textContent = message || "";

    el.classList.remove("saved", "saving", "failed");

    if (type) {
      el.classList.add(type);
    }
  }

  function numberFromElement(el, fallback) {
    if (!el) return fallback;

    var value = parseFloat(el.value);

    return isFinite(value) ? value : fallback;
  }

  /* =======================================================
     DEFAULTS
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

  var MATERIAL_K = {
    SS304: 0.44,
    SS202: 0.45
  };

  /* =======================================================
     HTML INPUTS
     ======================================================= */

  function getVDieInput() { return $("setVdie"); }
  function getRadiusInput() { return $("setRadius"); }
  function getKFactorInput() { return $("setKfactor"); }
  function getSpringbackInput() { return $("setSpringback"); }
  function getReliefInput() { return $("setRelief"); }
  function getCustomThicknessInput() { return $("customThick"); }

  /* =======================================================
     SANITIZE
     ======================================================= */

  function sanitize(settings) {
    var s = settings || {};

    var material = s.material === "SS202" ? "SS202" : "SS304";

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
      kfactor = MATERIAL_K[material] || DEFAULTS.kfactor;
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
     READ UI
     ======================================================= */

  function readUI() {
    var state = getSettings();

    var material = state.material || DEFAULTS.material;

    var activeMaterial = document.querySelector(".material-btn.active");

    if (activeMaterial) {
      material = activeMaterial.dataset.material ||
        activeMaterial.dataset.value ||
        activeMaterial.value ||
        material;
    }

    material = String(material).toUpperCase().replace(/\s+/g, "");

    if (material.indexOf("202") !== -1) {
      material = "SS202";
    } else {
      material = "SS304";
    }

    var thickness = parseFloat(state.thickness);

    var activeThickness = document.querySelector(".thickness-btn.active");

    if (activeThickness) {
      var buttonThickness = activeThickness.dataset.thick ||
        activeThickness.dataset.thickness ||
        activeThickness.dataset.value ||
        activeThickness.value;

      var bt = parseFloat(buttonThickness);

      if (isFinite(bt)) {
        thickness = bt;
      }
    }

    var customThickness = getCustomThicknessInput();

    if (customThickness && String(customThickness.value).trim() !== "") {
      var ct = parseFloat(customThickness.value);

      if (isFinite(ct) && ct >= 0.1 && ct <= 10) {
        thickness = ct;
      }
    }

    return sanitize({
      material: material,
      thickness: isFinite(thickness) ? thickness : DEFAULTS.thickness,
      vDie: numberFromElement(getVDieInput(), DEFAULTS.vDie),
      radius: numberFromElement(getRadiusInput(), DEFAULTS.radius),
      kfactor: numberFromElement(
        getKFactorInput(),
        MATERIAL_K[material] || DEFAULTS.kfactor
      ),
      springback: numberFromElement(getSpringbackInput(), DEFAULTS.springback),
      relief: numberFromElement(getReliefInput(), DEFAULTS.relief)
    });
  }

  /* =======================================================
     FILL UI
     ======================================================= */

  function fill(settings) {
    var s = sanitize(settings || getSettings());

    var state = getState();

    state.settings = s;

    if (getVDieInput()) { getVDieInput().value = s.vDie; }
    if (getRadiusInput()) { getRadiusInput().value = s.radius; }
    if (getKFactorInput()) { getKFactorInput().value = s.kfactor; }
    if (getSpringbackInput()) { getSpringbackInput().value = s.springback; }
    if (getReliefInput()) { getReliefInput().value = s.relief; }

    var customThickness = getCustomThicknessInput();

    if (customThickness) {
      customThickness.value = "";
    }

    updateButtons(s);
  }

  /* =======================================================
     BUTTON STATE
     ======================================================= */

  function updateButtons(settings) {
    var materialButtons = document.querySelectorAll(".material-btn");

    materialButtons.forEach(function (button) {
      var value = button.dataset.material ||
        button.dataset.value ||
        button.value ||
        button.textContent;

      var normalized = String(value || "").toUpperCase().replace(/\s+/g, "");

      var material = normalized.indexOf("202") !== -1 ? "SS202" : "SS304";

      button.classList.toggle("active", material === settings.material);
    });

    var thicknessButtons = document.querySelectorAll(".thickness-btn");

    thicknessButtons.forEach(function (button) {
      var value = button.dataset.thick ||
        button.dataset.thickness ||
        button.dataset.value ||
        button.value;

      var numVal = parseFloat(value);

      button.classList.toggle(
        "active",
        isFinite(numVal) && Math.abs(numVal - settings.thickness) < 0.0001
      );
    });
  }

  /* =======================================================
     MATERIAL
     ======================================================= */

  function selectMaterial(material) {
    var text = String(material || "").toUpperCase().replace(/\s+/g, "");

    var selected = text.indexOf("202") !== -1 ? "SS202" : "SS304";

    var settings = getSettings();

    settings.material = selected;
    settings.kfactor = MATERIAL_K[selected];

    fill(settings);
    save();

    setStatus(selected + " Saved", "saved");
  }

  /* =======================================================
     THICKNESS BUTTON
     ======================================================= */

  function selectThickness(value) {
    var thickness = parseFloat(value);

    if (!isFinite(thickness) || thickness <= 0) {
      return;
    }

    var settings = getSettings();

    settings.thickness = thickness;

    var custom = getCustomThicknessInput();

    if (custom) {
      custom.value = "";
    }

    fill(settings);
    save();

    setStatus("Thickness Saved", "saved");
  }

  /* =======================================================
     CUSTOM THICKNESS
     ======================================================= */

  function saveCustomThickness() {
    var input = getCustomThicknessInput();

    if (!input) return;

    var value = parseFloat(input.value);

    if (!isFinite(value) || value < 0.1 || value > 10) {
      return;
    }

    var settings = getSettings();

    settings.thickness = value;

    document.querySelectorAll(".thickness-btn").forEach(function (button) {
      button.classList.remove("active");
    });

    fill(settings);

    input.value = value;

    save();

    setStatus("Custom Thickness Saved", "saved");
  }

  /* =======================================================
     INIT MATERIAL BUTTONS
     ======================================================= */

  function initMaterialButtons() {
    document.querySelectorAll(".material-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        var value = button.dataset.material ||
          button.dataset.value ||
          button.value ||
          button.textContent;

        selectMaterial(value);
      });
    });
  }

  /* =======================================================
     INIT THICKNESS BUTTONS
     ======================================================= */

  function initThicknessButtons() {
    document.querySelectorAll(".thickness-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        var value = button.dataset.thick ||
          button.dataset.thickness ||
          button.dataset.value ||
          button.value;

        selectThickness(value);
      });
    });
  }

  /* =======================================================
     INIT INPUTS
     ======================================================= */

  function initInputs() {
    var inputs = [
      getVDieInput(),
      getRadiusInput(),
      getKFactorInput(),
      getSpringbackInput(),
      getReliefInput()
    ];

    inputs.forEach(function (input) {
      if (!input) return;

      input.addEventListener("change", save);
      input.addEventListener("blur", save);
    });

    var customThickness = getCustomThicknessInput();

    if (customThickness) {
      customThickness.addEventListener("change", saveCustomThickness);
      customThickness.addEventListener("blur", saveCustomThickness);
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
      if (window.Storage && typeof window.Storage.saveSettings === "function") {
        window.Storage.saveSettings(settings);
      } else if (window.Storage && typeof window.Storage.save === "function") {
        window.Storage.save();
      } else if (window.Core && typeof window.Core.save === "function") {
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

      if (window.Bugs && typeof window.Bugs.error === "function") {
        window.Bugs.error("Settings save failed", error);
      }

      console.error("Settings save failed:", error);
    }

    refreshViews();
  }

  /* =======================================================
     REFRESH OTHER MODULES
     ---------------------------------------------------------
     Main.calculate() Worker se fetch karega, phir sab draw karega.
     ======================================================= */

  function refreshViews() {
    // Main.calculate() Worker se fetch karega + sab views draw karega
    if (window.Main && typeof window.Main.calculate === "function") {
      window.Main.calculate();
      return;
    }

    // Fallback (agar Main.calculate nahi hai)
    try {
      if (window.Flat && typeof window.Flat.draw === "function") {
        window.Flat.draw();
      }
    } catch (error) {
      console.warn("Flat refresh failed:", error);
    }

    try {
      if (window.ThreeD && typeof window.ThreeD.draw === "function") {
        window.ThreeD.draw();
      }
    } catch (error) {
      console.warn("3D refresh failed:", error);
    }

    try {
      if (window.Result && typeof window.Result.render === "function") {
        window.Result.render();
      }
    } catch (error) {
      console.warn("Result refresh failed:", error);
    }
  }

  /* =======================================================
     LOAD SAVED SETTINGS
     ======================================================= */

  function loadSaved() {
    var state = getState();

    if (
      state.settings &&
      typeof state.settings === "object" &&
      Object.keys(state.settings).length > 0
    ) {
      state.settings = sanitize(state.settings);
      fill(state.settings);
      return;
    }

    try {
      var raw = localStorage.getItem("sheetMarking_settings_v2");

      if (raw) {
        var saved = JSON.parse(raw);
        state.settings = sanitize(saved);
        fill(state.settings);
        return;
      }
    } catch (error) {
      console.warn("Settings load failed:", error);
    }

    state.settings = sanitize(DEFAULTS);
    fill(state.settings);
  }

  /* =======================================================
     RESET DEFAULT
     ======================================================= */

  function resetDefaults() {
    var state = getState();

    state.settings = sanitize(DEFAULTS);

    fill(state.settings);

    var custom = getCustomThicknessInput();

    if (custom) {
      custom.value = "";
    }

    save();

    setStatus("Default Restored", "saved");
  }

  /* =======================================================
     SAVE BUTTON
     ======================================================= */

  function initSaveResetButtons() {
    var saveButton = $("btn-save-settings");

    if (saveButton) {
      saveButton.addEventListener("click", function () {
        save();
        setStatus("Settings Saved", "saved");
      });
    }

    var resetButton = $("btn-reset-settings");

    if (resetButton) {
      resetButton.addEventListener("click", resetDefaults);
    }
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
      initSaveResetButtons();
      fill(getSettings());
    } catch (error) {
      console.error("Settings initialization failed:", error);

      if (window.Bugs && typeof window.Bugs.error === "function") {
        window.Bugs.error("Settings initialization failed", error);
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
    reset: resetDefaults,
    get: function () {
      return sanitize(getSettings());
    }
  };

})();
