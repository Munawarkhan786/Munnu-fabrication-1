/* =========================================================
   FLAT VIEW — MASTER GEOMETRY V4
   2D Flat Sheet Marking / Bend / Cup Cut View

   IMPORTANT:
   - Engineering calculation yahan nahi hoti.
   - GeometryEngine.analyze() MASTER DATA hai.
   - Length + Depth dono ek project hain.
   - Bend angle + UP/DOWN GeometryEngine se aata hai.
   - Cup cuts / notches GeometryEngine se aate hain.
   - Red cut area bend line ko visually replace karta hai.
   - Mobile touch + mouse supported.
   ========================================================= */

(function () {
  "use strict";

  // =========================================================
  // GLOBALS
  // =========================================================

  var canvas = null;
  var container = null;
  var ctx = null;

  var ready = false;

  var scale = 45;
  var offsetX = 40;
  var offsetY = 40;

  var isDragging = false;
  var lastX = 0;
  var lastY = 0;

  var minScale = 10;
  var maxScale = 180;

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

  function inch(value) {
    return num(value, 0);
  }

  function formatNumber(value) {
    var n = num(value, 0);

    if (Math.abs(n - Math.round(n)) < 0.0001) {
      return String(Math.round(n));
    }

    return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }

  function formatInch(value) {
    if (
      window.Core &&
      typeof window.Core.formatInch === "function"
    ) {
      return window.Core.formatInch(value);
    }

    var n = num(value, 0);

    if (Math.abs(n) < 0.0001) {
      return "0";
    }

    return formatNumber(n) + '"';
  }

  // =========================================================
  // MASTER DATA
  // =========================================================

  function getMasterData() {
    if (!window.GeometryEngine) {
      console.error("❌ GeometryEngine missing.");
      return null;
    }

    try {
      return window.GeometryEngine.analyze();
    } catch (err) {
      console.error("❌ Flat GeometryEngine error:", err);

      if (window.Bugs) {
        try {
          window.Bugs.log(
            "flat.geometry",
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

    draw();
  }

  // =========================================================
  // EVENTS
  // =========================================================

  function bindEvents() {
    if (!canvas) return;

    // -------------------------------------------------------
    // MOUSE
    // -------------------------------------------------------

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

    // -------------------------------------------------------
    // TOUCH
    // -------------------------------------------------------

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

        var dx =
          e.touches[0].clientX - lastX;

        var dy =
          e.touches[0].clientY - lastY;

        offsetX += dx;
        offsetY += dy;

        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;

        draw();
      },
      { passive: false }
    );

    canvas.addEventListener(
      "touchend",
      function () {
        isDragging = false;
      }
    );

    // -------------------------------------------------------
    // WHEEL ZOOM
    // -------------------------------------------------------

    canvas.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();

        var factor =
          e.deltaY > 0 ? 0.9 : 1.1;

        scale *= factor;

        scale = Math.max(
          minScale,
          Math.min(maxScale, scale)
        );

        draw();
      },
      { passive: false }
    );

    // -------------------------------------------------------
    // RESIZE
    // -------------------------------------------------------

    window.addEventListener(
      "resize",
      function () {
        resize();
        draw();
      }
    );
  }

  // =========================================================
  // RESIZE
  // =========================================================

  function resize() {
    if (!canvas || !ctx) return;

    var width =
      canvas.clientWidth ||
      canvas.parentElement &&
      canvas.parentElement.clientWidth ||
      320;

    var height =
      canvas.clientHeight ||
      canvas.parentElement &&
      canvas.parentElement.clientHeight ||
      420;

    var ratio =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );

    canvas.width =
      Math.max(1, Math.floor(width * ratio));

    canvas.height =
      Math.max(1, Math.floor(height * ratio));

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.setTransform(
      ratio,
      0,
      0,
      ratio,
      0,
      0
    );
  }

  // =========================================================
  // DRAW
  // =========================================================

  function draw() {
    if (!ready && !canvas) {
      init();
      return;
    }

    if (!canvas || !ctx) return;

    var width =
      canvas.clientWidth ||
      canvas.width;

    var height =
      canvas.clientHeight ||
      canvas.height;

    // -------------------------------------------------------
    // CLEAR
    // -------------------------------------------------------

    ctx.save();

    ctx.setTransform(
      window.devicePixelRatio || 1,
      0,
      0,
      window.devicePixelRatio || 1,
      0,
      0
    );

    ctx.clearRect(
      0,
      0,
      width,
      height
    );

    ctx.restore();

    // -------------------------------------------------------
    // BACKGROUND
    // -------------------------------------------------------

    ctx.save();

    ctx.fillStyle = "#0b0f14";

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    ctx.restore();

    var data = getMasterData();

    if (!data) {
      drawEmpty(
        width,
        height,
        "Geometry data not available"
      );
      return;
    }

    if (
      !data.sheet ||
      num(data.sheet.widthIn, 0) <= 0 ||
      num(data.sheet.heightIn, 0) <= 0
    ) {
      drawEmpty(
        width,
        height,
        "Sheet size enter karo"
      );
      return;
    }

    drawSheet(data);

    drawMarkingLines(data);

    drawCuts(data);

    drawDimensions(data);

    drawLegend(data);
  }

  // =========================================================
  // SHEET
  // =========================================================

  function drawSheet(data) {
    var widthIn =
      num(
        data.sheet.widthIn,
        data.sheet.width
      );

    var heightIn =
      num(
        data.sheet.heightIn,
        data.sheet.height
      );

    var x =
      offsetX;

    var y =
      offsetY;

    var width =
      widthIn * scale;

    var height =
      heightIn * scale;

    // -------------------------------------------------------
    // SHEET BODY
    // -------------------------------------------------------

    ctx.save();

    ctx.fillStyle = "#c7ccd1";

    ctx.fillRect(
      x,
      y,
      width,
      height
    );

    ctx.strokeStyle = "#ffffff";

    ctx.lineWidth = 2;

    ctx.strokeRect(
      x,
      y,
      width,
      height
    );

    ctx.restore();

    // -------------------------------------------------------
    // VERY LIGHT GRID
    // -------------------------------------------------------

    drawSheetGrid(
      x,
      y,
      width,
      height
    );
  }

  // =========================================================
  // SHEET GRID
  // =========================================================

  function drawSheetGrid(
    x,
    y,
    width,
    height
  ) {
    ctx.save();

    ctx.strokeStyle =
      "rgba(60,70,80,0.18)";

    ctx.lineWidth = 1;

    var grid = scale;

    if (grid < 20) {
      ctx.restore();
      return;
    }

    for (
      var gx = x + grid;
      gx < x + width;
      gx += grid
    ) {
      ctx.beginPath();

      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + height);

      ctx.stroke();
    }

    for (
      var gy = y + grid;
      gy < y + height;
      gy += grid
    ) {
      ctx.beginPath();

      ctx.moveTo(x, gy);
      ctx.lineTo(x + width, gy);

      ctx.stroke();
    }

    ctx.restore();
  }

  // =========================================================
  // MARKING LINES
  // =========================================================

  function drawMarkingLines(data) {
    var sheet =
      data.sheet || {};

    var sheetWidth =
      num(
        sheet.widthIn,
        sheet.width
      );

    var sheetHeight =
      num(
        sheet.heightIn,
        sheet.height
      );

    var x0 =
      offsetX;

    var y0 =
      offsetY;

    // -------------------------------------------------------
    // LENGTH LINES
    // -------------------------------------------------------

    var lengthLines =
      Array.isArray(data.lengthLines)
        ? data.lengthLines
        : [];

    for (
      var i = 0;
      i < lengthLines.length;
      i++
    ) {
      var line =
        lengthLines[i];

      var pos =
        num(
          line.positionInch,
          num(line.position, 0)
        );

      if (
        pos < 0 ||
        pos > sheetWidth
      ) {
        continue;
      }

      var x =
        x0 +
        pos * scale;

      drawVerticalMark(
        x,
        y0,
        y0 + sheetHeight * scale,
        line
      );
    }

    // -------------------------------------------------------
    // DEPTH LINES
    // -------------------------------------------------------

    var depthLines =
      Array.isArray(data.depthLines)
        ? data.depthLines
        : [];

    for (
      var j = 0;
      j < depthLines.length;
      j++
    ) {
      var dline =
        depthLines[j];

      var dpos =
        num(
          dline.positionInch,
          num(dline.position, 0)
        );

      if (
        dpos < 0 ||
        dpos > sheetHeight
      ) {
        continue;
      }

      var y =
        y0 +
        dpos * scale;

      drawHorizontalMark(
        y,
        x0,
        x0 + sheetWidth * scale,
        dline
      );
    }
  }

  // =========================================================
  // VERTICAL MARK
  // =========================================================

  function drawVerticalMark(
    x,
    y1,
    y2,
    line
  ) {
    ctx.save();

    ctx.strokeStyle = "#1677ff";

    ctx.lineWidth = 2;

    ctx.setLineDash([
      8,
      5
    ]);

    ctx.beginPath();

    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);

    ctx.stroke();

    ctx.setLineDash([]);

    drawLineLabel(
      x + 5,
      y1 + 18,
      line
    );

    ctx.restore();
  }

  // =========================================================
  // HORIZONTAL MARK
  // =========================================================

  function drawHorizontalMark(
    y,
    x1,
    x2,
    line
  ) {
    ctx.save();

    ctx.strokeStyle = "#1677ff";

    ctx.lineWidth = 2;

    ctx.setLineDash([
      8,
      5
    ]);

    ctx.beginPath();

    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);

    ctx.stroke();

    ctx.setLineDash([]);

    drawLineLabel(
      x1 + 5,
      y - 7,
      line
    );

    ctx.restore();
  }

  // =========================================================
  // LINE LABEL
  // =========================================================

  function drawLineLabel(
    x,
    y,
    line
  ) {
    if (!line) return;

    var id =
      line.id ||
      "";

    var angle =
      num(
        line.angle,
        num(
          line.angleDeg,
          0
        )
      );

    var direction =
      String(
        line.direction ||
        ""
      ).toUpperCase();

    var text =
      id;

    if (angle) {
      text +=
        " " +
        formatNumber(angle) +
        "°";
    }

    if (direction) {
      text +=
        " " +
        direction;
    }

    ctx.save();

    ctx.font =
      "bold 11px Arial";

    ctx.fillStyle =
      "#0b4aa2";

    ctx.fillText(
      text,
      x,
      y
    );

    ctx.restore();
  }

  // =========================================================
  // CUP CUTS / NOTCHES
  // =========================================================

  function drawCuts(data) {
    var cuts =
      Array.isArray(data.cuts)
        ? data.cuts
        : [];

    if (!cuts.length) return;

    for (
      var i = 0;
      i < cuts.length;
      i++
    ) {
      var cut =
        cuts[i];

      if (!cut) continue;

      // -----------------------------------------------------
      // Hidden cut
      // -----------------------------------------------------

      var cutId =
        cut.id ||
        cut.lineId ||
        "";

      if (
        window.view3d &&
        Array.isArray(
          window.view3d.hiddenCuts
        ) &&
        window.view3d.hiddenCuts.indexOf(
          cutId
        ) !== -1
      ) {
        continue;
      }

      var pos =
        cut.position ||
        {};

      var xIn =
        num(
          pos.x,
          num(
            cut.x,
            0
          )
        );

      var yIn =
        num(
          pos.y,
          num(
            cut.y,
            0
          )
        );

      var widthIn =
        num(
          cut.widthIn,
          num(
            cut.width,
            0.1
          )
        );

      var depthIn =
        num(
          cut.depthIn,
          num(
            cut.depth,
            0.1
          )
        );

      var x =
        offsetX +
        xIn * scale;

      var y =
        offsetY +
        yIn * scale;

      var width =
        Math.max(
          4,
          widthIn * scale
        );

      var height =
        Math.max(
          4,
          depthIn * scale
        );

      drawSingleCut(
        x,
        y,
        width,
        height,
        cut
      );
    }
  }

  // =========================================================
  // SINGLE CUT
  // =========================================================

  function drawSingleCut(
    x,
    y,
    width,
    height,
    cut
  ) {
    ctx.save();

    // -------------------------------------------------------
    // Red cut area
    // -------------------------------------------------------

    ctx.fillStyle =
      "rgba(220,35,35,0.90)";

    ctx.fillRect(
      x,
      y,
      width,
      height
    );

    // -------------------------------------------------------
    // White edge
    // -------------------------------------------------------

    ctx.strokeStyle =
      "#ffdddd";

    ctx.lineWidth = 1.5;

    ctx.strokeRect(
      x,
      y,
      width,
      height
    );

    // -------------------------------------------------------
    // X marker
    // -------------------------------------------------------

    ctx.strokeStyle =
      "#ffffff";

    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.moveTo(
      x,
      y
    );

    ctx.lineTo(
      x + width,
      y + height
    );

    ctx.moveTo(
      x + width,
      y
    );

    ctx.lineTo(
      x,
      y + height
    );

    ctx.stroke();

    // -------------------------------------------------------
    // CUT label
    // -------------------------------------------------------

    ctx.font =
      "bold 10px Arial";

    ctx.fillStyle =
      "#ffffff";

    ctx.fillText(
      "CUT",
      x + 3,
      y + 12
    );

    ctx.restore();
  }

  // =========================================================
  // DIMENSIONS
  // =========================================================

  function drawDimensions(data) {
    if (!data.sheet) return;

    var widthIn =
      num(
        data.sheet.widthIn,
        data.sheet.width
      );

    var heightIn =
      num(
        data.sheet.heightIn,
        data.sheet.height
      );

    var x =
      offsetX;

    var y =
      offsetY;

    var width =
      widthIn * scale;

    var height =
      heightIn * scale;

    // -------------------------------------------------------
    // WIDTH
    // -------------------------------------------------------

    drawHorizontalDimension(
      x,
      y - 20,
      x + width,
      y - 20,
      formatInch(widthIn)
    );

    // -------------------------------------------------------
    // HEIGHT
    // -------------------------------------------------------

    drawVerticalDimension(
      x - 25,
      y,
      x - 25,
      y + height,
      formatInch(heightIn)
    );
  }

  // =========================================================
  // HORIZONTAL DIMENSION
  // =========================================================

  function drawHorizontalDimension(
    x1,
    y1,
    x2,
    y2,
    label
  ) {
    ctx.save();

    ctx.strokeStyle =
      "#222222";

    ctx.fillStyle =
      "#111111";

    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    ctx.stroke();

    drawArrow(
      x1,
      y1,
      0
    );

    drawArrow(
      x2,
      y2,
      Math.PI
    );

    ctx.font =
      "bold 12px Arial";

    var middle =
      (x1 + x2) / 2;

    ctx.fillText(
      label,
      middle - 15,
      y1 - 5
    );

    ctx.restore();
  }

  // =========================================================
  // VERTICAL DIMENSION
  // =========================================================

  function drawVerticalDimension(
    x1,
    y1,
    x2,
    y2,
    label
  ) {
    ctx.save();

    ctx.strokeStyle =
      "#222222";

    ctx.fillStyle =
      "#111111";

    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    ctx.stroke();

    drawArrow(
      x1,
      y1,
      Math.PI / 2
    );

    drawArrow(
      x2,
      y2,
      -Math.PI / 2
    );

    ctx.save();

    ctx.translate(
      x1 - 7,
      (y1 + y2) / 2
    );

    ctx.rotate(
      -Math.PI / 2
    );

    ctx.font =
      "bold 12px Arial";

    ctx.fillText(
      label,
      -15,
      0
    );

    ctx.restore();

    ctx.restore();
  }

  // =========================================================
  // ARROW
  // =========================================================

  function drawArrow(
    x,
    y,
    angle
  ) {
    var size = 6;

    ctx.beginPath();

    ctx.moveTo(
      x,
      y
    );

    ctx.lineTo(
      x -
        Math.cos(angle - 0.5) *
        size,
      y -
        Math.sin(angle - 0.5) *
        size
    );

    ctx.lineTo(
      x -
        Math.cos(angle + 0.5) *
        size,
      y -
        Math.sin(angle + 0.5) *
        size
    );

    ctx.closePath();

    ctx.fill();
  }

  // =========================================================
  // LEGEND
  // =========================================================

  function drawLegend(data) {
    var width =
      canvas.clientWidth ||
      canvas.width;

    var height =
      canvas.clientHeight ||
      canvas.height;

    var x = 10;
    var y = height - 75;

    ctx.save();

    ctx.font =
      "11px Arial";

    // -------------------------------------------------------
    // Blue
    // -------------------------------------------------------

    ctx.strokeStyle =
      "#1677ff";

    ctx.lineWidth = 3;

    ctx.beginPath();

    ctx.moveTo(
      x,
      y
    );

    ctx.lineTo(
      x + 25,
      y
    );

    ctx.stroke();

    ctx.fillStyle =
      "#ffffff";

    ctx.fillText(
      "BEND / MARK",
      x + 32,
      y + 4
    );

    // -------------------------------------------------------
    // Red
    // -------------------------------------------------------

    y += 22;

    ctx.fillStyle =
      "#dc2323";

    ctx.fillRect(
      x,
      y - 8,
      25,
      12
    );

    ctx.fillStyle =
      "#ffffff";

    ctx.fillText(
      "CUP CUT / NOTCH",
      x + 32,
      y + 3
    );

    // -------------------------------------------------------
    // Summary
    // -------------------------------------------------------

    if (data.sequence) {
      y += 22;

      ctx.fillStyle =
        "#ffffff";

      ctx.fillText(
        "Bend Sequence: " +
          formatNumber(
            data.sequence.length ||
            0
          ),
        x,
        y
      );
    }

    ctx.restore();
  }

  // =========================================================
  // EMPTY
  // =========================================================

  function drawEmpty(
    width,
    height,
    message
  ) {
    ctx.save();

    ctx.fillStyle =
      "#9aa3ad";

    ctx.font =
      "bold 15px Arial";

    ctx.textAlign =
      "center";

    ctx.fillText(
      message,
      width / 2,
      height / 2
    );

    ctx.restore();
  }

  // =========================================================
  // FIT TO SCREEN
  // =========================================================

  function fit() {
    var data =
      getMasterData();

    if (
      !data ||
      !data.sheet
    ) {
      return;
    }

    var widthIn =
      num(
        data.sheet.widthIn,
        data.sheet.width
      );

    var heightIn =
      num(
        data.sheet.heightIn,
        data.sheet.height
      );

    var width =
      canvas.clientWidth ||
      320;

    var height =
      canvas.clientHeight ||
      420;

    var availableWidth =
      Math.max(
        width - 90,
        100
      );

    var availableHeight =
      Math.max(
        height - 100,
        100
      );

    var sx =
      availableWidth /
      Math.max(widthIn, 1);

    var sy =
      availableHeight /
      Math.max(heightIn, 1);

    scale =
      Math.min(
        sx,
        sy
      );

    scale =
      Math.max(
        minScale,
        Math.min(
          maxScale,
          scale
        )
      );

    offsetX =
      (width -
        widthIn * scale) /
      2;

    offsetY =
      (height -
        heightIn * scale) /
      2;

    offsetY =
      Math.max(
        offsetY,
        45
      );

    draw();
  }

  // =========================================================
  // ZOOM
  // =========================================================

  function zoomIn() {
    scale *= 1.2;

    scale =
      Math.min(
        maxScale,
        scale
      );

    draw();
  }

  function zoomOut() {
    scale *= 0.8;

    scale =
      Math.max(
        minScale,
        scale
      );

    draw();
  }

  // =========================================================
  // RESET
  // =========================================================

  function reset() {
    scale = 45;

    offsetX = 40;
    offsetY = 40;

    fit();
  }

  // =========================================================
  // PRINT
  // =========================================================

  function print() {
    window.print();
  }

  // =========================================================
  // EXPOSE
  // =========================================================

  window.FlatView = {

    init: init,

    draw: draw,

    fit: fit,

    zoomIn: zoomIn,

    zoomOut: zoomOut,

    reset: reset,

    print: print
  };

  // Compatibility
  window.Flat = window.FlatView;

})();
