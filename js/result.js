/* =========================================================
   RESULT — MASTER GEOMETRY V4
   Result Tab / Size / Bend / Cup Cut / Summary

   IMPORTANT:
   - Engineering calculation yahan nahi hoti.
   - GeometryEngine.analyze() MASTER DATA hai.
   - Length + Depth dono ek project hain.
   - Result sirf calculated data ko display karta hai.
   ========================================================= */

(function () {
  "use strict";

  // =========================================================
  // HELPERS
  // =========================================================

  function getEl(id) {
    return document.getElementById(id);
  }

  function num(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function text(value, fallback) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return fallback || "";
    }

    return String(value);
  }

  function formatNumber(value) {
    var n = num(value, 0);

    if (Math.abs(n - Math.round(n)) < 0.0001) {
      return String(Math.round(n));
    }

    return n
      .toFixed(3)
      .replace(/0+$/, "")
      .replace(/\.$/, "");
  }

  function formatInch(value) {
    var n = num(value, 0);

    if (
      window.Core &&
      typeof window.Core.formatInch === "function"
    ) {
      return window.Core.formatInch(n);
    }

    return formatNumber(n) + '"';
  }

  function escapeHTML(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // =========================================================
  // MASTER DATA
  // =========================================================

  function getMasterData() {
    if (!window.GeometryEngine) {
      console.error(
        "❌ GeometryEngine not found."
      );

      return null;
    }

    try {
      return window.GeometryEngine.analyze();
    } catch (err) {
      console.error(
        "❌ Result GeometryEngine error:",
        err
      );

      if (window.Bugs) {
        try {
          window.Bugs.log(
            "result.geometry",
            err.message,
            err.stack
          );
        } catch (bugErr) {}
      }

      return null;
    }
  }

  // =========================================================
  // INIT
  // =========================================================

  function init() {
    render();
  }

  // =========================================================
  // RENDER
  // =========================================================

  function render() {
    var data = getMasterData();

    if (!data) {
      showEmpty(
        "Geometry data available nahi hai."
      );

      return;
    }

    renderMath(data);

    renderLines(data);

    renderSummary(data);
  }

  // =========================================================
  // MATH RESULT
  // =========================================================

  function renderMath(data) {
    var el =
      getEl("math-result");

    if (!el) return;

    var settings =
      data.settings || {};

    var totals =
      data.totals || {};

    var sheet =
      data.sheet || {};

    var cuts =
      Array.isArray(data.cuts)
        ? data.cuts
        : [];

    var sequence =
      Array.isArray(data.sequence)
        ? data.sequence
        : [];

    var html = "";

    html +=
      '<div class="result-card">';

    html +=
      '<div class="result-title">📐 MASTER CALCULATION</div>';

    html +=
      '<div class="result-row">' +
      '<span>Sheet</span>' +
      '<strong>' +
      escapeHTML(
        formatInch(
          sheet.widthIn ||
          sheet.width ||
          0
        )
      ) +
      ' × ' +
      escapeHTML(
        formatInch(
          sheet.heightIn ||
          sheet.height ||
          0
        )
      ) +
      '</strong>' +
      '</div>';

    html +=
      '<div class="result-row">' +
      '<span>Material</span>' +
      '<strong>' +
      escapeHTML(
        settings.material || "SS304"
      ) +
      '</strong>' +
      '</div>';

    html +=
      '<div class="result-row">' +
      '<span>Thickness</span>' +
      '<strong>' +
      formatNumber(
        settings.thickness || 0
      ) +
      ' mm</strong>' +
      '</div>';

    html +=
      '<div class="result-row">' +
      '<span>V-Die</span>' +
      '<strong>' +
      formatNumber(
        settings.vdie || 0
      ) +
      ' mm</strong>' +
      '</div>';

    html +=
      '<div class="result-row">' +
      '<span>Radius</span>' +
      '<strong>' +
      formatNumber(
        settings.radius || 0
      ) +
      ' mm</strong>' +
      '</div>';

    html +=
      '<div class="result-row">' +
      '<span>K-Factor</span>' +
      '<strong>' +
      formatNumber(
        settings.kfactor || 0
      ) +
      '</strong>' +
      '</div>';

    html +=
      '<div class="result-row">' +
      '<span>Bend Count</span>' +
      '<strong>' +
      sequence.length +
      '</strong>' +
      '</div>';

    html +=
      '<div class="result-row">' +
      '<span>Cup Cuts</span>' +
      '<strong>' +
      cuts.length +
      '</strong>' +
      '</div>';

    if (
      totals &&
      (
        totals.length !== undefined ||
        totals.lengthInch !== undefined
      )
    ) {
      html +=
        '<div class="result-row">' +
        '<span>Length Total</span>' +
        '<strong>' +
        formatInch(
          totals.lengthInch !== undefined
            ? totals.lengthInch
            : totals.length
        ) +
        '</strong>' +
        '</div>';
    }

    if (
      totals &&
      (
        totals.depth !== undefined ||
        totals.depthInch !== undefined
      )
    ) {
      html +=
        '<div class="result-row">' +
        '<span>Depth Total</span>' +
        '<strong>' +
        formatInch(
          totals.depthInch !== undefined
            ? totals.depthInch
            : totals.depth
        ) +
        '</strong>' +
        '</div>';
    }

    html +=
      '</div>';

    el.innerHTML = html;
  }

  // =========================================================
  // LINE RESULT
  // =========================================================

  function renderLines(data) {
    var el =
      getEl("result-list");

    if (!el) return;

    var lengthLines =
      Array.isArray(data.lengthLines)
        ? data.lengthLines
        : [];

    var depthLines =
      Array.isArray(data.depthLines)
        ? data.depthLines
        : [];

    var cuts =
      Array.isArray(data.cuts)
        ? data.cuts
        : [];

    var html = "";

    // -------------------------------------------------------
    // LENGTH
    // -------------------------------------------------------

    html +=
      '<div class="result-section">';

    html +=
      '<div class="result-section-title">' +
      '📏 LENGTH LINES' +
      '</div>';

    if (!lengthLines.length) {
      html +=
        '<div class="result-empty">' +
        'No Length lines' +
        '</div>';
    } else {
      for (
        var i = 0;
        i < lengthLines.length;
        i++
      ) {
        html +=
          lineCard(
            lengthLines[i],
            "L"
          );
      }
    }

    html +=
      '</div>';

    // -------------------------------------------------------
    // DEPTH
    // -------------------------------------------------------

    html +=
      '<div class="result-section">';

    html +=
      '<div class="result-section-title">' +
      '📐 DEPTH LINES' +
      '</div>';

    if (!depthLines.length) {
      html +=
        '<div class="result-empty">' +
        'No Depth lines' +
        '</div>';
    } else {
      for (
        var j = 0;
        j < depthLines.length;
        j++
      ) {
        html +=
          lineCard(
            depthLines[j],
            "D"
          );
      }
    }

    html +=
      '</div>';

    // -------------------------------------------------------
    // CUP CUT SUMMARY
    // -------------------------------------------------------

    html +=
      '<div class="result-section">';

    html +=
      '<div class="result-section-title">' +
      '✂️ CUP CUT / NOTCH' +
      '</div>';

    if (!cuts.length) {
      html +=
        '<div class="result-empty success">' +
        'No cup cut required' +
        '</div>';
    } else {
      for (
        var k = 0;
        k < cuts.length;
        k++
      ) {
        html +=
          cutCard(
            cuts[k],
            k + 1
          );
      }
    }

    html +=
      '</div>';

    el.innerHTML = html;
  }

  // =========================================================
  // LINE CARD
  // =========================================================

  function lineCard(
    line,
    fallbackPrefix
  ) {
    var id =
      line.id ||
      fallbackPrefix +
      String(
        num(line.index, 0) + 1
      );

    var size =
      num(
        line.sizeInch,
        num(
          line.size,
          0
        )
      );

    var angle =
      num(
        line.angle,
        num(
          line.angleDeg,
          0
        )
      );

    var effectiveAngle =
      num(
        line.effectiveAngleDeg,
        num(
          line.effectiveAngle,
          angle
        )
      );

    var direction =
      String(
        line.direction ||
        "UP"
      ).toUpperCase();

    var sequence =
      line.sequence !== undefined
        ? line.sequence
        : "-";

    var ba =
      num(
        line.bendAllowance,
        num(
          line.BA,
          0
        )
      );

    var bd =
      num(
        line.bendDeduction,
        num(
          line.BD,
          0
        )
      );

    var html = "";

    html +=
      '<div class="result-line-card">';

    html +=
      '<div class="result-line-head">';

    html +=
      '<strong>' +
      escapeHTML(id) +
      '</strong>';

    html +=
      '<span class="result-size">' +
      escapeHTML(
        formatInch(size)
      ) +
      '</span>';

    html +=
      '</div>';

    html +=
      '<div class="result-line-grid">';

    html +=
      '<div>' +
      '<small>ANGLE</small>' +
      '<b>' +
      formatNumber(angle) +
      '°' +
      '</b>' +
      '</div>';

    html +=
      '<div>' +
      '<small>EFFECTIVE</small>' +
      '<b>' +
      formatNumber(
        effectiveAngle
      ) +
      '°' +
      '</b>' +
      '</div>';

    html +=
      '<div>' +
      '<small>DIRECTION</small>' +
      '<b class="' +
      (
        direction === "DOWN"
          ? "down"
          : "up"
      ) +
      '">' +
      escapeHTML(
        direction
      ) +
      '</b>' +
      '</div>';

    html +=
      '<div>' +
      '<small>SEQ</small>' +
      '<b>' +
      escapeHTML(
        sequence
      ) +
      '</b>' +
      '</div>';

    html +=
      '<div>' +
      '<small>BA</small>' +
      '<b>' +
      formatNumber(ba) +
      ' mm</b>' +
      '</div>';

    html +=
      '<div>' +
      '<small>BD</small>' +
      '<b>' +
      formatNumber(bd) +
      ' mm</b>' +
      '</div>';

    html +=
      '</div>';

    html +=
      '</div>';

    return html;
  }

  // =========================================================
  // CUT CARD
  // =========================================================

  function cutCard(
    cut,
    number
  ) {
    var id =
      cut.id ||
      "CUT-" +
      number;

    var pos =
      cut.position ||
      {};
