// Năm hiện tại
document.addEventListener("DOMContentLoaded", () => {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
});

// Tìm kiếm: highlight kết quả trong Top quán
function searchPlaces(e) {
  e.preventDefault();
  const q = (document.getElementById("searchInput").value || "")
    .trim()
    .toLowerCase();
  if (!q) return false;
  const cards = document.querySelectorAll(".place-card");
  let found = false;
  cards.forEach((c) => {
    c.style.outline = "";
    if (c.textContent.toLowerCase().includes(q)) {
      c.style.outline = "2px solid var(--primary)";
      if (!found) c.scrollIntoView({ behavior: "smooth", block: "center" });
      found = true;
    }
  });
  if (!found) alert("Không tìm thấy quán ăn phù hợp!");
  return false;
}

// Parallax nhẹ cho intro bg
const introBg = document.getElementById("introParallax");
let ticking = false,
  lastY = 0;
function onScroll() {
  lastY = window.scrollY || window.pageYOffset;
  if (!ticking) {
    window.requestAnimationFrame(() => {
      const offset = Math.min(60, lastY * 0.06);
      if (introBg)
        introBg.style.transform = `translateY(${offset}px) scale(1.03)`;
      ticking = false;
    });
    ticking = true;
  }
}
window.addEventListener("scroll", onScroll, { passive: true });

// Reveal panels
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("revealed");
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.18 }
);
document.querySelectorAll(".panel").forEach((p) => io.observe(p));

// Micro-parallax cho ảnh intro
const media = document.querySelector(".intro-media");
if (media) {
  const imgs = media.querySelectorAll("img");
  media.addEventListener("pointermove", (ev) => {
    const r = media.getBoundingClientRect();
    const cx = (ev.clientX - r.left) / r.width - 0.5;
    const cy = (ev.clientY - r.top) / r.height - 0.5;
    imgs.forEach((img, i) => {
      const depth = (i + 1) * 4;
      img.style.transform = `translate(${cx * depth}px, ${cy * depth}px)`;
    });
  });
  media.addEventListener("pointerleave", () =>
    imgs.forEach((img) => (img.style.transform = "translate(0,0)"))
  );
}

// Respect reduced motion
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  window.removeEventListener("scroll", onScroll);
}
