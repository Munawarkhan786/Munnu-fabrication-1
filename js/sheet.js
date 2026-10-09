/* =========================================================
   SHEET.JS — INPUT / MARKING LINE CONTROLLER V7
   ---------------------------------------------------------
   V7 CHANGE:
   - Keypad ab STARTUP par band rahega.
   - User "Current Size" (0) par CLICK karega tabhi khulega.

   V8 CHANGE:
   - redraw() ab Main.calculate() use karta hai (Worker fetch).
   - Calculator OK ke baad BAND NAHI hota.
   - ↑↓ arrows ab BEND DIRECTION change karte hain.
   - 90° pe click karne se ANGLE PICKER khulta hai.
   ========================================================= */

(function () {
  "use strict";

  /* =========================================================
     HELPERS
     ========================================================= */

  function $(id) {
    return document.getElementById(id);
  }

  function num(v) {
    var n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  function getState() {
    if (window.AppState) return window.AppState;

    window.AppState = {
      keyword: "box",
      activeSide: "len",
      current: 0,
      lenLines: [],
      depLines: [],
      editingLine: null,
      editMode: false
    };

    return window.AppState;
  }

  function formatSize(value) {
    var n = num(value);

    if (n === 0) return "0";

    if (window.Core && typeof Core.formatInch === "function") {
      try {
        return Core.formatInch(n);
      } catch (e) {}
    }

    return String(Math.round(n * 10000) / 10000);
  }

  function getLines(side) {
    var state = getState();

    if (side === "dep") {
      if (!Array.isArray(state.depLines)) {
        state.depLines = [];
      }
      return state.depLines;
    }

    if (!Array.isArray(state.lenLines)) {
      state.lenLines = [];
    }

    return state.lenLines;
  }

  function setLines(side, lines) {
    var state = getState();

    if (side === "dep") {
      state.depLines = lines;
    } else {
      state.lenLines = lines;
    }
  }

  function getActiveSide() {
    return getState().activeSide === "dep" ? "dep" : "len";
  }

  /* =========================================================
     INPUT DISPLAY
     ========================================================= */

  function getInputText() {
    var display = $("display");

    if (!display) return "0";

    return String(display.textContent || "0").trim();
  }

  function getInputValue() {
    return parseSize(getInputText());
  }

  function setInputText(text) {
    var display = $("display");
    var state = getState();

    text = String(text);

    if (!display) return;

    state.current = parseSize(text);

    display.textContent = text;
  }

  function setInputValue(value) {
    value = num(value);

    setInputText(formatSize(value));
  }

  function clearInput() {
    setInputText("0");

    var error = $("input-error");

    if (error) {
      error.textContent = "";
      error.style.display = "none";
    }
  }

  /* =========================================================
     PARSE SIZE
     ========================================================= */

  function parseSize(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    var text = String(value || "").trim().replace(/"/g, "");

    if (!text) return 0;

    var mixed = text.match(/^(-?\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);

    if (mixed) {
      var whole = parseFloat(mixed[1]);
      var numerator = parseFloat(mixed[2]);
      var denominator = parseFloat(mixed[3]);

      if (
        Number.isFinite(whole) &&
        Number.isFinite(numerator) &&
        Number.isFinite(denominator) &&
        denominator !== 0
      ) {
        return whole + numerator / denominator;
      }
    }

    var fraction = text.match(/^(-?\d+)\s*\/\s*(\d+)$/);

    if (fraction) {
      var a = parseFloat(fraction[1]);
      var b = parseFloat(fraction[2]);

      if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) {
        return a / b;
      }
    }

    var n = parseFloat(text);

    return Number.isFinite(n) ? n : 0;
  }

  /* =========================================================
     BUILD KEYPAD
     ========================================================= */

  function buildCalculator() {
    var calc = $("calc-grid");
    var frac = $("frac-grid");

    if (!calc || !frac) {
      console.error("Calculator containers missing");
      return;
    }

    /* NUMBER KEYPAD */

    calc.innerHTML = "";

    var numbers = [
      "7", "8", "9",
      "4", "5", "6",
      "1", "2", "3",
      "0", ".", "⌫",
      "C"
    ];

    numbers.forEach(function (value) {
      var btn = document.createElement("button");

      btn.type = "button";
      btn.className = "calc-btn";
      btn.textContent = value;

      if (value === "C") btn.classList.add("clear");
      if (value === "⌫") btn.classList.add("backspace");

      btn.addEventListener("click", function () {
        if (value === "C") { clearInput(); return; }
        if (value === "⌫") { backspace(); return; }
        if (value === ".") { appendDecimal(); return; }
        appendValue(value);
      });

      calc.appendChild(btn);
    });

    /* FRACTION KEYPAD */

    frac.innerHTML = "";

    var fractions = [
      ["1/16", 1 / 16],
      ["1/8", 1 / 8],
      ["3/16", 3 / 16],
      ["1/4", 1 / 4],
      ["5/16", 5 / 16],
      ["3/8", 3 / 8],
      ["7/16", 7 / 16],
      ["1/2", 1 / 2],
      ["9/16", 9 / 16],
      ["5/8", 5 / 8],
      ["11/16", 11 / 16],
      ["3/4", 3 / 4],
      ["13/16", 13 / 16],
      ["7/8", 7 / 8],
      ["15/16", 15 / 16],
      ["1", 1]
    ];

    fractions.forEach(function (item) {
      var btn = document.createElement("button");

      btn.type = "button";
      btn.className = "frac-btn";
      btn.textContent = item[0];

      btn.addEventListener("click", function () {
        appendFraction(item[1]);
      });

      frac.appendChild(btn);
    });

    closeSizeCalculator();
  }

  /* =========================================================
     OPEN CALCULATOR
     ========================================================= */

  function openSizeCalculator() {
    var calc = $("calc-grid");
    var frac = $("frac-grid");

    if (calc) {
      calc.style.display = "grid";
      calc.classList.add("open");
    }

    if (frac) {
      frac.style.display = "grid";
      frac.classList.add("open");
    }

    var display = $("display");

    if (display) display.classList.add("active");
  }

  /* =========================================================
     CLOSE CALCULATOR
     ========================================================= */

  function closeSizeCalculator() {
    var calc = $("calc-grid");
    var frac = $("frac-grid");

    if (calc) {
      calc.style.display = "none";
      calc.classList.remove("open");
    }

    if (frac) {
      frac.style.display = "none";
      frac.classList.remove("open");
    }

    var display = $("display");

    if (display) display.classList.remove("active");
  }

  /* =========================================================
     NUMBER ENTRY
     ========================================================= */

  function appendValue(value) {
    value = String(value);

    if (!/^\d$/.test(value)) return;

    var text = getInputText();

    if (text === "0" || text === "") {
      setInputText(value);
      return;
    }

    setInputText(text + value);
  }

  function appendDecimal() {
    var text = getInputText();

    if (text.indexOf(".") !== -1) return;

    if (text === "" || text === "0") {
      setInputText("0.");
      return;
    }

    setInputText(text + ".");
  }

  function backspace() {
    var text = getInputText();

    if (!text || text === "0") {
      clearInput();
      return;
    }

    text = text.slice(0, -1);

    if (!text) text = "0";

    setInputText(text);
  }

  function appendFraction(value) {
    value = num(value);

    if (!Number.isFinite(value)) return;

    var text = getInputText();
    var whole = parseFloat(text);

    if (!Number.isFinite(whole) || text === "0") whole = 0;

    setInputValue(whole + value);
  }

  /* =========================================================
     SIDE
     ========================================================= */

  function setSide(side) {
    var state = getState();

    state.activeSide = side === "dep" ? "dep" : "len";
    state.current = 0;

    updateSideUI();
    clearInput();
  }

  function updateSideUI() {
    var state = getState();

    var len = $("side-len");
    var dep = $("side-dep");

    if (len) len.classList.toggle("active", state.activeSide === "len");
    if (dep) dep.classList.toggle("active", state.activeSide === "dep");
  }

  /* =========================================================
     ANGLE
     ========================================================= */

  function getSelectedAngle() {
    var select = $("angle-select");

    if (!select) return 90;

    var angle = parseFloat(select.value);

    return Number.isFinite(angle) ? angle : 90;
  }

  /* =========================================================
     DIRECTION
     ========================================================= */

  function getSelectedDirection() {
    var up = $("direction-up");

    if (up && up.classList.contains("active")) return "UP";

    return "DOWN";
  }

  function setDirectionUI(direction) {
    var up = $("direction-up");
    var down = $("direction-down");

    direction = String(direction || "UP").toUpperCase();

    if (up) up.classList.toggle("active", direction === "UP");
    if (down) down.classList.toggle("active", direction === "DOWN");
  }

  /* =========================================================
     ADD LINE
     ---------------------------------------------------------
     FIX 1: OK ke baad calculator BAND NAHI hota.
     ========================================================= */

  function addLine() {
    var state = getState();
    var size = getInputValue();

    if (!Number.isFinite(size) || size <= 0) {
      showMessage("Size daalo.", true);
      openSizeCalculator();
      return false;
    }

    var side = getActiveSide();
    var angle = getSelectedAngle();
    var direction = getSelectedDirection();
    var lines = getLines(side);

    /* EDIT */

    if (state.editMode && state.editingLine) {
      var editIndex = state.editingLine.index;

      if (editIndex >= 0 && editIndex < lines.length) {
        lines[editIndex].size = size;
        lines[editIndex].angle = angle;
        lines[editIndex].direction = direction;

        state.editMode = false;
        state.editingLine = null;

        setLines(side, lines);
        hideEditBar();
        render();
        save();
        redraw();

        clearInput();
        // FIX 1: closeSizeCalculator() HATA diya — calculator khula rahe

        return true;
      }
    }

    /* NEW LINE */

    var prefix = side === "dep" ? "D" : "L";

    lines.push({
      id: prefix + (lines.length + 1),
      index: lines.length,
      size: size,
      angle: angle,
      direction: direction
    });

    renumberLines(side);
    setLines(side, lines);
    render();
    save();
    redraw();

    clearInput();
    // FIX 1: closeSizeCalculator() HATA diya — calculator khula rahe

    showMessage(prefix + lines.length + " added.", false);

    return true;
  }

  /* =========================================================
     EDIT
     ========================================================= */

  function editLine(side, index) {
    var state = getState();
    var lines = getLines(side);

    index = parseInt(index, 10);

    if (index < 0 || index >= lines.length) return;

    var line = lines[index];

    state.activeSide = side;
    state.editMode = true;
    state.editingLine = { side: side, index: index };

    updateSideUI();
    setInputValue(line.size);

    var angle = $("angle-select");

    if (angle) angle.value = String(line.angle || 90);

    setDirectionUI(line.direction || "UP");

    var bar = $("edit-bar");
    var info = $("edit-info");

    if (bar) {
      bar.classList.remove("hidden");
      bar.style.display = "block";
    }

    if (info) {
      info.textContent = "Editing " + (side === "dep" ? "D" : "L") + (index + 1);
    }

    openSizeCalculator();
  }

  /* =========================================================
     DELETE
     ========================================================= */

  function deleteLine(side, index) {
    var lines = getLines(side);

    index = parseInt(index, 10);

    if (index < 0 || index >= lines.length) return;

    lines.splice(index, 1);
    renumberLines(side);
    setLines(side, lines);
    render();
    save();
    redraw();
  }

  /* =========================================================
     FIX 2: SET LINE DIRECTION (↑↓ buttons)
     ---------------------------------------------------------
     Ab ye line ko upar/neeche move nahi karta.
     Ye us line ka BEND DIRECTION change karta hai.
     ========================================================= */

  function setLineDirection(side, index, direction) {
    var lines = getLines(side);

    index = parseInt(index, 10);

    if (index < 0 || index >= lines.length) return;

    direction = (String(direction || "").toUpperCase() === "DOWN") ? "DOWN" : "UP";

    lines[index].direction = direction;

    setLines(side, lines);
    render();
    save();
    redraw();
  }

  /* =========================================================
     FIX 3: ANGLE PICKER
     ---------------------------------------------------------
     90° pe click karne par ye modal khulta hai.
     Common angles + custom input.
     ========================================================= */

  var ANGLE_OPTIONS = [
    180, 135, 120, 110, 100, 90,
    80, 75, 65, 60, 55, 45,
    35, 30, 25, 20, 15, 10, 5, 0
  ];

  function setLineAngle(side, index, newAngle) {
    var lines = getLines(side);

    index = parseInt(index, 10);

    if (index < 0 || index >= lines.length) return;

    var a = parseFloat(newAngle);

    if (!Number.isFinite(a)) return;

    a = Math.max(0, Math.min(180, a));

    lines[index].angle = a;

    setLines(side, lines);
    render();
    save();
    redraw();
  }

  function openAnglePicker(side, index) {
    var lines = getLines(side);

    index = parseInt(index, 10);

    if (index < 0 || index >= lines.length) return;

    var current = lines[index].angle || 90;

    var old = $("angle-picker-modal");
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var overlay = document.createElement("div");
    overlay.id = "angle-picker-modal";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.8);" +
      "display:flex;align-items:center;justify-content:center;" +
      "z-index:99999;padding:16px;";

    var box = document.createElement("div");
    box.style.cssText =
      "background:#1a1f2e;border:1px solid #2a3040;" +
      "border-radius:12px;padding:14px;max-width:340px;width:100%;" +
      "max-height:80vh;overflow-y:auto;";

    var title = document.createElement("div");
    title.textContent = "Bend Angle — " +
      (side === "dep" ? "D" : "L") + (index + 1) +
      "  (now: " + current + "°)";
    title.style.cssText =
      "color:#fbbf24;font:700 14px/1.4 Arial,sans-serif;" +
      "margin-bottom:12px;text-align:center;";
    box.appendChild(title);

    var grid = document.createElement("div");
    grid.style.cssText =
      "display:grid;grid-template-columns:repeat(4,1fr);gap:6px;";

    ANGLE_OPTIONS.forEach(function (deg) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = deg + "°";

      var isActive = Math.abs(deg - current) < 0.01;

      b.style.cssText =
        "padding:10px 4px;border-radius:6px;" +
        "border:1px solid " + (isActive ? "#fbbf24" : "#3a4050") + ";" +
        "background:" + (isActive ? "#fbbf24" : "#252b3d") + ";" +
        "color:" + (isActive ? "#000" : "#e8e8e8") + ";" +
        "font:700 13px Arial,sans-serif;cursor:pointer;";

      b.addEventListener("click", function () {
        setLineAngle(side, index, deg);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      });

      grid.appendChild(b);
    });

    box.appendChild(grid);

    /* Custom angle */
    var customWrap = document.createElement("div");
    customWrap.style.cssText = "margin-top:12px;";

    var customLabel = document.createElement("div");
    customLabel.textContent = "Custom angle (0° - 180°):";
    customLabel.style.cssText =
      "color:#888;font:600 11px Arial,sans-serif;margin-bottom:4px;";
    customWrap.appendChild(customLabel);

    var customInput = document.createElement("input");
    customInput.type = "number";
    customInput.min = "0";
    customInput.max = "180";
    customInput.value = current;
    customInput.style.cssText =
      "width:100%;padding:10px;border-radius:6px;" +
      "border:1px solid #3a4050;background:#0a0d14;" +
      "color:#fbbf24;font:700 14px 'Courier New',monospace;" +
      "text-align:center;";

    customWrap.appendChild(customInput);
    box.appendChild(customWrap);

    /* Buttons */
    var btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;margin-top:12px;";

    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "✓ Set Angle";
    saveBtn.style.cssText =
      "flex:1;padding:12px;border-radius:8px;" +
      "background:#fbbf24;color:#000;border:none;" +
      "font:700 13px Arial,sans-serif;cursor:pointer;";

    saveBtn.addEventListener("click", function () {
      var v = parseFloat(customInput.value);
      if (Number.isFinite(v)) setLineAngle(side, index, v);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });

    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "✕ Cancel";
    cancelBtn.style.cssText =
      "flex:1;padding:12px;border-radius:8px;" +
      "background:#252b3d;color:#e8e8e8;border:1px solid #3a4050;" +
      "font:700 13px Arial,sans-serif;cursor:pointer;";

    cancelBtn.addEventListener("click", function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);
    box.appendChild(btnRow);

    overlay.appendChild(box);

    /* Overlay click → close */
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }
    });

    document.body.appendChild(overlay);
  }

  /* =========================================================
     RENUMBER
     ========================================================= */

  function renumberLines(side) {
    var lines = getLines(side);
    var prefix = side === "dep" ? "D" : "L";

    lines.forEach(function (line, index) {
      line.id = prefix + (index + 1);
      line.index = index;
    });
  }

  /* =========================================================
     RENDER
     ========================================================= */

  function render() {
    renderList("len", $("len-lines-list"));
    renderList("dep", $("dep-lines-list"));
    updateTotals();
    updateSideUI();
  }

  /* =========================================================
     RENDER LIST
     ---------------------------------------------------------
     FIX 2 & 3:
     - Angle clickable button (FIX 3)
     - ↑↓ direction change karte hain (FIX 2)
     ========================================================= */

  function renderList(side, container) {
    if (!container) return;

    var lines = getLines(side);
    container.innerHTML = "";

    if (!lines.length) {
      var empty = document.createElement("div");
      empty.className = "empty-small";
      empty.textContent = side === "dep" ? "No depth lines" : "No length lines";
      container.appendChild(empty);
      return;
    }

    lines.forEach(function (line, index) {
      var row = document.createElement("div");
      row.className = "line-row";

      /* Name */
      var name = document.createElement("span");
      name.className = "line-name";
      name.textContent = (side === "dep" ? "D" : "L") + (index + 1);

      /* Size */
      var size = document.createElement("span");
      size.className = "line-size";
      size.textContent = formatSize(line.size) + '"';

      /* FIX 3: ANGLE — clickable button */
      var angleBtn = document.createElement("button");
      angleBtn.type = "button";
      angleBtn.className = "line-angle";
      angleBtn.textContent = String(line.angle || 90) + "°";
      angleBtn.title = "Click to change angle";
      angleBtn.onclick = function () {
        openAnglePicker(side, index);
      };

      /* Direction text */
      var direction = document.createElement("span");
      direction.className = "line-direction";
      direction.textContent = line.direction === "DOWN" ? "DOWN" : "UP";

      /* Edit */
      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "line-btn";
      edit.textContent = "EDIT";
      edit.onclick = function () {
        editLine(side, index);
      };

      /* FIX 2: UP button — direction set */
      var up = document.createElement("button");
      up.type = "button";
      up.className = "line-btn up";
      if (line.direction === "UP") up.classList.add("active");
      up.textContent = "↑";
      up.title = "Set UP";
      up.onclick = function () {
        setLineDirection(side, index, "UP");
      };

      /* FIX 2: DOWN button — direction set */
      var down = document.createElement("button");
      down.type = "button";
      down.className = "line-btn down";
      if (line.direction === "DOWN") down.classList.add("active");
      down.textContent = "↓";
      down.title = "Set DOWN";
      down.onclick = function () {
        setLineDirection(side, index, "DOWN");
      };

      /* Delete */
      var del = document.createElement("button");
      del.type = "button";
      del.className = "line-btn delete";
      del.textContent = "✕";
      del.onclick = function () {
        deleteLine(side, index);
      };

      row.appendChild(name);
      row.appendChild(size);
      row.appendChild(angleBtn);
      row.appendChild(direction);
      row.appendChild(edit);
      row.appendChild(up);
      row.appendChild(down);
      row.appendChild(del);

      container.appendChild(row);
    });
  }

  /* =========================================================
     TOTAL
     ========================================================= */

  function getTotal(side) {
    return getLines(side).reduce(function (total, line) {
      return total + num(line.size);
    }, 0);
  }

  function updateTotals() {
    var total = getTotal(getActiveSide());
    var el = $("total-value");

    if (el) el.textContent = formatSize(total) + '"';
  }

  /* =========================================================
     SAVE
     ========================================================= */

  function save() {
    var state = getState();

    try {
      if (window.Core && typeof Core.saveData === "function") {
        Core.saveData(state);
      } else {
        localStorage.setItem("sheetMarking_v7", JSON.stringify(state));
      }

      var status = $("saveStatus");
      if (status) status.textContent = "💾 Saved";
    } catch (err) {
      console.error("Sheet save failed:", err);
    }
  }

  /* =========================================================
     REDRAW — Worker fetch + draw all
     ========================================================= */

  function redraw() {
    if (window.Main && typeof window.Main.calculate === "function") {
      window.Main.calculate();
      return;
    }

    try {
      if (window.Flat && typeof Flat.draw === "function") Flat.draw();
    } catch (e) { console.error(e); }

    try {
      if (window.ThreeD && typeof ThreeD.draw === "function") ThreeD.draw();
    } catch (e) { console.error(e); }

    try {
      if (window.Result && typeof Result.render === "function") Result.render();
    } catch (e) { console.error(e); }
  }

  /* =========================================================
     MESSAGE
     ========================================================= */

  function showMessage(message, isError) {
    var el = $("input-error");

    if (!el) return;

    el.textContent = message || "";
    el.style.display = message ? "block" : "none";

    if (isError) {
      el.classList.add("error");
    } else {
      el.classList.remove("error");
    }
  }

  /* =========================================================
     EDIT BAR
     ========================================================= */

  function hideEditBar() {
    var bar = $("edit-bar");

    if (bar) {
      bar.classList.add("hidden");
      bar.style.display = "none";
    }
  }

  function cancelEdit() {
    var state = getState();

    state.editMode = false;
    state.editingLine = null;

    clearInput();
    hideEditBar();
    closeSizeCalculator();
    render();
  }

  /* =========================================================
     BUTTON EVENTS
     ---------------------------------------------------------
     FIX 1: Calculator auto-close listener HATA diya.
            Calculate button click par band hoga.
     ========================================================= */

  function bindButtons() {
    var len = $("side-len");
    if (len) len.onclick = function () { setSide("len"); };

    var dep = $("side-dep");
    if (dep) dep.onclick = function () { setSide("dep"); };

    var display = $("display");
    if (display) {
      display.onclick = function (e) {
        e.stopPropagation();
        openSizeCalculator();
      };
      display.ontouchstart = function (e) {
        e.stopPropagation();
        openSizeCalculator();
      };
    }

    var add = $("btn-add");
    if (add) add.onclick = function () { addLine(); };

    var ok = $("btn-ok");
    if (ok) ok.onclick = function () { addLine(); };

    var clear = $("btn-clear");
    if (clear) clear.onclick = function () { clearInput(); };

    var editSave = $("btn-save-edit");
    if (editSave) editSave.onclick = function () { addLine(); };

    var editCancel = $("btn-cancel-edit");
    if (editCancel) editCancel.onclick = function () { cancelEdit(); };

    var up = $("direction-up");
    var down = $("direction-down");

    if (up) up.onclick = function () { setDirectionUI("UP"); };
    if (down) down.onclick = function () { setDirectionUI("DOWN"); };

    /* FIX 1: CALCULATE button — yahan calculator band hoga */

    var calcBtn = $("btn-calc");

    if (calcBtn) {
      calcBtn.onclick = function () {
        // Calculator band karo
        closeSizeCalculator();

        // Worker se data fetch + sab draw
        if (window.Main && typeof window.Main.calculate === "function") {
          window.Main.calculate();
        }
      };
    }

    /* FIX 1: Purana document click listener HATA diya
       jo bahar click karne pe calculator band karta tha. */
  }

  /* =========================================================
     KEYBOARD
     ========================================================= */

  function bindKeyboard() {
    document.addEventListener("keydown", function (event) {
      var t = event.target;

      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) {
        return;
      }

      if (/^\d$/.test(event.key)) {
        openSizeCalculator();
        appendValue(event.key);
        return;
      }

      if (event.key === ".") {
        openSizeCalculator();
        appendDecimal();
        return;
      }

      if (event.key === "Backspace") {
        backspace();
        return;
      }

      if (event.key === "Enter") {
        addLine();
        return;
      }

      if (event.key === "Escape") {
        clearInput();
      }
    });
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {
    try {
      buildCalculator();
      bindButtons();
      bindKeyboard();
      updateSideUI();
      render();
      closeSizeCalculator();
    } catch (err) {
      console.error("Sheet init failed:", err);

      if (window.Bugs && typeof Bugs.log === "function") {
        Bugs.log("Sheet init failed", err);
      }
    }
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.Sheet = {
    init: init,
    render: render,
    addLine: addLine,
    editLine: editLine,
    deleteLine: deleteLine,
    setLineDirection: setLineDirection,
    setLineAngle: setLineAngle,
    openAnglePicker: openAnglePicker,
    setSide: setSide,
    appendValue: appendValue,
    appendFraction: appendFraction,
    backspace: backspace,
    clear: clearInput,
    cancelEdit: cancelEdit,
    openSizeCalculator: openSizeCalculator,
    closeSizeCalculator: closeSizeCalculator,
    getTotal: getTotal,
    getInputValue: getInputValue,
    setInputValue: setInputValue
  };

})();
