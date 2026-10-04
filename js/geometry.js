/* =========================================================
   GEOMETRY ENGINE V4
   Master Engineering Geometry
   ---------------------------------------------------------
   Flow:
   USER INPUT
      ↓
   normalize input
      ↓
   BA / BD / setback
      ↓
   bend positions
      ↓
   bend sequence
      ↓
   Length × Depth interaction
      ↓
   interference / relief
      ↓
   cup-cut decision
      ↓
   MASTER RESULT
   ========================================================= */

(function () {
  "use strict";

  var EPS = 0.000001;

  /* =======================================================
     BASIC HELPERS
     ======================================================= */

  function num(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function round(v, digits) {
    var p = Math.pow(10, digits || 4);
    return Math.round(v * p) / p;
  }

  function round16(v) {
    return Math.round(v * 16) / 16;
  }

  function degToRad(deg) {
    return deg * Math.PI / 180;
  }

  function radToDeg(rad) {
    return rad * 180 / Math.PI;
  }

  function inchToMM(v) {
    return v * 25.4;
  }

  function mmToInch(v) {
    return v / 25.4;
  }

  function cleanZero(v) {
    return Math.abs(v) < EPS ? 0 : v;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /* =======================================================
     VECTOR HELPERS
     ======================================================= */

  function vec(x, y, z) {
    return {
      x: num(x),
      y: num(y),
      z: num(z)
    };
  }

  function add(a, b) {
    return vec(
      a.x + b.x,
      a.y + b.y,
      a.z + b.z
    );
  }

  function sub(a, b) {
    return vec(
      a.x - b.x,
      a.y - b.y,
      a.z - b.z
    );
  }

  function mul(a, n) {
    return vec(
      a.x * n,
      a.y * n,
      a.z * n
    );
  }

  function length(a) {
    return Math.sqrt(
      a.x * a.x +
      a.y * a.y +
      a.z * a.z
    );
  }

  function normalize(a) {
    var l = length(a);

    if (l < EPS) {
      return vec(0, 0, 0);
    }

    return mul(a, 1 / l);
  }

  function dot(a, b) {
    return (
      a.x * b.x +
      a.y * b.y +
      a.z * b.z
    );
  }

  function cross(a, b) {
    return vec(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }

  function distance3D(a, b) {
    return length(sub(a, b));
  }

  /* =======================================================
     SETTINGS
     ======================================================= */

  function getSettings() {
    var s = window.AppState && window.AppState.settings;

    if (!s && window.state) {
      s = window.state.settings;
    }

    s = s || {};

    var material = s.material || "SS304";

    var thickness = clamp(
      num(s.thickness, 0.8),
      0.1,
      10
    );

    var radius = clamp(
      num(s.radius, 0.8),
      0.1,
      50
    );

    var kDefault =
      material === "SS202" ? 0.45 : 0.44;

    var kfactor = clamp(
      num(s.kfactor, kDefault),
      0,
      1
    );

    var springback = clamp(
      num(s.springback, 0.5),
      0,
      30
    );

    var relief = clamp(
      num(s.relief, 1.6),
      0,
      50
    );

    var vdie = clamp(
      num(s.vdie, 6),
      0.1,
      100
    );

    return {
      material: material,
      thickness: thickness,
      radius: radius,
      kfactor: kfactor,
      springback: springback,
      relief: relief,
      vdie: vdie
    };
  }

  /* =======================================================
     INPUT NORMALIZATION
     ======================================================= */

  function normalizeAngle(line) {
    var a = num(
      line && (
        line.angle !== undefined
          ? line.angle
          : line.degree
      ),
      90
    );

    /*
      Engineering range:
      0° = no bend
      90° = right angle
      135° = reverse/obtuse bend
      180° = full fold limit
    */

    return clamp(a, 0, 180);
  }

  function normalizeBend(line) {
    var b = String(
      line && (
        line.bend !== undefined
          ? line.bend
          : line.direction
      )
    ).toLowerCase();

    if (
      b === "down" ||
      b === "downward" ||
      b === "d" ||
      b === "-1" ||
      b === "false"
    ) {
      return "down";
    }

    return "up";
  }

  function effectiveAngle(line, settings) {
    var a = normalizeAngle(line);

    /*
      Springback is subtracted from the intended bend.
      Never allow a negative physical bend.
    */

    return clamp(
      a - settings.springback,
      0,
      180
    );
  }

  /* =======================================================
     BEND ENGINEERING FORMULAS
     ======================================================= */

  function bendAllowance(angleDeg, radius, thickness, kfactor) {
    var angleRad = degToRad(angleDeg);

    var neutralRadius =
      radius + (kfactor * thickness);

    var baMM =
      angleRad * neutralRadius;

    return {
      angleDeg: angleDeg,
      angleRad: angleRad,
      neutralRadiusMM: neutralRadius,
      baMM: baMM,
      baInch: mmToInch(baMM)
    };
  }

  function bendDeduction(angleDeg, radius, thickness, kfactor) {
    var ba = bendAllowance(
      angleDeg,
      radius,
      thickness,
      kfactor
    );

    var setback =
      (radius + thickness) *
      Math.tan(degToRad(angleDeg) / 2);

    var bd =
      (2 * setback) - ba.baMM;

    return {
      setbackMM: setback,
      setbackInch: mmToInch(setback),
      bdMM: bd,
      bdInch: mmToInch(bd),
      baMM: ba.baMM,
      baInch: ba.baInch
    };
  }

  function calculateBend(line, settings) {
    var intended = normalizeAngle(line);

    var effective = effectiveAngle(
      line,
      settings
    );

    var ba = bendAllowance(
      effective,
      settings.radius,
      settings.thickness,
      settings.kfactor
    );

    var bd = bendDeduction(
      effective,
      settings.radius,
      settings.thickness,
      settings.kfactor
    );

    return {
      intendedAngleDeg: round(intended, 3),
      effectiveAngleDeg: round(effective, 3),

      direction: normalizeBend(line),

      thicknessMM: settings.thickness,
      radiusMM: settings.radius,
      kfactor: settings.kfactor,

      neutralRadiusMM:
        round(ba.neutralRadiusMM, 4),

      bendAllowanceMM:
        round(ba.baMM, 4),

      bendAllowanceInch:
        round(ba.baInch, 6),

      setbackMM:
        round(bd.setbackMM, 4),

      setbackInch:
        round(bd.setbackInch, 6),

      bendDeductionMM:
        round(bd.bdMM, 4),

      bendDeductionInch:
        round(bd.bdInch, 6)
    };
  }

  /* =======================================================
     LINE DATA
     ======================================================= */

  function createLineData(
    line,
    side,
    index,
    settings
  ) {
    line = line || {};

    var size = clamp(
      num(
        line.size !== undefined
          ? line.size
          : line.value,
        0
      ),
      0,
      1000
    );

    var bend = calculateBend(
      line,
      settings
    );

    var id =
      line.id ||
      (
        side === "length"
          ? "L"
          : "D"
      ) + (index + 1);

    return {
      id: id,

      side: side,

      index: index,

      sequence: index + 1,

      sizeInch: round(size, 6),

      sizeMM: round(
        inchToMM(size),
        4
      ),

      angle: bend.intendedAngleDeg,

      effectiveAngle:
        bend.effectiveAngleDeg,

      direction: bend.direction,

      bendAllowanceMM:
        bend.bendAllowanceMM,

      bendAllowanceInch:
        bend.bendAllowanceInch,

      setbackMM:
        bend.setbackMM,

      setbackInch:
        bend.setbackInch,

      bendDeductionMM:
        bend.bendDeductionMM,

      bendDeductionInch:
        bend.bendDeductionInch,

      neutralRadiusMM:
        bend.neutralRadiusMM,

      thicknessMM:
        bend.thicknessMM,

      radiusMM:
        bend.radiusMM,

      kfactor:
        bend.kfactor,

      original: clone(line)
    };
  }

  /* =======================================================
     POSITION CALCULATION
     ======================================================= */

  /*
    User-entered dimensions are treated as finished leg
    dimensions.

    For a chain of bends, the marking position is adjusted
    by local bend deduction.

    We do NOT blindly subtract BD from every line.
    Only the bend boundaries are shifted.
  */

  function buildSidePositions(lines) {
    var result = [];

    var running = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      var position =
        running + line.sizeInch;

      result.push({
        id: line.id,
        side: line.side,
        index: line.index,

        startInch:
          round(running, 6),

        endInch:
          round(position, 6),

        nominalSizeInch:
          line.sizeInch,

        bend: line
      });

      running = position;
    }

    return result;
  }

  function buildMarkingPositions(lines) {
    var result = [];

    var running = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      /*
        Bend line is placed at the end of the entered leg.
        The actual developed sheet relationship is kept
        separately through BA/BD so downstream modules
        can distinguish user size from developed geometry.
      */

      running += line.sizeInch;

      result.push({
        id: line.id,
        side: line.side,
        index: line.index,

        positionInch:
          round(running, 6),

        positionMM:
          round(inchToMM(running), 4),

        userSizeInch:
          line.sizeInch,

        BAInch:
          line.bendAllowanceInch,

        BDInch:
          line.bendDeductionInch
      });
    }

    return result;
  }

  /* =======================================================
     FLAT NETWORK
     ======================================================= */

  function buildFlatNetwork(
    lengthLines,
    depthLines
  ) {
    var lengthPositions =
      buildMarkingPositions(lengthLines);

    var depthPositions =
      buildMarkingPositions(depthLines);

    var totalLength =
      lengthLines.reduce(
        function (sum, l) {
          return sum + l.sizeInch;
        },
        0
      );

    var totalDepth =
      depthLines.reduce(
        function (sum, l) {
          return sum + l.sizeInch;
        },
        0
      );

    return {
      totalLengthInch:
        round(totalLength, 6),

      totalDepthInch:
        round(totalDepth, 6),

      totalLengthMM:
        round(inchToMM(totalLength), 4),

      totalDepthMM:
        round(inchToMM(totalDepth), 4),

      lengthPositions:
        lengthPositions,

      depthPositions:
        depthPositions
    };
  }

  /* =======================================================
     BEND AXIS / DIRECTION
     ======================================================= */

  function directionForBend(
    previous,
    side,
    bend
  ) {
    var angle =
      degToRad(bend.effectiveAngle);

    var sign =
      bend.direction === "down"
        ? -1
        : 1;

    if (!previous) {
      if (side === "length") {
        return {
          axis: vec(1, 0, 0),
          normal: vec(0, 0, 1)
        };
      }

      return {
        axis: vec(0, 1, 0),
        normal: vec(0, 0, 1)
      };
    }

    var axis =
      normalize(previous.axis);

    var normal =
      normalize(previous.normal);

    var rotationAxis =
      side === "length"
        ? vec(0, 1, 0)
        : vec(1, 0, 0);

    /*
      Rodrigues rotation.
    */

    function rotate(v, axisVector, radians) {
      var c = Math.cos(radians);
      var s = Math.sin(radians);

      var term1 =
        mul(v, c);

      var term2 =
        mul(
          cross(axisVector, v),
          s
        );

      var term3 =
        mul(
          axisVector,
          dot(axisVector, v) * (1 - c)
        );

      return normalize(
        add(
          add(term1, term2),
          term3
        )
      );
    }

    var amount =
      angle * sign;

    var nextAxis =
      rotate(
        axis,
        normalize(rotationAxis),
        amount
      );

    var nextNormal =
      rotate(
        normal,
        normalize(rotationAxis),
        amount
      );

    return {
      axis: nextAxis,
      normal: nextNormal
    };
  }

  /* =======================================================
     3D NETWORK
     ======================================================= */

  function build3DNetwork(
    lengthLines,
    depthLines
  ) {
    var all = [];

    for (var i = 0; i < lengthLines.length; i++) {
      all.push({
        side: "length",
        index: i,
        line: lengthLines[i]
      });
    }

    for (var j = 0; j < depthLines.length; j++) {
      all.push({
        side: "depth",
        index: j,
        line: depthLines[j]
      });
    }

    /*
      Preserve user input ordering inside each side.
      Sequence number is generated explicitly below.
    */

    var current = {
      position: vec(0, 0, 0),
      axis: vec(1, 0, 0),
      normal: vec(0, 0, 1)
    };

    var records = [];

    for (var k = 0; k < all.length; k++) {
      var item = all[k];
      var line = item.line;

      var lengthInch =
        line.sizeInch;

      var direction =
        directionForBend(
          current,
          item.side,
          line
        );

      var travel =
        mul(
          direction.axis,
          lengthInch
        );

      var end =
        add(
          current.position,
          travel
        );

      records.push({
        id: line.id,

        side: item.side,

        index: item.index,

        sequence: k + 1,

        start: clone(current.position),

        end: clone(end),

        axis: clone(direction.axis),

        normal: clone(direction.normal),

        angle:
          line.angle,

        effectiveAngle:
          line.effectiveAngle,

        direction:
          line.direction,

        sizeInch:
          line.sizeInch,

        sizeMM:
          line.sizeMM,

        bendAllowanceInch:
          line.bendAllowanceInch,

        bendDeductionInch:
          line.bendDeductionInch
      });

      current = {
        position: end,
        axis: direction.axis,
        normal: direction.normal
      };
    }

    return {
      records: records,
      finalPosition:
        clone(current.position)
    };
  }

  /* =======================================================
     BEND ZONE
     ======================================================= */

  function bendZone(line, settings) {
    var radius =
      settings.radius +
      settings.thickness;

    var relief =
      Math.max(
        settings.relief,
        settings.thickness
      );

    /*
      Influence zone around the crossing.
    */

    var half =
      radius + relief;

    return {
      radiusMM:
        round(radius, 4),

      radiusInch:
        round(mmToInch(radius), 6),

      reliefMM:
        round(relief, 4),

      reliefInch:
        round(mmToInch(relief), 6),

      halfZoneMM:
        round(half, 4),

      halfZoneInch:
        round(mmToInch(half), 6)
    };
  }

  /* =======================================================
     DIRECTION / ANGLE ANALYSIS
     ======================================================= */

  function angleBetween(a, b) {
    var na = normalize(a);
    var nb = normalize(b);

    var la = length(na);
    var lb = length(nb);

    if (
      la < EPS ||
      lb < EPS
    ) {
      return 0;
    }

    var d =
      clamp(
        dot(na, nb),
        -1,
        1
      );

    return radToDeg(
      Math.acos(d)
    );
  }

  function movementStrength(a, b) {
    var na = normalize(a);
    var nb = normalize(b);

    return clamp(
      length(
        sub(na, nb)
      ) / 2,
      0,
      1
    );
  }

  /* =======================================================
     INTERACTION ENGINE
     ======================================================= */

  function calculateInteraction(
    lengthLine,
    depthLine,
    settings
  ) {
    var lZone =
      bendZone(
        lengthLine,
        settings
      );

    var dZone =
      bendZone(
        depthLine,
        settings
      );

    var angleDifference =
      Math.abs(
        lengthLine.effectiveAngle -
        depthLine.effectiveAngle
      );

    var directionDifference =
      lengthLine.direction ===
      depthLine.direction
        ? 0
        : 180;

    /*
      Combined bend demand.
      This is deliberately separated from the
      physical cut decision so the result can explain
      why a cut was or was not requested.
    */

    var totalAngle =
      Math.min(
        180,
        Math.abs(
          lengthLine.effectiveAngle +
          depthLine.effectiveAngle
        )
      );

    var localAngle =
      Math.max(
        angleDifference,
        Math.abs(
          lengthLine.effectiveAngle
          -
          depthLine.effectiveAngle
        )
      );

    var radiusInch =
      Math.max(
        lZone.halfZoneInch,
        dZone.halfZoneInch
      );

    /*
      Corner relief requirement.

      Strong interference cases:
      - both bends have real angle
      - crossing lies inside the bend influence zone
      - directions create material collision
    */

    var activeLength =
      lengthLine.effectiveAngle > 0;

    var activeDepth =
      depthLine.effectiveAngle > 0;

    var directionConflict =
      lengthLine.direction !==
      depthLine.direction;

    var highAngle =
      totalAngle >= 90;

    var meaningfulBend =
      activeLength &&
      activeDepth;

    var required =
      meaningfulBend &&
      (
        highAngle ||
        directionConflict
      );

    /*
      Cut dimensions.

      Base relief is never smaller than material
      thickness and user relief setting.
    */

    var baseReliefMM =
      Math.max(
        settings.relief,
        settings.thickness
      );

    var angleFactor =
      clamp(
        totalAngle / 90,
        0,
        2
      );

    var calculatedWidthMM =
      baseReliefMM +
      (
        settings.thickness *
        angleFactor
      );

    var calculatedDepthMM =
      Math.max(
        settings.relief,
        settings.thickness +
        (
          Math.min(
            settings.radius,
            settings.thickness * 2
          )
        )
      );

    /*
      Never create a negative or microscopic cut.
    */

    calculatedWidthMM =
      Math.max(
        calculatedWidthMM,
        settings.thickness
      );

    calculatedDepthMM =
      Math.max(
        calculatedDepthMM,
        settings.thickness
      );

    var orientation =
      highAngle
        ? "CROSS_RELIEF"
        : "LOCAL_RELIEF";

    var reason = "NO_INTERFERENCE";

    if (required) {
      if (directionConflict && highAngle) {
        reason =
          "OPPOSITE_DIRECTION_HIGH_ANGLE";
      } else if (directionConflict) {
        reason =
          "OPPOSITE_BEND_DIRECTION";
      } else if (highAngle) {
        reason =
          "HIGH_COMBINED_BEND_ANGLE";
      } else {
        reason =
          "BEND_INTERACTION";
      }
    }

    return {
      lengthId:
        lengthLine.id,

      depthId:
        depthLine.id,

      lengthAngle:
        lengthLine.effectiveAngle,

      depthAngle:
        depthLine.effectiveAngle,

      lengthDirection:
        lengthLine.direction,

      depthDirection:
        depthLine.direction,

      angleDifference:
        round(angleDifference, 3),

      directionDifference:
        directionDifference,

      totalAngle:
        round(totalAngle, 3),

      localAngle:
        round(localAngle, 3),

      movementStrength:
        round(
          Math.max(
            movementStrength(
              {
                x: lengthLine.effectiveAngle,
                y: lengthLine.direction === "up" ? 1 : -1,
                z: 0
              },
              {
                x: depthLine.effectiveAngle,
                y: depthLine.direction === "up" ? 1 : -1,
                z: 0
              }
            ),
            0
          ),
          4
        ),

      required:
        required,

      orientation:
        orientation,

      reason:
        reason,

      cutWidthMM:
        required
          ? round(calculatedWidthMM, 3)
          : 0,

      cutDepthMM:
        required
          ? round(calculatedDepthMM, 3)
          : 0,

      cutWidthInch:
        required
          ? round(
              mmToInch(calculatedWidthMM),
              5
            )
          : 0,

      cutDepthInch:
        required
          ? round(
              mmToInch(calculatedDepthMM),
              5
            )
          : 0,

      influenceRadiusInch:
        round(radiusInch, 5)
    };
  }

  /* =======================================================
     NOTCH / CUP CUT
     ======================================================= */

  function makeNotch(
    interaction,
    lengthPosition,
    depthPosition
  ) {
    return {
      id:
        "CUT_" +
        interaction.lengthId +
        "_" +
        interaction.depthId,

      lengthId:
        interaction.lengthId,

      depthId:
        interaction.depthId,

      required:
        interaction.required,

      type:
        "CUP_CUT",

      orientation:
        interaction.orientation,

      reason:
        interaction.reason,

      xInch:
        round(
          lengthPosition,
          6
        ),

      yInch:
        round(
          depthPosition,
          6
        ),

      widthMM:
        interaction.cutWidthMM,

      depthMM:
        interaction.cutDepthMM,

      widthInch:
        interaction.cutWidthInch,

      depthInch:
        interaction.cutDepthInch,

      hidden:
        false
    };
  }

  /* =======================================================
     INTERSECTIONS
     ======================================================= */

  function buildIntersections(
    lengthLines,
    depthLines,
    flat,
    settings
  ) {
    var intersections = [];
    var cuts = [];

    for (
      var i = 0;
      i < lengthLines.length;
      i++
    ) {
      var L =
        lengthLines[i];

      var lPos =
        flat.lengthPositions[i]
          ? flat.lengthPositions[i].positionInch
          : 0;

      for (
        var j = 0;
        j < depthLines.length;
        j++
      ) {
        var D =
          depthLines[j];

        var dPos =
          flat.depthPositions[j]
            ? flat.depthPositions[j].positionInch
            : 0;

        var interaction =
          calculateInteraction(
            L,
            D,
            settings
          );

        var intersection = {
          id:
            "X_" +
            L.id +
            "_" +
            D.id,

          lengthId:
            L.id,

          depthId:
            D.id,

          xInch:
            round(lPos, 6),

          yInch:
            round(dPos, 6),

          xMM:
            round(inchToMM(lPos), 4),

          yMM:
            round(inchToMM(dPos), 4),

          interaction:
            interaction,

          cutRequired:
            interaction.required
        };

        if (interaction.required) {
          var cut =
            makeNotch(
              interaction,
              lPos,
              dPos
            );

          intersection.cut =
            cut;

          cuts.push(cut);
        } else {
          intersection.cut = null;
        }

        intersections.push(
          intersection
        );
      }
    }

    return {
      intersections:
        intersections,

      cuts:
        cuts
    };
  }

  /* =======================================================
     SHEET OUTLINE
     ======================================================= */

  function buildSheetOutline(flat) {
    return {
      widthInch:
        flat.totalLengthInch,

      heightInch:
        flat.totalDepthInch,

      widthMM:
        flat.totalLengthMM,

      heightMM:
        flat.totalDepthMM,

      points: [
        {
          x: 0,
          y: 0
        },
        {
          x: flat.totalLengthInch,
          y: 0
        },
        {
          x: flat.totalLengthInch,
          y: flat.totalDepthInch
        },
        {
          x: 0,
          y: flat.totalDepthInch
        }
      ]
    };
  }

  /* =======================================================
     CUT SUMMARY
     ======================================================= */

  function buildCutSummary(
    cuts
  ) {
    var required =
      cuts.filter(
        function (c) {
          return c.required;
        }
      );

    return {
      total:
        cuts.length,

      required:
        required.length,

      none:
        cuts.length -
        required.length,

      items:
        cuts.map(
          function (c) {
            return {
              id: c.id,
              lengthId: c.lengthId,
              depthId: c.depthId,
              widthInch: c.widthInch,
              depthInch: c.depthInch,
              widthMM: c.widthMM,
              depthMM: c.depthMM,
              orientation: c.orientation,
              reason: c.reason
            };
          }
        )
    };
  }

  /* =======================================================
     BEND SEQUENCE
     ======================================================= */

  function buildSequence(
    lengthLines,
    depthLines
  ) {
    var sequence = [];

    /*
      Existing app behaviour is preserved:
      Length bends first, then Depth bends.
      Each record carries complete engineering data.
    */

    for (
      var i = 0;
      i < lengthLines.length;
      i++
    ) {
      sequence.push({
        step:
          sequence.length + 1,

        id:
          lengthLines[i].id,

        side:
          "length",

        angle:
          lengthLines[i].angle,

        effectiveAngle:
          lengthLines[i].effectiveAngle,

        direction:
          lengthLines[i].direction,

        sizeInch:
          lengthLines[i].sizeInch,

        BAInch:
          lengthLines[i].bendAllowanceInch,

        BDInch:
          lengthLines[i].bendDeductionInch
      });
    }

    for (
      var j = 0;
      j < depthLines.length;
      j++
    ) {
      sequence.push({
        step:
          sequence.length + 1,

        id:
          depthLines[j].id,

        side:
          "depth",

        angle:
          depthLines[j].angle,

        effectiveAngle:
          depthLines[j].effectiveAngle,

        direction:
          depthLines[j].direction,

        sizeInch:
          depthLines[j].sizeInch,

        BAInch:
          depthLines[j].bendAllowanceInch,

        BDInch:
          depthLines[j].bendDeductionInch
      });
    }

    return sequence;
  }

  /* =======================================================
     MASTER ANALYSIS
     ======================================================= */

  function analyze(state) {
    state = state || {};

    var settings =
      getSettings();

    var lengthInput =
      Array.isArray(state.lenLines)
        ? state.lenLines
        : [];

    var depthInput =
      Array.isArray(state.depLines)
        ? state.depLines
        : [];

    var lengthLines =
      lengthInput.map(
        function (line, index) {
          return createLineData(
            line,
            "length",
            index,
            settings
          );
        }
      );

    var depthLines =
      depthInput.map(
        function (line, index) {
          return createLineData(
            line,
            "depth",
            index,
            settings
          );
        }
      );

    var flat =
      buildFlatNetwork(
        lengthLines,
        depthLines
      );

    var intersections =
      buildIntersections(
        lengthLines,
        depthLines,
        flat,
        settings
      );

    var threeD =
      build3DNetwork(
        lengthLines,
        depthLines
      );

    var sheet =
      buildSheetOutline(flat);

    var sequence =
      buildSequence(
        lengthLines,
        depthLines
      );

    var cutSummary =
      buildCutSummary(
        intersections.cuts
      );

    var totalBends =
      lengthLines.length +
      depthLines.length;

    return {
      version:
        "GEOMETRY_ENGINE_V4",

      settings:
        clone(settings),

      input: {
        lengthLines:
          clone(lengthInput),

        depthLines:
          clone(depthInput)
      },

      lengthLines:
        lengthLines,

      depthLines:
        depthLines,

      totals: {
        length:
          flat.totalLengthInch,

        depth:
          flat.totalDepthInch,

        lengthMM:
          flat.totalLengthMM,

        depthMM:
          flat.totalDepthMM,

        lengthLines:
          lengthLines.length,

        depthLines:
          depthLines.length,

        totalBends:
          totalBends,

        corners:
          intersections.intersections.length,

        cupCuts:
          cutSummary.required
      },

      flat:
        flat,

      sheet:
        sheet,

      intersections:
        intersections.intersections,

      cuts:
        intersections.cuts,

      cutSummary:
        cutSummary,

      threeD:
        threeD,

      sequence:
        sequence
    };
  }

  /* =======================================================
     SINGLE LINE CALCULATION
     ======================================================= */

  function calculateLine(
    line
  ) {
    return createLineData(
      line,
      line && line.side === "depth"
        ? "depth"
        : "length",
      num(line && line.index, 0),
      getSettings()
    );
  }

  /* =======================================================
     DEBUG
     ======================================================= */

  function debug(state) {
    try {
      var result =
        analyze(state);

      console.log(
        "[GeometryEngine V4]",
        result
      );

      return result;
    } catch (err) {
      console.error(
        "[GeometryEngine]",
        err
      );

      if (
        window.Bugs &&
        typeof window.Bugs.capture === "function"
      ) {
        window.Bugs.capture(
          err,
          "GeometryEngine"
        );
      }

      throw err;
    }
  }

  /* =======================================================
     PUBLIC API
     ======================================================= */

  window.GeometryEngine = {

    version:
      "GEOMETRY_ENGINE_V4",

    analyze:
      analyze,

    debug:
      debug,

    calculateLine:
      calculateLine,

    normalizeAngle:
      normalizeAngle,

    normalizeBend:
      normalizeBend,

    effectiveAngle:
      effectiveAngle,

    bendAllowance:
      bendAllowance,

    bendDeduction:
      bendDeduction,

    calculateBend:
      calculateBend,

    bendZone:
      bendZone,

    calculateInteraction:
      calculateInteraction,

    buildFlatNetwork:
      buildFlatNetwork,

    build3DNetwork:
      build3DNetwork,

    buildIntersections:
      buildIntersections,

    buildSequence:
      buildSequence,

    buildSheetOutline:
      buildSheetOutline,

    buildCutSummary:
      buildCutSummary,

    inchToMM:
      inchToMM,

    mmToInch:
      mmToInch
  };

  console.log(
    "✅ Geometry Engine V4 loaded"
  );

})();
