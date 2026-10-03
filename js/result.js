/* =========================================================
   RESULT — Sirf GeometryEngine ka result dikhata hai
   Koi apna hisaab nahi. Sirf display.
   ========================================================= */

(function () {
  "use strict";

  function getEl(id) {
    return document.getElementById(id);
  }

  function fmtInch(v) {
    if (typeof v !== "number" || !isFinite(v)) return "—";
    if (typeof window.formatInch === "function") {
      return window.formatInch(v);
    }
    return v.toFixed(3) + '"';
  }

  function fmt2(v) {
    if (typeof v !== "number" || !isFinite(v)) return "—";
    return v.toFixed(2);
  }

  /* ---------------------------------------------------------
     MAIN RENDER
     --------------------------------------------------------- */

  function render() {
    var data = null;

    if (window.GeometryEngine && typeof window.GeometryEngine.analyze === "function") {
      try {
        data = window.GeometryEngine.analyze();
      } catch (e) {
        data = null;
      }
    }

    renderMath(data);
    renderGeometry(data);
    renderCorners(data);
    renderSummary(data);
  }

  /* ---------------------------------------------------------
     1. SIZE TOTALS (Math)
     --------------------------------------------------------- */

  function renderMath(data) {
    var container = getEl("math-result");
    if (!container) return;

    if (!data || !data.input) {
      container.innerHTML = '<div class="empty-hint">Size enter karo.</div>';
      return;
    }

    var lenLines = data.input.lengthLines || [];
    var depLines = data.input.depthLines || [];

    if (lenLines.length === 0 && depLines.length === 0) {
      container.innerHTML = '<div class="empty-hint">Size enter karo.</div>';
      return;
    }

    container.innerHTML = "";

    if (lenLines.length) {
      var lenSum = 0;
      var lenExpr = [];
      lenLines.forEach(function (l) {
        var s = Number(l.sizeInch) || 0;
        lenSum += s;
        lenExpr.push(fmtInch(s));
      });

      var lenBox = document.createElement("div");
      lenBox.className = "result-box";
      lenBox.innerHTML =
        '<div class="corner-title">📏 Length</div>' +
        '<div class="math-expression">' + lenExpr.join(" + ") + '</div>' +
        '<div class="math-total">= ' + fmtInch(lenSum) + '</div>';
      container.appendChild(lenBox);
    }

    if (depLines.length) {
      var depSum = 0;
      var depExpr = [];
      depLines.forEach(function (l) {
        var s = Number(l.sizeInch) || 0;
        depSum += s;
        depExpr.push(fmtInch(s));
      });

      var depBox = document.createElement("div");
      depBox.className = "result-box";
      depBox.innerHTML =
        '<div class="corner-title">📐 Depth</div>' +
        '<div class="math-expression">' + depExpr.join(" + ") + '</div>' +
        '<div class="math-total">= ' + fmtInch(depSum) + '</div>';
      container.appendChild(depBox);
    }
  }

  /* ---------------------------------------------------------
     2. GEOMETRY SUMMARY
     --------------------------------------------------------- */

  function renderGeometry(data) {
    var container = getEl("geometry-result");
    if (!container) return;

    if (!data) {
      container.innerHTML = '<div class="empty-hint">Geometry Engine load nahi hua.</div>';
      return;
    }

    var s = data.statistics || {};

    container.innerHTML = "";

    var box = document.createElement("div");
    box.className = "result-box";
    box.innerHTML =
      '<div class="corner-title">⚙️ Connected Geometry</div>' +

      '<div class="result-row">' +
      '<span class="label">Length bends</span>' +
      '<span class="value">' + (s.totalLengthLines || 0) + '</span>' +
      '</div>' +

      '<div class="result-row">' +
      '<span class="label">Depth bends</span>' +
      '<span class="value">' + (s.totalDepthLines || 0) + '</span>' +
      '</div>' +

      '<div class="result-row">' +
      '<span class="label">Intersections checked</span>' +
      '<span class="value">' + (s.totalIntersections || 0) + '</span>' +
      '</div>' +

      '<div class="result-row">' +
      '<span class="label">Automatic cuts</span>' +
      '<span class="value red">' + (s.cutCount || 0) + '</span>' +
      '</div>' +

      '<div class="result-row">' +
      '<span class="label">No-cut corners</span>' +
      '<span class="value green">' + (s.noCutCount || 0) + '</span>' +
      '</div>';

    container.appendChild(box);
  }

  /* ---------------------------------------------------------
     3. CORNER CARDS (har intersection)
     --------------------------------------------------------- */

  function renderCorners(data) {
    var container = getEl("result-list");
    if (!container) return;

    container.innerHTML = "";

    if (!data || !data.intersections) {
      container.innerHTML = '<div class="empty-hint">Geometry Engine available nahi hai.</div>';
      return;
    }

    var intersections = data.intersections;
    if (!intersections.length) {
      container.innerHTML = '<div class="empty-hint">Length + Depth lines enter karo.</div>';
      return;
    }

    intersections.forEach(function (item) {
      container.appendChild(makeCornerCard(item));
    });
  }

  /* ---------------------------------------------------------
     CORNER CARD — poora pura data
     --------------------------------------------------------- */

  function makeCornerCard(item) {
    var box = document.createElement("div");
    box.className = "result-box";

    var lb = item.lengthBend || {};
    var db = item.depthBend || {};
    var inter = item.interaction || {};
    var cut = item.cut || { required: false };

    var cutClass = cut.required ? "red" : "green";
    var cutText = cut.required ? "AUTO CUT REQUIRED" : "NO CUT";

    var cutSize = "—";
    if (cut.required) {
      cutSize =
        fmtInch(cut.widthIn) + " × " + fmtInch(cut.depthIn) +
        " (" + fmt2(cut.widthMm) + " × " + fmt2(cut.depthMm) + " mm)";
    }

    var html = "";
    html += '<div class="corner-title">✂️ ' + (item.id || "—") + '</div>';

    html += row("Length Bend",
      (lb.angleDeg || "—") + "° " + (lb.direction || ""));
    html += row("Depth Bend",
      (db.angleDeg || "—") + "° " + (db.direction || ""));

    html += row("Length Sequence", lb.sequence || "—");
    html += row("Depth Sequence", db.sequence || "—");

    html += row("Length Size", fmtInch(lb.sizeInch));
    html += row("Depth Size", fmtInch(db.sizeInch));

    html += row("Length BD",
      fmt2(lb.bendDeduction && lb.bendDeduction.bendDeductionMm) + " mm");
    html += row("Depth BD",
      fmt2(db.bendDeduction && db.bendDeduction.bendDeductionMm) + " mm");

    html += row("Direction Relation", inter.directionRelation || "—");
    html += row("Direction Angle", fmt2(inter.directionAngleDeg) + "°");
    html += row("Movement", fmt2(inter.movementStrength));

    html += row("Interference",
      '<span class="' + cutClass + '">' +
      (item.interference ? "YES" : "NO") + '</span>');

    html += row("Automatic Cut",
      '<span class="' + cutClass + '">' + cutText + '</span>');

    html += row("Cut Size",
      '<span class="' + cutClass + '">' + cutSize + '</span>');

    box.innerHTML = html;
    return box;

    function row(label, value) {
      return '<div class="result-row">' +
        '<span class="label">' + label + '</span>' +
        '<span class="value">' + value + '</span>' +
        '</div>';
    }
  }

  /* ---------------------------------------------------------
     4. SUMMARY (left column ke saare values)
     --------------------------------------------------------- */

  function renderSummary(data) {
    var settings = window.settings || {};

    var lenLines = (data && data.input && data.input.lengthLines) || [];
    var depLines = (data && data.input && data.input.depthLines) || [];

    var lenSum = 0;
    lenLines.forEach(function (l) { lenSum += Number(l.sizeInch) || 0; });

    var depSum = 0;
    depLines.forEach(function (l) { depSum += Number(l.sizeInch) || 0; });

    setText("sum-len", lenLines.length ? fmtInch(lenSum) : "-");
    setText("sum-dep", depLines.length ? fmtInch(depSum) : "-");
    setText("sum-len-lines", lenLines.length);
    setText("sum-dep-lines", depLines.length);

    setText("sum-corners",
      Math.max(0, lenLines.length - 1) +
      Math.max(0, depLines.length - 1));

    setText("sum-material",
      settings.material === "SS304" ? "SS 304" : "SS 202");

    setText("sum-thick", (settings.thickness || 0) + " mm");
    setText("sum-vdie", (settings.vdie || 0) + " mm");
    setText("sum-radius", (settings.radius || 0) + " mm");
    setText("sum-kfactor", settings.kfactor || 0);
  }

  function setText(id, value) {
    var e = getEl(id);
    if (e) e.textContent = value;
  }

  /* ---------------------------------------------------------
     INIT
     --------------------------------------------------------- */

  function init() {
    render();
  }

  /* ---------------------------------------------------------
     EXPOSE
     --------------------------------------------------------- */

  window.Result = {
    init: init,
    render: render
  };

})();
