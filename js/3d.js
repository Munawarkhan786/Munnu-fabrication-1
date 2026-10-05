/* =========================================================
   3D VIEW — MASTER GEOMETRY V4
   Sheet Metal Complete 3D + Reverse/Flat View

   FIX V5:
   - GeometryEngine.analyze() ko state pass kiya
   - Ab Settings + Lines dono calculation mein use honge
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

      window.view3d.rotX = Math.max(
        -90,
        Math.min(90, window.view3d.rotX)
      );

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

        window.view3d.rotX = Math.max(
          -90,
          Math.min(90, window.view3d.rotX)
        );

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

        window.view3d.dist = Math.max(
          100,
          Math.min(5000, window.view3d.dist)
        );
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
     MASTER DATA — YAHAN FIX KIYA
     ========================================================= */

  function getMasterData() {
    if (!window.GeometryEngine) {
      console.error("GeometryEngine not found.");
      return null;
    }

    try {
      // ✅ FIX: state pass karo
      var state = window.AppState || window.state || {};
      return window.GeometryEngine.analyze(state);
    } catch (err) {
      console.error("3D GeometryEngine error:", err);
      return null;
    }
  }

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

  function buildCompleteView(data) {
    var lines = [];

    if (Array.isArray(data.lengthLines)) {
      lines = lines.concat(data.lengthLines);
    }

    if (Array.isArray(data.depthLines)) {
      lines = lines.concat(data.depthLines);
    }

    if (
      lines.length === 0 &&
      data.threeD
    ) {
      if (Array.isArray(data.threeD.length)) {
        lines = lines.concat(data.threeD.length);
      }
      if (Array.isArray(data.threeD.depth)) {
        lines = lines.concat(data.threeD.depth);
      }
    }

    if (lines.length === 0) {
      addEmptyMessage();
      return;
    }

    var points = [];
    var cursor = new THREE.Vector3(0, 0, 0);
    var direction = new THREE.Vector3(1, 0, 0);
    var up = new THREE.Vector3(0, 1, 0);
    var normal = new THREE.Vector3(0, 0, 1);

    points.push(cursor.clone());

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      var size = num(
        line.sizeInch,
        num(line.size, 0)
      );

      if (size <= 0) continue;

      var next = cursor.clone().add(
        direction.clone().multiplyScalar(size * SCALE)
      );

      points.push(next.clone());

      var angle = num(
        line.effectiveAngleDeg,
        num(line.effectiveAngle, 0)
      );

      if (!angle && line.angle !== undefined) {
        angle = num(line.angle, 0);
      }

      if (angle !== 0) {
        var bendDirection = String(
          line.direction || "UP"
        ).toUpperCase();

        var sign = bendDirection === "DOWN" ? -1 : 1;
        var axis = up.clone();

        direction.applyAxisAngle(axis, degToRad(angle) * sign);
        direction.normalize();

        normal.applyAxisAngle(axis, degToRad(angle) * sign);
        normal.normalize();
      }

      cursor = next;
    }

    centerPoints(points);
    buildBentSheet(points, data);
    buildBendMarkers(points, lines);
    build3DCuts(data);
    buildReferenceGrid(points);
  }

  function buildBentSheet(points, data) {
    if (points.length < 2) return;

    var thicknessMM = num(
      data.settings && data.settings.thickness,
      0.8
    );

    var thicknessIn = thicknessMM / 25.4;
    var thickness = Math.max(thicknessIn * SCALE, 1);

    var material = new THREE.MeshStandardMaterial({
      color: 0xbfc5ca,
      metalness: 0.8,
      roughness: 0.28,
      side: THREE.DoubleSide
    });

    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i];
      var b = points[i + 1];

      var length = a.distanceTo(b);
      if (length <= 0) continue;

      var midpoint = a.clone().add(b).multiplyScalar(0.5);

      var geometry = new THREE.BoxGeometry(
        length,
        thickness,
        thickness
      );

      var mesh = new THREE.Mesh(geometry, material.clone());
      mesh.position.copy(midpoint);
      mesh.lookAt(b);
      meshGroup.add(mesh);
    }
  }

  function buildBendMarkers(points, lines) {
    if (points.length < 3) return;

    for (var i = 1; i < points.length - 1; i++) {
      var point = points[i];

      var geometry = new THREE.TorusGeometry(4, 1.2, 8, 16);

      var material = new THREE.MeshBasicMaterial({
        color: 0xff3333,
        wireframe: !!window.view3d.wireframe
      });

      var marker = new THREE.Mesh(geometry, material);
      marker.position.copy(point);
      meshGroup.add(marker);

      var lineData = lines[i - 1];
      if (!lineData) continue;

      var angle = num(
        lineData.effectiveAngleDeg,
        num(lineData.angle, 0)
      );

      if (!angle) continue;
      addAngleMarker(point, angle);
    }
  }

  function addAngleMarker(position, angle) {
    var length = 12;

    var points = [
      new THREE.Vector3(
        position.x - length,
        position.y,
        position.z
      ),
      new THREE.Vector3(
        position.x + length,
        position.y,
        position.z
      )
    ];

    var geometry = new THREE.BufferGeometry().setFromPoints(points);

    var material = new THREE.LineBasicMaterial({
      color: 0xffb020
    });

    var line = new THREE.Line(geometry, material);
    meshGroup.add(line);
  }

  function build3DCuts(data) {
    var cuts = Array.isArray(data.cuts) ? data.cuts : [];

    for (var i = 0; i < cuts.length; i++) {
      var cut = cuts[i];
      if (!cut) continue;

      var pos = cut.position || {};

      var x = num(pos.x, 0) * SCALE;
      var y = num(pos.y, 0) * SCALE;
      var z = 2;

      var width = num(
        cut.widthIn,
        num(cut.width, 0.1)
      ) * SCALE;

      var depth = num(
        cut.depthIn,
        num(cut.depth, width / SCALE)
      ) * SCALE;

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

    var lengthLines = Array.isArray(data.lengthLines)
      ? data.lengthLines
      : [];

    lengthLines.forEach(function (line) {
      var pos = num(line.positionInch, num(line.position, 0));

      if (pos < 0 || pos > width / SCALE) return;

      var x = pos * SCALE;
      addFlatLine(x, 0, x, height, 0x2563eb);
    });

    var depthLines = Array.isArray(data.depthLines)
      ? data.depthLines
      : [];

    depthLines.forEach(function (line) {
      var pos = num(line.positionInch, num(line.position, 0));

      if (pos < 0 || pos > height / SCALE) return;

      var y = pos * SCALE;
      addFlatLine(0, y, width, y, 0x2563eb);
    });

    buildFlatCuts(data);

    sheetMesh.position.x = width / 2;
    sheetMesh.position.y = height / 2;

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

      var geometry = new THREE.BoxGeometry(
        Math.max(w, 4),
        Math.max(h, 4),
        5
      );

      var material = new THREE.MeshBasicMaterial({
        color: 0
