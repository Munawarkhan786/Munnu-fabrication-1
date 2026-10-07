/* =========================================================
   GEOMETRY.JS
   GEOMETRY ENGINE V6 — MASTER SHEET ENGINE
   ---------------------------------------------------------
   KYA NAYA HAI (V5 se):

   1. UP / DOWN + ANGLE = us LINE ka apna bend (line ke SHURU me).
      Line ek flange hai. Pehli line ka koi bend nahi hota.
        UP   = flange marking (SS) side ki taraf mudti hai
               -> asli piece me (finish upar) NEECHE jati hai
        DOWN = flange sticker/finish side ki taraf mudti hai
               -> asli piece me UPAR jati hai

   2. Har angle ka alag calculation:
        - bend allowance / deduction (theory) har angle pe
        - shop deduction (aapka 1/8 @90 rule) angle ke hisab se
          scale hota hai (SHOP mode me), door side pe extra gap
        - corner pe MITER CUT: dono flange ke angle se cut ki
          dono lines ka angle nikalta hai (90/90 = poora corner)

   3. FOLD MODEL: sheet ko asli finished shape me mod ke 3D
      polygons deta hai (finish side upar). Flat / Result / 3D
      sirf dikhate hain, calculation yahin hoti hai.

   4. Purane saare keys (lengthLines, depthLines, flat, sheet,
      totals, intersections, cuts, cutSummary, threeD, sequence,
      settings, input) SAME naam se milte hain, taaki flat.js,
      result.js, 3d.js na tootein.

   LIMITS (jaan-bujh ke):
        - Sheet ki motai / bend radius ko cut me nahi ginte
          (sharp-bend math). "Corner mil gaya" wala check karigar
          ka rahega.
        - 180 (hem) aur 90 se bade angle me needsCheck = true.
        - Round / curved shape is engine me nahi.

   UNITS: inch (jab tak naam me MM na ho).
   ========================================================= */

(function () {

  "use strict";

  var D2R = Math.PI / 180;
  var EPS = 1e-9;


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
    return deg * D2R;
  }

  function radToDeg(rad) {
    return rad / D2R;
  }

  function inchToMM(inch) {
    return inch * 25.4;
  }

  function mmToInch(mm) {
    return mm / 25.4;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function extend(target, source) {
    for (var k in source) {
      if (Object.prototype.hasOwnProperty.call(source, k)) {
        target[k] = source[k];
      }
    }
    return target;
  }

  function safeId(v, fallback) {
    return v != null && String(v).trim()
      ? String(v)
      : fallback;
  }

  function isTrue(v) {
    return v === true || v === "true" || v === 1 || v === "1";
  }


  /* =========================================================
     VECTOR HELPERS (legacy 3D network ke liye)
     ========================================================= */

  function vec(x, y, z) {
    return { x: num(x), y: num(y), z: num(z) };
  }

  function add(a, b) {
    return vec(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  function sub(a, b) {
    return vec(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  function mul(a, s) {
    return vec(a.x * s, a.y * s, a.z * s);
  }

  function length3(a) {
    return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  }

  function normalize(a) {
    var l = length3(a);
    if (!l) { return vec(0, 0, 0); }
    return vec(a.x / l, a.y / l, a.z / l);
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function cross(a, b) {
    return vec(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }


  /* =========================================================
     SETTINGS
     ---------------------------------------------------------
     window.settings preferred (core.js). Purane naam bhi
     support hote hain.

     NAYE (optional) settings — agar settings page me nahi hain
     to defaults chalte hain, kuch tootta nahi:

       allowanceMode : "AS_ENTERED" (default) ya "SHOP"
           AS_ENTERED = sizes jaise daale waise hi (aap pehle se
                        1/8 ghata ke daalte ho)
           SHOP       = tool khud ghatata hai (finished size daalo)
       deduct90Inch  : 90 deg pe ghatana (default 1/8 = 0.125)
       doorGapInch   : door side pe extra gap (default 3/16)
       deductTable   : {"45":0.0625,"135":0.2} angle-wise apna number
     ========================================================= */

  function getSettings() {

    var source = null;

    if (window.settings) {
      source = window.settings;
    }

    if (!source && window.AppState && window.AppState.settings) {
      source = window.AppState.settings;
    }

    if (!source && window.state && window.state.settings) {
      source = window.state.settings;
    }

    source = source || {};

    var material =
      source.material === "SS202" ? "SS202" : "SS304";

    var thickness = clamp(num(source.thickness, 0.8), 0.1, 10);

    var radius = clamp(num(source.radius, 0.8), 0, 20);

    var kfactor = clamp(
      num(source.kfactor, material === "SS202" ? 0.45 : 0.44),
      0,
      1
    );

    var springback = clamp(num(source.springback, 0.5), 0, 20);

    var relief = clamp(num(source.relief, 1.6), 0, 50);

    var vdie = clamp(
      num(source.vdie != null ? source.vdie : source.vDie, 6),
      0.1,
      100
    );

    var mode =
      String(source.allowanceMode || source.shopMode || "AS_ENTERED")
        .toUpperCase() === "SHOP"
        ? "SHOP"
        : "AS_ENTERED";

    var table =
      source.deductTable && typeof source.deductTable === "object"
        ? source.deductTable
        : {};

    return {
      material: material,
      thickness: thickness,
      radius: radius,
      kfactor: kfactor,
      springback: springback,
      relief: relief,
      vdie: vdie,
      allowanceMode: mode,
      deduct90: clamp(
        num(
          source.deduct90Inch != null
            ? source.deduct90Inch
            : source.deduct90,
          0.125
        ),
        0,
        2
      ),
      doorGap: clamp(
        num(
          source.doorGapInch != null
            ? source.doorGapInch
            : source.doorGap,
          0.1875
        ),
        0,
        2
      ),
      deductTable: clone(table),
      hemAngle: 150
    };
  }


  /* =========================================================
     INPUT NORMALIZATION
     ========================================================= */

  function normalizeAngle(line) {

    var a = num(
      line && (line.angle != null ? line.angle : line.bendAngle),
      90
    );

    return clamp(a, 0, 180);
  }


  function normalizeDirection(line) {

    var v = line && (line.direction != null ? line.direction : line.bend);

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
      line.size != null ? line.size : line.sizeInch,
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

      /* optional flags (UI baad me jod sakta hai) */
      isDoor: isTrue(line.door) || isTrue(line.isDoor),
      isBaseHint: isTrue(line.base) || isTrue(line.isBase),

      original: clone(line)
    };
  }


  function normalizeLines(lines, side) {

    lines = Array.isArray(lines) ? lines : [];

    return lines.map(function (line, index) {
      return normalizeLine(line, side, index);
    });
  }


  /* =========================================================
     BEND ENGINE (theory, har angle)
     ---------------------------------------------------------
       RN = R + K x T
       BA = theta x RN
       SB = (R + T) x tan(theta/2)
       BD = 2 x SB - BA

     V6 NOTE: geometry ke liye angle = jo user ne diya
     (intended). Springback sirf press-brake ka setting hai:
       pressAngle = intended + springback
     ========================================================= */

  function estimateRadiusFromVDie(settings) {

    var t = settings.thickness;
    var estimated = settings.vdie * 0.16;

    if (estimated < t) {
      estimated = t;
    }

    return estimated;
  }


  function getEffectiveRadius(settings) {

    var userRadius = num(settings.radius, 0);

    if (userRadius > 0) {
      return userRadius;
    }

    return estimateRadiusFromVDie(settings);
  }


  function safeTanHalf(angleDeg) {
    return Math.tan(degToRad(Math.min(angleDeg, 179.5)) / 2);
  }


  function bendAllowance(angleDeg, radius, thickness, kfactor) {

    var theta = degToRad(clamp(angleDeg, 0, 180));

    return theta * (radius + (kfactor * thickness));
  }


  function bendDeduction(angleDeg, radius, thickness, kfactor) {

    var a = clamp(angleDeg, 0, 180);

    var ba = bendAllowance(a, radius, thickness, kfactor);

    var setback = (radius + thickness) * safeTanHalf(a);

    return (2 * setback) - ba;
  }


  function calculateBend(angle, direction, settings) {

    var intended = clamp(num(angle, 0), 0, 180);

    var radius = getEffectiveRadius(settings);
    var thickness = settings.thickness;
    var kfactor = settings.kfactor;

    var neutralRadius = radius + (kfactor * thickness);

    var ba = bendAllowance(intended, radius, thickness, kfactor);
    var bd = bendDeduction(intended, radius, thickness, kfactor);
    var setback = (radius + thickness) * safeTanHalf(intended);

    var pressAngle =
      intended > 0.01
        ? clamp(intended + settings.springback, 0, 180)
        : 0;

    return {

      intendedAngle: round(intended, 4),

      /* V6: geometry isi angle se chalti hai */
      effectiveAngle: round(intended, 4),

      pressAngle: round(pressAngle, 4),

      direction: direction,

      thicknessMM: round(thickness, 4),
      radiusMM: round(radius, 4),
      neutralRadiusMM: round(neutralRadius, 4),
      kfactor: round(kfactor, 4),
      vDieMM: round(settings.vdie, 4),

      bendAllowanceMM: round(ba, 4),
      bendAllowanceInch: round(mmToInch(ba), 6),

      setbackMM: round(setback, 4),
      setbackInch: round(mmToInch(setback), 6),

      bendDeductionMM: round(bd, 4),
      bendDeductionInch: round(mmToInch(bd), 6)
    };
  }


  /* =========================================================
     SHOP DEDUCTION (aapka rule, har angle pe)
     ---------------------------------------------------------
     90 deg pe aap 1/8 ghatate ho (deduct90).
     Dusre angle pe:
        1. deductTable me us angle ka number ho to wahi
        2. warna  deduct90 x  BD(angle) / BD(90)   (theory ratio)
     Door side pe upar se doorGap (3/16) alag se jud jata hai
     (gap angle pe depend nahi karta).
     ========================================================= */

  function shopDeduction(angle, isDoor, settings) {

    var a = clamp(num(angle, 0), 0, 180);

    var out = {
      bindingInch: 0,
      gapInch: 0,
      totalInch: 0,
      source: "NO_BEND",
      needsCheck: false
    };

    if (a <= 0.01) {
      return out;
    }

    var table = settings.deductTable || {};
    var key = String(Math.round(a * 100) / 100);
    var binding;

    if (
      table[key] != null &&
      Number.isFinite(parseFloat(table[key]))
    ) {

      binding = Math.max(0, parseFloat(table[key]));
      out.source = "TABLE";

    } else {

      var r = getEffectiveRadius(settings);
      var t = settings.thickness;
      var k = settings.kfactor;

      var aa = Math.min(a, settings.hemAngle);

      var ref = bendDeduction(90, r, t, k);
      var cur = bendDeduction(aa, r, t, k);

      var ratio = ref > EPS ? cur / ref : aa / 90;

      if (!Number.isFinite(ratio) || ratio < 0) {
        ratio = aa / 90;
      }

      binding = settings.deduct90 * ratio;
      out.source = "SCALED_FROM_90";

      if (a > settings.hemAngle) {
        out.source = "HEM_USE_SHOP_VALUE";
        out.needsCheck = true;
      }
    }

    out.bindingInch = round(binding, 5);
    out.gapInch = isDoor ? round(settings.doorGap, 5) : 0;
    out.totalInch = round(out.bindingInch + out.gapInch, 5);

    return out;
  }


  /* =========================================================
     LINE DATA
     ========================================================= */

  function createLineData(line, side, index, sequence, settings) {

    var bend = calculateBend(line.angle, line.direction, settings);

    var hasBend = index > 0 && bend.effectiveAngle > 0.01;

    var shop = hasBend
      ? shopDeduction(bend.effectiveAngle, line.isDoor, settings)
      : shopDeduction(0, false, settings);

    return {

      id: line.id,
      side: side,
      index: index,
      sequence: sequence,

      sizeInch: round16(line.sizeInch),
      sizeMM: round(line.sizeMM, 4),

      angle: bend.intendedAngle,
      effectiveAngle: bend.effectiveAngle,
      pressAngle: bend.pressAngle,
      direction: bend.direction,

      isDoor: !!line.isDoor,
      isBaseHint: !!line.isBaseHint,

      bendAllowanceMM: bend.bendAllowanceMM,
      bendAllowanceInch: bend.bendAllowanceInch,
      setbackMM: bend.setbackMM,
      setbackInch: bend.setbackInch,
      bendDeductionMM: bend.bendDeductionMM,
      bendDeductionInch: bend.bendDeductionInch,
      neutralRadiusMM: bend.neutralRadiusMM,
      thicknessMM: bend.thicknessMM,
      radiusMM: bend.radiusMM,
      kfactor: bend.kfactor,
      vDieMM: bend.vDieMM,

      /* shop rule (SHOP mode me lagta hai, AS_ENTERED me sirf suggestion) */
      shopDeductionInch: shop.totalInch,
      shopBindingInch: shop.bindingInch,
      shopDoorGapInch: shop.gapInch,
      shopDeductionSource: shop.source,
      needsCheck: shop.needsCheck,

      original: clone(line.original)
    };
  }


  /* =========================================================
     MARKING POSITIONS
     ---------------------------------------------------------
     Line i ka bend us line ke SHURU me hai:
        bendCenterInch = startInch      (agar bend hai)
        bendCenterInch = 0              (pehli line / no-bend;
                                         flat.js 0 wali line skip
                                         karta hai)
     ========================================================= */

  function buildSidePositions(lines, settings) {

    var running = 0;
    var result = [];

    lines.forEach(function (line) {

      var hasBend =
        line.index > 0 && line.effectiveAngle > 0.01;

      var applied =
        settings.allowanceMode === "SHOP" && hasBend
          ? line.shopDeductionInch
          : 0;

      var mark = Math.max(0, line.sizeInch - applied);

      var start = running;
      var end = running + mark;

      result.push(
        extend(
          extend({}, line),
          {
            startInch: round(start, 6),
            endInch: round(end, 6),

            markSizeInch: round(mark, 6),
            markSizeMM: round(inchToMM(mark), 4),
            appliedDeductionInch: round(applied, 6),

            rawBoundaryInch: round(end, 6),
            developedBoundaryInch: round(end, 6),

            bendCenterInch: hasBend ? round(start, 6) : 0,

            isBend: hasBend
          }
        )
      );

      running = end;
    });

    /* mm aur "doosre kinare se" ki doori (marking ke liye) */
    result.forEach(function (r) {

      r.startMM = round(inchToMM(r.startInch), 4);
      r.endMM = round(inchToMM(r.endInch), 4);

      r.bendCenterMM = r.isBend ? r.startMM : 0;

      r.bendFromEndInch = r.isBend
        ? round(running - r.startInch, 6)
        : 0;

      r.bendFromEndMM = r.isBend
        ? round(inchToMM(running - r.startInch), 4)
        : 0;
    });

    return {
      totalInch: round(running, 6),
      totalMM: round(inchToMM(running), 4),
      lines: result
    };
  }


  function buildFlatNetwork(lengthLines, depthLines, settings) {

    var length = buildSidePositions(lengthLines, settings);
    var depth = buildSidePositions(depthLines, settings);

    return {

      lengthInch: length.totalInch,
      depthInch: depth.totalInch,

      lengthMM: length.totalMM,
      depthMM: depth.totalMM,

      lengthLines: length.lines,
      depthLines: depth.lines,

      totalLength: length.totalInch,
      totalDepth: depth.totalInch
    };
  }


  /* =========================================================
     SEGMENTS
     ---------------------------------------------------------
     Line = flange. Agar kisi line ka bend 0 hai to wo pichli
     line ke saath ek hi seedha segment ban jati hai.
     ========================================================= */

  function buildSegments(posLines) {

    var segs = [];

    posLines.forEach(function (l, idx) {

      if (idx === 0 || l.isBend || !segs.length) {

        segs.push({
          ids: [l.id],
          idx: [idx],
          bendAngle: idx === 0 ? 0 : l.effectiveAngle,
          bendDirection: l.direction,
          flatStart: l.startInch,
          flatEnd: l.endInch,
          flatSize: l.markSizeInch,
          foldSize: l.sizeInch,
          hint: !!l.isBaseHint
        });

      } else {

        var s = segs[segs.length - 1];

        s.ids.push(l.id);
        s.idx.push(idx);
        s.flatEnd = l.endInch;
        s.flatSize = round(s.flatSize + l.markSizeInch, 6);
        s.foldSize = round(s.foldSize + l.sizeInch, 6);
        s.hint = s.hint || !!l.isBaseHint;
      }
    });

    return segs;
  }


  function pickBase(segs) {

    var best = -1;
    var i;

    for (i = 0; i < segs.length; i++) {
      if (segs[i].hint) { return i; }
    }

    for (i = 0; i < segs.length; i++) {
      if (best < 0 || segs[i].foldSize > segs[best].foldSize + EPS) {
        best = i;
      }
    }

    return best;
  }


  /* =========================================================
     CHAIN (base se bahar ki taraf flanges)
     ---------------------------------------------------------
     Finished piece, finish side upar (+z).
     UP bend   -> flange neeche ghumti hai (phi ghatta hai)
     DOWN bend -> flange upar ghumti hai   (phi badhta hai)
     phi = flange ki disha (plate ko bahar continue karna = 0).

     Base ke dono taraf:
       right (+1): bend wahi jo us segment ka apna (start) bend
       left  (-1): bend wahi jo andar wale padosi segment ka
                   (kyunki bend ek line ke shuru me hota hai)
     ========================================================= */

  function buildChain(segs, base, side) {

    var out = {};
    var o = 0;
    var z = 0;
    var phi = 0;

    for (var i = base + side; i >= 0 && i < segs.length; i += side) {

      var carrier = side > 0 ? segs[i] : segs[i + 1];

      var turn =
        carrier.bendAngle *
        (carrier.bendDirection === "down" ? 1 : -1);

      phi += turn * D2R;

      var len = segs[i].foldSize;

      var o1 = o + len * Math.cos(phi);
      var z1 = z + len * Math.sin(phi);

      out[i] = {
        index: i,
        o0: o, z0: z,
        o1: o1, z1: z1,
        phi: phi,
        len: len,
        out: Math.cos(phi),
        zc: Math.sin(phi),
        bendAngle: carrier.bendAngle,
        bendDirection: carrier.bendDirection
      };

      o = o1;
      z = z1;
    }

    return out;
  }


  /* =========================================================
     MITER MATH
     ---------------------------------------------------------
     Corner pe do flange (L aur D) ke kinare ek hi line (hip)
     pe milne chahiye. Canonical frame:
        base plate x>=0, y>=0 ; corner region x<0, y<0
        L flange direction a_L = (ax, 0, az) , D: a_D = (0, by, bz)
        L kinara : (s, eta = -k s)    D kinara : (xi = -m t, t)
        3D me barabar hone ki shart se:
              k = -az*by / bz
              m = -ax*bz / az
     aL, aD = [out, z]  (out = plate ko bahar continue karne wala
     hissa = cos(bend), z = ooncha-neecha)

     90/90  -> k = m = 0 -> poora corner kat jata hai
     45/45  -> kinare 35.3 aur 54.7 deg pe
     ========================================================= */

  function miter(aL, aD) {

    var ax = -aL[0];
    var az = aL[1];
    var by = -aD[0];
    var bz = aD[1];

    var res = {
      valid: false,
      full: false,
      note: "",
      k: 0,
      m: 0,
      edgeDegL: 0,
      edgeDegD: 90,
      wedgeDeg: 90
    };

    if (Math.abs(az) < 1e-7 || Math.abs(bz) < 1e-7) {
      res.note = "NO_BEND_OR_HEM_CHECK";
      return res;
    }

    if (az * bz < 0) {
      res.valid = true;
      res.full = true;
      res.note = "OPPOSITE_SIDES_FULL_CORNER";
      return res;
    }

    var k = -az * by / bz;
    var m = -ax * bz / az;

    res.k = k;
    res.m = m;
    res.edgeDegL = radToDeg(Math.atan(k));
    res.edgeDegD = 90 - radToDeg(Math.atan(m));
    res.wedgeDeg = res.edgeDegD - res.edgeDegL;
    res.valid = true;

    res.note =
      (k < -1e-9 || m < -1e-9)
        ? "OBTUSE_LEANS_OVER_PLATE_CHECK"
        : "OK";

    return res;
  }


  /* kinare ki extension: (s, e) points, s = flange ke saath doori,
     e = corner ki taraf nikla hua hissa (negative = trim) */
  function extPoints(k, sw, tw) {

    if (!(sw > EPS)) {
      return [[0, 0]];
    }

    if (k >= 0 && k * sw > tw + EPS) {
      return [[0, 0], [tw / k, tw], [sw, tw]];
    }

    return [[0, 0], [sw, k * sw]];
  }


  function flatExtPoints(ext) {
    return ext;
  }


  /* Sutherland-Hodgman: A*x + B*y + C >= 0 wala hissa rakho */
  function clipHalfPlane(poly, A, B, C) {

    var out = [];
    var n = poly.length;

    for (var i = 0; i < n; i++) {

      var p = poly[i];
      var q = poly[(i + 1) % n];

      var fp = A * p[0] + B * p[1] + C;
      var fq = A * q[0] + B * q[1] + C;

      if (fp >= -EPS) { out.push(p); }

      if ((fp >= -EPS) !== (fq >= -EPS)) {
        var t = fp / (fp - fq);
        out.push([
          p[0] + t * (q[0] - p[0]),
          p[1] + t * (q[1] - p[1])
        ]);
      }
    }

    return out;
  }


  function polyArea(poly) {

    var a = 0;

    for (var i = 0; i < poly.length; i++) {
      var p = poly[i];
      var q = poly[(i + 1) % poly.length];
      a += p[0] * q[1] - q[0] * p[1];
    }

    return Math.abs(a) / 2;
  }


  function dedupePoly(poly) {

    var out = [];

    poly.forEach(function (p) {

      var last = out[out.length - 1];

      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-6) {
        out.push(p);
      }
    });

    while (
      out.length > 1 &&
      Math.hypot(
        out[0][0] - out[out.length - 1][0],
        out[0][1] - out[out.length - 1][1]
      ) <= 1e-6
    ) {
      out.pop();
    }

    return out;
  }


  function rectPoly(u0, u1, v0, v1) {

    var a = Math.min(u0, u1);
    var b = Math.max(u0, u1);
    var c = Math.min(v0, v1);
    var d = Math.max(v0, v1);

    return [[a, c], [b, c], [b, d], [a, d]];
  }


  /* =========================================================
     FOLD MODEL (3D finished shape)
     ---------------------------------------------------------
     World frame (finish side upar):
        x : length direction, base [0, W]
        y : depth direction,  base [0, H]  (flat ka v ulta:
            y = H - (v - vBaseStart))
        z : upar (+)
     ========================================================= */

  function buildFold(flat, settings) {

    var L = buildSegments(flat.lengthLines);
    var D = buildSegments(flat.depthLines);

    var empty = {
      version: "FOLD_V1",
      valid: false,
      reason: "NEEDS_BOTH_SIDES",
      panels: [],
      corners: [],
      profiles: { length: [], depth: [] },
      lengthSegments: L,
      depthSegments: D
    };

    if (!L.length || !D.length) {
      return empty;
    }

    var bl = pickBase(L);
    var bd = pickBase(D);

    var W = L[bl].foldSize;
    var H = D[bd].foldSize;

    var chL = {
      "-1": buildChain(L, bl, -1),
      "1": buildChain(L, bl, 1)
    };

    var chD = {
      "-1": buildChain(D, bd, -1),
      "1": buildChain(D, bd, 1)
    };


    /* ---------- world mapping helpers ---------- */

    function xOf(sideL, o) {
      return sideL > 0 ? W + o : -o;
    }

    function yOf(sideD, o) {
      return sideD > 0 ? -o : H + o;
    }


    /* ---------- corners ---------- */

    var corners = [];
    var cornerMap = {};

    [-1, 1].forEach(function (sL) {
      [-1, 1].forEach(function (sD) {

        var iL = bl + sL;
        var jD = bd + sD;

        if (iL < 0 || iL >= L.length) { return; }
        if (jD < 0 || jD >= D.length) { return; }

        var cL = chL[String(sL)][iL];
        var cD = chD[String(sD)][jD];

        var aL = [cL.out, cL.zc];
        var aD = [cD.out, cD.zc];

        var m = miter(aL, aD);

        var mode =
          m.valid && !m.full ? "MITER" : "FULL";

        var needsCheck =
          m.note === "NO_BEND_OR_HEM_CHECK" ||
          m.note === "OBTUSE_LEANS_OVER_PLATE_CHECK";

        var reason;

        if (m.note === "OPPOSITE_SIDES_FULL_CORNER") {
          reason = "OPPOSITE_SIDES_FULL_CORNER";
        } else if (m.note === "NO_BEND_OR_HEM_CHECK") {
          reason = "HEM_OR_FLAT_CHECK";
        } else if (m.note === "OBTUSE_LEANS_OVER_PLATE_CHECK") {
          reason = "OBTUSE_LEANS_OVER_PLATE_CHECK";
        } else {
          reason = "MITER_SAME_SIDE";
        }

        var corner = {
          id: "CORNER_" + L[iL].ids[0] + "_" + D[jD].ids[0],
          sideL: sL,
          sideD: sD,
          adjL: iL,
          adjD: jD,
          lengthId: L[iL].ids[0],
          depthId: D[jD].ids[0],
          aL: aL,
          aD: aD,
          sw: cL.len,
          tw: cD.len,
          miter: m,
          mode: mode,
          reason: reason,
          needsCheck: needsCheck
        };

        corner.gapInch = cornerGap(corner);

        if (corner.gapInch > 1e-6) {
          corner.needsCheck = true;
        }

        corners.push(corner);
        cornerMap[sL + "," + sD] = corner;
      });
    });


    /* hip line pe dono kinare ke 3D points ka farak (0 hona chahiye) */
    function cornerGap(c) {

      if (c.mode !== "MITER") { return 0; }

      var worst = 0;

      for (var n = 1; n <= 8; n++) {

        var s = c.sw * n / 8;

        var az = c.aL[1];
        var bz = c.aD[1];

        var t = s * az / bz;

        var eL = c.miter.k * s;
        var eD = c.miter.m * t;

        var PL = [
          xOf(c.sideL, s * c.aL[0]),
          yOf(c.sideD, eL),
          s * az
        ];

        var PD = [
          xOf(c.sideL, eD),
          yOf(c.sideD, t * c.aD[0]),
          t * bz
        ];

        worst = Math.max(
          worst,
          Math.hypot(PL[0] - PD[0], PL[1] - PD[1], PL[2] - PD[2])
        );
      }

      return round(worst, 9);
    }


    /* hip line ka end-point (dono flange ke andar rehta hua) */
    function hipWorld(c) {

      var origin = [xOf(c.sideL, 0), yOf(c.sideD, 0), 0];

      if (c.mode !== "MITER") {
        return { origin: origin, hipEnd: null };
      }

      var az = c.aL[1];
      var bz = c.aD[1];
      var k = c.miter.k;
      var m = c.miter.m;

      var smax = c.sw;

      smax = Math.min(smax, c.tw * bz / az);

      if (k > EPS) { smax = Math.min(smax, c.tw / k); }

      if (m > EPS) { smax = Math.min(smax, c.sw * bz / (m * az)); }

      smax = Math.max(0, smax);

      return {
        origin: origin,
        hipEnd: [
          xOf(c.sideL, smax * c.aL[0]),
          yOf(c.sideD, k * smax),
          smax * az
        ]
      };
    }

    /* ---------- panels ---------- */

    var panels = [];

    panels.push({
      id: "P_BASE",
      kind: "BASE",
      lengthId: L[bl].ids[0],
      depthId: D[bd].ids[0],
      finishNormal: [0, 0, 1],
      polygon: [
        [0, 0, 0],
        [W, 0, 0],
        [W, H, 0],
        [0, H, 0]
      ]
    });

    function extFor(corner, which) {

      if (!corner || corner.mode !== "MITER") {
        return [[0, 0]];
      }

      return which === "L"
        ? extPoints(corner.miter.k, corner.sw, corner.tw)
        : extPoints(corner.miter.m, corner.tw, corner.sw);
    }

    /* L flanges (base ke left / right) */
    [-1, 1].forEach(function (sL) {

      var chain = chL[String(sL)];

      Object.keys(chain).forEach(function (key) {

        var i = parseInt(key, 10);
        var c = chain[i];

        var poly = [];

        if (i === bl + sL) {

          /* adjacent flange: corner extension ke saath */
          var cA = cornerMap[sL + ",1"];   /* y = 0 end  */
          var cB = cornerMap[sL + ",-1"];  /* y = H end  */

          var A = extFor(cA, "L");
          var B = extFor(cB, "L");

          /* sw ka poora point chahiye (s = sw) agar extension nahi */
          if (A.length === 1) { A = [[0, 0], [c.len, 0]]; }
          if (B.length === 1) { B = [[0, 0], [c.len, 0]]; }

          A.forEach(function (p) {
            poly.push([
              xOf(sL, p[0] * c.out),
              yOf(1, p[1]),
              p[0] * c.zc
            ]);
          });

          for (var q = B.length - 1; q >= 0; q--) {
            poly.push([
              xOf(sL, B[q][0] * c.out),
              yOf(-1, B[q][1]),
              B[q][0] * c.zc
            ]);
          }

        } else {

          poly = [
            [xOf(sL, c.o0), 0, c.z0],
            [xOf(sL, c.o1), 0, c.z1],
            [xOf(sL, c.o1), H, c.z1],
            [xOf(sL, c.o0), H, c.z0]
          ];
        }

        panels.push({
          id: "P_" + L[i].ids[0],
          kind: "L_FLANGE",
          lengthId: L[i].ids[0],
          depthId: D[bd].ids[0],
          finishNormal: [
            round(sL > 0 ? -Math.sin(c.phi) : Math.sin(c.phi), 6),
            0,
            round(Math.cos(c.phi), 6)
          ],
          polygon: poly
        });
      });
    });

    /* D flanges (base ke aage / peeche) */
    [-1, 1].forEach(function (sD) {

      var chain = chD[String(sD)];

      Object.keys(chain).forEach(function (key) {

        var j = parseInt(key, 10);
        var c = chain[j];

        var poly = [];

        if (j === bd + sD) {

          var cA = cornerMap["-1," + sD];  /* x = 0 end */
          var cB = cornerMap["1," + sD];   /* x = W end */

          var A = extFor(cA, "D");
          var B = extFor(cB, "D");

          if (A.length === 1) { A = [[0, 0], [c.len, 0]]; }
          if (B.length === 1) { B = [[0, 0], [c.len, 0]]; }

          A.forEach(function (p) {
            poly.push([
              xOf(-1, p[1]),
              yOf(sD, p[0] * c.out),
              p[0] * c.zc
            ]);
          });

          for (var q = B.length - 1; q >= 0; q--) {
            poly.push([
              xOf(1, B[q][1]),
              yOf(sD, B[q][0] * c.out),
              B[q][0] * c.zc
            ]);
          }

        } else {

          poly = [
            [0, yOf(sD, c.o0), c.z0],
            [0, yOf(sD, c.o1), c.z1],
            [W, yOf(sD, c.o1), c.z1],
            [W, yOf(sD, c.o0), c.z0]
          ];
        }

        panels.push({
          id: "P_" + D[j].ids[0],
          kind: "D_FLANGE",
          lengthId: L[bl].ids[0],
          depthId: D[j].ids[0],
          finishNormal: [
            0,
            round(sD > 0 ? Math.sin(c.phi) : -Math.sin(c.phi), 6),
            round(Math.cos(c.phi), 6)
          ],
          polygon: poly
        });
      });
    });


    /* ---------- cross-section profiles ---------- */

    var profL = [];
    var profD = [];

    profL.push({
      id: L[bl].ids[0],
      a: [0, 0],
      b: [W, 0],
      base: true
    });

    [-1, 1].forEach(function (sL) {
      var chain = chL[String(sL)];
      Object.keys(chain).forEach(function (key) {
        var i = parseInt(key, 10);
        var c = chain[i];
        profL.push({
          id: L[i].ids[0],
          a: [round(xOf(sL, c.o0), 5), round(c.z0, 5)],
          b: [round(xOf(sL, c.o1), 5), round(c.z1, 5)],
          base: false
        });
      });
    });

    profD.push({
      id: D[bd].ids[0],
      a: [0, 0],
      b: [H, 0],
      base: true
    });

    [-1, 1].forEach(function (sD) {
      var chain = chD[String(sD)];
      Object.keys(chain).forEach(function (key) {
        var j = parseInt(key, 10);
        var c = chain[j];
        profD.push({
          id: D[j].ids[0],
          a: [round(yOf(sD, c.o0), 5), round(c.z0, 5)],
          b: [round(yOf(sD, c.o1), 5), round(c.z1, 5)],
          base: false
        });
      });
    });


    /* ---------- bounds ---------- */

    var mn = [Infinity, Infinity, Infinity];
    var mx = [-Infinity, -Infinity, -Infinity];

    panels.forEach(function (p) {
      p.polygon = p.polygon.map(function (pt) {
        return [round(pt[0], 5), round(pt[1], 5), round(pt[2], 5)];
      });
      p.polygon.forEach(function (pt) {
        for (var a = 0; a < 3; a++) {
          mn[a] = Math.min(mn[a], pt[a]);
          mx[a] = Math.max(mx[a], pt[a]);
        }
      });
    });


    return {

      version: "FOLD_V1",
      valid: true,
      note: "finish side upar; sharp bend (motai/radius nahi); inch",

      widthInch: round(W, 5),
      heightInch: round(H, 5),

      baseLengthSegment: bl,
      baseDepthSegment: bd,
      baseLengthId: L[bl].ids[0],
      baseDepthId: D[bd].ids[0],

      lengthSegments: L,
      depthSegments: D,

      panels: panels,

      corners: corners.map(function (c) {
        return {
          id: c.id,
          lengthId: c.lengthId,
          depthId: c.depthId,
          sideL: c.sideL,
          sideD: c.sideD,
          mode: c.mode,
          reason: c.reason,
          needsCheck: c.needsCheck,
          gapInch: c.gapInch,
          world: (function () {
            var w = hipWorld(c);
            return {
              origin: w.origin.map(function (v) { return round(v, 5); }),
              hipEnd: w.hipEnd
                ? w.hipEnd.map(function (v) { return round(v, 5); })
                : null
            };
          })(),
          miter: {
            valid: c.miter.valid,
            full: c.miter.full,
            note: c.miter.note,
            k: round(c.miter.k, 6),
            m: round(c.miter.m, 6),
            edgeDegL: round(c.miter.edgeDegL, 3),
            edgeDegD: round(c.miter.edgeDegD, 3),
            wedgeDeg: round(c.miter.wedgeDeg, 3)
          }
        };
      }),

      _corners: corners,

      profiles: { length: profL, depth: profD },

      bounds: {
        min: mn.map(function (v) { return round(v, 5); }),
        max: mx.map(function (v) { return round(v, 5); })
      }
    };
  }


  /* =========================================================
     CUTS (flat sheet pe, marking inch me)
     ---------------------------------------------------------
     Har base-corner pe ek cut. Cut = region jo katna hai:
        polygons : [[ [u,v], ... ], ...]   (u = length, v = depth)
     Purane flat.js ke liye xInch / yInch / widthInch / depthInch
     poore corner block ka bounding box dete hain.
     ========================================================= */

  /* =========================================================
     CUT MARKS (flat pe cut ka naap, inch + mm dono)
     ---------------------------------------------------------
     Har cut ke liye: origin (corner jahan bend lines milti hain),
     har point ka sheet ke kinaron se fasla, aur har edge ki
     lambai + angle. flat.js sirf inko dikhata hai.
     angleDeg = u-axis (length direction, yaani depth bend line)
     se angle.
     ========================================================= */

  function m2(v) {
    return { inch: round(v, 5), mm: round(inchToMM(v), 3) };
  }

  function letterFor(n) {

    var s = "";
    n = n + 1;

    while (n > 0) {
      var r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }

    return s;
  }

  function buildCutMarks(polygons, kinds, ou, ov, W, H) {

    var pts = [];

    function labelOf(u, v) {

      if (Math.hypot(u - ou, v - ov) < 1e-6) { return "O"; }

      for (var i = 0; i < pts.length; i++) {
        if (Math.hypot(pts[i].u - u, pts[i].v - v) < 1e-6) {
          return pts[i].label;
        }
      }

      var label = letterFor(pts.length);

      pts.push({ label: label, u: u, v: v });

      return label;
    }

    var polys = polygons.map(function (poly, idx) {

      var labels = poly.map(function (p) { return labelOf(p[0], p[1]); });

      var edges = [];

      for (var i = 0; i < poly.length; i++) {

        var p = poly[i];
        var q = poly[(i + 1) % poly.length];

        var du = Math.abs(q[0] - p[0]);
        var dv = Math.abs(q[1] - p[1]);
        var len = Math.hypot(du, dv);

        if (len < 1e-6) { continue; }

        edges.push({
          from: labels[i],
          to: labels[(i + 1) % poly.length],
          length: m2(len),
          axis: dv < 1e-6 ? "U" : (du < 1e-6 ? "V" : null),
          angleDeg: round(radToDeg(Math.atan2(dv, du)), 3)
        });
      }

      var us = poly.map(function (p) { return p[0]; });
      var vs = poly.map(function (p) { return p[1]; });

      return {
        kind: kinds[idx] || "CELL",
        points: labels,
        edges: edges,
        width: m2(Math.max.apply(null, us) - Math.min.apply(null, us)),
        height: m2(Math.max.apply(null, vs) - Math.min.apply(null, vs))
      };
    });

    var all = [{ label: "O", u: ou, v: ov }].concat(pts).map(function (p) {

      return {
        label: p.label,
        u: m2(p.u),
        v: m2(p.v),
        fromLeft: m2(p.u),
        fromRight: m2(W - p.u),
        fromTop: m2(p.v),
        fromBottom: m2(H - p.v),
        du: m2(Math.abs(p.u - ou)),
        dv: m2(Math.abs(p.v - ov))
      };
    });

    return {
      origin: all[0],
      points: all,
      polygons: polys
    };
  }


  function buildCuts(fold, flat) {

    var cuts = [];

    if (!fold || !fold.valid) { return cuts; }

    var L = fold.lengthSegments;
    var D = fold.depthSegments;

    var bl = fold.baseLengthSegment;
    var bd = fold.baseDepthSegment;

    var firstU = L[0].flatStart;
    var lastU = L[L.length - 1].flatEnd;
    var firstV = D[0].flatStart;
    var lastV = D[D.length - 1].flatEnd;

    fold._corners.forEach(function (c) {

      var sL = c.sideL;
      var sD = c.sideD;

      var uc = sL < 0 ? L[bl].flatStart : L[bl].flatEnd;
      var vc = sD < 0 ? D[bd].flatStart : D[bd].flatEnd;

      var uOut = sL < 0 ? firstU : lastU;
      var vOut = sD < 0 ? firstV : lastV;

      var block = rectPoly(uc, uOut, vc, vOut);

      var polygons = [];
      var kinds = [];

      function toFlat(s, t) {
        return [round(uc + sL * s, 6), round(vc + sD * t, 6)];
      }

      var fullBlock =
        c.mode !== "MITER" ||
        (Math.abs(c.miter.k) < 1e-9 && Math.abs(c.miter.m) < 1e-9);

      if (fullBlock) {

        polygons.push(block);
        kinds.push("BLOCK");

      } else {

        var sw = L[c.adjL].flatSize;
        var tw = D[c.adjD].flatSize;

        var k = c.miter.k;
        var m = c.miter.m;

        /* wedge: adjacent cell me jo kat-na hai */
        var wedge = [[0, 0], [sw, 0], [sw, tw], [0, tw]];

        wedge = clipHalfPlane(wedge, -k, 1, 0);   /* t - k s >= 0 */

        if (wedge.length) {
          wedge = clipHalfPlane(wedge, 1, -m, 0); /* s - m t >= 0 */
        }

        if (wedge.length >= 3 && polyArea(wedge) > 1e-9) {
          polygons.push(
            wedge.map(function (p) { return toFlat(p[0], p[1]); })
          );
          kinds.push("WEDGE");
        }

        /* obtuse: flange apni hi patti me trim hoti hai */
        if (k < -1e-9) {
          polygons.push(
            [[0, 0], [sw, 0], [sw, k * sw]]
              .map(function (p) { return toFlat(p[0], p[1]); })
          );
          kinds.push("TRIM");
        }

        if (m < -1e-9) {
          polygons.push(
            [[0, 0], [0, tw], [m * tw, tw]]
              .map(function (p) { return toFlat(p[0], p[1]); })
          );
          kinds.push("TRIM");
        }

        /* baaki (door ke) flanges ke corner cells poore kat-te hain */
        var iFrom = sL < 0 ? 0 : c.adjL;
        var iTo = sL < 0 ? c.adjL : L.length - 1;
        var jFrom = sD < 0 ? 0 : c.adjD;
        var jTo = sD < 0 ? c.adjD : D.length - 1;

        for (var i = iFrom; i <= iTo; i++) {
          for (var j = jFrom; j <= jTo; j++) {

            if (i === c.adjL && j === c.adjD) { continue; }

            polygons.push(
              rectPoly(
                L[i].flatStart, L[i].flatEnd,
                D[j].flatStart, D[j].flatEnd
              )
            );
            kinds.push("CELL");
          }
        }
      }

      var cleanedPolys = [];
      var cleanedKinds = [];

      polygons.forEach(function (p, i) {

        var q = dedupePoly(p);

        if (q.length >= 3) {
          cleanedPolys.push(q);
          cleanedKinds.push(kinds[i]);
        }
      });

      polygons = cleanedPolys;
      kinds = cleanedKinds;

      var bx0 = Math.min(uc, uOut);
      var bx1 = Math.max(uc, uOut);
      var by0 = Math.min(vc, vOut);
      var by1 = Math.max(vc, vOut);

      var wInch = bx1 - bx0;
      var dInch = by1 - by0;

      var type =
        c.mode === "MITER" && c.miter.wedgeDeg < 89.99
          ? "MITER_CUT"
          : "CUP_CUT";

      cuts.push({

        id: "CUT_" + c.lengthId + "_" + c.depthId,

        lengthId: c.lengthId,
        depthId: c.depthId,

        required: true,

        type: type,
        orientation: "CORNER",

        reason: c.reason,
        needsCheck: c.needsCheck,

        corner: {
          lengthSide: sL < 0 ? "LEFT" : "RIGHT",
          depthSide: sD < 0 ? "NEAR" : "FAR"
        },

        /* miter ki asli details (cut-line angle) */
        miter: {
          mode: c.mode,
          lengthEdgeDeg: round(c.miter.edgeDegL, 3),
          depthEdgeDeg: round(c.miter.edgeDegD, 3),
          wedgeDeg: round(c.miter.wedgeDeg, 3),
          k: round(c.miter.k, 6),
          m: round(c.miter.m, 6),
          closureGapInch: c.gapInch
        },

        polygons: polygons,
        kinds: kinds,

        /* flat pe dikhane ka naap (inch + mm) */
        marks: buildCutMarks(
          polygons,
          kinds,
          uc,
          vc,
          flat.lengthInch,
          flat.depthInch
        ),

        /* purane consumers ke liye (bounding box) */
        xInch: round(bx0, 6),
        yInch: round(by0, 6),
        xMM: round(inchToMM(bx0), 4),
        yMM: round(inchToMM(by0), 4),

        widthInch: round(wInch, 6),
        depthInch: round(dInch, 6),
        widthMM: round(inchToMM(wInch), 4),
        depthMM: round(inchToMM(dInch), 4),

        replacesBendLine: true,
        hidden: false,
        physical: true,

        _block: [bx0, bx1, by0, by1]
      });
    });

    return cuts;
  }


  /* =========================================================
     INTERSECTIONS (har L bend line x D bend line)
     ---------------------------------------------------------
     required = true  -> ye point kisi cut ke andar hai
     (flat.js aise point pe alag peela marker nahi banata)
     ========================================================= */

  function buildIntersections(flat, cuts) {

    var intersections = [];

    flat.lengthLines.forEach(function (l) {

      if (!l.isBend) { return; }

      flat.depthLines.forEach(function (d) {

        if (!d.isBend) { return; }

        var x = l.bendCenterInch;
        var y = d.bendCenterInch;

        var cutId = null;

        cuts.forEach(function (c) {

          var b = c._block;

          if (
            x >= b[0] - 1e-6 && x <= b[1] + 1e-6 &&
            y >= b[2] - 1e-6 && y <= b[3] + 1e-6
          ) {
            cutId = c.id;
          }
        });

        intersections.push({

          id: "INT_" + l.id + "_" + d.id,

          lengthId: l.id,
          depthId: d.id,

          xInch: round(x, 6),
          yInch: round(y, 6),
          xMM: round(inchToMM(x), 4),
          yMM: round(inchToMM(y), 4),

          lengthAngle: l.effectiveAngle,
          depthAngle: d.effectiveAngle,
          lengthDirection: l.direction,
          depthDirection: d.direction,

          required: !!cutId,
          hasCut: !!cutId,
          cutId: cutId,

          interaction: {
            required: !!cutId,
            reason: cutId ? "INSIDE_CORNER_CUT" : "NO_CUT_NEEDED"
          }
        });
      });
    });

    return intersections;
  }


  /* =========================================================
     LEGACY: calculateInteraction (do lines ka pair)
     V6 me miter math se
     ========================================================= */

  function flangeVec(angle, direction) {

    var a = degToRad(clamp(num(angle, 0), 0, 180));

    return [Math.cos(a), (direction === "down" ? 1 : -1) * Math.sin(a)];
  }


  function calculateInteraction(lengthLine, depthLine) {

    var m = miter(
      flangeVec(lengthLine.effectiveAngle, lengthLine.direction),
      flangeVec(depthLine.effectiveAngle, depthLine.direction)
    );

    return {
      required: m.valid,
      reason: m.note,
      angleDifference: round(
        Math.abs(lengthLine.effectiveAngle - depthLine.effectiveAngle),
        4
      ),
      totalAngle: round(
        lengthLine.effectiveAngle + depthLine.effectiveAngle,
        4
      ),
      directionConflict: lengthLine.direction !== depthLine.direction,
      miter: m
    };
  }


  /* legacy: bend zone (purane code me export tha) */
  function calculateBendZone(line, settings) {

    var radius = getEffectiveRadius(settings);
    var thickness = settings.thickness;
    var relief = settings.relief;

    var angle = clamp(line.effectiveAngle, 0, 180);

    var width = Math.max(
      (radius + thickness) * 2 * Math.sin(degToRad(angle / 2)),
      relief
    );

    return {
      widthMM: round(width, 4),
      depthMM: round(Math.max(relief, thickness), 4),
      radiusMM: round(radius, 4),
      thicknessMM: round(thickness, 4),
      reliefMM: round(relief, 4),
      angle: angle
    };
  }


  /* =========================================================
     LEGACY 3D NETWORK (purana skeleton, 3d.js ke liye)
     ========================================================= */

  function rotateAroundAxis(vector, axis, angleRad) {

    axis = normalize(axis);

    var c = Math.cos(angleRad);
    var s = Math.sin(angleRad);

    return add(
      add(mul(vector, c), mul(cross(axis, vector), s)),
      mul(axis, dot(axis, vector) * (1 - c))
    );
  }


  function directionForBend(previous, side, bend) {

    var baseAxis;
    var normal;

    if (side === "length") {
      baseAxis = previous ? previous.axis : vec(1, 0, 0);
    } else {
      baseAxis = previous ? previous.axis : vec(0, 1, 0);
    }

    normal = previous ? previous.normal : vec(0, 0, 1);

    var angle = degToRad(bend.effectiveAngle);

    if (bend.direction === "down") {
      angle = -angle;
    }

    return {
      axis: normalize(baseAxis),
      normal: normalize(rotateAroundAxis(normal, baseAxis, angle))
    };
  }


  function build3DNetwork(lengthLines, depthLines, settings) {

    var records = [];
    var previous = null;
    var sequence = 1;

    function addSide(lines, side) {

      lines.forEach(function (line) {

        var bend = calculateBend(line.angle, line.direction, settings);

        var orientation = directionForBend(previous, side, bend);

        var start = previous ? clone(previous.end) : vec(0, 0, 0);

        var axis = orientation.axis;

        var end = add(start, mul(axis, inchToMM(line.sizeInch)));

        var record = {
          id: line.id,
          side: side,
          index: line.index,
          sequence: sequence++,
          start: start,
          end: end,
          axis: axis,
          normal: orientation.normal,
          sizeInch: line.sizeInch,
          sizeMM: line.sizeMM,
          angle: line.angle,
          effectiveAngle: line.effectiveAngle,
          direction: line.direction,
          radiusMM: bend.radiusMM,
          thicknessMM: bend.thicknessMM,
          bendAllowanceMM: bend.bendAllowanceMM,
          bendDeductionMM: bend.bendDeductionMM,
          setbackMM: bend.setbackMM
        };

        records.push(record);

        previous = record;
      });
    }

    addSide(lengthLines, "length");
    addSide(depthLines, "depth");

    return {
      version: "MASTER_NETWORK_V5_LEGACY",
      records: records,
      totalRecords: records.length
    };
  }


  /* =========================================================
     SHEET OUTLINE / CUT SUMMARY / SEQUENCE
     ========================================================= */

  function buildSheetOutline(flat) {

    var w = flat.lengthInch;
    var h = flat.depthInch;

    return {

      type: "RECTANGULAR_DEVELOPED_SHEET",

      widthInch: w,
      heightInch: h,
      widthMM: flat.lengthMM,
      heightMM: flat.depthMM,

      points: [
        { xInch: 0, yInch: 0 },
        { xInch: w, yInch: 0 },
        { xInch: w, yInch: h },
        { xInch: 0, yInch: h }
      ]
    };
  }


  function buildCutSummary(cuts) {

    var total = Array.isArray(cuts) ? cuts.length : 0;

    return {

      totalCuts: total,
      count: total,

      cupCuts: cuts.filter(function (c) {
        return c.type === "CUP_CUT";
      }).length,

      miterCuts: cuts.filter(function (c) {
        return c.type === "MITER_CUT";
      }).length,

      needsCheck: cuts.filter(function (c) {
        return c.needsCheck;
      }).length,

      physicalCuts: cuts.filter(function (c) {
        return c.physical;
      }).length,

      hiddenCuts: cuts.filter(function (c) {
        return c.hidden;
      }).length,

      cuts: clone(cuts)
    };
  }


  function buildSequence(lengthLines, depthLines) {

    var sequence = [];
    var n = 1;

    function push(line, side) {

      sequence.push({

        step: n++,

        id: line.id,
        side: side,

        angle: line.angle,
        effectiveAngle: line.effectiveAngle,
        pressAngle: line.pressAngle,
        direction: line.direction,

        sizeInch: line.sizeInch,
        markSizeInch: line.markSizeInch,

        bendAllowanceInch: line.bendAllowanceInch,
        bendDeductionInch: line.bendDeductionInch,
        shopDeductionInch: line.shopDeductionInch,

        isBend: !!line.isBend
      });
    }

    lengthLines.forEach(function (l) { push(l, "length"); });
    depthLines.forEach(function (l) { push(l, "depth"); });

    return sequence;
  }


  /* =========================================================
     MASTER ANALYZE
     ========================================================= */

  function analyze(inputState) {

    var state = inputState || window.AppState || window.state || {};

    var settings = getSettings();

    var rawLength = Array.isArray(state.lenLines) ? state.lenLines : [];
    var rawDepth = Array.isArray(state.depLines) ? state.depLines : [];

    var lengthInput = normalizeLines(rawLength, "length");
    var depthInput = normalizeLines(rawDepth, "depth");

    var lengthBase = lengthInput.map(function (line, index) {
      return createLineData(line, "length", index, index + 1, settings);
    });

    var depthStart = lengthBase.length + 1;

    var depthBase = depthInput.map(function (line, index) {
      return createLineData(line, "depth", index, depthStart + index, settings);
    });

    /* flat positions (marking) */
    var flat = buildFlatNetwork(lengthBase, depthBase, settings);

    /* fold model + cuts */
    var fold = buildFold(flat, settings);

    var cuts = buildCuts(fold, flat);

    var intersections = buildIntersections(flat, cuts);

    /* top-level lines = positions ke saath (flat.js yahin se padhta hai) */
    var lengthLines = flat.lengthLines.map(function (l) {
      return extend({}, l);
    });

    var depthLines = flat.depthLines.map(function (l) {
      return extend({}, l);
    });

    /* base lines ko mark karo (info) */
    if (fold.valid) {
      fold.lengthSegments[fold.baseLengthSegment].idx.forEach(function (ix) {
        lengthLines[ix].isBase = true;
      });
      fold.depthSegments[fold.baseDepthSegment].idx.forEach(function (ix) {
        depthLines[ix].isBase = true;
      });
    }

    var threeD = build3DNetwork(lengthBase, depthBase, settings);

    var sheet = buildSheetOutline(flat);

    var sequence = buildSequence(lengthLines, depthLines);

    var cutSummary = buildCutSummary(cuts);

    var totalBends =
      lengthLines.filter(function (l) { return l.isBend; }).length +
      depthLines.filter(function (l) { return l.isBend; }).length;

    var needsCheck =
      cuts.some(function (c) { return c.needsCheck; }) ||
      lengthLines.concat(depthLines).some(function (l) {
        return l.needsCheck;
      });

    /* _corners / _block andar ke hisaab hain, bahar nahi bhejte */
    var publicFold = extend({}, fold);
    delete publicFold._corners;

    cuts.forEach(function (c) { delete c._block; });
    cutSummary.cuts.forEach(function (c) { delete c._block; });

    return {

      version: "GEOMETRY_ENGINE_V6",

      settings: clone(settings),

      input: {
        lengthLines: clone(lengthInput),
        depthLines: clone(depthInput)
      },

      lengthLines: lengthLines,
      depthLines: depthLines,

      totals: {

        length: round(flat.lengthInch, 6),
        depth: round(flat.depthInch, 6),

        lengthMM: round(flat.lengthMM, 4),
        depthMM: round(flat.depthMM, 4),

        lengthLines: lengthLines.length,
        depthLines: depthLines.length,

        totalBends: totalBends,

        corners: intersections.length,
        cupCuts: cutSummary.totalCuts,

        miterCuts: cutSummary.miterCuts,
        needsCheck: needsCheck,
        allowanceMode: settings.allowanceMode
      },

      flat: flat,

      sheet: sheet,

      intersections: intersections,

      cuts: cuts,

      cutSummary: cutSummary,

      fold: publicFold,

      threeD: threeD,

      sequence: sequence
    };
  }


  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.GeometryEngine = {

    version: "GEOMETRY_ENGINE_V6",

    analyze: analyze,

    getSettings: getSettings,

    normalizeLine: normalizeLine,
    normalizeLines: normalizeLines,

    calculateBend: calculateBend,
    calculateBendZone: calculateBendZone,
    calculateInteraction: calculateInteraction,

    shopDeduction: shopDeduction,

    miter: miter,

    buildFlatNetwork: buildFlatNetwork,
    build3DNetwork: build3DNetwork,
    buildFold: buildFold,
    buildIntersections: buildIntersections,
    buildSequence: buildSequence,
    buildSheetOutline: buildSheetOutline,
    buildCutSummary: buildCutSummary,

    inchToMM: inchToMM,
    mmToInch: mmToInch,

    formulas: {
      bendAllowance: bendAllowance,
      bendDeduction: bendDeduction,
      estimateRadiusFromVDie: estimateRadiusFromVDie,
      getEffectiveRadius: getEffectiveRadius
    },

    debug: function () {

      var result = analyze(window.AppState || window.state || {});

      console.log("========== GEOMETRY ENGINE V6 ==========");
      console.log("SETTINGS:", result.settings);
      console.log("LENGTH:", result.lengthLines);
      console.log("DEPTH:", result.depthLines);
      console.log("CUTS:", result.cuts);
      console.log("FOLD:", result.fold);
      console.log("SEQUENCE:", result.sequence);
      console.log("========================================");

      return result;
    }
  };


  console.log("GeometryEngine V6 loaded");

})();
