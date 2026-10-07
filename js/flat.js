/* =========================================================
   FLAT.JS — 2D MASTER FLAT VIEW V9
   ---------------------------------------------------------
   GeometryEngine = SAARI calculation
   Flat.js        = SIRF DIKHANA (display only)

   Is file me koi bend / angle / cup-cut ka hisaab nahi hai.
   Jo bhi number dikhta hai (line ka size, cut ki lambai, angle,
   point ki jagah) wo GeometryEngine.analyze() se aata hai.

   Kya dikhata hai:
     - sheet, grid, blue bend/marking lines (↑ / ↓ + angle)
     - har line ka marking size (upar aur left me)
     - sheet ka total size
     - RED cup cut:
         * seedha chaukor cut  -> sirf laal rang (koi likha nahi)
         * tirchi (degree) cut -> laal rang + naap likha hua:
             kaun si point se kitna, kis angle pe kaatna hai

   Unit option (upar):  inch  |  mm
     inch = sirf inch (1/16 tak: 1/16, 1/8, 3/16, 1/4 ... 7/8)
     mm   = sirf mm
   (Agar UI me ids  flat-unit-inch / flat-unit-mm  ke button
    daal do to wahi use honge, warna yahin se ban jate hain.)

   Zoom / pan / pinch / reset, cut pe click = hide/show.
   Public API purana hi hai + setUnit / getUnit.
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
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getState() {
    return window.AppState || window.state || {};
  }

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
     UNITS (sirf formatting — geometry se aaye number ko likhna)
     ---------------------------------------------------------
     inch -> 1/16 tak fraction, mm -> 1 decimal
     ========================================================= */

  var unit = "inch";

  try {
    var savedUnit = window.localStorage.getItem("flatUnit");
    if (savedUnit === "mm" || savedUnit === "inch") { unit = savedUnit; }
  } catch (e) { /* ignore */ }

  function gcd(a, b) {
    return b ? gcd(b, a % b) : a;
  }

  function fmtInch(v) {

    var x = Math.max(0, num(v));

    var sixteenths = Math.round(x * 16);

    if (sixteenths === 0 && x > 1e-6) { sixteenths = 1; }

    var w = Math.floor(sixteenths / 16);
    var f = sixteenths % 16;

    var s = "";

    if (w > 0) { s += w; }

    if (f > 0) {
      var g = gcd(f, 16);
      s += (w > 0 ? " " : "") + (f / g) + "/" + (16 / g);
    }

    if (!s) { s = "0"; }

    return s + '"';
  }

  function fmtMM(v) {

    var x = Math.max(0, num(v));

    var s = (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, "");

    return s + "mm";
  }

  /* geometry ke {inch, mm} pair se ya (inch, mm) numbers se */
  function show(a, b) {

    if (a && typeof a === "object") {
      return unit === "mm" ? fmtMM(a.mm) : fmtInch(a.inch);
    }

    return unit === "mm" ? fmtMM(b) : fmtInch(a);
  }

  function fmtAngle(deg) {
    return (Math.round(num(deg) * 10) / 10).toString() + "°";
  }


  /* =========================================================
     STATE
     ========================================================= */

  var canvas = null;
  var ctx = null;

  var view = { zoom: 1, panX: 0, panY: 0 };

  var fitZoomValue = 1;

  var pointers = {};
  var lastPinch = 0;

  var currentData = null;

  var boundButtons = false;


  /* =========================================================
     CANVAS
     ========================================================= */

  function getCanvas() {

    if (canvas && ctx) { return true; }

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

    if (!canvas) { return; }

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

  function getCanvasSize() {

    return {
      width: canvas._logicalWidth || canvas.clientWidth || 800,
      height: canvas._logicalHeight || canvas.clientHeight || 500
    };
  }


  /* =========================================================
     VIEW TRANSFORM  (world = inch, x = length, y = depth)
     ========================================================= */

  function getSheetSize(data) {

    var sheet = data && data.sheet ? data.sheet : {};

    var width =
      num(sheet.widthInch) ||
      num(data && data.totals && data.totals.length) ||
      0;

    var height =
      num(sheet.heightInch) ||
      num(data && data.totals && data.totals.depth) ||
      0;

    return { width: width, height: height };
  }

  var MARGIN_TOP = 88;
  var MARGIN_LEFT = 88;
  var MARGIN_OTHER = 40;

  function fitScale(data) {

    var size = getSheetSize(data);
    var c = getCanvasSize();

    if (size.width <= 0 || size.height <= 0) { return 1; }

    var sx = (c.width - MARGIN_LEFT - MARGIN_OTHER) / (size.width * 96);
    var sy = (c.height - MARGIN_TOP - MARGIN_OTHER - 30) / (size.height * 96);

    return clamp(Math.min(sx, sy), 0.05, 8);
  }

  function origin(data) {

    var size = getSheetSize(data);
    var c = getCanvasSize();

    var base = 96 * view.zoom;

    var availW = c.width - MARGIN_LEFT - MARGIN_OTHER;
    var availH = c.height - MARGIN_TOP - MARGIN_OTHER - 30;

    return {
      x: MARGIN_LEFT + (availW - size.width * base) / 2 + view.panX,
      y: MARGIN_TOP + (availH - size.height * base) / 2 + view.panY,
      base: base
    };
  }

  function w2s(x, y, data) {

    var o = origin(data);

    return { x: o.x + x * o.base, y: o.y + y * o.base };
  }

  function s2w(px, py, data) {

    var o = origin(data);

    return { x: (px - o.x) / o.base, y: (py - o.y) / o.base };
  }


  /* =========================================================
     BACKGROUND / SHEET / GRID
     ========================================================= */

  function drawBackground() {

    var c = getCanvasSize();

    ctx.save();
    ctx.fillStyle = "#101418";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
  }

  function drawSheet(data) {

    var size = getSheetSize(data);

    var a = w2s(0, 0, data);
    var b = w2s(size.width, size.height, data);

    ctx.save();

    ctx.fillStyle = "#c8ccd0";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);

    ctx.restore();
  }

  function drawGrid(data) {

    var size = getSheetSize(data);

    /* inch mode: 1 inch ka grid, mm mode: 10 mm ka grid */
    var step = unit === "mm" ? 10 / 25.4 : 1;

    ctx.save();
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "rgba(60,60,60,0.30)";

    var count = 0;

    for (var x = step; x < size.width - 1e-6 && count < 600; x += step, count++) {
      var p1 = w2s(x, 0, data);
      var p2 = w2s(x, size.height, data);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    count = 0;

    for (var y = step; y < size.height - 1e-6 && count < 600; y += step, count++) {
      var q1 = w2s(0, y, data);
      var q2 = w2s(size.width, y, data);
      ctx.beginPath();
      ctx.moveTo(q1.x, q1.y);
      ctx.lineTo(q2.x, q2.y);
      ctx.stroke();
    }

    ctx.restore();
  }


  /* =========================================================
     BEND / MARKING LINES  (geometry: bendCenterInch, isBend)
     ========================================================= */

  function drawBendLine(x1, y1, x2, y2, line, data) {

    var p1 = w2s(x1, y1, data);
    var p2 = w2s(x2, y2, data);

    ctx.save();

    ctx.strokeStyle = "#1976ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    ctx.setLineDash([]);

    var down = String(line.direction || "").toLowerCase() === "down";

    var midX = (p1.x + p2.x) / 2;
    var midY = (p1.y + p2.y) / 2;

    ctx.fillStyle = down ? "#ff9800" : "#00c853";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
      (down ? "↓" : "↑") + fmtAngle(line.angle),
      midX,
      midY - 4
    );

    ctx.restore();
  }

  function drawLengthLines(data) {

    var size = getSheetSize(data);

    (data.lengthLines || []).forEach(function (line) {

      if (!line.isBend) { return; }

      var x = num(line.bendCenterInch, -1);

      if (x <= 1e-6 || x >= size.width - 1e-6) { return; }

      drawBendLine(x, 0, x, size.height, line, data);
    });
  }

  function drawDepthLines(data) {

    var size = getSheetSize(data);

    (data.depthLines || []).forEach(function (line) {

      if (!line.isBend) { return; }

      var y = num(line.bendCenterInch, -1);

      if (y <= 1e-6 || y >= size.height - 1e-6) { return; }

      drawBendLine(0, y, size.width, y, line, data);
    });
  }

  function drawIntersections(data) {

    /* jo point kisi cut ke andar nahi, wahan chhota peela marker */
    ctx.save();
    ctx.fillStyle = "#ffd600";

    (data.intersections || []).forEach(function (item) {

      if (item.required) { return; }

      var p = w2s(num(item.xInch), num(item.yInch), data);

      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }


  /* =========================================================
     CUTS  (geometry: cut.polygons, cut.kinds, cut.marks)
     ========================================================= */

  function isHidden(id) {
    return !!(window.hiddenCuts && window.hiddenCuts[id]);
  }

  function polyScreen(poly, data) {
    return poly.map(function (p) { return w2s(p[0], p[1], data); });
  }

  function pathPoly(pts) {

    ctx.beginPath();

    pts.forEach(function (p, i) {
      if (i === 0) { ctx.moveTo(p.x, p.y); } else { ctx.lineTo(p.x, p.y); }
    });

    ctx.closePath();
  }

  function pill(text, cx, cy, color) {

    ctx.save();

    ctx.font = "bold 11px Arial";

    var w = ctx.measureText(text).width + 8;
    var h = 15;

    ctx.fillStyle = "rgba(10,13,20,0.88)";
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

    ctx.strokeStyle = color || "#ff5252";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy + 0.5);

    ctx.restore();
  }

  function centroid(pts) {

    var x = 0, y = 0;

    pts.forEach(function (p) { x += p.x; y += p.y; });

    return { x: x / pts.length, y: y / pts.length };
  }

  /* tirchi (degree) cut ka naap likhna */
  function drawCutSizes(cut, data) {

    var marks = cut.marks;

    if (!marks || !marks.polygons) { return; }

    /* seedha chaukor cut = sirf laal rang, koi likha nahi */
    var angled = marks.polygons.some(function (poly) {
      return poly.kind === "WEDGE" || poly.kind === "TRIM";
    });

    if (!angled) { return; }

    var byLabel = {};

    (marks.points || []).forEach(function (p) {
      byLabel[p.label] = p;
    });

    var shownPts = {};

    marks.polygons.forEach(function (poly) {

      if (poly.kind !== "WEDGE" && poly.kind !== "TRIM") { return; }

      var scr = poly.points.map(function (lab) {

        var p = byLabel[lab];

        return w2s(p.u.inch, p.v.inch, data);
      });

      var g = centroid(scr);

      poly.edges.forEach(function (edge) {

        var a = byLabel[edge.from];
        var b = byLabel[edge.to];

        if (!a || !b) { return; }

        var pa = w2s(a.u.inch, a.v.inch, data);
        var pb = w2s(b.u.inch, b.v.inch, data);

        var pxLen = Math.hypot(pb.x - pa.x, pb.y - pa.y);

        /* chhote dikhne wali edge pe label nahi (padh nahi paoge):
           neeche wali cut-size list me poora naap hamesha hai */
        if (pxLen < (edge.axis === null ? 110 : 46)) { return; }

        var mx = (pa.x + pb.x) / 2;
        var my = (pa.y + pb.y) / 2;

        var dx = mx - g.x;
        var dy = my - g.y;
        var d = Math.hypot(dx, dy) || 1;

        var off = 16;

        var text = show(edge.length);

        if (edge.axis === null) {
          text += "  @" + fmtAngle(edge.angleDeg);
        }

        pill(text, mx + dx / d * off, my + dy / d * off, "#ff5252");
      });

      /* points: A B C ... */
      poly.points.forEach(function (lab, i) {

        if (lab === "O" || shownPts[lab]) { return; }

        shownPts[lab] = true;

        var p = scr[i];

        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#7f1d1d";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(lab, p.x, p.y - 8);
        ctx.restore();
      });
    });

    /* O = jahan blue lines milti hain (yahin se cut shuru) */
    if (marks.origin) {

      var o = w2s(marks.origin.u.inch, marks.origin.v.inch, data);

      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.fillStyle = "#101418";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(o.x, o.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText("O", o.x, o.y - 9);
      ctx.restore();
    }
  }

  function drawCuts(data) {

    data = data || currentData;

    if (!data || !ctx) { return; }

    (data.cuts || []).forEach(function (cut) {

      var hidden = isHidden(cut.id);

      (cut.polygons || []).forEach(function (poly) {

        var pts = polyScreen(poly, data);

        ctx.save();

        pathPoly(pts);

        if (hidden) {

          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = "rgba(255,32,32,0.6)";
          ctx.lineWidth = 1.5;
          ctx.stroke();

        } else {

          ctx.fillStyle = "rgba(255,32,32,0.92)";
          ctx.fill();

          ctx.strokeStyle = "#8b0000";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.restore();
      });

      if (!hidden) {

        drawCutSizes(cut, data);

        if (cut.needsCheck && cut.marks && cut.marks.origin) {

          var o = w2s(
            cut.marks.origin.u.inch,
            cut.marks.origin.v.inch,
            data
          );

          ctx.save();
          ctx.fillStyle = "#ff9800";
          ctx.font = "bold 11px Arial";
          ctx.textAlign = "center";
          ctx.fillText("⚠ check", o.x, o.y + 18);
          ctx.restore();
        }
      }
    });
  }


  /* =========================================================
     SIZE LABELS (har line ka marking size) + TOTAL
     ========================================================= */

  function layoutRows(items, rowsMax) {

    /* items: [{c: centre px, w: text width px}] -> row number do */
    var last = [];

    items.sort(function (a, b) { return a.c - b.c; });

    items.forEach(function (it) {

      var r = 0;

      while (r < rowsMax - 1 && last[r] !== undefined && it.c - it.w / 2 < last[r] + 4) {
        r++;
      }

      it.row = r;

      last[r] = it.c + it.w / 2;
    });

    return items;
  }

  function drawSizeLabels(data) {

    var size = getSheetSize(data);

    ctx.save();
    ctx.font = "bold 11px Arial";

    /* ---- length lines: sheet ke upar ---- */
    var itemsL = [];

    (data.lengthLines || []).forEach(function (l) {

      if (num(l.markSizeInch) <= 1e-6) { return; }

      var a = w2s(l.startInch, 0, data);
      var b = w2s(l.endInch, 0, data);

      var text = show(l.markSizeInch, l.markSizeMM);

      itemsL.push({
        c: (a.x + b.x) / 2,
        w: ctx.measureText(text).width,
        text: text,
        segW: Math.abs(b.x - a.x)
      });
    });

    layoutRows(itemsL, 3);

    var topY = w2s(0, 0, data).y;

    var rowsUsedL = 0;

    ctx.fillStyle = "#cfd8dc";
    ctx.textAlign = "center";

    itemsL.forEach(function (it) {

      rowsUsedL = Math.max(rowsUsedL, it.row + 1);

      ctx.fillText(it.text, it.c, topY - 10 - it.row * 14);
    });

    /* ---- depth lines: sheet ke left me (ghumaya hua text) ---- */
    var itemsD = [];

    (data.depthLines || []).forEach(function (l) {

      if (num(l.markSizeInch) <= 1e-6) { return; }

      var a = w2s(0, l.startInch, data);
      var b = w2s(0, l.endInch, data);

      var text = show(l.markSizeInch, l.markSizeMM);

      itemsD.push({
        c: (a.y + b.y) / 2,
        w: ctx.measureText(text).width,
        text: text
      });
    });

    layoutRows(itemsD, 3);

    var leftX = w2s(0, 0, data).x;

    var rowsUsedD = 0;

    itemsD.forEach(function (it) {

      rowsUsedD = Math.max(rowsUsedD, it.row + 1);

      ctx.save();
      ctx.translate(leftX - 10 - it.row * 14, it.c);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#cfd8dc";
      ctx.textAlign = "center";
      ctx.fillText(it.text, 0, 0);
      ctx.restore();
    });

    /* ---- total (sabse bahar) ---- */
    var s = data.sheet || {};

    var p1 = w2s(0, 0, data);
    var p2 = w2s(size.width, 0, data);
    var p3 = w2s(0, size.height, data);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
      "Total " + show(s.widthInch != null ? s.widthInch : size.width, s.widthMM),
      (p1.x + p2.x) / 2,
      topY - 14 - rowsUsedL * 14
    );

    ctx.save();
    ctx.translate(leftX - 14 - rowsUsedD * 14, (p1.y + p3.y) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(
      "Total " + show(s.heightInch != null ? s.heightInch : size.height, s.heightMM),
      0,
      0
    );
    ctx.restore();

    ctx.restore();
  }


  /* =========================================================
     LEGEND / EMPTY
     ========================================================= */

  function drawLegend(data) {

    var c = getCanvasSize();

    ctx.save();
    ctx.font = "11px Arial";
    ctx.textAlign = "left";

    var x = 12;
    var y = c.height - 38;

    ctx.strokeStyle = "#1976ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 4]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 28, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#ffffff";
    ctx.fillText("BEND / MARK", x + 36, y + 4);

    ctx.fillStyle = "#ff2020";
    ctx.fillRect(x, y + 12, 28, 10);

    ctx.fillStyle = "#ffffff";
    ctx.fillText("CUP CUT (click = hide/show)", x + 36, y + 21);

    var hasAngled = (data.cuts || []).some(function (cut) {
      return (cut.kinds || []).indexOf("WEDGE") >= 0 ||
        (cut.kinds || []).indexOf("TRIM") >= 0;
    });

    if (hasAngled) {
      ctx.fillStyle = "#cfd8dc";
      ctx.fillText(
        "O = cut yahin se shuru · @ = angle (side wali blue line se)",
        x,
        y - 8
      );
    }

    ctx.restore();
  }

  function drawEmpty(message) {

    var c = getCanvasSize();

    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText(message, c.width / 2, c.height / 2);
    ctx.restore();
  }


  /* =========================================================
     CUT SIZE LIST (canvas ke neeche, hamesha, kisi bhi zoom pe)
     ---------------------------------------------------------
     Sirf tirchi (degree) cuts ke liye. Seedha chaukor cut
     me sirf laal rang, koi likha nahi.
     Sab naap geometry (cut.marks) se.
     ========================================================= */

  function ensureCutList() {

    var el = $("flat-cut-list");

    if (el) { return el; }

    if (!canvas || !canvas.parentNode) { return null; }

    el = document.createElement("div");

    el.id = "flat-cut-list";

    el.style.cssText =
      "margin:8px 0 4px;font:12px/1.55 Arial,sans-serif;color:#e8e8e8;";

    canvas.parentNode.insertBefore(el, canvas.nextSibling);

    return el;
  }

  function addLine(parent, text, style) {

    var d = document.createElement("div");

    d.textContent = text;

    if (style) { d.style.cssText = style; }

    parent.appendChild(d);
  }

  function nearest(p, a, b, nameA, nameB) {

    return p[a].inch <= p[b].inch
      ? show(p[a]) + " " + nameA
      : show(p[b]) + " " + nameB;
  }

  function clearCutList() {

    var el = $("flat-cut-list");

    if (el) { el.innerHTML = ""; }
  }

  function updateCutList(data) {

    var el = ensureCutList();

    if (!el) { return; }

    el.innerHTML = "";

    var n = 0;

    (data.cuts || []).forEach(function (cut) {

      var marks = cut.marks;

      if (!marks || !marks.polygons) { return; }

      var angled = marks.polygons.filter(function (poly) {
        return poly.kind === "WEDGE" || poly.kind === "TRIM";
      });

      if (!angled.length) { return; }

      n++;

      var corner = cut.corner || {};

      var title =
        "✂ Cut " + n + " — " +
        (corner.depthSide === "FAR" ? "neeche" : "upar") + "-" +
        (corner.lengthSide === "RIGHT" ? "right" : "left") +
        " corner (" + cut.lengthId + " × " + cut.depthId + ")";

      addLine(
        el,
        title,
        "margin-top:8px;font-weight:700;color:#ff8a80;"
      );

      var o = marks.origin;

      addLine(
        el,
        "O (blue lines milti hain, yahin se cut shuru): " +
          nearest(o, "fromLeft", "fromRight", "left se", "right se") + ", " +
          nearest(o, "fromTop", "fromBottom", "upar se", "neeche se")
      );

      angled.forEach(function (poly) {

        poly.edges.forEach(function (edge) {

          var line = edge.from + " → " + edge.to + ":  " + show(edge.length);

          if (edge.axis === null) {
            line += "   @" + fmtAngle(edge.angleDeg);
          }

          addLine(el, line, "padding-left:10px;");
        });
      });

      if (cut.needsCheck) {
        addLine(el, "⚠ is corner ko asli sheet pe check karo", "color:#ffb74d;");
      }
    });

    if (n > 0) {
      addLine(
        el,
        "@angle = side wali (horizontal) blue line se angle",
        "margin-top:6px;color:#9aa5b1;font-size:11px;"
      );
    }
  }


  /* =========================================================
     MAIN DRAW
     ========================================================= */

  function updateZoomLabel() {

    var el = $("zoom-level-flat");

    if (!el) { return; }

    var rel = fitZoomValue > 0 ? view.zoom / fitZoomValue : 1;

    el.textContent = (Math.round(rel * 10) / 10).toFixed(1) + "x";
  }

  function draw() {

    if (!getCanvas()) { return; }

    ensureUnitButtons();
    bindButtons();

    setupCanvasSize();

    currentData = getMasterData();

    drawBackground();

    if (!currentData) {
      drawEmpty("Geometry Engine unavailable");
      clearCutList();
      return;
    }

    var size = getSheetSize(currentData);

    if (size.width <= 0 || size.height <= 0) {
      drawEmpty("Length aur Depth ke sizes daalo");
      clearCutList();
      return;
    }

    fitZoomValue = fitScale(currentData);

    /* pehli baar, ya sheet ka size kaafi badal jaye (dusra model) to
       khud fit ho jao. Chhoti badlav pe zoom/pan waisa hi rehta hai. */
    var last = view._fitSize;

    var changedMuch =
      !last ||
      size.width / last.w > 1.33 || size.width / last.w < 0.75 ||
      size.height / last.h > 1.33 || size.height / last.h < 0.75;

    if (!view._fitted || changedMuch) {
      view.zoom = fitZoomValue;
      view.panX = 0;
      view.panY = 0;
      view._fitted = true;
      view._fitSize = { w: size.width, h: size.height };
    }

    /* order: sheet, grid, lines, points, cuts (upar), sizes, legend */
    drawSheet(currentData);
    drawGrid(currentData);
    drawLengthLines(currentData);
    drawDepthLines(currentData);
    drawIntersections(currentData);
    drawCuts(currentData);
    drawSizeLabels(currentData);
    drawLegend(currentData);

    updateCutList(currentData);

    updateZoomLabel();
  }

  function fit() {

    var d = currentData || getMasterData() || {};

    view.zoom = fitScale(d);
    view.panX = 0;
    view.panY = 0;
    view._fitted = true;

    var sz = getSheetSize(d);

    view._fitSize = { w: sz.width, h: sz.height };

    draw();
  }

  function reset() {
    fit();
  }

  function zoomIn() {
    view.zoom = clamp(view.zoom * 1.2, 0.05, 40);
    draw();
  }

  function zoomOut() {
    view.zoom = clamp(view.zoom / 1.2, 0.05, 40);
    draw();
  }


  /* =========================================================
     UNIT SWITCH  (inch | mm)
     ========================================================= */

  function setUnit(u) {

    unit = u === "mm" ? "mm" : "inch";

    try { window.localStorage.setItem("flatUnit", unit); } catch (e) { /* ignore */ }

    window.flatUnit = unit;

    syncUnitButtons();

    draw();
  }

  function getUnit() {
    return unit;
  }

  function syncUnitButtons() {

    var bi = $("flat-unit-inch");
    var bm = $("flat-unit-mm");

    if (bi) { bi.classList.toggle("active", unit === "inch"); }
    if (bm) { bm.classList.toggle("active", unit === "mm"); }
  }

  function ensureUnitButtons() {

    if ($("flat-unit-inch") && $("flat-unit-mm")) {
      syncUnitButtons();
      return;
    }

    var host = $("flat-container") || (canvas ? canvas.parentNode : null);

    if (!host || !canvas) { return; }

    var wrap = document.createElement("div");

    wrap.className = "view-toggle";
    wrap.id = "flat-unit-toggle";
    wrap.style.margin = "6px 0 8px";

    function mk(id, label) {

      var b = document.createElement("button");

      b.type = "button";
      b.className = "view-btn";
      b.id = id;
      b.textContent = label;

      wrap.appendChild(b);
    }

    mk("flat-unit-inch", "inch");
    mk("flat-unit-mm", "mm");

    host.insertBefore(wrap, canvas);

    syncUnitButtons();
  }


  /* =========================================================
     BUTTONS
     ========================================================= */

  function bindOnce(id, fn) {

    var el = $(id);

    if (!el || el.getAttribute("data-bound-flat")) { return; }

    el.setAttribute("data-bound-flat", "1");

    el.addEventListener("click", function (e) {
      e.preventDefault();
      fn();
    });
  }

  function bindButtons() {

    bindOnce("btn-zoom-in", zoomIn);
    bindOnce("btn-zoom-out", zoomOut);
    bindOnce("btn-reset-flat", reset);

    bindOnce("flat-zoom-in", zoomIn);
    bindOnce("flat-zoom-out", zoomOut);
    bindOnce("flat-reset", reset);

    bindOnce("flat-unit-inch", function () { setUnit("inch"); });
    bindOnce("flat-unit-mm", function () { setUnit("mm"); });
  }


  /* =========================================================
     CANVAS EVENTS  (pan, pinch, wheel, click = cut hide/show)
     ========================================================= */

  function pointInPoly(x, y, poly) {

    var inside = false;

    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {

      var xi = poly[i][0], yi = poly[i][1];
      var xj = poly[j][0], yj = poly[j][1];

      if (
        ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
      ) {
        inside = !inside;
      }
    }

    return inside;
  }

  function bindCanvasEvents() {

    if (!canvas) { return; }

    var moved = 0;

    function count() { return Object.keys(pointers).length; }

    function pinchDist() {

      var ids = Object.keys(pointers);

      if (ids.length < 2) { return 0; }

      var a = pointers[ids[0]];
      var b = pointers[ids[1]];

      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    canvas.style.touchAction = "none";

    canvas.addEventListener("pointerdown", function (e) {

      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

      lastPinch = pinchDist();
      moved = 0;

      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });

    canvas.addEventListener("pointermove", function (e) {

      var p = pointers[e.pointerId];

      if (!p) { return; }

      var dx = e.clientX - p.x;
      var dy = e.clientY - p.y;

      p.x = e.clientX;
      p.y = e.clientY;

      moved += Math.abs(dx) + Math.abs(dy);

      if (count() >= 2) {

        var d = pinchDist();

        if (lastPinch > 0 && d > 0) {
          view.zoom = clamp(view.zoom * (d / lastPinch), 0.05, 40);
        }

        lastPinch = d;

        draw();

        return;
      }

      view.panX += dx;
      view.panY += dy;

      draw();
    });

    function end(e) {

      delete pointers[e.pointerId];

      lastPinch = pinchDist();

      try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }

    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);

    canvas.addEventListener(
      "wheel",
      function (e) {

        e.preventDefault();

        view.zoom = clamp(
          e.deltaY < 0 ? view.zoom * 1.1 : view.zoom / 1.1,
          0.05,
          40
        );

        draw();
      },
      { passive: false }
    );

    /* cut pe click = hide / show (drag ke baad nahi) */
    canvas.addEventListener("click", function (e) {

      if (!currentData || moved > 6) { return; }

      var rect = canvas.getBoundingClientRect();

      var world = s2w(e.clientX - rect.left, e.clientY - rect.top, currentData);

      (currentData.cuts || []).forEach(function (cut) {

        var hit = (cut.polygons || []).some(function (poly) {
          return pointInPoly(world.x, world.y, poly);
        });

        if (hit) {

          if (!window.hiddenCuts) { window.hiddenCuts = {}; }

          window.hiddenCuts[cut.id] = !window.hiddenCuts[cut.id];

          draw();
        }
      });
    });

    window.addEventListener("resize", function () {
      setupCanvasSize();
      draw();
    });
  }


  /* =========================================================
     INIT
     ========================================================= */

  function init() {

    if (!getCanvas()) { return; }

    window.flatUnit = unit;

    ensureUnitButtons();
    bindButtons();

    currentData = getMasterData();

    if (currentData) {
      view.zoom = fitScale(currentData);
      view._fitted = true;
    }

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
    setUnit: setUnit,
    getUnit: getUnit,
    getMasterData: getMasterData,
    drawCuts: function () { drawCuts(currentData); }
  };

  /* purana naam */
  window.FlatView = window.Flat;

})();
