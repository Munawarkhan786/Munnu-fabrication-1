/* =========================================================
   SHEET.JS — INPUT / MARKING LINE CONTROLLER V5
   ---------------------------------------------------------
   - Length / Depth side
   - Number keypad
   - Fraction keypad
   - Current Size calculator open on tap
   - Angle
   - UP / DOWN
   - Add line
   - Edit / Delete / Move
   - Local save
   - Auto redraw
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
      keyword: "",
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
      if (!Array.isArray(state.depLines)) state.depLines = [];
      return state.depLines;
    }

    if (!Array.isArray(state.lenLines)) state.lenLines = [];
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

  function getInputValue() {
    var display = $("display");

    if (!display) return 0;

    if (
      display.tagName === "INPUT" ||
      display.tagName === "TEXTAREA"
    ) {
      return num(display.value);
    }

    return num(display.textContent);
  }

  function setInputValue(value) {
    var display = $("display");
    var state = getState();

    value = num(value);
    state.current = value;

    if (!display) return;

    var text = formatSize(value);

    if (
      display.tagName === "INPUT" ||
      display.tagName === "TEXTAREA"
    ) {
      display.value = text;
    } else {
      display.textContent = text;
    }
  }

  function clearInput() {
    setInputValue(0);

    var error = $("input-error");
    if (error) {
      error.textContent = "";
      error.style.display = "none";
    }
  }

  /* =========================================================
     CALCULATOR OPEN / CLOSE
     ========================================================= */

  function openSizeCalculator() {
    var calc = document.querySelector(".calc-grid");
    var frac = document.querySelector(".frac-grid");

    if (calc) {
      calc.style.display = "grid";
      calc.classList.add("open");
    }

    if (frac) {
      frac.style.display = "grid";
      frac.classList.add("open");
    }

    var display = $("display");

    if (display) {
      display.classList.add("active");
      try {
        display.focus();
      } catch (e) {}
    }

    var error = $("input-error");

    if (error) {
      error.textContent = "";
      error.style.display = "none";
    }
  }

  function closeSizeCalculator() {
    var calc = document.querySelector(".calc-grid");
    var frac = document.querySelector(".frac-grid");

    if (calc) {
      calc.classList.remove("open");
    }

    if (frac) {
      frac.classList.remove("open");
    }

    var display = $("display");

    if (display) {
      display.classList.remove("active");
    }
  }

  /* =========================================================
     ACTIVE SIDE
     ========================================================= */

  function setSide(side) {
    var state = getState();

    state.activeSide = side === "dep" ? "dep" : "len";
    state.current = 0;

    updateSideUI();
    clearInput();

    openSizeCalculator();
  }

  function updateSideUI() {
    var state = getState();

    var lenBtn = $("side-len");
    var depBtn = $("side-dep");

    if (lenBtn) {
      lenBtn.classList.toggle("active", state.activeSide === "len");
    }

    if (depBtn) {
      depBtn.classList.toggle("active", state.activeSide === "dep");
    }
  }

  /* =========================================================
     NUMBER ENTRY
     ========================================================= */

  function appendValue(value) {
    var state = getState();
    var current = getInputValue();

    value = String(value);

    if (!/^\d$/.test(value)) return;

    /*
      Agar current 0 hai:
      0 + 5 = 5
    */

    if (current === 0) {
      setInputValue(parseInt(value, 10));
      return;
    }

    /*
      Existing decimal/fraction value ko string ke through
      continue karne ke liye.
    */

    var display = $("display");

    if (!display) return;

    var oldText =
      display.tagName === "INPUT" ||
      display.tagName === "TEXTAREA"
        ? display.value
        : display.textContent;

    oldText = String(oldText || "").trim();

    /*
      Agar sirf 0 hai.
    */
    if (oldText === "0" || oldText === "0.0") {
      oldText = "";
    }

    /*
      Number ko directly append.
    */
    var next = oldText + value;

    var parsed = parseFloat(next);

    if (Number.isFinite(parsed)) {
      state.current = parsed;

      if (
        display.tagName === "INPUT" ||
        display.tagName === "TEXTAREA"
      ) {
        display.value = next;
      } else {
        display.textContent = next;
      }
    }
  }

  function backspace() {
    var display = $("display");

    if (!display) return;

    var text =
      display.tagName === "INPUT" ||
      display.tagName === "TEXTAREA"
        ? display.value
        : display.textContent;

    text = String(text || "").trim();

    if (!text || text === "0") {
      clearInput();
      return;
    }

    text = text.slice(0, -1);

    if (!text || text === "-") {
      text = "0";
    }

    var value = parseFloat(text);

    if (!Number.isFinite(value)) {
      value = 0;
    }

    setInputValue(value);
  }

  function clearCalculator() {
    clearInput();
  }

  /* =========================================================
     DECIMAL
     ========================================================= */

  function appendDecimal() {
    var display = $("display");

    if (!display) return;

    var text =
      display.tagName === "INPUT" ||
      display.tagName === "TEXTAREA"
        ? display.value
        : display.textContent;

    text = String(text || "").trim();

    if (text.indexOf(".") !== -1) return;

    if (!text || text === "0") {
      text = "0.";
    } else {
      text += ".";
    }

    if (
      display.tagName === "INPUT" ||
      display.tagName === "TEXTAREA"
    ) {
      display.value = text;
    } else {
      display.textContent = text;
    }
  }

  /* =========================================================
     FRACTION
     ========================================================= */

  function appendFraction(fraction) {
    var display = $("display");

    if (!display) return;

    fraction = String(fraction || "").trim();

    if (!fraction) return;

    var currentText =
      display.tagName === "INPUT" ||
      display.tagName === "TEXTAREA"
        ? display.value
        : display.textContent;

    currentText = String(currentText || "").trim();

    var whole = parseFloat(currentText);

    /*
      Agar current value decimal/fraction style nahi hai,
      whole number ko preserve.
    */

    if (!Number.isFinite(whole)) {
      whole = 0;
    }

    var fractionValue = parseFloat(fraction);

    if (!Number.isFinite(fractionValue)) return;

    var result = whole + fractionValue;

    setInputValue(result);
  }

  /* =========================================================
     PARSE SIZE
     ========================================================= */

  function parseSize(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    var text = String(value || "")
      .trim()
      .replace(/"/g, "");

    if (!text) return 0;

    /*
      Mixed fraction:
      15 5/8
    */

    var mixed = text.match(
      /^(-?\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/
    );

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

    /*
      Simple fraction:
      5/8
    */

    var frac = text.match(
      /^(-?\d+)\s*\/\s*(\d+)$/
    );

    if (frac) {
      var a = parseFloat(frac[1]);
      var b = parseFloat(frac[2]);

      if (
        Number.isFinite(a) &&
        Number.isFinite(b) &&
        b !== 0
      ) {
        return a / b;
      }
    }

    /*
      Normal number.
    */

    var n = parseFloat(text);

    return Number.isFinite(n) ? n : 0;
  }

  /* =========================================================
     ANGLE / DIRECTION
     ========================================================= */

  function getSelectedAngle() {
    var select = $("angle-select");

    if (!select) return 90;

    var angle = parseFloat(select.value);

    if (!Number.isFinite(angle)) {
      angle = 90;
    }

    return angle;
  }

  function getSelectedDirection() {
    var up = $("direction-up");

    if (up && up.classList.contains("active")) {
      return "UP";
    }

    return "DOWN";
  }

  function setDirectionUI(direction) {
    var up = $("direction-up");
    var down = $("direction-down");

    direction = String(direction || "UP").toUpperCase();

    if (up) {
      up.classList.toggle("active", direction === "UP");
    }

    if (down) {
      down.classList.toggle("active", direction === "DOWN");
    }
  }

  /* =========================================================
     ADD LINE
     ========================================================= */

  function addLine() {
    var state = getState();

    var value = getInputValue();
    var size = parseSize(value);

    if (!Number.isFinite(size) || size <= 0) {
      showMessage("Size daalo.", true);
      openSizeCalculator();
      return false;
    }

    var side = getActiveSide();
    var angle = getSelectedAngle();
    var direction = getSelectedDirection();

    var lines = getLines(side);

    /*
      EDIT MODE
    */

    if (state.editMode && state.editingLine) {
      var editIndex = state.editingLine.index;

      if (
        Number.isInteger(editIndex) &&
        editIndex >= 0 &&
        editIndex < lines.length
      ) {
        lines[editIndex].size = size;
        lines[editIndex].angle = angle;
        lines[editIndex].direction = direction;

        state.editMode = false;
        state.editingLine = null;

        setLines(side, lines);

        render();
        save();
        redraw();

        showMessage("Line updated.", false);

        clearInput();
        closeSizeCalculator();

        return true;
      }
    }

    /*
      NEW LINE
    */

    var prefix = side === "dep" ? "D" : "L";

    var line = {
      id: prefix + (lines.length + 1),
      index: lines.length,
      size: size,
      angle: angle,
      direction: direction
    };

    lines.push(line);

    /*
      Re-number.
    */

    renumberLines(side);

    setLines(side, lines);

    render();
    save();
    redraw();

    clearInput();

    showMessage(
      prefix + lines.length + " added.",
      false
    );

    closeSizeCalculator();

    return true;
  }

  /* =========================================================
     EDIT
     ========================================================= */

  function editLine(side, index) {
    var state = getState();

    var lines = getLines(side);

    index = parseInt(index, 10);

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= lines.length
    ) {
      return;
    }

    var line = lines[index];

    state.activeSide = side;
    state.editMode = true;

    state.editingLine = {
      side: side,
      index: index
    };

    setSide(side);

    setInputValue(line.size);

    var angleSelect = $("angle-select");

    if (angleSelect) {
      angleSelect.value = String(line.angle || 90);
    }

    setDirectionUI(line.direction || "UP");

    var bar = $("edit-bar");
    var info = $("edit-info");

    if (bar) {
      bar.style.display = "block";
    }

    if (info) {
      info.textContent =
        "Editing " +
        (side === "dep" ? "D" : "L") +
        (index + 1);
    }

    openSizeCalculator();
  }

  /* =========================================================
     DELETE
     ========================================================= */

  function deleteLine(side, index) {
    var lines = getLines(side);

    index = parseInt(index, 10);

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= lines.length
    ) {
      return;
    }

    lines.splice(index, 1);

    setLines(side, lines);

    renumberLines(side);

    render();
    save();
    redraw();
  }

  /* =========================================================
     MOVE UP
     ========================================================= */

  function moveUp(side, index) {
    var lines = getLines(side);

    index = parseInt(index, 10);

    if (
      !Number.isInteger(index) ||
      index <= 0 ||
      index >= lines.length
    ) {
      return;
    }

    var temp = lines[index];

    lines[index] = lines[index - 1];
    lines[index - 1] = temp;

    setLines(side, lines);

    renumberLines(side);

    render();
    save();
    redraw();
  }

  /* =========================================================
     MOVE DOWN
     ========================================================= */

  function moveDown(side, index) {
    var lines = getLines(side);

    index = parseInt(index, 10);

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= lines.length - 1
    ) {
      return;
    }

    var temp = lines[index];

    lines[index] = lines[index + 1];
    lines[index + 1] = temp;

    setLines(side, lines);

    renumberLines(side);

    render();
    save();
    redraw();
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

    setLines(side, lines);
  }

  /* =========================================================
     RENDER ALL
     ========================================================= */

  function render() {
    renderList(
      "len",
      $("len-lines-list")
    );

    renderList(
      "dep",
      $("dep-lines-list")
    );

    updateTotals();
    updateSideUI();
  }

  /* =========================================================
     RENDER LIST
     ========================================================= */

  function renderList(side, container) {
    if (!container) return;

    var lines = getLines(side);

    container.innerHTML = "";

    if (!lines.length) {
      var empty = document.createElement("div");

      empty.className = "empty-lines";

      empty.textContent =
        side === "dep"
          ? "No depth lines"
          : "No length lines";

      container.appendChild(empty);

      return;
    }

    lines.forEach(function (line, index) {
      var row = document.createElement("div");

      row.className = "line-row";

      row.dataset.side = side;
      row.dataset.index = index;

      var name = document.createElement("span");

      name.className = "line-name";

      name.textContent =
        (side === "dep" ? "D" : "L") +
        (index + 1);

      var size = document.createElement("span");

      size.className = "line-size";

      size.textContent =
        formatSize(line.size) + '"';

      var angle = document.createElement("span");

      angle.className = "line-angle";

      angle.textContent =
        String(line.angle || 90) + "°";

      var direction = document.createElement("span");

      direction.className = "line-direction";

      direction.textContent =
        line.direction === "DOWN"
          ? "DOWN"
          : "UP";

      var edit = document.createElement("button");

      edit.type = "button";
      edit.className = "line-btn";
      edit.textContent = "EDIT";

      edit.addEventListener(
        "click",
        function () {
          editLine(side, index);
        }
      );

      var up = document.createElement("button");

      up.type = "button";
      up.className = "line-btn";
      up.textContent = "↑";

      up.addEventListener(
        "click",
        function () {
          moveUp(side, index);
        }
      );

      var down = document.createElement("button");

      down.type = "button";
      down.className = "line-btn";
      down.textContent = "↓";

      down.addEventListener(
        "click",
        function () {
          moveDown(side, index);
        }
      );

      var del = document.createElement("button");

      del.type = "button";
      del.className = "line-btn delete";
      del.textContent = "✕";

      del.addEventListener(
        "click",
        function () {
          deleteLine(side, index);
        }
      );

      row.appendChild(name);
      row.appendChild(size);
      row.appendChild(angle);
      row.appendChild(direction);
      row.appendChild(edit);
      row.appendChild(up);
      row.appendChild(down);
      row.appendChild(del);

      container.appendChild(row);
    });
  }

  /* =========================================================
     TOTALS
     ========================================================= */

  function getTotal(side) {
    var lines = getLines(side);

    return lines.reduce(
      function (total, line) {
        return total + num(line.size);
      },
      0
    );
  }

  function updateTotals() {
    var total = getTotal(getActiveSide());

    var totalEl = $("total-value");

    if (totalEl) {
      totalEl.textContent =
        formatSize(total) + '"';
    }
  }

  /* =========================================================
     SAVE
     ========================================================= */

  function save() {
    var state = getState();

    try {
      if (
        window.Core &&
        typeof Core.saveData === "function"
      ) {
        Core.saveData(state);
      } else {
        localStorage.setItem(
          "sheetMarking_v7",
          JSON.stringify(state)
        );
      }

      var status = $("saveStatus");

      if (status) {
        status.textContent = "Saved";
      }
    } catch (err) {
      if (
        window.Bugs &&
        typeof Bugs.log === "function"
      ) {
        Bugs.log(
          "Sheet save failed",
          err
        );
      }
    }
  }

  /* =========================================================
     REDRAW
     ========================================================= */

  function redraw() {
    try {
      if (
        window.Flat &&
        typeof Flat.render === "function"
      ) {
        Flat.render();
      } else if (
        window.FlatView &&
        typeof FlatView.render === "function"
      ) {
        FlatView.render();
      }
    } catch (err) {
      if (
        window.Bugs &&
        typeof Bugs.log === "function"
      ) {
        Bugs.log(
          "Flat redraw failed",
          err
        );
      }
    }

    try {
      if (
        window.ThreeD &&
        typeof ThreeD.render === "function"
      ) {
        ThreeD.render();
      }
    } catch (err) {
      if (
        window.Bugs &&
        typeof Bugs.log === "function"
      ) {
        Bugs.log(
          "3D redraw failed",
          err
        );
      }
    }

    try {
      if (
        window.Result &&
        typeof Result.render === "function"
      ) {
        Result.render();
      }
    } catch (err) {
      if (
        window.Bugs &&
        typeof Bugs.log === "function"
      ) {
        Bugs.log(
          "Result redraw failed",
          err
        );
      }
    }
  }

  /* =========================================================
     MESSAGE
     ========================================================= */

  function showMessage(message, isError) {
    var el = $("input-error");

    if (!el) return;

    el.textContent = message || "";

    el.style.display =
      message ? "block" : "none";

    if (isError) {
      el.classList.add("error");
    } else {
      el.classList.remove("error");
    }
  }

  /* =========================================================
     CANCEL EDIT
     ========================================================= */

  function cancelEdit() {
    var state = getState();

    state.editMode = false;
    state.editingLine = null;

    clearInput();

    var bar = $("edit-bar");

    if (bar) {
      bar.style.display = "none";
    }

    render();
    closeSizeCalculator();
  }

  /* =========================================================
     BUTTON BINDING
     ========================================================= */

  function bindButtons() {

    /* -----------------------------------------
       SIDE BUTTONS
       ----------------------------------------- */

    var sideLen = $("side-len");

    if (sideLen) {
      sideLen.addEventListener(
        "click",
        function () {
          setSide("len");
        }
      );
    }

    var sideDep = $("side-dep");

    if (sideDep) {
      sideDep.addEventListener(
        "click",
        function () {
          setSide("dep");
        }
      );
    }

    /* -----------------------------------------
       CURRENT SIZE DISPLAY
       TAP = OPEN CALCULATOR
       ----------------------------------------- */

    var display = $("display");

    if (display) {

      display.addEventListener(
        "click",
        function () {
          openSizeCalculator();
        }
      );

      display.addEventListener(
        "focus",
        function () {
          openSizeCalculator();
        }
      );

      display.addEventListener(
        "touchstart",
        function () {
          openSizeCalculator();
        },
        {
          passive: true
        }
      );
    }

    /* -----------------------------------------
       ADD
       ----------------------------------------- */

    var add = $("btn-add");

    if (add) {
      add.addEventListener(
        "click",
        function () {
          addLine();
        }
      );
    }

    /* -----------------------------------------
       OK
       ----------------------------------------- */

    var ok = $("btn-ok");

    if (ok) {
      ok.addEventListener(
        "click",
        function () {
          addLine();
        }
      );
    }

    /* -----------------------------------------
       CLEAR
       ----------------------------------------- */

    var clear = $("btn-clear");

    if (clear) {
      clear.addEventListener(
        "click",
        function () {
          clearCalculator();
        }
      );
    }

    /* -----------------------------------------
       EDIT CANCEL
       ----------------------------------------- */

    var cancelEditBtn =
      $("btn-cancel-edit");

    if (cancelEditBtn) {
      cancelEditBtn.addEventListener(
        "click",
        function () {
          cancelEdit();
        }
      );
    }

    /* -----------------------------------------
       EDIT SAVE
       ----------------------------------------- */

    var saveEdit =
      $("btn-save-edit");

    if (saveEdit) {
      saveEdit.addEventListener(
        "click",
        function () {
          addLine();
        }
      );
    }

    /* -----------------------------------------
       DIGITS
       ----------------------------------------- */

    document
      .querySelectorAll("[data-digit]")
      .forEach(function (btn) {

        btn.addEventListener(
          "click",
          function () {
            openSizeCalculator();

            appendValue(
              btn.getAttribute(
                "data-digit"
              )
            );
          }
        );

      });

    /* -----------------------------------------
       FRACTIONS
       ----------------------------------------- */

    document
      .querySelectorAll("[data-fraction]")
      .forEach(function (btn) {

        btn.addEventListener(
          "click",
          function () {
            openSizeCalculator();

            appendFraction(
              btn.getAttribute(
                "data-fraction"
              )
            );
          }
        );

      });

    /* -----------------------------------------
       BACKSPACE
       ----------------------------------------- */

    var backspaceBtn =
      $("btn-backspace");

    if (backspaceBtn) {
      backspaceBtn.addEventListener(
        "click",
        function () {
          backspace();
        }
      );
    }

    /* -----------------------------------------
       DECIMAL
       ----------------------------------------- */

    var decimalBtn =
      $("btn-decimal");

    if (decimalBtn) {
      decimalBtn.addEventListener(
        "click",
        function () {
          appendDecimal();
        }
      );
    }

    /* -----------------------------------------
       DIRECTION
       ----------------------------------------- */

    var directionUp =
      $("direction-up");

    var directionDown =
      $("direction-down");

    if (directionUp) {
      directionUp.addEventListener(
        "click",
        function () {
          setDirectionUI("UP");
        }
      );
    }

    if (directionDown) {
      directionDown.addEventListener(
        "click",
        function () {
          setDirectionUI("DOWN");
        }
      );
    }

    /* -----------------------------------------
       ANGLE
       ----------------------------------------- */

    var angleSelect =
      $("angle-select");

    if (angleSelect) {
      angleSelect.addEventListener(
        "change",
        function () {
          var value =
            parseFloat(angleSelect.value);

          if (!Number.isFinite(value)) {
            value = 90;
          }

          angleSelect.value =
            String(value);
        }
      );
    }
  }

  /* =========================================================
     KEYBOARD
     ========================================================= */

  function bindKeyboard() {
    document.addEventListener(
      "keydown",
      function (event) {

        /*
          Ignore keyboard when typing in
          normal input fields.
        */

        var target = event.target;

        if (
          target &&
          (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT"
          ) &&
          target.id !== "display"
        ) {
          return;
        }

        if (/^\d$/.test(event.key)) {
          openSizeCalculator();
          appendValue(event.key);
          event.preventDefault();
          return;
        }

        if (event.key === ".") {
          appendDecimal();
          event.preventDefault();
          return;
        }

        if (
          event.key === "Backspace"
        ) {
          backspace();
          event.preventDefault();
          return;
        }

        if (
          event.key === "Enter"
        ) {
          addLine();
          event.preventDefault();
          return;
        }

        if (
          event.key === "Escape"
        ) {
          clearCalculator();
          event.preventDefault();
        }
      }
    );
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {
    try {
      bindButtons();
      bindKeyboard();

      updateSideUI();
      render();

      /*
        Calculator initially open.
        Isse user ko directly size entry dikhegi.
      */

      openSizeCalculator();

    } catch (err) {

      if (
        window.Bugs &&
        typeof Bugs.log === "function"
      ) {
        Bugs.log(
          "Sheet init failed",
          err
        );
      }

      console.error(
        "Sheet init failed:",
        err
      );
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

    moveUp: moveUp,

    moveDown: moveDown,

    setSide: setSide,

    appendValue: appendValue,

    appendFraction: appendFraction,

    backspace: backspace,

    clear: clearCalculator,

    cancelEdit: cancelEdit,

    openSizeCalculator:
      openSizeCalculator,

    closeSizeCalculator:
      closeSizeCalculator,

    getTotal: getTotal,

    getInputValue: getInputValue,

    setInputValue: setInputValue
  };

})();
