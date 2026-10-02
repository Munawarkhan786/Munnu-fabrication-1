/* =========================================================
   GEOMETRY ENGINE
   Connected Bend / Direction / Sequence / Interference
   ========================================================= */

(function () {
  "use strict";

  /*
    IMPORTANT
    ---------------------------------------------------------
    This module does NOT replace user dimensions.

    It calculates:
      1. bend direction
      2. bend angle
      3. bend sequence
      4. sheet thickness
      5. bend radius
      6. connected material position
      7. material movement direction
      8. possible bend-path interference
      9. automatic relief/notch requirement

    Flat / 3D / Result should all read from this engine.
  */

  var EPS = 0.000001;

  /* ---------------------------------------------------------
     BASIC HELPERS
     --------------------------------------------------------- */

  function num(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function degToRad(deg) {
    return deg * Math.PI / 180;
  }

  function radToDeg(rad) {
    return rad * 180 / Math.PI;
  }

  function round(v, digits) {
    var p = Math.pow(10, digits || 6);
    return Math.round(v * p) / p;
  }

  function inchToMm(v) {
    return num(v) * 25.4;
  }

  function mmToInch(v) {
    return num(v) / 25.4;
  }

  function normalize(v) {
    var len = Math.sqrt(
      v.x * v.x +
      v.y * v.y +
      v.z * v.z
    );

    if (len < EPS) {
      return { x: 0, y: 0, z: 0 };
    }

    return {
      x: v.x / len,
      y: v.y / len,
      z: v.z / len
    };
  }

  function dot(a, b) {
    return (
      a.x * b.x +
      a.y * b.y +
      a.z * b.z
    );
  }

  function cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  function add(a, b) {
    return {
      x: a.x + b.x,
      y: a.y + b.y,
      z: a.z + b.z
    };
  }

  function sub(a, b) {
    return {
      x: a.x - b.x,
      y: a.y - b.y,
      z: a.z - b.z
    };
  }

  function mul(a, s) {
    return {
      x: a.x * s,
      y: a.y * s,
      z: a.z * s
    };
  }

  function distance(a, b) {
    var d = sub(a, b);
    return Math.sqrt(dot(d, d));
  }

  /* ---------------------------------------------------------
     LINEAR INTERPOLATION
     --------------------------------------------------------- */

  function lerp(a, b, t) {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t
    };
  }

  /* ---------------------------------------------------------
     ROTATION AROUND AXIS
     --------------------------------------------------------- */

  function rotateAroundAxis(point, origin, axis, angleRad) {
    var p = sub(point, origin);
    var u = normalize(axis);

    var cos = Math.cos(angleRad);
    var sin = Math.sin(angleRad);

    var term1 = mul(p, cos);
    var term2 = mul(cross(u, p), sin);
    var term3 = mul(
      u,
      dot(u, p) * (1 - cos)
    );

    return add(
      origin,
      add(
        add(term1, term2),
        term3
      )
    );
  }

  /* ---------------------------------------------------------
     LINE ROTATION
     --------------------------------------------------------- */

  function rotateDirection(direction, axis, angleRad) {
    return normalize(
      sub(
        rotateAroundAxis(
          direction,
          { x: 0, y: 0, z: 0 },
          axis,
          angleRad
        ),
        { x: 0, y: 0, z: 0 }
      )
    );
  }

  /* ---------------------------------------------------------
     SETTINGS
     --------------------------------------------------------- */

  function getSettings() {
    var s = window.settings || {};

    return {
      thicknessMm: num(s.thickness, 0.8),
      radiusMm: num(s.radius, 0.8),
      kFactor: num(s.kfactor, 0.44),
      springback: num(s.springback, 0.5)
    };
  }

  /* ---------------------------------------------------------
     BEND INFORMATION
     --------------------------------------------------------- */

  function getBendAngle(line) {
    var angle = num(
      line && line.angle,
      90
    );

    if (angle <= 0) {
      angle = 90;
    }

    return angle;
  }

  function getBendDirection(line) {
    return (
      line &&
      String(line.bend).toLowerCase() === "down"
    ) ? "DOWN" : "UP";
  }

  function getEffectiveAngle(line, settings) {
    var angle = getBendAngle(line);
    var springback = num(settings.springback, 0);

    var effective = angle - springback;

    if (effective <= 0) {
      effective = angle;
    }

    return effective;
  }

  /* ---------------------------------------------------------
     CONNECTED BEND PATH
     ---------------------------------------------------------

     Coordinates:
       X = Length direction
       Y = Depth direction
       Z = height / folding direction

     This creates a connected material path.

     NOTE:
     The path is a geometric model used for interference
     analysis. It does not modify the original dimensions.
  */

  function buildSidePath(lines, side, settings) {
    var result = [];

    if (!Array.isArray(lines) || !lines.length) {
      return result;
    }

    var cursor = {
      x: 0,
      y: 0,
      z: 0
    };

    var direction = side === "dep"
      ? { x: 0, y: 1, z: 0 }
      : { x: 1, y: 0, z: 0 };

    var bendAxis = side === "dep"
      ? { x: 1, y: 0, z: 0 }
      : { x: 0, y: 1, z: 0 };

    var normal = { x: 0, y: 0, z: 1 };

    var total = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i] || {};

      var size = Math.max(
        0,
        num(line.size, 0)
      );

      var start = {
        x: cursor.x,
        y: cursor.y,
        z: cursor.z
      };

      var end = add(
        cursor,
        mul(direction, size)
      );

      total += size;

      var segment = {
        id: (side === "dep" ? "D" : "L") + (i + 1),
        side: side,
        index: i,

        size: size,

        start: start,
        end: end,

        direction: {
          x: direction.x,
          y: direction.y,
          z: direction.z
        },

        materialDirection: normalize(direction),

        bend: getBendDirection(line),
        angle: getBendAngle(line),
        effectiveAngle: getEffectiveAngle(
          line,
          settings
        ),

        sequence: i + 1,

        bendPoint: null,
        nextDirection: null
      };

      result.push(segment);

      cursor = end;

      /*
        Last line does not have a bend after it.
      */
      if (i < lines.length - 1) {
        var sign = segment.bend === "UP"
          ? 1
          : -1;

        var angleRad =
          degToRad(segment.effectiveAngle) *
          sign;

        segment.bendPoint = {
          x: cursor.x,
          y: cursor.y,
          z: cursor.z
        };

        /*
          Rotate the material direction around the
          cross-axis.

          Length:
            bend axis = Y

          Depth:
            bend axis = X
        */
        direction = rotateDirection(
          direction,
          bendAxis,
          angleRad
        );

        direction = normalize(direction);

        segment.nextDirection = {
          x: direction.x,
          y: direction.y,
          z: direction.z
        };

        /*
          Move the cursor onto the newly rotated path.
        */
        cursor = add(
          cursor,
          mul(
            direction,
            0
          )
        );

        /*
          Recalculate normal so later geometry remains
          connected to the previous folded material.
        */
        normal = normalize(
          cross(bendAxis, direction)
        );

        if (
          Math.abs(normal.x) < EPS &&
          Math.abs(normal.y) < EPS &&
          Math.abs(normal.z) < EPS
        ) {
          normal = {
            x: 0,
            y: 0,
            z: 1
          };
        }
      }
    }

    return {
      side: side,
      segments: result,
      totalSize: total,
      finalPosition: cursor,
      finalDirection: direction,
      finalNormal: normal
    };
  }

  /* ---------------------------------------------------------
     BEND RECORDS
     --------------------------------------------------------- */

  function collectBends(lines, side) {
    var bends = [];

    if (!Array.isArray(lines)) {
      return bends;
    }

    for (var i = 0; i < lines.length - 1; i++) {
      var line = lines[i];

      bends.push({
        id: (side === "dep" ? "D" : "L") + (i + 1),
        side: side,
        index: i,

        angle: getBendAngle(line),

        direction: getBendDirection(line),

        /*
          Array order is currently the user's bend order.
          Later UI can provide a custom sequence without
          changing this engine.
        */
        sequence: i + 1
      });
    }

    return bends;
  }

  /* ---------------------------------------------------------
     MATERIAL MOVEMENT
     --------------------------------------------------------- */

  function getMovementDescription(direction) {
    var d = normalize(direction);

    var parts = [];

    if (Math.abs(d.x) > 0.05) {
      parts.push(
        d.x > 0 ? "+X" : "-X"
      );
    }

    if (Math.abs(d.y) > 0.05) {
      parts.push(
        d.y > 0 ? "+Y" : "-Y"
      );
    }

    if (Math.abs(d.z) > 0.05) {
      parts.push(
        d.z > 0 ? "+Z" : "-Z"
      );
    }

    return parts.length
      ? parts.join(" / ")
      : "STATIONARY";
  }

  /* ---------------------------------------------------------
     BEND PATH ZONE
     ---------------------------------------------------------

     Creates a conservative zone around a bend.

     It is NOT a fixed cup size.

     The zone is used to determine whether another
     material segment occupies the space needed by
     the bend.
  */

  function getBendZone(bend, side, settings) {
    var radius = num(settings.radiusMm, 0.8);
    var thickness = num(settings.thicknessMm, 0.8);

    var effectiveRadius =
      radius + thickness;

    var angle = getBendAngle(bend);

    /*
      Convert mm to inch because user dimensions are inch.
    */
    var rIn = mmToInch(effectiveRadius);

    /*
      Larger angles create a larger movement zone.
    */
    var angleFactor =
      Math.sin(
        Math.min(
          Math.PI / 2,
          degToRad(angle)
        ) / 2
      );

    var zone = rIn * (1 + angleFactor);

    return {
      radiusMm: effectiveRadius,
      radiusIn: rIn,
      zoneIn: Math.max(
        mmToInch(thickness),
        zone
      )
    };
  }

  /* ---------------------------------------------------------
     2D SEGMENT DISTANCE
     --------------------------------------------------------- */

  function pointToSegmentDistance2D(
    px,
    py,
    ax,
    ay,
    bx,
    by
  ) {
    var dx = bx - ax;
    var dy = by - ay;

    var len2 = dx * dx + dy * dy;

    if (len2 < EPS) {
      var ddx = px - ax;
      var ddy = py - ay;
      return Math.sqrt(
        ddx * ddx +
        ddy * ddy
      );
    }

    var t =
      ((px - ax) * dx +
       (py - ay) * dy) /
      len2;

    t = clamp(t, 0, 1);

    var cx = ax + t * dx;
    var cy = ay + t * dy;

    var ex = px - cx;
    var ey = py - cy;

    return Math.sqrt(
      ex * ex +
      ey * ey
    );
  }

  /* ---------------------------------------------------------
     CROSS CORNER ANALYSIS
     ---------------------------------------------------------

     This checks Length × Depth intersections.

     The purpose is NOT to automatically cut every corner.

     It first determines whether the two bend systems
     create an actual material conflict.
  */

  function analyzeIntersection(
    lenIndex,
    depIndex,
    lenLines,
    depLines,
    lenPath,
    depPath,
    settings
  ) {
    var L = lenLines[lenIndex];
    var D = depLines[depIndex];

    if (!L || !D) {
      return null;
    }

    /*
      A crossing exists only when both positions exist.
    */
    var lenPosition = 0;

    for (var i = 0; i <= lenIndex; i++) {
      lenPosition += num(
        lenLines[i].size,
        0
      );
    }

    var depPosition = 0;

    for (var j = 0; j <= depIndex; j++) {
      depPosition += num(
        depLines[j].size,
        0
      );
    }

    var lenSegment =
      lenPath.segments[lenIndex];

    var depSegment =
      depPath.segments[depIndex];

    if (!lenSegment || !depSegment) {
      return null;
    }

    var lenDirection =
      lenSegment.materialDirection;

    var depDirection =
      depSegment.materialDirection;

    /*
      How much the two material directions differ.
    */
    var directionDot =
      clamp(
        Math.abs(
          dot(
            lenDirection,
            depDirection
          )
        ),
        0,
        1
      );

    var directionAngle =
      radToDeg(
        Math.acos(directionDot)
      );

    /*
      UP / DOWN relation.
    */
    var sameDirection =
      getBendDirection(L) ===
      getBendDirection(D);

    /*
      A geometric conflict indicator.

      We do NOT use one fixed relief value.
      Instead we estimate how much the two bend
      movement zones overlap.

      The final cut is zero unless the bend zones
      actually overlap.
    */
    var lenBend = getBendZone(
      L,
      "len",
      settings
    );

    var depBend = getBendZone(
      D,
      "dep",
      settings
    );

    /*
      Relative movement vectors.
    */
    var relativeMovement =
      sub(
        lenDirection,
        depDirection
      );

    var movementStrength =
      Math.sqrt(
        dot(
          relativeMovement,
          relativeMovement
        )
      );

    /*
      Direction changes caused by each bend.
    */
    var lenAngle =
      getEffectiveAngle(
        L,
        settings
      );

    var depAngle =
      getEffectiveAngle(
        D,
        settings
      );

    /*
      Base interaction.
    */
    var angleInteraction =
      Math.sin(
        degToRad(
          Math.min(
            180,
            lenAngle + depAngle
          )
        ) / 2
      );

    /*
      Same UP/DOWN does not automatically mean
      collision. It only changes the interaction.
    */
    var directionFactor =
      sameDirection
        ? 0.65
        : 1.0;

    /*
      Calculate possible overlap zone.
    */
    var combinedZone =
      lenBend.zoneIn +
      depBend.zoneIn;

    var overlap =
      combinedZone *
      angleInteraction *
      directionFactor *
      Math.max(
        0.15,
        movementStrength
      );

    /*
      If the bends are very shallow, reduce the
      required relief.
    */
    if (lenAngle < 20) {
      overlap *= 0.25;
    }

    if (depAngle < 20) {
      overlap *= 0.25;
    }

    /*
      Minimum practical material allowance.
      This is NOT automatically applied as a cut.
    */
    var thicknessIn =
      mmToInch(
        num(
          settings.thicknessMm,
          0.8
        )
      );

    /*
      Required cut is only produced when the
      calculated overlap exceeds the material
      tolerance.

      This prevents every crossing from becoming
      a cup cut.
    */
    var requiredCut =
      Math.max(
        0,
        overlap - thicknessIn * 0.5
      );

    /*
      Very small values are treated as no cut.
    */
    if (requiredCut < 1 / 16) {
      requiredCut = 0;
    }

    /*
      Cap the result so an accidental huge value
      cannot destroy the sheet.
    */
    var maxCut =
      Math.max(
        thicknessIn * 4,
        1 / 8
      );

    requiredCut =
      Math.min(
        requiredCut,
        maxCut
      );

    var interference =
      requiredCut > 0;

    return {
      id:
        "L" + (lenIndex + 1) +
        "xD" + (depIndex + 1),

      lenIndex: lenIndex,
      depIndex: depIndex,

      position: {
        length: round(lenPosition, 6),
        depth: round(depPosition, 6)
      },

      lengthBend: {
        angle: getBendAngle(L),
        effectiveAngle:
          round(
            lenAngle,
            3
          ),
        direction:
          getBendDirection(L),
        movement:
          getMovementDescription(
            lenDirection
          ),
        sequence:
          lenIndex + 1
      },

      depthBend: {
        angle: getBendAngle(D),
        effectiveAngle:
          round(
            depAngle,
            3
          ),
        direction:
          getBendDirection(D),
        movement:
          getMovementDescription(
            depDirection
          ),
        sequence:
          depIndex + 1
      },

      geometry: {
        lengthDirection: lenDirection,
        depthDirection: depDirection,

        directionAngle:
          round(
            directionAngle,
            3
          ),

        movementStrength:
          round(
            movementStrength,
            6
          ),

        combinedZone:
          round(
            combinedZone,
            6
          ),

        overlap:
          round(
            overlap,
            6
          )
      },

      interference: interference,

      cut: {
        required: interference,
        sizeInch:
          round(
            requiredCut,
            6
          ),
        sizeMm:
          round(
            inchToMm(requiredCut),
            3
          )
      },

      status:
        interference
          ? "AUTO_CUT_REQUIRED"
          : "NO_CUT"
    };
  }

  /* ---------------------------------------------------------
     COMPLETE ANALYSIS
     --------------------------------------------------------- */

  function analyze() {
    var state = window.state || {};

    var lenLines =
      Array.isArray(state.lenLines)
        ? state.lenLines
        : [];

    var depLines =
      Array.isArray(state.depLines)
        ? state.depLines
        : [];

    var settings =
      getSettings();

    /*
      Build connected paths.
    */
    var lenPath =
      buildSidePath(
        lenLines,
        "len",
        settings
      );

    var depPath =
      buildSidePath(
        depLines,
        "dep",
        settings
      );

    /*
      Collect bend records.
    */
    var lengthBends =
      collectBends(
        lenLines,
        "len"
      );

    var depthBends =
      collectBends(
        depLines,
        "dep"
      );

    /*
      Current sequence:
        array order.

      Later a custom sequence UI can replace
      this without changing the analysis API.
    */
    var sequence = [];

    lengthBends.forEach(function (b) {
      sequence.push({
        id: b.id,
        side: "LENGTH",
        index: b.index,
        sequence: b.sequence,
        angle: b.angle,
        direction: b.direction
      });
    });

    depthBends.forEach(function (b) {
      sequence.push({
        id: b.id,
        side: "DEPTH",
        index: b.index,
        sequence: b.sequence,
        angle: b.angle,
        direction: b.direction
      });
    });

    /*
      Cross-intersection analysis.
    */
    var intersections = [];

    for (
      var li = 0;
      li < lenLines.length;
      li++
    ) {
      for (
        var di = 0;
        di < depLines.length;
        di++
      ) {
        var result =
          analyzeIntersection(
            li,
            di,
            lenLines,
            depLines,
            lenPath,
            depPath,
            settings
          );

        if (result) {
          intersections.push(result);
        }
      }
    }

    var cuts =
      intersections.filter(
        function (x) {
          return x.cut.required;
        }
      );

    /*
      Return ONE shared result object.
    */
    return {
      version: "geometry-v1",

      settings: {
        thicknessMm:
          settings.thicknessMm,

        radiusMm:
          settings.radiusMm,

        kFactor:
          settings.kFactor,

        springback:
          settings.springback
      },

      length: {
        total:
          lenPath.totalSize,

        segments:
          lenPath.segments,

        finalPosition:
          lenPath.finalPosition,

        finalDirection:
          lenPath.finalDirection
      },

      depth: {
        total:
          depPath.totalSize,

        segments:
          depPath.segments,

        finalPosition:
          depPath.finalPosition,

        finalDirection:
          depPath.finalDirection
      },

      sequence: sequence,

      intersections:
        intersections,

      cuts:
        cuts,

      statistics: {
        totalIntersections:
          intersections.length,

        cutCount:
          cuts.length,

        noCutCount:
          intersections.length -
          cuts.length
      }
    };
  }

  /* ---------------------------------------------------------
     CUT LOOKUP
     --------------------------------------------------------- */

  function getCut(
    lenIndex,
    depIndex,
    analysis
  ) {
    var data =
      analysis ||
      analyze();

    for (
      var i = 0;
      i < data.intersections.length;
      i++
    ) {
      var x =
        data.intersections[i];

      if (
        x.lenIndex === lenIndex &&
        x.depIndex === depIndex
      ) {
        return x;
      }
    }

    return null;
  }

  /* ---------------------------------------------------------
     DEBUG
     --------------------------------------------------------- */

  function debug() {
    var data = analyze();

    console.log(
      "=== GEOMETRY ENGINE ==="
    );

    console.log(
      "Sequence:",
      data.sequence
    );

    console.log(
      "Intersections:",
      data.intersections
    );

    console.log(
      "Automatic cuts:",
      data.cuts
    );

    return data;
  }

  /* ---------------------------------------------------------
     PUBLIC API
     --------------------------------------------------------- */

  window.GeometryEngine = {
    analyze: analyze,
    getCut: getCut,
    debug: debug,

    helpers: {
      degToRad: degToRad,
      radToDeg: radToDeg,
      inchToMm: inchToMm,
      mmToInch: mmToInch,
      normalize: normalize,
      dot: dot,
      cross: cross,
      distance: distance
    }
  };

})();
