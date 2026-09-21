const menuItems = [...document.querySelectorAll('.menu-item')];
const sections = [...document.querySelectorAll('.page-section')];
const sidebar = document.getElementById('sidebar');
const mobileMenu = document.getElementById('mobileMenu');

function showSection(sectionId) {
  sections.forEach(section => section.classList.toggle('active-section', section.id === sectionId));
  menuItems.forEach(item => item.classList.toggle('active', item.dataset.section === sectionId));
  sidebar?.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

menuItems.forEach(item => item.addEventListener('click', () => showSection(item.dataset.section)));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => showSection(button.dataset.go)));
mobileMenu?.addEventListener('click', () => sidebar?.classList.toggle('open'));

const cfg = window.EXPLO_CONFIG || {};
const hasConfig = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY);
if (hasConfig) {
  document.getElementById('connectionDot')?.classList.add('online');
  document.getElementById('connectionTitle').textContent = 'Configuración de Supabase detectada';
  document.getElementById('connectionText').textContent = 'La conexión real y las tablas se habilitarán durante la Etapa 2.';
}
