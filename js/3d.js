/* =========================================================
   3D VIEW — MASTER GEOMETRY V6 (FULL 3D BOX)
   ---------------------------------------------------------
   FIX V6:
   - GeometryEngine.threeD.records use karta hai
   - Ab poora 3D box banata hai (Length + Depth dono)
   - Har leg ke liye sheet strip + bend joints
   - Cup cuts bhi draw karta hai
   ========================================================= */

(function () {
  "use strict";

  var scene = null;
  var camera = null;
  var renderer = null;
  var meshGroup = null;
  var canvasEl = null;

  var ready = false;
  var currentView = "complete";

  var isDragging = false;
  var lastX = 0;
  var lastY = 0;

  var SCALE = 100;

  function getEl(id) {
    return document.getElementById(id);
  }

  function num(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function degToRad(deg) {
    return deg * Math.PI / 180;
  }

  function clearGroup(group) {
    if (!group) return;

    while (group.children.length) {
      var obj = group.children[0];
      group.remove(obj);

      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(function (m) {
            if (m) m.dispose();
          });
        } else {
          obj.material.dispose();
        }
      }
    }
  }

  /* =========================================================
     SETUP
     ========================================================= */

  function setup3D() {
    if (ready) return;

    canvasEl = getEl("canvas3d");
    if (!canvasEl) return;

    if (typeof THREE === "undefined") {
      console.error("Three.js not loaded.");
      return;
    }

    var width = canvasEl.clientWidth || 320;
    var height = canvasEl.clientHeight || 320;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);

    camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      100000
    );

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);

    canvasEl.innerHTML = "";
    canvasEl.appendChild(renderer.domElement);

    meshGroup = new THREE.Group();
    scene.add(meshGroup);

    var ambient = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambient);

    var light1 = new THREE.DirectionalLight(0xffffff, 1.0);
    light1.position.set(1, 2, 3);
    scene.add(light1);

    var light2 = new THREE.DirectionalLight(0xffffff, 0.5);
    light2.position.set(-2, 1, -2);
    scene.add(light2);

    bindEvents();

    ready = true;
    updateCamera();
    animate();
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  function bindEvents() {
    if (!canvasEl) return;

    canvasEl.addEventListener("mousedown", function (e) {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });

    canvasEl.addEventListener("mousemove", function (e) {
      if (!isDragging) return;

      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;

      window.view3d.rotY += dx * 0.5;
      window.view3d.rotX += dy * 0.5;

      window.view3d.rotX = Math.max(-90, Math.min(90, window.view3d.rotX));

      lastX = e.clientX;
      lastY = e.clientY;
    });

    canvasEl.addEventListener("mouseup", function () {
      isDragging = false;
    });

    canvasEl.addEventListener("mouseleave", function () {
      isDragging = false;
    });

    canvasEl.addEventListener(
      "touchstart",
      function (e) {
        if (e.touches.length !== 1) return;
        isDragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      },
      { passive: true }
    );

    canvasEl.addEventListener(
      "touchmove",
      function (e) {
        if (!isDragging) return;
        if (e.touches.length !== 1) return;

        e.preventDefault();

        var dx = e.touches[0].clientX - lastX;
        var dy = e.touches[0].clientY - lastY;

        window.view3d.rotY += dx * 0.5;
        window.view3d.rotX += dy * 0.5;

        window.view3d.rotX = Math.max(-90, Math.min(90, window.view3d.rotX));

        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      },
      { passive: false }
    );

    canvasEl.addEventListener("touchend", function () {
      isDragging = false;
    });

    canvasEl.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();

        var factor = e.deltaY > 0 ? 1.12 : 0.88;
        window.view3d.dist *= factor;

        window.view3d.dist = Math.max(100, Math.min(5000, window.view3d.dist));
      },
      { passive: false }
    );

    window.addEventListener("resize", function () {
      if (!renderer || !camera) return;
      resize();
    });
  }

  function resize() {
    if (!canvasEl || !renderer || !camera) return;

    var width = canvasEl.clientWidth;
    var height = canvasEl.clientHeight;

    if (!width || !height) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  /* =========================================================
     MASTER DATA
     ========================================================= */

  function getMasterData() {
    if (!window.GeometryEngine) {
      console.error("GeometryEngine not found.");
      return null;
    }

    try {
      var state = window.AppState || window.state || {};
      return window.GeometryEngine.analyze(state);
    } catch (err) {
      console.error("3D GeometryEngine error:", err);
      return null;
    }
  }

  /* =========================================================
     DRAW
     ========================================================= */

  function draw() {
    if (!ready) setup3D();
    if (!ready) return;

    clearGroup(meshGroup);

    var data = getMasterData();
    if (!data) return;

    if (currentView === "reverse") {
      buildReverseView(data);
    } else {
      buildCompleteView(data);
    }

    updateCamera();
  }

  /* =========================================================
     COMPLETE BENT SHEET — FULL 3D BOX
     ========================================================= */

  function buildCompleteView(data) {

    var records = [];

    if (
      data.threeD &&
      Array.isArray(data.threeD.records) &&
      data.threeD.records.length > 0
    ) {
      records = data.threeD.records;
    }

    if (records.length === 0) {
      addEmptyMessage();
      return;
    }

    // -----------------------------------------------------
    // SAARE POINTS COLLECT KARO (CENTERING KE LIYE)
    // -----------------------------------------------------

    var allPoints = [];

    records.forEach(function (rec) {
      if (rec.start) {
        allPoints.push(new THREE.Vector3(
          rec.start.x * SCALE,
          rec.start.y * SCALE,
          rec.start.z * SCALE
        ));
      }
      if (rec.end) {
        allPoints.push(new THREE.Vector3(
          rec.end.x * SCALE,
          rec.end.y * SCALE,
          rec.end.z * SCALE
        ));
      }
    });

    if (allPoints.length === 0) {
      addEmptyMessage();
      return;
    }

    // -----------------------------------------------------
    // CENTER CALCULATE KARO
    // -----------------------------------------------------

    var box = new THREE.Box3();
    allPoints.forEach(function (p) {
      box.expandByPoint(p);
    });

    var center = new THREE.Vector3();
    box.getCenter(center);

    // -----------------------------------------------------
    // THICKNESS
    // -----------------------------------------------------

    var thicknessMM = num(
      data.settings && data.settings.thickness,
      0.8
    );

    var thicknessIn = thicknessMM / 25.4;
    var thickness = Math.max(thicknessIn * SCALE, 2);

    // -----------------------------------------------------
    // SHEET MATERIAL
    // -----------------------------------------------------

    var sheetMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0c6cc,
      metalness: 0.85,
      roughness: 0.25,
      side: THREE.DoubleSide
    });

    // -----------------------------------------------------
    // HAR RECORD KE LIYE 3D SHEET STRIP BANAO
    // -----------------------------------------------------

    records.forEach(function (rec) {

      if (!rec.start || !rec.end) return;

      var start = new THREE.Vector3(
        rec.start.x * SCALE - center.x,
        rec.start.y * SCALE - center.y,
        rec.start.z * SCALE - center.z
      );

      var end = new THREE.Vector3(
        rec.end.x * SCALE - center.x,
        rec.end.y * SCALE - center.y,
        rec.end.z * SCALE - center.z
      );

      var length = start.distanceTo(end);

      if (length <= 0) return;

      var sheetWidth = 200;
      if (rec.side === "length") {
        sheetWidth = 250;
      } else {
        sheetWidth = 150;
      }

      var midpoint = start.clone().add(end).multiplyScalar(0.5);

      var geometry = new THREE.BoxGeometry(
        length,
        sheetWidth,
        thickness
      );

      var mesh = new THREE.Mesh(
        geometry,
        sheetMaterial.clone()
      );

      mesh.position.copy(midpoint);
      mesh.lookAt(end);

      meshGroup.add(mesh);

      // Bend joint
      var jointGeo = new THREE.SphereGeometry(thickness * 10, 8, 8);
      var jointMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });

      var joint = new THREE.Mesh(jointGeo, jointMat);
      joint.position.copy(end);
      meshGroup.add(joint);

      // Center line
      var lineGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
      var lineMat = new THREE.LineBasicMaterial({ color: 0x4a90e2 });
      var centerLine = new THREE.Line(lineGeo, lineMat);
      meshGroup.add(centerLine);
    });

    build3DCuts(data);
    buildReferenceGridCentered(box);
  }

  /* =========================================================
     3D CUTS
     ========================================================= */

  function build3DCuts(data) {
    var cuts = Array.isArray(data.cuts) ? data.cuts : [];

    for (var i = 0; i < cuts.length; i++) {
      var cut = cuts[i];
      if (!cut) continue;

      var pos = cut.position || {};

      var x = num(pos.x, 0) * SCALE;
      var y = num(pos.y, 0) * SCALE;
      var z = 2;

      var width = num(cut.widthIn, num(cut.width, 0.1)) * SCALE;
      var depth = num(cut.depthIn, num(cut.depth, width / SCALE)) * SCALE;

      width = Math.max(width, 3);
      depth = Math.max(depth, 3);

      var geometry = new THREE.BoxGeometry(width, depth, 3);

      var material = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.85
      });

      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      meshGroup.add(mesh);
    }
  }

  /* =========================================================
     REVERSE / FLAT VIEW
     ========================================================= */

  function buildReverseView(data) {
    var sheet = data.sheet;

    if (!sheet) {
      addEmptyMessage();
      return;
    }

    var width = num(sheet.widthIn, num(sheet.width, 0));
    var height = num(sheet.heightIn, num(sheet.height, 0));

    if (width <= 0 || height <= 0) {
      addEmptyMessage();
      return;
    }

    width *= SCALE;
    height *= SCALE;

    var geometry = new THREE.BoxGeometry(width, height, 3);

    var material = new THREE.MeshStandardMaterial({
      color: 0xbfc5ca,
      metalness: 0.75,
      roughness: 0.3,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide
    });

    var sheetMesh = new THREE.Mesh(geometry, material);
    sheetMesh.position.set(width / 2, height / 2, 0);
    meshGroup.add(sheetMesh);

    var lengthLines = Array.isArray(data.lengthLines) ? data.lengthLines : [];

    lengthLines.forEach(function (line) {
      var pos = num(line.positionInch, num(line.position, 0));
      if (pos < 0 || pos > width / SCALE) return;
      var x = pos * SCALE;
      addFlatLine(x, 0, x, height, 0x2563eb);
    });

    var depthLines = Array.isArray(data.depthLines) ? data.depthLines : [];

    depthLines.forEach(function (line) {
      var pos = num(line.positionInch, num(line.position, 0));
      if (pos < 0 || pos > height / SCALE) return;
      var y = pos * SCALE;
      addFlatLine(0, y, width, y, 0x2563eb);
    });

    buildFlatCuts(data);
    addRectangleOutline(width, height);
  }

  function addFlatLine(x1, y1, x2, y2, color) {
    var geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, y1, 3),
      new THREE.Vector3(x2, y2, 3)
    ]);

    var material = new THREE.LineBasicMaterial({ color: color });
    var line = new THREE.Line(geometry, material);
    meshGroup.add(line);
  }

  function buildFlatCuts(data) {
    var cuts = Array.isArray(data.cuts) ? data.cuts : [];

    cuts.forEach(function (cut) {
      var pos = cut.position || {};
      var x = num(pos.x, 0) * SCALE;
      var y = num(pos.y, 0) * SCALE;
      var w = num(cut.widthIn, num(cut.width, 0.1)) * SCALE;
      var h = num(cut.depthIn, num(cut.depth, 0.1)) * SCALE;

      var geometry = new THREE.BoxGeometry(Math.max(w, 4), Math.max(h, 4), 5);
      var material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, 5);
      meshGroup.add(mesh);
    });
  }

  function addRectangleOutline(width, height) {
    var pts = [
      new THREE.Vector3(0, 0, 6),
      new THREE.Vector3(width, 0, 6),
      new THREE.Vector3(width, height, 6),
      new THREE.Vector3(0, height, 6),
      new THREE.Vector3(0, 0, 6)
    ];

    var geometry = new THREE.BufferGeometry().setFromPoints(pts);
    var material = new THREE.LineBasicMaterial({ color: 0xffffff });
    var line = new THREE.Line(geometry, material);
    meshGroup.add(line);
  }

  /* =========================================================
     REFERENCE GRID
     ========================================================= */

  function buildReferenceGridCentered(box) {
    if (!box) return;

    var size = box.getSize(new THREE.Vector3());
    var maxSize = Math.max(size.x, size.y, size.z) * 2;

    if (maxSize <= 0) maxSize = 500;

    var grid = new THREE.GridHelper(maxSize, 20, 0x333333, 0x1c1c1c);
    grid.rotation.x = Math.PI / 2;
    grid.position.y = -size.y / 2 - 20;
    meshGroup.add(grid);
  }

  /* =========================================================
     EMPTY MESSAGE
     ========================================================= */

  function addEmptyMessage() {
    var geometry = new THREE.BoxGeometry(1, 1, 1);
    var material = new THREE.MeshBasicMaterial({
      color: 0x444444,
      wireframe: true
    });
    var mesh = new THREE.Mesh(geometry, material);
    meshGroup.add(mesh);
  }

  /* =========================================================
     CAMERA
     ========================================================= */

  function updateCamera() {
    if (!camera || !window.view3d) return;

    var rotX = num(window.view3d.rotX, -25);
    var rotY = num(window.view3d.rotY, 35);
    var dist = num(window.view3d.dist, 900);

    var rx = degToRad(rotX);
    var ry = degToRad(rotY);

    camera.position.x = dist * Math.cos(rx) * Math.sin(ry);
    camera.position.y = dist * Math.sin(rx);
    camera.position.z = dist * Math.cos(rx) * Math.cos(ry);

    camera.lookAt(0, 0, 0);
  }

  /* =========================================================
     ANIMATION
     ========================================================= */

  function animate() {
    requestAnimationFrame(animate);
    if (!renderer) return;

    if (window.view3d && window.view3d.autoRotate) {
      window.view3d.rotY += 0.35;
    }

    updateCamera();
    renderer.render(scene, camera);
  }

  /* =========================================================
     VIEW SWITCH
     ========================================================= */

  function setView(viewName) {
    if (viewName !== "complete" && viewName !== "reverse") {
      viewName = "complete";
    }
    currentView = viewName;
    draw();
  }

  /* =========================================================
     ZOOM
     ========================================================= */

  function zoomIn() {
    if (!window.view3d) return;
    window.view3d.dist *= 0.8;
    window.view3d.dist = Math.max(100, Math.min(5000, window.view3d.dist));
  }

  function zoomOut() {
    if (!window.view3d) return;
    window.view3d.dist *= 1.2;
    window.view3d.dist = Math.max(100, Math.min(5000, window.view3d.dist));
  }

  /* =========================================================
     RESET
     ========================================================= */

  function reset() {
    if (!window.view3d) return;

    window.view3d.rotX = -25;
    window.view3d.rotY = 35;
    window.view3d.dist = 900;
    window.view3d.autoRotate = false;
    window.view3d.wireframe = false;

    var autoBtn = getEl("btn-auto-rotate");
    var wireBtn = getEl("btn-wireframe");

    if (autoBtn) autoBtn.classList.remove("active");
    if (wireBtn) wireBtn.classList.remove("active");

    draw();
  }

  /* =========================================================
     INIT BUTTONS
     ========================================================= */

  function init() {
    var btnZoomIn = getEl("btn-zoom-in-3d");
    var btnZoomOut = getEl("btn-zoom-out-3d");
    var btnReset = getEl("btn-reset-3d");
    var btnWireframe = getEl("btn-wireframe");
    var btnAutoRotate = getEl("btn-auto-rotate");

    if (btnZoomIn) btnZoomIn.onclick = zoomIn;
    if (btnZoomOut) btnZoomOut.onclick = zoomOut;
    if (btnReset) btnReset.onclick = reset;

    if (btnWireframe) {
      btnWireframe.onclick = function () {
        window.view3d.wireframe = !window.view3d.wireframe;
        this.classList.toggle("active", window.view3d.wireframe);
        draw();
      };
    }

    if (btnAutoRotate) {
      btnAutoRotate.onclick = function () {
        window.view3d.autoRotate = !window.view3d.autoRotate;
        this.classList.toggle("active", window.view3d.autoRotate);
      };
    }
  }

  /* =========================================================
     EXPOSE
     ========================================================= */

  window.ThreeD = {
    init: init,
    draw: draw,
    setView: setView,
    zoomIn: zoomIn,
    zoomOut: zoomOut,
    reset: reset
  };

})();
