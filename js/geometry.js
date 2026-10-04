/* =========================================================
   GEOMETRY ENGINE V3
   MUNNU FABRICATION / SHEET METAL

   COMPLETE DATA MODEL

   LENGTH:
     L1 → L2 → L3 → ...

   DEPTH:
     D1 → D2 → D3 → ...

   Every line contains:
     size
     angle
     UP / DOWN
     position
     sequence

   ENGINE FLOW:

     USER DATA
        ↓
     COMPLETE BEND NETWORK
        ↓
     BEND ALLOWANCE
     BEND DEDUCTION
     SPRINGBACK
     RADIUS
     THICKNESS
        ↓
     3D BEND PATH
        ↓
     BEND INTERACTION
        ↓
     MATERIAL INTERFERENCE
        ↓
     NOTCH / RELIEF GEOMETRY
        ↓
     FINAL FLAT DATA

   No external geometry library.
   ========================================================= */

(function () {
  "use strict";

  var EPS = 0.000001;

  /* =========================================================
     BASIC MATH
     ========================================================= */

  function num(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n)
      ? n
      : (fallback || 0);
  }

  function clamp(v, min, max) {
    return Math.max(
      min,
      Math.min(max, v)
    );
  }

  function degToRad(v) {
    return v * Math.PI / 180;
  }

  function radToDeg(v) {
    return v * 180 / Math.PI;
  }

  function round(v, digits) {
    var p = Math.pow(
      10,
      digits || 0
    );

    return Math.round(v * p) / p;
  }

  function inchToMm(v) {
    return num(v, 0) * 25.4;
  }

  function mmToInch(v) {
    return num(v, 0) / 25.4;
  }

  function vec(x, y, z) {
    return {
      x: x || 0,
      y: y || 0,
      z: z || 0
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

  function dot(a, b) {
    return (
      a.x * b.x +
      a.y * b.y +
      a.z * b.z
    );
  }

  function cross(a, b) {
    return {
      x:
        a.y * b.z -
        a.z * b.y,

      y:
        a.z * b.x -
        a.x * b.z,

      z:
        a.x * b.y -
        a.y * b.x
    };
  }

  function length(v) {
    return Math.sqrt(
      v.x * v.x +
      v.y * v.y +
      v.z * v.z
    );
  }

  function normalize(v) {
    var len = length(v);

    if (len < EPS) {
      return vec(0, 0, 0);
    }

    return {
      x: v.x / len,
      y: v.y / len,
      z: v.z / len
    };
  }

  function distance(a, b) {
    return length(
      sub(a, b)
    );
  }

  function lerp(a, b, t) {
    return {
      x:
        a.x +
        (b.x - a.x) * t,

      y:
        a.y +
        (b.y - a.y) * t,

      z:
        a.z +
        (b.z - a.z) * t
    };
  }

  /* =========================================================
     ROTATE VECTOR AROUND AXIS
     ========================================================= */

  function rotateVector(
    vector,
    axis,
    angle
  ) {
    var v = vector;
    var k = normalize(axis);

    var c = Math.cos(angle);
    var s = Math.sin(angle);

    var term1 =
      mul(v, c);

    var term2 =
      mul(
        cross(k, v),
        s
      );

    var term3 =
      mul(
        k,
        dot(k, v) *
          (1 - c)
      );

    return add(
      add(term1, term2),
      term3
    );
  }

  /* =========================================================
     SETTINGS — with validation
     ========================================================= */

  function getSettings() {
    var s =
      window.settings || {};

    return {
      thicknessMm:
        clamp(
          num(s.thickness, 0.8),
          0.1,
          10
        ),

      radiusMm:
        clamp(
          num(s.radius, 0.8),
          0.1,
          20
        ),

      kFactor:
        clamp(
          num(s.kfactor, 0.44),
          0,
          1
        ),

      springback:
        clamp(
          num(s.springback, 0.5),
          0,
          30
        ),

      reliefMm:
        clamp(
          num(s.relief, 1.6),
          0,
          20
        )
    };
  }

  /* =========================================================
     NORMALIZE LINE DATA
     ========================================================= */

  function normalizeAngle(line) {
    var a =
      num(
        line && line.angle,
        90
      );

    if (a <= 0) {
      a = 90;
    }

    if (a > 180) {
      a = 180;
    }

    return a;
  }

  function normalizeBend(line) {
    var b = String(
      line && line.bend
        ? line.bend
        : "up"
    ).toLowerCase();

    if (
      b === "down" ||
      b === "false" ||
      b === "0" ||
      b === "-1"
    ) {
      return "DOWN";
    }

    return "UP";
  }

  function effectiveAngle(
    line,
    settings
  ) {
    var a =
      normalizeAngle(line);

    var sb =
      num(
        settings.springback,
        0
      );

    var result =
      a - sb;

    if (result <= 0) {
      result = a;
    }

    return result;
  }

  /* =========================================================
     BEND ALLOWANCE
     ========================================================= */

  function bendAllowance(
    line,
    settings
  ) {
    var angle =
      effectiveAngle(
        line,
        settings
      );

    var r =
      settings.radiusMm;

    var t =
      settings.thicknessMm;

    var k =
      settings.kFactor;

    var neutralRadius =
      r + k * t;

    var ba =
      degToRad(angle) *
      neutralRadius;

    return {
      angleDeg:
        round(angle, 4),

      radiusMm:
        round(r, 4),

      thicknessMm:
        round(t, 4),

      kFactor:
        round(k, 4),

      neutralRadiusMm:
        round(
          neutralRadius,
          4
        ),

      bendAllowanceMm:
        round(
          ba,
          4
        ),

      bendAllowanceIn:
        round(
          mmToInch(ba),
          6
        )
    };
  }

  /* =========================================================
     BEND DEDUCTION
     ========================================================= */

  function bendDeduction(
    line,
    settings
  ) {
    var angle =
      effectiveAngle(
        line,
        settings
      );

    var r =
      settings.radiusMm;

    var t =
      settings.thicknessMm;

    var ba =
      bendAllowance(
        line,
        settings
      ).bendAllowanceMm;

    var setback =
      (r + t) *
      Math.tan(
        degToRad(angle) / 2
      );

    var bd =
      2 * setback - ba;

    return {
      outsideSetbackMm:
        round(
          setback,
          4
        ),

      bendDeductionMm:
        round(
          bd,
          4
        ),

      bendDeductionIn:
        round(
          mmToInch(bd),
          6
        )
    };
  }

  /* =========================================================
     COMPLETE USER LINE
     ========================================================= */

  function createLineData(
    line,
    index,
    side,
    settings
  ) {
    var size =
      Math.max(
        0,
        Math.min(
          1000,
          num(
            line && line.size,
            0
          )
        )
      );

    var angle =
      normalizeAngle(line);

    var bend =
      normalizeBend(line);

    var eff =
      effectiveAngle(
        line,
        settings
      );

    return {
      id:
        side === "L"
          ? "L" + (index + 1)
          : "D" + (index + 1),

      side:
        side === "L"
          ? "LENGTH"
          : "DEPTH",

      index: index,

      sequence:
        index + 1,

      sizeInch:
        round(size, 6),

      sizeMm:
        round(
          inchToMm(size),
          3
        ),

      angleDeg:
        round(angle, 4),

      effectiveAngleDeg:
        round(eff, 4),

      direction:
        bend,

      bendAllowance:
        bendAllowance(
          line,
          settings
        ),

      bendDeduction:
        bendDeduction(
          line,
          settings
        )
    };
  }

  /* =========================================================
     BUILD COMPLETE FLAT NETWORK
     ========================================================= */

  function buildFlatNetwork(
    lenLines,
    depLines,
    settings
  ) {
    var length = [];
    var depth = [];

    var x = 0;

    for (
      var i = 0;
      i < lenLines.length;
      i++
    ) {
      var item =
        createLineData(
          lenLines[i],
          i,
          "L",
          settings
        );

      item.startFlat = {
        x: x,
        y: 0
      };

      x += item.sizeInch;

      item.endFlat = {
        x: x,
        y: 0
      };

      item.positionInch =
        x;

      length.push(item);
    }

    var y = 0;

    for (
      var j = 0;
      j < depLines.length;
      j++
    ) {
      var itemD =
        createLineData(
          depLines[j],
          j,
          "D",
          settings
        );

      itemD.startFlat = {
        x: 0,
        y: y
      };

      y += itemD.sizeInch;

      itemD.endFlat = {
        x: 0,
        y: y
      };

      itemD.positionInch =
        y;

      depth.push(itemD);
    }

    return {
      length: length,
      depth: depth,

      totalLengthIn:
        round(x, 6),

      totalDepthIn:
        round(y, 6)
    };
  }

  /* =========================================================
     COMPLETE 3D BEND NETWORK
     ========================================================= */

  function build3DNetwork(
    network,
    settings
  ) {
    var result = {
      length: [],
      depth: []
    };

    build3DSide(
      network.length,
      "LENGTH",
      settings,
      result.length
    );

    build3DSide(
      network.depth,
      "DEPTH",
      settings,
      result.depth
    );

    return result;
  }

  function build3DSide(
    lines,
    side,
    settings,
    output
  ) {
    var cursor =
      vec(0, 0, 0);

    var direction =
      side === "LENGTH"
        ? vec(1, 0, 0)
        : vec(0, 1, 0);

    var axis =
      side === "LENGTH"
        ? vec(0, 1, 0)
        : vec(1, 0, 0);

    var normal =
      vec(0, 0, 1);

    for (
      var i = 0;
      i < lines.length;
      i++
    ) {
      var line =
        lines[i];

      var start =
        {
          x: cursor.x,
          y: cursor.y,
          z: cursor.z
        };

      var end =
        add(
          cursor,
          mul(
            direction,
            line.sizeInch
          )
        );

      var bendPoint =
        end;

      var bendRecord = {
        id: line.id,

        side: side,

        index:
          line.index,

        sequence:
          line.sequence,

        sizeInch:
          line.sizeInch,

        angleDeg:
          line.angleDeg,

        effectiveAngleDeg:
          line.effectiveAngleDeg,

        direction:
          line.direction,

        start: start,

        end: end,

        bendPoint:
          bendPoint,

        directionVector:
          normalize(
            direction
          ),

        bendAxis:
          normalize(axis),

        surfaceNormal:
          normalize(normal),

        bendAllowance:
          line.bendAllowance,

        bendDeduction:
          line.bendDeduction,

        nextDirection: null,

        nextNormal: null
      };

      if (
        i <
        lines.length - 1
      ) {
        var sign =
          line.direction ===
          "UP"
            ? 1
            : -1;

        var angle =
          degToRad(
            line.effectiveAngleDeg
          ) * sign;

        var nextDirection =
          rotateVector(
            direction,
            axis,
            angle
          );

        nextDirection =
          normalize(
            nextDirection
          );

        var nextNormal =
          normalize(
            cross(
              axis,
              nextDirection
            )
          );

        if (
          length(nextNormal) <
          EPS
        ) {
          nextNormal =
            normal;
        }

        bendRecord.nextDirection =
          nextDirection;

        bendRecord.nextNormal =
          nextNormal;

        direction =
          nextDirection;

        normal =
          nextNormal;
      }

      output.push(
        bendRecord
      );

      cursor =
        end;
    }
  }

  /* =========================================================
     BEND ZONE
     ========================================================= */

  function bendZone(
    line,
    settings
  ) {
    var r =
      settings.radiusMm;

    var t =
      settings.thicknessMm;

    var relief =
      settings.reliefMm;

    var angle =
      line.effectiveAngleDeg;

    var effectiveRadius =
      r + t;

    var factor =
      Math.sin(
        Math.min(
          180,
          angle
        ) *
          Math.PI /
          360
      );

    var zoneMm =
      effectiveRadius *
      (1 + factor) +
      relief;

    zoneMm =
      Math.max(
        zoneMm,
        t
      );

    return {
      radiusMm:
        round(
          r,
          4
        ),

      thicknessMm:
        round(
          t,
          4
        ),

      effectiveRadiusMm:
        round(
          effectiveRadius,
          4
        ),

      angleDeg:
        round(
          angle,
          4
        ),

      zoneMm:
        round(
          zoneMm,
          4
        ),

      zoneIn:
        round(
          mmToInch(zoneMm),
          6
        )
    };
  }

  /* =========================================================
     2D LINE INTERSECTION
     ========================================================= */

  function lineIntersection2D(
    a1,
    a2,
    b1,
    b2
  ) {
    var x1 = a1.x;
    var y1 = a1.y;

    var x2 = a2.x;
    var y2 = a2.y;

    var x3 = b1.x;
    var y3 = b1.y;

    var x4 = b2.x;
    var y4 = b2.y;

    var den =
      (x1 - x2) *
        (y3 - y4) -
      (y1 - y2) *
        (x3 - x4);

    if (
      Math.abs(den) <
      EPS
    ) {
      return null;
    }

    var px =
      (
        (x1 * y2 -
          y1 * x2) *
          (x3 - x4) -
        (x1 - x2) *
          (x3 * y4 -
            y3 * x4)
      ) / den;

    var py =
      (
        (x1 * y2 -
          y1 * x2) *
          (y3 - y4) -
        (y1 - y2) *
          (x3 * y4 -
            y3 * x4)
      ) / den;

    return {
      x: px,
      y: py
    };
  }

  /* =========================================================
     ANGLE BETWEEN 3D DIRECTIONS
     ========================================================= */

  function directionAngle(
    a,
    b
  ) {
    var aa =
      normalize(a);

    var bb =
      normalize(b);

    var d =
      clamp(
        Math.abs(
          dot(aa, bb)
        ),
        0,
        1
      );

    return radToDeg(
      Math.acos(d)
    );
  }

  /* =========================================================
     RELATIVE MOVEMENT
     ========================================================= */

  function movementStrength(
    a,
    b
  ) {
    var r =
      sub(
        normalize(a),
        normalize(b)
      );

    return length(r);
  }

  /* =========================================================
     NOTCH GEOMETRY
     ========================================================= */

  function makeNotch(
    center,
    widthIn,
    depthIn,
    orientation
  ) {
    var w =
      Math.max(
        widthIn,
        1 / 32
      );

    var d =
      Math.max(
        depthIn,
        1 / 32
      );

    var hw =
      w / 2;

    var hd =
      d / 2;

    var points = [
      {
        x:
          center.x - hw,
        y:
          center.y - hd
      },

      {
        x:
          center.x + hw,
        y:
          center.y - hd
      },

      {
        x:
          center.x + hw,
        y:
          center.y + hd
      },

      {
        x:
          center.x - hw,
        y:
          center.y + hd
      }
    ];

    return {
      type:
        "RECTANGULAR_RELIEF",

      orientation:
        orientation,

      center: {
        x:
          round(
            center.x,
            6
          ),
        y:
          round(
            center.y,
            6
          )
      },

      widthIn:
        round(
          w,
          6
        ),

      depthIn:
        round(
          d,
          6
        ),

      widthMm:
        round(
          inchToMm(w),
          3
        ),

      depthMm:
        round(
          inchToMm(d),
          3
        ),

      corners:
        points.map(
          function (p) {
            return {
              x:
                round(
                  p.x,
                  6
                ),
              y:
                round(
                  p.y,
                  6
                )
            };
          }
        ),

      polygon: [
        [
          [
            round(
              points[0].x,
              6
            ),
            round(
              points[0].y,
              6
            )
          ],

          [
            round(
              points[1].x,
              6
            ),
            round(
              points[1].y,
              6
            )
          ],

          [
            round(
              points[2].x,
              6
            ),
            round(
              points[2].y,
              6
            )
          ],

          [
            round(
              points[3].x,
              6
            ),
            round(
              points[3].y,
              6
            )
          ],

          [
            round(
              points[0].x,
              6
            ),
            round(
              points[0].y,
              6
            )
          ]
        ]
      ]
    };
  }

  /* =========================================================
     COMPLETE INTERACTION
     ========================================================= */

  function calculateInteraction(
    L,
    D,
    L3D,
    D3D,
    settings
  ) {
    var lZone =
      bendZone(
        L,
        settings
      );

    var dZone =
      bendZone(
        D,
        settings
      );

    var angle3D =
      directionAngle(
        L3D.directionVector,
        D3D.directionVector
      );

    var movement =
      movementStrength(
        L3D.directionVector,
        D3D.directionVector
      );

    var sameDirection =
      L.direction ===
      D.direction;

    var directionFactor =
      sameDirection
        ? 0.65
        : 1.0;

    var totalAngle =
      Math.min(
        180,
        L.effectiveAngleDeg +
          D.effectiveAngleDeg
      );

    var angleFactor =
      Math.sin(
        degToRad(
          totalAngle
        ) / 2
      );

    var combinedZone =
      lZone.zoneIn +
      dZone.zoneIn;

    var rawOverlap =
      combinedZone *
      angleFactor *
      directionFactor *
      Math.max(
        0.15,
        movement
      );

    if (
      L.effectiveAngleDeg <
      20
    ) {
      rawOverlap *=
        0.25;
    }

    if (
      D.effectiveAngleDeg <
      20
    ) {
      rawOverlap *=
        0.25;
    }

    var thicknessIn =
      mmToInch(
        settings.thicknessMm
      );

    var relief =
      Math.max(
        0,
        rawOverlap -
          thicknessIn * 0.5
      );

    var minimumCut =
      1 / 16;

    if (
      relief <
      minimumCut
    ) {
      relief = 0;
    }

    var maximumCut =
      Math.max(
        thicknessIn * 4,
        1 / 8
      );

    relief =
      Math.min(
        relief,
        maximumCut
      );

    var required =
      relief > 0;

    return {
      required:
        required,

      directionRelation:
        sameDirection
          ? "SAME"
          : "OPPOSITE",

      directionAngleDeg:
        round(
          angle3D,
          4
        ),

      movementStrength:
        round(
          movement,
          6
        ),

      lengthZoneIn:
        round(
          lZone.zoneIn,
          6
        ),

      depthZoneIn:
        round(
          dZone.zoneIn,
          6
        ),

      combinedZoneIn:
        round(
          combinedZone,
          6
        ),

      angleFactor:
        round(
          angleFactor,
          6
        ),

      directionFactor:
        round(
          directionFactor,
          6
        ),

      rawOverlapIn:
        round(
          rawOverlap,
          6
        ),

      requiredReliefIn:
        round(
          relief,
          6
        ),

      requiredReliefMm:
        round(
          inchToMm(relief),
          3
        )
    };
  }

  /* =========================================================
     BUILD ALL INTERSECTIONS
     ========================================================= */

  function buildIntersections(
    network,
    network3D,
    settings
  ) {
    var results = [];

    for (
      var li = 0;
      li < network.length.length;
      li++
    ) {
      var L =
        network.length[li];

      var L3D =
        network3D.length[li];

      for (
        var di = 0;
        di < network.depth.length;
        di++
      ) {
        var D =
          network.depth[di];

        var D3D =
          network3D.depth[di];

        if (!L || !D) {
          continue;
        }

        var center = {
          x:
            L.positionInch,

          y:
            D.positionInch
        };

        var interaction =
          calculateInteraction(
            L,
            D,
            L3D,
            D3D,
            settings
          );

        var cut = null;

        if (
          interaction.required
        ) {
          var width =
            interaction.requiredReliefIn;

          var depth =
            interaction.requiredReliefIn;

          var orientation =
            Math.max(
              L.effectiveAngleDeg,
              D.effectiveAngleDeg
            ) >= 90
              ? "CROSS_RELIEF"
              : "LOCAL_RELIEF";

          cut =
            makeNotch(
              center,
              width,
              depth,
              orientation
            );
        }

        results.push({
          id:
            L.id +
            "x" +
            D.id,

          lenIndex:
            L.index,

          depIndex:
            D.index,

          position: {
            x:
              round(
                center.x,
                6
              ),

            y:
              round(
                center.y,
                6
              )
          },

          lengthBend: {
            id:
              L.id,

            sequence:
              L.sequence,

            sizeInch:
              L.sizeInch,

            angleDeg:
              L.angleDeg,

            effectiveAngleDeg:
              L.effectiveAngleDeg,

            direction:
              L.direction,

            bendAllowance:
              L.bendAllowance,

            bendDeduction:
              L.bendDeduction
          },

          depthBend: {
            id:
              D.id,

            sequence:
              D.sequence,

            sizeInch:
              D.sizeInch,

            angleDeg:
              D.angleDeg,

            effectiveAngleDeg:
              D.effectiveAngleDeg,

            direction:
              D.direction,

            bendAllowance:
              D.bendAllowance,

            bendDeduction:
              D.bendDeduction
          },

          interaction:
            interaction,

          interference:
            interaction.required,

          cut: cut
            ? {
                required: true,

                type:
                  "NOTCH",

                shape:
                  cut.type,

                widthIn:
                  cut.widthIn,

                depthIn:
                  cut.depthIn,

                widthMm:
                  cut.widthMm,

                depthMm:
                  cut.depthMm,

                center:
                  cut.center,

                corners:
                  cut.corners,

                polygon:
                  cut.polygon
              }
            : {
                required: false,

                type:
                  "NONE",

                shape:
                  "NONE",

                widthIn: 0,

                depthIn: 0,

                widthMm: 0,

                depthMm: 0,

                center:
                  center,

                corners: [],

                polygon: null
              },

          status:
            interaction.required
              ? "AUTO_CUT_REQUIRED"
              : "NO_CUT"
        });
      }
    }

    return results;
  }

  /* =========================================================
     COMPLETE FLAT SHEET OUTLINE
     ========================================================= */

  function buildSheetOutline(
    widthIn,
    heightIn
  ) {
    return {
      type:
        "RECTANGULAR_SHEET",

      widthIn:
        round(
          widthIn,
          6
        ),

      heightIn:
        round(
          heightIn,
          6
        ),

      widthMm:
        round(
          inchToMm(widthIn),
          3
        ),

      heightMm:
        round(
          inchToMm(heightIn),
          3
        ),

      corners: [
        {
          x: 0,
          y: 0
        },

        {
          x:
            round(
              widthIn,
              6
            ),
          y: 0
        },

        {
          x:
            round(
              widthIn,
              6
            ),
          y:
            round(
              heightIn,
              6
            )
        },

        {
          x: 0,
          y:
            round(
              heightIn,
              6
            )
        }
      ]
    };
  }

  /* =========================================================
     CUT SUMMARY
     ========================================================= */

  function buildCutSummary(
    intersections
  ) {
    return intersections
      .filter(
        function (x) {
          return (
            x.cut &&
            x.cut.required
          );
        }
      )
      .map(
        function (x) {
          return {
            id: x.id,

            position:
              x.position,

            widthIn:
              x.cut.widthIn,

            depthIn:
              x.cut.depthIn,

            widthMm:
              x.cut.widthMm,

            depthMm:
              x.cut.depthMm,

            type:
              x.cut.type,

            shape:
              x.cut.shape,

            corners:
              x.cut.corners
          };
        }
      );
  }

  /* =========================================================
     BEND SEQUENCE
     ========================================================= */

  function buildSequence(
    network
  ) {
    var all = [];

    network.length.forEach(
      function (x) {
        all.push({
          id: x.id,

          side:
            "LENGTH",

          index:
            x.index,

          sequence:
            x.sequence,

          sizeInch:
            x.sizeInch,

          angleDeg:
            x.angleDeg,

          effectiveAngleDeg:
            x.effectiveAngleDeg,

          direction:
            x.direction
        });
      }
    );

    network.depth.forEach(
      function (x) {
        all.push({
          id: x.id,

          side:
            "DEPTH",

          index:
            x.index,

          sequence:
            x.sequence,

          sizeInch:
            x.sizeInch,

          angleDeg:
            x.angleDeg,

          effectiveAngleDeg:
            x.effectiveAngleDeg,

          direction:
            x.direction
        });
      }
    );

    return all;
  }

  /* =========================================================
     EMPTY RESULT — jab data hi na ho
     ========================================================= */

  function khaaliResult(settings) {
    return {
      version:
        "geometry-v3",

      settings: {
        thicknessMm:
          settings.thicknessMm,

        radiusMm:
          settings.radiusMm,

        kFactor:
          settings.kFactor,

        springback:
          settings.springback,

        reliefMm:
          settings.reliefMm
      },

      input: {
        lengthLines: [],
        depthLines: []
      },

      sheet:
        buildSheetOutline(0, 0),

      model3D: {
        length: [],
        depth: []
      },

      sequence: [],

      intersections: [],

      cuts: [],

      statistics: {
        totalLengthLines: 0,
        totalDepthLines: 0,
        totalIntersections: 0,
        cutCount: 0,
        noCutCount: 0
      }
    };
  }

  /* =========================================================
     MAIN ANALYZE
     ========================================================= */

  function analyze() {
    var state =
      window.state || {};

    var lenLines =
      Array.isArray(
        state.lenLines
      )
        ? state.lenLines
        : [];

    var depLines =
      Array.isArray(
        state.depLines
      )
        ? state.depLines
        : [];

    var settings =
      getSettings();

    // Agar dono khaali hain to khaali result do
    if (
      !lenLines.length &&
      !depLines.length
    ) {
      return khaaliResult(settings);
    }

    var network =
      buildFlatNetwork(
        lenLines,
        depLines,
        settings
      );

    var network3D =
      build3DNetwork(
        network,
        settings
      );

    var intersections =
      buildIntersections(
        network,
        network3D,
        settings
      );

    var cuts =
      buildCutSummary(
        intersections
      );

    var sheet =
      buildSheetOutline(
        network.totalLengthIn,
        network.totalDepthIn
      );

    var sequence =
      buildSequence(
        network
      );

    return {
      version:
        "geometry-v3",

      settings: {
        thicknessMm:
          settings.thicknessMm,

        radiusMm:
          settings.radiusMm,

        kFactor:
          settings.kFactor,

        springback:
          settings.springback,

        reliefMm:
          settings.reliefMm
      },

      input: {
        lengthLines:
          network.length,

        depthLines:
          network.depth
      },

      sheet:
        sheet,

      model3D: {
        length:
          network3D.length,

        depth:
          network3D.depth
      },

      sequence:
        sequence,

      intersections:
        intersections,

      cuts:
        cuts,

      statistics: {
        totalLengthLines:
          network.length.length,

        totalDepthLines:
          network.depth.length,

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

  /* =========================================================
     GET ONE INTERSECTION / CUT — safe
     ========================================================= */

  function getCut(
    lenIndex,
    depIndex,
    analysis
  ) {
    var data =
      analysis ||
      analyze();

    if (
      !data ||
      !Array.isArray(
        data.intersections
      )
    ) {
      return null;
    }

    for (
      var i = 0;
      i <
      data.intersections.length;
      i++
    ) {
      var item =
        data.intersections[i];

      if (
        item.lenIndex ===
          lenIndex &&
        item.depIndex ===
          depIndex
      ) {
        return item;
      }
    }

    return null;
  }

  /* =========================================================
     DEBUG
     ========================================================= */

  function debug() {
    var data =
      analyze();

    console.log(
      "================================"
    );

    console.log(
      " GEOMETRY ENGINE V3"
    );

    console.log(
      "================================"
    );

    console.log(
      "SETTINGS:",
      data.settings
    );

    console.log(
      "INPUT LENGTH:",
      data.input.lengthLines
    );

    console.log(
      "INPUT DEPTH:",
      data.input.depthLines
    );

    console.log(
      "SHEET:",
      data.sheet
    );

    console.log(
      "3D LENGTH:",
      data.model3D.length
    );

    console.log(
      "3D DEPTH:",
      data.model3D.depth
    );

    console.log(
      "SEQUENCE:",
      data.sequence
    );

    console.log(
      "ALL INTERSECTIONS:",
      data.intersections
    );

    console.log(
      "REQUIRED CUTS:",
      data.cuts
    );

    console.log(
      "STATISTICS:",
      data.statistics
    );

    return data;
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.GeometryEngine = {

    analyze:
      analyze,

    getCut:
      getCut,

    debug:
      debug,

    helpers: {

      num:
        num,

      clamp:
        clamp,

      degToRad:
        degToRad,

      radToDeg:
        radToDeg,

      inchToMm:
        inchToMm,

      mmToInch:
        mmToInch,

      normalize:
        normalize,

      dot:
        dot,

      cross:
        cross,

      distance:
        distance,

      lerp:
        lerp,

      bendAllowance:
        bendAllowance,

      bendDeduction:
        bendDeduction,

      buildFlatNetwork:
        buildFlatNetwork,

      build3DNetwork:
        build3DNetwork,

      makeNotch:
        makeNotch
    }
  };

})();
