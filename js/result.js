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
      html =
        '<div class="empty-hint">' +
        "No bend lines yet." +
        "</div>";

      setHTML("result-bends", html);
      setHTML("bend-list", html);
      setHTML("result-bend-list", html);
      setHTML("result-list", html);

      return;
    }

    html += '<div class="result-table-wrap">';
    html += '<table class="result-table">';

    html += "<thead>";
    html += "<tr>";

    html += "<th>#</th>";
    html += "<th>ID</th>";
    html += "<th>Side</th>";
    html += "<th>Size</th>";
    html += "<th>Angle</th>";
    html += "<th>Dir</th>";

    html += "</tr>";
    html += "</thead>";

    html += "<tbody>";

    list.forEach(function (line, i) {

      var side =
        String(line.side || "").toLowerCase() === "depth"
          ? "DEPTH"
          : "LENGTH";

      var direction =
        String(
          line.direction ||
          line.bend ||
          ""
        ).toLowerCase();

      direction =
        direction === "down"
          ? "DOWN"
          : "UP";

      var sizeIn =
        line.sizeInch != null
          ? line.sizeInch
          : line.size;

      var a =
        line.angle != null
          ? line.angle
          : 0;

      html += "<tr>";

      html +=
        "<td>" +
        esc(i + 1) +
        "</td>";

      html +=
        "<td>" +
        esc(
          line.id ||
          ("B" + (i + 1))
        ) +
        "</td>";

      html +=
        "<td>" +
        esc(side) +
        "</td>";

      html +=
        '<td>' +
        inch(sizeIn) +
        '"';

      if (line.sizeMM != null) {
        html +=
          " <small>(" +
          mm(line.sizeMM) +
          " mm)</small>";
      }

      html += "</td>";

      html +=
        "<td>" +
        angle(a) +
        "°</td>";

      html +=
        "<td>" +
        esc(direction) +
        "</td>";

      html += "</tr>";
    });

    html += "</tbody>";
    html += "</table>";
    html += "</div>";

    setHTML(
      "result-bends",
      html
    );

    setHTML(
      "bend-list",
      html
    );

    setHTML(
      "result-bend-list",
      html
    );

    setHTML(
      "result-list",
      html
    );
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
    var cuts =
      Array.isArray(data.cuts)
        ? data.cuts
        : [];

    var html = "";

    /* -------------------------------------------------------
       NO CUT
       ------------------------------------------------------- */

    if (!cuts.length) {

      html =
        '<div class="empty-hint result-no-cut">' +
        "✓ No cup cuts required." +
        "</div>";

      setHTML(
        "result-cuts",
        html
      );

      setHTML(
        "cup-cut-list",
        html
      );

      setHTML(
        "result-cup-cuts",
        html
      );

      return;
    }

    /* -------------------------------------------------------
       CUT CARDS
       ------------------------------------------------------- */

    html +=
      '<div class="result-cut-list">';

    cuts.forEach(function (cut, i) {

      /* =====================================================
         CUT ID
         ===================================================== */

      var cutId =
        cut.id ||
        cut.cutId ||
        (
          "CUT_" +
          String(i + 1).padStart(2, "0")
        );


      /* =====================================================
         LENGTH ID
         ===================================================== */

      var lengthId =
        cut.lengthId ||
        cut.lengthID ||
        cut.lengthLineId ||
        "—";


      /* =====================================================
         DEPTH ID
         ===================================================== */

      var depthId =
        cut.depthId ||
        cut.depthID ||
        cut.depthLineId ||
        "—";


      /* =====================================================
         LENGTH SIDE SIZE
         ===================================================== */

      var lengthSize = null;

      if (cut.lengthInch != null) {

        lengthSize =
          cut.lengthInch;

      } else if (cut.lengthSizeInch != null) {

        lengthSize =
          cut.lengthSizeInch;

      } else if (cut.lengthSize != null) {

        lengthSize =
          cut.lengthSize;

      } else if (cut.widthInch != null) {

        lengthSize =
          cut.widthInch;
      }


      /* =====================================================
         DEPTH SIDE SIZE
         ===================================================== */

      var depthSize = null;

      if (cut.depthInch != null) {

        depthSize =
          cut.depthInch;

      } else if (cut.depthSizeInch != null) {

        depthSize =
          cut.depthSizeInch;

      } else if (cut.depthSize != null) {

        depthSize =
          cut.depthSize;

      } else if (cut.depthMM != null) {

        depthSize =
          num(cut.depthMM) / 25.4;
      }


      /* =====================================================
         OLD WIDTH/DEPTH MM SUPPORT
         ===================================================== */

      if (
        lengthSize == null &&
        cut.widthMM != null
      ) {
        lengthSize =
          num(cut.widthMM) / 25.4;
      }

      if (
        depthSize == null &&
        cut.depthMM != null
      ) {
        depthSize =
          num(cut.depthMM) / 25.4;
      }


      /* =====================================================
         CUT ANGLE
         ===================================================== */

      var cutAngle = null;

      if (cut.cutAngle != null) {

        cutAngle =
          cut.cutAngle;

      } else if (cut.angle != null) {

        cutAngle =
          cut.angle;

      } else if (cut.miterAngle != null) {

        cutAngle =
          cut.miterAngle;

      } else if (cut.miterAngleDeg != null) {

        cutAngle =
          cut.miterAngleDeg;
      }


      /* =====================================================
         CUT LENGTH
         ===================================================== */

      var cutLength = null;

      if (cut.cutLengthInch != null) {

        cutLength =
          cut.cutLengthInch;

      } else if (cut.cutLength != null) {

        cutLength =
          cut.cutLength;

      } else if (cut.miterLengthInch != null) {

        cutLength =
          cut.miterLengthInch;

      } else if (cut.miterLength != null) {

        cutLength =
          cut.miterLength;

      } else if (cut.lengthCut != null) {

        cutLength =
          cut.lengthCut;

      } else if (cut.cutLengthMM != null) {

        cutLength =
          num(cut.cutLengthMM) / 25.4;
      }


      /* =====================================================
         CUT DEPTH
         ===================================================== */

      var cutDepth = null;

      if (cut.cutDepthInch != null) {

        cutDepth =
          cut.cutDepthInch;

      } else if (cut.cutDepth != null) {

        cutDepth =
          cut.cutDepth;

      } else if (cut.miterDepthInch != null) {

        cutDepth =
          cut.miterDepthInch;

      } else if (cut.miterDepth != null) {

        cutDepth =
          cut.miterDepth;

      } else if (cut.depthCut != null) {

        cutDepth =
          cut.depthCut;

      } else if (cut.cutDepthMM != null) {

        cutDepth =
          num(cut.cutDepthMM) / 25.4;
      }


      /* =====================================================
         TYPE
         ===================================================== */

      var type =
        cut.type ||
        cut.cutType ||
        cut.kind ||
        "MITER CUT";

      type =
        String(type).toUpperCase();


      /* =====================================================
         REASON
         ===================================================== */

      var reason =
        cut.reason ||
        cut.description ||
        cut.cause ||
        "INTERFERENCE";


      /* =====================================================
         CARD START
         ===================================================== */

      html +=
        '<div class="result-cut-card">';


      /* =====================================================
         TITLE
         ===================================================== */

      html +=
        '<div class="result-cut-title">' +
        "<strong>" +
        esc(cutId) +
        "</strong>" +
        "</div>";


      /* =====================================================
         BODY
         ===================================================== */

      html +=
        '<div class="result-cut-body">';


      /* =====================================================
         LENGTH SIDE
         ===================================================== */

      html +=
        '<div class="cut-result-row">' +
        "<span>Length side</span>" +
        "<strong>";

      if (lengthSize != null) {

        html +=
          inch(lengthSize) +
          '"';

      } else {

        html +=
          esc(lengthId);
      }

      html +=
        "</strong>" +
        "</div>";


      /* =====================================================
         DEPTH SIDE
         ===================================================== */

      html +=
        '<div class="cut-result-row">' +
        "<span>Depth side</span>" +
        "<strong>";

      if (depthSize != null) {

        html +=
          inch(depthSize) +
          '"';

      } else {

        html +=
          esc(depthId);
      }

      html +=
        "</strong>" +
        "</div>";


      /* =====================================================
         CUT ANGLE
         ===================================================== */

      html +=
        '<div class="cut-result-row">' +
        "<span>Cut angle</span>" +
        "<strong>";

      if (cutAngle != null) {

        html +=
          angle(cutAngle) +
          "°";

      } else {

        html += "—";
      }

      html +=
        "</strong>" +
        "</div>";


      /* =====================================================
         CUT LENGTH
         ===================================================== */

      html +=
        '<div class="cut-result-row">' +
        "<span>Cut length</span>" +
        "<strong>";

      if (cutLength != null) {

        html +=
          inch(cutLength) +
          '"';

      } else {

        html += "—";
      }

      html +=
        "</strong>" +
        "</div>";


      /* =====================================================
         CUT DEPTH
         ===================================================== */

      html +=
        '<div class="cut-result-row">' +
        "<span>Cut depth</span>" +
        "<strong>";

      if (cutDepth != null) {

        html +=
          inch(cutDepth) +
          '"';

      } else {

        html += "—";
      }

      html +=
        "</strong>" +
        "</div>";


      /* =====================================================
         TYPE
         ===================================================== */

      html +=
        '<div class="cut-result-row">' +
        "<span>Type</span>" +
        "<strong>" +
        esc(type) +
        "</strong>" +
        "</div>";


      /* =====================================================
         REASON
         ===================================================== */

      html +=
        '<div class="cut-result-row">' +
        "<span>Reason</span>" +
        "<strong>" +
        esc(reason) +
        "</strong>" +
        "</div>";


      /* =====================================================
         CLOSE BODY / CARD
         ===================================================== */

      html += "</div>";
      html += "</div>";
    });

    html += "</div>";


    /* =======================================================
       OUTPUT
       ======================================================= */

    setHTML(
      "result-cuts",
      html
    );

    setHTML(
      "cup-cut-list",
      html
    );

    setHTML(
      "result-cup-cuts",
      html
    );
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
        t.cupCuts,
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
