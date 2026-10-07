/* =========================================================
   3D.JS
   FOLDED SHEET VIEW V8
   ---------------------------------------------------------
   GeometryEngine = BRAIN
   ThreeD         = SIRF DIKHANE WALA (visual)

   IMPORTANT:
   Ye file koi bend / angle / cup-cut calculation nahi karti.
   Sab kuch GeometryEngine.analyze() ke `fold` data se aata hai:

       data.fold.panels    : mudi hui sheet ke panels (3D points)
       data.fold.corners   : corner cut / miter line ki jagah
       data.fold.profiles  : length aur depth ka cross-section
       data.fold.bounds    : poore piece ka size

   Kya dikhata hai:
       - finished piece (finish side upar)
       - flange ke label (L2 2" / D4 8")
       - corner pe miter line (peeli) ya poora corner cut (laal)
       - length side aur depth side ka cross-section (neeche)
       - ghumana, pinch zoom, wireframe, auto rotate

   Public API purana hi hai (init, draw, resize, render, reset,
   resetView, setWireframe, setAutoRotate, getMasterData,
   startAnimation) + setLabels.
   ========================================================= */

(function () {

  "use strict";

  var UNIT = 10;   /* 1 inch = 10 three.js units */


  /* =========================================================
     STATE
     ========================================================= */

  var scene = null;
  var camera = null;
  var renderer = null;

  var canvas3dEl = null;

  var masterGroup = null;   /* ghumne wala */
  var modelGroup = null;    /* andar, center pe rakha hua */
  var labelGroup = null;

  var animationId = null;
  var initialized = false;
  var viewSet = false;

  var masterData = null;

  var modelRadius = 100;

  var msgEl = null;
  var infoEl = null;
  var sectionsEl = null;
  var secCanvasL = null;
  var secCanvasD = null;
  var secLabelL = null;
  var secLabelD = null;

  var materials = {};


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

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function getState() {
    return window.AppState || window.state || {};
  }

  function gcd(a, b) {
    return b ? gcd(b, a % b) : a;
  }

  /* 1/16 inch tak fraction: 2.5 -> 2 1/2" */
  function fmtInch(v) {

    var x = Math.max(0, num(v));

    var w = Math.floor(x + 1e-9);
    var f = Math.round((x - w) * 16);

    if (f === 16) { w += 1; f = 0; }

    var s = "";

    if (w > 0) { s += w; }

    if (f > 0) {
      var g = gcd(f, 16);
      s += (w > 0 ? " " : "") + (f / g) + "/" + (16 / g);
    }

    if (!s) { s = "0"; }

    return s + '"';
  }

  function view() {

    if (!window.view3d) {
      window.view3d = {
        rotX: -25,
        rotY: 35,
        dist: 900,
        autoRotate: false,
        wireframe: false
      };
    }

    if (window.view3d.zoom == null) { window.view3d.zoom = 1; }
    if (window.view3d.labels == null) { window.view3d.labels = true; }

    return window.view3d;
  }


  /* =========================================================
     MASTER DATA
     ========================================================= */

  function getMasterData() {

    if (
      !window.GeometryEngine ||
      typeof window.GeometryEngine.analyze !== "function"
    ) {
      console.error("3D: GeometryEngine unavailable");
      return null;
    }

    try {
      masterData = window.GeometryEngine.analyze(getState());
      return masterData;
    } catch (err) {
      console.error("3D: GeometryEngine failed", err);
      return null;
    }
  }


  /* =========================================================
     MESSAGE OVERLAY (jab 3D nahi ban sakta)
     ========================================================= */

  function ensureOverlay() {

    if (!canvas3dEl) { return; }

    if (msgEl) {
      if (msgEl.parentNode !== canvas3dEl) { canvas3dEl.appendChild(msgEl); }
      return;
    }

    canvas3dEl.style.position = "relative";

    msgEl = document.createElement("div");

    msgEl.style.cssText =
      "position:absolute;left:0;right:0;top:0;bottom:0;" +
      "display:none;align-items:center;justify-content:center;" +
      "text-align:center;padding:24px;color:#e8e8e8;" +
      "font:14px/1.5 Arial,sans-serif;pointer-events:none;z-index:2;";

    canvas3dEl.appendChild(msgEl);
  }

  function showMessage(text) {

    ensureOverlay();

    if (!msgEl) { return; }

    msgEl.textContent = text;
    msgEl.style.display = "flex";
  }

  function hideMessage() {

    if (msgEl) { msgEl.style.display = "none"; }
  }


  /* =========================================================
     INIT
     ========================================================= */

  function init() {

    if (initialized) { return; }

    canvas3dEl = $("canvas3d") || $("canvas3d-container");

    if (!canvas3dEl) {
      console.warn("3D: #canvas3d not found");
      return;
    }

    if (typeof THREE === "undefined") {
      console.error("3D: Three.js not loaded");
      showMessage(
        "3D library load nahi hui. Ek baar internet pe app kholo, phir offline bhi chalega."
      );
      return;
    }

    try {
      createScene();
    } catch (err) {
      console.error("3D: scene create failed", err);
      showMessage("Is phone/browser me 3D (WebGL) nahi chal raha.");
      return;
    }

    bindControls();
    createExtras();

    initialized = true;

    draw();
  }


  /* =========================================================
     SCENE
     ========================================================= */

  function createScene() {

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111318);

    var rect = canvas3dEl.getBoundingClientRect();

    camera = new THREE.PerspectiveCamera(
      45,
      Math.max(1, rect.width) / Math.max(1, rect.height),
      0.5,
      200000
    );

    camera.position.set(0, 0, 400);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });

    renderer.setPixelRatio(window.devicePixelRatio || 1);

    renderer.setSize(
      Math.max(300, rect.width),
      Math.max(300, rect.height)
    );

    if (canvas3dEl.tagName !== "CANVAS") {
      canvas3dEl.innerHTML = "";
      canvas3dEl.appendChild(renderer.domElement);
    }

    scene.add(new THREE.AmbientLight(0xffffff, 1.3));

    var key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(300, 500, 400);
    scene.add(key);

    var fill = new THREE.DirectionalLight(0xffffff, 1.0);
    fill.position.set(-300, 200, -300);
    scene.add(fill);

    masterGroup = new THREE.Group();
    modelGroup = new THREE.Group();
    labelGroup = new THREE.Group();

    modelGroup.add(labelGroup);
    masterGroup.add(modelGroup);
    scene.add(masterGroup);

    window.addEventListener("resize", function () {
      resize();
      render();
    });

    if (typeof ResizeObserver !== "undefined") {
      try {
        new ResizeObserver(function () {
          resize();
          render();
        }).observe(canvas3dEl);
      } catch (e) { /* ignore */ }
    }
  }


  /* =========================================================
     EXTRA UI (info line + cross-sections + buttons)
     ---------------------------------------------------------
     index.html ko chhedna nahi padta, sab yahin se banta hai.
     ========================================================= */

  function createExtras() {

    var host = canvas3dEl.parentNode;

    if (!host) { return; }

    /* legend badlo */
    var legend = host.querySelector(".legend");

    if (legend) {
      legend.textContent =
        "⬜ Top (finish side) · 🔷 mudi hui flange · 🟡 miter line · 🔴 poora corner cut · 🟠 check karo";
    }

    /* info line */
    infoEl = document.createElement("div");
    infoEl.style.cssText =
      "margin:8px 0 4px;color:#fbbf24;font:600 13px/1.4 Arial,sans-serif;";

    host.insertBefore(infoEl, canvas3dEl.nextSibling);

    /* cross-sections */
    sectionsEl = document.createElement("div");
    sectionsEl.style.cssText = "margin:6px 0 10px;";

    function box(title) {

      var wrap = document.createElement("div");
      wrap.style.cssText =
        "background:#0a0d14;border:1px solid #2a2f3a;border-radius:8px;" +
        "padding:6px 8px;margin-bottom:8px;";

      var t = document.createElement("div");
      t.textContent = title;
      t.style.cssText = "color:#e8e8e8;font:600 12px Arial,sans-serif;";

      var c = document.createElement("canvas");
      c.style.cssText = "width:100%;height:130px;display:block;";

      var l = document.createElement("div");
      l.style.cssText =
        "color:#fbbf24;font:11px/1.4 Arial,sans-serif;margin-top:2px;";

      wrap.appendChild(t);
      wrap.appendChild(c);
      wrap.appendChild(l);
      sectionsEl.appendChild(wrap);

      return { canvas: c, label: l };
    }

    var bl = box("LENGTH side — cross-section (finish side upar)");
    var bd = box("DEPTH side — cross-section (finish side upar)");

    secCanvasL = bl.canvas;
    secLabelL = bl.label;
    secCanvasD = bd.canvas;
    secLabelD = bd.label;

    host.insertBefore(sectionsEl, infoEl.nextSibling);

    /* labels button */
    var rows = host.querySelectorAll(".view-controls");
    var lastRow = rows.length ? rows[rows.length - 1] : null;

    if (lastRow && !$("btn-labels-3d")) {

      var b = document.createElement("button");

      b.type = "button";
      b.className = "btn btn-secondary";
      b.id = "btn-labels-3d";
      b.textContent = "🏷 Label";

      lastRow.appendChild(b);
    }

    wireButtons();
  }


  function wireButtons() {

    function on(id, fn) {

      var el = $(id);

      if (!el || el.getAttribute("data-bound3d")) { return; }

      el.setAttribute("data-bound3d", "1");
      el.addEventListener("click", fn);
    }

    on("btn-zoom-in-3d", function () { zoomBy(0.8); });
    on("btn-zoom-out-3d", function () { zoomBy(1.25); });
    on("btn-reset-3d", function () { resetView(); });

    on("btn-wireframe", function () {
      setWireframe(!view().wireframe);
    });

    on("btn-auto-rotate", function () {
      setAutoRotate(!view().autoRotate);
    });

    on("btn-labels-3d", function () {
      setLabels(!view().labels);
    });

    syncButtons();
  }


  function syncButtons() {

    function mark(id, state) {
      var el = $(id);
      if (el) { el.classList.toggle("active", !!state); }
    }

    mark("btn-wireframe", view().wireframe);
    mark("btn-auto-rotate", view().autoRotate);
    mark("btn-labels-3d", view().labels);
  }


  /* =========================================================
     RESIZE
     ========================================================= */

  function resize() {

    if (!renderer || !camera || !canvas3dEl) { return; }

    var rect = canvas3dEl.getBoundingClientRect();

    if (rect.width < 10 || rect.height < 10) { return; }

    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();

    renderer.setSize(rect.width, rect.height);
  }


  /* =========================================================
     CLEAR
     ========================================================= */

  function disposeObject(obj) {

    if (obj.geometry && obj.geometry.dispose) { obj.geometry.dispose(); }

    if (obj.material && obj.material.map && obj.material.map.dispose) {
      obj.material.map.dispose();
    }

    if (obj.material && obj.userData && obj.userData.ownMaterial) {
      obj.material.dispose();
    }
  }

  function clearGroup(group) {

    while (group.children.length) {
      var c = group.children[0];
      group.remove(c);
      disposeObject(c);
    }
  }

  function clearModel() {

    if (!modelGroup) { return; }

    modelGroup.children.slice().forEach(function (c) {
      if (c === labelGroup) { return; }
      modelGroup.remove(c);
      disposeObject(c);
    });

    clearGroup(labelGroup);
  }


  /* =========================================================
     MATERIALS
     ========================================================= */

  function mat(name, make) {

    if (!materials[name]) { materials[name] = make(); }

    return materials[name];
  }

  function finishMat(kind) {

    var color =
      kind === "BASE" ? 0xdfe6ea
      : kind === "L_FLANGE" ? 0xa9c3d6
      : 0x9fb8cc;

    return mat("finish_" + kind, function () {
      return new THREE.MeshStandardMaterial({
        color: color,
        side: THREE.FrontSide,
        metalness: 0.25,
        roughness: 0.5,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      });
    });
  }

  function markMat() {

    return mat("marking", function () {
      return new THREE.MeshStandardMaterial({
        color: 0x6b7480,
        side: THREE.BackSide,
        metalness: 0.1,
        roughness: 0.8,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      });
    });
  }


  /* =========================================================
     FOLD -> THREE COORDINATES
     ---------------------------------------------------------
     fold (x, y, z)  ->  three (X = x, Y = z, Z = -y)
     (ghumav sahi rehta hai, mirror nahi hota)
     ========================================================= */

  function toThree(p) {
    return [p[0] * UNIT, p[2] * UNIT, -p[1] * UNIT];
  }

  function dist3(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }

  function cleanPoly(points) {

    var out = [];

    points.forEach(function (p) {

      if (!out.length || dist3(out[out.length - 1], p) > 1e-6) {
        out.push(p);
      }
    });

    if (out.length > 1 && dist3(out[0], out[out.length - 1]) <= 1e-6) {
      out.pop();
    }

    return out;
  }

  function polyNormal(pts) {

    var nx = 0, ny = 0, nz = 0;

    for (var i = 0; i < pts.length; i++) {

      var p = pts[i];
      var q = pts[(i + 1) % pts.length];

      nx += (p[1] - q[1]) * (p[2] + q[2]);
      ny += (p[2] - q[2]) * (p[0] + q[0]);
      nz += (p[0] - q[0]) * (p[1] + q[1]);
    }

    return [nx, ny, nz];
  }


  /* =========================================================
     BUILD PANELS
     ========================================================= */

  function buildPanels(fold, allPts) {

    fold.panels.forEach(function (panel) {

      var pts = cleanPoly(panel.polygon.map(toThree));

      if (pts.length < 3) { return; }

      var n = polyNormal(pts);

      if (Math.hypot(n[0], n[1], n[2]) < 1e-9) { return; }

      /* finish side jis taraf ho, wahi front face bane */
      var fn = panel.finishNormal || [0, 0, 1];
      var f3 = [fn[0], fn[2], -fn[1]];

      var dotv = n[0] * f3[0] + n[1] * f3[1] + n[2] * f3[2];

      if (dotv < 0) { pts.reverse(); }

      var pos = [];

      for (var i = 1; i < pts.length - 1; i++) {
        pos.push(
          pts[0][0], pts[0][1], pts[0][2],
          pts[i][0], pts[i][1], pts[i][2],
          pts[i + 1][0], pts[i + 1][1], pts[i + 1][2]
        );
      }

      var geo = new THREE.BufferGeometry();

      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(pos, 3)
      );

      geo.computeVertexNormals();

      var meshF = new THREE.Mesh(geo, finishMat(panel.kind));
      var meshM = new THREE.Mesh(geo, markMat());

      meshF.userData = { panelId: panel.id };

      modelGroup.add(meshM);
      modelGroup.add(meshF);

      /* kinare */
      var edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 1),
        mat("edge", function () {
          return new THREE.LineBasicMaterial({ color: 0x1b2733 });
        })
      );

      modelGroup.add(edges);

      pts.forEach(function (p) { allPts.push(p); });
    });
  }


  /* =========================================================
     CORNERS (miter line / poora cut / check)
     ========================================================= */

  function addCylinder(a, b, radius, color) {

    var len = dist3(a, b);

    if (len < 1e-6) { return; }

    var geo = new THREE.CylinderGeometry(radius, radius, len, 8);

    var m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: color })
    );

    m.userData = { ownMaterial: true };

    m.position.set(
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2
    );

    var dir = new THREE.Vector3(
      b[0] - a[0],
      b[1] - a[1],
      b[2] - a[2]
    ).normalize();

    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    modelGroup.add(m);
  }

  function addSphere(p, radius, color) {

    var m = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 10),
      new THREE.MeshBasicMaterial({ color: color })
    );

    m.userData = { ownMaterial: true };
    m.position.set(p[0], p[1], p[2]);

    modelGroup.add(m);
  }

  function buildCorners(fold) {

    fold.corners.forEach(function (c) {

      if (!c.world) { return; }

      var o = toThree(c.world.origin);

      if (c.world.hipEnd) {
        addCylinder(o, toThree(c.world.hipEnd), 0.35, 0xfbbf24);
      }

      if (c.mode === "FULL") {
        addSphere(o, 1.0, 0xe53935);
      }

      if (c.needsCheck) {
        addSphere(o, 1.5, 0xff9800);
      }
    });
  }


  /* =========================================================
     LABELS
     ========================================================= */

  function makeLabel(text, height) {

    var cv = document.createElement("canvas");

    var ctx = cv.getContext("2d");

    var fs = 44;

    ctx.font = "bold " + fs + "px Arial";

    var w = Math.ceil(ctx.measureText(text).width) + 28;

    cv.width = w;
    cv.height = fs + 22;

    ctx = cv.getContext("2d");

    ctx.fillStyle = "rgba(10,13,20,0.78)";
    ctx.fillRect(0, 0, cv.width, cv.height);

    ctx.font = "bold " + fs + "px Arial";
    ctx.fillStyle = "#fbbf24";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 14, cv.height / 2 + 2);

    var tex = new THREE.CanvasTexture(cv);

    var sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        depthTest: false,
        transparent: true
      })
    );

    sp.userData = { ownMaterial: true };
    sp.renderOrder = 10;
    sp.scale.set(height * (cv.width / cv.height), height, 1);

    return sp;
  }

  function sizeOfLine(data, id) {

    var found = null;

    (data.lengthLines || []).concat(data.depthLines || []).forEach(function (l) {
      if (l.id === id) { found = l; }
    });

    return found ? found.sizeInch : null;
  }

  function buildLabels(data, fold) {

    if (!view().labels) { return; }

    var h = Math.max(4, modelRadius * 0.075);

    fold.panels.forEach(function (panel) {

      var pts = cleanPoly(panel.polygon.map(toThree));

      if (pts.length < 3) { return; }

      var cx = 0, cy = 0, cz = 0;

      pts.forEach(function (p) { cx += p[0]; cy += p[1]; cz += p[2]; });

      cx /= pts.length; cy /= pts.length; cz /= pts.length;

      var fn = panel.finishNormal || [0, 0, 1];
      var f3 = [fn[0], fn[2], -fn[1]];

      var text;

      if (panel.kind === "BASE") {
        text = panel.lengthId + " x " + panel.depthId + "  " +
          fmtInch(fold.widthInch) + " x " + fmtInch(fold.heightInch);
      } else {
        var id = panel.kind === "L_FLANGE" ? panel.lengthId : panel.depthId;
        var sz = sizeOfLine(data, id);
        text = id + (sz != null ? "  " + fmtInch(sz) : "");
      }

      var sp = makeLabel(text, h);

      var lift = UNIT * 0.4;

      sp.position.set(
        cx + f3[0] * lift,
        cy + f3[1] * lift,
        cz + f3[2] * lift
      );

      labelGroup.add(sp);
    });
  }


  /* =========================================================
     CENTER + GRID
     ========================================================= */

  function centerModel(allPts) {

    if (!allPts.length) { return; }

    var mn = [Infinity, Infinity, Infinity];
    var mx = [-Infinity, -Infinity, -Infinity];

    allPts.forEach(function (p) {
      for (var a = 0; a < 3; a++) {
        mn[a] = Math.min(mn[a], p[a]);
        mx[a] = Math.max(mx[a], p[a]);
      }
    });

    var c = [
      (mn[0] + mx[0]) / 2,
      (mn[1] + mx[1]) / 2,
      (mn[2] + mx[2]) / 2
    ];

    modelGroup.position.set(-c[0], -c[1], -c[2]);

    var r = 0;

    allPts.forEach(function (p) {
      r = Math.max(
        r,
        Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])
      );
    });

    modelRadius = Math.max(r, 20);
  }


  /* =========================================================
     DRAW
     ========================================================= */

  function draw() {

    if (!initialized) {

      init();

      if (!initialized) { return; }

      /* init() khud draw() bula chuka hai */
      return;
    }

    resize();

    var data = getMasterData();

    clearModel();

    if (
      !data ||
      !data.fold ||
      !data.fold.valid ||
      !data.fold.panels.length
    ) {

      showMessage(
        "3D dikhane ke liye Length aur Depth dono side ki lines daalo."
      );

      drawSection(secCanvasL, null);
      drawSection(secCanvasD, null);

      if (infoEl) { infoEl.textContent = ""; }
      if (secLabelL) { secLabelL.textContent = ""; }
      if (secLabelD) { secLabelD.textContent = ""; }

      render();
      return;
    }

    hideMessage();

    var fold = data.fold;

    var allPts = [];

    buildPanels(fold, allPts);

    centerModel(allPts);

    buildCorners(fold);

    buildLabels(data, fold);

    applyWireframe();

    if (!viewSet) {
      setDefaultView();
    }

    fitCamera();

    updateInfo(data, fold);

    drawSection(
      secCanvasL,
      fold.profiles.length,
      secLabelL,
      data,
      "length"
    );

    drawSection(
      secCanvasD,
      fold.profiles.depth,
      secLabelD,
      data,
      "depth"
    );

    render();
  }


  /* =========================================================
     INFO LINE
     ========================================================= */

  function updateInfo(data, fold) {

    if (!infoEl) { return; }

    var minZ = fold.bounds.min[2];
    var maxZ = fold.bounds.max[2];

    var parts = [
      "Top " + fmtInch(fold.widthInch) + " x " + fmtInch(fold.heightInch)
    ];

    if (minZ < -1e-6) { parts.push("neeche " + fmtInch(-minZ)); }
    if (maxZ > 1e-6) { parts.push("upar " + fmtInch(maxZ)); }

    var cuts = data.cuts ? data.cuts.length : 0;

    parts.push(cuts + " corner cut");

    var check = data.cuts
      ? data.cuts.filter(function (c) { return c.needsCheck; }).length
      : 0;

    if (check) { parts.push("🟠 " + check + " corner check karo"); }

    infoEl.textContent = parts.join("  ·  ");
  }


  /* =========================================================
     CROSS-SECTIONS (2D)
     ========================================================= */

  function drawSection(canvas, profile, labelEl, data, side) {

    if (!canvas) { return; }

    var dpr = window.devicePixelRatio || 1;

    var w = canvas.clientWidth || 300;
    var h = canvas.clientHeight || 130;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    var ctx = canvas.getContext("2d");

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!profile || !profile.length) { return; }

    var minX = Infinity, maxX = -Infinity;
    var minZ = Infinity, maxZ = -Infinity;

    profile.forEach(function (s) {
      [s.a, s.b].forEach(function (p) {
        minX = Math.min(minX, p[0]);
        maxX = Math.max(maxX, p[0]);
        minZ = Math.min(minZ, p[1]);
        maxZ = Math.max(maxZ, p[1]);
      });
    });

    var pad = 18;

    var spanX = Math.max(maxX - minX, 0.5);
    var spanZ = Math.max(maxZ - minZ, 0.5);

    var sc = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanZ);

    var ox = pad + ((w - 2 * pad) - spanX * sc) / 2;
    var oy = pad + ((h - 2 * pad) - spanZ * sc) / 2;

    function X(x) { return ox + (x - minX) * sc; }
    function Y(z) { return oy + (maxZ - z) * sc; }

    ctx.lineCap = "round";

    profile.forEach(function (s) {

      ctx.beginPath();
      ctx.moveTo(X(s.a[0]), Y(s.a[1]));
      ctx.lineTo(X(s.b[0]), Y(s.b[1]));

      ctx.strokeStyle = s.base ? "#ffffff" : "#7fb2d9";
      ctx.lineWidth = s.base ? 4 : 3;
      ctx.stroke();

      /* bade segment pe label */
      var px = Math.hypot(
        (s.b[0] - s.a[0]) * sc,
        (s.b[1] - s.a[1]) * sc
      );

      if (px > 34) {

        var mx = (X(s.a[0]) + X(s.b[0])) / 2;
        var my = (Y(s.a[1]) + Y(s.b[1])) / 2;

        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(s.id, mx, my - 6);
      }
    });

    /* "finish upar" ka tir */
    ctx.fillStyle = "#9aa5b1";
    ctx.font = "10px Arial";
    ctx.textAlign = "left";
    ctx.fillText("finish side ↑", 6, 12);

    if (labelEl && data) {

      var lines = side === "length" ? data.lengthLines : data.depthLines;

      labelEl.textContent = (lines || []).map(function (l) {

        var tag = l.id + ": " + fmtInch(l.sizeInch);

        if (l.isBend) {
          tag += " (" + l.angle + "° " + (l.direction === "down" ? "DOWN" : "UP") + ")";
        }

        return tag;

      }).join("   ");
    }
  }


  /* =========================================================
     WIREFRAME
     ========================================================= */

  function applyWireframe() {

    var enabled = !!(window.view3d && window.view3d.wireframe);

    ["BASE", "L_FLANGE", "D_FLANGE"].forEach(function (k) {
      finishMat(k).wireframe = enabled;
    });

    markMat().wireframe = enabled;
  }


  /* =========================================================
     CAMERA
     ========================================================= */

  function setDefaultView() {

    if (!masterGroup) { return; }

    /* front se thoda side, upar se dekhta hua */
    masterGroup.rotation.set(0.5, Math.PI + 0.55, 0);

    viewSet = true;
  }

  function fitCamera() {

    if (!camera) { return; }

    var fov = (camera.fov || 45) * Math.PI / 180;

    var base = modelRadius / Math.sin(fov / 2) * 1.1;

    var z = clamp(num(view().zoom, 1), 0.15, 6);

    camera.position.set(0, 0, base * z);
    camera.lookAt(0, 0, 0);

    camera.near = Math.max(0.5, base * 0.02);
    camera.far = base * 20;
    camera.updateProjectionMatrix();

  }

  function zoomBy(factor) {

    view().zoom = clamp(num(view().zoom, 1) * factor, 0.15, 6);

    fitCamera();
    render();
  }


  /* =========================================================
     RENDER / ANIMATION
     ========================================================= */

  function render() {

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  function animate() {

    if (!view().autoRotate) {
      animationId = null;
      return;
    }

    animationId = requestAnimationFrame(animate);

    if (masterGroup) { masterGroup.rotation.y += 0.008; }

    render();
  }

  function startAnimation() {

    if (!animationId && view().autoRotate) {
      animate();
    }
  }


  /* =========================================================
     CONTROLS (ghumana + pinch zoom)
     ========================================================= */

  function bindControls() {

    var target = renderer ? renderer.domElement : canvas3dEl;

    var pointers = {};
    var lastPinch = 0;

    function count() {
      return Object.keys(pointers).length;
    }

    function pinchDist() {

      var ids = Object.keys(pointers);

      if (ids.length < 2) { return 0; }

      var a = pointers[ids[0]];
      var b = pointers[ids[1]];

      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    target.style.touchAction = "none";

    target.addEventListener("pointerdown", function (e) {

      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

      lastPinch = pinchDist();

      try { target.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });

    target.addEventListener("pointermove", function (e) {

      var p = pointers[e.pointerId];

      if (!p) { return; }

      var dx = e.clientX - p.x;
      var dy = e.clientY - p.y;

      p.x = e.clientX;
      p.y = e.clientY;

      if (count() >= 2) {

        var d = pinchDist();

        if (lastPinch > 0 && d > 0) {
          zoomBy(lastPinch / d);
        }

        lastPinch = d;

        return;
      }

      if (!masterGroup) { return; }

      masterGroup.rotation.y += dx * 0.01;
      masterGroup.rotation.x = clamp(
        masterGroup.rotation.x + dy * 0.01,
        -1.5,
        1.5
      );

      render();
    });

    function end(e) {

      delete pointers[e.pointerId];

      lastPinch = pinchDist();

      try { target.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }

    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);

    target.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        zoomBy(e.deltaY < 0 ? 0.9 : 1.1);
      },
      { passive: false }
    );
  }


  /* =========================================================
     PUBLIC CONTROLS
     ========================================================= */

  function setWireframe(value) {

    view().wireframe = !!value;

    applyWireframe();
    syncButtons();
    render();
  }

  function setAutoRotate(value) {

    view().autoRotate = !!value;

    syncButtons();

    if (view().autoRotate) { startAnimation(); }
  }

  function setLabels(value) {

    view().labels = !!value;

    syncButtons();

    draw();
  }

  function resetView() {

    view().zoom = 1;

    viewSet = false;

    setDefaultView();
    fitCamera();
    render();
  }


  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.ThreeD = {
    init: init,
    draw: draw,
    resize: resize,
    render: render,
    reset: resetView,
    resetView: resetView,
    setWireframe: setWireframe,
    setAutoRotate: setAutoRotate,
    setLabels: setLabels,
    getMasterData: getMasterData,
    startAnimation: startAnimation
  };

  console.log("ThreeD V8 loaded — folded sheet viewer");

})();
