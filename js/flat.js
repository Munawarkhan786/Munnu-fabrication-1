/* =========================================================
   FLAT.JS — 2D MASTER FLAT VIEW V8
   ---------------------------------------------------------
   GeometryEngine = calculation source
   Flat.js        = display only

   FIX:
   - drawCuts() is now defined
   - No ReferenceError from draw()
   - Uses GeometryEngine.analyze()
   - Draws sheet outline
   - Draws bend/mark lines
   - Draws cup cuts
   - Cut replaces bend line where possible
   - Supports zoom / pan / reset
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

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* =========================================================
     STATE
     ========================================================= */

  function getState() {
    if (window.AppState) return window.AppState;
    if (window.state) return window.state;

    return {
      lenLines: [],
      depLines: []
    };
  }

  /* =========================================================
     MASTER GEOMETRY
     ========================================================= */

  function getMasterData() {
    if (
      !window.GeometryEngine ||
      typeof window.GeometryEngine.analyze !== "function"
    ) {
      console.warn("Flat: GeometryEngine.analyze() unavailable");
      return null;
    }

    try {
      return window.GeometryEngine.analyze(getState());
    } catch (err) {
      console.error("Flat: GeometryEngine error", err);
      return null;
    }
  }

  /* =========================================================
     CANVAS
     ========================================================= */

  var canvas = null;
  var ctx = null;

  var view = {
    zoom: 1,
    panX: 0,
    panY: 0
  };

  var dragging = false;
  var lastX = 0;
  var lastY = 0;

  var currentData = null;

  /* =========================================================
     INIT CANVAS
     ========================================================= */

  function getCanvas() {
    if (canvas && ctx) {
      return true;
    }

    canvas = $("canvasFlat");

    if (!canvas) {
      console.warn("Flat: #canvasFlat not found");
      return false;
    }

    ctx = canvas.getContext("2d");

    if (!ctx) {
      console.warn("Flat: Canvas context unavailable");
      return false;
    }

    setupCanvasSize();
    bindCanvasEvents();

    return true;
  }

  function setupCanvasSize() {
    if (!canvas) return;

    var rect = canvas.getBoundingClientRect();

    var width = Math.max(
      300,
      Math.floor(rect.width || canvas.clientWidth || 800)
    );

    var height = Math.max(
      250,
      Math.floor(rect.height || canvas.clientHeight || 500)
    );

    var dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    canvas._logicalWidth = width;
    canvas._logicalHeight = height;
  }

  /* =========================================================
     VIEW TRANSFORM
     ========================================================= */

  function getCanvasSize() {
    return {
      width:
        canvas._logicalWidth ||
        canvas.clientWidth ||
        800,

      height:
        canvas._logicalHeight ||
        canvas.clientHeight ||
        500
    };
  }

  function getSheetSize(data) {
    var sheet = data && data.sheet
      ? data.sheet
      : {};

    var width =
      num(sheet.widthInch) ||
      num(data && data.totals && data.totals.length) ||
      1;

    var height =
      num(sheet.heightInch) ||
      num(data && data.totals && data.totals.depth) ||
      1;

    return {
      width: Math.max(width, 0.1),
      height: Math.max(height, 0.1)
    };
  }

  function fitScale(data) {
    var size = getSheetSize(data);
    var c = getCanvasSize();

    var margin = 70;

    var sx =
      (c.width - margin * 2) /
      (size.width * 96);

    var sy =
      (c.height - margin * 2) /
      (size.height * 96);

    /*
      96 px = visual scale for 1 inch.
      Clamp keeps very large/small sheets usable.
    */

    return clamp(
      Math.min(sx, sy),
      0.15,
      5
    );
  }

  function worldToScreen(x, y, data) {
    var size = getSheetSize(data);
    var c = getCanvasSize();

    var baseScale = 96 * view.zoom;

    var sheetW = size.width * baseScale;
    var sheetH = size.height * baseScale;

    var ox =
      (c.width - sheetW) / 2 +
      view.panX;

    var oy =
      (c.height - sheetH) / 2 +
      view.panY;

    return {
      x: ox + x * baseScale,
      y: oy + y * baseScale
    };
  }

  function screenToWorld(px, py, data) {
    var size = getSheetSize(data);
    var c = getCanvasSize();

    var baseScale = 96 * view.zoom;

    var sheetW = size.width * baseScale;
    var sheetH = size.height * baseScale;

    var ox =
      (c.width - sheetW) / 2 +
      view.panX;

    var oy =
      (c.height - sheetH) / 2 +
      view.panY;

    return {
      x: (px - ox) / baseScale,
      y: (py - oy) / baseScale
    };
  }

  /* =========================================================
     BACKGROUND
     ========================================================= */

  function drawBackground() {
    var c = getCanvasSize();

    ctx.save();

    ctx.fillStyle = "#101418";
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.restore();
  }

  /* =========================================================
     SHEET
     ========================================================= */

  function drawSheet(data) {
    var size = getSheetSize(data);

    var a = worldToScreen(
      0,
      0,
      data
    );

    var b = worldToScreen(
      size.width,
      size.height,
      data
    );

    ctx.save();

    ctx.fillStyle = "#c8ccd0";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    ctx.fillRect(
      a.x,
      a.y,
      b.x - a.x,
      b.y - a.y
    );

    ctx.strokeRect(
      a.x,
      a.y,
      b.x - a.x,
      b.y - a.y
    );

    ctx.restore();
  }

  /* =========================================================
     GRID
     ========================================================= */

  function drawGrid(data) {
    var size = getSheetSize(data);

    ctx.save();

    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "rgba(60,60,60,0.35)";

    /*
      1 inch grid
    */

    for (var x = 1; x < size.width; x++) {
      var p1 = worldToScreen(x, 0, data);
      var p2 = worldToScreen(x, size.height, data);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    for (var y = 1; y < size.height; y++) {
      var q1 = worldToScreen(0, y, data);
      var q2 = worldToScreen(size.width, y, data);

      ctx.beginPath();
      ctx.moveTo(q1.x, q1.y);
      ctx.lineTo(q2.x, q2.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* =========================================================
     LINE POSITION HELPERS
     ========================================================= */

  function linePosition(line, side, index) {
    /*
      Prefer GeometryEngine's calculated position.
    */

    if (
      line &&
      line.bendCenterInch != null
    ) {
      return num(line.bendCenterInch);
    }

    if (
      line &&
      line.positionInch != null
    ) {
      return num(line.positionInch);
    }

    if (
      line &&
      line.position != null
    ) {
      return num(line.position);
    }

    /*
      Compatibility fallback.
      Uses actual entered line sizes.
    */

    var list =
      side === "length"
        ? (
          Array.isArray(
            currentData && currentData.input &&
            currentData.input.lengthLines
          )
            ? currentData.input.lengthLines
            : []
        )
        : (
          Array.isArray(
            currentData && currentData.input &&
            currentData.input.depthLines
          )
            ? currentData.input.depthLines
            : []
        );

    var pos = 0;

    for (
      var i = 0;
      i <= index && i < list.length;
      i++
    ) {
      pos += num(
        list[i].sizeInch != null
          ? list[i].sizeInch
          : list[i].size
      );
    }

    return pos;
  }

  /* =========================================================
     BEND LINES
     ========================================================= */

  function drawLengthLines(data) {
    var lines = Array.isArray(data.lengthLines)
      ? data.lengthLines
      : [];

    var sheet = getSheetSize(data);

    lines.forEach(function (line, index) {
      var x = linePosition(
        line,
        "length",
        index
      );

      if (x <= 0 || x >= sheet.width) {
        return;
      }

      drawBendLine(
        x,
        0,
        x,
        sheet.height,
        line
      );
    });
  }

  function drawDepthLines(data) {
    var lines = Array.isArray(data.depthLines)
      ? data.depthLines
      : [];

    var sheet = getSheetSize(data);

    lines.forEach(function (line, index) {
      var y = linePosition(
        line,
        "depth",
        index
      );

      if (y <= 0 || y >= sheet.height) {
        return;
      }

      drawBendLine(
        0,
        y,
        sheet.width,
        y,
        line
      );
    });
  }

  function drawBendLine(
    x1,
    y1,
    x2,
    y2,
    line
  ) {
    var p1 = worldToScreen(
      x1,
      y1,
      currentData
    );

    var p2 = worldToScreen(
      x2,
      y2,
      currentData
    );

    ctx.save();

    ctx.strokeStyle = "#1976ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    ctx.setLineDash([]);

    /*
      Direction marker
    */

    var direction =
      String(
        line.direction ||
        line.bend ||
        ""
      ).toLowerCase();

    var midX = (p1.x + p2.x) / 2;
    var midY = (p1.y + p2.y) / 2;

    ctx.fillStyle =
      direction === "down"
        ? "#ff9800"
        : "#00c853";

    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
      direction === "down"
        ? "↓"
        : "↑",
      midX,
      midY - 4
    );

    ctx.restore();
  }

  /* =========================================================
     CUT LOOKUP
     ========================================================= */

  function getCuts(data) {
    return Array.isArray(data.cuts)
      ? data.cuts
      : [];
  }

  function isCutHidden(id) {
    if (
      window.hiddenCuts &&
      window.hiddenCuts[id]
    ) {
      return true;
    }

    return false;
  }

  /* =========================================================
     CUT POSITION
     ========================================================= */

  function cutPosition(cut, data) {
    var x =
      cut.xInch != null
        ? num(cut.xInch)
        : 0;

    var y =
      cut.yInch != null
        ? num(cut.yInch)
        : 0;

    var width =
      cut.widthInch != null
        ? num(cut.widthInch)
        : num(cut.widthMM) / 25.4;

    var height =
      cut.depthInch != null
        ? num(cut.depthInch)
        : num(cut.depthMM) / 25.4;

    return {
      x: x,
      y: y,
      width: Math.max(width, 0.05),
      height: Math.max(height, 0.05)
    };
  }

  /* =========================================================
     DRAW ONE CUT
     ========================================================= */

  function drawCutShape(cut, data) {
    if (!cut) return;

    if (
      cut.id &&
      isCutHidden(cut.id)
    ) {
      return;
    }

    var r = cutPosition(
      cut,
      data
    );

    var p1 = worldToScreen(
      r.x,
      r.y,
      data
    );

    var p2 = worldToScreen(
      r.x + r.width,
      r.y + r.height,
      data
    );

    var w = p2.x - p1.x;
    var h = p2.y - p1.y;

    ctx.save();

    /*
      Red = physical cup-cut area
    */

    ctx.fillStyle =
      "rgba(244,67,54,0.30)";

    ctx.strokeStyle =
      "#ff2020";

    ctx.lineWidth = 2;

    ctx.fillRect(
      p1.x,
      p1.y,
      w,
      h
    );

    ctx.strokeRect(
      p1.x,
      p1.y,
      w,
      h
    );

    /*
      X marker
    */

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);

    ctx.moveTo(
      p2.x,
      p1.y
    );
    ctx.lineTo(
      p1.x,
      p2.y
    );

    ctx.stroke();

    /*
      CUT label
    */

    ctx.fillStyle = "#d50000";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
      "CUT",
      p1.x + w / 2,
      p1.y + h / 2
    );

    ctx.restore();
  }

  /* =========================================================
     DRAW CUTS
     ---------------------------------------------------------
     THIS FUNCTION FIXES:
     ReferenceError: drawCuts is not defined
     ========================================================= */

  function drawCuts(data) {
    var cuts = getCuts(data);

    if (!cuts.length) {
      return;
    }

    cuts.forEach(function (cut) {
      drawCutShape(
        cut,
        data
      );
    });
  }

  /* =========================================================
     INTERSECTION POINTS
     ========================================================= */

  function drawIntersections(data) {
    var intersections =
      Array.isArray(data.intersections)
        ? data.intersections
        : [];

    intersections.forEach(function (item) {
      if (!item) return;

      /*
        If this intersection already has
        a cup cut, don't add another yellow
        marker on top.
      */

      if (
        item.required ||
        item.cutRequired ||
        item.hasCut
      ) {
        return;
      }

      var x =
        item.xInch != null
          ? num(item.xInch)
          : null;

      var y =
        item.yInch != null
          ? num(item.yInch)
          : null;

      if (
        x == null ||
        y == null
      ) {
        return;
      }

      var p = worldToScreen(
        x,
        y,
        data
      );

      ctx.save();

      ctx.fillStyle = "#ffd600";

      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        4,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();
    });
  }

  /* =========================================================
     DIMENSIONS
     ========================================================= */

  function drawDimensions(data) {
    var size = getSheetSize(data);

    var p1 = worldToScreen(
      0,
      0,
      data
    );

    var p2 = worldToScreen(
      size.width,
      0,
      data
    );

    var p3 = worldToScreen(
      0,
      size.height,
      data
    );

    ctx.save();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Arial";

    ctx.textAlign = "center";

    ctx.fillText(
      size.width.toFixed(3)
        .replace(/\.?0+$/, "") +
      '"',
      (p1.x + p2.x) / 2,
      p1.y - 10
    );

    ctx.save();

    ctx.translate(
      p3.x - 12,
      (p1.y + p3.y) / 2
    );

    ctx.rotate(-Math.PI / 2);

    ctx.fillText(
      size.height.toFixed(3)
        .replace(/\.?0+$/, "") +
      '"',
      0,
      0
    );

    ctx.restore();

    ctx.restore();
  }

  /* =========================================================
     LEGEND
     ========================================================= */

  function drawLegend() {
    var c = getCanvasSize();

    ctx.save();

    ctx.font = "11px Arial";
    ctx.textAlign = "left";

    var x = 12;
    var y = c.height - 45;

    ctx.strokeStyle = "#1976ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 4]);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 28, y);
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      "BEND / MARK",
      x + 36,
      y + 4
    );

    ctx.fillStyle = "#ff2020";

    ctx.fillRect(
      x,
      y + 12,
      28,
      10
    );

    ctx.fillStyle = "#ffffff";

    ctx.fillText(
      "CUP CUT",
      x + 36,
      y + 21
    );

    ctx.restore();
  }

  /* =========================================================
     EMPTY STATE
     ========================================================= */

  function drawEmpty(message) {
    var c = getCanvasSize();

    ctx.save();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
      message,
      c.width / 2,
      c.height / 2
    );

    ctx.restore();
  }

  /* =========================================================
     MAIN DRAW
     ========================================================= */

  function draw() {
    if (!getCanvas()) {
      return;
    }

    setupCanvasSize();

    currentData =
      getMasterData();

    drawBackground();

    if (!currentData) {
      drawEmpty(
        "Geometry Engine unavailable"
      );
      return;
    }

    var size =
      getSheetSize(currentData);

    if (
      size.width <= 0 ||
      size.height <= 0
    ) {
      drawEmpty(
        "Enter Length / Depth sizes"
      );
      return;
    }

    /*
      IMPORTANT ORDER:
      1. Sheet
      2. Grid
      3. Bend lines
      4. Intersections
      5. Cuts
      6. Dimensions
      7. Legend

      Cuts are drawn LAST so red cut area
      visually replaces the blue line.
    */

    drawSheet(currentData);
    drawGrid(currentData);

    drawLengthLines(
      currentData
    );

    drawDepthLines(
      currentData
    );

    drawIntersections(
      currentData
    );

    drawCuts(
      currentData
    );

    drawDimensions(
      currentData
    );

    drawLegend();
  }

  /* =========================================================
     FIT
     ========================================================= */

  function fit() {
    view.zoom =
      fitScale(
        currentData ||
        getMasterData()
      );

    view.panX = 0;
    view.panY = 0;

    draw();
  }

  /* =========================================================
     RESET
     ========================================================= */

  function reset() {
    var data =
      currentData ||
      getMasterData();

    if (!data) {
      view.zoom = 1;
    } else {
      view.zoom =
        fitScale(data);
    }

    view.panX = 0;
    view.panY = 0;

    draw();
  }

  /* =========================================================
     ZOOM
     ========================================================= */

  function zoomIn() {
    view.zoom =
      clamp(
        view.zoom * 1.2,
        0.15,
        20
      );

    draw();
  }

  function zoomOut() {
    view.zoom =
      clamp(
        view.zoom / 1.2,
        0.15,
        20
      );

    draw();
  }

  /* =========================================================
     PAN / DRAG
     ========================================================= */

  function bindCanvasEvents() {
    if (!canvas) return;

    canvas.addEventListener(
      "pointerdown",
      function (e) {
        dragging = true;

        lastX = e.clientX;
        lastY = e.clientY;

        try {
          canvas.setPointerCapture(
            e.pointerId
          );
        } catch (_) {}
      }
    );

    canvas.addEventListener(
      "pointermove",
      function (e) {
        if (!dragging) return;

        var dx =
          e.clientX - lastX;

        var dy =
          e.clientY - lastY;

        view.panX += dx;
        view.panY += dy;

        lastX = e.clientX;
        lastY = e.clientY;

        draw();
      }
    );

    canvas.addEventListener(
      "pointerup",
      function (e) {
        dragging = false;

        try {
          canvas.releasePointerCapture(
            e.pointerId
          );
        } catch (_) {}
      }
    );

    canvas.addEventListener(
      "pointercancel",
      function () {
        dragging = false;
      }
    );

    canvas.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();

        if (e.deltaY < 0) {
          view.zoom *= 1.1;
        } else {
          view.zoom /= 1.1;
        }

        view.zoom =
          clamp(
            view.zoom,
            0.15,
            20
          );

        draw();
      },
      {
        passive: false
      }
    );

    /*
      Click a cut to hide/show it.
    */

    canvas.addEventListener(
      "click",
      function (e) {
        if (!currentData) return;

        var rect =
          canvas.getBoundingClientRect();

        var px =
          e.clientX -
          rect.left;

        var py =
          e.clientY -
          rect.top;

        var world =
          screenToWorld(
            px,
            py,
            currentData
          );

        var cuts =
          getCuts(
            currentData
          );

        cuts.forEach(function (cut) {
          var r =
            cutPosition(
              cut,
              currentData
            );

          if (
            world.x >= r.x &&
            world.x <=
              r.x + r.width &&
            world.y >= r.y &&
            world.y <=
              r.y + r.height
          ) {
            if (!window.hiddenCuts) {
              window.hiddenCuts = {};
            }

            window.hiddenCuts[
              cut.id
            ] =
              !window.hiddenCuts[
                cut.id
              ];

            draw();
          }
        });
      }
    );

    window.addEventListener(
      "resize",
      function () {
        setupCanvasSize();
        draw();
      }
    );
  }

  /* =========================================================
     BUTTON HELPERS
     ========================================================= */

  function bindButton(
    id,
    fn
  ) {
    var el = $(id);

    if (!el) return;

    el.addEventListener(
      "click",
      function (e) {
        e.preventDefault();
        fn();
      }
    );
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {
    if (!getCanvas()) {
      return;
    }

    /*
      Initial fit
    */

    currentData =
      getMasterData();

    if (currentData) {
      view.zoom =
        fitScale(
          currentData
        );
    }

    bindButton(
      "flat-zoom-in",
      zoomIn
    );

    bindButton(
      "flat-zoom-out",
      zoomOut
    );

    bindButton(
      "flat-reset",
      reset
    );

    bindButton(
      "zoom-in",
      zoomIn
    );

    bindButton(
      "zoom-out",
      zoomOut
    );

    bindButton(
      "reset-view",
      reset
    );

    draw();
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.Flat = {
    init: init,
    draw: draw,
    redraw: draw,
    fit: fit,
    reset: reset,
    zoomIn: zoomIn,
    zoomOut: zoomOut,
    getMasterData: getMasterData,
    drawCuts: drawCuts
  };

  /*
    Compatibility alias
  */

  window.FlatView =
    window.Flat;

})();
