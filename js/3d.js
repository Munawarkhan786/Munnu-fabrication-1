/* =========================================================
   DRAW — har baar poora scene dobara banata hai
   ========================================================= */

function draw() {

  /* Agar renderer nahi hai to setup karo */
  if (!renderer) {

    var canvas = getEl("canvas3d");

    if (canvas && canvas.clientWidth > 0) {
      setup3D();
    }

    if (!renderer) {
      return;
    }
  }

  /* Poora scene clear karo */
  clearScene();

  /* Naya scene banao */
  rebuild3D();
}

/* =========================================================
   CLEAR SCENE — sab kuch hatao
   ========================================================= */

function clearScene() {

  if (!meshGroup) {
    return;
  }

  while (meshGroup.children.length > 0) {

    var child = meshGroup.children[0];

    meshGroup.remove(child);

    /* Geometry free karo */
    if (child.geometry) {
      child.geometry.dispose();
    }

    /* Material free karo */
    if (child.material) {

      if (Array.isArray(child.material)) {

        child.material.forEach(function (m) {
          if (m) {
            m.dispose();
          }
        });

      } else {

        child.material.dispose();
      }
    }
  }
}
