/* =========================================================
   FLAT VIEW — MASTER GEOMETRY V6 (FULL DRAWING)
   ---------------------------------------------------------
   FIX V6:
   - GeometryEngine se poora data leta hai
   - Length + Depth lines draw karta hai
   - Bend joints (red dots) draw karta hai
   - Cup cuts (red rectangles) draw karta hai
   - Sheet outline + dimensions + legend
   - Reverse engineering: jo bana woh dikhata hai
   ========================================================= */

(function () {
  "use strict";

  var canvas = null;
  var container = null;
  var ctx = null;

  var ready = false;

  var scale = 45;
  var offsetX = 40;
  var offsetY = 60;

  var isDragging = false;
  var lastX = 0;
  var lastY = 0;

  var minScale = 5;
  var maxScale = 200;

  function getEl(id) {
    return document.getElementById(id);
  }

  function num(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function formatNumber(value) {
    var n = num(value, 0);
    if (Math.abs(n - Math.round(n)) < 0.0001) {
      return String(Math.round(n));
    }
    return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }

  function formatInch(value) {
    if (window.Core && typeof window.Core.formatInch === "function") {
      return window.Core.formatInch(value);
    }
    var n = num(value, 0);
    if (Math.abs(n) < 0.0001) return "0";
    return formatNumber(n) + '"';
  }

  /* =========================================================
     MASTER DATA
     ========================================================= */

  function getMasterData() {
    if (!window.GeometryEngine) {
      console.error("❌ GeometryEngine missing.");
      return null;
    }

    try {
      var state = window.AppState || window.state || {};
      return window.GeometryEngine.analyze(state);
    } catch (err) {
      console.error("❌ Flat GeometryEngine error:", err);
      if (window.Bugs) {
        try {
          window.Bugs.log("flat.geometry", err.message, err.stack);
        } catch (bugErr) {}
      }
      return null;
    }
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {
    container = getEl("flat-container");
    canvas = getEl("canvasFlat");

    if (!canvas) {
      console.warn("⚠️ canvasFlat not found.");
      return;
    }

    ctx = canvas.getContext("2d");

    if (!ctx) {
      console.error("❌ 2D canvas unavailable.");
      return;
    }

    bindEvents();
    resize();

    ready = true;

    setTimeout(function() {
      fit();
    }, 100);
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  function bindEvents() {
    if (!canvas) return;

    canvas.addEventListener("mousedown", function (e) {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });

    canvas.addEventListener("mousemove", function (e) {
      if (!isDragging) return;
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      offsetX += dx;
      offsetY += dy;
      lastX = e.clientX;
      lastY = e.clientY;
      draw();
    });

    canvas.addEventListener("mouseup", function () {
      isDragging = false;
    });

    canvas.addEventListener("mouseleave", function () {
      isDragging = false;
    });

    canvas.addEventListener(
      "touchstart",
      function (e) {
        if (e.touches.length !== 1) return;
        isDragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      },
      { passive: true }
    );

    canvas.addEventListener(
      "touchmove",
      function (e) {
        if (!isDragging) return;
        if (e.touches.length !== 1) return;
        e.preventDefault();
        var dx = e.touches[0].clientX - lastX;
        var dy = e.touches[0].clientY - lastY;
        offsetX += dx;
        offsetY += dy;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        draw();
      },
      { passive: false }
    );

    canvas.addEventListener("touchend", function () {
      isDragging = false;
    });

    canvas.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        var factor = e.deltaY > 0 ? 0.9 : 1.1;
        scale *= factor;
        scale = Math.max(minScale, Math.min(maxScale, scale));
        draw();
      },
      { passive: false }
    );

    window.addEventListener("resize", function () {
      resize();
      draw();
    });
  }

  /* =========================================================
     RESIZE
     ========================================================= */

  function resize() {
    if (!canvas || !ctx) return;

    var width =
      canvas.clientWidth ||
      (canvas.parentElement && canvas.parentElement.clientWidth) ||
      320;

    var height =
      canvas.clientHeight ||
      (canvas.parentElement && canvas.parentElement.clientHeight) ||
      420;

    var ratio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  /* =========================================================
     DRAW
     ========================================================= */

  function draw() {
    if (!ready && !canvas) {
      init();
      return;
    }

    if (!canvas || !ctx) return;

    var width = canvas.clientWidth || canvas.width;
    var height = canvas.clientHeight || canvas.height;

    ctx.save();
    ctx.setTransform(
      window.devicePixelRatio || 1, 0, 0,
      window.devicePixelRatio || 1, 0, 0
    );
    ctx.clearRect(0, 0, width, height);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "#0b0f14";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    var data = getMasterData();

    if (!data) {
      drawEmpty(width, height, "Geometry data not available");
      return;
    }

    // Check sheet size
    var sheetWidth = 0;
    var sheetHeight = 0;

    if (data.sheet) {
      sheetWidth = num(data.sheet.widthInch, num(data.sheet.width, 0));
      sheetHeight = num(data.sheet.heightInch, num(data.sheet.height, 0));
    }

    if (sheetWidth <= 0 || sheetHeight <= 0) {
      // Fallback: calculate from lengthLines and depthLines
      if (data.totals) {
        sheetWidth = num(data.totals.length, num(data.totals.lengthInch, 0));
        sheetHeight = num(data.totals.depth, num(data.totals.depthInch, 0));
      }
    }

    if (sheetWidth <= 0 || sheetHeight <= 0) {
      drawEmpty(width, height, "Sheet size enter karo");
      return;
    }

    // -----------------------------------------------------
    // DRAW EVERYTHING
    // -----------------------------------------------------

    drawSheetOutline(data, sheetWidth, sheetHeight);
    drawSheetGrid(sheetWidth, sheetHeight);
    drawMarkingLines(data, sheetWidth, sheetHeight);
    drawBendJoints(data, sheetWidth, sheetHeight);
    drawCuts(data);
    drawDimensions(sheetWidth, sheetHeight);
    drawLegend(data);
  }

  /* =========================================================
     SHEET OUTLINE
     ========================================================= */

  function drawSheetOutline(data, sheetWidth, sheetHeight) {
    var x = offsetX;
    var y = offsetY;
    var w = sheetWidth * scale;
    var h = sheetHeight * scale;

    ctx.save();

    // Sheet body
    ctx.fillStyle = "#c7ccd1";
    ctx.fillRect(x, y, w, h);

    // Sheet border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.restore();
  }

  function drawSheetGrid(sheetWidth, sheetHeight) {
    var x = offsetX;
    var y = offsetY;
    var w = sheetWidth * scale;
    var h = sheetHeight * scale;

    ctx.save();
    ctx.strokeStyle = "rgba(60,70,80,0.15)";
    ctx.lineWidth = 1;

    var grid = scale;
    if (grid < 20) { ctx.restore(); return; }

    for (var gx = x + grid; gx < x + w; gx += grid) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }

    for (var gy = y + grid; gy < y + h; gy += grid) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* =========================================================
     MARKING LINES
     ========================================================= */

  function drawMarkingLines(data, sheetWidth, sheetHeight) {
    var x0 = offsetX;
    var y0 = offsetY;

    var lengthLines = Array.isArray(data.lengthLines) ? data.lengthLines : [];
    var depthLines = Array.isArray(data.depthLines) ? data.depthLines : [];

    // -----------------------------------------------------
    // LENGTH LINES (Vertical)
    // -----------------------------------------------------

    var runningX = 0;

    for (var i = 0; i < lengthLines.length; i++) {
      var line = lengthLines[i];
      var size = num(line.sizeInch, num(line.size, 0));

      if (size <= 0) continue;

      runningX += size;

      var x = x0 + runningX * scale;

      drawVerticalMark(x, y0, y0 + sheetHeight * scale, line, i + 1);
    }

    // -----------------------------------------------------
    // DEPTH LINES (Horizontal)
    // -----------------------------------------------------

    var runningY = 0;

    for (var j = 0; j < depthLines.length; j++) {
      var dline = depthLines[j];
      var dsize = num(dline.sizeInch, num(dline.size, 0));

      if (dsize <= 0) continue;

      runningY += dsize;

      var y = y0 + runningY * scale;

      drawHorizontalMark(y, x0, x0 + sheetWidth * scale, dline, j + 1);
    }
  }

  function drawVerticalMark(x, y1, y2, line, index) {
    ctx.save();

    // Blue dashed line
    ctx.strokeStyle = "#1677ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);

    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();

    ctx.setLineDash([]);

    // Label
    ctx.font = "bold 11px Arial";
    ctx.fillStyle = "#0b4aa2";

    var label = "L" + index + " " + String(line.angle || 90) + "°";
    ctx.fillText(label, x + 5, y1 + 18);

    // Direction indicator
    var direction = String(line.direction || "UP").toUpperCase();
    var dirColor = direction === "DOWN" ? "#dc2626" : "#16a34a";
    ctx.fillStyle = dirColor;
    ctx.font = "bold 10px Arial";
    ctx.fillText(direction, x + 5, y1 + 32);

    ctx.restore();
  }

  function drawHorizontalMark(y, x1, x2, line, index) {
    ctx.save();

    // Blue dashed line
    ctx.strokeStyle = "#1677ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);

    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();

    ctx.setLineDash([]);

    // Label
    ctx.font = "bold 11px Arial";
    ctx.fillStyle = "#0b4aa2";

    var label = "D" + index + " " + String(line.angle || 90) + "°";
    ctx.fillText(label, x1 + 5, y - 7);

    // Direction
    var direction = String(line.direction || "UP").toUpperCase();
    var dirColor = direction === "DOWN" ? "#dc2626" : "#16a34a";
    ctx.fillStyle = dirColor;
    ctx.font = "bold 10px Arial";
    ctx.fillText(direction, x1 + 5, y - 20);

    ctx.restore();
  }

  /* =========================================================
     BEND JOINTS (Red dots)
     ========================================================= */

  function drawBendJoints(data, sheetWidth, sheetHeight) {
    var x0 = offsetX;
    var y0 = offsetY;

    var lengthLines = Array.isArray(data.lengthLines) ? data.lengthLines : [];
    var depthLines = Array.isArray(data.depthLines) ? data.depthLines : [];

    // Length joints
    var runningX = 0;
    for (var i = 0; i < lengthLines.length; i++) {
      var size = num(lengthLines[i].sizeInch, num(lengthLines[i].size, 0));
      if (size <= 0) continue;
      runningX += size;

      var x = x0 + runningX * scale;

      ctx.save();
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(x, y0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Depth joints
    var runningY = 0;
    for (var j = 0; j < depthLines.length; j++) {
      var dsize = num(depthLines[j].sizeInch, num(depthLines[j].size, 0));
      if (dsize <= 0) continue;
      runningY += dsize;

      var y = y0 + runningY * scale;

      ctx.save();
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(x0, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* =========================================================
     CUTS
     ========================================================= */

  function drawCuts(data) {
    var cuts = Array.isArray(data.cuts) ? data.cuts : [];
    if (!cuts.length) return;

    for (var i = 0; i < cuts.length; i++) {
      var cut = cuts[i];
      if (!cut) continue;

      // Hidden cut?
      var cutId = cut.id || "";
      if (
        window.view3d &&
        Array.isArray(window.view3d.hiddenCuts) &&
        window.view3d.hiddenCuts.indexOf(cutId) !== -1
      ) {
        continue;
      }

      var xIn = num(cut.xInch, 0);
      var yIn = num(cut.yInch, 0);
      var widthIn = num(cut.widthInch, 0.1);
      var depthIn = num(cut.depthInch, 0.1);

      var x = offsetX + xIn * scale;
      var y = offsetY + yIn * scale;
      var w = Math.max(4, widthIn * scale);
      var h = Math.max(4, depthIn * scale);

      drawSingleCut(x, y, w, h, cut);
    }
  }

  function drawSingleCut(x, y, w, h, cut) {
    ctx.save();

    // Red fill
    ctx.fillStyle = "rgba(220,35,35,0.85)";
    ctx.fillRect(x - w/2, y - h/2, w, h);

    // White border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - w/2, y - h/2, w, h);

    // X marker
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - w/2, y - h/2);
    ctx.lineTo(x + w/2, y + h/2);
    ctx.moveTo(x + w/2, y - h/2);
    ctx.lineTo(x - w/2, y + h/2);
    ctx.stroke();

    // CUT label
    ctx.font = "bold 9px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("CUT", x - w/2 + 2, y - h/2 + 11);

    ctx.restore();
  }

  /* =========================================================
     DIMENSIONS
     ========================================================= */

  function drawDimensions(sheetWidth, sheetHeight) {
    var x = offsetX;
    var y = offsetY;
    var w = sheetWidth * scale;
    var h = sheetHeight * scale;

    // Top width
    drawHorizontalDimension(
      x, y - 20, x + w, y - 20,
      formatInch(sheetWidth)
    );

    // Left height
    drawVerticalDimension(
      x - 25, y, x - 25, y + h,
      formatInch(sheetHeight)
    );
  }

  function drawHorizontalDimension(x1, y1, x2, y2, label) {
    ctx.save();
    ctx.strokeStyle = "#8899aa";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    drawArrow(x1, y1, 0);
    drawArrow(x2, y2, Math.PI);

    ctx.font = "bold 12px Arial";
    var middle = (x1 + x2) / 2;
    ctx.fillText(label, middle - 20, y1 - 5);

    ctx.restore();
  }

  function drawVerticalDimension(x1, y1, x2, y2, label) {
    ctx.save();
    ctx.strokeStyle = "#8899aa";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    drawArrow(x1, y1, Math.PI / 2);
    drawArrow(x2, y2, -Math.PI / 2);

    ctx.save();
    ctx.translate(x1 - 7, (y1 + y2) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = "bold 12px Arial";
    ctx.fillText(label, -20, 0);
    ctx.restore();

    ctx.restore();
  }

  function drawArrow(x, y, angle) {
    var size = 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x - Math.cos(angle - 0.5) * size,
      y - Math.sin(angle - 0.5) * size
    );
    ctx.lineTo(
      x - Math.cos(angle + 0.5) * size,
      y - Math.sin(angle + 0.5) * size
    );
    ctx.closePath();
    ctx.fill();
  }

  /* =========================================================
     LEGEND
     ========================================================= */

  function drawLegend(data) {
    var w = canvas.clientWidth || canvas.width;
    var h = canvas.clientHeight || canvas.height;

    var x = 10;
    var y = h - 85;

    ctx.save();
    ctx.font = "11px Arial";

    // Blue - Marking
    ctx.strokeStyle = "#1677ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 25, y);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.fillText("Bend / Mark", x + 32, y + 4);

    // Red dot - Joint
    y += 20;
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(x + 12, y - 3, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillText("Bend Joint", x + 32, y + 4);

    // Red box - Cut
    y += 20;
    ctx.fillStyle = "#dc2323";
    ctx.fillRect(x, y - 8, 25, 12);

    ctx.fillStyle = "#ffffff";
    ctx.fillText("Cup Cut", x + 32, y + 3);

    // Summary
    y += 22;

    var lenCount = data.lengthLines ? data.lengthLines.length : 0;
    var depCount = data.depthLines ? data.depthLines.length : 0;
    var cutCount = data.cuts ? data.cuts.length : 0;

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 11px Arial";
    ctx.fillText(
      "L: " + lenCount + " | D: " + depCount + " | Cuts: " + cutCount,
      x, y
    );

    ctx.restore();
  }

  /* =========================================================
     EMPTY MESSAGE
     ========================================================= */

  function drawEmpty(width, height, message) {
    ctx.save();
    ctx.fillStyle = "#9aa3ad";
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText(message, width / 2, height / 2);
    ctx.restore();
  }

  /* =========================================================
     FIT TO SCREEN
     ========================================================= */

  function fit() {
    var data = getMasterData();
    if (!data) return;

    var sheetWidth = 0;
    var sheetHeight = 0;

    if (data.sheet) {
      sheetWidth = num(data.sheet.widthInch, num(data.sheet.width, 0));
      sheetHeight = num(data.sheet.heightInch, num(data.sheet.height, 0));
    }

    if (sheetWidth <= 0 || sheetHeight <= 0) {
      if (data.totals) {
        sheetWidth = num(data.totals.length, num(data.totals.lengthInch, 0));
        sheetHeight = num(data.totals.depth, num(data.totals.depthInch, 0));
      }
    }

    if (sheetWidth <= 0 || sheetHeight <= 0) {
      draw();
      return;
    }

    var width = canvas.clientWidth || 320;
    var height = canvas.clientHeight || 420;

    var availableWidth = Math.max(width - 100, 100);
    var availableHeight = Math.max(height - 120, 100);

    var sx = availableWidth / Math.max(sheetWidth, 1);
    var sy = availableHeight / Math.max(sheetHeight, 1);

    scale = Math.min(sx, sy);
    scale = Math.max(minScale, Math.min(maxScale, scale));

    offsetX = (width - sheetWidth * scale) / 2;
    offsetY = (height - sheetHeight * scale) / 2;
    offsetY = Math.max(offsetY, 60);

    draw();
  }

  /* =========================================================
     ZOOM
     ========================================================= */

  function zoomIn() {
    scale *= 1.2;
    scale = Math.min(maxScale, scale);
    draw();
  }

  function zoomOut() {
    scale *= 0.8;
    scale = Math.max(minScale, scale);
    draw();
  }

  function reset() {
    scale = 45;
    offsetX = 40;
    offsetY = 60;
    fit();
  }

  function print() {
    window.print();
  }

  /* =========================================================
     EXPOSE
     ========================================================= */

  window.FlatView = {
    init: init,
    draw: draw,
    fit: fit,
    zoomIn: zoomIn,
    zoomOut: zoomOut,
    reset: reset,
    print: print
  };

  window.Flat = window.FlatView;

})();
