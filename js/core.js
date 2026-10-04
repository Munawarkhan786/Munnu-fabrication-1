/* =========================================================
   CORE.JS — State + Settings + Storage + Basic Utilities
   ---------------------------------------------------------
   GEOMETRY ENGINE V4 is the MASTER engineering calculator.

   CORE does:
   1. App state
   2. Settings
   3. Fractions
   4. Storage
   5. Basic formatting/utilities

   CORE does NOT replace GeometryEngine calculations.
   ========================================================= */

(function () {
  "use strict";

  /* =======================================================
     STORAGE KEYS
     ======================================================= */

  window.STORAGE_KEY = "sheetMarking_v7";
  window.SETTINGS_KEY = "sheetMarking_settings_v2";


  /* =======================================================
     FRACTIONS
     ======================================================= */

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


  /* =======================================================
     FRACTION LABELS
     ======================================================= */

  window.FRAC_LABELS = [
    "",
    "1/16",
    "1/8",
    "3/16",
    "1/4",
    "5/16",
    "3/8",
    "7/16",
    "1/2",
    "9/16",
    "5/8",
    "11/16",
    "3/4",
    "13/16",
    "7/8",
    "15/16"
  ];


  /* =======================================================
     ANGLES
     -------------------------------------------------------
     UI can use these as common quick-select angles.

     GeometryEngine itself supports 0–180°.
     ======================================================= */

  window.ANGLES = [
    180,
    135,
    120,
    110,
    100,
    90,
    80,
    75,
    65,
    60,
    55,
    45,
    35,
    30,
    25,
    20,
    15,
    10,
    5,
    0
  ];


  /* =======================================================
     ZOOM
     ======================================================= */

  window.ZOOM_MAX = 20;
  window.ZOOM_MIN = 0.2;
  window.MIN_SEGMENT_PX = 10;


  /* =======================================================
     MATERIAL K-FACTOR
     ======================================================= */

  window.MATERIAL_K = {
    SS304: 0.44,
    SS202: 0.45
  };


  /* =======================================================
     DEFAULT SETTINGS
     ======================================================= */

  window.DEFAULT_SETTINGS = {
    material: "SS304",
    thickness: 0.8,
    vdie: 6.0,
    radius: 0.8,
    kfactor: 0.44,
    springback: 0.5,
    relief: 1.6
  };


  /* =======================================================
     APP STATE
     ======================================================= */

  window.state = {
    keyword: "box",

    activeSide: "len",

    current: 0,

    lenLines: [],

    depLines: [],

    editingLine: null,

    editMode: false
  };


  /* =======================================================
     3D VIEW STATE
     ======================================================= */

  window.view3d = {
    rotX: -25,
    rotY: 35,
    dist: 900,
    autoRotate: false,
    wireframe: false
  };


  /* =======================================================
     FLAT VIEW STATE
     ======================================================= */

  window.flatView = {
    zoom: 1,
    panX: 0,
    panY: 0
  };


  /* =======================================================
     SETTINGS
     ======================================================= */

  window.settings = JSON.parse(
    JSON.stringify(window.DEFAULT_SETTINGS)
  );


  /* =======================================================
     HIDDEN CUTS
     ======================================================= */

  window.hiddenCuts = {};


  /* =======================================================
     AUTO ADD TIMER
     ======================================================= */

  window.autoAddTimer = null;


  /* =======================================================
     DOM SHORTCUT
     ======================================================= */

  window.$ = function (id) {
    return document.getElementById(id);
  };


  /* =======================================================
     NUMBER HELPERS
     ======================================================= */

  window.round16 = function (value) {
    var n = Number(value);

    if (!Number.isFinite(n)) {
      return 0;
    }

    return Math.round(n * 16) / 16;
  };


  window.cleanNumber = function (value) {
    var n = Number(value);

    if (!Number.isFinite(n)) {
      return 0;
    }

    return Math.round(n * 1000000) / 1000000;
  };


  window.clampNumber = function (
    value,
    min,
    max,
    fallback
  ) {
    var n = Number(value);

    if (!Number.isFinite(n)) {
      n = Number(fallback);

      if (!Number.isFinite(n)) {
        n = min;
      }
    }

    return Math.max(
      min,
      Math.min(max, n)
    );
  };


  /* =======================================================
     INCH / MM
     ======================================================= */

  window.inchToMM = function (value) {
    return Number(value) * 25.4;
  };


  window.mmToInch = function (value) {
    return Number(value) / 25.4;
  };


  /* =======================================================
     FORMAT INCH
     -------------------------------------------------------
     Example:
       1.5  -> 1 1/2"
       0.25 -> 1/4"
     ======================================================= */

  window.formatInch = function (value) {
    var n = Number(value);

    if (!Number.isFinite(n)) {
      return "0";
    }

    n = window.round16(n);

    if (n === 0) {
      return "0";
    }

    var negative = n < 0;

    n = Math.abs(n);

    var whole = Math.floor(n);

    var fraction =
      Math.round(
        (n - whole) * 16
      );

    if (fraction >= 16) {
      whole += 1;
      fraction = 0;
    }

    var label =
      window.FRAC_LABELS[fraction] || "";

    var result = "";

    if (whole > 0) {
      result = String(whole);

      if (label) {
        result += " " + label;
      }
    } else {
      result = label || "0";
    }

    if (negative) {
      result = "-" + result;
    }

    return result + '"';
  };


  /* =======================================================
     GENERIC ELEMENT HELPER
     ======================================================= */

  window.el = function (
    tag,
    cls,
    text
  ) {
    var element =
      document.createElement(tag);

    if (cls) {
      element.className = cls;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  };


  /* =======================================================
     BASIC FORMULA COMPATIBILITY
     -------------------------------------------------------
     These are kept so older modules do not break.

     IMPORTANT:
     Final engineering calculation should come from
     GeometryEngine V4.
     ======================================================= */

  function bendAllowance(
    theta,
    R,
    K,
    T
  ) {
    var angle =
      Math.abs(Number(theta) || 0);

    var radius =
      Number(R) || 0;

    var k =
      Number(K) || 0;

    var thickness =
      Number(T) || 0;

    var radians =
      angle * Math.PI / 180;

    return (
      radians *
      (radius + k * thickness)
    );
  }


  function bendDeduction(
    theta,
    R,
    K,
    T
  ) {
    var angle =
      Math.abs(Number(theta) || 0);

    var radius =
      Number(R) || 0;

    var thickness =
      Number(T) || 0;

    var ba =
      bendAllowance(
        angle,
        radius,
        K,
        thickness
      );

    var setback =
      (radius + thickness) *
      Math.tan(
        angle * Math.PI / 360
      );

    return (
      2 * setback - ba
    );
  }


  function cornerRelief(
    R,
    T
  ) {
    var custom =
      Number(
        window.settings &&
        window.settings.relief
      );

    if (
      Number.isFinite(custom) &&
      custom > 0
    ) {
      return custom;
    }

    return window.cleanNumber(
      Number(R || 0) +
      Number(T || 0) +
      0.5
    );
  }


  function calculateCorner(
    A,
    B,
    angle
  ) {
    var R =
      Number(
        window.settings.radius
      ) || 0.8;

    var K =
      Number(
        window.settings.kfactor
      ) || 0.44;

    var T =
      Number(
        window.settings.thickness
      ) || 0.8;

    var springback =
      Number(
        window.settings.springback
      ) || 0;

    var intendedAngle =
      Number(angle);

    if (
      !Number.isFinite(
        intendedAngle
      )
    ) {
      intendedAngle = 90;
    }

    var effectiveAngle =
      Math.max(
        0,
        Math.min(
          180,
          intendedAngle -
          springback
        )
      );

    var BA =
      bendAllowance(
        effectiveAngle,
        R,
        K,
        T
      );

    var BD =
      bendDeduction(
        effectiveAngle,
        R,
        K,
        T
      );

    return {
      angle: intendedAngle,

      effectiveAngle:
        effectiveAngle,

      BA:
        window.cleanNumber(BA),

      BD:
        window.cleanNumber(BD),

      flat:
        window.cleanNumber(
          Number(A || 0) +
          Number(B || 0) -
          BD
        ),

      relief:
        cornerRelief(R, T)
    };
  }


  /* =======================================================
     FORMULAS API
     -------------------------------------------------------
     Compatibility only.
     GeometryEngine is master.
     ======================================================= */

  window.Formulas = {
    bendAllowance:
      bendAllowance,

    bendDeduction:
      bendDeduction,

    cornerRelief:
      cornerRelief,

    calculateCorner:
      calculateCorner
  };


  /* =======================================================
     NORMALIZE LINE
     -------------------------------------------------------
     Makes old/new saved lines compatible.
     ======================================================= */

  function normalizeLine(
    line,
    index,
    side
  ) {
    line = line || {};

    var size =
      Number(
        line.size !== undefined
          ? line.size
          : line.value
      );

    if (!Number.isFinite(size)) {
      size = 0;
    }

    var angle =
      Number(
        line.angle !== undefined
          ? line.angle
          : line.degree
      );

    if (!Number.isFinite(angle)) {
      angle = 90;
    }

    /*
      GeometryEngine supports 0–180.
    */
    angle =
      Math.max(
        0,
        Math.min(
          180,
          angle
        )
      );

    var bend =
      String(
        line.bend !== undefined
          ? line.bend
          : line.direction
      ).toLowerCase();

    bend =
      bend === "down"
        ? "down"
        : "up";

    return {
      id:
        line.id ||
        (
          side === "dep"
            ? "D"
            : "L"
        ) + (index + 1),

      size:
        window.round16(size),

      bend:
        bend,

      angle:
        angle
    };
  }


  /* =======================================================
     SAVE
     ======================================================= */

  function save() {
    try {
      var status =
        window.$("saveStatus");

      if (status) {
        status.className =
          "save-status saving";

        status.textContent =
          "💾 Saving...";
      }

      localStorage.setItem(
        window.STORAGE_KEY,
        JSON.stringify(
          window.state
        )
      );

      if (status) {
        status.className =
          "save-status saved";

        status.textContent =
          "🟢 Saved";
      }

    } catch (error) {

      var statusError =
        window.$("saveStatus");

      if (statusError) {
        statusError.className =
          "save-status failed";

        statusError.textContent =
          "🔴 Save Failed";
      }

      if (
        window.Bugs &&
        typeof window.Bugs.log === "function"
      ) {
        window.Bugs.log(
          "storage.save",
          error.message,
          error.stack
        );
      }
    }
  }


  /* =======================================================
     SAVE SETTINGS
     ======================================================= */

  function saveSettings() {
    try {

      localStorage.setItem(
        window.SETTINGS_KEY,
        JSON.stringify(
          window.settings
        )
      );

    } catch (error) {

      if (
        window.Bugs &&
        typeof window.Bugs.log === "function"
      ) {
        window.Bugs.log(
          "storage.saveSettings",
          error.message,
          error.stack
        );
      }
    }
  }


  /* =======================================================
     LOAD SETTINGS
     ======================================================= */

  function loadSettings() {
    try {

      var raw =
        localStorage.getItem(
          window.SETTINGS_KEY
        );

      if (!raw) {
        return;
      }

      var data =
        JSON.parse(raw);

      if (
        !data ||
        typeof data !== "object"
      ) {
        return;
      }

      Object.keys(
        window.DEFAULT_SETTINGS
      ).forEach(
        function (key) {

          if (
            data[key] !== undefined
          ) {
            window.settings[key] =
              data[key];
          }

        }
      );

      /*
        Safety normalization
      */

      if (
        window.settings.material !==
        "SS304" &&
        window.settings.material !==
        "SS202"
      ) {
        window.settings.material =
          "SS304";
      }

      window.settings.thickness =
        window.clampNumber(
          window.settings.thickness,
          0.1,
          10,
          0.8
        );

      window.settings.vdie =
        window.clampNumber(
          window.settings.vdie,
          0.1,
          100,
          6
        );

      window.settings.radius =
        window.clampNumber(
          window.settings.radius,
          0.1,
          50,
          0.8
        );

      window.settings.kfactor =
        window.clampNumber(
          window.settings.kfactor,
          0,
          1,
          0.44
        );

      window.settings.springback =
        window.clampNumber(
          window.settings.springback,
          0,
          30,
          0.5
        );

      window.settings.relief =
        window.clampNumber(
          window.settings.relief,
          0,
          50,
          1.6
        );

    } catch (error) {

      if (
        window.Bugs &&
        typeof window.Bugs.log === "function"
      ) {
        window.Bugs.log(
          "storage.loadSettings",
          error.message,
          error.stack
        );
      }
    }
  }


  /* =======================================================
     LOAD STATE
     ======================================================= */

  function load() {
    try {

      var raw =
        localStorage.getItem(
          window.STORAGE_KEY
        );

      if (!raw) {
        return;
      }

      var data =
        JSON.parse(raw);

      if (
        !data ||
        typeof data !== "object"
      ) {
        return;
      }

      window.state.keyword =
        data.keyword ||
        "box";

      window.state.activeSide =
        data.activeSide === "dep"
          ? "dep"
          : "len";

      window.state.lenLines =
        Array.isArray(
          data.lenLines
        )
          ? data.lenLines
          : [];

      window.state.depLines =
        Array.isArray(
          data.depLines
        )
          ? data.depLines
          : [];

      /*
        Normalize Length lines
      */

      window.state.lenLines =
        window.state.lenLines.map(
          function (line, index) {
            return normalizeLine(
              line,
              index,
              "len"
            );
          }
        );

      /*
        Normalize Depth lines
      */

      window.state.depLines =
        window.state.depLines.map(
          function (line, index) {
            return normalizeLine(
              line,
              index,
              "dep"
            );
          }
        );

      /*
        Update keyword input
      */

      var keywordInput =
        window.$("keyword");

      if (keywordInput) {
        keywordInput.value =
          window.state.keyword;
      }

    } catch (error) {

      if (
        window.Bugs &&
        typeof window.Bugs.log === "function"
      ) {
        window.Bugs.log(
          "storage.load",
          error.message,
          error.stack
        );
      }
    }
  }


  /* =======================================================
     CLEAR STATE
     ======================================================= */

  function clearState() {

    window.state.keyword =
      "box";

    window.state.activeSide =
      "len";

    window.state.current =
      0;

    window.state.lenLines =
      [];

    window.state.depLines =
      [];

    window.state.editingLine =
      null;

    window.state.editMode =
      false;

    window.hiddenCuts = {};

    save();
  }


  /* =======================================================
     STORAGE API
     ======================================================= */

  window.Storage = {

    save:
      save,

    saveSettings:
      saveSettings,

    loadSettings:
      loadSettings,

    load:
      load,

    clear:
      clearState
  };


  /* =======================================================
     CORE API
     ======================================================= */

  window.Core = {

    normalizeLine:
      normalizeLine,

    formatInch:
      window.formatInch,

    round16:
      window.round16,

    cleanNumber:
      window.cleanNumber,

    inchToMM:
      window.inchToMM,

    mmToInch:
      window.mmToInch,

    clampNumber:
      window.clampNumber
  };


  /* =======================================================
     STARTUP LOG
     ======================================================= */

  console.log(
    "✅ Core V4 compatible loaded"
  );

})();
