function clamp(i, len) {
  return (i + len) % len;
}

function setupGallery(wrap) {
  const gal = wrap.querySelector(".gallery");
  const btns = wrap.querySelectorAll(".g-btn");
  const items = Array.from(wrap.querySelectorAll(".g-item"));

  if (!gal || !items.length) return;

  let currentIndex = 0;
  let ticking = false;

  function showIndex(i) {
    currentIndex = clamp(i, items.length);
    const targetLeft = items[currentIndex].offsetLeft;
    gal.scrollTo({ left: targetLeft, behavior: "smooth" });
  }

  function syncIndexFromScroll() {
    const center = gal.scrollLeft + gal.clientWidth / 2;
    let best = 0,
      bestDist = Infinity;
    items.forEach((el, i) => {
      const mid = el.offsetLeft + el.clientWidth / 2;
      const d = Math.abs(center - mid);
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    });
    currentIndex = best;
  }

  gal.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          syncIndexFromScroll();
          ticking = false;
        });
        ticking = true;
      }
    },
    { passive: true }
  );

  btns.forEach((btn) => {
    btn.addEventListener(
      "click",
      () => {
        const dir = Number(btn.dataset.dir) || 1;
        showIndex(currentIndex + dir);
      },
      { passive: true }
    );
  });

  // Kéo tay
  let isDown = false,
    startX = 0,
    scrollLeft = 0;
  gal.addEventListener("pointerdown", (e) => {
    isDown = true;
    startX = e.clientX;
    scrollLeft = gal.scrollLeft;
    gal.setPointerCapture(e.pointerId);
  });
  gal.addEventListener("pointermove", (e) => {
    if (!isDown) return;
    gal.scrollLeft = scrollLeft - (e.clientX - startX);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) =>
    gal.addEventListener(ev, () => {
      isDown = false;
    })
  );

  // Load/resize sync
  window.addEventListener("load", syncIndexFromScroll, { once: true });
  window.addEventListener("resize", () => setTimeout(syncIndexFromScroll, 0));
}

export function initAllGalleries() {
  document.querySelectorAll(".gallery-wrap").forEach(setupGallery);
}

// Auto-init
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAllGalleries, {
    once: true,
  });
} else {
  initAllGalleries();
}
