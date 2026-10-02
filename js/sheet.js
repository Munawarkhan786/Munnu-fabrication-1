/* =========================================================
   SHEET — Keypad + Lines + Input + Settings
   ========================================================= */

(function() {
  "use strict";

  function getEl(id) { return document.getElementById(id); }
  function getState() { return window.state; }
  function getSettings() { return window.settings; }

  /* ---------- BUILD CALC GRID ---------- */

  function buildCalcGrid() {
    var grid = getEl("calc-grid");
    if (!grid) return;
    grid.innerHTML = "";

    var keys = ["7","8","9","C","4","5","6","⌫","1","2","3",".","0"];

    keys.forEach(function(k) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "calc-btn";
      b.textContent = k;
      if (k === "C" || k === "⌫") b.classList.add("special");

      b.onclick = function() {
        if (k === "C") return clearCurrent();
        if (k === "⌫") return backspace();
        if (k === ".") return;
        onDigit(Number(k));
      };
      grid.appendChild(b);
    });

    for (var i = 0; i < 3; i++) {
      grid.appendChild(document.createElement("span"));
    }
  }

  function buildFracGrid() {
    var grid = getEl("frac-grid");
    if (!grid) return;
    grid.innerHTML = "";

    window.FRACTIONS.forEach(function(f) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "frac-btn";
      b.textContent = f.label;
      b.onclick = function() { onFraction(f.val); };
      grid.appendChild(b);
    });
  }

  /* ---------- INPUT HANDLERS ---------- */

  function onDigit(d) {
    var cur = getState().current;
    var whole = Math.floor(cur);
    var frac = window.round16(cur - whole);

    if (whole === 0 && frac > 0) {
      getState().current = d + frac;
    } else if (cur === 0) {
      getState().current = d;
    } else {
      getState().current = whole * 10 + d + frac;
    }

    updateDisplay();
  }

  function onFraction(v) {
    getState().current = window.round16(getState().current + v);
    updateDisplay();
  }

  function clearCurrent() {
    getState().current = 0;
    clearTimeout(window.autoAddTimer);
    updateDisplay();
  }

  function backspace() {
    var cur = getState().current;
    if (cur <= 0) return;

    var whole = Math.floor(cur);
    var frac = window.round16(cur - whole);

    if (whole >= 10) {
      getState().current = Math.floor(whole / 10) + frac;
    } else if (whole >= 1) {
      getState().current = frac;
    } else {
      getState().current = 0;
    }

    updateDisplay();
  }

  /* ---------- DISPLAY ---------- */

  function updateDisplay() {
    var d = getEl("display");
    if (!d) return;
    d.textContent = window.formatInch(getState().current);

    var totalEl = getEl("total-value");
    if (totalEl) {
      var total = sumSide(getState().activeSide) + getState().current;
      totalEl.textContent = window.formatInch(total);
    }
  }

  function sumSide(side) {
    var lines = side === "len"
      ? getState().lenLines
      : getState().depLines;
    return lines.reduce(function(s, l) { return s + l.size; }, 0);
  }

  /* ---------- COMMIT LINE ---------- */

  function commitCurrentLine() {
    if (getState().current <= 0) return;

    var line = {
      size: window.round16(getState().current),
      bend: "up",
      angle: 90
    };

    if (getState().activeSide === "len") {
      getState().lenLines.push(line);
    } else {
      getState().depLines.push(line);
    }

    getState().current = 0;
    updateDisplay();
    renderLines();
    if (window.Flat) window.Flat.draw();
    if (window.ThreeD) window.ThreeD.draw();
    if (window.Result) window.Result.render();
    if (window.Storage) window.Storage.save();
  }

  function setSide(side) {
    if (getState().current > 0) {
      clearTimeout(window.autoAddTimer);
      commitCurrentLine();
    }

    getState().activeSide = side;
    var sLen = getEl("side-len");
    var sDep = getEl("side-dep");
    if (sLen) sLen.classList.toggle("active", side === "len");
    if (sDep) sDep.classList.toggle("active", side === "dep");
    updateDisplay();
    if (window.Storage) window.Storage.save();
  }

  /* ---------- RENDER LINES ---------- */

  function renderLines() {
    renderSideLines("len");
    renderSideLines("dep");
  }

  function renderSideLines(side) {
    var container = getEl(side + "-lines-list");
    if (!container) return;

    var lines = side === "len"
      ? getState().lenLines
      : getState().depLines;
    container.innerHTML = "";

    if (lines.length === 0) {
      container.innerHTML = '<div class="empty-small">Abhi koi ' +
        (side === "len" ? "length" : "depth") + ' line nahi</div>';
      return;
    }

    lines.forEach(function(line, index) {
      var row = document.createElement("div");
      row.className = "line-row";

      var idSpan = document.createElement("span");
      idSpan.className = "line-id";
      idSpan.textContent = (side === "len" ? "L" : "D") + (index + 1);
      row.appendChild(idSpan);

      var sizeSpan = document.createElement("span");
      sizeSpan.className = "line-size";
      sizeSpan.textContent = window.formatInch(line.size);
      row.appendChild(sizeSpan);

      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "line-btn edit";
      edit.textContent = "✏️";
      edit.onclick = function() { editLine(side, index); };
      row.appendChild(edit);

      var up = document.createElement("button");
      up.type = "button";
      up.className = "line-btn up" + (line.bend === "up" ? " active" : "");
      up.textContent = "↑";
      up.onclick = function() { setBend(side, index, "up"); };
      row.appendChild(up);

      var dn = document.createElement("button");
      dn.type = "button";
      dn.className = "line-btn down" + (line.bend === "down" ? " active" : "");
      dn.textContent = "↓";
      dn.onclick = function() { setBend(side, index, "down"); };
      row.appendChild(dn);

      var sel = document.createElement("select");
      sel.className = "line-angle";
      window.ANGLES.forEach(function(a) {
        var opt = document.createElement("option");
        opt.value = a;
        opt.textContent = a + "°";
        if (line.angle === a) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = function() {
        setAngle(side, index, Number(this.value));
      };
      row.appendChild(sel);

      var del = document.createElement("button");
      del.type = "button";
      del.className = "line-btn del";
      del.textContent = "🗑️";
      del.onclick = function() { deleteLine(side, index); };
      row.appendChild(del);

      container.appendChild(row);
    });
  }

  function setBend(side, index, bend) {
    var lines = side === "len"
      ? getState().lenLines
      : getState().depLines;
    if (!lines[index]) return;
    lines[index].bend = bend;
    renderLines();
    if (window.Flat) window.Flat.draw();
    if (window.ThreeD) window.ThreeD.draw();
    if (window.Result) window.Result.render();
    if (window.Storage) window.Storage.save();
  }

  function setAngle(side, index, angle) {
    var lines = side === "len"
      ? getState().lenLines
      : getState().depLines;
    if (!lines[index]) return;
    if (window.ANGLES.indexOf(Number(angle)) === -1) angle = 90;
    lines[index].angle = Number(angle);
    renderLines();
    if (window.Flat) window.Flat.draw();
    if (window.ThreeD) window.ThreeD.draw();
    if (window.Result) window.Result.render();
    if (window.Storage) window.Storage.save();
  }

  function deleteLine(side, index) {
    var lines = side === "len"
      ? getState().lenLines
      : getState().depLines;
    if (!lines[index]) return;
    lines.splice(index, 1);
    renderLines();
    if (window.Flat) window.Flat.draw();
    if (window.ThreeD) window.ThreeD.draw();
    if (window.Result) window.Result.render();
    if (window.Storage) window.Storage.save();
  }

  /* ---------- EDIT LINE ---------- */

  function editLine(side, index) {
    var lines = side === "len"
      ? getState().lenLines
      : getState().depLines;
    if (!lines[index]) return;

    getState().editingLine = { side: side, index: index };
    getState().editMode = true;
    getState().current = lines[index].size;

    updateDisplay();

    var editBar = getEl("edit-bar");
    if (editBar) {
      editBar.classList.remove("hidden");
      var editInfo = getEl("edit-info");
      if (editInfo) {
        editInfo.textContent = "Editing " +
          (side === "len" ? "L" : "D") + (index + 1);
      }
    }
  }

  function saveEditedLine() {
    if (!getState().editingLine) return;

    var side = getState().editingLine.side;
    var index = getState().editingLine.index;
    var lines = side === "len"
      ? getState().lenLines
      : getState().depLines;

    if (!lines[index] || getState().current <= 0) {
      cancelEdit();
      return;
    }

    lines[index].size = window.round16(getState().current);
    getState().current = 0;
    getState().editingLine = null;
    getState().editMode = false;

    var editBar = getEl("edit-bar");
    if (editBar) editBar.classList.add("hidden");

    updateDisplay();
    renderLines();
    if (window.Flat) window.Flat.draw();
    if (window.ThreeD) window.ThreeD.draw();
    if (window.Result) window.Result.render();
    if (window.Storage) window.Storage.save();
  }

  function cancelEdit() {
    getState().editingLine = null;
    getState().editMode = false;
    getState().current = 0;

    var editBar = getEl("edit-bar");
    if (editBar) editBar.classList.add("hidden");

    updateDisplay();
  }

  /* ---------- SETTINGS ---------- */

  function fillSettingsUI() {
    document.querySelectorAll(".material-btn").forEach(function(b) {
      b.classList.toggle("active",
        b.dataset.material === getSettings().material);
    });

    var matchedThick = false;
    document.querySelectorAll(".thickness-btn").forEach(function(b) {
      var match = Math.abs(
        Number(b.dataset.thick) - Number(getSettings().thickness)
      ) < 0.001;
      b.classList.toggle("active", match);
      if (match) matchedThick = true;
    });

    var ct = getEl("customThick");
    if (ct) ct.value = matchedThick ? "" : getSettings().thickness;

    if (getEl("setVdie")) getEl("setVdie").value = getSettings().vdie;
    if (getEl("setRadius")) getEl("setRadius").value = getSettings().radius;
    if (getEl("setKfactor")) getEl("setKfactor").value = getSettings().kfactor;
    if (getEl("setSpringback")) getEl("setSpringback").value = getSettings().springback;
    if (getEl("setRelief")) getEl("setRelief").value = getSettings().relief;
  }

  function applyMaterial(mat) {
    getSettings().material = mat;
    getSettings().kfactor = window.MATERIAL_K[mat] || 0.44;
    fillSettingsUI();
    if (window.Result) window.Result.render();
    if (window.Storage) {
      window.Storage.saveSettings();
      window.Storage.save();
    }
  }

  function applyThickness(t) {
    t = Number(t);
    if (!(t > 0) || t > 10) return;

    getSettings().thickness = t;
    getSettings().vdie = window.cleanNumber(8 * t);
    getSettings().radius = window.cleanNumber(t);

    fillSettingsUI();
    if (window.Result) window.Result.render();
    if (window.Storage) {
      window.Storage.saveSettings();
      window.Storage.save();
    }
  }

  function readAdvancedSettings() {
    var vdie = Number(getEl("setVdie").value);
    var radius = Number(getEl("setRadius").value);
    var kfactor = Number(getEl("setKfactor").value);
    var springback = Number(getEl("setSpringback").value);
    var relief = Number(getEl("setRelief").value);

    if (vdie > 0) getSettings().vdie = vdie;
    if (radius > 0) getSettings().radius = radius;
    if (kfactor > 0 && kfactor <= 0.5) getSettings().kfactor = kfactor;
    if (springback >= 0 && springback <= 5) getSettings().springback = springback;
    if (relief >= 0) getSettings().relief = relief;

    if (window.Storage) window.Storage.saveSettings();
    if (window.Result) window.Result.render();
    if (window.Storage) window.Storage.save();
  }

  function resetSettings() {
    window.settings = JSON.parse(JSON.stringify(window.DEFAULT_SETTINGS));
    fillSettingsUI();
    if (window.Result) window.Result.render();
    if (window.Storage) {
      window.Storage.saveSettings();
      window.Storage.save();
    }
  }

  /* ---------- INIT ---------- */

  function init() {
    buildCalcGrid();
    buildFracGrid();

    var sideLen = getEl("side-len");
    var sideDep = getEl("side-dep");
    var btnAdd = getEl("btn-add");
    var btnOk = getEl("btn-ok");
    var btnClear = getEl("btn-clear");

    if (sideLen) sideLen.onclick = function() { setSide("len"); };
    if (sideDep) sideDep.onclick = function() { setSide("dep"); };

    if (btnAdd) {
      btnAdd.onclick = function() {
        clearTimeout(window.autoAddTimer);
        if (getState().editMode) saveEditedLine();
        else if (getState().current > 0) commitCurrentLine();
      };
    }

    if (btnOk) {
      btnOk.onclick = function() {
        clearTimeout(window.autoAddTimer);
        if (getState().editMode) saveEditedLine();
        else if (getState().current > 0) commitCurrentLine();
      };
    }

    if (btnClear) btnClear.onclick = clearCurrent;

    var saveEdit = getEl("btn-save-edit");
    var cancelEditBtn = getEl("btn-cancel-edit");
    if (saveEdit) saveEdit.onclick = saveEditedLine;
    if (cancelEditBtn) cancelEditBtn.onclick = cancelEdit;

    if (getEl("keyword")) {
      getEl("keyword").oninput = function() {
        getState().keyword = this.value;
        if (window.Storage) window.Storage.save();
      };
    }

    document.querySelectorAll(".material-btn").forEach(function(b) {
      b.onclick = function() { applyMaterial(this.dataset.material); };
    });

    document.querySelectorAll(".thickness-btn").forEach(function(b) {
      b.onclick = function() { applyThickness(this.dataset.thick); };
    });

    if (getEl("customThick")) {
      getEl("customThick").onchange = function() {
        var v = Number(this.value);
        if (v > 0 && v <= 10) applyThickness(v);
      };
    }

    ["setVdie","setRadius","setKfactor","setSpringback","setRelief"]
      .forEach(function(id) {
        var input = getEl(id);
        if (input) {
          input.onchange = readAdvancedSettings;
          input.oninput = readAdvancedSettings;
        }
      });

    if (getEl("btn-reset-settings")) {
      getEl("btn-reset-settings").onclick = function() {
        if (confirm("Settings default pe reset karein?")) resetSettings();
      };
    }

    if (getEl("btn-save-settings")) {
      getEl("btn-save-settings").onclick = function() {
        readAdvancedSettings();
        alert("✅ Settings save ho gayi!");
      };
    }

    if (getEl("btn-save")) {
      getEl("btn-save").onclick = function() {
        if (window.Storage) {
          window.Storage.save();
          window.Storage.saveSettings();
        }
        alert("✅ Save ho gaya!");
      };
    }

    if (getEl("btn-calc")) {
      getEl("btn-calc").onclick = function() {
        if (getState().editMode) saveEditedLine();
        else if (getState().current > 0) commitCurrentLine();
        if (window.Result) window.Result.render();
        if (window.Storage) window.Storage.save();
      };
    }

    if (sideLen) sideLen.classList.toggle("active", getState().activeSide === "len");
    if (sideDep) sideDep.classList.toggle("active", getState().activeSide === "dep");

    fillSettingsUI();
    updateDisplay();
    renderLines();
  }

  window.Sheet = {
    init: init,
    render: renderLines,
    updateDisplay: updateDisplay,
    commit: commitCurrentLine,
    setSide: setSide,
    saveEdit: saveEditedLine,
    cancelEdit: cancelEdit
  };

})();
