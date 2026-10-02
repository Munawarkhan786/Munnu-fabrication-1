/* =========================================================
   CORE — State + Settings + Formulas + Storage
   ========================================================= */

(function() {
  "use strict";

  window.STORAGE_KEY = "sheetMarking_v7";
  window.SETTINGS_KEY = "sheetMarking_settings_v2";

  window.FRACTIONS = [
    { label: "1/16", val: 1 / 16 },
    { label: "1/8", val: 2 / 16 },
    { label: "3/16", val: 3 / 16 },
    { label: "1/4", val: 4 / 16 },
    { label: "5/16", val: 5 / 16 },
    { label: "3/8", val: 6 / 16 },
    { label: "7/16", val: 7 / 16 },
    { label: "1/2", val: 8 / 16 },
    { label: "9/16", val: 9 / 16 },
    { label: "5/8", val: 10 / 16 },
    { label: "11/16", val: 11 / 16 },
    { label: "3/4", val: 12 / 16 },
    { label: "13/16", val: 13 / 16 },
    { label: "7/8", val: 14 / 16 },
    { label: "15/16", val: 15 / 16 },
    { label: '1"', val: 1 }
  ];

  window.FRAC_LABELS = [
    "", "1/16", "1/8", "3/16", "1/4", "5/16", "3/8", "7/16", "1/2",
    "9/16", "5/8", "11/16", "3/4", "13/16", "7/8", "15/16"
  ];

  window.ANGLES = [90, 65, 45, 30];

  window.ZOOM_MAX = 20;
  window.ZOOM_MIN = 0.2;
  window.MIN_SEGMENT_PX = 10;

  window.MATERIAL_K = {
    SS304: 0.44,
    SS202: 0.45
  };

  window.DEFAULT_SETTINGS = {
    material: "SS304",
    thickness: 0.8,
    vdie: 6.0,
    radius: 0.8,
    kfactor: 0.44,
    springback: 0.5,
    relief: 1.6
  };

  window.state = {
    keyword: "box",
    activeSide: "len",
    current: 0,
    lenLines: [],
    depLines: [],
    editingLine: null,
    editMode: false
  };

  window.view3d = {
    rotX: -25,
    rotY: 35,
    dist: 900,
    autoRotate: false,
    wireframe: false
  };

  window.flatView = {
    zoom: 1,
    panX: 0,
    panY: 0
  };

  window.settings = JSON.parse(
    JSON.stringify(window.DEFAULT_SETTINGS)
  );

  window.hiddenCuts = {};
  window.autoAddTimer = null;

  window.$ = function(id) {
    return document.getElementById(id);
  };

  window.round16 = function(v) {
    return Math.round(Number(v) * 16) / 16;
  };

  window.cleanNumber = function(v) {
    return Math.round(Number(v) * 1000000) / 1000000;
  };

  window.formatInch = function(value) {
    value = window.round16(Number(value) || 0);
    if (value === 0) return "0";

    var whole = Math.floor(value);
    var frac = window.round16(value - whole);

    if (frac >= 1) {
      whole += 1;
      frac = 0;
    }

    if (frac === 0) return whole + '"';

    var label = window.FRAC_LABELS[Math.round(frac * 16)];
    if (!label) return value + '"';

    if (whole === 0) return label + '"';
    return whole + " " + label + '"';
  };

  window.el = function(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  function bendAllowance(theta, R, K, T) {
    var rad = Math.abs(theta) * Math.PI / 180;
    return rad * (R + K * T);
  }

  function bendDeduction(theta, R, K, T) {
    var rad = Math.abs(theta) * Math.PI / 180;
    var BA = bendAllowance(theta, R, K, T);
    return 2 * (R + T) * Math.tan(rad / 2) - BA;
  }

  function cornerRelief(R, T) {
    var custom = Number(window.settings.relief);
    if (Number.isFinite(custom) && custom > 0) return custom;
    return window.cleanNumber(R + T + 0.5);
  }

  function calculateCorner(A, B, angle) {
    var R = Number(window.settings.radius);
    var K = Number(window.settings.kfactor);
    var T = Number(window.settings.thickness);
    var springback = Number(window.settings.springback);

    var effAngle = Number(angle) - springback;
    if (effAngle <= 0) effAngle = 1;

    var BA = bendAllowance(effAngle, R, K, T);
    var BD = bendDeduction(effAngle, R, K, T);
    var flat = A + B - BD;
    var relief = cornerRelief(R, T);

    return {
      angle: Number(angle),
      effectiveAngle: effAngle,
      BA: window.cleanNumber(BA),
      BD: window.cleanNumber(BD),
      flat: window.cleanNumber(flat),
      relief: relief
    };
  }

  window.Formulas = {
    bendAllowance: bendAllowance,
    bendDeduction: bendDeduction,
    cornerRelief: cornerRelief,
    calculateCorner: calculateCorner
  };

  function save() {
    try {
      var s = window.$("saveStatus");
      if (s) {
        s.className = "save-status saving";
        s.textContent = "💾 Saving...";
      }

      localStorage.setItem(
        window.STORAGE_KEY,
        JSON.stringify(window.state)
      );

      if (s) {
        s.className = "save-status saved";
        s.textContent = "🟢 Saved";
      }
    } catch (e) {
      var s2 = window.$("saveStatus");
      if (s2) {
        s2.className = "save-status failed";
        s2.textContent = "🔴 Save Failed";
      }
      if (window.Bugs) {
        window.Bugs.log("storage.save", e.message, e.stack);
      }
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        window.SETTINGS_KEY,
        JSON.stringify(window.settings)
      );
    } catch (e) {
      if (window.Bugs) {
        window.Bugs.log("storage.saveSettings", e.message, e.stack);
      }
    }
  }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(window.SETTINGS_KEY);
      if (!raw) return;

      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return;

      Object.keys(window.DEFAULT_SETTINGS).forEach(function(k) {
        if (data[k] !== undefined) {
          window.settings[k] = data[k];
        }
      });
    } catch (e) {
      if (window.Bugs) {
        window.Bugs.log("storage.loadSettings", e.message, e.stack);
      }
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(window.STORAGE_KEY);
      if (!raw) return;

      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return;

      window.state.keyword = data.keyword || "box";
      window.state.activeSide =
        data.activeSide === "dep" ? "dep" : "len";
      window.state.lenLines =
        Array.isArray(data.lenLines) ? data.lenLines : [];
      window.state.depLines =
        Array.isArray(data.depLines) ? data.depLines : [];

      [window.state.lenLines, window.state.depLines].forEach(
        function(lines) {
          lines.forEach(function(l) {
            l.size = window.round16(Number(l.size) || 0);
            l.bend = l.bend === "down" ? "down" : "up";
            l.angle = window.ANGLES.indexOf(Number(l.angle)) >= 0
              ? Number(l.angle)
              : 90;
          });
        }
      );

      if (window.$("keyword")) {
        window.$("keyword").value = window.state.keyword;
      }
    } catch (e) {
      if (window.Bugs) {
        window.Bugs.log("storage.load", e.message, e.stack);
      }
    }
  }

  window.Storage = {
    save: save,
    saveSettings: saveSettings,
    loadSettings: loadSettings,
    load: load
  };

})();
