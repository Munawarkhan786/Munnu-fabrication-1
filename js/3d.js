/* =========================================================
   3D.JS
   MASTER CONNECTED SHEET VIEW V7
   ---------------------------------------------------------
   GeometryEngine = BRAIN
   ThreeD = VISUAL SIMULATOR

   IMPORTANT:
   This file does NOT calculate bend allowance,
   bend deduction, angle or cup-cut decisions.

   Everything comes from:
       GeometryEngine.analyze()

   3D responsibilities:
       - build connected sheet panels
       - show thickness
       - show bend direction
       - show bend radius visually
       - show cup-cut positions
       - rotate / zoom
       - wireframe
       - auto rotate

   ========================================================= */

(function () {

  "use strict";


  /* =========================================================
     THREE.JS STATE
     ========================================================= */

  var scene = null;
  var camera = null;
  var renderer = null;

  var canvas3dEl = null;

  var masterGroup = null;
  var sheetGroup = null;
  var bendGroup = null;
  var cutGroup = null;
  var helperGroup = null;

  var animationId = null;

  var initialized = false;

  var masterData = null;


  /* =========================================================
     HELPERS
     ========================================================= */

  function $(id) {
    return document.getElementById(id);
  }


  function num(v, fallback) {

    var n =
      parseFloat(v);

    return Number.isFinite(n)
      ? n
      : (fallback || 0);
  }


  function mmTo3D(mm) {

    /*
       Visual scale.

       10 Three.js units ≈ 1 inch
       because fabrication dimensions are
       primarily inch based.
    */

    return num(mm) *
      0.3937007874 *
      10;
  }


  function inchTo3D(inch) {

    return num(inch) * 10;
  }


  function getState() {

    return (
      window.AppState ||
      window.state ||
      {}
    );
  }


  /* =========================================================
     GET MASTER GEOMETRY
     ========================================================= */

  function getMasterData() {

    if (
      !window.GeometryEngine ||
      typeof window.GeometryEngine.analyze !==
      "function"
    ) {

      console.error(
        "3D: GeometryEngine unavailable"
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
        "3D: GeometryEngine failed",
        err
      );

      return null;
    }
  }


  /* =========================================================
     INIT
     ========================================================= */

  function init() {

    canvas3dEl =
      $("canvas3d");

    if (!canvas3dEl) {

      /*
         Some versions use a container
         instead of canvas element.
      */

      canvas3dEl =
        $("canvas3d-container");
    }

    if (!canvas3dEl) {

      console.warn(
        "3D: #canvas3d not found"
      );

      return;
    }


    if (
      typeof THREE ===
      "undefined"
    ) {

      console.error(
        "3D: Three.js not loaded"
      );

      return;
    }


    createScene();

    bindControls();

    initialized = true;

    draw();
  }


  /* =========================================================
     CREATE SCENE
     ========================================================= */

  function createScene() {

    scene =
      new THREE.Scene();

    scene.background =
      new THREE.Color(
        0x111318
      );


    var rect =
      canvas3dEl.getBoundingClientRect();


    camera =
      new THREE.PerspectiveCamera(
        45,
        Math.max(
          1,
          rect.width
        ) /
        Math.max(
          1,
          rect.height
        ),
        0.1,
        100000
      );


    camera.position.set(
      180,
      150,
      220
    );


    renderer =
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: false
      });


    renderer.setPixelRatio(
      window.devicePixelRatio || 1
    );

    renderer.setSize(
      Math.max(
        300,
        rect.width
      ),
      Math.max(
        300,
        rect.height
      )
    );


    /*
       If #canvas3d is a container,
       append renderer canvas.
    */

    if (
      canvas3dEl.tagName !==
      "CANVAS"
    ) {

      canvas3dEl.innerHTML =
        "";

      canvas3dEl.appendChild(
        renderer.domElement
      );
    }


    /*
       Lighting
    */

    var ambient =
      new THREE.AmbientLight(
        0xffffff,
        1.5
      );

    scene.add(
      ambient
    );


    var key =
      new THREE.DirectionalLight(
        0xffffff,
        2.0
      );

    key.position.set(
      300,
      500,
      400
    );

    scene.add(
      key
    );


    var fill =
      new THREE.DirectionalLight(
        0xffffff,
        1.0
      );

    fill.position.set(
      -300,
      200,
      -300
    );

    scene.add(
      fill
    );


    masterGroup =
      new THREE.Group();

    sheetGroup =
      new THREE.Group();

    bendGroup =
      new THREE.Group();

    cutGroup =
      new THREE.Group();

    helperGroup =
      new THREE.Group();


    masterGroup.add(
      sheetGroup
    );

    masterGroup.add(
      bendGroup
    );

    masterGroup.add(
      cutGroup
    );

    masterGroup.add(
      helperGroup
    );

    scene.add(
      masterGroup
    );


    /*
       Ground reference
    */

    createGround();


    window.addEventListener(
      "resize",
      resize
    );
  }


  /* =========================================================
     GROUND
     ========================================================= */

  function createGround() {

    var geometry =
      new THREE.PlaneGeometry(
        1000,
        1000
      );

    var material =
      new THREE.MeshStandardMaterial({
        color: 0x17191e,
        side: THREE.DoubleSide
      });

    var ground =
      new THREE.Mesh(
        geometry,
        material
      );

    ground.rotation.x =
      -Math.PI / 2;

    ground.position.y =
      -3;

    helperGroup.add(
      ground
    );


    var grid =
      new THREE.GridHelper(
        1000,
        50
      );

    grid.position.y =
      -2.8;

    helperGroup.add(
      grid
    );
  }


  /* =========================================================
     RESIZE
     ========================================================= */

  function resize() {

    if (
      !renderer ||
      !camera ||
      !canvas3dEl
    ) {
      return;
    }

    var rect =
      canvas3dEl.getBoundingClientRect();

    var width =
      Math.max(
        300,
        rect.width
      );

    var height =
      Math.max(
        300,
        rect.height
      );

    camera.aspect =
      width / height;

    camera.updateProjectionMatrix();

    renderer.setSize(
      width,
      height
    );
  }


  /* =========================================================
     CLEAR MASTER
     ========================================================= */

  function clearMaster() {

    if (sheetGroup) {

      while (
        sheetGroup.children.length
      ) {

        sheetGroup.remove(
          sheetGroup.children[0]
        );
      }
    }


    if (bendGroup) {

      while (
        bendGroup.children.length
      ) {

        bendGroup.remove(
          bendGroup.children[0]
        );
      }
    }


    if (cutGroup) {

      while (
        cutGroup.children.length
      ) {

        cutGroup.remove(
          cutGroup.children[0]
        );
      }
    }
  }


  /* =========================================================
     DRAW
     ========================================================= */

  function draw() {

    if (
      !initialized ||
      !scene ||
      !renderer
    ) {
      return;
    }

    var data =
      getMasterData();

    if (!data) {
      return;
    }

    masterData =
      data;

    clearMaster();

    buildConnectedSheet(
      data
    );

    buildBendMarkers(
      data
    );

    buildPhysicalCuts(
      data
    );

    applyWireframe();

    fitCamera(
      data
    );

    render();
  }


  /* =========================================================
     MASTER CONNECTED SHEET
     ========================================================= */

  function buildConnectedSheet(
    data
  ) {

    var sheet =
      data.sheet;

    if (!sheet) {
      return;
    }


    var thickness =
      num(
        data.settings &&
        data.settings.thickness,
        0.8
      );


    /*
       Base flat sheet.

       This is the master developed sheet
       from GeometryEngine.

       Individual bend panels are created
       from GeometryEngine line positions.
    */

    var width =
      inchTo3D(
        sheet.widthInch
      );

    var depth =
      inchTo3D(
        sheet.heightInch
      );

    var t =
      mmTo3D(
        thickness
      );


    /*
       Main sheet.

       It is kept as ONE connected body
       instead of unrelated boxes.
    */

    var geometry =
      new THREE.BoxGeometry(
        width,
        t,
        depth
      );


    var material =
      new THREE.MeshStandardMaterial({

        color:
          0xc8cdd2,

        metalness:
          0.85,

        roughness:
          0.28,

        side:
          THREE.DoubleSide
      });


    var sheetMesh =
      new THREE.Mesh(
        geometry,
        material
      );


    /*
       Put sheet around origin.
    */

    sheetMesh.position.set(
      width / 2,
      0,
      depth / 2
    );


    sheetGroup.add(
      sheetMesh
    );


    /*
       Add actual bend zones / raised
       visual panels.
    */

    buildBendPanels(
      data,
      t
    );
  }


  /* =========================================================
     BEND PANELS
     ========================================================= */

  function buildBendPanels(
    data,
    thickness3D
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
       Length-side bend panels
    */

    lengthLines.forEach(
      function (line) {

        if (
          !line.isBend
        ) {
          return;
        }

        buildLengthPanel(
          line,
          data,
          thickness3D
        );
      }
    );


    /*
       Depth-side bend panels
    */

    depthLines.forEach(
      function (line) {

        if (
          !line.isBend
        ) {
          return;
        }

        buildDepthPanel(
          line,
          data,
          thickness3D
        );
      }
    );
  }


  /* =========================================================
     LENGTH PANEL
     ========================================================= */

  function buildLengthPanel(
    line,
    data,
    thickness3D
  ) {

    var x =
      inchTo3D(
        line.bendCenterInch
      );

    var width =
      Math.max(
        1,
        mmTo3D(
          Math.max(
            line.radiusMM,
            line.thicknessMM
          )
        )
      );


    /*
       Panel visual.

       The center stays connected to
       the master sheet.
    */

    var height =
      Math.max(
        1,
        inchTo3D(
          data.sheet.heightInch
        )
      );


    var geometry =
      new THREE.BoxGeometry(
        width,
        thickness3D,
        height
      );


    var material =
      createSheetMaterial();


    var mesh =
      new THREE.Mesh(
        geometry,
        material
      );


    mesh.position.set(
      x,
      0,
      height / 2
    );


    /*
       UP / DOWN visual orientation.

       This is a visual bend indication.
    */

    var angle =
      num(
        line.effectiveAngle
      );

    var sign =
      line.direction === "down"
        ? -1
        : 1;

    mesh.rotation.z =
      sign *
      angle *
      Math.PI /
      180;


    sheetGroup.add(
      mesh
    );
  }


  /* =========================================================
     DEPTH PANEL
     ========================================================= */

  function buildDepthPanel(
    line,
    data,
    thickness3D
  ) {

    var z =
      inchTo3D(
        line.bendCenterInch
      );

    var width =
      Math.max(
        1,
        mmTo3D(
          Math.max(
            line.radiusMM,
            line.thicknessMM
          )
        )
      );


    var sheetWidth =
      Math.max(
        1,
        inchTo3D(
          data.sheet.widthInch
        )
      );


    var geometry =
      new THREE.BoxGeometry(
        sheetWidth,
        thickness3D,
        width
      );


    var material =
      createSheetMaterial();


    var mesh =
      new THREE.Mesh(
        geometry,
        material
      );


    mesh.position.set(
      sheetWidth / 2,
      0,
      z
    );


    var angle =
      num(
        line.effectiveAngle
      );

    var sign =
      line.direction === "down"
        ? -1
        : 1;

    mesh.rotation.x =
      sign *
      angle *
      Math.PI /
      180;


    sheetGroup.add(
      mesh
    );
  }


  /* =========================================================
     SHEET MATERIAL
     ========================================================= */

  function createSheetMaterial() {

    return new THREE.MeshStandardMaterial({

      color:
        0xc8cdd2,

      metalness:
        0.88,

      roughness:
        0.25,

      side:
        THREE.DoubleSide
    });
  }


  /* =========================================================
     BEND MARKERS
     ========================================================= */

  function buildBendMarkers(
    data
  ) {

    var lines =
      [];

    if (
      data.flat &&
      data.flat.lengthLines
    ) {

      lines =
        lines.concat(
          data.flat.lengthLines
        );
    }

    if (
      data.flat &&
      data.flat.depthLines
    ) {

      lines =
        lines.concat(
          data.flat.depthLines
        );
    }


    lines.forEach(
      function (line) {

        if (
          !line.isBend
        ) {
          return;
        }

        buildBendMarker(
          line,
          data
        );
      }
    );
  }


  function buildBendMarker(
    line,
    data
  ) {

    var material =
      new THREE.LineBasicMaterial({
        color: 0xff3030
      });


    var points = [];


    if (
      line.side ===
      "length"
    ) {

      var x =
        inchTo3D(
          line.bendCenterInch
        );

      var z1 =
        0;

      var z2 =
        inchTo3D(
          data.sheet.heightInch
        );

      points.push(
        new THREE.Vector3(
          x,
          2,
          z1
        )
      );

      points.push(
        new THREE.Vector3(
          x,
          2,
          z2
        )
      );

    } else {

      var z =
        inchTo3D(
          line.bendCenterInch
        );

      var x1 =
        0;

      var x2 =
        inchTo3D(
          data.sheet.widthInch
        );

      points.push(
        new THREE.Vector3(
          x1,
          2,
          z
        )
      );

      points.push(
        new THREE.Vector3(
          x2,
          2,
          z
        )
      );
    }


    var geometry =
      new THREE.BufferGeometry()
        .setFromPoints(
          points
        );


    var lineMesh =
      new THREE.Line(
        geometry,
        material
      );


    bendGroup.add(
      lineMesh
    );


    /*
       Bend direction arrow
    */

    buildDirectionArrow(
      line,
      data
    );
  }


  /* =========================================================
     DIRECTION ARROW
     ========================================================= */

  function buildDirectionArrow(
    line,
    data
  ) {

    var origin;

    if (
      line.side ===
      "length"
    ) {

      origin =
        new THREE.Vector3(
          inchTo3D(
            line.bendCenterInch
          ),
          5,
          inchTo3D(
            data.sheet.heightInch / 2
          )
        );

    } else {

      origin =
        new THREE.Vector3(
          inchTo3D(
            data.sheet.widthInch / 2
          ),
          5,
          inchTo3D(
            line.bendCenterInch
          )
        );
    }


    var dir =
      new THREE.Vector3(
        0,
        line.direction === "down"
          ? -1
          : 1,
        0
      );


    var arrow =
      new THREE.ArrowHelper(
        dir,
        origin,
        12,
        0xff3030,
        4,
        2
      );


    bendGroup.add(
      arrow
    );
  }


  /* =========================================================
     PHYSICAL CUTS
     ========================================================= */

  function buildPhysicalCuts(
    data
  ) {

    var cuts =
      data.cuts || [];


    cuts.forEach(
      function (cut) {

        if (
          isCutHidden(
            cut
          )
        ) {
          return;
        }

        buildCut(
          cut,
          data
        );
      }
    );
  }


  function buildCut(
    cut,
    data
  ) {

    var width =
      Math.max(
        0.5,
        inchTo3D(
          cut.widthInch
        )
      );

    var depth =
      Math.max(
        0.5,
        inchTo3D(
          cut.depthInch
        )
      );


    /*
       Red transparent physical cut marker.

       NOTE:
       Three.js does not yet boolean-subtract
       the sheet in this version.

       This is the master cut location and
       size from GeometryEngine.
    */

    var geometry =
      new THREE.BoxGeometry(
        width,
        3,
        depth
      );


    var material =
      new THREE.MeshBasicMaterial({

        color:
          0xff2020,

        transparent:
          true,

        opacity:
          0.72,

        depthWrite:
          false
      });


    var mesh =
      new THREE.Mesh(
        geometry,
        material
      );


    mesh.position.set(

      inchTo3D(
        cut.xInch
      ),

      3,

      inchTo3D(
        cut.yInch
      )
    );


    cutGroup.add(
      mesh
    );


    /*
       X marker
    */

    var points1 = [
      new THREE.Vector3(
        -width / 2,
        4,
        -depth / 2
      ),
      new THREE.Vector3(
        width / 2,
        4,
        depth / 2
      )
    ];


    var points2 = [
      new THREE.Vector3(
        width / 2,
        4,
        -depth / 2
      ),
      new THREE.Vector3(
        -width / 2,
        4,
        depth / 2
      )
    ];


    addCutLine(
      points1
    );

    addCutLine(
      points2
    );
  }


  function addCutLine(
    points
  ) {

    var geometry =
      new THREE.BufferGeometry()
        .setFromPoints(
          points
        );


    var material =
      new THREE.LineBasicMaterial({
        color:
          0xff2020
      });


    var line =
      new THREE.Line(
        geometry,
        material
      );


    cutGroup.add(
      line
    );
  }


  function isCutHidden(
    cut
  ) {

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
     WIREFRAME
     ========================================================= */

  function applyWireframe() {

    var enabled =
      !!(
        window.view3d &&
        window.view3d.wireframe
      );


    sheetGroup.traverse(
      function (obj) {

        if (
          obj.material &&
          obj.material.isMeshStandardMaterial
        ) {

          obj.material.wireframe =
            enabled;
        }
      }
    );
  }


  /* =========================================================
     CAMERA FIT
     ========================================================= */

  function fitCamera(
    data
  ) {

    if (!camera) {
      return;
    }

    var width =
      inchTo3D(
        num(
          data.sheet &&
          data.sheet.widthInch,
          10
        )
      );

    var depth =
      inchTo3D(
        num(
          data.sheet &&
          data.sheet.heightInch,
          10
        )
      );


    var maxSize =
      Math.max(
        width,
        depth,
        50
      );


    var view =
      window.view3d ||
      {};


    var rotX =
      num(
        view.rotX,
        -25
      );

    var rotY =
      num(
        view.rotY,
        35
      );


    var dist =
      Math.max(
        maxSize * 1.6,
        num(
          view.dist,
          maxSize * 2
        )
      );


    var rx =
      rotX *
      Math.PI /
      180;

    var ry =
      rotY *
      Math.PI /
      180;


    var target =
      new THREE.Vector3(
        width / 2,
        0,
        depth / 2
      );


    camera.position.set(

      target.x +
      Math.sin(ry) *
      dist,

      target.y +
      Math.sin(-rx) *
      dist,

      target.z +
      Math.cos(ry) *
      dist
    );


    camera.lookAt(
      target
    );
  }


  /* =========================================================
     RENDER
     ========================================================= */

  function render() {

    if (
      renderer &&
      scene &&
      camera
    ) {

      renderer.render(
        scene,
        camera
      );
    }
  }


  /* =========================================================
     ANIMATION
     ========================================================= */

  function animate() {

    animationId =
      requestAnimationFrame(
        animate
      );


    if (
      window.view3d &&
      window.view3d.autoRotate &&
      masterGroup
    ) {

      masterGroup.rotation.y +=
        0.008;
    }


    render();
  }


  /* =========================================================
     CONTROLS
     ========================================================= */

  function bindControls() {

    if (!canvas3dEl) {
      return;
    }


    var target =
      renderer
        ? renderer.domElement
        : canvas3dEl;


    var dragging = false;

    var lastX = 0;
    var lastY = 0;


    target.addEventListener(
      "pointerdown",
      function (e) {

        dragging = true;

        lastX =
          e.clientX;

        lastY =
          e.clientY;

        try {

          target.setPointerCapture(
            e.pointerId
          );

        } catch (_) {}
      }
    );


    target.addEventListener(
      "pointermove",
      function (e) {

        if (!dragging) {
          return;
        }


        var dx =
          e.clientX -
          lastX;

        var dy =
          e.clientY -
          lastY;


        masterGroup.rotation.y +=
          dx * 0.01;

        masterGroup.rotation.x +=
          dy * 0.01;


        lastX =
          e.clientX;

        lastY =
          e.clientY;


        render();
      }
    );


    target.addEventListener(
      "pointerup",
      function (e) {

        dragging = false;

        try {

          target.releasePointerCapture(
            e.pointerId
          );

        } catch (_) {}
      }
    );


    target.addEventListener(
      "pointercancel",
      function () {

        dragging = false;
      }
    );


    target.addEventListener(
      "wheel",
      function (e) {

        e.preventDefault();

        if (!window.view3d) {

          window.view3d = {

            rotX: -25,
            rotY: 35,
            dist: 900,
            autoRotate: false,
            wireframe: false
          };
        }


        var factor =
          e.deltaY < 0
            ? 0.9
            : 1.1;


        window.view3d.dist *=
          factor;


        window.view3d.dist =
          Math.max(
            30,
            Math.min(
              10000,
              window.view3d.dist
            )
          );


        fitCamera(
          masterData ||
          getMasterData()
        );

        render();
      },
      {
        passive: false
      }
    );
  }


  /* =========================================================
     PUBLIC CONTROLS
     ========================================================= */

  function setWireframe(
    value
  ) {

    if (!window.view3d) {
      return;
    }

    window.view3d.wireframe =
      !!value;

    applyWireframe();

    render();
  }


  function setAutoRotate(
    value
  ) {

    if (!window.view3d) {
      return;
    }

    window.view3d.autoRotate =
      !!value;
  }


  function resetView() {

    if (!masterGroup) {
      return;
    }

    masterGroup.rotation.set(
      0,
      0,
      0
    );

    if (window.view3d) {

      window.view3d.rotX =
        -25;

      window.view3d.rotY =
        35;
    }


    fitCamera(
      masterData ||
      getMasterData()
    );

    render();
  }


  /* =========================================================
     START ANIMATION
     ========================================================= */

  function startAnimation() {

    if (!animationId) {

      animate();
    }
  }


  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.ThreeD = {

    init:
      init,

    draw:
      draw,

    resize:
      resize,

    render:
      render,

    reset:
      resetView,

    resetView:
      resetView,

    setWireframe:
      setWireframe,

    setAutoRotate:
      setAutoRotate,

    getMasterData:
      getMasterData,

    startAnimation:
      startAnimation
  };


  console.log(
    "ThreeD V7 loaded — Master Geometry viewer"
  );

})();
