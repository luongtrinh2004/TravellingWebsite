// Năm hiện tại
document.getElementById('year').textContent = new Date().getFullYear();

// Tìm kiếm: highlight kết quả trong Top quán
function searchPlaces(e) {
  e.preventDefault();
  const q = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  if (!q) return false;
  const cards = document.querySelectorAll('.place-card');
  let found = false;
  cards.forEach(c => {
    c.style.outline = '';
    if (c.textContent.toLowerCase().includes(q)) {
      c.style.outline = '2px solid var(--primary)';
      if (!found) c.scrollIntoView({ behavior: 'smooth', block: 'center' });
      found = true;
    }
  });
  if (!found) alert('Không tìm thấy quán ăn phù hợp!');
  return false;
}

// Reveal panels
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('revealed');
      io.unobserve(e.target);
    }
  });
}, { threshold: .18 });
document.querySelectorAll('.panel').forEach(p => io.observe(p));

// Respect reduced motion (đã bỏ hiệu ứng nặng)
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // no-op
}