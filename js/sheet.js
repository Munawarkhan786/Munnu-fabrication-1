/* =========================================================
   SHEET.JS — INPUT / MARKING LINE CONTROLLER V7
   ---------------------------------------------------------
   Keypad is created automatically because index.html
   contains empty #calc-grid and #frac-grid containers.

   V7 CHANGE:
   - Keypad ab STARTUP par band rahega.
   - User "Current Size" (0) par CLICK karega tabhi khulega.
   - Keypad ke bahar click karne par BAND ho jayega.
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

    if (
      window.Core &&
      typeof Core.formatInch === "function"
    ) {
      try {
        return Core.formatInch(n);
      } catch (e) {}
    }

    return String(
      Math.round(n * 10000) / 10000
    );
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
    return getState().activeSide === "dep"
      ? "dep"
      : "len";
  }

  /* =========================================================
     INPUT DISPLAY
     ========================================================= */

  function getInputText() {
    var display = $("display");

    if (!display) return "0";

    return String(
      display.textContent || "0"
    ).trim();
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

    setInputText(
      formatSize(value)
    );
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
      return Number.isFinite(value)
        ? value
        : 0;
    }

    var text = String(value || "")
      .trim()
      .replace(/"/g, "");

    if (!text) return 0;

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
        return (
          whole +
          numerator / denominator
        );
      }
    }

    var fraction = text.match(
      /^(-?\d+)\s*\/\s*(\d+)$/
    );

    if (fraction) {
      var a = parseFloat(fraction[1]);
      var b = parseFloat(fraction[2]);

      if (
        Number.isFinite(a) &&
        Number.isFinite(b) &&
        b !== 0
      ) {
        return a / b;
      }
    }

    var n = parseFloat(text);

    return Number.isFinite(n)
      ? n
      : 0;
  }

  /* =========================================================
     BUILD KEYPAD
     ========================================================= */

  function buildCalculator() {

    var calc = $("calc-grid");
    var frac = $("frac-grid");

    if (!calc || !frac) {
      console.error(
        "Calculator containers missing"
      );
      return;
    }

    /* -----------------------------------------
       NUMBER KEYPAD
       ----------------------------------------- */

    calc.innerHTML = "";

    var numbers = [
      "7", "8", "9",
      "4", "5", "6",
      "1", "2", "3",
      "0", ".", "⌫",
      "C"
    ];

    numbers.forEach(function (value) {

      var btn =
        document.createElement("button");

      btn.type = "button";
      btn.className = "calc-btn";

      btn.textContent = value;

      if (value === "C") {
        btn.classList.add("clear");
      }

      if (value === "⌫") {
        btn.classList.add("backspace");
      }

      btn.addEventListener(
        "click",
        function () {

          if (value === "C") {
            clearInput();
            return;
          }

          if (value === "⌫") {
            backspace();
            return;
          }

          if (value === ".") {
            appendDecimal();
            return;
          }

          appendValue(value);
        }
      );

      calc.appendChild(btn);
    });

    /* -----------------------------------------
       FRACTION KEYPAD
       ----------------------------------------- */

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

    fractions.forEach(
      function (item) {

        var btn =
          document.createElement("button");

        btn.type = "button";
        btn.className = "frac-btn";

        btn.textContent = item[0];

        btn.addEventListener(
          "click",
          function () {
            appendFraction(
              item[1]
            );
          }
        );

        frac.appendChild(btn);
      }
    );

    /* -----------------------------------------
       DEFAULT: KEYPAD BAND RAKHO
       ----------------------------------------- */

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

    if (display) {
      display.classList.add("active");
    }
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

    if (display) {
      display.classList.remove("active");
    }
  }

  /* =========================================================
     NUMBER ENTRY
     ========================================================= */

  function appendValue(value) {

    value = String(value);

    if (!/^\d$/.test(value)) {
      return;
    }

    var text = getInputText();

    if (
      text === "0" ||
      text === ""
    ) {
      setInputText(value);
      return;
    }

    var next = text + value;

    setInputText(next);
  }

  /* =========================================================
     DECIMAL
     ========================================================= */

  function appendDecimal() {

    var text = getInputText();

    if (text.indexOf(".") !== -1) {
      return;
    }

    if (
      text === "" ||
      text === "0"
    ) {
      setInputText("0.");
      return;
    }

    setInputText(
      text + "."
    );
  }

  /* =========================================================
     BACKSPACE
     ========================================================= */

  function backspace() {

    var text = getInputText();

    if (
      !text ||
      text === "0"
    ) {
      clearInput();
      return;
    }

    text = text.slice(0, -1);

    if (!text) {
      text = "0";
    }

    setInputText(text);
  }

  /* =========================================================
     FRACTION
     ========================================================= */

  function appendFraction(value) {

    value = num(value);

    if (!Number.isFinite(value)) {
      return;
    }

    var text = getInputText();

    var whole = parseFloat(text);

    if (
      !Number.isFinite(whole) ||
      text === "0"
    ) {
      whole = 0;
    }

    var result =
      whole + value;

    setInputValue(result);
  }

  /* =========================================================
     SIDE
     ========================================================= */

  function setSide(side) {

    var state = getState();

    state.activeSide =
      side === "dep"
        ? "dep"
        : "len";

    state.current = 0;

    updateSideUI();
    clearInput();
    // NOTE: Yahan keypad NAHI khulega.
    // User ko "Current Size" par click karna padega.
  }

  function updateSideUI() {

    var state = getState();

    var len = $("side-len");
    var dep = $("side-dep");

    if (len) {
      len.classList.toggle(
        "active",
        state.activeSide === "len"
      );
    }

    if (dep) {
      dep.classList.toggle(
        "active",
        state.activeSide === "dep"
      );
    }
  }

  /* =========================================================
     ANGLE
     ========================================================= */

  function getSelectedAngle() {

    var select =
      $("angle-select");

    if (!select) return 90;

    var angle =
      parseFloat(select.value);

    return Number.isFinite(angle)
      ? angle
      : 90;
  }

  /* =========================================================
     DIRECTION
     ========================================================= */

  function getSelectedDirection() {

    var up =
      $("direction-up");

    if (
      up &&
      up.classList.contains("active")
    ) {
      return "UP";
    }

    return "DOWN";
  }

  function setDirectionUI(direction) {

    var up =
      $("direction-up");

    var down =
      $("direction-down");

    direction =
      String(direction || "UP")
        .toUpperCase();

    if (up) {
      up.classList.toggle(
        "active",
        direction === "UP"
      );
    }

    if (down) {
      down.classList.toggle(
        "active",
        direction === "DOWN"
      );
    }
  }

  /* =========================================================
     ADD LINE
     ========================================================= */

  function addLine() {

    var state = getState();

    var size =
      getInputValue();

    if (
      !Number.isFinite(size) ||
      size <= 0
    ) {
      showMessage(
        "Size daalo.",
        true
      );

      openSizeCalculator();

      return false;
    }

    var side =
      getActiveSide();

    var angle =
      getSelectedAngle();

    var direction =
      getSelectedDirection();

    var lines =
      getLines(side);

    /* -----------------------------------------
       EDIT
       ----------------------------------------- */

    if (
      state.editMode &&
      state.editingLine
    ) {

      var editIndex =
        state.editingLine.index;

      if (
        editIndex >= 0 &&
        editIndex < lines.length
      ) {

        lines[editIndex].size =
          size;

        lines[editIndex].angle =
          angle;

        lines[editIndex].direction =
          direction;

        state.editMode =
          false;

        state.editingLine =
          null;

        setLines(
          side,
          lines
        );

        hideEditBar();

        render();
        save();
        redraw();

        clearInput();
        closeSizeCalculator();

        return true;
      }
    }

    /* -----------------------------------------
       NEW LINE
       ----------------------------------------- */

    var prefix =
      side === "dep"
        ? "D"
        : "L";

    lines.push({
      id:
        prefix +
        (lines.length + 1),

      index:
        lines.length,

      size:
        size,

      angle:
        angle,

      direction:
        direction
    });

    renumberLines(side);

    setLines(
      side,
      lines
    );

    render();
    save();
    redraw();

    clearInput();
    closeSizeCalculator();

    showMessage(
      prefix +
      lines.length +
      " added.",
      false
    );

    return true;
  }

  /* =========================================================
     EDIT
     ========================================================= */

  function editLine(
    side,
    index
  ) {

    var state =
      getState();

    var lines =
      getLines(side);

    index =
      parseInt(index, 10);

    if (
      index < 0 ||
      index >= lines.length
    ) {
      return;
    }

    var line =
      lines[index];

    state.activeSide =
      side;

    state.editMode =
      true;

    state.editingLine = {
      side: side,
      index: index
    };

    updateSideUI();

    setInputValue(
      line.size
    );

    var angle =
      $("angle-select");

    if (angle) {
      angle.value =
        String(
          line.angle || 90
        );
    }

    setDirectionUI(
      line.direction || "UP"
    );

    var bar =
      $("edit-bar");

    var info =
      $("edit-info");

    if (bar) {
      bar.classList.remove(
        "hidden"
      );
      bar.style.display =
        "block";
    }

    if (info) {
      info.textContent =
        "Editing " +
        (
          side === "dep"
            ? "D"
            : "L"
        ) +
        (index + 1);
    }

    openSizeCalculator();
  }

  /* =========================================================
     DELETE
     ========================================================= */

  function deleteLine(
    side,
    index
  ) {

    var lines =
      getLines(side);

    index =
      parseInt(index, 10);

    if (
      index < 0 ||
      index >= lines.length
    ) {
      return;
    }

    lines.splice(
      index,
      1
    );

    renumberLines(side);

    setLines(
      side,
      lines
    );

    render();
    save();
    redraw();
  }

  /* =========================================================
     MOVE UP
     ========================================================= */

  function moveUp(
    side,
    index
  ) {

    var lines =
      getLines(side);

    index =
      parseInt(index, 10);

    if (
      index <= 0 ||
      index >= lines.length
    ) {
      return;
    }

    var temp =
      lines[index];

    lines[index] =
      lines[index - 1];

    lines[index - 1] =
      temp;

    renumberLines(side);

    setLines(
      side,
      lines
    );

    render();
    save();
    redraw();
  }

  /* =========================================================
     MOVE DOWN
     ========================================================= */

  function moveDown(
    side,
    index
  ) {

    var lines =
      getLines(side);

    index =
      parseInt(index, 10);

    if (
      index < 0 ||
      index >= lines.length - 1
    ) {
      return;
    }

    var temp =
      lines[index];

    lines[index] =
      lines[index + 1];

    lines[index + 1] =
      temp;

    renumberLines(side);

    setLines(
      side,
      lines
    );

    render();
    save();
    redraw();
  }

  /* =========================================================
     RENUMBER
     ========================================================= */

  function renumberLines(side) {

    var lines =
      getLines(side);

    var prefix =
      side === "dep"
        ? "D"
        : "L";

    lines.forEach(
      function (
        line,
        index
      ) {

        line.id =
          prefix +
          (index + 1);

        line.index =
          index;
      }
    );
  }

  /* =========================================================
     RENDER
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

  function renderList(
    side,
    container
  ) {

    if (!container) {
      return;
    }

    var lines =
      getLines(side);

    container.innerHTML =
      "";

    if (!lines.length) {

      var empty =
        document.createElement(
          "div"
        );

      empty.className =
        "empty-small";

      empty.textContent =
        side === "dep"
          ? "No depth lines"
          : "No length lines";

      container.appendChild(
        empty
      );

      return;
    }

    lines.forEach(
      function (
        line,
        index
      ) {

        var row =
          document.createElement(
            "div"
          );

        row.className =
          "line-row";

        var name =
          document.createElement(
            "span"
          );

        name.className =
          "line-name";

        name.textContent =
          (
            side === "dep"
              ? "D"
              : "L"
          ) +
          (index + 1);

        var size =
          document.createElement(
            "span"
          );

        size.className =
          "line-size";

        size.textContent =
          formatSize(
            line.size
          ) +
          '"';

        var angle =
          document.createElement(
            "span"
          );

        angle.className =
          "line-angle";

        angle.textContent =
          String(
            line.angle || 90
          ) +
          "°";

        var direction =
          document.createElement(
            "span"
          );

        direction.className =
          "line-direction";

        direction.textContent =
          line.direction === "DOWN"
            ? "DOWN"
            : "UP";

        var edit =
          document.createElement(
            "button"
          );

        edit.type =
          "button";

        edit.className =
          "line-btn";

        edit.textContent =
          "EDIT";

        edit.onclick =
          function () {
            editLine(
              side,
              index
            );
          };

        var up =
          document.createElement(
            "button"
          );

        up.type =
          "button";

        up.className =
          "line-btn";

        up.textContent =
          "↑";

        up.onclick =
          function () {
            moveUp(
              side,
              index
            );
          };

        var down =
          document.createElement(
            "button"
          );

        down.type =
          "button";

        down.className =
          "line-btn";

        down.textContent =
          "↓";

        down.onclick =
          function () {
            moveDown(
              side,
              index
            );
          };

        var del =
          document.createElement(
            "button"
          );

        del.type =
          "button";

        del.className =
          "line-btn delete";

        del.textContent =
          "✕";

        del.onclick =
          function () {
            deleteLine(
              side,
              index
            );
          };

        row.appendChild(name);
        row.appendChild(size);
        row.appendChild(angle);
        row.appendChild(direction);
        row.appendChild(edit);
        row.appendChild(up);
        row.appendChild(down);
        row.appendChild(del);

        container.appendChild(
          row
        );
      }
    );
  }

  /* =========================================================
     TOTAL
     ========================================================= */

  function getTotal(side) {

    return getLines(side).reduce(
      function (
        total,
        line
      ) {
        return (
          total +
          num(line.size)
        );
      },
      0
    );
  }

  function updateTotals() {

    var total =
      getTotal(
        getActiveSide()
      );

    var el =
      $("total-value");

    if (el) {
      el.textContent =
        formatSize(total) +
        '"';
    }
  }

  /* =========================================================
     SAVE
     ========================================================= */

  function save() {

    var state =
      getState();

    try {

      if (
        window.Core &&
        typeof Core.saveData ===
          "function"
      ) {

        Core.saveData(
          state
        );

      } else {

        localStorage.setItem(
          "sheetMarking_v7",
          JSON.stringify(
            state
          )
        );
      }

      var status =
        $("saveStatus");

      if (status) {
        status.textContent =
          "💾 Saved";
      }

    } catch (err) {

      console.error(
        "Sheet save failed:",
        err
      );
    }
  }

  /* =========================================================
     REDRAW
     ========================================================= */

  function redraw() {

    try {

      if (
        window.Flat &&
        typeof Flat.draw ===
          "function"
      ) {
        Flat.draw();
      }

    } catch (e) {
      console.error(e);
    }

    try {

      if (
        window.ThreeD &&
        typeof ThreeD.draw ===
          "function"
      ) {
        ThreeD.draw();
      }

    } catch (e) {
      console.error(e);
    }

    try {

      if (
        window.Result &&
        typeof Result.render ===
          "function"
      ) {
        Result.render();
      }

    } catch (e) {
      console.error(e);
    }
  }

  /* =========================================================
     MESSAGE
     ========================================================= */

  function showMessage(
    message,
    isError
  ) {

    var el =
      $("input-error");

    if (!el) return;

    el.textContent =
      message || "";

    el.style.display =
      message
        ? "block"
        : "none";

    if (isError) {
      el.classList.add(
        "error"
      );
    } else {
      el.classList.remove(
        "error"
      );
    }
  }

  /* =========================================================
     EDIT BAR
     ========================================================= */

  function hideEditBar() {

    var bar =
      $("edit-bar");

    if (bar) {
      bar.classList.add(
        "hidden"
      );
      bar.style.display =
        "none";
    }
  }

  function cancelEdit() {

    var state =
      getState();

    state.editMode =
      false;

    state.editingLine =
      null;

    clearInput();
    hideEditBar();
    closeSizeCalculator();
    render();
  }

  /* =========================================================
     BUTTON EVENTS
     ========================================================= */

  function bindButtons() {

    var len =
      $("side-len");

    if (len) {
      len.onclick =
        function () {
          setSide("len");
        };
    }

    var dep =
      $("side-dep");

    if (dep) {
      dep.onclick =
        function () {
          setSide("dep");
        };
    }

    /* -----------------------------------------
       CURRENT SIZE (0) PAR CLICK -> KEYPAD OPEN
       ----------------------------------------- */

    var display =
      $("display");

    if (display) {

      display.onclick =
        function (e) {
          e.stopPropagation();
          openSizeCalculator();
        };

      display.ontouchstart =
        function (e) {
          e.stopPropagation();
          openSizeCalculator();
        };
    }

    /* Add */

    var add =
      $("btn-add");

    if (add) {
      add.onclick =
        function () {
          addLine();
        };
    }

    /* OK */

    var ok =
      $("btn-ok");

    if (ok) {
      ok.onclick =
        function () {
          addLine();
        };
    }

    /* Clear */

    var clear =
      $("btn-clear");

    if (clear) {
      clear.onclick =
        function () {
          clearInput();
        };
    }

    /* Edit save */

    var editSave =
      $("btn-save-edit");

    if (editSave) {
      editSave.onclick =
        function () {
          addLine();
        };
    }

    /* Edit cancel */

    var editCancel =
      $("btn-cancel-edit");

    if (editCancel) {
      editCancel.onclick =
        function () {
          cancelEdit();
        };
    }

    /* Direction */

    var up =
      $("direction-up");

    var down =
      $("direction-down");

    if (up) {
      up.onclick =
        function () {
          setDirectionUI("UP");
        };
    }

    if (down) {
      down.onclick =
        function () {
          setDirectionUI("DOWN");
        };
    }

    /* -----------------------------------------
       KEYPAD KE BAHAR CLICK -> KEYPAD BAND
       ----------------------------------------- */

    document.addEventListener(
      "click",
      function (e) {

        var calc = $("calc-grid");
        var frac = $("frac-grid");
        var display = $("display");

        if (!calc || !frac || !display) return;

        // Agar keypad pehle se band hai toh kuch mat karo
        if (calc.style.display === "none") return;

        // Click keypad ke andar hua?
        if (calc.contains(e.target)) return;
        if (frac.contains(e.target)) return;

        // Click display par hua?
        if (display.contains(e.target)) return;

        // Warna keypad band kar do
        closeSizeCalculator();
      }
    );
  }

  /* =========================================================
     KEYBOARD
     ========================================================= */

  function bindKeyboard() {

    document.addEventListener(
      "keydown",
      function (event) {

        if (/^\d$/.test(event.key)) {
          openSizeCalculator();
          appendValue(
            event.key
          );
          return;
        }

        if (event.key === ".") {
          openSizeCalculator();
          appendDecimal();
          return;
        }

        if (
          event.key ===
          "Backspace"
        ) {
          backspace();
          return;
        }

        if (
          event.key ===
          "Enter"
        ) {
          addLine();
          return;
        }

        if (
          event.key ===
          "Escape"
        ) {
          clearInput();
        }
      }
    );
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {

    try {

      /*
        FIRST create keypad.
      */

      buildCalculator();

      /*
        THEN bind buttons.
      */

      bindButtons();

      bindKeyboard();

      updateSideUI();

      render();

      /*
        Calculator STARTUP par BAND rahega.
        (buildCalculator ke andar closeSizeCalculator call hai)
      */

      closeSizeCalculator();

    } catch (err) {

      console.error(
        "Sheet init failed:",
        err
      );

      if (
        window.Bugs &&
        typeof Bugs.log ===
          "function"
      ) {
        Bugs.log(
          "Sheet init failed",
          err
        );
      }
    }
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.Sheet = {

    init:
      init,

    render:
      render,

    addLine:
      addLine,

    editLine:
      editLine,

    deleteLine:
      deleteLine,

    moveUp:
      moveUp,

    moveDown:
      moveDown,

    setSide:
      setSide,

    appendValue:
      appendValue,

    appendFraction:
      appendFraction,

    backspace:
      backspace,

    clear:
      clearInput,

    cancelEdit:
      cancelEdit,

    openSizeCalculator:
      openSizeCalculator,

    closeSizeCalculator:
      closeSizeCalculator,

    getTotal:
      getTotal,

    getInputValue:
      getInputValue,

    setInputValue:
      setInputValue
  };

})();
