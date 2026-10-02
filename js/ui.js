/* =========================================================
   UI — Tab switching + View toggle
   ========================================================= */

(function() {
  "use strict";

  function getEl(id) { return document.getElementById(id); }

  function switchTab(name) {

    document.querySelectorAll(".tab").forEach(function(t) {
      t.classList.toggle("active", t.dataset.tab === name);
    });

    document.querySelectorAll(".tab-content").forEach(function(s) {
      s.classList.add("hidden");
    });

    var sec = getEl("tab-" + name);
    if (sec) sec.classList.remove("hidden");

    if (name === "view") {
      setTimeout(function() {
        if (window.Flat) window.Flat.draw();
        if (window.ThreeD) window.ThreeD.draw();
      }, 50);
    }

    if (name === "result") {
      if (window.Result) window.Result.render();
    }

    if (name === "settings") {
      if (window.Settings && window.Settings.fill) {
        window.Settings.fill();
      }
    }
  }

  function switchView(view) {

    var flatC = getEl("flat-container");
    var threeC = getEl("three-container");
    var btnFlat = getEl("view-flat");
    var btn3D = getEl("view-3d");

    if (view === "flat") {

      if (flatC) flatC.classList.remove("hidden");
      if (threeC) threeC.classList.add("hidden");
      if (btnFlat) btnFlat.classList.add("active");
      if (btn3D) btn3D.classList.remove("active");

      setTimeout(function() {
        if (window.Flat) window.Flat.draw();
      }, 30);

    } else {

      if (flatC) flatC.classList.add("hidden");
      if (threeC) threeC.classList.remove("hidden");
      if (btn3D) btn3D.classList.add("active");
      if (btnFlat) btnFlat.classList.remove("active");

      setTimeout(function() {
        if (window.ThreeD) window.ThreeD.draw();
      }, 30);
    }
  }

  function bindTabs() {
    document.querySelectorAll(".tab").forEach(function(t) {
      t.onclick = function() {
        switchTab(this.dataset.tab);
      };
    });
  }

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

  function bindBugsToggle() {

    var bugsToggle = getEl("bugs-toggle");
    var bugsPanel = getEl("bugs-panel");
    var bugsClose = getEl("bugs-close");
    var bugsClear = getEl("bugs-clear");

    if (bugsToggle) {
      bugsToggle.onclick = function() {
        if (bugsPanel) bugsPanel.classList.remove("hidden");
        if (window.Bugs) window.Bugs.render();
      };
    }

    if (bugsClose) {
      bugsClose.onclick = function() {
        if (bugsPanel) bugsPanel.classList.add("hidden");
      };
    }

    if (bugsClear) {
      bugsClear.onclick = function() {
        if (window.Bugs) window.Bugs.clear();
      };
    }
  }

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

  setInterval(updateBugsBadge, 2000);

  function init() {
    bindTabs();
    bindViewToggle();
    bindBugsToggle();
    updateBugsBadge();
  }

  window.UI = {
    init: init,
    switchTab: switchTab,
    switchView: switchView,
    updateBugsBadge: updateBugsBadge
  };

})();
