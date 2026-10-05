/* =========================================================
   CORE.JS
   CORE ENGINE V5
   ---------------------------------------------------------
   RESPONSIBILITY:
   - Global state
   - Settings
   - Storage
   - Fractions
   - Common utilities
   - GeometryEngine compatibility
   ========================================================= */

(function () {

  "use strict";

  /* =========================================================
     STORAGE KEYS
     ========================================================= */

  window.STORAGE_KEY =
    "sheetMarking_v7";

  window.SETTINGS_KEY =
    "sheetMarking_settings_v2";


  /* =========================================================
     FRACTIONS
     ========================================================= */

  window.FRACTIONS = [
    0,
    1 / 16,
    2 / 16,
    3 / 16,
    4 / 16,
    5 / 16,
    6 / 16,
    7 / 16,
    8 / 16,
    9 / 16,
    10 / 16,
    11 / 16,
    12 / 16,
    13 / 16,
    14 / 16,
    15 / 16,
    16 / 16
  ];

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
    "15/16",
    "1"
  ];


  /* =========================================================
     GLOBAL CONSTANTS
     ========================================================= */

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

  window.ZOOM_MAX = 20;
  window.ZOOM_MIN = 0.2;

  window.MIN_SEGMENT_PX = 10;

  window.MATERIAL_K = {
    SS304: 0.44,
    SS202: 0.45
  };


  /* =========================================================
     DEFAULT SETTINGS
     ========================================================= */

  window.DEFAULT_SETTINGS = {

    material:
      "SS304",

    thickness:
      0.8,

    vdie:
      6.0,

    radius:
      0.8,

    kfactor:
      0.44,

    springback:
      0.5,

    relief:
      1.6
  };


  /* =========================================================
     MAIN APPLICATION STATE
     ========================================================= */

  /*
     IMPORTANT:

     From now on AppState is the main shared state.

     window.state remains as compatibility alias.

     This prevents:

       window.state
       AppState
       AppState.settings
       window.settings

     from becoming different data.

  */

  window.AppState = {

    keyword:
      "box",

    activeSide:
      "len",

    current:
      0,

    lenLines:
      [],

    depLines:
      [],

    editingLine:
      null,

    editMode:
      false,

    settings:
      JSON.parse(
        JSON.stringify(
          window.DEFAULT_SETTINGS
        )
      )
  };


  /* =========================================================
     COMPATIBILITY ALIASES
     ========================================================= */

  window.state =
    window.AppState;

  window.settings =
    window.AppState.settings;


  /* =========================================================
     VIEW STATE
     ========================================================= */

  window.view3d = {

    rotX:
      -25,

    rotY:
      35,

    dist:
      900,

    autoRotate:
      false,

    wireframe:
      false
  };


  window.flatView = {

    zoom:
      1,

    panX:
      0,

    panY:
      0
  };


  /* =========================================================
     CUT VISIBILITY
     ========================================================= */

  window.hiddenCuts = {};


  /*
     Compatibility:

     Older flat.js / 3d.js may check:

       window.view3d.hiddenCuts

     Keep the same object there.
  */

  window.view3d.hiddenCuts =
    window.hiddenCuts;


  /* =========================================================
     AUTO ADD TIMER
     ========================================================= */

  window.autoAddTimer =
    null;


  /* =========================================================
     BASIC HELPERS
     ========================================================= */

  function $(id) {

    return document.getElementById(id);
  }


  function round16(value) {

    var n =
      parseFloat(value);

    if (!Number.isFinite(n)) {
      return 0;
    }

    return Math.round(
      n * 16
    ) / 16;
  }


  function cleanNumber(
    value,
    fallback
  ) {

    var n =
      parseFloat(value);

    return Number.isFinite(n)
      ? n
      : (
          fallback != null
            ? fallback
            : 0
        );
  }


  function clampNumber(
    value,
    min,
    max
  ) {

    var n =
      cleanNumber(
        value,
        min
      );

    return Math.max(
      min,
      Math.min(
        max,
        n
      )
    );
  }


  function inchToMM(inch) {

    return cleanNumber(inch) *
      25.4;
  }


  function mmToInch(mm) {

    return cleanNumber(mm) /
      25.4;
  }


  function formatInch(value) {

    var n =
      cleanNumber(value);

    var whole =
      Math.floor(
        Math.abs(n)
      );

    var fraction =
      Math.round(
        (
          Math.abs(n) -
          whole
        ) * 16
      );

    if (fraction >= 16) {

      whole += 1;
      fraction = 0;
    }

    var sign =
      n < 0
        ? "-"
        : "";

    if (fraction === 0) {

      return sign +
        whole;
    }

    if (whole === 0) {

      return sign +
        fraction +
        "/16";
    }

    return sign +
      whole +
      " " +
      fraction +
      "/16";
  }


  function el(id) {

    return document.getElementById(id);
  }


  /* =========================================================
     SETTINGS NORMALIZER
     ========================================================= */

  function normalizeSettings(source) {

    source =
      source || {};

    var material =
      source.material === "SS202"
        ? "SS202"
        : "SS304";

    var thickness =
      clampNumber(
        source.thickness,
        0.1,
        10
      );

    var vdie =
      clampNumber(
        source.vdie != null
          ? source.vdie
          : source.vDie,
        0.1,
        100
      );

    var radius =
      clampNumber(
        source.radius,
        0,
        20
      );

    var kfactor =
      clampNumber(
        source.kfactor,
        0,
        1
      );

    var springback =
      clampNumber(
        source.springback,
        0,
        20
      );

    var relief =
      clampNumber(
        source.relief,
        0,
        50
      );

    /*
       If K-factor is missing/invalid,
       use material default.
    */

    if (
      source.kfactor == null ||
      !Number.isFinite(
        parseFloat(
          source.kfactor
        )
      )
    ) {

      kfactor =
        window.MATERIAL_K[
          material
        ] || 0.44;
    }

    return {

      material:
        material,

      thickness:
        thickness,

      vdie:
        vdie,

      radius:
        radius,

      kfactor:
        kfactor,

      springback:
        springback,

      relief:
        relief
    };
  }


  /* =========================================================
     SETTINGS SYNC
     ========================================================= */

  function syncSettings(
    source
  ) {

    var normalized =
      normalizeSettings(
        source
      );

    /*
       One object becomes the
       single settings source.
    */

    window.AppState.settings =
      normalized;

    window.settings =
      window.AppState.settings;

    window.state.settings =
      window.AppState.settings;

    return (
      window.AppState.settings
    );
  }


  /* =========================================================
     BEND FORMULAS
     ========================================================= */

  function bendAllowance(
    thetaDeg,
    radius,
    kfactor,
    thickness
  ) {

    var theta =
      thetaDeg *
      Math.PI /
      180;

    var neutralRadius =
      radius +
      (
        kfactor *
        thickness
      );

    return (
      theta *
      neutralRadius
    );
  }


  function bendDeduction(
    thetaDeg,
    radius,
    kfactor,
    thickness
  ) {

    var theta =
      thetaDeg *
      Math.PI /
      180;

    var ba =
      bendAllowance(
        thetaDeg,
        radius,
        kfactor,
        thickness
      );

    var setback =
      (
        radius +
        thickness
      ) *
      Math.tan(
        theta / 2
      );

    return (
      2 * setback
    ) - ba;
  }


  function cornerRelief(
    radius,
    thickness
  ) {

    var settings =
      window.AppState.settings;

    if (
      settings &&
      settings.relief > 0
    ) {

      return settings.relief;
    }

    return (
      radius +
      thickness +
      0.5
    );
  }


  function calculateCorner(
    A,
    B,
    angle
  ) {

    var settings =
      window.AppState.settings;

    var radius =
      cleanNumber(
        settings.radius,
        0.8
      );

    var thickness =
      cleanNumber(
        settings.thickness,
        0.8
      );

    var kfactor =
      cleanNumber(
        settings.kfactor,
        0.44
      );

    var springback =
      cleanNumber(
        settings.springback,
        0.5
      );

    var effectiveAngle =
      clampNumber(
        angle - springback,
        0,
        180
      );

    var ba =
      bendAllowance(
        effectiveAngle,
        radius,
        kfactor,
        thickness
      );

    var bd =
      bendDeduction(
        effectiveAngle,
        radius,
        kfactor,
        thickness
      );

    return {

      A:
        cleanNumber(A),

      B:
        cleanNumber(B),

      angle:
        cleanNumber(angle),

      effectiveAngle:
        effectiveAngle,

      radius:
        radius,

      thickness:
        thickness,

      kfactor:
        kfactor,

      springback:
        springback,

      bendAllowanceMM:
        ba,

      bendDeductionMM:
        bd,

      reliefMM:
        cornerRelief(
          radius,
          thickness
        )
    };
  }


  /* =========================================================
     FORMULAS API
     ========================================================= */

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


  /* =========================================================
     STORAGE
     ========================================================= */

  function save() {

    try {

      /*
         Always sync aliases before saving.
      */

      window.AppState =
        window.AppState ||
        window.state ||
        {};

      window.state =
        window.AppState;

      window.AppState.settings =
        normalizeSettings(
          window.AppState.settings ||
          window.settings ||
          window.DEFAULT_SETTINGS
        );

      window.settings =
        window.AppState.settings;

      localStorage.setItem(
        window.STORAGE_KEY,
        JSON.stringify(
          window.AppState
        )
      );

      return true;

    } catch (err) {

      console.error(
        "Core save failed:",
        err
      );

      return false;
    }
  }


  function saveSettings(
    settings
  ) {

    try {

      var normalized =
        normalizeSettings(
          settings ||
          window.AppState.settings
        );

      syncSettings(
        normalized
      );

      /*
         Save complete settings separately.
      */

      localStorage.setItem(
        window.SETTINGS_KEY,
        JSON.stringify(
          normalized
        )
      );

      /*
         Also save inside AppState.
      */

      save();

      return true;

    } catch (err) {

      console.error(
        "Core saveSettings failed:",
        err
      );

      return false;
    }
  }


  /* =========================================================
     LOAD SETTINGS
     ========================================================= */

  function loadSettings() {

    var loaded =
      null;

    try {

      var raw =
        localStorage.getItem(
          window.SETTINGS_KEY
        );

      if (raw) {

        loaded =
          JSON.parse(raw);
      }

    } catch (err) {

      console.warn(
        "Settings load error:",
        err
      );
    }

    if (!loaded) {

      loaded =
        window.AppState.settings ||
        window.settings ||
        window.DEFAULT_SETTINGS;
    }

    return syncSettings(
      loaded
    );
  }


  /* =========================================================
     LOAD MAIN STATE
     ========================================================= */

  function load() {

    var loaded =
      null;

    try {

      var raw =
        localStorage.getItem(
          window.STORAGE_KEY
        );

      if (raw) {

        loaded =
          JSON.parse(raw);
      }

    } catch (err) {

      console.warn(
        "State load error:",
        err
      );
    }


    if (
      loaded &&
      typeof loaded === "object"
    ) {

      /*
         Preserve only valid application state.
      */

      window.AppState.keyword =
        loaded.keyword != null
          ? String(
              loaded.keyword
            )
          : "box";

      window.AppState.activeSide =
        loaded.activeSide === "dep"
          ? "dep"
          : "len";

      window.AppState.current =
        cleanNumber(
          loaded.current,
          0
        );

      window.AppState.lenLines =
        Array.isArray(
          loaded.lenLines
        )
          ? loaded.lenLines
          : [];

      window.AppState.depLines =
        Array.isArray(
          loaded.depLines
        )
          ? loaded.depLines
          : [];

      window.AppState.editingLine =
        loaded.editingLine != null
          ? loaded.editingLine
          : null;

      window.AppState.editMode =
        !!loaded.editMode;

      /*
         If old saved state contains settings,
         use them too.
      */

      if (
        loaded.settings &&
        typeof loaded.settings === "object"
      ) {

        syncSettings(
          loaded.settings
        );
      }
    }


    /*
       Re-establish aliases.
    */

    window.state =
      window.AppState;

    window.settings =
      window.AppState.settings;


    /*
       Update keyword field if present.
    */

    var keyword =
      $("project-keyword");

    if (!keyword) {

      keyword =
        $("keyword");
    }

    if (keyword) {

      keyword.value =
        window.AppState.keyword;
    }

    return (
      window.AppState
    );
  }


  /* =========================================================
     CLEAR STATE
     ========================================================= */

  function clearState() {

    window.AppState.keyword =
      "box";

    window.AppState.activeSide =
      "len";

    window.AppState.current =
      0;

    window.AppState.lenLines =
      [];

    window.AppState.depLines =
      [];

    window.AppState.editingLine =
      null;

    window.AppState.editMode =
      false;

    window.hiddenCuts =
      {};

    window.view3d.hiddenCuts =
      window.hiddenCuts;

    save();

    return true;
  }


  /* =========================================================
     PUBLIC STORAGE API
     ========================================================= */

  window.Storage = {

    save:
      save,

    saveSettings:
      saveSettings,

    load:
      load,

    loadSettings:
      loadSettings,

    clearState:
      clearState,

    syncSettings:
      syncSettings
  };


  /* =========================================================
     PUBLIC CORE API
     ========================================================= */

  window.Core = {

    $:
      $,

    el:
      el,

    round16:
      round16,

    cleanNumber:
      cleanNumber,

    clampNumber:
      clampNumber,

    inchToMM:
      inchToMM,

    mmToInch:
      mmToInch,

    formatInch:
      formatInch,

    normalizeSettings:
      normalizeSettings,

    syncSettings:
      syncSettings,

    save:
      save,

    load:
      load,

    saveSettings:
      saveSettings,

    loadSettings:
      loadSettings,

    clearState:
      clearState
  };


  /* =========================================================
     INITIAL SETTINGS SYNC
     ========================================================= */

  syncSettings(
    window.DEFAULT_SETTINGS
  );


  console.log(
    "Core V5 loaded — unified state/settings"
  );

})();
