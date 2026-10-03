/* =========================================================
   FLAT — 2D Flat Sheet Canvas View (Connected to GeometryEngine)
   ========================================================= */

(function() {
  "use strict";

  var flatCanvas = null;
  var flatCtx = null;

  function getEl(id) { return document.getElementById(id); }
  function getState() { return window.state; }

  /* ---------- SETUP CANVAS ---------- */

  function setupCanvas() {
    flatCanvas = getEl("canvasFlat");
    if (!flatCanvas) return;

    var dpr = window.devicePixelRatio || 1;
    var rect = flatCanvas.getBoundingClientRect();

    if (rect.width === 0) rect.width = 340;
    if (rect.height === 0) rect.height = 340;

    flatCanvas.width = Math.round(rect.width * dpr);
    flatCanvas.height = Math.round(rect.height * dpr);

    flatCtx = flatCanvas.getContext("2d");
    flatCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- GET GEOMETRY DATA ---------- */

  function getGeometryData() {
    if (
      !window.GeometryEngine ||
      typeof window.GeometryEngine.analyze !== "function"
    ) {
      return null;
    }

    try {
      return window.GeometryEngine.analyze();
    } catch (e) {
      if (window.Bugs) {
        window.Bugs.log("flat.analyze", e.message, e.stack);
      }
      return null;
    }
  }

  /*
    Look up intersection between length line index & depth line index.
    lenIndex = 0-based index of length BEND (0 = between L1 & L2)
    depIndex = 0-based index of depth BEND
  */
  function findIntersection(data, lenIndex, depIndex) {
    if (!data || !data.intersections) return null;

    for (var i = 0; i < data.intersections.length; i++) {
      var item = data.intersections[i];
      if (
        item.lenIndex === lenIndex &&
        item.depIndex === depIndex
      ) {
        return item;
      }
    }
    return null;
  }

  /* ---------- DRAW FLAT ---------- */

  function draw() {
    if (!flatCanvas) setupCanvas();
    if (!flatCanvas || !flatCtx) return;

    var rect = flatCanvas.getBoundingClientRect();
    var W = rect.width;
    var H = rect.height;

    var dpr = window.devicePixelRatio || 1;
    flatCtx.setTransform(1, 0, 0, 1, 0, 0);
    flatCtx.scale(dpr, dpr);

    flatCtx.clearRect(0, 0, W, H);
    flatCtx.fillStyle = "#0a0d14";
    flatCtx.fillRect(0, 0, W, H);

    var state = getState();
    var lenSizes = state.lenLines.map(function(l) { return l.size; });
    var depSizes = state.depLines.map(function(l) { return l.size; });

    var hasLen = lenSizes.length > 0;
    var hasDep = depSizes.length > 0;

    if (!hasLen && !hasDep) {
      flatCtx.fillStyle = "#444";
      flatCtx.font = "14px sans-serif";
      flatCtx.textAlign = "center";
      flatCtx.fillText("Size daalo pehle", W / 2, H / 2);
      return;
    }

    /* ---------- GET GEOMETRY DATA ---------- */

    var geometryData = getGeometryData();

    flatCtx.save();
    flatCtx.translate(window.flatView.panX, window.flatView.panY);

    var pad = 40;
    var availW = W - pad * 2;
    var availH = H - pad * 2;

    var totalLen = lenSizes.reduce(function(a, b) { return a + b; }, 0);
    var totalDep = depSizes.reduce(function(a, b) { return a + b; }, 0);

    var scaleX = hasLen && totalLen > 0 ? availW / totalLen : Infinity;
    var scaleY = hasDep && totalDep > 0 ? availH / totalDep : Infinity;
    var baseScale = Math.min(scaleX, scaleY);

    if (!isFinite(baseScale) || baseScale <= 0) baseScale = 20;

    var scale = baseScale * window.flatView.zoom;

    var drawW = hasLen ? totalLen * scale : availW * 0.8;
    var drawH = hasDep ? totalDep * scale : availH * 0.8;

    var startX = pad + (availW - drawW) / 2;
    var startY = pad + (availH - drawH) / 2;

    /* Dashed border */
    flatCtx.strokeStyle = "rgba(120, 160, 220, 0.4)";
    flatCtx.lineWidth = 1;
    flatCtx.setLineDash([4, 4]);
    flatCtx.strokeRect(startX, startY, drawW, drawH);
    flatCtx.setLineDash([]);

    /* ---------- COMPUTE POSITIONS ---------- */

    var lenPositions = [];
    var depPositions = [];

    if (hasLen) {
      var x = startX;
      for (var i = 0; i < lenSizes.length; i++) {
        var w = Math.max(lenSizes[i] * scale, window.MIN_SEGMENT_PX);
        lenPositions.push({ x: x, size: lenSizes[i], width: w });
        x += w;
      }
      lenPositions.push({ x: x, size: 0, width: 0 });
    }

    if (hasDep) {
      var y = startY;
      for (var j = 0; j < depSizes.length; j++) {
        var h = Math.max(depSizes[j] * scale, window.MIN_SEGMENT_PX);
        depPositions.push({ y: y, size: depSizes[j], height: h });
        y += h;
      }
      depPositions.push({ y: y, size: 0, height: 0 });
    }

    /*
      Internal bend lines:
      lenBends[i] = x position of vertical line (between L(i+1) & L(i+2))
      depBends[j] = y position of horizontal line (between D(j+1) & D(j+2))
    */
    var lenBends = [];
    for (var lb = 1; lb < lenPositions.length - 1; lb++) {
      lenBends.push(lenPositions[lb].x);
    }

    var depBends = [];
    for (var db = 1; db < depPositions.length - 1; db++) {
      depBends.push(depPositions[db].y);
    }

    /* ---------- DRAW VERTICAL LINES (with cuts from geometry) ---------- */

    if (hasLen) {
      for (var vi = 0; vi < lenBends.length; vi++) {
        var vx = lenBends[vi];

        /*
          For this vertical bend line (lenIndex = vi),
          find all intersection cuts along the depth direction.
        */
        var vSegments = [];

        for (var vj = 0; vj < depBends.length; vj++) {
          var vy = depBends[vj];

          var inter = findIntersection(geometryData, vi, vj);

          /*
            Only draw a red cut if geometry engine says so.
          */
          if (inter && inter.cut && inter.cut.required) {
            var cupPxV = Math.max(inter.cut.sizeInch * scale, 8);
            var halfV = cupPxV / 2;

            vSegments.push({
              y1: vy - halfV,
              y2: vy + halfV,
              key: inter.id
            });
          }
        }

        vSegments.sort(function(a, b) { return a.y1 - b.y1; });

        var cursorY = startY;
        var endY = startY + drawH;

        /* Draw blue line segments + red cut segments */
        vSegments.forEach(function(seg) {
          if (seg.y1 > cursorY) {
            flatCtx.strokeStyle = "#3b82f6";
            flatCtx.lineWidth = 2;
            flatCtx.beginPath();
            flatCtx.moveTo(vx, cursorY);
            flatCtx.lineTo(vx, seg.y1);
            flatCtx.stroke();
          }

          if (!window.hiddenCuts[seg.key]) {
            flatCtx.strokeStyle = "#dc2626";
            flatCtx.lineWidth = 4;
            flatCtx.beginPath();
            flatCtx.moveTo(vx, seg.y1);
            flatCtx.lineTo(vx, seg.y2);
            flatCtx.stroke();
          }

          cursorY = seg.y2;
        });

        if (endY > cursorY) {
          flatCtx.strokeStyle = "#3b82f6";
          flatCtx.lineWidth = 2;
          flatCtx.beginPath();
          flatCtx.moveTo(vx, cursorY);
          flatCtx.lineTo(vx, endY);
          flatCtx.stroke();
        }
      }

      /* First edge */
      flatCtx.strokeStyle = "#3b82f6";
      flatCtx.lineWidth = 2;
      flatCtx.beginPath();
      flatCtx.moveTo(startX, startY);
      flatCtx.lineTo(startX, startY + drawH);
      flatCtx.stroke();

      /* Last edge */
      var lastVx = lenPositions[lenPositions.length - 1].x;
      flatCtx.beginPath();
      flatCtx.moveTo(lastVx, startY);
      flatCtx.lineTo(lastVx, startY + drawH);
      flatCtx.stroke();

      /* Length labels */
      for (var lk = 0; lk < lenSizes.length; lk++) {
        var labelX = (lenPositions[lk].x + lenPositions[lk + 1].x) / 2;
        flatCtx.fillStyle = "#8ab4f8";
        flatCtx.font = "bold 10px 'Courier New', monospace";
        flatCtx.textAlign = "center";
        flatCtx.textBaseline = "bottom";
        flatCtx.fillText(
          window.formatInch(lenSizes[lk]),
          labelX,
          startY - 6
        );
      }
    }

    /* ---------- DRAW HORIZONTAL LINES (with cuts from geometry) ---------- */

    if (hasDep) {
      for (var hj = 0; hj < depBends.length; hj++) {
        var hy = depBends[hj];

        /*
          For this horizontal bend line (depIndex = hj),
          find all intersection cuts along the length direction.
        */
        var hSegments = [];

        for (var hi = 0; hi < lenBends.length; hi++) {
          var hx = lenBends[hi];

          var inter2 = findIntersection(geometryData, hi, hj);

          if (inter2 && inter2.cut && inter2.cut.required) {
            var cupPxH = Math.max(inter2.cut.sizeInch * scale, 8);
            var halfH = cupPxH / 2;

            hSegments.push({
              x1: hx - halfH,
              x2: hx + halfH,
              key: inter2.id
            });
          }
        }

        hSegments.sort(function(a, b) { return a.x1 - b.x1; });

        var cursorX = startX;
        var endX = startX + drawW;

        hSegments.forEach(function(seg) {
          if (seg.x1 > cursorX) {
            flatCtx.strokeStyle = "#3b82f6";
            flatCtx.lineWidth = 2;
            flatCtx.beginPath();
            flatCtx.moveTo(cursorX, hy);
            flatCtx.lineTo(seg.x1, hy);
            flatCtx.stroke();
          }

          if (!window.hiddenCuts[seg.key]) {
            flatCtx.strokeStyle = "#dc2626";
            flatCtx.lineWidth = 4;
            flatCtx.beginPath();
            flatCtx.moveTo(seg.x1, hy);
            flatCtx.lineTo(seg.x2, hy);
            flatCtx.stroke();
          }

          cursorX = seg.x2;
        });

        if (endX > cursorX) {
          flatCtx.strokeStyle = "#3b82f6";
          flatCtx.lineWidth = 2;
          flatCtx.beginPath();
          flatCtx.moveTo(cursorX, hy);
          flatCtx.lineTo(endX, hy);
          flatCtx.stroke();
        }
      }

      /* First edge */
      flatCtx.strokeStyle = "#3b82f6";
      flatCtx.lineWidth = 2;
      flatCtx.beginPath();
      flatCtx.moveTo(startX, startY);
      flatCtx.lineTo(startX + drawW, startY);
      flatCtx.stroke();

      /* Last edge */
      var lastHy = depPositions[depPositions.length - 1].y;
      flatCtx.beginPath();
      flatCtx.moveTo(startX, lastHy);
      flatCtx.lineTo(startX + drawW, lastHy);
      flatCtx.stroke();

      /* Depth labels */
      for (var lm = 0; lm < depSizes.length; lm++) {
        var labelY = (depPositions[lm].y + depPositions[lm + 1].y) / 2;
        flatCtx.fillStyle = "#8ab4f8";
        flatCtx.font = "bold 10px 'Courier New', monospace";
        flatCtx.textAlign = "left";
        flatCtx.textBaseline = "middle";
        flatCtx.fillText(
          window.formatInch(depSizes[lm]),
          startX + drawW + 6,
          labelY
        );
      }
    }

    flatCtx.restore();

    var zi = getEl("zoom-level-flat");
    if (zi) zi.textContent = window.flatView.zoom.toFixed(1) + "x";
  }

  /* ---------- TAP HANDLING (toggle cut visibility) ---------- */

  function handleTap(clientX, clientY) {
    var c = getEl("canvasFlat");
    if (!c) return;

    var rect = c.getBoundingClientRect();
    var mx = clientX - rect.left;
    var my = clientY - rect.top;

    var W = rect.width;
    var H = rect.height;
    var pad = 40;
    var availW = W - pad * 2;
    var availH = H - pad * 2;

    var state = getState();
    var lenSizes = state.lenLines.map(function(l) { return l.size; });
    var depSizes = state.depLines.map(function(l) { return l.size; });
    var hasLen = lenSizes.length > 0;
    var hasDep = depSizes.length > 0;
    if (!hasLen && !hasDep) return;

    var totalLen = lenSizes.reduce(function(a, b) { return a + b; }, 0);
    var totalDep = depSizes.reduce(function(a, b) { return a + b; }, 0);
    var scaleX = hasLen && totalLen > 0 ? availW / totalLen : Infinity;
    var scaleY = hasDep && totalDep > 0 ? availH / totalDep : Infinity;
    var baseScale = Math.min(scaleX, scaleY);
    if (!isFinite(baseScale) || baseScale <= 0) baseScale = 20;
    var scale = baseScale * window.flatView.zoom;

    var drawW = hasLen ? totalLen * scale : availW * 0.8;
    var drawH = hasDep ? totalDep * scale : availH * 0.8;
    var startX = pad + (availW - drawW) / 2 + window.flatView.panX;
    var startY = pad + (availH - drawH) / 2 + window.flatView.panY;

    /* Compute bend line positions */
    var lenPos = [];
    var depPos = [];

    var x = startX;
    for (var i = 0; i < lenSizes.length; i++) {
      lenPos.push({ x: x });
      x += Math.max(lenSizes[i] * scale, window.MIN_SEGMENT_PX);
    }
    lenPos.push({ x: x });

    var y = startY;
    for (var j = 0; j < depSizes.length; j++) {
      depPos.push({ y: y });
      y += Math.max(depSizes[j] * scale, window.MIN_SEGMENT_PX);
    }
    depPos.push({ y: y });

    /* Find nearest bend line crossing */
    var lenBends = [];
    for (var lb = 1; lb < lenPos.length - 1; lb++) {
      lenBends.push(lenPos[lb].x);
    }

    var depBends = [];
    for (var db = 1; db < depPos.length - 1; db++) {
      depBends.push(depPos[db].y);
    }

    var geometryData = getGeometryData();

    for (var a = 0; a < lenBends.length; a++) {
      for (var b = 0; b < depBends.length; b++) {
        var cx = lenBends[a];
        var cy = depBends[b];

        var inter = findIntersection(geometryData, a, b);
        if (!inter || !inter.cut || !inter.cut.required) continue;

        var cupPx = Math.max(inter.cut.sizeInch * scale, 8);
        var half = cupPx / 2 + 14;

        if (Math.abs(mx - cx) < half && Math.abs(my - cy) < half) {
          window.hiddenCuts[inter.id] = !window.hiddenCuts[inter.id];
          draw();
          return;
        }
      }
    }
  }

  /* ---------- INTERACTIONS ---------- */

  function bindInteractions() {
    var c = getEl("canvasFlat");
    if (!c) return;

    var drag = { active: false, x: 0, y: 0, panX: 0, panY: 0, moved: false };
    var pinch = { active: false, dist: 0, zoom: 1 };

    function getDist(t1, t2) {
      return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    }

    c.addEventListener("touchstart", function(e) {
      drag.moved = false;
      if (e.touches.length === 2) {
        pinch.active = true;
        pinch.dist = getDist(e.touches[0], e.touches[1]);
        pinch.zoom = window.flatView.zoom;
        drag.active = false;
      } else if (e.touches.length === 1) {
        drag.active = true;
        drag.x = e.touches[0].clientX;
        drag.y = e.touches[0].clientY;
        drag.panX = window.flatView.panX;
        drag.panY = window.flatView.panY;
      }
    }, { passive: true });

    c.addEventListener("touchmove", function(e) {
      if (pinch.active && e.touches.length === 2) {
        e.preventDefault();
        drag.moved = true;
        var d = getDist(e.touches[0], e.touches[1]);
        window.flatView.zoom = Math.max(
          window.ZOOM_MIN,
          Math.min(window.ZOOM_MAX, pinch.zoom * (d / pinch.dist))
        );
        draw();
      } else if (drag.active && e.touches.length === 1) {
        e.preventDefault();
        var dx = e.touches[0].clientX - drag.x;
        var dy = e.touches[0].clientY - drag.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
        window.flatView.panX = drag.panX + dx;
        window.flatView.panY = drag.panY + dy;
        draw();
      }
    }, { passive: false });

    c.addEventListener("touchend", function(e) {
      if (!drag.moved && e.changedTouches.length === 1) {
        handleTap(
          e.changedTouches[0].clientX,
          e.changedTouches[0].clientY
        );
      }
      drag.active = false;
      pinch.active = false;
    });

    c.addEventListener("wheel", function(e) {
      e.preventDefault();
      var factor = e.deltaY > 0 ? 0.9 : 1.1;
      window.flatView.zoom = Math.max(
        window.ZOOM_MIN,
        Math.min(window.ZOOM_MAX, window.flatView.zoom * factor)
      );
      draw();
    }, { passive: false });

    c.addEventListener("mousedown", function(e) {
      drag.active = true;
      drag.moved = false;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.panX = window.flatView.panX;
      drag.panY = window.flatView.panY;
    });

    window.addEventListener("mousemove", function(e) {
      if (!drag.active) return;
      var dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
      window.flatView.panX = drag.panX + dx;
      window.flatView.panY = drag.panY + dy;
      draw();
    });

    window.addEventListener("mouseup", function(e) {
      if (drag.active && !drag.moved) {
        handleTap(e.clientX, e.clientY);
      }
      drag.active = false;
    });
  }

  /* ---------- ZOOM ---------- */

  function zoomIn() {
    window.flatView.zoom = Math.min(
      window.ZOOM_MAX,
      window.flatView.zoom * 1.4
    );
    draw();
  }

  function zoomOut() {
    window.flatView.zoom = Math.max(
      window.ZOOM_MIN,
      window.flatView.zoom / 1.4
    );
    draw();
  }

  function resetView() {
    window.flatView.zoom = 1;
    window.flatView.panX = 0;
    window.flatView.panY = 0;
    draw();
  }

  /* ---------- INIT ---------- */

  function init() {
    bindInteractions();

    var zi = getEl("btn-zoom-in");
    var zo = getEl("btn-zoom-out");
    var rs = getEl("btn-reset-flat");
    var pr = getEl("btn-print");

    if (zi) zi.onclick = zoomIn;
    if (zo) zo.onclick = zoomOut;
    if (rs) rs.onclick = resetView;
    if (pr) pr.onclick = function() { window.print(); };

    setTimeout(function() {
      setupCanvas();
      draw();
    }, 100);
  }

  /* ---------- EXPOSE ---------- */

  window.Flat = {
    init: init,
    draw: draw,
    setup: setupCanvas,
    zoomIn: zoomIn,
    zoomOut: zoomOut,
    reset: resetView
  };

})();
