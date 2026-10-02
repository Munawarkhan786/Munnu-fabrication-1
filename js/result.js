/* =========================================================
   RESULT — Connected Geometry Calculations
   ========================================================= */

(function () {
  "use strict";

  function getEl(id) {
    return document.getElementById(id);
  }

  function getState() {
    return window.state;
  }

  /* ---------------------------------------------------------
     MAIN RENDER
     --------------------------------------------------------- */

  function render() {
    renderMath();
    renderGeometry();
    renderCorners();
    renderSummary();
  }

  /* ---------------------------------------------------------
     MATH DISPLAY
     --------------------------------------------------------- */

  function renderMath() {
    var container = getEl("math-result");

    if (!container) return;

    var lenSizes =
      getState().lenLines.map(function (l) {
        return l.size;
      });

    var depSizes =
      getState().depLines.map(function (l) {
        return l.size;
      });

    if (
      lenSizes.length === 0 &&
      depSizes.length === 0
    ) {
      container.innerHTML =
        '<div class="empty-hint">Size enter karo.</div>';

      return;
    }

    container.innerHTML = "";

    if (lenSizes.length) {
      var lenBox =
        document.createElement("div");

      lenBox.className =
        "result-box";

      var lenSum =
        lenSizes.reduce(
          function (a, b) {
            return a + b;
          },
          0
        );

      lenBox.innerHTML =
        '<div class="corner-title">📏 Length</div>' +
        '<div class="math-expression">' +
        lenSizes
          .map(window.formatInch)
          .join(" + ") +
        "</div>" +
        '<div class="math-total">= ' +
        window.formatInch(lenSum) +
        "</div>";

      container.appendChild(lenBox);
    }

    if (depSizes.length) {
      var depBox =
        document.createElement("div");

      depBox.className =
        "result-box";

      var depSum =
        depSizes.reduce(
          function (a, b) {
            return a + b;
          },
          0
        );

      depBox.innerHTML =
        '<div class="corner-title">📐 Depth</div>' +
        '<div class="math-expression">' +
        depSizes
          .map(window.formatInch)
          .join(" + ") +
        "</div>" +
        '<div class="math-total">= ' +
        window.formatInch(depSum) +
        "</div>";

      container.appendChild(depBox);
    }
  }

  /* ---------------------------------------------------------
     GEOMETRY SUMMARY
     --------------------------------------------------------- */

  function renderGeometry() {
    var container =
      getEl("geometry-result");

    /*
      Optional container.
      Existing HTML does not have to contain it.
    */
    if (!container) {
      return;
    }

    if (
      !window.GeometryEngine ||
      !window.GeometryEngine.analyze
    ) {
      container.innerHTML =
        '<div class="empty-hint">' +
        "Geometry Engine load nahi hua." +
        "</div>";

      return;
    }

    var data =
      window.GeometryEngine.analyze();

    container.innerHTML = "";

    var box =
      document.createElement("div");

    box.className =
      "result-box";

    var cutCount =
      data.statistics.cutCount;

    var noCutCount =
      data.statistics.noCutCount;

    box.innerHTML =
      '<div class="corner-title">' +
      "⚙️ Connected Geometry" +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">Length bends</span>' +
      '<span class="value">' +
      data.length.segments.length +
      "</span>" +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">Depth bends</span>' +
      '<span class="value">' +
      data.depth.segments.length +
      "</span>" +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">Intersections checked</span>' +
      '<span class="value">' +
      data.statistics.totalIntersections +
      "</span>" +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">Automatic cuts</span>' +
      '<span class="value red">' +
      cutCount +
      "</span>" +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">No-cut corners</span>' +
      '<span class="value green">' +
      noCutCount +
      "</span>" +
      "</div>";

    container.appendChild(box);
  }

  /* ---------------------------------------------------------
     CORNER / INTERSECTION CARDS
     --------------------------------------------------------- */

  function renderCorners() {
    var container =
      getEl("result-list");

    if (!container) return;

    container.innerHTML = "";

    if (
      !window.GeometryEngine ||
      !window.GeometryEngine.analyze
    ) {
      container.innerHTML =
        '<div class="empty-hint">' +
        "Geometry Engine available nahi hai." +
        "</div>";

      return;
    }

    var data =
      window.GeometryEngine.analyze();

    var intersections =
      data.intersections;

    if (!intersections.length) {
      container.innerHTML =
        '<div class="empty-hint">' +
        "Length + Depth lines enter karo." +
        "</div>";

      return;
    }

    intersections.forEach(
      function (item) {
        container.appendChild(
          makeIntersectionCard(item)
        );
      }
    );
  }

  /* ---------------------------------------------------------
     INTERSECTION CARD
     --------------------------------------------------------- */

  function makeIntersectionCard(item) {
    var box =
      document.createElement("div");

    box.className =
      "result-box";

    var cutClass =
      item.cut.required
        ? "red"
        : "green";

    var cutText =
      item.cut.required
        ? "AUTO CUT REQUIRED"
        : "NO CUT";

    var cutSize =
      item.cut.required
        ? window.formatInch(
            item.cut.sizeInch
          ) +
          " (" +
          item.cut.sizeMm.toFixed(2) +
          " mm)"
        : "—";

    box.innerHTML =
      '<div class="corner-title">' +
      "✂️ " +
      item.id +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">Length Bend</span>' +
      '<span class="value">' +
      item.lengthBend.angle +
      "° " +
      item.lengthBend.direction +
      "</span>" +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">Depth Bend</span>' +
      '<span class="value">' +
      item.depthBend.angle +
      "° " +
      item.depthBend.direction +
      "</span>" +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">Length Sequence</span>' +
      '<span class="value">' +
      item.lengthBend.sequence +
      "</span>" +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">Depth Sequence</span>' +
      '<span class="value">' +
      item.depthBend.sequence +
      "</span>" +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">Length Movement</span>' +
      '<span class="value">' +
      item.lengthBend.movement +
      "</span>" +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">Depth Movement</span>' +
      '<span class="value">' +
      item.depthBend.movement +
      "</span>" +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">Direction Difference</span>' +
      '<span class="value">' +
      item.geometry.directionAngle.toFixed(2) +
      "°</span>" +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">Interference</span>' +
      '<span class="value ' +
      cutClass +
      '">' +
      (item.interference
        ? "YES"
        : "NO") +
      "</span>" +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">Automatic Cut</span>' +
      '<span class="value ' +
      cutClass +
      '">' +
      cutText +
      "</span>" +
      "</div>" +

      '<div class="result-row">' +
      '<span class="label">Cut Size</span>' +
      '<span class="value ' +
      cutClass +
      '">' +
      cutSize +
      "</span>" +
      "</div>";

    return box;
  }

  /* ---------------------------------------------------------
     SUMMARY
     --------------------------------------------------------- */

  function renderSummary() {
    var lenSum =
      getState().lenLines.reduce(
        function (s, l) {
          return s + l.size;
        },
        0
      );

    var depSum =
      getState().depLines.reduce(
        function (s, l) {
          return s + l.size;
        },
        0
      );

    setText(
      "sum-len",
      getState().lenLines.length
        ? window.formatInch(lenSum)
        : "-"
    );

    setText(
      "sum-dep",
      getState().depLines.length
        ? window.formatInch(depSum)
        : "-"
    );

    setText(
      "sum-len-lines",
      getState().lenLines.length
    );

    setText(
      "sum-dep-lines",
      getState().depLines.length
    );

    setText(
      "sum-corners",
      Math.max(
        0,
        getState().lenLines.length - 1
      ) +
      Math.max(
        0,
        getState().depLines.length - 1
      )
    );

    setText(
      "sum-material",
      window.settings.material === "SS304"
        ? "SS 304"
        : "SS 202"
    );

    setText(
      "sum-thick",
      window.settings.thickness +
      " mm"
    );

    setText(
      "sum-vdie",
      window.settings.vdie +
      " mm"
    );

    setText(
      "sum-radius",
      window.settings.radius +
      " mm"
    );

    setText(
      "sum-kfactor",
      window.settings.kfactor
    );
  }

  function setText(id, value) {
    var e = getEl(id);

    if (e) {
      e.textContent = value;
    }
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
