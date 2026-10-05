/* =========================================================
   FLAT.JS
   FLAT VIEW — MASTER GEOMETRY V7
   ---------------------------------------------------------
   IMPORTANT:
   Flat does NOT calculate engineering.

   GeometryEngine = BRAIN
   Flat = 2D EYES

   FLOW:
   GeometryEngine.analyze()
        ↓
   master sheet
        ↓
   bend positions
        ↓
   intersections
        ↓
   cup cuts
        ↓
   canvas drawing
   ========================================================= */

(function () {

  "use strict";

  var canvas = null;
  var ctx = null;
  var container = null;

  var masterData = null;

  var resizeTimer = null;


  /* =========================================================
     HELPERS
     ========================================================= */

  function $(id) {
    return document.getElementById(id);
  }


  function num(v, fallback) {

    var n = parseFloat(v);

    return Number.isFinite(n)
      ? n
      : (fallback || 0);
  }


  function inchToMM(v) {

    return num(v) * 25.4;
  }


  function getState() {

    return (
      window.AppState ||
      window.state ||
      {}
    );
  }


  /* =========================================================
     MASTER DATA
     ========================================================= */

  function getMasterData() {

    if (
      !window.GeometryEngine ||
      typeof window.GeometryEngine.analyze !== "function"
    ) {

      console.error(
        "Flat: GeometryEngine not available"
      );

      return null;
    }

    try {

      masterData =
        window.GeometryEngine.analyze(
          getState()
        );

      return masterData;

    } catch (err) {

      console.error(
        "Flat: GeometryEngine analyze failed",
        err
      );

      return null;
    }
  }


  /* =========================================================
     INIT
     ========================================================= */

  function init() {

    container =
      $("flat-container");

    canvas =
      $("canvasFlat");

    if (!canvas) {

      console.warn(
        "Flat: #canvasFlat not found"
      );

      return;
    }

    ctx =
      canvas.getContext(
        "2d"
      );

    bindEvents();

    resize();

    draw();
  }


  /* =========================================================
     EVENTS
     ========================================================= */

  function bindEvents() {

    window.addEventListener(
      "resize",
      function () {

        clearTimeout(
          resizeTimer
        );

        resizeTimer =
          setTimeout(
            function () {

              resize();
              draw();

            },
            100
          );
      }
    );


    canvas.addEventListener(
      "wheel",
      function (e) {

        e.preventDefault();

        if (!window.flatView) {

          window.flatView = {
            zoom: 1,
            panX: 0,
            panY: 0
          };
        }

        var factor =
          e.deltaY < 0
            ? 1.1
            : 0.9;

        window.flatView.zoom =
          Math.max(
            window.ZOOM_MIN || 0.2,
            Math.min(
              window.ZOOM_MAX || 20,
              window.flatView.zoom *
              factor
            )
          );

        draw();

      },
      {
        passive: false
      }
    );


    var dragging = false;

    var lastX = 0;
    var lastY = 0;


    canvas.addEventListener(
      "pointerdown",
      function (e) {

        dragging = true;

        lastX = e.clientX;
        lastY = e.clientY;

        canvas.setPointerCapture(
          e.pointerId
        );
      }
    );


    canvas.addEventListener(
      "pointermove",
      function (e) {

        if (!dragging) {
          return;
        }

        if (!window.flatView) {

          window.flatView = {
            zoom: 1,
            panX: 0,
            panY: 0
          };
        }

        var dx =
          e.clientX - lastX;

        var dy =
          e.clientY - lastY;

        window.flatView.panX += dx;
        window.flatView.panY += dy;

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


    /*
       Tap a red cut to hide/show it.
    */

    canvas.addEventListener(
      "click",
      function (e) {

        toggleCutAtPoint(
          e.clientX,
          e.clientY
        );
      }
    );
  }


  /* =========================================================
     RESIZE
     ========================================================= */

  function resize() {

    if (!canvas) {
      return;
    }

    var rect =
      canvas.getBoundingClientRect();

    var dpr =
      window.devicePixelRatio || 1;

    var width =
      Math.max(
        300,
        rect.width || 300
      );

    var height =
      Math.max(
        300,
        rect.height || 300
      );

    canvas.width =
      Math.round(
        width * dpr
      );

    canvas.height =
      Math.round(
        height * dpr
      );

    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );
  }


  /* =========================================================
     VIEW TRANSFORM
     ========================================================= */

  function getView() {

    if (!window.flatView) {

      window.flatView = {

        zoom: 1,

        panX: 0,

        panY: 0
      };
    }

    return window.flatView;
  }


  function calculateScale(data) {

    var view =
      getView();

    var widthInch =
      num(
        data.sheet &&
        data.sheet.widthInch,
        data.totals &&
        data.totals.length
      );

    var heightInch =
      num(
        data.sheet &&
        data.sheet.heightInch,
        data.totals &&
        data.totals.depth
      );

    widthInch =
      Math.max(
        widthInch,
        0.001
      );

    heightInch =
      Math.max(
        heightInch,
        0.001
      );

    var rect =
      canvas.getBoundingClientRect();

    var availableW =
      Math.max(
        100,
        rect.width - 100
      );

    var availableH =
      Math.max(
        100,
        rect.height - 100
      );

    var sx =
      availableW /
      inchToMM(widthInch);

    var sy =
      availableH /
      inchToMM(heightInch);

    return (
      Math.min(
        sx,
        sy
      ) *
      view.zoom
    );
  }


  function sheetToCanvas(
    xInch,
    yInch,
    data
  ) {

    var scale =
      calculateScale(data);

    var view =
      getView();

    var width =
      canvas.getBoundingClientRect().width;

    var height =
      canvas.getBoundingClientRect().height;

    var sheetW =
      inchToMM(
        num(
          data.sheet.widthInch
        )
      ) * scale;

    var sheetH =
      inchToMM(
        num(
          data.sheet.heightInch
        )
      ) * scale;

    var originX =
      (
        width -
        sheetW
      ) / 2 +
      view.panX;

    var originY =
      (
        height -
        sheetH
      ) / 2 +
      view.panY;

    return {

      x:
        originX +
        inchToMM(xInch) *
        scale,

      y:
        originY +
        inchToMM(yInch) *
        scale
    };
  }


  /* =========================================================
     DRAW
     ========================================================= */

  function draw() {

    if (!canvas || !ctx) {
      return;
    }

    var data =
      getMasterData();

    if (!data) {
      return;
    }

    masterData =
      data;

    var rect =
      canvas.getBoundingClientRect();

    var width =
      rect.width;

    var height =
      rect.height;

    ctx.clearRect(
      0,
      0,
      width,
      height
    );

    drawBackground(
      width,
      height
    );

    drawSheetOutline(
      data
    );

    drawGrid(
      data
    );

    drawMarkingLines(
      data
    );

    drawIntersections(
      data
    );

    drawCuts(
      data
    );

    drawDimensions(
      data
    );

    drawLegend(
      data
    );
  }


  /* =========================================================
     BACKGROUND
     ========================================================= */

  function drawBackground(
    width,
    height
  ) {

    ctx.fillStyle =
      "#111318";

    ctx.fillRect(
      0,
      0,
      width,
      height
    );
  }


  /* =========================================================
     SHEET OUTLINE
     ========================================================= */

  function drawSheetOutline(
    data
  ) {

    var sheet =
      data.sheet;

    if (!sheet) {
      return;
    }

    var p0 =
      sheetToCanvas(
        0,
        0,
        data
      );

    var p1 =
      sheetToCanvas(
        sheet.widthInch,
        sheet.heightInch,
        data
      );

    var x =
      p0.x;

    var y =
      p0.y;

    var w =
      p1.x - p0.x;

    var h =
      p1.y - p0.y;

    ctx.save();

    ctx.fillStyle =
      "#d8d8d8";

    ctx.fillRect(
      x,
      y,
      w,
      h
    );

    ctx.strokeStyle =
      "#ffffff";

    ctx.lineWidth =
      2;

    ctx.strokeRect(
      x,
      y,
      w,
      h
    );

    ctx.restore();
  }


  /* =========================================================
     GRID
     ========================================================= */

  function drawGrid(
    data
  ) {

    var sheet =
      data.sheet;

    if (!sheet) {
      return;
    }

    var maxX =
      num(
        sheet.widthInch
      );

    var maxY =
      num(
        sheet.heightInch
      );

    ctx.save();

    ctx.strokeStyle =
      "rgba(0,0,0,0.10)";

    ctx.lineWidth =
      1;

    /*
       1 inch grid
    */

    for (
      var x = 1;
      x < maxX;
      x++
    ) {

      var a =
        sheetToCanvas(
          x,
          0,
          data
        );

      var b =
        sheetToCanvas(
          x,
          maxY,
          data
        );

      ctx.beginPath();

      ctx.moveTo(
        a.x,
        a.y
      );

      ctx.lineTo(
        b.x,
        b.y
      );

      ctx.stroke();
    }


    for (
      var y = 1;
      y < maxY;
      y++
    ) {

      var c =
        sheetToCanvas(
          0,
          y,
          data
        );

      var d =
        sheetToCanvas(
          maxX,
          y,
          data
        );

      ctx.beginPath();

      ctx.moveTo(
        c.x,
        c.y
      );

      ctx.lineTo(
        d.x,
        d.y
      );

      ctx.stroke();
    }

    ctx.restore();
  }


  /* =========================================================
     MARKING LINES
     ========================================================= */

  function drawMarkingLines(
    data
  ) {

    var lengthLines =
      data.flat &&
      data.flat.lengthLines
        ? data.flat.lengthLines
        : [];

    var depthLines =
      data.flat &&
      data.flat.depthLines
        ? data.flat.depthLines
        : [];


    /*
       LENGTH BENDS
       vertical
    */

    lengthLines.forEach(
      function (line) {

        if (
          !line.isBend
        ) {
          return;
        }

        var x =
          line.bendCenterInch;

        /*
           If this bend is replaced
           by a physical cup cut,
           don't draw the blue line
           through the cut area.
        */

        var cut =
          findCutForLengthLine(
            data,
            line.id
          );

        if (cut) {

          drawVerticalBendWithCut(
            x,
            cut,
            data,
            line
          );

        } else {

          drawVerticalBend(
            x,
            data,
            line
          );
        }
      }
    );


    /*
       DEPTH BENDS
       horizontal
    */

    depthLines.forEach(
      function (line) {

        if (
          !line.isBend
        ) {
          return;
        }

        var y =
          line.bendCenterInch;

        var cut =
          findCutForDepthLine(
            data,
            line.id
          );

        if (cut) {

          drawHorizontalBendWithCut(
            y,
            cut,
            data,
            line
          );

        } else {

          drawHorizontalBend(
            y,
            data,
            line
          );
        }
      }
    );
  }


  /* =========================================================
     BLUE BEND LINE
     ========================================================= */

  function drawVerticalBend(
    xInch,
    data,
    line
  ) {

    var a =
      sheetToCanvas(
        xInch,
        0,
        data
      );

    var b =
      sheetToCanvas(
        xInch,
        data.sheet.heightInch,
        data
      );

    ctx.save();

    ctx.strokeStyle =
      "#2388ff";

    ctx.lineWidth =
      2;

    ctx.setLineDash(
      [8, 6]
    );

    ctx.beginPath();

    ctx.moveTo(
      a.x,
      a.y
    );

    ctx.lineTo(
      b.x,
      b.y
    );

    ctx.stroke();

    ctx.setLineDash([]);

    drawLineLabel(
      a.x + 5,
      a.y + 16,
      line.id +
      " " +
      line.angle +
      "° " +
      line.direction
    );

    ctx.restore();
  }


  function drawHorizontalBend(
    yInch,
    data,
    line
  ) {

    var a =
      sheetToCanvas(
        0,
        yInch,
        data
      );

    var b =
      sheetToCanvas(
        data.sheet.widthInch,
        yInch,
        data
      );

    ctx.save();

    ctx.strokeStyle =
      "#2388ff";

    ctx.lineWidth =
      2;

    ctx.setLineDash(
      [8, 6]
    );

    ctx.beginPath();

    ctx.moveTo(
      a.x,
      a.y
    );

    ctx.lineTo(
      b.x,
      b.y
    );

    ctx.stroke();

    ctx.setLineDash([]);

    drawLineLabel(
      a.x + 5,
      a.y + 16,
      line.id +
      " " +
      line.angle +
      "° " +
      line.direction
    );

    ctx.restore();
  }


  /* =========================================================
     BEND + CUT
     ---------------------------------------------------------
     RED CUT REPLACES BLUE LINE.
     ========================================================= */

  function drawVerticalBendWithCut(
    xInch,
    cut,
    data,
    line
  ) {

    var top =
      sheetToCanvas(
        xInch,
        0,
        data
      );

    var bottom =
      sheetToCanvas(
        xInch,
        data.sheet.heightInch,
        data
      );

    var center =
      sheetToCanvas(
        cut.xInch,
        cut.yInch,
        data
      );

    var cutDepthInch =
      num(
        cut.depthInch,
        0
      );

    var cutHalf =
      cutDepthInch / 2;

    var y1 =
      sheetToCanvas(
        xInch,
        Math.max(
          0,
          cut.yInch -
          cutHalf
        ),
        data
      );

    var y2 =
      sheetToCanvas(
        xInch,
        Math.min(
          data.sheet.heightInch,
          cut.yInch +
          cutHalf
        ),
        data
      );


    ctx.save();

    ctx.strokeStyle =
      "#2388ff";

    ctx.lineWidth =
      2;

    ctx.setLineDash(
      [8, 6]
    );

    ctx.beginPath();

    ctx.moveTo(
      top.x,
      top.y
    );

    ctx.lineTo(
      y1.x,
      y1.y
    );

    ctx.moveTo(
      y2.x,
      y2.y
    );

    ctx.lineTo(
      bottom.x,
      bottom.y
    );

    ctx.stroke();

    ctx.setLineDash([]);

    /*
       RED PHYSICAL CUT
    */

    drawCutShape(
      cut,
      data
    );

    ctx.restore();
  }


  function drawHorizontalBendWithCut(
    yInch,
    cut,
    data,
    line
  ) {

    var left =
      sheetToCanvas(
        0,
        yInch,
        data
      );

    var right =
      sheetToCanvas(
        data.sheet.widthInch,
        yInch,
        data
      );

    var cutDepthInch =
      num(
        cut.depthInch,
        0
      );

    var cutHalf =
      cutDepthInch / 2;

    var x1 =
      sheetToCanvas(
        Math.max(
          0,
          cut.xInch -
          cutHalf
        ),
        yInch,
        data
      );

    var x2 =
      sheetToCanvas(
        Math.min(
          data.sheet.widthInch,
          cut.xInch +
          cutHalf
        ),
        yInch,
        data
      );


    ctx.save();

    ctx.strokeStyle =
      "#2388ff";

    ctx.lineWidth =
      2;

    ctx.setLineDash(
      [8, 6]
    );

    ctx.beginPath();

    ctx.moveTo(
      left.x,
      left.y
    );

    ctx.lineTo(
      x1.x,
      x1.y
    );

    ctx.moveTo(
      x2.x,
      x2.y
    );

    ctx.lineTo(
      right.x,
      right.y
    );

    ctx.stroke();

    ctx.setLineDash([]);

    drawCutShape(
      cut,
      data
    );

    ctx.restore();
  }


  /* =========================================================
     FIND CUTS
     ========================================================= */

  function findCutForLengthLine(
    data,
    id
  ) {

    var cuts =
      data.cuts || [];

    for (
      var i = 0;
      i < cuts.length;
      i++
    ) {

      if (
        cuts[i].lengthId === id &&
        !isCutHidden(cuts[i])
      ) {
        return cuts[i];
      }
    }

    return null;
  }


  function findCutForDepthLine(
    data,
    id
  ) {

    var cuts =
      data.cuts || [];

    for (
      var i = 0;
      i < cuts.length;
      i++
    ) {

      if (
        cuts[i].depthId === id &&
        !isCutHidden(cuts[i])
      ) {
        return cuts[i];
      }
    }

    return null;
  }


  function isCutHidden(cut) {

    if (!cut) {
      return false;
    }

    if (cut.hidden) {
      return true;
    }

    var hidden =
      window.hiddenCuts ||
      {};

    return !!hidden[
      cut.id
    ];
  }


  /* =========================================================
     CUT SHAPE
     ========================================================= */

  function drawCutShape(
    cut,
    data
  ) {

    if (
      !cut ||
      isCutHidden(cut)
    ) {
      return;
    }

    var x =
      num(cut.xInch);

    var y =
      num(cut.yInch);

    var width =
      num(cut.widthInch);

    var depth =
      num(cut.depthInch);


    var p1 =
      sheetToCanvas(
        x - width / 2,
        y - depth / 2,
        data
      );

    var p2 =
      sheetToCanvas(
        x + width / 2,
        y + depth / 2,
        data
      );

    var w =
      p2.x - p1.x;

    var h =
      p2.y - p1.y;


    ctx.save();

    /*
       Red = physical cup cut
    */

    ctx.fillStyle =
      "rgba(220,40,40,0.85)";

    ctx.strokeStyle =
      "#ff3030";

    ctx.lineWidth =
      2;

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

    ctx.strokeStyle =
      "#ffffff";

    ctx.lineWidth =
      1.5;

    ctx.beginPath();

    ctx.moveTo(
      p1.x,
      p1.y
    );

    ctx.lineTo(
      p2.x,
      p2.y
    );

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
       Label
    */

    ctx.fillStyle =
      "#ffffff";

    ctx.font =
      "bold 11px Arial";

    ctx.fillText(
      "CUT",
      p1.x + 4,
      p1.y + 13
    );

    ctx.restore();
  }


  /* =========================================================
     INTERSECTIONS
     ========================================================= */

  function drawIntersections(
    data
  ) {

    var list =
      data.intersections || [];

    ctx.save();

    list.forEach(
      function (item) {

        var p =
          sheetToCanvas(
            item.xInch,
            item.yInch,
            data
          );

        var required =
          item.interaction &&
          item.interaction.required;

        /*
           If physical cut exists,
           red cut will represent this point.
        */

        if (required) {
          return;
        }

        ctx.fillStyle =
          "#ffb400";

        ctx.beginPath();

        ctx.arc(
          p.x,
          p.y,
          3,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }
    );

    ctx.restore();
  }


  /* =========================================================
     DIMENSIONS
     ========================================================= */

  function drawDimensions(
    data
  ) {

    var sheet =
      data.sheet;

    if (!sheet) {
      return;
    }

    var pLeft =
      sheetToCanvas(
        0,
        sheet.heightInch,
        data
      );

    var pRight =
      sheetToCanvas(
        sheet.widthInch,
        sheet.heightInch,
        data
      );

    var pTop =
      sheetToCanvas(
        0,
        0,
        data
      );

    ctx.save();

    ctx.fillStyle =
      "#111111";

    ctx.font =
      "bold 12px Arial";

    ctx.textAlign =
      "center";

    ctx.fillText(
      formatSize(
        sheet.widthInch
      ),
      (
        pLeft.x +
        pRight.x
      ) / 2,
      pLeft.y + 25
    );

    ctx.textAlign =
      "left";

    ctx.fillText(
      formatSize(
        sheet.heightInch
      ),
      pTop.x - 5,
      (
        pTop.y +
        pLeft.y
      ) / 2
    );

    ctx.restore();
  }


  function formatSize(
    inch
  ) {

    if (
      window.Core &&
      typeof window.Core.formatInch ===
      "function"
    ) {

      return window.Core.formatInch(
        inch
      );
    }

    return (
      Math.round(
        num(inch) * 16
      ) / 16
    ) + '"';
  }


  /* =========================================================
     LINE LABEL
     ========================================================= */

  function drawLineLabel(
    x,
    y,
    text
  ) {

    ctx.save();

    ctx.fillStyle =
      "#0758b5";

    ctx.font =
      "bold 11px Arial";

    ctx.fillText(
      text,
      x,
      y
    );

    ctx.restore();
  }


  /* =========================================================
     LEGEND
     ========================================================= */

  function drawLegend(
    data
  ) {

    var cuts =
      data.cuts || [];

    var bends =
      data.totals
        ? data.totals.totalBends
        : 0;

    ctx.save();

    ctx.font =
      "11px Arial";

    ctx.fillStyle =
      "#222222";

    var x = 15;
    var y = 20;

    ctx.fillText(
      "MASTER FLAT",
      x,
      y
    );

    y += 17;

    ctx.fillStyle =
      "#2388ff";

    ctx.fillText(
      "BEND / MARK",
      x,
      y
    );

    y += 16;

    ctx.fillStyle =
      "#d82020";

    ctx.fillText(
      "CUP CUT: " +
      cuts.length,
      x,
      y
    );

    y += 16;

    ctx.fillStyle =
      "#222222";

    ctx.fillText(
      "BENDS: " +
      bends,
      x,
      y
    );

    ctx.restore();
  }


  /* =========================================================
     CUT HIT TEST
     ========================================================= */

  function toggleCutAtPoint(
    clientX,
    clientY
  ) {

    if (!masterData) {
      return;
    }

    var rect =
      canvas.getBoundingClientRect();

    var px =
      clientX -
      rect.left;

    var py =
      clientY -
      rect.top;

    var cuts =
      masterData.cuts || [];

    for (
      var i = 0;
      i < cuts.length;
      i++
    ) {

      var cut =
        cuts[i];

      var p1 =
        sheetToCanvas(
          cut.xInch -
          cut.widthInch / 2,
          cut.yInch -
          cut.depthInch / 2,
          masterData
        );

      var p2 =
        sheetToCanvas(
          cut.xInch +
          cut.widthInch / 2,
          cut.yInch +
          cut.depthInch / 2,
          masterData
        );

      if (
        px >= p1.x &&
        px <= p2.x &&
        py >= p1.y &&
        py <= p2.y
      ) {

        if (
          !window.hiddenCuts
        ) {

          window.hiddenCuts = {};
        }

        window.hiddenCuts[
          cut.id
        ] =
          !window.hiddenCuts[
            cut.id
          ];

        if (
          window.view3d
        ) {

          window.view3d.hiddenCuts =
            window.hiddenCuts;
        }

        draw();

        return;
      }
    }
  }


  /* =========================================================
     FIT
     ========================================================= */

  function fit() {

    if (!window.flatView) {

      window.flatView = {
        zoom: 1,
        panX: 0,
        panY: 0
      };
    }

    window.flatView.zoom =
      1;

    window.flatView.panX =
      0;

    window.flatView.panY =
      0;

    draw();
  }


  /* =========================================================
     RESET
     ========================================================= */

  function reset() {

    fit();
  }


  /* =========================================================
     ZOOM
     ========================================================= */

  function zoomIn() {

    var view =
      getView();

    view.zoom =
      Math.min(
        window.ZOOM_MAX || 20,
        view.zoom * 1.2
      );

    draw();
  }


  function zoomOut() {

    var view =
      getView();

    view.zoom =
      Math.max(
        window.ZOOM_MIN || 0.2,
        view.zoom * 0.8
      );

    draw();
  }


  /* =========================================================
     PRINT
     ========================================================= */

  function print() {

    window.print();
  }


  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.FlatView = {

    init:
      init,

    draw:
      draw,

    resize:
      resize,

    fit:
      fit,

    reset:
      reset,

    zoomIn:
      zoomIn,

    zoomOut:
      zoomOut,

    print:
      print,

    getMasterData:
      getMasterData
  };


  /*
     Existing sheet.js calls:

       window.Flat.draw()

     Keep compatibility.
  */

  window.Flat =
    window.FlatView;


  console.log(
    "Flat View V7 loaded"
  );

})();

