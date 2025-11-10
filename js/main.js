// Small page helpers for index.html
// Keeps DOM updates out of the HTML so CSP and timing are simpler.
window.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('y');
  if (y) y.textContent = new Date().getFullYear();
});
