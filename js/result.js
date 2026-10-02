/* =========================================================
   RESULT — Calculations display
   ========================================================= */

(function() {
  "use strict";

  function getEl(id) { return document.getElementById(id); }
  function getState() { return window.state; }

  /* ---------- MAIN RENDER ---------- */

  function render() {
    renderMath();
    renderCorners();
    renderSummary();
  }

  /* ---------- MATH DISPLAY ---------- */

  function renderMath() {
    var container = getEl("math-result");
    if (!container) return;

    var lenSizes = getState().lenLines.map(function(l) { return l.size; });
    var depSizes = getState().depLines.map(function(l) { return l.size; });

    if (lenSizes.length === 0 && depSizes.length === 0) {
      container.innerHTML =
        '<div class="empty-hint">Size enter karo.</div>';
      return;
    }

    container.innerHTML = "";

    if (lenSizes.length) {
      var lenBox = document.createElement("div");
      lenBox.className = "result-box";
      var lenSum = lenSizes.reduce(function(a, b) { return a + b; }, 0);
      lenBox.innerHTML =
        '<div class="corner-title">📏 Length</div>' +
        '<div class="math-expression">' +
          lenSizes.map(window.formatInch).join(" + ") +
        '</div>' +
        '<div class="math-total">= ' +
          window.formatInch(lenSum) +
        '</div>';
      container.appendChild(lenBox);
    }

    if (depSizes.length) {
      var depBox = document.createElement("div");
      depBox.className = "result-box";
      var depSum = depSizes.reduce(function(a, b) { return a + b; }, 0);
      depBox.innerHTML =
        '<div class="corner-title">📐 Depth</div>' +
        '<div class="math-expression">' +
          depSizes.map(window.formatInch).join(" + ") +
        '</div>' +
        '<div class="math-total">= ' +
          window.formatInch(depSum) +
        '</div>';
      container.appendChild(depBox);
    }
  }

  /* ---------- CORNER CARDS ---------- */

  function renderCorners() {
    var container = getEl("result-list");
    if (!container) return;

    container.innerHTML = "";
    var count = 0;

    /* Length corners */
    for (var i = 0; i < getState().lenLines.length - 1; i++) {
      var A = getState().lenLines[i];
      var B = getState().lenLines[i + 1];
      var calc = window.Formulas.calculateCorner(A.size, B.size, B.angle);
      container.appendChild(
        makeCornerCard("L" + (i + 1) + " – L" + (i + 2), A, B, calc)
      );
      count++;
    }

    /* Depth corners */
    for (var j = 0; j < getState().depLines.length - 1; j++) {
      var C = getState().depLines[j];
      var D = getState().depLines[j + 1];
      var calc2 = window.Formulas.calculateCorner(C.size, D.size, D.angle);
      container.appendChild(
        makeCornerCard("D" + (j + 1) + " – D" + (j + 2), C, D, calc2)
      );
      count++;
    }

    if (count === 0) {
      container.innerHTML =
        '<div class="empty-hint">2+ lines chahiye.</div>';
    }
  }

  function makeCornerCard(id, A, B, calc) {
    var box = document.createElement("div");
    box.className = "result-box";
    var reliefMm = (calc.relief).toFixed(2);
    var flatMm = (calc.flat * 25.4).toFixed(2);

    box.innerHTML =
      '<div class="corner-title">✂️ ' + id + '</div>' +
      '<div class="result-row"><span class="label">Side A</span>' +
        '<span class="value">' + window.formatInch(A.size) +
        ' (' + A.bend.toUpperCase() + ')</span></div>' +
      '<div class="result-row"><span class="label">Side B</span>' +
        '<span class="value">' + window.formatInch(B.size) +
        ' (' + B.bend.toUpperCase() + ')</span></div>' +
      '<div class="result-row"><span class="label">Bend Angle</span>' +
        '<span class="value">' + calc.angle + '°</span></div>' +
      '<div class="result-row"><span class="label">Effective (SB)</span>' +
        '<span class="value">' + calc.effectiveAngle.toFixed(2) +
        '°</span></div>' +
      '<div class="result-row"><span class="label">Bend Allowance</span>' +
        '<span class="value blue">' + calc.BA.toFixed(3) +
        ' mm</span></div>' +
      '<div class="result-row"><span class="label">Bend Deduction</span>' +
        '<span class="value red">' + calc.BD.toFixed(3) +
        ' mm</span></div>' +
      '<div class="result-row"><span class="label">Flat Length</span>' +
        '<span class="value green">' + window.formatInch(calc.flat) +
        ' (' + flatMm + ' mm)</span></div>' +
      '<div class="result-row"><span class="label">Corner Relief</span>' +
        '<span class="value green">' + reliefMm + ' mm</span></div>' +
      '<div class="status-check">⚠️ Formula: BA, BD standard. ' +
        'Workshop pe verify karo.</div>';
    return box;
  }

  /* ---------- SUMMARY ---------- */

  function renderSummary() {
    var lenSum = getState().lenLines.reduce(
      function(s, l) { return s + l.size; }, 0);
    var depSum = getState().depLines.reduce(
      function(s, l) { return s + l.size; }, 0);

    setText("sum-len", getState().lenLines.length
      ? window.formatInch(lenSum) : "-");
    setText("sum-dep", getState().depLines.length
      ? window.formatInch(depSum) : "-");
    setText("sum-len-lines", getState().lenLines.length);
    setText("sum-dep-lines", getState().depLines.length);
    setText("sum-corners",
      Math.max(0, getState().lenLines.length - 1) +
      Math.max(0, getState().depLines.length - 1));
    setText("sum-material",
      window.settings.material === "SS304" ? "SS 304" : "SS 202");
    setText("sum-thick", window.settings.thickness + " mm");
    setText("sum-vdie", window.settings.vdie + " mm");
    setText("sum-radius", window.settings.radius + " mm");
    setText("sum-kfactor", window.settings.kfactor);
  }

  function setText(id, v) {
    var e = getEl(id);
    if (e) e.textContent = v;
  }

  /* ---------- INIT ---------- */

  function init() {
    render();
  }

  /* ---------- EXPOSE ---------- */

  window.Result = {
    init: init,
    render: render
  };

})();
