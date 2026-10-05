/* =========================================================
   SHEET — INPUT / MARKING LINE CONTROLLER V4
   Length + Depth + Size + Angle + UP/DOWN

   IMPORTANT:
   - Engineering calculation yahan nahi hoti.
   - GeometryEngine MASTER calculation engine hai.
   - User input yahan state mein save hota hai.
   - Length + Depth dono ek project ka part hain.
   ========================================================= */

(function () {
  "use strict";

  // =========================================================
  // HELPERS
  // =========================================================

  function $(id) {
    return document.getElementById(id);
  }

  function num(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function getState() {
    if (window.AppState) {
      return window.AppState;
    }

    if (window.state) {
      return window.state;
    }

    window.state = {
      activeSide: "len",
      current: 0,
      lenLines: [],
      depLines: [],
      editingLine: null,
      editMode: false
    };

    return window.state;
  }

  function formatSize(value) {
    if (
      window.Core &&
      typeof window.Core.formatInch === "function"
    ) {
      return window.Core.formatInch(value);
    }

    var n = num(value, 0);

    return n
      .toFixed(3)
      .replace(/0+$/, "")
      .replace(/\.$/, "") + '"';
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
    var state = getState();

    return state.activeSide === "dep"
      ? "dep"
      : "len";
  }

  // =========================================================
  // INPUT ELEMENTS
  // =========================================================

  function getInputValue() {
    var display = $("display");

    if (!display) return "";

    return String(
      display.value !== undefined
        ? display.value
        : display.textContent || ""
    ).trim();
  }

  function setInputValue(value) {
    var display = $("display");

    if (!display) return;

    if (
      display.tagName === "INPUT" ||
      display.tagName === "TEXTAREA"
    ) {
      display.value = value;
    } else {
      display.textContent = value;
    }
  }

  function clearInput() {
    setInputValue("");

    var state = getState();

    state.current = 0;
  }

  // =========================================================
  // ACTIVE SIDE
  // =========================================================

  function setSide(side) {
    var state = getState();

    state.activeSide =
      side === "dep"
        ? "dep"
        : "len";

    updateSideUI();
  }

  function updateSideUI() {
    var state = getState();

    var lenButton =
      $("side-len");

    var depButton =
      $("side-dep");

    if (lenButton) {
      lenButton.classList.toggle(
        "active",
        state.activeSide !== "dep"
      );
    }

    if (depButton) {
      depButton.classList.toggle(
        "active",
        state.activeSide === "dep"
      );
    }
  }

  // =========================================================
  // DIGIT INPUT
  // =========================================================

  function appendValue(value) {
    var current =
      getInputValue();

    if (value === undefined) return;

    value = String(value);

    // -------------------------------------------------------
    // Decimal
    // -------------------------------------------------------

    if (value === ".") {
      if (current.indexOf(".") !== -1) {
        return;
      }

      if (!current) {
        current = "0";
      }

      setInputValue(
        current + "."
      );

      return;
    }

    // -------------------------------------------------------
    // Normal number
    // -------------------------------------------------------

    if (
      /^[0-9]$/.test(value)
    ) {
      setInputValue(
        current + value
      );
    }
  }

  function backspace() {
    var current =
      getInputValue();

    setInputValue(
      current.slice(0, -1)
    );
  }

  function clearAllInput() {
    clearInput();
  }

  // =========================================================
  // FRACTION INPUT
  // =========================================================

  function appendFraction(value) {
    var fraction =
      num(value, 0);

    if (fraction <= 0) return;

    var current =
      getInputValue();

    if (!current) {
      setInputValue(
        fraction.toString()
      );

      return;
    }

    // -------------------------------------------------------
    // Existing whole number
    // Example:
    // 15 + 5/8
    // -------------------------------------------------------

    var n =
      Number(current);

    if (isFinite(n)) {
      var whole =
        Math.floor(n);

      var result =
        whole + fraction;

      setInputValue(
        String(result)
      );

      return;
    }

    // -------------------------------------------------------
    // Fallback
    // -------------------------------------------------------

    setInputValue(
      current + fraction
    );
  }

  // =========================================================
  // PARSE SIZE
  // =========================================================

  function parseSize(value) {
    if (
      value === undefined ||
      value === null
    ) {
      return 0;
    }

    var str =
      String(value)
        .trim()
        .replace(/"/g, "");

    if (!str) return 0;

    // -------------------------------------------------------
    // Mixed fraction
    // Example:
    // 15 5/8
    // -------------------------------------------------------

    var mixed =
      str.match(
        /^(-?\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/
      );

    if (mixed) {
      var whole =
        Number(mixed[1]);

      var numerator =
        Number(mixed[2]);

      var denominator =
        Number(mixed[3]);

      if (
        isFinite(whole) &&
        isFinite(numerator) &&
        isFinite(denominator) &&
        denominator !== 0
      ) {
        return (
          whole +
          numerator / denominator
        );
      }
    }

    // -------------------------------------------------------
    // Simple fraction
    // Example:
    // 5/8
    // -------------------------------------------------------

    var fraction =
      str.match(
        /^(-?\d+)\s*\/\s*(\d+)$/
      );

    if (fraction) {
      var a =
        Number(fraction[1]);

      var b =
        Number(fraction[2]);

      if (
        isFinite(a) &&
        isFinite(b) &&
        b !== 0
      ) {
        return a / b;
      }
    }

    // -------------------------------------------------------
    // Normal decimal / number
    // -------------------------------------------------------

    var result =
      Number(str);

    if (isFinite(result)) {
      return result;
    }

    return 0;
  }

  // =========================================================
  // ADD LINE
  // =========================================================

  function addLine() {
    var value =
      parseSize(
        getInputValue()
      );

    if (value <= 0) {
      showMessage(
        "Pehle size enter karo."
      );

      return;
    }

    var state =
      getState();

    var side =
      getActiveSide();

    var lines =
      getLines(side);

    // -------------------------------------------------------
    // Current angle
    // -------------------------------------------------------

    var angle =
      getSelectedAngle();

    // -------------------------------------------------------
    // Direction
    // -------------------------------------------------------

    var direction =
      getSelectedDirection();

    // -------------------------------------------------------
    // Edit mode
    // -------------------------------------------------------

    if (
      state.editMode &&
      state.editingLine
    ) {
      updateExistingLine(
        side,
        state.editingLine,
        value,
        angle,
        direction
      );

      state.editMode = false;
      state.editingLine = null;

      clearInput();

      render();

      save();

      redraw();

      return;
    }

    // -------------------------------------------------------
    // New line
    // -------------------------------------------------------

    var prefix =
      side === "dep"
        ? "D"
        : "L";

    var index =
      lines.length + 1;

    var line = {
      id:
        prefix +
        index,

      side:
        side,

      index:
        index - 1,

      sequence:
        lines.length + 1,

      sizeInch:
        value,

      size:
        value,

      angle:
        angle,

      angleDeg:
        angle,

      direction:
        direction,

      positionInch:
        getPreviousTotal(lines),

      original: {
        sizeInch:
          value,

        angle:
          angle,

        direction:
          direction
      }
    };

    lines.push(line);

    setLines(
      side,
      lines
    );

    state.current =
      value;

    clearInput();

    render();

    save();

    redraw();
  }

  // =========================================================
  // UPDATE LINE
  // =========================================================

  function updateExistingLine(
    side,
    lineId,
    value,
    angle,
    direction
  ) {
    var lines =
      getLines(side);

    for (
      var i = 0;
      i < lines.length;
      i++
    ) {
      if (
        String(lines[i].id) ===
        String(lineId)
      ) {
        lines[i].sizeInch =
          value;

        lines[i].size =
          value;

        lines[i].angle =
          angle;

        lines[i].angleDeg =
          angle;

        lines[i].direction =
          direction;

        if (!lines[i].original) {
          lines[i].original = {};
        }

        lines[i].original.sizeInch =
          value;

        lines[i].original.angle =
          angle;

        lines[i].original.direction =
          direction;

        break;
      }
    }

    setLines(
      side,
      lines
    );
  }

  // =========================================================
  // PREVIOUS TOTAL
  // =========================================================

  function getPreviousTotal(lines) {
    var total = 0;

    for (
      var i = 0;
      i < lines.length;
      i++
    ) {
      total +=
        num(
          lines[i].sizeInch,
          num(
            lines[i].size,
            0
          )
        );
    }

    return total;
  }

  // =========================================================
  // GET ANGLE
  // =========================================================

  function getSelectedAngle() {
    var select =
      $("angle-select");

    if (select) {
      var value =
        Number(select.value);

      if (isFinite(value)) {
        return value;
      }
    }

    // -------------------------------------------------------
    // Alternative IDs
    // -------------------------------------------------------

    var angleInput =
      $("angle");

    if (angleInput) {
      var angle =
        Number(angleInput.value);

      if (isFinite(angle)) {
        return angle;
      }
    }

    // -------------------------------------------------------
    // Default
    // -------------------------------------------------------

    return 90;
  }

  // =========================================================
  // GET DIRECTION
  // =========================================================

  function getSelectedDirection() {
    var up =
      $("direction-up");

    var down =
      $("direction-down");

    if (
      down &&
      down.classList.contains("active")
    ) {
      return "DOWN";
    }

    if (
      up &&
      up.classList.contains("active")
    ) {
      return "UP";
    }

    var select =
      $("direction-select");

    if (select) {
      var value =
        String(
          select.value || "UP"
        ).toUpperCase();

      return value === "DOWN"
        ? "DOWN"
        : "UP";
    }

    return "UP";
  }

  // =========================================================
  // EDIT LINE
  // =========================================================

  function editLine(
    side,
    lineId
  ) {
    var state =
      getState();

    var lines =
      getLines(side);

    var line = null;

    for (
      var i = 0;
      i < lines.length;
      i++
    ) {
      if (
        String(lines[i].id) ===
        String(lineId)
      ) {
        line = lines[i];
        break;
      }
    }

    if (!line) return;

    state.activeSide =
      side;

    state.editMode =
      true;

    state.editingLine =
      line.id;

    setInputValue(
      String(
        line.sizeInch ||
        line.size ||
        ""
      )
    );

    setAngleUI(
      line.angle ||
      line.angleDeg ||
      90
    );

    setDirectionUI(
      line.direction ||
      "UP"
    );

    updateSideUI();

    var editBar =
      $("edit-bar");

    if (editBar) {
      editBar.style.display =
        "flex";
    }

    render();
  }

  // =========================================================
  // DELETE LINE
  // =========================================================

  function deleteLine(
    side,
    lineId
  ) {
    var lines =
      getLines(side);

    var result = [];

    for (
      var i = 0;
      i < lines.length;
      i++
    ) {
      if (
        String(lines[i].id) !==
        String(lineId)
      ) {
        result.push(
          lines[i]
        );
      }
    }

    renumberLines(
      result,
      side
    );

    setLines(
      side,
      result
    );

    var state =
      getState();

    if (
      String(
        state.editingLine
      ) ===
      String(lineId)
    ) {
      state.editMode =
        false;

      state.editingLine =
        null;
    }

    render();

    save();

    redraw();
  }

  // =========================================================
  // MOVE LINE UP
  // =========================================================

  function moveUp(
    side,
    lineId
  ) {
    var lines =
      getLines(side);

    for (
      var i = 1;
      i < lines.length;
      i++
    ) {
      if (
        String(lines[i].id) ===
        String(lineId)
      ) {
        var temp =
          lines[i - 1];

        lines[i - 1] =
          lines[i];

        lines[i] =
          temp;

        break;
      }
    }

    renumberLines(
      lines,
      side
    );

    setLines(
      side,
      lines
    );

    save();

    render();

    redraw();
  }

  // =========================================================
  // MOVE LINE DOWN
  // =========================================================

  function moveDown(
    side,
    lineId
  ) {
    var lines =
      getLines(side);

    for (
      var i = 0;
      i < lines.length - 1;
      i++
    ) {
      if (
        String(lines[i].id) ===
        String(lineId)
      ) {
        var temp =
          lines[i + 1];

        lines[i + 1] =
          lines[i];

        lines[i] =
          temp;

        break;
      }
    }

    renumberLines(
      lines,
      side
    );

    setLines(
      side,
      lines
    );

    save();

    render();

    redraw();
  }

  // =========================================================
  // RENUMBER
  // =========================================================

  function renumberLines(
    lines,
    side
  ) {
    var prefix =
      side === "dep"
        ? "D"
        : "L";

    for (
      var i = 0;
      i < lines.length;
      i++
    ) {
      lines[i].id =
        prefix +
        (i + 1);

      lines[i].index =
        i;

      lines[i].sequence =
        i + 1;
    }
  }

  // =========================================================
  // RENDER LIST
  // =========================================================

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

  // =========================================================
  // RENDER ONE LIST
  // =========================================================

  function renderList(
    side,
    container
  ) {
    if (!container) return;

    var lines =
      getLines(side);

    if (!lines.length) {
      container.innerHTML =
        '<div class="empty-lines">' +
        "No lines" +
        "</div>";

      return;
    }

    var html = "";

    for (
      var i = 0;
      i < lines.length;
      i++
    ) {
      var line =
        lines[i];

      var id =
        line.id ||
        (
          side === "dep"
            ? "D"
            : "L"
        ) +
        (i + 1);

      var size =
        num(
          line.sizeInch,
          num(
            line.size,
            0
          )
        );

      var angle =
        num(
          line.angle,
          num(
            line.angleDeg,
            90
          )
        );

      var direction =
        String(
          line.direction ||
          "UP"
        ).toUpperCase();

      html +=
        '<div class="sheet-line-row">';

      html +=
        '<div class="sheet-line-main">';

      html +=
        '<strong>' +
        id +
        "</strong>";

      html +=
        '<span>' +
        formatSize(size) +
        "</span>";

      html +=
        '<span>' +
        angle +
        "°" +
        "</span>";

      html +=
        '<span class="' +
        (
          direction === "DOWN"
            ? "direction-down"
            : "direction-up"
        ) +
        '">' +
        direction +
        "</span>";

      html +=
        "</div>";

      html +=
        '<div class="sheet-line-actions">';

      html +=
        '<button type="button" ' +
        'data-sheet-action="edit" ' +
        'data-sheet-side="' +
        side +
        '" ' +
        'data-sheet-id="' +
        id +
        '">' +
        "EDIT" +
        "</button>";

      html +=
        '<button type="button" ' +
        'data-sheet-action="up" ' +
        'data-sheet-side="' +
        side +
        '" ' +
        'data-sheet-id="' +
        id +
        '">' +
        "↑" +
        "</button>";

      html +=
        '<button type="button" ' +
        'data-sheet-action="down" ' +
        'data-sheet-side="' +
        side +
        '" ' +
        'data-sheet-id="' +
        id +
        '">' +
        "↓" +
        "</button>";

      html +=
        '<button type="button" ' +
        'data-sheet-action="delete" ' +
        'data-sheet-side="' +
        side +
        '" ' +
        'data-sheet-id="' +
        id +
        '">' +
        "✕" +
        "</button>";

      html +=
        "</div>";

      html +=
        "</div>";
    }

    container.innerHTML =
      html;

    bindListButtons(
      container
    );
  }

  // =========================================================
  // LIST BUTTONS
  // =========================================================

  function bindListButtons(
    container
  ) {
    var buttons =
      container.querySelectorAll(
        "[data-sheet-action]"
      );

    for (
      var i = 0;
      i < buttons.length;
      i++
    ) {
      buttons[i].onclick =
        function () {
          var action =
            this.getAttribute(
              "data-sheet-action"
            );

          var side =
            this.getAttribute(
              "data-sheet-side"
            );

          var id =
            this.getAttribute(
              "data-sheet-id"
            );

          if (action === "edit") {
            editLine(
              side,
              id
            );
          }

          if (action === "up") {
            moveUp(
              side,
              id
            );
          }

          if (action === "down") {
            moveDown(
              side,
              id
            );
          }

          if (action === "delete") {
            deleteLine(
              side,
              id
            );
          }
        };
    }
  }

  // =========================================================
  // TOTALS
  // =========================================================

  function updateTotals() {
    var len =
      getLines("len");

    var dep =
      getLines("dep");

    var lenTotal =
      getPreviousTotal(len);

    var depTotal =
      getPreviousTotal(dep);

    var total =
      lenTotal +
      depTotal;

    setText(
      "total-value",
      formatSize(total)
    );

    setText(
      "sum-len",
      formatSize(lenTotal)
    );

    setText(
      "sum-dep",
      formatSize(depTotal)
    );

    setText(
      "sum-len-lines",
      len.length
    );

    setText(
      "sum-dep-lines",
      dep.length
    );
  }

  function setText(
    id,
    value
  ) {
    var el =
      $(id);

    if (!el) return;

    if (
      el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA"
    ) {
      el.value =
        value;
    } else {
      el.textContent =
        value;
    }
  }

  // =========================================================
  // ANGLE UI
  // =========================================================

  function setAngleUI(
    angle
  ) {
    var select =
      $("angle-select");

    if (select) {
      select.value =
        String(angle);
    }

    var input =
      $("angle");

    if (input) {
      input.value =
        angle;
    }
  }

  // =========================================================
  // DIRECTION UI
  // =========================================================

  function setDirectionUI(
    direction
  ) {
    direction =
      String(
        direction ||
        "UP"
      ).toUpperCase();

    var up =
      $("direction-up");

    var down =
      $("direction-down");

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

    var select =
      $("direction-select");

    if (select) {
      select.value =
        direction;
    }
  }

  // =========================================================
  // SAVE
  // =========================================================

  function save() {
    try {
      if (
        window.Storage &&
        typeof window.Storage.save ===
          "function"
      ) {
        window.Storage.save();
        return;
      }

      if (
        window.Core &&
        typeof window.Core.save ===
          "function"
      ) {
        window.Core.save();
        return;
      }

      var state =
        getState();

      localStorage.setItem(
        "sheetMarking_v7",
        JSON.stringify(state)
      );
    } catch (err) {
      console.error(
        "❌ Sheet save error:",
        err
      );

      if (window.Bugs) {
        try {
          window.Bugs.log(
            "sheet.save",
            err.message,
            err.stack
          );
        } catch (bugErr) {}
      }
    }
  }

  // =========================================================
  // REDRAW ALL
  // =========================================================

  function redraw() {
    try {
      if (
        window.Flat &&
        typeof window.Flat.draw ===
          "function"
      ) {
        window.Flat.draw();
      }
    } catch (err) {
      console.error(
        "Flat redraw error:",
        err
      );
    }

    try {
      if (
        window.ThreeD &&
        typeof window.ThreeD.draw ===
          "function"
      ) {
        window.ThreeD.draw();
      }
    } catch (err) {
      console.error(
        "3D redraw error:",
        err
      );
    }

    try {
      if (
        window.Result &&
        typeof window.Result.render ===
          "function"
      ) {
        window.Result.render();
      }
    } catch (err) {
      console.error(
        "Result redraw error:",
        err
      );
    }
  }

  // =========================================================
  // MESSAGE
  // =========================================================

  function showMessage(
    message
  ) {
    console.warn(
      message
    );

    var error =
      $("input-error");

    if (error) {
      error.textContent =
        message;

      error.style.display =
        "block";

      setTimeout(
        function () {
          error.style.display =
            "none";
        },
        1800
      );
    }
  }

  // =========================================================
  // CANCEL EDIT
  // =========================================================

  function cancelEdit() {
    var state =
      getState();

    state.editMode =
      false;

    state.editingLine =
      null;

    clearInput();

    var editBar =
      $("edit-bar");

    if (editBar) {
      editBar.style.display =
        "none";
    }

    render();
  }

  // =========================================================
  // BUTTON BINDING
  // =========================================================

  function bindButtons() {
    // -------------------------------------------------------
    // SIDE
    // -------------------------------------------------------

    var lenButton =
      $("side-len");

    if (lenButton) {
      lenButton.onclick =
        function () {
          setSide("len");
        };
    }

    var depButton =
      $("side-dep");

    if (depButton) {
      depButton.onclick =
        function () {
          setSide("dep");
        };
    }

    // -------------------------------------------------------
    // ADD
    // -------------------------------------------------------

    var add =
      $("btn-add");

    if (add) {
      add.onclick =
        addLine;
    }

    // -------------------------------------------------------
    // OK
    // -------------------------------------------------------

    var ok =
      $("btn-ok");

    if (ok) {
      ok.onclick =
        addLine;
    }

    // -------------------------------------------------------
    // CLEAR
    // -------------------------------------------------------

    var clear =
      $("btn-clear");

    if (clear) {
      clear.onclick =
        clearAllInput;
    }

    // -------------------------------------------------------
    // EDIT CANCEL
    // -------------------------------------------------------

    var cancel =
      $("btn-cancel-edit");

    if (cancel) {
      cancel.onclick =
        cancelEdit;
    }

    // -------------------------------------------------------
    // DIGIT BUTTONS
    // -------------------------------------------------------

    var digits =
      document.querySelectorAll(
        "[data-digit]"
      );

    for (
      var i = 0;
      i < digits.length;
      i++
    ) {
      digits[i].onclick =
        function () {
          appendValue(
            this.getAttribute(
              "data-digit"
            )
          );
        };
    }

    // -------------------------------------------------------
    // FRACTIONS
    // -------------------------------------------------------

    var fractions =
      document.querySelectorAll(
        "[data-fraction]"
      );

    for (
      var j = 0;
      j < fractions.length;
      j++
    ) {
      fractions[j].onclick =
        function () {
          appendFraction(
            this.getAttribute(
              "data-fraction"
            )
          );
        };
    }

    // -------------------------------------------------------
    // BACKSPACE
    // -------------------------------------------------------

    var back =
      $("btn-backspace");

    if (back) {
      back.onclick =
        backspace;
    }

    // -------------------------------------------------------
    // DECIMAL
    // -------------------------------------------------------

    var decimal =
      $("btn-decimal");

    if (decimal) {
      decimal.onclick =
        function () {
          appendValue(".");
        };
    }

    // -------------------------------------------------------
    // DIRECTION
    // -------------------------------------------------------

    var up =
      $("direction-up");

    if (up) {
      up.onclick =
        function () {
          setDirectionUI(
            "UP"
          );
        };
    }

    var down =
      $("direction-down");

    if (down) {
      down.onclick =
        function () {
          setDirectionUI(
            "DOWN"
          );
        };
    }

    // -------------------------------------------------------
    // ANGLE
    // -------------------------------------------------------

    var angle =
      $("angle-select");

    if (angle) {
      angle.onchange =
        function () {
          setAngleUI(
            this.value
          );
        };
    }
  }

  // =========================================================
  // KEYBOARD
  // =========================================================

  function bindKeyboard() {
    document.addEventListener(
      "keydown",
      function (e) {
        // Don't interfere with text fields.
        var tag =
          e.target &&
          e.target.tagName
            ? e.target.tagName
            : "";

        if (
          tag === "INPUT" &&
          e.target.id !== "display"
        ) {
          return;
        }

        if (
          /^[0-9]$/.test(e.key)
        ) {
          appendValue(
            e.key
          );

          e.preventDefault();

          return;
        }

        if (e.key === ".") {
          appendValue(".");

          e.preventDefault();

          return;
        }

        if (
          e.key === "Backspace"
        ) {
          backspace();

          e.preventDefault();

          return;
        }

        if (
          e.key === "Enter"
        ) {
          addLine();

          e.preventDefault();

          return;
        }

        if (
          e.key === "Escape"
        ) {
          cancelEdit();

          e.preventDefault();
        }
      }
    );
  }

  // =========================================================
  // INIT
  // =========================================================

  function init() {
    bindButtons();

    bindKeyboard();

    updateSideUI();

    render();
  }

  // =========================================================
  // EXPOSE
  // =========================================================

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

    clear: clearAllInput,

    cancelEdit: cancelEdit
  };

})();
