/* =========================================================
   RESULT — MASTER GEOMETRY V5
   Result Tab / Size / Bend / Cup Cut / Summary

   FIX V5:
   - GeometryEngine.analyze() ko state pass kiya
   - Ab Settings + Lines dono calculation mein use honge
   ========================================================= */

(function () {
  "use strict";

  /* =========================================================
     HELPERS
     ========================================================= */

  function getEl(id) {
    return document.getElementById(id);
  }

  function num(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function text(value, fallback) {
    if (value === undefined || value === null || value === "") {
      return fallback || "";
    }
    return String(value);
  }

  function formatNumber(value) {
    var n = num(value, 0);
    if (Math.abs(n - Math.round(n)) < 0.0001) {
      return String(Math.round(n));
    }
    return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }

  function formatInch(value) {
    var n = num(value, 0);
    if (window.Core && typeof window.Core.formatInch === "function") {
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

  /* =========================================================
     MASTER DATA — FIX V5
     ========================================================= */

  function getMasterData() {
    if (!window.GeometryEngine) {
      console.error("❌ GeometryEngine not found.");
      return null;
    }

    try {
      var state = window.AppState || window.state || {};
      return window.GeometryEngine.analyze(state);
    } catch (err) {
      console.error("❌ Result GeometryEngine error:", err);
      if (window.Bugs) {
        try {
          window.Bugs.log("result.geometry", err.message, err.stack);
        } catch (bugErr) {}
      }
      return null;
    }
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {
    render();
  }

  /* =========================================================
     RENDER
     ========================================================= */

  function render() {
    var data = getMasterData();

    if (!data) {
      showEmpty("Geometry data available nahi hai.");
      return;
    }

    renderMath(data);
    renderLines(data);
    renderSummary(data);
  }

  /* =========================================================
     MATH RESULT
     ========================================================= */

  function renderMath(data) {
    var el = getEl("math-result");
    if (!el) return;

    var settings = data.settings || {};
    var totals = data.totals || {};
    var sheet = data.sheet || {};
    var cuts = Array.isArray(data.cuts) ? data.cuts : [];
    var sequence = Array.isArray(data.sequence) ? data.sequence : [];

    var html = "";
    html += '<div class="result-card">';
    html += '<div class="result-title">📐 MASTER CALCULATION</div>';

    html += '<div class="result-row">' +
      '<span>Sheet</span>' +
      '<strong>' +
      escapeHTML(formatInch(sheet.widthIn || sheet.width || 0)) +
      ' × ' +
      escapeHTML(formatInch(sheet.heightIn || sheet.height || 0)) +
      '</strong></div>';

    html += '<div class="result-row">' +
      '<span>Material</span>' +
      '<strong>' + escapeHTML(settings.material || "SS304") + '</strong></div>';

    html += '<div class="result-row">' +
      '<span>Thickness</span>' +
      '<strong>' + formatNumber(settings.thickness || 0) + ' mm</strong></div>';

    html += '<div class="result-row">' +
      '<span>V-Die</span>' +
      '<strong>' + formatNumber(settings.vdie || 0) + ' mm</strong></div>';

    html += '<div class="result-row">' +
      '<span>Radius</span>' +
      '<strong>' + formatNumber(settings.radius || 0) + ' mm</strong></div>';

    html += '<div class="result-row">' +
      '<span>K-Factor</span>' +
      '<strong>' + formatNumber(settings.kfactor || 0) + '</strong></div>';

    html += '<div class="result-row">' +
      '<span>Bend Count</span>' +
      '<strong>' + sequence.length + '</strong></div>';

    html += '<div class="result-row">' +
      '<span>Cup Cuts</span>' +
      '<strong>' + cuts.length + '</strong></div>';

    if (totals && (totals.length !== undefined || totals.lengthInch !== undefined)) {
      html += '<div class="result-row">' +
        '<span>Length Total</span>' +
        '<strong>' + formatInch(
          totals.lengthInch !== undefined ? totals.lengthInch : totals.length
        ) + '</strong></div>';
    }

    if (totals && (totals.depth !== undefined || totals.depthInch !== undefined)) {
      html += '<div class="result-row">' +
        '<span>Depth Total</span>' +
        '<strong>' + formatInch(
          totals.depthInch !== undefined ? totals.depthInch : totals.depth
        ) + '</strong></div>';
    }

    html += '</div>';
    el.innerHTML = html;
  }

  /* =========================================================
     LINE RESULT
     ========================================================= */

  function renderLines(data) {
    var el = getEl("result-list");
    if (!el) return;

    var lengthLines = Array.isArray(data.lengthLines) ? data.lengthLines : [];
    var depthLines = Array.isArray(data.depthLines) ? data.depthLines : [];
    var cuts = Array.isArray(data.cuts) ? data.cuts : [];

    var html = "";

    html += '<div class="result-section">';
    html += '<div class="result-section-title">📏 LENGTH LINES</div>';

    if (!lengthLines.length) {
      html += '<div class="result-empty">No Length lines</div>';
    } else {
      for (var i = 0; i < lengthLines.length; i++) {
        html += lineCard(lengthLines[i], "L");
      }
    }
    html += '</div>';

    html += '<div class="result-section">';
    html += '<div class="result-section-title">📐 DEPTH LINES</div>';

    if (!depthLines.length) {
      html += '<div class="result-empty">No Depth lines</div>';
    } else {
      for (var j = 0; j < depthLines.length; j++) {
        html += lineCard(depthLines[j], "D");
      }
    }
    html += '</div>';

    html += '<div class="result-section">';
    html += '<div class="result-section-title">✂️ CUP CUT / NOTCH</div>';

    if (!cuts.length) {
      html += '<div class="result-empty success">No cup cut required</div>';
    } else {
      for (var k = 0; k < cuts.length; k++) {
        html += cutCard(cuts[k], k + 1);
      }
    }
    html += '</div>';

    el.innerHTML = html;
  }

  /* =========================================================
     LINE CARD
     ========================================================= */

  function lineCard(line, fallbackPrefix) {
    var id = line.id || fallbackPrefix + String(num(line.index, 0) + 1);
    var size = num(line.sizeInch, num(line.size, 0));
    var angle = num(line.angle, num(line.angleDeg, 0));
    var effectiveAngle = num(
      line.effectiveAngleDeg,
      num(line.effectiveAngle, angle)
    );
    var direction = String(line.direction || "UP").toUpperCase();
    var sequence = line.sequence !== undefined ? line.sequence : "-";
    var ba = num(line.bendAllowance, num(line.BA, 0));
    var bd = num(line.bendDeduction, num(line.BD, 0));

    var html = "";
    html += '<div class="result-line-card">';
    html += '<div class="result-line-head">';
    html += '<strong>' + escapeHTML(id) + '</strong>';
    html += '<span class="result-size">' + escapeHTML(formatInch(size)) + '</span>';
    html += '</div>';

    html += '<div class="result-line-grid">';
    html += '<div><small>ANGLE</small><b>' + formatNumber(angle) + '°</b></div>';
    html += '<div><small>EFFECTIVE</small><b>' + formatNumber(effectiveAngle) + '°</b></div>';
    html += '<div><small>DIRECTION</small><b class="' +
      (direction === "DOWN" ? "down" : "up") +
      '">' + escapeHTML(direction) + '</b></div>';
    html += '<div><small>SEQ</small><b>' + escapeHTML(sequence) + '</b></div>';
    html += '<div><small>BA</small><b>' + formatNumber(ba) + ' mm</b></div>';
    html += '<div><small>BD</small><b>' + formatNumber(bd) + ' mm</b></div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  /* =========================================================
     CUT CARD
     ========================================================= */

  function cutCard(cut, number) {
    var id = cut.id || "CUT-" + number;
    var pos = cut.position || {};

    var x = num(pos.x, num(cut.x, 0));
    var y = num(pos.y, num(cut.y, 0));
    var w = num(cut.widthIn, num(cut.width, 0));
    var d = num(cut.depthIn, num(cut.depth, 0));
    var reason = cut.reason || cut.orientation || "";

    var html = "";
    html += '<div class="result-cut-card">';
    html += '<div class="result-line-head">';
    html += '<strong>' + escapeHTML(id) + '</strong>';
    html += '<span class="result-size">' + escapeHTML(formatInch(w)) + ' × ' +
      escapeHTML(formatInch(d)) + '</span>';
    html += '</div>';

    html += '<div class="result-line-grid">';
    html += '<div><small>X</small><b>' + formatNumber(x) + '"</b></div>';
    html += '<div><small>Y</small><b>' + formatNumber(y) + '"</b></div>';
    html += '<div><small>WIDTH</small><b>' + formatNumber(w) + '"</b></div>';
    html += '<div><small>DEPTH</small><b>' + formatNumber(d) + '"</b></div>';
    html += '</div>';

    if (reason) {
      html += '<div class="result-reason">' + escapeHTML(reason) + '</div>';
    }

    html += '</div>';
    return html;
  }

  /* =========================================================
     SUMMARY
     ========================================================= */

  function renderSummary(data) {
    var totals = data.totals || {};
    var settings = data.settings || {};

    setText("sum-len", formatInch(totals.lengthInch !== undefined ? totals.lengthInch : totals.length));
    setText("sum-dep", formatInch(totals.depthInch !== undefined ? totals.depthInch : totals.depth));
    setText("sum-len-lines", totals.lengthLines !== undefined ? totals.lengthLines : "-");
    setText("sum-dep-lines", totals.depthLines !== undefined ? totals.depthLines : "-");
    setText("sum-corners", totals.corners !== undefined ? totals.corners : "-");
    setText("sum-material", settings.material || "-");
    setText("sum-thick", settings.thickness !== undefined ? settings.thickness + " mm" : "-");
    setText("sum-vdie", settings.vdie !== undefined ? settings.vdie + " mm" : "-");
    setText("sum-radius", settings.radius !== undefined ? settings.radius + " mm" : "-");
    setText("sum-kfactor", settings.kfactor !== undefined ? settings.kfactor : "-");
  }

  function setText(id, value) {
    var el = getEl(id);
    if (el) el.textContent = value;
  }

  /* =========================================================
     EMPTY
     ========================================================= */

  function showEmpty(message) {
    var mathEl = getEl("math-result");
    if (mathEl) {
      mathEl.innerHTML = '<div class="empty-hint">' + escapeHTML(message) + '</div>';
    }

    var listEl = getEl("result-list");
    if (listEl) {
      listEl.innerHTML = '<div class="empty-hint">' + escapeHTML(message) + '</div>';
    }
  }

  /* =========================================================
     EXPOSE
     ========================================================= */

  window.Result = {
    init: init,
    render: render
  };

})();
