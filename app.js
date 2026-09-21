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
  if (sectionId === 'trabajadores') loadWorkersModule();
  if (sectionId === 'nueva-capacitacion') loadTrainingModule();
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
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
  document.querySelectorAll('.admin-only-col').forEach(el => el.classList.toggle('hidden', !isAdmin));

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


// ============================== ETAPA 4 · TRABAJADORES ==============================
let workersCache = [];
let workerSitesCache = [];
let workersLoaded = false;

const workerMessage = document.getElementById('workerMessage');
const workersTableBody = document.getElementById('workersTableBody');
const workerSearch = document.getElementById('workerSearch');
const workerSiteFilter = document.getElementById('workerSiteFilter');
const workerStatusFilter = document.getElementById('workerStatusFilter');
const workerModal = document.getElementById('workerModal');
const workerForm = document.getElementById('workerForm');

function setWorkerMessage(message = '', type = 'error') {
  if (!workerMessage) return;
  workerMessage.textContent = message;
  workerMessage.className = `module-message ${message ? 'visible' : ''} ${type}`;
}

function setWorkerFormMessage(message = '', type = 'error') {
  const el = document.getElementById('workerFormMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `form-message ${message ? 'visible' : ''} ${type}`;
}

function siteNameById(id) {
  const site = workerSitesCache.find(x => x.id === id);
  return site?.nombre || '—';
}

function renderWorkerSiteOptions() {
  const formSelect = document.getElementById('workerSite');
  const currentFormValue = formSelect?.value || '';
  const currentFilterValue = workerSiteFilter?.value || 'all';
  const options = workerSitesCache.map(site =>
    `<option value="${site.id}">${escapeHtml(site.nombre)}${site.activo ? '' : ' (Inactiva)'}</option>`
  ).join('');

  if (formSelect) {
    formSelect.innerHTML = `<option value="">Seleccione una sede</option>${options}`;
    if ([...formSelect.options].some(o => o.value === currentFormValue)) formSelect.value = currentFormValue;
  }

  if (workerSiteFilter) {
    workerSiteFilter.innerHTML = `<option value="all">Todas las sedes</option>${options}`;
    if ([...workerSiteFilter.options].some(o => o.value === currentFilterValue)) workerSiteFilter.value = currentFilterValue;
  }
}

function filteredWorkers() {
  const q = (workerSearch?.value || '').trim().toLowerCase();
  const site = workerSiteFilter?.value || 'all';
  const status = workerStatusFilter?.value || 'all';

  return workersCache.filter(worker => {
    const searchable = `${worker.dni || ''} ${worker.apellidos || ''} ${worker.nombres || ''} ${worker.cargo || ''} ${worker.area || ''} ${siteNameById(worker.sede_id)}`.toLowerCase();
    const qOk = !q || searchable.includes(q);
    const siteOk = site === 'all' || worker.sede_id === site;
    const statusOk = status === 'all' || (status === 'active' ? worker.activo : !worker.activo);
    return qOk && siteOk && statusOk;
  });
}

function renderWorkerStats() {
  const total = document.getElementById('workerTotalCount');
  const active = document.getElementById('workerActiveCount');
  const inactive = document.getElementById('workerInactiveCount');
  if (total) total.textContent = String(workersCache.length);
  if (active) active.textContent = String(workersCache.filter(x => x.activo).length);
  if (inactive) inactive.textContent = String(workersCache.filter(x => !x.activo).length);
}

function renderWorkers() {
  if (!workersTableBody) return;
  const admin = isAdminUser();
  const rows = filteredWorkers();

  if (!rows.length) {
    workersTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">No se encontraron trabajadores.</td></tr>`;
    return;
  }

  workersTableBody.innerHTML = rows.map(worker => {
    const fullName = `${worker.apellidos || ''} ${worker.nombres || ''}`.trim() || '—';
    return `
      <tr>
        <td><span class="code-badge">${escapeHtml(worker.dni)}</span></td>
        <td><strong>${escapeHtml(fullName)}</strong></td>
        <td>${escapeHtml(worker.cargo || '—')}</td>
        <td>${escapeHtml(worker.area || '—')}</td>
        <td>${escapeHtml(siteNameById(worker.sede_id))}</td>
        <td><span class="status-badge ${worker.activo ? 'active' : 'inactive'}">${worker.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td class="admin-only-col ${admin ? '' : 'hidden'}">
          <div class="row-actions">
            <button type="button" data-edit-worker="${worker.id}">Editar</button>
            <button type="button" class="${worker.activo ? 'danger-link' : 'success-link'}" data-toggle-worker="${worker.id}">${worker.activo ? 'Desactivar' : 'Activar'}</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

async function loadWorkerSites() {
  if (!client) return;
  const { data, error } = await client
    .from('sedes')
    .select('id,codigo,nombre,activo')
    .order('nombre');

  if (error) {
    console.error(error);
    setWorkerMessage('No fue posible cargar las sedes para los trabajadores.');
    return;
  }

  workerSitesCache = data || [];
  renderWorkerSiteOptions();
}

async function loadWorkers() {
  if (!client) return;
  if (workersTableBody) workersTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Cargando…</td></tr>`;

  const { data, error } = await client
    .from('trabajadores')
    .select('id,dni,nombres,apellidos,cargo,area,sede_id,activo,created_at,updated_at')
    .order('apellidos')
    .order('nombres');

  if (error) {
    console.error(error);
    setWorkerMessage('No fue posible cargar la base de trabajadores.');
    return;
  }

  workersCache = data || [];
  renderWorkers();
  renderWorkerStats();
}

async function loadWorkersModule(force = false) {
  if (!client || !currentProfile) return;
  document.querySelectorAll('#trabajadores .admin-only').forEach(el => el.classList.toggle('hidden', !isAdminUser()));
  document.querySelectorAll('#trabajadores .admin-only-col').forEach(el => el.classList.toggle('hidden', !isAdminUser()));

  if (workersLoaded && !force) {
    renderWorkerSiteOptions();
    renderWorkers();
    renderWorkerStats();
    return;
  }

  setWorkerMessage('');
  await loadWorkerSites();
  await loadWorkers();
  workersLoaded = true;
}

function openWorkerModal(record = null) {
  if (!isAdminUser()) return;
  workerForm?.reset();
  setWorkerFormMessage('');
  renderWorkerSiteOptions();

  document.getElementById('workerId').value = record?.id || '';
  document.getElementById('workerModalEyebrow').textContent = record ? 'EDICIÓN' : 'NUEVO REGISTRO';
  document.getElementById('workerModalTitle').textContent = record ? 'Editar trabajador' : 'Nuevo trabajador';
  document.getElementById('workerDni').value = record?.dni || '';
  document.getElementById('workerLastName').value = record?.apellidos || '';
  document.getElementById('workerFirstName').value = record?.nombres || '';
  document.getElementById('workerPosition').value = record?.cargo || '';
  document.getElementById('workerArea').value = record?.area || '';
  document.getElementById('workerSite').value = record?.sede_id || '';
  document.getElementById('workerActive').checked = record ? !!record.activo : true;

  workerModal?.classList.remove('hidden');
  setTimeout(() => document.getElementById('workerDni')?.focus(), 30);
}

function closeWorkerModal() {
  workerModal?.classList.add('hidden');
  setWorkerFormMessage('');
}

async function saveWorker(event) {
  event.preventDefault();
  if (!client || !isAdminUser()) return;

  const id = document.getElementById('workerId').value || null;
  const dni = document.getElementById('workerDni').value.replace(/\D/g, '');
  const apellidos = document.getElementById('workerLastName').value.trim();
  const nombres = document.getElementById('workerFirstName').value.trim();
  const cargo = document.getElementById('workerPosition').value.trim();
  const area = document.getElementById('workerArea').value.trim();
  const sede_id = document.getElementById('workerSite').value || null;
  const activo = document.getElementById('workerActive').checked;
  const saveButton = document.getElementById('saveWorkerButton');

  if (!/^\d{8}$/.test(dni)) {
    setWorkerFormMessage('El DNI debe contener exactamente 8 dígitos.');
    return;
  }
  if (!apellidos || !nombres || !cargo || !area || !sede_id) {
    setWorkerFormMessage('Completa apellidos, nombres, puesto, área y sede.');
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = 'Guardando…';
  setWorkerFormMessage('');

  const payload = { dni, apellidos, nombres, cargo, area, sede_id, activo };
  const query = id
    ? client.from('trabajadores').update(payload).eq('id', id)
    : client.from('trabajadores').insert(payload);
  const { error } = await query;

  saveButton.disabled = false;
  saveButton.textContent = 'Guardar';

  if (error) {
    console.error(error);
    if (error.code === '23505') {
      setWorkerFormMessage('Ya existe un trabajador registrado con ese DNI.');
    } else if (error.code === '23514') {
      setWorkerFormMessage('El DNI no cumple el formato requerido de 8 dígitos.');
    } else {
      setWorkerFormMessage('No fue posible guardar al trabajador.');
    }
    return;
  }

  closeWorkerModal();
  setWorkerMessage(id ? 'Trabajador actualizado correctamente.' : 'Trabajador registrado correctamente.', 'success');
  workersLoaded = false;
  await loadWorkersModule(true);
  await loadDashboardCounts();
}

async function toggleWorker(id) {
  if (!client || !isAdminUser()) return;
  const worker = workersCache.find(x => x.id === id);
  if (!worker) return;
  const next = !worker.activo;
  const fullName = `${worker.apellidos || ''} ${worker.nombres || ''}`.trim();

  if (!window.confirm(`¿Deseas ${next ? 'activar' : 'desactivar'} a ${fullName}?`)) return;

  const { error } = await client.from('trabajadores').update({ activo: next }).eq('id', id);
  if (error) {
    console.error(error);
    setWorkerMessage('No fue posible actualizar el estado del trabajador.');
    return;
  }

  setWorkerMessage(`${fullName} quedó ${next ? 'activo' : 'inactivo'}.`, 'success');
  workersLoaded = false;
  await loadWorkersModule(true);
  await loadDashboardCounts();
}

document.getElementById('newWorkerButton')?.addEventListener('click', async () => {
  if (!workerSitesCache.length) await loadWorkerSites();
  openWorkerModal();
});
document.getElementById('closeWorkerModal')?.addEventListener('click', closeWorkerModal);
document.getElementById('cancelWorkerModal')?.addEventListener('click', closeWorkerModal);
workerModal?.addEventListener('click', e => { if (e.target === workerModal) closeWorkerModal(); });
workerForm?.addEventListener('submit', saveWorker);
workerSearch?.addEventListener('input', renderWorkers);
workerSiteFilter?.addEventListener('change', renderWorkers);
workerStatusFilter?.addEventListener('change', renderWorkers);
document.getElementById('refreshWorkersButton')?.addEventListener('click', () => loadWorkersModule(true));
document.getElementById('workerDni')?.addEventListener('input', e => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
});

workersTableBody?.addEventListener('click', e => {
  const edit = e.target.closest('[data-edit-worker]');
  const toggle = e.target.closest('[data-toggle-worker]');
  if (edit) openWorkerModal(workersCache.find(x => x.id === edit.dataset.editWorker));
  if (toggle) toggleWorker(toggle.dataset.toggleWorker);
});




// ============================== ETAPA 5 · NUEVA CAPACITACIÓN ==============================
let trainingCatalogLoaded = false;
let trainingSitesCache = [];
let trainingProjectsCache = [];
let activeSignatureTarget = null;
let signatureDrawing = false;
let signatureHasStroke = false;

const trainingForm = document.getElementById('trainingForm');
const trainingMessage = document.getElementById('trainingMessage');
const trainingUnit = document.getElementById('trainingUnit');
const signatureModal = document.getElementById('signatureModal');
const signatureCanvas = document.getElementById('signatureCanvas');
const signatureCtx = signatureCanvas?.getContext('2d');

function setTrainingMessage(message = '', type = 'error') {
  if (!trainingMessage) return;
  trainingMessage.textContent = message;
  trainingMessage.className = `module-message ${message ? 'visible' : ''} ${type}`;
}

function setTrainingFormMessage(message = '', type = 'error') {
  const el = document.getElementById('trainingFormMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `form-message ${message ? 'visible' : ''} ${type}`;
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function renderTrainingUnitOptions() {
  if (!trainingUnit) return;
  const current = trainingUnit.value;
  const siteOptions = trainingSitesCache
    .filter(x => x.activo)
    .map(x => `<option value="sede:${x.id}">Sede · ${escapeHtml(x.nombre)}</option>`)
    .join('');
  const projectOptions = trainingProjectsCache
    .filter(x => x.activo)
    .map(x => `<option value="proyecto:${x.id}">Proyecto · ${escapeHtml(x.nombre)}${x.cliente ? ` — ${escapeHtml(x.cliente)}` : ''}</option>`)
    .join('');
  trainingUnit.innerHTML = `<option value="">Seleccione una sede o proyecto</option>${siteOptions}${projectOptions}`;
  if ([...trainingUnit.options].some(o => o.value === current)) trainingUnit.value = current;
}

async function loadTrainingCatalogs() {
  if (!client) return;
  const [sites, projects] = await Promise.all([
    client.from('sedes').select('id,nombre,activo').order('nombre'),
    client.from('proyectos').select('id,nombre,cliente,activo').order('nombre')
  ]);
  if (sites.error) console.error(sites.error);
  if (projects.error) console.error(projects.error);
  trainingSitesCache = sites.data || [];
  trainingProjectsCache = projects.data || [];
  renderTrainingUnitOptions();
  trainingCatalogLoaded = true;
}

function prefillResponsible() {
  const name = document.getElementById('responsibleName');
  const position = document.getElementById('responsiblePosition');
  if (name && !name.value.trim()) {
    name.value = [currentProfile?.nombres, currentProfile?.apellidos].filter(Boolean).join(' ').trim();
  }
  if (position && !position.value.trim()) position.value = currentProfile?.cargo || '';
}

async function loadTrainingModule() {
  if (!client || !currentProfile) return;
  setTrainingMessage('');
  if (!trainingCatalogLoaded) await loadTrainingCatalogs();
  const date = document.getElementById('trainingDate');
  if (date && !date.value) date.value = todayISO();
  prefillResponsible();
}

async function lookupTrainerByDni() {
  if (!client) return;
  const dniEl = document.getElementById('trainerDni');
  const dni = (dniEl?.value || '').replace(/\D/g, '');
  if (dni.length !== 8) return;
  const { data, error } = await client
    .from('trabajadores')
    .select('dni,nombres,apellidos,cargo,area,empresa,sede_id,activo')
    .eq('dni', dni)
    .maybeSingle();
  if (error) { console.error(error); return; }
  if (!data) return;
  document.getElementById('trainerName').value = `${data.apellidos || ''} ${data.nombres || ''}`.trim();
  document.getElementById('trainerPosition').value = data.cargo || '';
  document.getElementById('trainerArea').value = data.area || '';
  if (data.empresa) document.getElementById('trainingCompany').value = data.empresa;
  if (data.sede_id && trainingUnit && !trainingUnit.value) {
    const val = `sede:${data.sede_id}`;
    if ([...trainingUnit.options].some(o => o.value === val)) trainingUnit.value = val;
  }
  setTrainingMessage(`Datos del expositor completados desde la base de trabajadores${data.activo ? '.' : ' (trabajador inactivo).'} `, data.activo ? 'success' : 'error');
}

function resetSignatureCanvas() {
  if (!signatureCanvas || !signatureCtx) return;
  signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  signatureCtx.fillStyle = '#ffffff';
  signatureCtx.fillRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  signatureCtx.strokeStyle = '#17263c';
  signatureCtx.lineWidth = 4;
  signatureCtx.lineCap = 'round';
  signatureCtx.lineJoin = 'round';
  signatureHasStroke = false;
}

function openSignatureModal(target) {
  activeSignatureTarget = target;
  document.getElementById('signatureModalTitle').textContent = target === 'trainer' ? 'Firma del Expositor' : 'Firma del Responsable';
  resetSignatureCanvas();
  const existing = document.getElementById(target === 'trainer' ? 'trainerSignatureData' : 'responsibleSignatureData')?.value;
  if (existing && signatureCtx && signatureCanvas) {
    const img = new Image();
    img.onload = () => { resetSignatureCanvas(); signatureCtx.drawImage(img, 0, 0, signatureCanvas.width, signatureCanvas.height); signatureHasStroke = true; };
    img.src = existing;
  }
  signatureModal?.classList.remove('hidden');
}

function closeSignatureModal() {
  signatureModal?.classList.add('hidden');
  activeSignatureTarget = null;
  signatureDrawing = false;
}

function canvasPoint(event) {
  const rect = signatureCanvas.getBoundingClientRect();
  const source = event.touches?.[0] || event.changedTouches?.[0] || event;
  return {
    x: (source.clientX - rect.left) * (signatureCanvas.width / rect.width),
    y: (source.clientY - rect.top) * (signatureCanvas.height / rect.height)
  };
}

function startSignature(event) {
  if (!signatureCtx || !signatureCanvas) return;
  event.preventDefault();
  signatureDrawing = true;
  signatureHasStroke = true;
  const p = canvasPoint(event);
  signatureCtx.beginPath();
  signatureCtx.moveTo(p.x, p.y);
}

function drawSignature(event) {
  if (!signatureDrawing || !signatureCtx) return;
  event.preventDefault();
  const p = canvasPoint(event);
  signatureCtx.lineTo(p.x, p.y);
  signatureCtx.stroke();
}

function stopSignature(event) {
  if (!signatureDrawing) return;
  event?.preventDefault?.();
  signatureDrawing = false;
  signatureCtx?.closePath();
}

function setSignature(target, dataUrl = '') {
  const input = document.getElementById(target === 'trainer' ? 'trainerSignatureData' : 'responsibleSignatureData');
  const preview = document.getElementById(target === 'trainer' ? 'trainerSignaturePreview' : 'responsibleSignaturePreview');
  const empty = document.getElementById(target === 'trainer' ? 'trainerSignatureEmpty' : 'responsibleSignatureEmpty');
  const clear = document.getElementById(target === 'trainer' ? 'clearTrainerSignature' : 'clearResponsibleSignature');
  if (input) input.value = dataUrl;
  if (preview) {
    preview.src = dataUrl || '';
    preview.classList.toggle('hidden', !dataUrl);
  }
  empty?.classList.toggle('hidden', !!dataUrl);
  clear?.classList.toggle('hidden', !dataUrl);
}

function saveCurrentSignature() {
  if (!activeSignatureTarget || !signatureCanvas || !signatureHasStroke) {
    alert('Registra una firma antes de guardar.');
    return;
  }
  setSignature(activeSignatureTarget, signatureCanvas.toDataURL('image/png'));
  closeSignatureModal();
}

function parseTrainingUnit() {
  const value = trainingUnit?.value || '';
  if (!value.includes(':')) return { sede_id: null, proyecto_id: null };
  const [type, id] = value.split(':');
  return type === 'sede' ? { sede_id: id, proyecto_id: null } : { sede_id: null, proyecto_id: id };
}

function collectTrainingPayload() {
  const location = parseTrainingUnit();
  return {
    clasificacion: document.getElementById('trainingClassification').value,
    ...location,
    tema: document.getElementById('trainingTopic').value.trim(),
    expositor_nombre: document.getElementById('trainerName').value.trim(),
    expositor_dni: document.getElementById('trainerDni').value.replace(/\D/g, ''),
    expositor_cargo: document.getElementById('trainerPosition').value.trim(),
    empresa: document.getElementById('trainingCompany').value.trim(),
    area: document.getElementById('trainerArea').value.trim(),
    fecha: document.getElementById('trainingDate').value,
    tiempo_texto: document.getElementById('trainingDuration').value.trim(),
    firma_expositor: document.getElementById('trainerSignatureData').value,
    responsable_nombre: document.getElementById('responsibleName').value.trim(),
    responsable_cargo: document.getElementById('responsiblePosition').value.trim(),
    responsable_dni: document.getElementById('responsibleDni').value.replace(/\D/g, ''),
    firma_responsable: document.getElementById('responsibleSignatureData').value,
    estado: 'BORRADOR',
    created_by: currentProfile?.id || null
  };
}

function validateTrainingPayload(payload) {
  if (!payload.clasificacion || (!payload.sede_id && !payload.proyecto_id) || !payload.tema || !payload.expositor_nombre || !payload.expositor_cargo || !payload.empresa || !payload.area || !payload.fecha || !payload.tiempo_texto || !payload.responsable_nombre || !payload.responsable_cargo) {
    return 'Completa todos los campos obligatorios.';
  }
  if (!/^\d{8}$/.test(payload.expositor_dni)) return 'El DNI del expositor debe contener exactamente 8 dígitos.';
  if (!/^\d{8}$/.test(payload.responsable_dni)) return 'El DNI del responsable debe contener exactamente 8 dígitos.';
  if (!payload.firma_expositor) return 'Registra la firma del expositor.';
  if (!payload.firma_responsable) return 'Registra la firma del responsable.';
  return '';
}

async function persistTraining({ continueNext = false } = {}) {
  if (!client || !currentProfile) return;
  const payload = collectTrainingPayload();
  const validation = validateTrainingPayload(payload);
  if (validation) { setTrainingFormMessage(validation); return; }

  const id = document.getElementById('trainingId').value || null;
  const button = continueNext ? document.getElementById('continueTrainingButton') : document.getElementById('saveTrainingDraftButton');
  const oldLabel = button?.textContent;
  if (button) { button.disabled = true; button.textContent = 'Guardando…'; }
  setTrainingFormMessage('');

  let response;
  if (id) {
    const { created_by, ...updatePayload } = payload;
    response = await client.from('capacitaciones').update(updatePayload).eq('id', id).select('id,codigo').single();
  } else {
    response = await client.from('capacitaciones').insert(payload).select('id,codigo').single();
  }

  if (button) { button.disabled = false; button.textContent = oldLabel; }

  if (response.error) {
    console.error(response.error);
    const missingTable = /capacitaciones/i.test(response.error.message || '') && /schema cache|does not exist|relation/i.test(response.error.message || '');
    setTrainingFormMessage(missingTable ? 'Primero ejecuta el SQL de la Etapa 5 en Supabase para crear la tabla capacitaciones.' : 'No fue posible guardar la capacitación. Revisa los datos y permisos.');
    return;
  }

  document.getElementById('trainingId').value = response.data.id;
  setTrainingMessage(`Borrador ${response.data.codigo || ''} guardado correctamente.`, 'success');
  if (continueNext) {
    setTrainingFormMessage('Datos del capacitador guardados. El siguiente módulo será la configuración del examen.', 'success');
    document.querySelector('.training-steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    setTrainingFormMessage('Borrador guardado correctamente.', 'success');
  }
}

function clearTrainingForm() {
  if (!window.confirm('¿Deseas limpiar el formulario actual? Los cambios no guardados se perderán.')) return;
  trainingForm?.reset();
  document.getElementById('trainingId').value = '';
  document.getElementById('trainingCompany').value = 'EXPLO DRILLING PERU S.R.L.';
  document.getElementById('trainingDate').value = todayISO();
  setSignature('trainer', '');
  setSignature('responsible', '');
  setTrainingFormMessage('');
  setTrainingMessage('');
  renderTrainingUnitOptions();
  prefillResponsible();
}

document.querySelectorAll('.signature-open').forEach(button => button.addEventListener('click', () => openSignatureModal(button.dataset.signatureTarget)));
document.getElementById('closeSignatureModal')?.addEventListener('click', closeSignatureModal);
document.getElementById('cancelSignatureModal')?.addEventListener('click', closeSignatureModal);
document.getElementById('clearSignatureCanvas')?.addEventListener('click', resetSignatureCanvas);
document.getElementById('saveSignatureButton')?.addEventListener('click', saveCurrentSignature);
signatureModal?.addEventListener('click', e => { if (e.target === signatureModal) closeSignatureModal(); });

signatureCanvas?.addEventListener('pointerdown', startSignature);
signatureCanvas?.addEventListener('pointermove', drawSignature);
signatureCanvas?.addEventListener('pointerup', stopSignature);
signatureCanvas?.addEventListener('pointerleave', stopSignature);
signatureCanvas?.addEventListener('pointercancel', stopSignature);

document.getElementById('clearTrainerSignature')?.addEventListener('click', () => setSignature('trainer', ''));
document.getElementById('clearResponsibleSignature')?.addEventListener('click', () => setSignature('responsible', ''));
document.getElementById('trainerDni')?.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8); });
document.getElementById('trainerDni')?.addEventListener('blur', lookupTrainerByDni);
document.getElementById('responsibleDni')?.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8); });
document.getElementById('clearTrainingButton')?.addEventListener('click', clearTrainingForm);
document.getElementById('saveTrainingDraftButton')?.addEventListener('click', () => persistTraining({ continueNext: false }));
trainingForm?.addEventListener('submit', e => { e.preventDefault(); persistTraining({ continueNext: true }); });

initializeAuth();
