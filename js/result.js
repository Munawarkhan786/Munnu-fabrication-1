/* =========================================================
   RESULT.JS — MASTER RESULT DISPLAY V7
   ---------------------------------------------------------
   GeometryEngine = ONLY calculation source
   Result.js     = ONLY display layer

   Shows:
   1. Size Totals
   2. Bend List
   3. Cup Cut List
   4. Summary
   5. Settings / Material
   ========================================================= */

(function () {
  "use strict";

  /* =========================================================
     HELPERS
     ========================================================= */

  function $(id) {
    return document.getElementById(id);
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    return isFinite(n) ? n : (fallback || 0);
  }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function inch(v) {
    return num(v).toFixed(3).replace(/\.?0+$/, "");
  }

  function mm(v) {
    return num(v).toFixed(2).replace(/\.?0+$/, "");
  }

  function angle(v) {
    return num(v).toFixed(1).replace(/\.0$/, "");
  }

  function getState() {
    if (window.AppState) return window.AppState;
    if (window.state) return window.state;

    return {
      lenLines: [],
      depLines: []
    };
  }

  /* =========================================================
     GEOMETRY MASTER
     ========================================================= */

  function getMasterData() {
    if (
      !window.GeometryEngine ||
      typeof window.GeometryEngine.analyze !== "function"
    ) {
      return null;
    }

    try {
      return window.GeometryEngine.analyze(getState());
    } catch (err) {
      console.error("RESULT: GeometryEngine failed", err);
      return null;
    }
  }

  /* =========================================================
     GENERIC HTML SETTER
     ========================================================= */

  function setHTML(id, html) {
    var el = $(id);
    if (el) {
      el.innerHTML = html;
    }
  }

  function setText(id, text) {
    var el = $(id);
    if (el) {
      el.textContent = text;
    }
  }

  /* =========================================================
     SIZE TOTALS
     ========================================================= */

  function renderTotals(data) {
    var totals = data.totals || {};
    var sheet = data.sheet || {};

    var lengthIn = num(
      totals.length != null ? totals.length : sheet.widthInch
    );

    var depthIn = num(
      totals.depth != null ? totals.depth : sheet.heightInch
    );

    var lengthMM = num(
      totals.lengthMM != null
        ? totals.lengthMM
        : lengthIn * 25.4
    );

    var depthMM = num(
      totals.depthMM != null
        ? totals.depthMM
        : depthIn * 25.4
    );

    /*
      Existing UI may have any of these IDs.
      We safely update whichever exists.
    */

    setText("result-length", inch(lengthIn) + '"');
    setText("result-depth", inch(depthIn) + '"');

    setText("result-length-mm", mm(lengthMM) + " mm");
    setText("result-depth-mm", mm(depthMM) + " mm");

    setText("total-length", inch(lengthIn) + '"');
    setText("total-depth", inch(depthIn) + '"');

    setText("total-length-mm", mm(lengthMM) + " mm");
    setText("total-depth-mm", mm(depthMM) + " mm");

    setText("size-total-length", inch(lengthIn) + '"');
    setText("size-total-depth", inch(depthIn) + '"');
  }

  /* =========================================================
     SETTINGS
     ========================================================= */

  function renderSettings(data) {
    var s = data.settings || {};

    setText(
      "result-material",
      s.material || "—"
    );

    setText(
      "result-thickness",
      s.thickness != null
        ? mm(s.thickness) + " mm"
        : "—"
    );

    setText(
      "result-vdie",
      s.vdie != null
        ? mm(s.vdie) + " mm"
        : "—"
    );

    setText(
      "result-radius",
      s.radius != null
        ? mm(s.radius) + " mm"
        : "—"
    );

    setText(
      "result-kfactor",
      s.kfactor != null
        ? num(s.kfactor).toFixed(3)
        : "—"
    );

    setText(
      "result-springback",
      s.springback != null
        ? angle(s.springback) + "°"
        : "—"
    );

    setText(
      "result-relief",
      s.relief != null
        ? mm(s.relief) + " mm"
        : "—"
    );
  }

  /* =========================================================
     BEND LIST
     ========================================================= */

  function getSequence(data) {
    if (Array.isArray(data.sequence)) {
      return data.sequence;
    }

    var out = [];

    if (Array.isArray(data.lengthLines)) {
      out = out.concat(data.lengthLines);
    }

    if (Array.isArray(data.depthLines)) {
      out = out.concat(data.depthLines);
    }

    return out;
  }

  function renderBends(data) {
    var list = getSequence(data);

    var html = "";

    if (!list.length) {
      html =
        '<div class="result-empty">' +
        "No bend lines yet." +
        "</div>";

      setHTML("result-bends", html);
      setHTML("bend-list", html);
      setHTML("result-bend-list", html);
      return;
    }

    html += '<div class="result-table-wrap">';
    html += '<table class="result-table">';
    html += "<thead>";
    html += "<tr>";
    html += "<th>#</th>";
    html += "<th>ID</th>";
    html += "<th>Side</th>";
    html += "<th>Size</th>";
    html += "<th>Angle</th>";
    html += "<th>Dir</th>";
    html += "</tr>";
    html += "</thead>";
    html += "<tbody>";

    list.forEach(function (line, i) {
      var side =
        String(line.side || "").toLowerCase() === "depth"
          ? "DEPTH"
          : "LENGTH";

      var direction =
        String(
          line.direction ||
          line.bend ||
          ""
        ).toLowerCase();

      direction =
        direction === "down"
          ? "DOWN"
          : "UP";

      var sizeIn =
        line.sizeInch != null
          ? line.sizeInch
          : line.size;

      var a =
        line.angle != null
          ? line.angle
          : 0;

      html += "<tr>";

      html +=
        "<td>" +
        esc(i + 1) +
        "</td>";

      html +=
        "<td>" +
        esc(line.id || ("B" + (i + 1))) +
        "</td>";

      html +=
        "<td>" +
        esc(side) +
        "</td>";

      html +=
        "<td>" +
        inch(sizeIn) +
        '"';

      if (line.sizeMM != null) {
        html +=
          "<small> (" +
          mm(line.sizeMM) +
          " mm)</small>";
      }

      html += "</td>";

      html +=
        "<td>" +
        angle(a) +
        "°</td>";

      html +=
        "<td>" +
        esc(direction) +
        "</td>";

      html += "</tr>";
    });

    html += "</tbody>";
    html += "</table>";
    html += "</div>";

    setHTML("result-bends", html);
    setHTML("bend-list", html);
    setHTML("result-bend-list", html);
  }

  /* =========================================================
     CUP CUT LIST
     ========================================================= */

  function renderCuts(data) {
    var cuts = Array.isArray(data.cuts)
      ? data.cuts
      : [];

    var html = "";

    if (!cuts.length) {
      html =
        '<div class="result-empty result-no-cut">' +
        "✓ No cup cuts required." +
        "</div>";

      setHTML("result-cuts", html);
      setHTML("cup-cut-list", html);
      setHTML("result-cup-cuts", html);
      return;
    }

    html += '<div class="result-table-wrap">';
    html += '<table class="result-table cut-table">';
    html += "<thead>";
    html += "<tr>";
    html += "<th>#</th>";
    html += "<th>Cut ID</th>";
    html += "<th>Length</th>";
    html += "<th>Depth</th>";
    html += "<th>Size</th>";
    html += "<th>Reason</th>";
    html += "</tr>";
    html += "</thead>";
    html += "<tbody>";

    cuts.forEach(function (cut, i) {
      var w =
        cut.widthInch != null
          ? cut.widthInch
          : num(cut.widthMM) / 25.4;

      var d =
        cut.depthInch != null
          ? cut.depthInch
          : num(cut.depthMM) / 25.4;

      html += "<tr>";

      html +=
        "<td>" +
        esc(i + 1) +
        "</td>";

      html +=
        "<td>" +
        esc(cut.id || ("CUT_" + (i + 1))) +
        "</td>";

      html +=
        "<td>" +
        esc(cut.lengthId || "—") +
        "</td>";

      html +=
        "<td>" +
        esc(cut.depthId || "—") +
        "</td>";

      html +=
        "<td>" +
        inch(w) +
        '" × ' +
        inch(d) +
        '"' +
        "</td>";

      html +=
        "<td>" +
        esc(
          cut.reason ||
          cut.type ||
          "INTERFERENCE"
        ) +
        "</td>";

      html += "</tr>";
    });

    html += "</tbody>";
    html += "</table>";
    html += "</div>";

    setHTML("result-cuts", html);
    setHTML("cup-cut-list", html);
    setHTML("result-cup-cuts", html);
  }

  /* =========================================================
     SUMMARY
     ========================================================= */

  function renderSummary(data) {
    var t = data.totals || {};
    var summary = data.cutSummary || {};

    var bendCount = num(
      t.totalBends,
      (
        num(t.lengthLines) +
        num(t.depthLines)
      )
    );

    var lengthCount = num(
      t.lengthLines,
      Array.isArray(data.lengthLines)
        ? data.lengthLines.length
        : 0
    );

    var depthCount = num(
      t.depthLines,
      Array.isArray(data.depthLines)
        ? data.depthLines.length
        : 0
    );

    var cutCount = num(
      t.cupCuts,
      summary.count != null
        ? summary.count
        : (
          Array.isArray(data.cuts)
            ? data.cuts.length
            : 0
        )
    );

    var html = "";

    html += '<div class="result-summary-grid">';

    html +=
      '<div class="summary-card">' +
      "<strong>" +
      bendCount +
      "</strong>" +
      "<span>Total Bends</span>" +
      "</div>";

    html +=
      '<div class="summary-card">' +
      "<strong>" +
      lengthCount +
      "</strong>" +
      "<span>Length Lines</span>" +
      "</div>";

    html +=
      '<div class="summary-card">' +
      "<strong>" +
      depthCount +
      "</strong>" +
      "<span>Depth Lines</span>" +
      "</div>";

    html +=
      '<div class="summary-card">' +
      "<strong>" +
      cutCount +
      "</strong>" +
      "<span>Cup Cuts</span>" +
      "</div>";

    html += "</div>";

    setHTML("result-summary", html);
    setHTML("summary-box", html);
  }

  /* =========================================================
     MASTER STATUS
     ========================================================= */

  function renderStatus(data) {
    var cuts = Array.isArray(data.cuts)
      ? data.cuts.length
      : 0;

    var bends = data.totals
      ? num(data.totals.totalBends)
      : 0;

    var text =
      "MASTER RESULT READY • " +
      bends +
      " BENDS • " +
      cuts +
      " CUP CUTS";

    setText("result-status", text);
    setText("master-result-status", text);
  }

  /* =========================================================
     FULL RENDER
     ========================================================= */

  function render() {
    var data = getMasterData();

    if (!data) {
      setText(
        "result-status",
        "Geometry Engine not available"
      );

      setHTML(
        "result-bends",
        '<div class="result-empty">Geometry Engine unavailable.</div>'
      );

      setHTML(
        "result-cuts",
        '<div class="result-empty">Geometry Engine unavailable.</div>'
      );

      return null;
    }

    renderTotals(data);
    renderSettings(data);
    renderBends(data);
    renderCuts(data);
    renderSummary(data);
    renderStatus(data);

    return data;
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {
    render();
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.Result = {
    init: init,
    render: render,
    getMasterData: getMasterData
  };

  /*
    Compatibility alias
  */
  window.ResultView = window.Result;

})();
