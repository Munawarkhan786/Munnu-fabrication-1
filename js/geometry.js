/* =========================================================
   GEOMETRY.JS
   GEOMETRY ENGINE V5 — MASTER SHEET ENGINE
   ---------------------------------------------------------
   FLOW:

   USER INPUT
      ↓
   NORMALIZE
      ↓
   SETTINGS
      ↓
   BEND CALCULATION
      ↓
   DEVELOPED / MARKING POSITIONS
      ↓
   LENGTH × DEPTH INTERSECTIONS
      ↓
   PHYSICAL INTERFERENCE CHECK
      ↓
   CUP-CUT / NOTCH DECISION
      ↓
   MASTER GEOMETRY
      ↓
   FLAT / RESULT / 3D

   IMPORTANT:
   This file is the calculation brain.
   Flat / Result / 3D should NOT recalculate engineering.
   ========================================================= */

(function () {

  "use strict";

  /* =========================================================
     BASIC HELPERS
     ========================================================= */

  function num(v, fallback) {
    var n = parseFloat(v);
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

  function inchToMM(inch) {
    return inch * 25.4;
  }

  function mmToInch(mm) {
    return mm / 25.4;
  }

  function cleanZero(v) {
    return Math.abs(v) < 0.000001 ? 0 : v;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function safeId(v, fallback) {
    return v != null && String(v).trim()
      ? String(v)
      : fallback;
  }


  /* =========================================================
     VECTOR HELPERS
     ========================================================= */

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

  function mul(a, s) {
    return vec(
      a.x * s,
      a.y * s,
      a.z * s
    );
  }

  function length3(a) {
    return Math.sqrt(
      a.x * a.x +
      a.y * a.y +
      a.z * a.z
    );
  }

  function normalize(a) {
    var l = length3(a);

    if (!l) {
      return vec(0, 0, 0);
    }

    return vec(
      a.x / l,
      a.y / l,
      a.z / l
    );
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

  function distance3(a, b) {
    return length3(sub(a, b));
  }


  /* =========================================================
     SETTINGS
     ---------------------------------------------------------
     IMPORTANT:
     Core uses window.settings.
     Older versions sometimes used AppState.settings.
     We support both, but window.settings is preferred.
     ========================================================= */

  function getSettings() {

    var source = null;

    if (window.settings) {
      source = window.settings;
    }

    if (
      !source &&
      window.AppState &&
      window.AppState.settings
    ) {
      source = window.AppState.settings;
    }

    if (
      !source &&
      window.state &&
      window.state.settings
    ) {
      source = window.state.settings;
    }

    source = source || {};

    var material =
      source.material === "SS202"
        ? "SS202"
        : "SS304";

    var thickness = clamp(
      num(source.thickness, 0.8),
      0.1,
      10
    );

    var radius = clamp(
      num(source.radius, 0.8),
      0,
      20
    );

    var kfactor = clamp(
      num(source.kfactor, material === "SS202" ? 0.45 : 0.44),
      0,
      1
    );

    var springback = clamp(
      num(source.springback, 0.5),
      0,
      20
    );

    var relief = clamp(
      num(source.relief, 1.6),
      0,
      50
    );

    var vdie = clamp(
      num(
        source.vdie != null
          ? source.vdie
          : source.vDie,
        6
      ),
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


  /* =========================================================
     INPUT NORMALIZATION
     ========================================================= */

  function normalizeAngle(line) {

    var a = num(
      line && (
        line.angle != null
          ? line.angle
          : line.bendAngle
      ),
      90
    );

    return clamp(a, 0, 180);
  }


  function normalizeDirection(line) {

    var v = line && (
      line.direction != null
        ? line.direction
        : line.bend
    );

    if (
      v === "down" ||
      v === "DOWN" ||
      v === "Down" ||
      v === "d" ||
      v === -1 ||
      v === false
    ) {
      return "down";
    }

    return "up";
  }


  function normalizeLine(line, side, index) {

    line = line || {};

    var size = num(
      line.size != null
        ? line.size
        : line.sizeInch,
      0
    );

    size = Math.max(0, round16(size));

    return {
      id: safeId(
        line.id,
        (side === "length" ? "L" : "D") + (index + 1)
      ),

      side: side,

      index: index,

      sizeInch: size,

      sizeMM: inchToMM(size),

      angle: normalizeAngle(line),

      direction: normalizeDirection(line),

      original: clone(line)
    };
  }


  function normalizeLines(lines, side) {

    lines = Array.isArray(lines)
      ? lines
      : [];

    return lines.map(function (line, index) {
      return normalizeLine(line, side, index);
    });
  }


  /* =========================================================
     BEND ENGINE
     ========================================================= */

  /*
     Neutral radius:

       RN = R + K × T

     Bend Allowance:

       BA = θ(rad) × RN

     Setback:

       SB = (R + T) × tan(θ / 2)

     Bend Deduction:

       BD = 2 × SB - BA

     NOTE:
     V-die is used as an engineering parameter and
     contributes to a practical inside-radius estimate.

     We DO NOT blindly replace user's radius because
     radius may be intentionally supplied by the fabricator.
  */

  function estimateRadiusFromVDie(settings) {

    var t = settings.thickness;
    var v = settings.vdie;

    /*
       Practical air-bend approximation.

       This is intentionally conservative.
       User radius remains master when supplied.
    */

    var estimated = v * 0.16;

    if (estimated < t) {
      estimated = t;
    }

    return estimated;
  }


  function getEffectiveRadius(settings) {

    var userRadius = num(
      settings.radius,
      0
    );

    var vDieRadius = estimateRadiusFromVDie(settings);

    /*
       User radius is respected.
       If radius is zero, V-die estimate is used.
    */

    if (userRadius > 0) {
      return userRadius;
    }

    return vDieRadius;
  }


  function bendAllowance(
    angleDeg,
    radius,
    thickness,
    kfactor
  ) {

    var theta = degToRad(
      clamp(angleDeg, 0, 180)
    );

    var neutralRadius =
      radius +
      (kfactor * thickness);

    return theta * neutralRadius;
  }


  function bendDeduction(
    angleDeg,
    radius,
    thickness,
    kfactor
  ) {

    var theta = degToRad(
      clamp(angleDeg, 0, 180)
    );

    var ba = bendAllowance(
      angleDeg,
      radius,
      thickness,
      kfactor
    );

    var setback =
      (radius + thickness) *
      Math.tan(theta / 2);

    return (
      2 * setback
    ) - ba;
  }


  function calculateBend(angle, direction, settings) {

    var intended = clamp(
      num(angle, 0),
      0,
      180
    );

    var effective = clamp(
      intended - settings.springback,
      0,
      180
    );

    var radius =
      getEffectiveRadius(settings);

    var thickness =
      settings.thickness;

    var kfactor =
      settings.kfactor;

    var neutralRadius =
      radius +
      (kfactor * thickness);

    var ba =
      bendAllowance(
        effective,
        radius,
        thickness,
        kfactor
      );

    var bd =
      bendDeduction(
        effective,
        radius,
        thickness,
        kfactor
      );

    var setback =
      (radius + thickness) *
      Math.tan(
        degToRad(effective) / 2
      );

    return {

      intendedAngle: round(
        intended,
        4
      ),

      effectiveAngle: round(
        effective,
        4
      ),

      direction: direction,

      thicknessMM: round(
        thickness,
        4
      ),

      radiusMM: round(
        radius,
        4
      ),

      neutralRadiusMM: round(
        neutralRadius,
        4
      ),

      kfactor: round(
        kfactor,
        4
      ),

      vDieMM: round(
        settings.vdie,
        4
      ),

      bendAllowanceMM: round(
        ba,
        4
      ),

      bendAllowanceInch: round(
        mmToInch(ba),
        6
      ),

      setbackMM: round(
        setback,
        4
      ),

      setbackInch: round(
        mmToInch(setback),
        6
      ),

      bendDeductionMM: round(
        bd,
        4
      ),

      bendDeductionInch: round(
        mmToInch(bd),
        6
      )
    };
  }


  /* =========================================================
     LINE DATA
     ========================================================= */

  function createLineData(
    line,
    side,
    index,
    sequence,
    settings
  ) {

    var bend =
      calculateBend(
        line.angle,
        line.direction,
        settings
      );

    return {

      id: line.id,

      side: side,

      index: index,

      sequence: sequence,

      sizeInch: round16(
        line.sizeInch
      ),

      sizeMM: round(
        line.sizeMM,
        4
      ),

      angle: bend.intendedAngle,

      effectiveAngle:
        bend.effectiveAngle,

      direction:
        bend.direction,

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

      vDieMM:
        bend.vDieMM,

      original:
        clone(line.original)
    };
  }


  /* =========================================================
     DEVELOPED POSITION ENGINE
     ========================================================= */

  /*
     IMPORTANT:

     User sizes represent actual panel/segment input.

     We keep raw segment boundaries AND calculated
     bend information separately.

     This allows Flat / Result / 3D to know:

       raw start
       raw end
       bend center
       BA
       BD
       setback

     without losing the original user measurement.
  */

  function buildSidePositions(lines) {

    var running = 0;

    var result = [];

    lines.forEach(function (line) {

      var start = running;

      var end =
        running +
        line.sizeInch;

      var ba =
        line.bendAllowanceInch;

      var bd =
        line.bendDeductionInch;

      var setback =
        line.setbackInch;

      /*
         Bend center is kept at the physical
         boundary between two panels.

         For now the master stores all three references:
           rawBoundary
           developedBoundary
           bendCenter

         This prevents downstream modules from
         guessing.
      */

      var rawBoundary =
        end;

      var developedBoundary =
        rawBoundary;

      result.push({

        id: line.id,

        side: line.side,

        index: line.index,

        sequence: line.sequence,

        sizeInch:
          line.sizeInch,

        sizeMM:
          line.sizeMM,

        startInch:
          round(start, 6),

        endInch:
          round(end, 6),

        rawBoundaryInch:
          round(rawBoundary, 6),

        developedBoundaryInch:
          round(developedBoundary, 6),

        bendCenterInch:
          round(developedBoundary, 6),

        bendAllowanceInch:
          round(ba, 6),

        bendDeductionInch:
          round(bd, 6),

        setbackInch:
          round(setback, 6),

        angle:
          line.angle,

        effectiveAngle:
          line.effectiveAngle,

        direction:
          line.direction,

        isBend:
          line.effectiveAngle > 0
      });

      running = end;
    });

    return {
      totalInch: round(running, 6),
      totalMM: round(inchToMM(running), 4),
      lines: result
    };
  }


  /* =========================================================
     FLAT NETWORK
     ========================================================= */

  function buildFlatNetwork(
    lengthLines,
    depthLines
  ) {

    var length =
      buildSidePositions(
        lengthLines
      );

    var depth =
      buildSidePositions(
        depthLines
      );

    return {

      lengthInch:
        length.totalInch,

      depthInch:
        depth.totalInch,

      lengthMM:
        length.totalMM,

      depthMM:
        depth.totalMM,

      lengthLines:
        length.lines,

      depthLines:
        depth.lines,

      totalLength:
        length.totalInch,

      totalDepth:
        depth.totalInch
    };
  }


  /* =========================================================
     BEND AXIS / 3D DIRECTION
     ========================================================= */

  function rotateAroundAxis(
    vector,
    axis,
    angleRad
  ) {

    axis = normalize(axis);

    var c =
      Math.cos(angleRad);

    var s =
      Math.sin(angleRad);

    var term1 =
      mul(vector, c);

    var term2 =
      mul(
        cross(axis, vector),
        s
      );

    var term3 =
      mul(
        axis,
        dot(axis, vector) *
        (1 - c)
      );

    return add(
      add(term1, term2),
      term3
    );
  }


  function directionForBend(
    previous,
    side,
    bend
  ) {

    var baseAxis;
    var normal;

    if (side === "length") {

      baseAxis =
        previous
          ? previous.axis
          : vec(1, 0, 0);

      normal =
        previous
          ? previous.normal
          : vec(0, 0, 1);

    } else {

      baseAxis =
        previous
          ? previous.axis
          : vec(0, 1, 0);

      normal =
        previous
          ? previous.normal
          : vec(0, 0, 1);
    }

    var angle =
      degToRad(
        bend.effectiveAngle
      );

    if (
      bend.direction === "down"
    ) {
      angle = -angle;
    }

    var rotatedNormal =
      rotateAroundAxis(
        normal,
        baseAxis,
        angle
      );

    return {

      axis:
        normalize(baseAxis),

      normal:
        normalize(rotatedNormal)
    };
  }


  /* =========================================================
     3D MASTER NETWORK
     ---------------------------------------------------------
     This is the geometric skeleton consumed by 3D.

     It deliberately does NOT create Three.js meshes.
     ========================================================= */

  function build3DNetwork(
    lengthLines,
    depthLines
  ) {

    var records = [];

    var previous = null;

    var sequence = 1;

    function addSide(lines, side) {

      lines.forEach(function (line) {

        var bend =
          calculateBend(
            line.angle,
            line.direction,
            getSettings()
          );

        var orientation =
          directionForBend(
            previous,
            side,
            bend
          );

        var size =
          line.sizeInch;

        var start =
          previous
            ? clone(previous.end)
            : vec(0, 0, 0);

        var axis =
          orientation.axis;

        var end =
          add(
            start,
            mul(
              axis,
              inchToMM(size)
            )
          );

        var record = {

          id: line.id,

          side: side,

          index: line.index,

          sequence: sequence++,

          start: start,

          end: end,

          axis: axis,

          normal:
            orientation.normal,

          sizeInch:
            size,

          sizeMM:
            line.sizeMM,

          angle:
            line.angle,

          effectiveAngle:
            line.effectiveAngle,

          direction:
            line.direction,

          radiusMM:
            bend.radiusMM,

          thicknessMM:
            bend.thicknessMM,

          bendAllowanceMM:
            bend.bendAllowanceMM,

          bendDeductionMM:
            bend.bendDeductionMM,

          setbackMM:
            bend.setbackMM
        };

        records.push(record);

        previous = record;
      });
    }

    addSide(
      lengthLines,
      "length"
    );

    addSide(
      depthLines,
      "depth"
    );

    return {

      version:
        "MASTER_NETWORK_V5",

      records:
        records,

      totalRecords:
        records.length
    };
  }


  /* =========================================================
     CORNER / BEND ZONE
     ========================================================= */

  function calculateBendZone(
    line,
    settings
  ) {

    var radius =
      getEffectiveRadius(settings);

    var thickness =
      settings.thickness;

    var relief =
      settings.relief;

    var angle =
      clamp(
        line.effectiveAngle,
        0,
        180
      );

    var angleFactor =
      Math.sin(
        degToRad(angle / 2)
      );

    var width =
      (
        radius +
        thickness
      ) *
      2 *
      angleFactor;

    width =
      Math.max(
        width,
        relief
      );

    return {

      widthMM:
        round(width, 4),

      depthMM:
        round(
          Math.max(
            relief,
            thickness
          ),
          4
        ),

      radiusMM:
        round(radius, 4),

      thicknessMM:
        round(thickness, 4),

      reliefMM:
        round(relief, 4),

      angle:
        angle
    };
  }


  /* =========================================================
     PHYSICAL INTERFERENCE CHECK
     ========================================================= */

  /*
     This function is intentionally explicit.

     A corner does NOT automatically receive a cut.

     Cut is considered when:

       1. both lines are actual bends
       2. the bend zones overlap
       3. their direction/angle combination creates
          a material interference risk

     This is much safer than:
       "every Length × Depth crossing = cut"
  */

  function calculateInteraction(
    lengthLine,
    depthLine,
    settings
  ) {

    var lAngle =
      clamp(
        lengthLine.effectiveAngle,
        0,
        180
      );

    var dAngle =
      clamp(
        depthLine.effectiveAngle,
        0,
        180
      );

    var lActive =
      lAngle > 0.01;

    var dActive =
      dAngle > 0.01;

    if (!lActive || !dActive) {

      return {

        required: false,

        reason:
          "NO_TWO_WAY_BEND",

        angleDifference:
          Math.abs(lAngle - dAngle),

        totalAngle:
          lAngle + dAngle,

        directionConflict:
          false,

        highAngle:
          false,

        overlap:
          false,

        cutWidthMM:
          0,

        cutDepthMM:
          0
      };
    }

    var lZone =
      calculateBendZone(
        lengthLine,
        settings
      );

    var dZone =
      calculateBendZone(
        depthLine,
        settings
      );

    var angleDifference =
      Math.abs(
        lAngle - dAngle
      );

    var totalAngle =
      lAngle + dAngle;

    var directionConflict =
      lengthLine.direction !==
      depthLine.direction;

    var highAngle =
      totalAngle >= 90;

    /*
       At a crossing, each bend zone extends
       around the bend axis.

       The zones overlap when both are meaningful
       relative to sheet thickness / relief.
    */

    var overlapDistance =
      Math.min(
        lZone.widthMM,
        dZone.widthMM
      );

    var overlap =
      overlapDistance > 0;

    /*
       Strong interference:
       - opposite directions, OR
       - combined bend is very large
       - AND both are actual bends
    */

    var interference =
      overlap &&
      (
        directionConflict ||
        highAngle
      );

    var reason;

    if (!interference) {

      if (!overlap) {
        reason =
          "NO_ZONE_OVERLAP";
      } else {
        reason =
          "NO_MATERIAL_INTERFERENCE";
      }

    } else {

      if (
        directionConflict &&
        highAngle
      ) {
        reason =
          "OPPOSITE_DIRECTION_HIGH_ANGLE";
      } else if (
        directionConflict
      ) {
        reason =
          "OPPOSITE_DIRECTION";
      } else if (
        highAngle
      ) {
        reason =
          "HIGH_COMBINED_ANGLE";
      } else {
        reason =
          "INTERFERENCE";
      }
    }

    var cutWidth =
      interference
        ? Math.max(
            lZone.widthMM,
            dZone.widthMM
          )
        : 0;

    var cutDepth =
      interference
        ? Math.max(
            settings.relief,
            settings.thickness
          )
        : 0;

    return {

      required:
        interference,

      reason:
        reason,

      angleDifference:
        round(
          angleDifference,
          4
        ),

      totalAngle:
        round(
          totalAngle,
          4
        ),

      directionConflict:
        directionConflict,

      highAngle:
        highAngle,

      overlap:
        overlap,

      overlapDistanceMM:
        round(
          overlapDistance,
          4
        ),

      lengthZone:
        lZone,

      depthZone:
        dZone,

      cutWidthMM:
        round(
          cutWidth,
          4
        ),

      cutDepthMM:
        round(
          cutDepth,
          4
        )
    };
  }


  /* =========================================================
     INTERSECTION BUILDER
     ========================================================= */

  function buildIntersections(
    lengthLines,
    depthLines,
    settings
  ) {

    var intersections = [];
    var cuts = [];

    lengthLines.forEach(function (l) {

      depthLines.forEach(function (d) {

        var interaction =
          calculateInteraction(
            l,
            d,
            settings
          );

        var x =
          l.bendCenterInch;

        var y =
          d.bendCenterInch;

        var intersection = {

          id:
            "INT_" +
            l.id +
            "_" +
            d.id,

          lengthId:
            l.id,

          depthId:
            d.id,

          xInch:
            round(x, 6),

          yInch:
            round(y, 6),

          xMM:
            round(
              inchToMM(x),
              4
            ),

          yMM:
            round(
              inchToMM(y),
              4
            ),

          lengthAngle:
            l.effectiveAngle,

          depthAngle:
            d.effectiveAngle,

          lengthDirection:
            l.direction,

          depthDirection:
            d.direction,

          interaction:
            interaction
        };

        intersections.push(
          intersection
        );

        if (
          interaction.required
        ) {

          cuts.push(
            makeNotch(
              l,
              d,
              intersection,
              interaction
            )
          );
        }
      });
    });

    return {
      intersections:
        intersections,

      cuts:
        cuts
    };
  }


  /* =========================================================
     CUP CUT / NOTCH MASTER DATA
     ========================================================= */

  function makeNotch(
    lengthLine,
    depthLine,
    intersection,
    interaction
  ) {

    var widthMM =
      Math.max(
        interaction.cutWidthMM,
        0
      );

    var depthMM =
      Math.max(
        interaction.cutDepthMM,
        0
      );

    return {

      id:
        "CUT_" +
        lengthLine.id +
        "_" +
        depthLine.id,

      lengthId:
        lengthLine.id,

      depthId:
        depthLine.id,

      required:
        true,

      type:
        "CUP_CUT",

      orientation:
        "CORNER",

      reason:
        interaction.reason,

      xInch:
        intersection.xInch,

      yInch:
        intersection.yInch,

      xMM:
        intersection.xMM,

      yMM:
        intersection.yMM,

      widthMM:
        round(
          widthMM,
          4
        ),

      depthMM:
        round(
          depthMM,
          4
        ),

      widthInch:
        round(
          mmToInch(widthMM),
          6
        ),

      depthInch:
        round(
          mmToInch(depthMM),
          6
        ),

      /*
         These fields tell Flat / 3D
         that the cut replaces the bend
         line in its affected region.
      */

      replacesBendLine:
        true,

      hidden:
        false,

      physical:
        true
    };
  }


  /* =========================================================
     SHEET OUTLINE
     ========================================================= */

  function buildSheetOutline(
    flat
  ) {

    var w =
      flat.lengthInch;

    var h =
      flat.depthInch;

    return {

      type:
        "RECTANGULAR_DEVELOPED_SHEET",

      widthInch:
        w,

      heightInch:
        h,

      widthMM:
        flat.lengthMM,

      heightMM:
        flat.depthMM,

      points: [

        {
          xInch: 0,
          yInch: 0
        },

        {
          xInch: w,
          yInch: 0
        },

        {
          xInch: w,
          yInch: h
        },

        {
          xInch: 0,
          yInch: h
        }
      ]
    };
  }


  /* =========================================================
     CUT SUMMARY
     ========================================================= */

  function buildCutSummary(cuts) {

    var total =
      Array.isArray(cuts)
        ? cuts.length
        : 0;

    return {

      totalCuts:
        total,

      cupCuts:
        total,

      physicalCuts:
        cuts.filter(function (c) {
          return c.physical;
        }).length,

      hiddenCuts:
        cuts.filter(function (c) {
          return c.hidden;
        }).length,

      cuts:
        clone(cuts)
    };
  }


  /* =========================================================
     BEND SEQUENCE
     ========================================================= */

  function buildSequence(
    lengthLines,
    depthLines
  ) {

    var sequence = [];
    var n = 1;

    lengthLines.forEach(function (line) {

      sequence.push({

        step:
          n++,

        id:
          line.id,

        side:
          "length",

        angle:
          line.angle,

        effectiveAngle:
          line.effectiveAngle,

        direction:
          line.direction,

        sizeInch:
          line.sizeInch,

        bendAllowanceInch:
          line.bendAllowanceInch,

        bendDeductionInch:
          line.bendDeductionInch
      });
    });

    depthLines.forEach(function (line) {

      sequence.push({

        step:
          n++,

        id:
          line.id,

        side:
          "depth",

        angle:
          line.angle,

        effectiveAngle:
          line.effectiveAngle,

        direction:
          line.direction,

        sizeInch:
          line.sizeInch,

        bendAllowanceInch:
          line.bendAllowanceInch,

        bendDeductionInch:
          line.bendDeductionInch
      });
    });

    return sequence;
  }


  /* =========================================================
     MASTER ANALYZE
     ========================================================= */

  function analyze(inputState) {

    var state =
      inputState ||
      window.AppState ||
      window.state ||
      {};

    var settings =
      getSettings();

    var rawLength =
      Array.isArray(state.lenLines)
        ? state.lenLines
        : [];

    var rawDepth =
      Array.isArray(state.depLines)
        ? state.depLines
        : [];

    var lengthInput =
      normalizeLines(
        rawLength,
        "length"
      );

    var depthInput =
      normalizeLines(
        rawDepth,
        "depth"
      );

    var lengthLines =
      lengthInput.map(
        function (line, index) {

          return createLineData(
            line,
            "length",
            index,
            index + 1,
            settings
          );
        }
      );

    var depthStart =
      lengthLines.length + 1;

    var depthLines =
      depthInput.map(
        function (line, index) {

          return createLineData(
            line,
            "depth",
            index,
            depthStart + index,
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
        flat.lengthLines,
        flat.depthLines,
        settings
      );

    var threeD =
      build3DNetwork(
        lengthLines,
        depthLines
      );

    var sheet =
      buildSheetOutline(
        flat
      );

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
      lengthLines.filter(function (l) {
        return l.effectiveAngle > 0;
      }).length
      +
      depthLines.filter(function (l) {
        return l.effectiveAngle > 0;
      }).length;

    var totalCorners =
      intersections.intersections.length;

    return {

      version:
        "GEOMETRY_ENGINE_V5",

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
          round(
            flat.lengthInch,
            6
          ),

        depth:
          round(
            flat.depthInch,
            6
          ),

        lengthMM:
          round(
            flat.lengthMM,
            4
          ),

        depthMM:
          round(
            flat.depthMM,
            4
          ),

        lengthLines:
          lengthLines.length,

        depthLines:
          depthLines.length,

        totalBends:
          totalBends,

        corners:
          totalCorners,

        cupCuts:
          cutSummary.totalCuts
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


  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.GeometryEngine = {

    version:
      "GEOMETRY_ENGINE_V5",

    analyze:
      analyze,

    getSettings:
      getSettings,

    normalizeLine:
      normalizeLine,

    normalizeLines:
      normalizeLines,

    calculateBend:
      calculateBend,

    calculateBendZone:
      calculateBendZone,

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
      mmToInch,

    formulas: {

      bendAllowance:
        bendAllowance,

      bendDeduction:
        bendDeduction,

      estimateRadiusFromVDie:
        estimateRadiusFromVDie,

      getEffectiveRadius:
        getEffectiveRadius
    },

    debug:
      function () {

        var result =
          analyze(
            window.AppState ||
            window.state ||
            {}
          );

        console.log(
          "========== GEOMETRY ENGINE V5 =========="
        );

        console.log(
          "SETTINGS:",
          result.settings
        );

        console.log(
          "LENGTH:",
          result.lengthLines
        );

        console.log(
          "DEPTH:",
          result.depthLines
        );

        console.log(
          "INTERSECTIONS:",
          result.intersections
        );

        console.log(
          "CUTS:",
          result.cuts
        );

        console.log(
          "3D:",
          result.threeD
        );

        console.log(
          "SEQUENCE:",
          result.sequence
        );

        console.log(
          "========================================="
        );

        return result;
      }
  };


  console.log(
    "GeometryEngine V5 loaded"
  );

})();
