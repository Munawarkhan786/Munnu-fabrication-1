/* =========================================================
   3D — REAL SHEET-METAL FOLDING VIEW
   UPDATED CUP-CUT / SINGLE-SHEET SYSTEM
   =========================================================

   IMPORTANT:

   1. USER SIZE IS MASTER SIZE
      --------------------------------
      User ka entered size exact use hota hai.
      BD/2 subtract nahi kiya jata.

   2. ONE SHEET
      --------------------------------
      lenLines = folding path
      depLines = sheet width / cross direction

      Dono ko alag-alag sheet nahi banaya jata.

   3. CUP CUT
      --------------------------------
      window.cupCutsRemoved === false
          -> cup-cut marking/gap indicator

      window.cupCutsRemoved === true
          -> actual visible opening/gap

      Flat.js aur 3D.js same global state use karte hain.

   4. NO YELLOW CORNER SPHERES
      --------------------------------
      Old automatic yellow markers removed.

   5. NO AUTOMATIC PILLARS
      --------------------------------
      3D sirf actual sheet geometry banata hai.
   ========================================================= */

(function() {
  "use strict";

  /* =========================================================
     GLOBALS
     ========================================================= */

  var scene = null;
  var camera = null;
  var renderer = null;
  var meshGroup = null;
  var canvas3dEl = null;

  /* =========================================================
     HELPERS
     ========================================================= */

  function getEl(id) {
    return document.getElementById(id);
  }

  function getState() {
    return window.state;
  }

  function getSettings() {
    return window.settings;
  }

  function getView() {
    return window.view3d;
  }

  /* =========================================================
     GLOBAL CUP-CUT STATE
     ========================================================= */

  if (typeof window.cupCutsRemoved !== "boolean") {
    window.cupCutsRemoved = false;
  }

  /* =========================================================
     ENGINEERING FORMULAS
     ---------------------------------------------------------
     Kept for reference / bend geometry.
     IMPORTANT:
     They are NOT used to reduce user's master size.
     ========================================================= */

  function bendAllowance(theta, R, K, T) {
    var rad =
      Math.abs(theta) *
      Math.PI /
      180;

    return rad *
      (R + K * T);
  }

  function outsideSetback(theta, R, T) {
    var rad =
      Math.abs(theta) *
      Math.PI /
      180;

    return (
      (R + T) *
      Math.tan(rad / 2)
    );
  }

  function bendDeduction(theta, R, K, T) {
    var BA =
      bendAllowance(
        theta,
        R,
        K,
        T
      );

    var OSSB =
      outsideSetback(
        theta,
        R,
        T
      );

    return (
      (2 * OSSB) -
      BA
    );
  }

  function neutralAxisRadius(
    R,
    K,
    T
  ) {
    return R + K * T;
  }

  /* =========================================================
     GET SHEET WIDTH
     ========================================================= */

  function getSheetWidth() {

    var state = getState();

    if (!state) {
      return 6;
    }

    var depLines =
      state.depLines || [];

    var total = 0;

    depLines.forEach(
      function(line) {
        total +=
          Number(line.size) || 0;
      }
    );

    if (total <= 0) {
      return 6;
    }

    return total;
  }

  /* =========================================================
     GET DEPTH POSITIONS
     ---------------------------------------------------------
     These positions correspond to the horizontal bend lines
     in Flat view.

     Example:

     D1 = 2"
     D2 = 3"
     D3 = 2"

     positions:

     0
     2
     5
     7
     ========================================================= */

  function getDepthBendPositions() {

    var state =
      getState();

    if (!state) {
      return [];
    }

    var depLines =
      state.depLines || [];

    var result = [];

    var current = 0;

    /*
     * First position is sheet start.
     */
    result.push(0);

    /*
     * Internal depth bend lines.
     */
    for (
      var i = 0;
      i < depLines.length - 1;
      i++
    ) {

      current +=
        Number(
          depLines[i].size
        ) || 0;

      result.push(current);
    }

    return result;
  }

  /* =========================================================
     GET CUP CUT SIZE
     ========================================================= */

  function getCupCutSize(
    lenIndex,
    depIndex
  ) {

    var state =
      getState();

    if (
      !state ||
      !state.lenLines ||
      !state.lenLines[lenIndex - 1] ||
      !state.lenLines[lenIndex]
    ) {
      return 0.5;
    }

    var A =
      state.lenLines[
        lenIndex - 1
      ];

    var B =
      state.lenLines[
        lenIndex
      ];

    if (
      !window.Formulas ||
      typeof window.Formulas.calculateCorner !== "function"
    ) {
      return 0.5;
    }

    var calc =
      window.Formulas.calculateCorner(
        Number(A.size) || 0,
        Number(B.size) || 0,
        Number(B.angle) || 90
      );

    if (!calc) {
      return 0.5;
    }

    var relief =
      Number(calc.relief);

    if (
      !isFinite(relief) ||
      relief <= 0
    ) {
      return 0.5;
    }

    /*
     * Internal unit is mm.
     * Convert to inch because our 3D path uses inch values.
     */
    return relief / 25.4;
  }

  /* =========================================================
     GET ALL CUP CUT CENTRES FOR ONE BEND
     ========================================================= */

  function getCupCutsForBend(
    bendIndex,
    width
  ) {

    var state =
      getState();

    if (
      !state ||
      !state.depLines ||
      state.depLines.length < 2
    ) {
      return [];
    }

    var depLines =
      state.depLines;

    var positions =
      getDepthBendPositions();

    var result = [];

    /*
     * depIndex:
     *
     * 1 = first internal depth bend
     * 2 = second internal depth bend
     * etc.
     */
    for (
      var d = 1;
      d < positions.length;
      d++
    ) {

      var center =
        positions[d];

      /*
       * Do not create a cup beyond sheet width.
       */
      if (
        center <= 0 ||
        center >= width
      ) {
        continue;
      }

      var cutSize =
        getCupCutSize(
          bendIndex,
          d
        );

      result.push({
        center: center,
        size: cutSize,
        key:
          "cup_" +
          bendIndex +
          "_" +
          d
      });
    }

    return result;
  }

  /* =========================================================
     BUILD FOLDING PATH
     ---------------------------------------------------------
     USER SIZE IS USED EXACTLY.

     No:
       size - BD/2
       size - BD

     The bend itself is represented by a curved neutral-axis
     surface.
     ========================================================= */

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

    var settings =
      getSettings();

    var T =
      Number(settings.thickness) ||
      0.8;

    var R =
      Number(settings.radius) ||
      0.8;

    var K =
      Number(settings.kfactor) ||
      0.44;

    for (
      var i = 0;
      i < lines.length;
      i++
    ) {

      var line =
        lines[i];

      var size =
        Number(line.size) || 0;

      var bendAngle =
        Number(line.angle) || 90;

      var bendDir =
        line.bend || "up";

      /*
       * IMPORTANT:
       *
       * Exact user master size.
       *
       * No BD/2 subtraction.
       */
      var flatSize =
        size;

      if (
        flatSize <= 0
      ) {
        continue;
      }

      var rad =
        angle *
        Math.PI /
        180;

      var nx =
        px +
        flatSize *
        Math.cos(rad);

      var nz =
        pz +
        flatSize *
        Math.sin(rad);

      pts.push({
        x: nx,
        z: nz,
        angle: angle,
        type: "flat-end",
        lineIndex: i
      });

      px = nx;
      pz = nz;

      /*
       * Bend after this segment.
       */
      if (
        i < lines.length - 1
      ) {

        var bendSign =
          bendDir === "down"
            ? -1
            : 1;

        var newAngle =
          angle +
          bendSign *
          bendAngle;

        var neutralR =
          neutralAxisRadius(
            R,
            K,
            T
          );

        var dirRad =
          angle *
          Math.PI /
          180;

        var startRad =
          dirRad;

        var endRad =
          newAngle *
          Math.PI /
          180;

        /*
         * Bend center.
         */
        var centerX =
          px +
          neutralR *
          Math.sin(dirRad) *
          bendSign;

        var centerZ =
          pz -
          neutralR *
          Math.cos(dirRad) *
          bendSign;

        var endX =
          centerX -
          neutralR *
          Math.sin(endRad) *
          bendSign;

        var endZ =
          centerZ +
          neutralR *
          Math.cos(endRad) *
          bendSign;

        pts.push({
          x: endX,
          z: endZ,
          angle: newAngle,
          type: "bend-end",
          lineIndex: i,

          bendAngle:
            bendAngle,

          bendDir:
            bendDir,

          centerX:
            centerX,

          centerZ:
            centerZ,

          neutralR:
            neutralR,

          startRad:
            startRad,

          endRad:
            endRad,

          bendSign:
            bendSign
        });

        px = endX;
        pz = endZ;

        angle =
          newAngle;
      }
    }

    return pts;
  }

  /* =========================================================
     SETUP 3D SCENE
     ========================================================= */

  function setup3D() {

    canvas3dEl =
      getEl("canvas3d");

    if (!canvas3dEl) {
      return;
    }

    if (
      typeof THREE === "undefined"
    ) {

      canvas3dEl.innerHTML =
        '<div class="empty-hint">' +
        '3D load nahi hua. Internet check karo.' +
        '</div>';

      return;
    }

    var W =
      canvas3dEl.clientWidth ||
      340;

    var H =
      canvas3dEl.clientHeight ||
      320;

    scene =
      new THREE.Scene();

    scene.background =
      new THREE.Color(
        0x0a0d14
      );

    camera =
      new THREE.PerspectiveCamera(
        45,
        W / H,
        1,
        50000
      );

    renderer =
      new THREE.WebGLRenderer({
        antialias: true
      });

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        2
      )
    );

    renderer.setSize(
      W,
      H
    );

    renderer.shadowMap.enabled =
      true;

    renderer.shadowMap.type =
      THREE.PCFSoftShadowMap;

    canvas3dEl.innerHTML = "";

    canvas3dEl.appendChild(
      renderer.domElement
    );

    /* ---------- LIGHTS ---------- */

    scene.add(
      new THREE.AmbientLight(
        0xffffff,
        0.55
      )
    );

    var keyLight =
      new THREE.DirectionalLight(
        0xffffff,
        1.0
      );

    keyLight.position.set(
      300,
      500,
      400
    );

    keyLight.castShadow =
      true;

    keyLight.shadow.mapSize.width =
      1024;

    keyLight.shadow.mapSize.height =
      1024;

    scene.add(
      keyLight
    );

    var fillLight =
      new THREE.DirectionalLight(
        0x99bbff,
        0.4
      );

    fillLight.position.set(
      -300,
      200,
      -300
    );

    scene.add(
      fillLight
    );

    var backLight =
      new THREE.DirectionalLight(
        0xffaa88,
        0.3
      );

    backLight.position.set(
      0,
      -200,
      -400
    );

    scene.add(
      backLight
    );

    meshGroup =
      new THREE.Group();

    scene.add(
      meshGroup
    );

    /*
     * Ground grid.
     */
    var grid =
      new THREE.GridHelper(
        2000,
        40,
        0x1a2535,
        0x15202e
      );

    grid.position.y =
      -150;

    scene.add(grid);

    updateCamera();

    bind3DInteractions();
  }

  /* =========================================================
     CAMERA
     ========================================================= */

  function updateCamera() {

    if (!camera) {
      return;
    }

    var v =
      getView();

    var rx =
      v.rotX *
      Math.PI /
      180;

    var ry =
      v.rotY *
      Math.PI /
      180;

    camera.position.x =
      v.dist *
      Math.cos(rx) *
      Math.sin(ry);

    camera.position.y =
      v.dist *
      Math.sin(rx);

    camera.position.z =
      v.dist *
      Math.cos(rx) *
      Math.cos(ry);

    camera.lookAt(
      0,
      0,
      0
    );
  }

  /* =========================================================
     MATERIAL
     ========================================================= */

  function createSheetMaterial() {

    return new THREE.MeshStandardMaterial({
      color: 0xc7cdd4,
      metalness: 0.85,
      roughness: 0.25,
      side: THREE.DoubleSide,
      flatShading: false,
      wireframe:
        !!getView().wireframe
    });
  }

  /* =========================================================
     CREATE FLAT SEGMENT WITH CUP CUT GAPS
     ========================================================= */

  function createFlatSegment(
    p1,
    p2,
    width,
    SCALE,
    cx,
    cz,
    yOffset,
    bendIndex
  ) {

    var dx =
      p2.x -
      p1.x;

    var dz =
      p2.z -
      p1.z;

    var segLen =
      Math.sqrt(
        dx * dx +
        dz * dz
      );

    if (
      segLen <= 0
    ) {
      return;
    }

    var angle =
      Math.atan2(
        dz,
        dx
      );

    var midX =
      (
        p1.x +
        p2.x
      ) / 2;

    var midZ =
      (
        p1.z +
        p2.z
      ) / 2;

    var sheetThick =
      (
        Number(
          getSettings().thickness
        ) || 0.8
      ) * SCALE;

    if (
      sheetThick < 1
    ) {
      sheetThick = 1;
    }

    var material =
      createSheetMaterial();

    /*
     * Normal mode:
     * complete flat panel.
     *
     * Removed mode:
     * create the panel in width strips around
     * cup-cut positions.
     */
    var cuts =
      window.cupCutsRemoved
        ? getCupCutsForBend(
            bendIndex + 1,
            width
          )
        : [];

    /*
     * No cup cuts:
     * one complete box.
     */
    if (
      cuts.length === 0
    ) {

      var geo =
        new THREE.BoxGeometry(
          segLen * SCALE,
          sheetThick,
          width * SCALE
        );

      var mesh =
        new THREE.Mesh(
          geo,
          material
        );

      mesh.position.set(
        midX * SCALE -
          cx * SCALE,

        yOffset,

        midZ * SCALE -
          cz * SCALE
      );

      mesh.rotation.y =
        -angle;

      mesh.castShadow =
        true;

      mesh.receiveShadow =
        true;

      meshGroup.add(mesh);

      return;
    }

    /*
     * Sort cup cuts by width position.
     */
    cuts.sort(
      function(a, b) {
        return a.center -
          b.center;
      }
    );

    /*
     * Build remaining width intervals.
     *
     * Coordinate is along sheet width:
     *
     * 0 ---------------- width
     *
     * cup cut:
     *       [CUT]
     *
     * Remaining:
     * 0 ----     ---- width
     */
    var intervals = [];

    var cursor =
      0;

    cuts.forEach(
      function(cut) {

        var half =
          Math.max(
            cut.size,
            0.25
          ) / 2;

        var left =
          cut.center -
          half;

        var right =
          cut.center +
          half;

        if (
          left > cursor
        ) {

          intervals.push({
            a: cursor,
            b: left
          });
        }

        cursor =
          Math.max(
            cursor,
            right
          );
      }
    );

    if (
      cursor < width
    ) {

      intervals.push({
        a: cursor,
        b: width
      });
    }

    /*
     * Safety:
     * if something goes wrong, keep sheet visible.
     */
    if (
      intervals.length === 0
    ) {
      intervals.push({
        a: 0,
        b: width
      });
    }

    intervals.forEach(
      function(interval) {

        var intervalWidth =
          interval.b -
          interval.a;

        if (
          intervalWidth <= 0.01
        ) {
          return;
        }

        var intervalCenter =
          (
            interval.a +
            interval.b
          ) / 2;

        /*
         * Width in 3D corresponds to Z axis.
         */
        var geo =
          new THREE.BoxGeometry(
            segLen * SCALE,
            sheetThick,
            intervalWidth * SCALE
          );

        var mesh =
          new THREE.Mesh(
            geo,
            material
          );

        mesh.position.set(
          midX * SCALE -
            cx * SCALE,

          yOffset,

          (
            midZ * SCALE -
            cz * SCALE
          ) +
            (
              intervalCenter -
              width / 2
            ) * SCALE
        );

        mesh.rotation.y =
          -angle;

        mesh.castShadow =
          true;

        mesh.receiveShadow =
          true;

        meshGroup.add(mesh);
      }
    );
  }

  /* =========================================================
     CREATE BEND SURFACE
     ---------------------------------------------------------
     IMPORTANT:

     If cupCutsRemoved = TRUE,
     bend surface is split around cup-cut width locations.

     This creates real visible gaps instead of yellow dots.
     ========================================================= */

  function createBendSurface(
    p1,
    p2,
    R,
    K,
    T,
    width,
    SCALE,
    cx,
    cz,
    yOffset
  ) {

    var segments =
      20;

    var neutralR =
      neutralAxisRadius(
        R,
        K,
        T
      );

    var startRad =
      p2.startRad;

    var endRad =
      p2.endRad;

    var cX =
      p2.centerX;

    var cZ =
      p2.centerZ;

    var innerR =
      Math.max(
        0.01,
        neutralR -
          T / 2
      );

    var outerR =
      neutralR +
      T / 2;

    /*
     * Normal = one complete bend.
     *
     * Removed = split across width.
     */
    var cuts =
      window.cupCutsRemoved
        ? getCupCutsForBend(
            p2.lineIndex + 1,
            width / SCALE
          )
        : [];

    /*
     * Build width intervals.
     */
    var intervals = [];

    if (
      cuts.length === 0
    ) {

      intervals.push({
        a: 0,
        b: width
      });

    } else {

      cuts.sort(
        function(a, b) {
          return a.center -
            b.center;
        }
      );

      var cursor =
        0;

      cuts.forEach(
        function(cut) {

          var half =
            Math.max(
              cut.size,
              0.25
            ) / 2;

          var left =
            cut.center -
            half;

          var right =
            cut.center +
            half;

          if (
            left > cursor
          ) {

            intervals.push({
              a: cursor,
              b: left
            });
          }

          cursor =
            Math.max(
              cursor,
              right
            );
        }
      );

      if (
        cursor <
        width / SCALE
      ) {

        intervals.push({
          a: cursor,
          b:
            width / SCALE
        });
      }
    }

    if (
      intervals.length === 0
    ) {
      intervals.push({
        a: 0,
        b: width / SCALE
      });
    }

    intervals.forEach(
      function(interval) {

        createBendStrip(
          startRad,
          endRad,
          cX,
          cZ,
          innerR,
          outerR,
          interval.a,
          interval.b,
          SCALE,
          cx,
          cz,
          yOffset
        );
      }
    );
  }

  /* =========================================================
     CREATE ONE BEND WIDTH STRIP
     ========================================================= */

  function createBendStrip(
    startRad,
    endRad,
    cX,
    cZ,
    innerR,
    outerR,
    widthStart,
    widthEnd,
    SCALE,
    cx,
    cz,
    yOffset
  ) {

    var segments =
      20;

    var positions = [];
    var uvs = [];
    var indices = [];

    var halfWidthStart =
      widthStart -
      (
        widthStart +
        widthEnd
      ) / 2;

    var halfWidthEnd =
      widthEnd -
      (
        widthStart +
        widthEnd
      ) / 2;

    for (
      var i = 0;
      i <= segments;
      i++
    ) {

      var t =
        i /
        segments;

      var angle =
        startRad +
        (
          endRad -
          startRad
        ) * t;

      var cosA =
        Math.cos(angle);

      var sinA =
        Math.sin(angle);

      var ix =
        cX -
        innerR *
        sinA;

      var iz =
        cZ +
        innerR *
        cosA;

      var ox =
        cX -
        outerR *
        sinA;

      var oz =
        cZ +
        outerR *
        cosA;

      /*
       * Width is local Y in original bend coordinate.
       *
       * Convert to 3D Z.
       */
      positions.push(
        ix * SCALE,
        halfWidthStart * SCALE,
        -iz * SCALE
      );

      positions.push(
        ox * SCALE,
        halfWidthStart * SCALE,
        -oz * SCALE
      );

      positions.push(
        ix * SCALE,
        halfWidthEnd * SCALE,
        -iz * SCALE
      );

      positions.push(
        ox * SCALE,
        halfWidthEnd * SCALE,
        -oz * SCALE
      );

      uvs.push(t, 0);
      uvs.push(t, 1);
      uvs.push(t, 0);
      uvs.push(t, 1);
    }

    for (
      var s = 0;
      s < segments;
      s++
    ) {

      var a =
        s * 4;

      var b =
        (s + 1) * 4;

      /* Front */
      indices.push(
        a,
        a + 1,
        b
      );

      indices.push(
        b,
        a + 1,
        b + 1
      );

      /* Back */
      indices.push(
        a + 2,
        b + 2,
        a + 3
      );

      indices.push(
        a + 3,
        b + 2,
        b + 3
      );

      /* Top */
      indices.push(
        a + 1,
        a + 3,
        b + 1
      );

      indices.push(
        b + 1,
        a + 3,
        b + 3
      );

      /* Bottom */
      indices.push(
        a,
        b,
        a + 2
      );

      indices.push(
        a + 2,
        b,
        b + 2
      );
    }

    var geometry =
      new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        positions,
        3
      )
    );

    geometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(
        uvs,
        2
      )
    );

    geometry.setIndex(
      indices
    );

    geometry.computeVertexNormals();

    var material =
      createSheetMaterial();

    var mesh =
      new THREE.Mesh(
        geometry,
        material
      );

    mesh.position.set(
      -cx * SCALE,
      yOffset,
      -cz * SCALE
    );

    mesh.castShadow =
      true;

    mesh.receiveShadow =
      true;

    meshGroup.add(mesh);
  }

  /* =========================================================
     BUILD ONE SHEET
     ========================================================= */

  function buildSheetFromLines(
    lines
  ) {

    if (
      !lines ||
      lines.length === 0
    ) {
      return;
    }

    var width =
      getSheetWidth();

    var path =
      buildBentPath(
        lines
      );

    if (
      path.length < 2
    ) {
      return;
    }

    /* ---------- CENTER ---------- */

    var sumX = 0;
    var sumZ = 0;

    for (
      var i = 0;
      i < path.length;
      i++
    ) {

      sumX +=
        path[i].x;

      sumZ +=
        path[i].z;
    }

    var cx =
      sumX /
      path.length;

    var cz =
      sumZ /
      path.length;

    var SCALE = 10;

    var T =
      Number(
        getSettings().thickness
      ) || 0.8;

    var R =
      Number(
        getSettings().radius
      ) || 0.8;

    var K =
      Number(
        getSettings().kfactor
      ) || 0.44;

    var sheetThick =
      T * SCALE;

    if (
      sheetThick < 1
    ) {
      sheetThick = 1;
    }

    /*
     * One sheet only.
     */
    for (
      var s = 0;
      s < path.length - 1;
      s++
    ) {

      var p1 =
        path[s];

      var p2 =
        path[s + 1];

      /* ---------- FLAT SEGMENT ---------- */

      if (
        p2.type === "flat-end"
      ) {

        createFlatSegment(
          p1,
          p2,
          width,
          SCALE,
          cx,
          cz,
          0,
          p2.lineIndex
        );
      }

      /* ---------- BEND ---------- */

      if (
        p2.type === "bend-end"
      ) {

        createBendSurface(
          p1,
          p2,
          R,
          K,
          T,
          width * SCALE,
          SCALE,
          cx,
          cz,
          0
        );
      }
    }
  }

  /* =========================================================
     CUP CUT STATUS MARKERS
     ---------------------------------------------------------
     No yellow spheres.

     Instead, when cuts are NOT removed,
     we show small red cut-edge lines matching the
     actual cup-cut positions.

     These are ONLY visual indicators.
     When removed = true, geometry gaps are used.
     ========================================================= */

  function drawCupCutIndicators(
    lines
  ) {

    if (
      window.cupCutsRemoved
    ) {
      return;
    }

    if (
      !lines ||
      lines.length < 2
    ) {
      return;
    }

    var width =
      getSheetWidth();

    var positions =
      getDepthBendPositions();

    if (
      positions.length === 0
    ) {
      return;
    }

    var path =
      buildBentPath(
        lines
      );

    var SCALE = 10;

    var sumX = 0;
    var sumZ = 0;

    path.forEach(
      function(p) {
        sumX += p.x;
        sumZ += p.z;
      }
    );

    var cx =
      sumX /
      path.length;

    var cz =
      sumZ /
      path.length;

    var material =
      new THREE.LineBasicMaterial({
        color: 0xdc2626
      });

    /*
     * Draw red short indicators on every bend.
     *
     * No yellow spheres.
     */
    for (
      var i = 0;
      i < path.length;
      i++
    ) {

      if (
        path[i].type !==
        "bend-end"
      ) {
        continue;
      }

      var p =
        path[i];

      var bendX =
        p.x * SCALE -
        cx * SCALE;

      var bendZ =
        p.z * SCALE -
        cz * SCALE;

      var cuts =
        getCupCutsForBend(
          p.lineIndex + 1,
          width
        );

      cuts.forEach(
        function(cut) {

          var half =
            Math.max(
              cut.size,
              0.25
            ) *
            SCALE /
            2;

          /*
           * Visual red line along the width.
           */
          var z =
            (
              cut.center -
              width / 2
            ) * SCALE;

          var geo =
            new THREE.BufferGeometry()
              .setFromPoints([
                new THREE.Vector3(
                  bendX - 2,
                  2,
                  bendZ + z - half
                ),
                new THREE.Vector3(
                  bendX - 2,
                  2,
                  bendZ + z + half
                )
              ]);

          var line =
            new THREE.Line(
              geo,
              material
            );

          meshGroup.add(
            line
          );
        }
      );
    }
  }

  /* =========================================================
     REBUILD 3D
     ========================================================= */

  function rebuild3D() {

    if (!meshGroup) {
      return;
    }

    /* ---------- CLEAR OLD ---------- */

    while (
      meshGroup.children.length > 0
    ) {

      var child =
        meshGroup.children[0];

      meshGroup.remove(
        child
      );

      if (
        child.geometry
      ) {
        child.geometry.dispose();
      }

      if (
        child.material
      ) {

        if (
          Array.isArray(
            child.material
          )
        ) {

          child.material.forEach(
            function(m) {
              if (m) {
                m.dispose();
              }
            }
          );

        } else {
          child.material.dispose();
        }
      }
    }

    var state =
      getState();

    if (!state) {
      return;
    }

    var lenLines =
      state.lenLines ||
      [];

    var depLines =
      state.depLines ||
      [];

    /*
     * IMPORTANT:
     *
     * lenLines = actual folding path
     * depLines = sheet width
     *
     * DO NOT build depLines as a second sheet.
     */
    if (
      lenLines.length === 0
    ) {

      if (
        renderer
      ) {
        renderer.render(
          scene,
          camera
        );
      }

      return;
    }

    /*
     * Build ONE sheet.
     */
    buildSheetFromLines(
      lenLines
    );

    /*
     * Add red indicators only when
     * material has NOT been removed.
     */
    drawCupCutIndicators(
      lenLines
    );

    /* ---------- CAMERA ---------- */

    var maxDist = 0;

    meshGroup.children.forEach(
      function(child) {

        if (
          !child.geometry
        ) {
          return;
        }

        try {
          child.geometry.computeBoundingSphere();
        } catch (e) {
          return;
        }

        var sphere =
          child.geometry
            .boundingSphere;

        if (!sphere) {
          return;
        }

        var r =
          sphere.radius || 0;

        var p =
          child.position;

        var d =
          Math.sqrt(
            p.x * p.x +
            p.y * p.y +
            p.z * p.z
          ) +
          r;

        if (
          d > maxDist
        ) {
          maxDist = d;
        }
      }
    );

    if (
      maxDist > 0
    ) {

      var view =
        getView();

      view.dist =
        Math.max(
          400,
          maxDist * 2.5
        );

      updateCamera();
    }

    if (
      renderer
    ) {
      renderer.render(
        scene,
        camera
      );
    }
  }

  /* =========================================================
     DRAW
     ========================================================= */

  function draw() {

    if (!renderer) {

      var canvas =
        getEl("canvas3d");

      if (
        canvas &&
        canvas.clientWidth > 0
      ) {
        setup3D();
      }

      if (!renderer) {
        return;
      }
    }

    rebuild3D();
  }

  /* =========================================================
     3D INTERACTIONS
     ========================================================= */

  function bind3DInteractions() {

    if (
      !canvas3dEl
    ) {
      return;
    }

    var drag = {
      active: false,
      x: 0,
      y: 0,
      rotX: 0,
      rotY: 0
    };

    var pinch = {
      active: false,
      dist: 0,
      camDist: 0
    };

    function getDist(
      t1,
      t2
    ) {

      return Math.hypot(
        t1.clientX -
          t2.clientX,

        t1.clientY -
          t2.clientY
      );
    }

    /* ---------- TOUCH START ---------- */

    canvas3dEl.addEventListener(
      "touchstart",
      function(e) {

        if (
          e.touches.length === 2
        ) {

          pinch.active =
            true;

          pinch.dist =
            getDist(
              e.touches[0],
              e.touches[1]
            );

          pinch.camDist =
            getView().dist;

        } else if (
          e.touches.length === 1
        ) {

          drag.active =
            true;

          drag.x =
            e.touches[0].clientX;

          drag.y =
            e.touches[0].clientY;

          drag.rotX =
            getView().rotX;

          drag.rotY =
            getView().rotY;
        }
      },
      {
        passive: true
      }
    );

    /* ---------- TOUCH MOVE ---------- */

    canvas3dEl.addEventListener(
      "touchmove",
      function(e) {

        if (
          pinch.active &&
          e.touches.length === 2
        ) {

          e.preventDefault();

          var d =
            getDist(
              e.touches[0],
              e.touches[1]
            );

          if (
            d <= 0
          ) {
            return;
          }

          var v =
            getView();

          v.dist =
            Math.max(
              100,

              Math.min(
                20000,

                pinch.camDist *
                  (
                    pinch.dist /
                    d
                  )
              )
            );

          updateCamera();

          if (
            renderer
          ) {
            renderer.render(
              scene,
              camera
            );
          }

        } else if (
          drag.active &&
          e.touches.length === 1
        ) {

          e.preventDefault();

          var dx =
            e.touches[0].clientX -
            drag.x;

          var dy =
            e.touches[0].clientY -
            drag.y;

          var v2 =
            getView();

          v2.rotY =
            drag.rotY +
            dx * 0.4;

          v2.rotX =
            drag.rotX -
            dy * 0.4;

          v2.rotX =
            Math.max(
              -89,
              Math.min(
                89,
                v2.rotX
              )
            );

          updateCamera();

          if (
            renderer
          ) {
            renderer.render(
              scene,
              camera
            );
          }
        }
      },
      {
        passive: false
      }
    );

    /* ---------- TOUCH END ---------- */

    canvas3dEl.addEventListener(
      "touchend",
      function() {

        drag.active =
          false;

        pinch.active =
          false;
      }
    );

    /* ---------- MOUSE DOWN ---------- */

    canvas3dEl.addEventListener(
      "mousedown",
      function(e) {

        drag.active =
          true;

        drag.x =
          e.clientX;

        drag.y =
          e.clientY;

        drag.rotX =
          getView().rotX;

        drag.rotY =
          getView().rotY;
      }
    );

    /* ---------- MOUSE MOVE ---------- */

    window.addEventListener(
      "mousemove",
      function(e) {

        if (
          !drag.active ||
          !renderer
        ) {
          return;
        }

        var v =
          getView();

        v.rotY =
          drag.rotY +
          (
            e.clientX -
            drag.x
          ) * 0.4;

        v.rotX =
          drag.rotX -
          (
            e.clientY -
            drag.y
          ) * 0.4;

        v.rotX =
          Math.max(
            -89,
            Math.min(
              89,
              v.rotX
            )
          );

        updateCamera();

        renderer.render(
          scene,
          camera
        );
      }
    );

    /* ---------- MOUSE UP ---------- */

    window.addEventListener(
      "mouseup",
      function() {
        drag.active =
          false;
      }
    );

    /* ---------- MOUSE WHEEL ---------- */

    canvas3dEl.addEventListener(
      "wheel",
      function(e) {

        e.preventDefault();

        var v =
          getView();

        v.dist =
          Math.max(
            100,

            Math.min(
              20000,

              v.dist +
                e.deltaY * 2
            )
          );

        updateCamera();

        if (
          renderer
        ) {
          renderer.render(
            scene,
            camera
          );
        }
      },
      {
        passive: false
      }
    );
  }

  /* =========================================================
     ZOOM
     ========================================================= */

  function zoomIn3D() {

    var v =
      getView();

    v.dist =
      Math.max(
        100,
        v.dist * 0.8
      );

    updateCamera();

    if (
      renderer
    ) {
      renderer.render(
        scene,
        camera
      );
    }
  }

  function zoomOut3D() {

    var v =
      getView();

    v.dist =
      Math.min(
        20000,
        v.dist * 1.25
      );

    updateCamera();

    if (
      renderer
    ) {
      renderer.render(
        scene,
        camera
      );
    }
  }

  /* =========================================================
     RESET
     ========================================================= */

  function reset3D() {

    var v =
      getView();

    v.rotX =
      -25;

    v.rotY =
      35;

    v.dist =
      900;

    v.autoRotate =
      false;

    var btn =
      getEl(
        "btn-auto-rotate"
      );

    if (btn) {

      btn.classList.remove(
        "active"
      );

      btn.textContent =
        "▶ Auto";
    }

    updateCamera();

    if (
      renderer
    ) {
      renderer.render(
        scene,
        camera
      );
    }
  }

  /* =========================================================
     AUTO ROTATE
     ========================================================= */

  function autoRotateLoop() {

    var v =
      getView();

    if (
      !v.autoRotate
    ) {
      return;
    }

    v.rotY +=
      0.4;

    updateCamera();

    if (
      renderer
    ) {
      renderer.render(
        scene,
        camera
      );
    }

    requestAnimationFrame(
      autoRotateLoop
    );
  }

  /* =========================================================
     WIREFRAME
     ========================================================= */

  function toggleWireframe() {

    var v =
      getView();

    v.wireframe =
      !v.wireframe;

    var btn =
      getEl(
        "btn-wireframe"
      );

    if (btn) {

      btn.classList.toggle(
        "active",
        v.wireframe
      );
    }

    rebuild3D();
  }

  /* =========================================================
     AUTO ROTATE TOGGLE
     ========================================================= */

  function toggleAutoRotate() {

    var v =
      getView();

    v.autoRotate =
      !v.autoRotate;

    var btn =
      getEl(
        "btn-auto-rotate"
      );

    if (btn) {

      btn.classList.toggle(
        "active",
        v.autoRotate
      );

      btn.textContent =
        v.autoRotate
          ? "⏸ Stop"
          : "▶ Auto";
    }

    if (
      v.autoRotate
    ) {
      autoRotateLoop();
    }
  }

  /* =========================================================
     RESIZE
     ========================================================= */

  function resize3D() {

    if (
      !renderer ||
      !camera ||
      !canvas3dEl
    ) {
      return;
    }

    var W =
      canvas3dEl.clientWidth;

    var H =
      canvas3dEl.clientHeight;

    if (
      W <= 0 ||
      H <= 0
    ) {
      return;
    }

    camera.aspect =
      W / H;

    camera.updateProjectionMatrix();

    renderer.setSize(
      W,
      H
    );

    renderer.render(
      scene,
      camera
    );
  }

  /* =========================================================
     BIND BUTTONS
     ========================================================= */

  function bindButtons() {

    var zi =
      getEl(
        "btn-zoom-in-3d"
      );

    var zo =
      getEl(
        "btn-zoom-out-3d"
      );

    var rs =
      getEl(
        "btn-reset-3d"
      );

    var wf =
      getEl(
        "btn-wireframe"
      );

    var ar =
      getEl(
        "btn-auto-rotate"
      );

    if (zi) {
      zi.onclick =
        zoomIn3D;
    }

    if (zo) {
      zo.onclick =
        zoomOut3D;
    }

    if (rs) {
      rs.onclick =
        reset3D;
    }

    if (wf) {
      wf.onclick =
        toggleWireframe;
    }

    if (ar) {
      ar.onclick =
        toggleAutoRotate;
    }

    window.addEventListener(
      "resize",
      function() {
        resize3D();
      }
    );
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {

    bindButtons();

    setTimeout(
      function() {

        setup3D();

        draw();

      },
      150
    );
  }

  /* =========================================================
     EXPOSE
     ========================================================= */

  window.ThreeD = {

    init:
      init,

    setup:
      setup3D,

    draw:
      draw,

    reset:
      reset3D,

    resize:
      resize3D,

    zoomIn:
      zoomIn3D,

    zoomOut:
      zoomOut3D

  };

})();
