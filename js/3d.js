/* =========================================================
   3D — Powerful Sheet-Metal Simulation (Part 1/2)
   Setup + Path Building + Sheet Building
   ========================================================= */

(function() {
  "use strict";

  var scene = null;
  var camera = null;
  var renderer = null;
  var meshGroup = null;
  var canvas3dEl = null;

  function getEl(id) { return document.getElementById(id); }
  function getState() { return window.state; }
  function getSettings() { return window.settings; }
  function getView() { return window.view3d; }

  /* ---------- REAL BEND FORMULAS ---------- */

  function bendAllowance(theta, R, K, T) {
    var rad = Math.abs(theta) * Math.PI / 180;
    return rad * (R + K * T);
  }

  function outsideSetback(theta, R, T) {
    var rad = Math.abs(theta) * Math.PI / 180;
    return (R + T) * Math.tan(rad / 2);
  }

  function bendDeduction(theta, R, K, T) {
    var BA = bendAllowance(theta, R, K, T);
    var OSSB = outsideSetback(theta, R, T);
    return (2 * OSSB) - BA;
  }

  function neutralAxisRadius(R, K, T) {
    return R + (K * T);
  }

  /* ---------- BUILD FOLDING PATH ---------- */

  function buildBentPath(lines) {

    var pts = [];
    var angle = 0;
    var px = 0;
    var pz = 0;

    pts.push({
      x: px,
      z: pz,
      angle: 0,
      type: "start"
    });

    var T = Number(getSettings().thickness) || 0.8;
    var R = Number(getSettings().radius) || 0.8;
    var K = Number(getSettings().kfactor) || 0.44;

    for (var i = 0; i < lines.length; i++) {

      var line = lines[i];
      var size = Number(line.size) || 0;
      var bendAngle = Number(line.angle) || 90;
      var bendDir = line.bend || "up";

      var BD = bendDeduction(bendAngle, R, K, T);

      /* Finished flange length
       * (user size minus half BD on each side) */
      var flatSize = size;
      if (i > 0) flatSize -= BD / 2;
      if (i < lines.length - 1) flatSize -= BD / 2;
      if (flatSize < 0.1) flatSize = 0.1;

      var rad = angle * Math.PI / 180;
      var nx = px + flatSize * Math.cos(rad);
      var nz = pz + flatSize * Math.sin(rad);

      pts.push({
        x: nx,
        z: nz,
        angle: angle,
        type: "flat-end",
        lineIndex: i
      });

      px = nx;
      pz = nz;

      /* Bend after this flange (except last) */
      if (i < lines.length - 1) {

        var bendSign = (bendDir === "down") ? -1 : 1;
        var newAngle = angle + bendSign * bendAngle;

        var neutralR = neutralAxisRadius(R, K, T);

        var dirRad = angle * Math.PI / 180;
        var startRad = dirRad;
        var endRad = newAngle * Math.PI / 180;

        /* Bend center */
        var centerX = px + neutralR * Math.sin(dirRad) * bendSign;
        var centerZ = pz - neutralR * Math.cos(dirRad) * bendSign;

        var endX = centerX - neutralR * Math.sin(endRad) * bendSign;
        var endZ = centerZ + neutralR * Math.cos(endRad) * bendSign;

        pts.push({
          x: endX,
          z: endZ,
          angle: newAngle,
          type: "bend-end",
          lineIndex: i,
          bendAngle: bendAngle,
          bendDir: bendDir,
          centerX: centerX,
          centerZ: centerZ,
          neutralR: neutralR,
          startRad: startRad,
          endRad: endRad,
          bendSign: bendSign
        });

        px = endX;
        pz = endZ;
        angle = newAngle;
      }
    }

    return pts;
  }

  /* ---------- SETUP 3D SCENE ---------- */

  function setup3D() {

    canvas3dEl = getEl("canvas3d");
    if (!canvas3dEl) return;

    if (typeof THREE === "undefined") {
      canvas3dEl.innerHTML =
        '<div class="empty-hint">3D load nahi hua. Internet check karo.</div>';
      return;
    }

    var W = canvas3dEl.clientWidth || 340;
    var H = canvas3dEl.clientHeight || 320;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);

    camera = new THREE.PerspectiveCamera(45, W / H, 1, 50000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    canvas3dEl.innerHTML = "";
    canvas3dEl.appendChild(renderer.domElement);

    /* Lights */
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    var keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(300, 500, 400);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    var fillLight = new THREE.DirectionalLight(0x99bbff, 0.4);
    fillLight.position.set(-300, 200, -300);
    scene.add(fillLight);

    var backLight = new THREE.DirectionalLight(0xffaa88, 0.3);
    backLight.position.set(0, -200, -400);
    scene.add(backLight);

    meshGroup = new THREE.Group();
    scene.add(meshGroup);

    var grid = new THREE.GridHelper(2000, 40, 0x1a2535, 0x15202e);
    grid.position.y = -150;
    scene.add(grid);

    updateCamera();
    bind3DInteractions();
  }

  /* ---------- UPDATE CAMERA ---------- */

  function updateCamera() {
    if (!camera) return;
    var v = getView();
    var rx = v.rotX * Math.PI / 180;
    var ry = v.rotY * Math.PI / 180;

    camera.position.x = v.dist * Math.cos(rx) * Math.sin(ry);
    camera.position.y = v.dist * Math.sin(rx);
    camera.position.z = v.dist * Math.cos(rx) * Math.cos(ry);
    camera.lookAt(0, 0, 0);
  }

  /* ---------- BUILD REAL SHEET FROM LINES ---------- */

  function buildSheetFromLines(lines, side) {

    if (!lines || lines.length === 0) return;

    var crossTotal;
    if (side === "len") {
      crossTotal = getState().depLines.reduce(
        function(s, l) { return s + Number(l.size); }, 0
      );
      if (crossTotal <= 0) crossTotal = 6;
    } else {
      crossTotal = getState().lenLines.reduce(
        function(s, l) { return s + Number(l.size); }, 0
      );
      if (crossTotal <= 0) crossTotal = 10;
    }

    var path = buildBentPath(lines);
    if (path.length < 2) return;

    /* Center */
    var sumX = 0, sumZ = 0;
    for (var i = 0; i < path.length; i++) {
      sumX += path[i].x;
      sumZ += path[i].z;
    }
    var cx = sumX / path.length;
    var cz = sumZ / path.length;

    var SCALE = 10;

    var T = Number(getSettings().thickness) || 0.8;
    var R = Number(getSettings().radius) || 0.8;
    var K = Number(getSettings().kfactor) || 0.44;

    /* Materials */
    var mat = new THREE.MeshStandardMaterial({
      color: 0xc7cdd4,
      metalness: 0.85,
      roughness: 0.25,
      side: THREE.DoubleSide,
      flatShading: false,
      wireframe: !!getView().wireframe
    });

    var lineMat = new THREE.LineBasicMaterial({ color: 0xdc2626 });
    var cutMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

    var sheetThick = T * SCALE;
    if (sheetThick < 1) sheetThick = 1;

    var yOffset = side === "dep" ? crossTotal * SCALE * 0.8 : 0;

    /* ---------- SEGMENTS ---------- */
    for (var s = 0; s < path.length - 1; s++) {

      var p1 = path[s];
      var p2 = path[s + 1];

      /* Flat segment */
      if (p2.type === "flat-end") {

        var dx = (p2.x - p1.x) * SCALE;
        var dz = (p2.z - p1.z) * SCALE;
        var segLen = Math.sqrt(dx * dx + dz * dz);
        if (segLen < 0.1) continue;

        var angleY = Math.atan2(dz, dx);
        var midX = (p1.x + p2.x) / 2 * SCALE - cx * SCALE;
        var midZ = (p1.z + p2.z) / 2 * SCALE - cz * SCALE;

        var geo = new THREE.BoxGeometry(
          segLen,
          sheetThick,
          crossTotal * SCALE
        );

        var mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(midX, yOffset, midZ);
        mesh.rotation.y = -angleY;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        meshGroup.add(mesh);
      }

      /* Bend segment */
      if (p2.type === "bend-end") {

        var bendMesh = createBendSurface(
          p1, p2, R, K, T, crossTotal * SCALE, SCALE, cx, cz, yOffset
        );

        if (bendMesh) meshGroup.add(bendMesh);

        /* Red bend line */
        var halfCross = (crossTotal * SCALE) / 2;
        var bendX = p2.x * SCALE - cx * SCALE;
        var bendZ = p2.z * SCALE - cz * SCALE;

        var bendLineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(bendX, yOffset, bendZ + halfCross),
          new THREE.Vector3(bendX, yOffset, bendZ - halfCross)
        ]);
        var bendLine = new THREE.Line(bendLineGeo, lineMat);
        meshGroup.add(bendLine);

        /* Yellow cup cut markers */
        var cutGeo = new THREE.SphereGeometry(sheetThick * 1.5, 12, 12);

        var cut1 = new THREE.Mesh(cutGeo, cutMat);
        cut1.position.set(bendX, yOffset + 1, bendZ + halfCross + 3);
        meshGroup.add(cut1);

        var cut2 = new THREE.Mesh(cutGeo, cutMat);
        cut2.position.set(bendX, yOffset + 1, bendZ - halfCross - 3);
        meshGroup.add(cut2);
      }
    }
  }

  /* ---------- CREATE REAL BEND SURFACE (curved) ---------- */

  function createBendSurface(p1, p2, R, K, T, width, SCALE, cx, cz, yOffset) {

    var segments = 16;

    var neutralR = neutralAxisRadius(R, K, T);

    var startRad = p2.startRad;
    var endRad = p2.endRad;
    var cX = p2.centerX;
    var cZ = p2.centerZ;

    var innerR = Math.max(0.01, neutralR - T / 2);
    var outerR = neutralR + T / 2;

    var positions = [];
    var uvs = [];
    var indices = [];

    var halfWidth = width / 2;

    for (var i = 0; i <= segments; i++) {

      var t = i / segments;
      var angle = startRad + (endRad - startRad) * t;

      var cosA = Math.cos(angle);
      var sinA = Math.sin(angle);

      var ix = cX - innerR * sinA;
      var iz = cZ + innerR * cosA;

      var ox = cX - outerR * sinA;
      var oz = cZ + outerR * cosA;

      /* 4 vertices */
      positions.push(ix * SCALE, -halfWidth, -iz * SCALE);
      positions.push(ox * SCALE, -halfWidth, -oz * SCALE);
      positions.push(ix * SCALE, halfWidth, -iz * SCALE);
      positions.push(ox * SCALE, halfWidth, -oz * SCALE);

      uvs.push(t, 0);
      uvs.push(t, 1);
      uvs.push(t, 0);
      uvs.push(t, 1);
    }

    for (var s = 0; s < segments; s++) {
      var a = s * 4;
      var b = (s + 1) * 4;

      /* Front face */
      indices.push(a, a + 1, b);
      indices.push(b, a + 1, b + 1);

      /* Back face */
      indices.push(a + 2, b + 2, a + 3);
      indices.push(a + 3, b + 2, b + 3);

      /* Top */
      indices.push(a + 1, a + 3, b + 1);
      indices.push(b + 1, a + 3, b + 3);

      /* Bottom */
      indices.push(a, b, a + 2);
      indices.push(a + 2, b, b + 2);
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(uvs, 2)
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    var material = new THREE.MeshStandardMaterial({
      color: 0xc7cdd4,
      metalness: 0.85,
      roughness: 0.25,
      side: THREE.DoubleSide,
      flatShading: false,
      wireframe: !!getView().wireframe
    });

    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(-cx * SCALE, yOffset, -cz * SCALE);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  /* ---------- REBUILD 3D ---------- */

  function rebuild3D() {

    if (!meshGroup) return;

    /* Clear old */
    while (meshGroup.children.length > 0) {
      var c = meshGroup.children[0];
      meshGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) {
          c.material.forEach(function(m) { if (m) m.dispose(); });
        } else {
          c.material.dispose();
        }
      }
    }

    var st = getState();

    if (st.lenLines.length === 0 && st.depLines.length === 0) {
      if (renderer) renderer.render(scene, camera);
      return;
    }

    if (st.lenLines.length > 0) {
      buildSheetFromLines(st.lenLines, "len");
    }
    if (st.depLines.length > 0) {
      buildSheetFromLines(st.depLines, "dep");
    }

    /* Auto camera distance */
    var maxDist = 0;
    meshGroup.children.forEach(function(child) {
      if (child.geometry) {
        child.geometry.computeBoundingSphere();
        var r = child.geometry.boundingSphere.radius || 0;
        var p = child.position;
        var d = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) + r;
        if (d > maxDist) maxDist = d;
      }
    });

    if (maxDist > 0) {
      var v = getView();
      v.dist = Math.max(400, maxDist * 2.5);
      updateCamera();
    }

    if (renderer) renderer.render(scene, camera);
  }

  /* ---------- DRAW 3D ---------- */

  function draw() {
    if (!renderer) {
      if (getEl("canvas3d") && getEl("canvas3d").clientWidth > 0) {
        setup3D();
      }
      if (!renderer) return;
    }
    rebuild3D();
  }
