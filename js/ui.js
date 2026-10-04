/* =========================================================
   UI — Tab switching + View toggle + Bugs panel
   
   Yeh file app ke "control panel" jaisi hai. Isme:
   1. Input/View/Result/Settings tabs ke beech switch karna
   2. Flat/3D view ke beech toggle karna
   3. Bugs panel kholna/band karna
    ========================================================= */

(function() {
  "use strict";

  // ---------------------------------------------------------
  // getEl — Shortcut function (document.getElementById)
  // ---------------------------------------------------------
  function getEl(id) { 
    return document.getElementById(id); 
  }

  // =========================================================
  // TAB SWITCHING
  // Input, View, Result, Settings tabs ke beech switch karta hai
  // =========================================================
  function switchTab(name) {

    // 1. Saare tabs se "active" class hatao
    document.querySelectorAll(".tab").forEach(function(t) {
      t.classList.toggle("active", t.dataset.tab === name);
    });

    // 2. Saare tab-content ko chhupa do
    document.querySelectorAll(".tab-content").forEach(function(s) {
      s.classList.add("hidden");
    });

    // 3. Selected tab ko dikhao
    var sec = getEl("tab-" + name);
    if (sec) sec.classList.remove("hidden");

    // 4. Agar View tab hai, toh drawing dobara karo
    if (name === "view") {
      setTimeout(function() {
        if (window.Flat) window.Flat.draw();
        if (window.ThreeD) window.ThreeD.draw();
      }, 50);
    }

    // 5. Agar Result tab hai, toh result render karo
    if (name === "result") {
      if (window.Result) window.Result.render();
    }

    // 6. Agar Settings tab hai, toh settings fill karo
    if (name === "settings") {
      if (window.Settings && window.Settings.fill) {
        window.Settings.fill();
      }
    }
  }

  // =========================================================
  // VIEW SWITCHING
  // Flat sheet aur 3D box ke beech switch karta hai
  // =========================================================
  function switchView(view) {

    var flatC = getEl("flat-container");    // Flat view ka container
    var threeC = getEl("three-container");  // 3D view ka container
    var btnFlat = getEl("view-flat");       // Flat button
    var btn3D = getEl("view-3d");           // 3D button

    // ---------------------------------------------------------
    // Agar FLAT view select kiya
    // ---------------------------------------------------------
    if (view === "flat") {
      if (flatC) flatC.classList.remove("hidden");
      if (threeC) threeC.classList.add("hidden");
      if (btnFlat) btnFlat.classList.add("active");
      if (btn3D) btn3D.classList.remove("active");

      // Flat drawing dobara karo
      setTimeout(function() {
        if (window.Flat) window.Flat.draw();
      }, 30);

    // ---------------------------------------------------------
    // Agar 3D view select kiya
    // ---------------------------------------------------------
    } else {
      if (flatC) flatC.classList.add("hidden");
      if (threeC) threeC.classList.remove("hidden");
      if (btn3D) btn3D.classList.add("active");
      if (btnFlat) btnFlat.classList.remove("active");

      // 3D drawing dobara karo
      setTimeout(function() {
        if (window.ThreeD) window.ThreeD.draw();
      }, 30);
    }
  }

  // =========================================================
  // TAB BUTTONS SE CLICK EVENT JODO
  // =========================================================
  function bindTabs() {
    document.querySelectorAll(".tab").forEach(function(t) {
      t.onclick = function() {
        switchTab(this.dataset.tab);
      };
    });
  }

  // =========================================================
  // VIEW TOGGLE BUTTONS SE CLICK EVENT JODO
  // =========================================================
  function bindViewToggle() {
    var btnFlat = getEl("view-flat");
    var btn3D = getEl("view-3d");

    if (btnFlat) {
      btnFlat.onclick = function() { switchView("flat"); };
    }
    if (btn3D) {
      btn3D.onclick = function() { switchView("3d"); };
    }
  }

  // =========================================================
  // BUGS PANEL (errors dikhane ke liye)
  // =========================================================
  function bindBugsToggle() {

    var bugsToggle = getEl("bugs-toggle");  // 🐛 button
    var bugsPanel = getEl("bugs-panel");    // Bugs panel
    var bugsClose = getEl("bugs-close");    // ✕ button
    var bugsClear = getEl("bugs-clear");    // 🗑️ button

    // 🐛 button dabane par panel kholo
    if (bugsToggle) {
      bugsToggle.onclick = function() {
        if (bugsPanel) bugsPanel.classList.remove("hidden");
        if (window.Bugs) window.Bugs.render();
      };
    }

    // ✕ button dabane par panel band karo
    if (bugsClose) {
      bugsClose.onclick = function() {
        if (bugsPanel) bugsPanel.classList.add("hidden");
      };
    }

    // 🗑️ button dabane par saare errors clear karo
    if (bugsClear) {
      bugsClear.onclick = function() {
        if (window.Bugs) window.Bugs.clear();
      };
    }
  }

  // =========================================================
  // BUGS BADGE UPDATE (kitne errors hain, woh dikhana)
  // =========================================================
  function updateBugsBadge() {

    var toggle = getEl("bugs-toggle");
    var count = getEl("bugs-count");

    if (!toggle || !count) return;

    if (window.Bugs) {
      var c = window.Bugs.count();
      count.textContent = c;
      toggle.style.display = c > 0 ? "inline-block" : "none";
    }
  }

  // Har 2 second mein badge update karo
  setInterval(updateBugsBadge, 2000);

  // =========================================================
  // INIT — jab app shuru ho, toh yeh sab chalu karo
  // =========================================================
  function init() {
    bindTabs();         // Tab buttons jodo
    bindViewToggle();   // View toggle buttons jodo
    bindBugsToggle();   // Bugs panel buttons jodo
    updateBugsBadge();  // Bugs badge update karo
  }

  // =========================================================
  // UI KO EXPOSE KARO (baaki files use kar sake)
  // =========================================================
  window.UI = {
    init: init,
    switchTab: switchTab,
    switchView: switchView,
    updateBugsBadge: updateBugsBadge
  };

})();
