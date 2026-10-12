/* =========================================================
   RESULT.JS — MASTER RESULT DISPLAY V9
   ---------------------------------------------------------
   Data:
       window.currentGeometryData

   IMPORTANT:
       GeometryEngine = calculation brain
       Result.js      = display only

   This file does NOT calculate geometry.
   It only displays existing GeometryEngine cut data.
   ========================================================= */

(function () {
  "use strict";

  /* =========================================================
     HELPERS
     ========================================================= */

  function $(id) {
    return document.getElementById(id);
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    return isFinite(n) ? n : (fallback || 0);
  }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function inch(v) {
    return num(v).toFixed(3).replace(/\.?0+$/, "");
  }

  function mm(v) {
    return num(v).toFixed(2).replace(/\.?0+$/, "");
  }

  function angle(v) {
    return num(v).toFixed(1).replace(/\.0$/, "");
  }

  function getState() {
    if (window.AppState) return window.AppState;
    if (window.state) return window.state;

    return {
      lenLines: [],
      depLines: []
    };
  }

  /* =========================================================
     MASTER DATA
     ========================================================= */

  function getMasterData() {
    return window.currentGeometryData || null;
  }

  /* =========================================================
     GENERIC HTML SETTER
     ========================================================= */

  function setHTML(id, html) {
    var el = $(id);

    if (el) {
      el.innerHTML = html;
    }
  }

  function setText(id, text) {
    var el = $(id);

    if (el) {
      el.textContent = text;
    }
  }

  /* =========================================================
     SIZE TOTALS
     ========================================================= */

  function renderTotals(data) {
    var totals = data.totals || {};
    var sheet = data.sheet || {};

    var lengthIn = num(
      totals.length != null
        ? totals.length
        : sheet.widthInch
    );

    var depthIn = num(
      totals.depth != null
        ? totals.depth
        : sheet.heightInch
    );

    var lengthMM = num(
      totals.lengthMM != null
        ? totals.lengthMM
        : lengthIn * 25.4
    );

    var depthMM = num(
      totals.depthMM != null
        ? totals.depthMM
        : depthIn * 25.4
    );

    setText(
      "result-length",
      inch(lengthIn) + '"'
    );

    setText(
      "result-depth",
      inch(depthIn) + '"'
    );

    setText(
      "result-length-mm",
      mm(lengthMM) + " mm"
    );

    setText(
      "result-depth-mm",
      mm(depthMM) + " mm"
    );

    setText(
      "total-length",
      inch(lengthIn) + '"'
    );

    setText(
      "total-depth",
      inch(depthIn) + '"'
    );

    setText(
      "total-length-mm",
      mm(lengthMM) + " mm"
    );

    setText(
      "total-depth-mm",
      mm(depthMM) + " mm"
    );

    setText(
      "size-total-length",
      inch(lengthIn) + '"'
    );

    setText(
      "size-total-depth",
      inch(depthIn) + '"'
    );

    /* Summary tab IDs */

    setText(
      "sum-len",
      inch(lengthIn) + '"'
    );

    setText(
      "sum-dep",
      inch(depthIn) + '"'
    );
  
    /* V10: Size Totals card (math-result) bhi bharo */
    var mode = data.settings && data.settings.allowanceMode === "SHOP"
      ? "Shop (auto deduction)" : "As Entered";
    setHTML(
      "math-result",
      '<div class="result-row"><span class="label">Sheet Length</span><span class="value">' +
        inch(lengthIn) + '" <small>(' + mm(lengthMM) + " mm)</small></span></div>" +
      '<div class="result-row"><span class="label">Sheet Depth</span><span class="value">' +
        inch(depthIn) + '" <small>(' + mm(depthMM) + " mm)</small></span></div>" +
      '<div class="result-row"><span class="label">Marking Mode</span><span class="value">' +
        esc(mode) + "</span></div>"
    );
  }

  /* =========================================================
     SETTINGS
     ========================================================= */

  function renderSettings(data) {
    var s = data.settings || {};

    setText(
      "result-material",
      s.material || "—"
    );

    setText(
      "result-thickness",
      s.thickness != null
        ? mm(s.thickness) + " mm"
        : "—"
    );

    setText(
      "result-vdie",
      s.vdie != null
        ? mm(s.vdie) + " mm"
        : "—"
    );

    setText(
      "result-radius",
      s.radius != null
        ? mm(s.radius) + " mm"
        : "—"
    );

    setText(
      "result-kfactor",
      s.kfactor != null
        ? num(s.kfactor).toFixed(3)
        : "—"
    );

    setText(
      "result-springback",
      s.springback != null
        ? angle(s.springback) + "°"
        : "—"
    );

    setText(
      "result-relief",
      s.relief != null
        ? mm(s.relief) + " mm"
        : "—"
    );

    /* Summary tab IDs */

    setText(
      "sum-material",
      s.material || "—"
    );

    setText(
      "sum-thick",
      s.thickness != null
        ? mm(s.thickness) + " mm"
        : "—"
    );

    setText(
      "sum-vdie",
      s.vdie != null
        ? mm(s.vdie) + " mm"
        : "—"
    );

    setText(
      "sum-radius",
      s.radius != null
        ? mm(s.radius) + " mm"
        : "—"
    );

    setText(
      "sum-kfactor",
      s.kfactor != null
        ? num(s.kfactor).toFixed(3)
        : "—"
    );
  }

  /* =========================================================
     BEND LIST
     ========================================================= */

  function getSequence(data) {
    if (Array.isArray(data.sequence)) {
      return data.sequence;
    }

    var out = [];

    if (Array.isArray(data.lengthLines)) {
      out = out.concat(data.lengthLines);
    }

    if (Array.isArray(data.depthLines)) {
      out = out.concat(data.depthLines);
    }

    return out;
  }

  function renderBends(data) {
    var list = getSequence(data);

    var html = "";

    if (!list.length) {
      html = '<div class="empty-hint">No bend lines yet.</div>';
      setHTML("result-bends", html);
      setHTML("bend-list", html);
      setHTML("result-bend-list", html);
        return;
    }

    var byId = {};
    (data.lengthLines || []).concat(data.depthLines || []).forEach(function (l) {
      byId[l.side + ":" + l.id] = l;
    });

    var shop = data.settings && data.settings.allowanceMode === "SHOP";

    html += '<div class="result-table-wrap"><table class="result-table"><thead><tr>';
    html += "<th>#</th><th>ID</th><th>Side</th><th>Size</th>";
    if (shop) { html += "<th>Mark</th>"; }
    html += "<th>Angle</th><th>Dir</th><th>Press</th></tr></thead><tbody>";

    list.forEach(function (line, i) {
      var full = byId[line.side + ":" + line.id] || line;
      var side = String(line.side || "").toLowerCase() === "depth" ? "DEPTH" : "LENGTH";
      var isBase = !!full.isBase;
      var dirText = isBase ? "—" :
        (String(line.direction || "").toLowerCase() === "down" ? "DOWN" : "UP");
      var angleText = isBase ? "0° BASE" : angle(line.angle) + "°";
      var tag = full.isDoor ? " 🚪" : "";

      html += "<tr>";
      html += "<td>" + esc(i + 1) + "</td>";
      html += "<td>" + esc(line.id || ("B" + (i + 1))) + tag + "</td>";
      html += "<td>" + esc(side) + "</td>";
      html += "<td>" + inch(line.sizeInch != null ? line.sizeInch : line.size) + '"</td>';
      if (shop) {
        html += "<td>" + (isBase ? "—" : inch(line.markSizeInch) + '"') + "</td>";
      }
      html += "<td>" + esc(angleText) + "</td>";
      html += "<td>" + esc(dirText) + "</td>";
      html += "<td>" + (isBase || !(num(line.pressAngle) > 0) ? "—" : angle(line.pressAngle) + "°") + "</td>";
      html += "</tr>";
    });

    html += "</tbody></table></div>";

    setHTML("result-bends", html);
    setHTML("bend-list", html);
    setHTML("result-bend-list", html);
  }

  /* =========================================================
     CUP / MITER CUT LIST
     ---------------------------------------------------------
     DISPLAY ONLY

     GeometryEngine ka calculation yahan nahi hota.

     Possible existing fields are safely read:
       cutAngle
       angle
       miterAngle
       miterAngleDeg

       cutLengthInch
       cutLength
       miterLengthInch
       miterLength
       lengthCut
       cutLengthMM

       cutDepthInch
       cutDepth
       miterDepthInch
       miterDepth
       depthCut
       cutDepthMM
     ========================================================= */

  function renderCuts(data) {
    var cuts = Array.isArray(data.cuts) ? data.cuts : [];
    var html = "";

    function both(inchVal) {
      return inch(inchVal) + '" <small>(' + mm(num(inchVal) * 25.4) + " mm)</small>";
    }

    function row(label, valueHtml) {
      return '<div class="cut-result-row"><span>' + esc(label) +
        "</span><strong>" + valueHtml + "</strong></div>";
    }

    function setAll(h) {
      setHTML("result-cuts", h);
      setHTML("cup-cut-list", h);
      setHTML("result-cup-cuts", h);
    }

    if (!cuts.length) {
      setAll('<div class="empty-hint result-no-cut">✓ No cup cuts required.</div>');
      return;
    }

    html += '<div class="result-cut-list">';

    cuts.forEach(function (cut, i) {
      var corner = cut.corner || {};
      var where =
        (corner.depthSide === "FAR" ? "neeche" : "upar") + "-" +
        (corner.lengthSide === "RIGHT" ? "right" : "left");

      var mit = cut.miter || {};
      var marks = cut.marks || {};
      var origin = marks.origin || null;
      var polys = marks.polygons || [];
      var isMiter = cut.type === "MITER_CUT" && mit.mode === "MITER" &&
        cut.subtype !== "MITER_90";
      var isSquare = cut.subtype === "MITER_90";

      html += '<div class="result-cut-card">';
      html += '<div class="result-cut-title"><strong>✂ Cut ' + (i + 1) + " — " +
        esc(where) + " corner (" + esc(cut.lengthId) + " × " + esc(cut.depthId) + ")</strong></div>";
      html += '<div class="result-cut-body">';

      html += row("Type", isSquare
        ? "Seedha cup cut (90° corner, chaukor)"
        : (isMiter
          ? "Angle cut (miter) — dono patti ek hi taraf"
          : "Poora corner cut — ulti taraf / hem"));

      html += row("Corner block", both(cut.widthInch) + " × " + both(cut.depthInch));

      if (origin) {
        var fl = num(origin.fromLeft && origin.fromLeft.inch);
        var fr = num(origin.fromRight && origin.fromRight.inch);
        var ft = num(origin.fromTop && origin.fromTop.inch);
        var fb = num(origin.fromBottom && origin.fromBottom.inch);
        html += row("O point (cut yahin se)",
          (fl <= fr ? both(fl) + " left se" : both(fr) + " right se") + ", " +
          (ft <= fb ? both(ft) + " upar se" : both(fb) + " neeche se"));
      }

      if (isMiter) {
        html += row("Cut angle (wedge)", angle(mit.wedgeDeg) + "°");
        html += row("Length side kinara", angle(mit.lengthEdgeDeg) + "°");
        html += row("Depth side kinara", angle(mit.depthEdgeDeg) + "°");

        polys.forEach(function (poly) {
          if (poly.kind !== "WEDGE" && poly.kind !== "TRIM") { return; }
          poly.edges.forEach(function (edge) {
            var t = both(edge.length && edge.length.inch);
            if (edge.axis === null) { t += " @" + angle(edge.angleDeg) + "°"; }
            html += row(poly.kind + " " + edge.from + "→" + edge.to, t);
          });
        });
      }

      if (num(mit.closureGapInch) > 1e-6) {
        html += row("Closure gap", inch(mit.closureGapInch) + '"');
      }

      if (cut.needsCheck) {
        html += row("⚠ Check", esc(cut.reason || "asli sheet pe check karo"));
      }

      html += "</div></div>";
    });

    html += "</div>";
    setAll(html);
  }

  /* =========================================================
     SUMMARY
     ========================================================= */

  function renderSummary(data) {
    var t =
      data.totals || {};

    var summary =
      data.cutSummary || {};

    var bendCount =
      num(
        t.totalBends,
        num(t.lengthLines) +
        num(t.depthLines)
      );

    var lengthCount =
      num(
        t.lengthLines,
        Array.isArray(data.lengthLines)
          ? data.lengthLines.length
          : 0
      );

    var depthCount =
      num(
        t.depthLines,
        Array.isArray(data.depthLines)
          ? data.depthLines.length
          : 0
      );

    var cutCount =
      num(
        summary.cupCuts != null ? summary.cupCuts : t.cupCuts,
        summary.count != null
          ? summary.count
          : (
              Array.isArray(data.cuts)
                ? data.cuts.length
                : 0
            )
      );

    var cornerCount =
      num(t.corners, 0);

    var html = "";

    html +=
      '<div class="result-summary-grid">';


    html +=
      '<div class="summary-card">' +
      "<strong>" +
      bendCount +
      "</strong>" +
      "<span>Total Bends</span>" +
      "</div>";


    html +=
      '<div class="summary-card">' +
      "<strong>" +
      lengthCount +
      "</strong>" +
      "<span>Length Lines</span>" +
      "</div>";


    html +=
      '<div class="summary-card">' +
      "<strong>" +
      depthCount +
      "</strong>" +
      "<span>Depth Lines</span>" +
      "</div>";


    html +=
      '<div class="summary-card">' +
      "<strong>" +
      cutCount +
      "</strong>" +
      "<span>Cup Cuts</span>" +
      "</div>";


    html += "</div>";


    
    /* V10: base + warnings bhi dikhao */
    var base = data.base || {};
    var baseTxt = [];
    if (base.length && base.length.ids && base.length.ids.length) {
      baseTxt.push("LENGTH base: " + base.length.ids.join("+") + (base.length.auto ? " (auto)" : ""));
    }
    if (base.depth && base.depth.ids && base.depth.ids.length) {
      baseTxt.push("DEPTH base: " + base.depth.ids.join("+") + (base.depth.auto ? " (auto)" : ""));
    }
    if (baseTxt.length) {
      html += '<div class="info-box" style="margin-top:8px;">' + esc(baseTxt.join("  ·  ")) + "</div>";
    }

    var warns = data.warnings || [];
    if (warns.length) {
      html += '<div class="base-hint" style="margin-top:8px;">' +
        warns.map(function (w) { return "⚠ " + esc(w.message); }).join("<br>") + "</div>";
    }

    setHTML(
      "result-summary",
      html
    );

    setHTML(
      "summary-box",
      html
    );


    /* Summary tab IDs */

    setText(
      "sum-len-lines",
      String(lengthCount)
    );

    setText(
      "sum-dep-lines",
      String(depthCount)
    );

    setText(
      "sum-corners",
      String(cornerCount)
    );
  }

  /* =========================================================
     MASTER STATUS
     ========================================================= */

  function renderStatus(data) {
    var cuts =
      Array.isArray(data.cuts)
        ? data.cuts.length
        : 0;

    var bends =
      data.totals
        ? num(data.totals.totalBends)
        : 0;

    var text =
      "MASTER RESULT READY • " +
      bends +
      " BENDS • " +
      cuts +
      " CUP CUTS";

    setText(
      "result-status",
      text
    );

    setText(
      "master-result-status",
      text
    );
  }

  /* =========================================================
     FULL RENDER — SYNC
     ========================================================= */

  function render() {

    var data =
      getMasterData();

    if (!data) {

      setText(
        "result-status",
        "Data loading..."
      );

      setHTML(
        "result-bends",
        '<div class="empty-hint">' +
        "Data loading..." +
        "</div>"
      );

      setHTML(
        "result-cuts",
        '<div class="empty-hint">' +
        "Data loading..." +
        "</div>"
      );

      return null;
    }


    /* MASTER DISPLAY */

    renderTotals(data);

    renderSettings(data);

    renderBends(data);

    renderCuts(data);

    renderSummary(data);

    renderStatus(data);


    return data;
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {
    render();
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.Result = {
    init: init,
    render: render,
    getMasterData: getMasterData
  };

  window.ResultView =
    window.Result;

})();
