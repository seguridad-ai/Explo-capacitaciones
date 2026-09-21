const cfg = window.EXPLO_CONFIG || {};
const supabaseLib = window.supabase;

const authScreen = document.getElementById('authScreen');
const appShell = document.getElementById('appShell');
const authLoading = document.getElementById('authLoading');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginButton = document.getElementById('loginButton');
const loginMessage = document.getElementById('loginMessage');
const togglePassword = document.getElementById('togglePassword');
const logoutButton = document.getElementById('logoutButton');

const menuItems = [...document.querySelectorAll('.menu-item')];
const sections = [...document.querySelectorAll('.page-section')];
const sidebar = document.getElementById('sidebar');
const mobileMenu = document.getElementById('mobileMenu');

let client = null;
let currentProfile = null;

function showMessage(message, type = 'error') {
  if (!loginMessage) return;
  loginMessage.textContent = message || '';
  loginMessage.className = `login-message ${message ? 'visible' : ''} ${type}`;
}

function setLoginBusy(busy) {
  if (!loginButton) return;
  loginButton.disabled = busy;
  loginButton.textContent = busy ? 'Ingresando…' : 'Iniciar sesión';
}

function showAuthScreen() {
  appShell?.classList.add('hidden');
  authScreen?.classList.remove('hidden');
  authLoading?.classList.add('hidden');
  setTimeout(() => loginEmail?.focus(), 50);
}

function showLoading() {
  appShell?.classList.add('hidden');
  authScreen?.classList.add('hidden');
  authLoading?.classList.remove('hidden');
}

function showApp() {
  authScreen?.classList.add('hidden');
  authLoading?.classList.add('hidden');
  appShell?.classList.remove('hidden');
}

function showSection(sectionId) {
  sections.forEach(section => section.classList.toggle('active-section', section.id === sectionId));
  menuItems.forEach(item => item.classList.toggle('active', item.dataset.section === sectionId));
  sidebar?.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (sectionId === 'sedes-proyectos') loadCatalogs();
}

function roleLabel(code) {
  return {
    ADMIN: 'Administrador',
    GERENCIA: 'Gerencia',
    PROYECTO: 'Usuario de proyecto'
  }[code] || 'Usuario';
}

function initials(profile) {
  const a = (profile?.nombres || '').trim().charAt(0);
  const b = (profile?.apellidos || '').trim().charAt(0);
  return `${a}${b}`.toUpperCase() || 'U';
}

function applyRoleVisibility(profile) {
  const usersMenu = document.querySelector('[data-section="usuarios"]');
  const usersSection = document.getElementById('usuarios');
  const isAdmin = profile?.rol_codigo === 'ADMIN';

  if (usersMenu) usersMenu.classList.toggle('role-hidden', !isAdmin);
  if (usersSection) usersSection.dataset.allowed = isAdmin ? 'true' : 'false';

  if (!isAdmin && usersSection?.classList.contains('active-section')) {
    showSection('inicio');
  }
}

function renderProfile(profile) {
  const fullName = [profile?.nombres, profile?.apellidos].filter(Boolean).join(' ').trim() || profile?.email || 'Usuario';
  const role = roleLabel(profile?.rol_codigo);
  const position = profile?.cargo || role;

  document.getElementById('userName').textContent = fullName;
  document.getElementById('userRole').textContent = role;
  document.getElementById('userAvatar').textContent = initials(profile);
  document.getElementById('welcomeName').textContent = profile?.nombres || fullName;
  document.getElementById('profileFullName').textContent = fullName;
  document.getElementById('profileRole').textContent = role;
  document.getElementById('profilePosition').textContent = position;
  document.getElementById('profileEmail').textContent = profile?.email || '—';
  applyRoleVisibility(profile);
}

async function loadDashboardCounts() {
  if (!client) return;

  const workersEl = document.getElementById('workerCount');
  const projectsEl = document.getElementById('projectCount');
  const siteEl = document.getElementById('siteCount');

  const [workers, projects, sites] = await Promise.all([
    client.from('trabajadores').select('*', { count: 'exact', head: true }),
    client.from('proyectos').select('*', { count: 'exact', head: true }),
    client.from('sedes').select('*', { count: 'exact', head: true })
  ]);

  if (workersEl && !workers.error) workersEl.textContent = String(workers.count ?? 0);
  if (projectsEl && !projects.error) projectsEl.textContent = String(projects.count ?? 0);
  if (siteEl && !sites.error) siteEl.textContent = String(sites.count ?? 0);
}

async function loadProfile(session) {
  if (!session?.user || !client) {
    showAuthScreen();
    return false;
  }

  const { data, error } = await client
    .from('profiles')
    .select('id,email,nombres,apellidos,cargo,rol_codigo,activo')
    .eq('id', session.user.id)
    .single();

  if (error || !data) {
    await client.auth.signOut();
    showMessage('No se encontró un perfil habilitado para este usuario. Comunícate con el administrador.');
    showAuthScreen();
    return false;
  }

  if (!data.activo) {
    await client.auth.signOut();
    showMessage('Tu usuario se encuentra desactivado. Comunícate con el administrador.');
    showAuthScreen();
    return false;
  }

  currentProfile = data;
  renderProfile(data);
  showApp();
  await loadDashboardCounts();
  return true;
}

async function initializeAuth() {
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
    showMessage('Falta configurar Supabase en config.js.');
    showAuthScreen();
    return;
  }

  if (!supabaseLib?.createClient) {
    showMessage('No fue posible cargar la librería de Supabase. Revisa tu conexión a Internet.');
    showAuthScreen();
    return;
  }

  client = supabaseLib.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  showLoading();

  const { data, error } = await client.auth.getSession();
  if (error) {
    console.error(error);
    showAuthScreen();
    return;
  }

  if (data.session) {
    await loadProfile(data.session);
  } else {
    showAuthScreen();
  }

  client.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      currentProfile = null;
      showAuthScreen();
      return;
    }

    if (event === 'SIGNED_IN' && session) {
      await loadProfile(session);
    }
  });
}

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!client) return;

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    showMessage('Ingresa tu correo y contraseña.');
    return;
  }

  showMessage('');
  setLoginBusy(true);

  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    console.error(error);
    const msg = /Invalid login credentials/i.test(error.message)
      ? 'Correo o contraseña incorrectos.'
      : 'No fue posible iniciar sesión. Verifica tus datos e inténtalo nuevamente.';
    showMessage(msg);
    setLoginBusy(false);
    return;
  }

  const ok = await loadProfile(data.session);
  if (!ok) setLoginBusy(false);
});

togglePassword?.addEventListener('click', () => {
  const visible = loginPassword.type === 'text';
  loginPassword.type = visible ? 'password' : 'text';
  togglePassword.textContent = visible ? 'Mostrar' : 'Ocultar';
});

logoutButton?.addEventListener('click', async () => {
  if (!client) return;
  logoutButton.disabled = true;
  logoutButton.textContent = 'Saliendo…';
  await client.auth.signOut();
  logoutButton.disabled = false;
  logoutButton.textContent = 'Cerrar sesión';
  if (loginPassword) loginPassword.value = '';
});

menuItems.forEach(item => item.addEventListener('click', () => {
  if (item.classList.contains('role-hidden')) return;
  showSection(item.dataset.section);
}));

document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => showSection(button.dataset.go)));
mobileMenu?.addEventListener('click', () => sidebar?.classList.toggle('open'));


// ============================== ETAPA 3 · SEDES Y PROYECTOS ==============================
let sitesCache = [];
let projectsCache = [];
let catalogsLoaded = false;

const catalogMessage = document.getElementById('catalogMessage');
const sitesTableBody = document.getElementById('sitesTableBody');
const projectsTableBody = document.getElementById('projectsTableBody');
const catalogModal = document.getElementById('catalogModal');
const catalogForm = document.getElementById('catalogForm');
const catalogEntity = document.getElementById('catalogEntity');
const catalogId = document.getElementById('catalogId');
const siteFields = document.getElementById('siteFields');
const projectFields = document.getElementById('projectFields');
const projectSearch = document.getElementById('projectSearch');
const projectStatusFilter = document.getElementById('projectStatusFilter');

function isAdminUser() {
  return currentProfile?.rol_codigo === 'ADMIN';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '—';
  const [y,m,d] = value.split('-');
  return y && m && d ? `${d}/${m}/${y}` : value;
}

function setCatalogMessage(message = '', type = 'error') {
  if (!catalogMessage) return;
  catalogMessage.textContent = message;
  catalogMessage.className = `module-message ${message ? 'visible' : ''} ${type}`;
}

function setFormMessage(message = '', type = 'error') {
  const el = document.getElementById('catalogFormMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `form-message ${message ? 'visible' : ''} ${type}`;
}

function applyCatalogPermissions() {
  const admin = isAdminUser();
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !admin));
  document.querySelectorAll('.admin-only-col').forEach(el => el.classList.toggle('hidden', !admin));
}

function renderSites() {
  if (!sitesTableBody) return;
  const admin = isAdminUser();
  if (!sitesCache.length) {
    sitesTableBody.innerHTML = `<tr><td colspan="5" class="table-empty">No hay sedes registradas.</td></tr>`;
    return;
  }
  sitesTableBody.innerHTML = sitesCache.map(site => `
    <tr>
      <td><span class="code-badge">${escapeHtml(site.codigo)}</span></td>
      <td><strong>${escapeHtml(site.nombre)}</strong></td>
      <td>${escapeHtml(site.ubicacion || '—')}</td>
      <td><span class="status-badge ${site.activo ? 'active' : 'inactive'}">${site.activo ? 'Activa' : 'Inactiva'}</span></td>
      <td class="admin-only-col ${admin ? '' : 'hidden'}">
        <div class="row-actions">
          <button type="button" data-edit-site="${site.id}">Editar</button>
          <button type="button" class="${site.activo ? 'danger-link' : 'success-link'}" data-toggle-site="${site.id}">${site.activo ? 'Desactivar' : 'Activar'}</button>
        </div>
      </td>
    </tr>`).join('');
}

function filteredProjects() {
  const q = (projectSearch?.value || '').trim().toLowerCase();
  const status = projectStatusFilter?.value || 'all';
  return projectsCache.filter(p => {
    const text = `${p.codigo || ''} ${p.nombre || ''} ${p.cliente || ''} ${p.ubicacion || ''}`.toLowerCase();
    const qOk = !q || text.includes(q);
    const statusOk = status === 'all' || (status === 'active' ? p.activo : !p.activo);
    return qOk && statusOk;
  });
}

function renderProjects() {
  if (!projectsTableBody) return;
  const admin = isAdminUser();
  const rows = filteredProjects();
  if (!rows.length) {
    projectsTableBody.innerHTML = `<tr><td colspan="8" class="table-empty">No se encontraron proyectos.</td></tr>`;
    return;
  }
  projectsTableBody.innerHTML = rows.map(project => `
    <tr>
      <td>${project.codigo ? `<span class="code-badge">${escapeHtml(project.codigo)}</span>` : '—'}</td>
      <td><strong>${escapeHtml(project.nombre)}</strong></td>
      <td>${escapeHtml(project.cliente || '—')}</td>
      <td>${escapeHtml(project.ubicacion || '—')}</td>
      <td>${formatDate(project.fecha_inicio)}</td>
      <td>${formatDate(project.fecha_fin)}</td>
      <td><span class="status-badge ${project.activo ? 'active' : 'inactive'}">${project.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td class="admin-only-col ${admin ? '' : 'hidden'}">
        <div class="row-actions">
          <button type="button" data-edit-project="${project.id}">Editar</button>
          <button type="button" class="${project.activo ? 'danger-link' : 'success-link'}" data-toggle-project="${project.id}">${project.activo ? 'Desactivar' : 'Activar'}</button>
        </div>
      </td>
    </tr>`).join('');
}

function renderCatalogStats() {
  const siteCount = document.getElementById('catalogSiteCount');
  const projectCount = document.getElementById('catalogProjectCount');
  const activeCount = document.getElementById('catalogActiveProjectCount');
  if (siteCount) siteCount.textContent = String(sitesCache.length);
  if (projectCount) projectCount.textContent = String(projectsCache.length);
  if (activeCount) activeCount.textContent = String(projectsCache.filter(p => p.activo).length);
}

async function loadSites() {
  if (!client) return;
  if (sitesTableBody) sitesTableBody.innerHTML = `<tr><td colspan="5" class="table-empty">Cargando…</td></tr>`;
  const { data, error } = await client.from('sedes').select('id,codigo,nombre,ubicacion,activo,created_at,updated_at').order('nombre');
  if (error) {
    console.error(error);
    setCatalogMessage('No fue posible cargar las sedes.');
    return;
  }
  sitesCache = data || [];
  renderSites();
  renderCatalogStats();
}

async function loadProjects() {
  if (!client) return;
  if (projectsTableBody) projectsTableBody.innerHTML = `<tr><td colspan="8" class="table-empty">Cargando…</td></tr>`;
  const { data, error } = await client.from('proyectos').select('id,codigo,nombre,cliente,ubicacion,fecha_inicio,fecha_fin,activo,created_at,updated_at').order('nombre');
  if (error) {
    console.error(error);
    setCatalogMessage('No fue posible cargar los proyectos.');
    return;
  }
  projectsCache = data || [];
  renderProjects();
  renderCatalogStats();
}

async function loadCatalogs(force = false) {
  if (!client || !currentProfile) return;
  applyCatalogPermissions();
  if (catalogsLoaded && !force) {
    renderSites(); renderProjects(); renderCatalogStats();
    return;
  }
  setCatalogMessage('');
  await Promise.all([loadSites(), loadProjects()]);
  catalogsLoaded = true;
}

function openCatalogModal(entity, record = null) {
  if (!isAdminUser()) return;
  setFormMessage('');
  catalogForm?.reset();
  catalogEntity.value = entity;
  catalogId.value = record?.id || '';
  siteFields.classList.toggle('hidden', entity !== 'site');
  projectFields.classList.toggle('hidden', entity !== 'project');
  document.getElementById('catalogModalEyebrow').textContent = record ? 'EDICIÓN' : 'NUEVO REGISTRO';
  document.getElementById('catalogModalTitle').textContent = entity === 'site'
    ? (record ? 'Editar sede' : 'Nueva sede')
    : (record ? 'Editar proyecto' : 'Nuevo proyecto');

  if (entity === 'site') {
    document.getElementById('siteCode').value = record?.codigo || '';
    document.getElementById('siteName').value = record?.nombre || '';
    document.getElementById('siteLocation').value = record?.ubicacion || '';
    document.getElementById('siteActive').checked = record ? !!record.activo : true;
  } else {
    document.getElementById('projectCode').value = record?.codigo || '';
    document.getElementById('projectName').value = record?.nombre || '';
    document.getElementById('projectClient').value = record?.cliente || '';
    document.getElementById('projectLocation').value = record?.ubicacion || '';
    document.getElementById('projectStart').value = record?.fecha_inicio || '';
    document.getElementById('projectEnd').value = record?.fecha_fin || '';
    document.getElementById('projectActive').checked = record ? !!record.activo : true;
  }
  catalogModal.classList.remove('hidden');
  setTimeout(() => (entity === 'site' ? document.getElementById('siteCode') : document.getElementById('projectName'))?.focus(), 30);
}

function closeCatalogModal() {
  catalogModal?.classList.add('hidden');
  setFormMessage('');
}

async function saveCatalog(event) {
  event.preventDefault();
  if (!client || !isAdminUser()) return;
  const entity = catalogEntity.value;
  const id = catalogId.value || null;
  const saveButton = document.getElementById('saveCatalogButton');
  saveButton.disabled = true;
  saveButton.textContent = 'Guardando…';
  setFormMessage('');

  let table, payload;
  if (entity === 'site') {
    const codigo = document.getElementById('siteCode').value.trim().toUpperCase();
    const nombre = document.getElementById('siteName').value.trim();
    if (!codigo || !nombre) {
      setFormMessage('Completa el código y el nombre de la sede.');
      saveButton.disabled = false; saveButton.textContent = 'Guardar'; return;
    }
    table = 'sedes';
    payload = { codigo, nombre, ubicacion: document.getElementById('siteLocation').value.trim() || null, activo: document.getElementById('siteActive').checked };
  } else {
    const nombre = document.getElementById('projectName').value.trim();
    if (!nombre) {
      setFormMessage('Ingresa el nombre del proyecto.');
      saveButton.disabled = false; saveButton.textContent = 'Guardar'; return;
    }
    const start = document.getElementById('projectStart').value || null;
    const end = document.getElementById('projectEnd').value || null;
    if (start && end && end < start) {
      setFormMessage('La fecha de fin no puede ser anterior a la fecha de inicio.');
      saveButton.disabled = false; saveButton.textContent = 'Guardar'; return;
    }
    table = 'proyectos';
    payload = {
      codigo: document.getElementById('projectCode').value.trim().toUpperCase() || null,
      nombre,
      cliente: document.getElementById('projectClient').value.trim() || null,
      ubicacion: document.getElementById('projectLocation').value.trim() || null,
      fecha_inicio: start,
      fecha_fin: end,
      activo: document.getElementById('projectActive').checked
    };
  }

  const query = id ? client.from(table).update(payload).eq('id', id) : client.from(table).insert(payload);
  const { error } = await query;
  saveButton.disabled = false; saveButton.textContent = 'Guardar';
  if (error) {
    console.error(error);
    const duplicate = error.code === '23505';
    setFormMessage(duplicate ? 'Ya existe un registro con ese código o nombre.' : 'No fue posible guardar el registro.');
    return;
  }

  closeCatalogModal();
  setCatalogMessage(id ? 'Registro actualizado correctamente.' : 'Registro creado correctamente.', 'success');
  catalogsLoaded = false;
  await loadCatalogs(true);
  await loadDashboardCounts();
}

async function toggleCatalogRecord(entity, id) {
  if (!client || !isAdminUser()) return;
  const record = entity === 'site' ? sitesCache.find(x => x.id === id) : projectsCache.find(x => x.id === id);
  if (!record) return;
  const next = !record.activo;
  const label = entity === 'site' ? 'sede' : 'proyecto';
  if (!window.confirm(`¿Deseas ${next ? 'activar' : 'desactivar'} ${label} "${record.nombre}"?`)) return;
  const table = entity === 'site' ? 'sedes' : 'proyectos';
  const { error } = await client.from(table).update({ activo: next }).eq('id', id);
  if (error) {
    console.error(error); setCatalogMessage(`No fue posible actualizar el estado del ${label}.`); return;
  }
  setCatalogMessage(`${record.nombre} quedó ${next ? 'activo' : 'inactivo'}.`, 'success');
  catalogsLoaded = false;
  await loadCatalogs(true);
  await loadDashboardCounts();
}

document.getElementById('newSiteButton')?.addEventListener('click', () => openCatalogModal('site'));
document.getElementById('newProjectButton')?.addEventListener('click', () => openCatalogModal('project'));
document.getElementById('closeCatalogModal')?.addEventListener('click', closeCatalogModal);
document.getElementById('cancelCatalogModal')?.addEventListener('click', closeCatalogModal);
catalogModal?.addEventListener('click', e => { if (e.target === catalogModal) closeCatalogModal(); });
catalogForm?.addEventListener('submit', saveCatalog);
projectSearch?.addEventListener('input', renderProjects);
projectStatusFilter?.addEventListener('change', renderProjects);
document.getElementById('refreshSitesButton')?.addEventListener('click', () => loadSites());
document.getElementById('refreshProjectsButton')?.addEventListener('click', () => loadProjects());

sitesTableBody?.addEventListener('click', e => {
  const edit = e.target.closest('[data-edit-site]');
  const toggle = e.target.closest('[data-toggle-site]');
  if (edit) openCatalogModal('site', sitesCache.find(x => x.id === edit.dataset.editSite));
  if (toggle) toggleCatalogRecord('site', toggle.dataset.toggleSite);
});

projectsTableBody?.addEventListener('click', e => {
  const edit = e.target.closest('[data-edit-project]');
  const toggle = e.target.closest('[data-toggle-project]');
  if (edit) openCatalogModal('project', projectsCache.find(x => x.id === edit.dataset.editProject));
  if (toggle) toggleCatalogRecord('project', toggle.dataset.toggleProject);
});


initializeAuth();
