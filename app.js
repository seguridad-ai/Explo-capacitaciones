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
const publicExamScreen = document.getElementById('publicExamScreen');
const publicPracticeScreen = document.getElementById('publicPracticeScreen');

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
  publicExamScreen?.classList.add('hidden');
  publicPracticeScreen?.classList.add('hidden');
  appShell?.classList.add('hidden');
  authScreen?.classList.remove('hidden');
  authLoading?.classList.add('hidden');
  setTimeout(() => loginEmail?.focus(), 50);
}

function showLoading() {
  publicExamScreen?.classList.add('hidden');
  publicPracticeScreen?.classList.add('hidden');
  appShell?.classList.add('hidden');
  authScreen?.classList.add('hidden');
  authLoading?.classList.remove('hidden');
}

function showApp() {
  publicExamScreen?.classList.add('hidden');
  publicPracticeScreen?.classList.add('hidden');
  authScreen?.classList.add('hidden');
  authLoading?.classList.add('hidden');
  appShell?.classList.remove('hidden');
}

function showSection(sectionId) {
  sections.forEach(section => section.classList.toggle('active-section', section.id === sectionId));
  menuItems.forEach(item => item.classList.toggle('active', item.dataset.section === sectionId));
  sidebar?.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (sectionId === 'programacion') loadScheduleModule();
  if (sectionId === 'sedes-proyectos') loadCatalogs();
  if (sectionId === 'trabajadores') loadWorkersModule();
  if (sectionId === 'nueva-capacitacion') loadTrainingModule();
  if (sectionId === 'practicar') loadPracticeModule();
  if (sectionId === 'usuarios') loadUsersModule();
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

  const publicParams = new URLSearchParams(window.location.search);
  const publicExamCode = publicParams.get('exam');
  const publicPracticeCodeParam = publicParams.get('practice');
  if (publicExamCode) {
    await initializePublicExamMode(publicExamCode);
    return;
  }
  if (publicPracticeCodeParam) {
    await initializePublicPracticeMode(publicPracticeCodeParam);
    return;
  }

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



// ============================================================
// ETAPA 11 · USUARIOS Y PERMISOS
// ============================================================
let systemUsers = [];
let systemUserAssignments = [];
let systemUserProjects = [];
let usersModuleLoaded = false;

function usersMessage(message = '', type = 'error') {
  const el = document.getElementById('usersModuleMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `module-message ${message ? 'visible' : ''} ${type}`;
}

function userFormMessage(message = '', type = 'error') {
  const el = document.getElementById('userFormMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `form-message ${message ? 'visible' : ''} ${type}`;
}

function systemRoleLabel(role) {
  return { ADMIN: 'Administrador', GERENCIA: 'Gerencia', PROYECTO: 'Usuario de proyecto' }[role] || role || '—';
}

function systemUserProjectNames(userId) {
  const ids = systemUserAssignments.filter(x => x.user_id === userId && x.activo !== false).map(x => x.proyecto_id);
  return systemUserProjects.filter(p => ids.includes(p.id)).map(p => p.nombre);
}

function updateUsersStats(records = systemUsers) {
  const active = records.filter(x => x.activo).length;
  const project = records.filter(x => x.rol_codigo === 'PROYECTO').length;
  const global = records.filter(x => ['ADMIN','GERENCIA'].includes(x.rol_codigo)).length;
  const map = {
    usersTotalCount: records.length,
    usersActiveCount: active,
    usersProjectCount: project,
    usersGlobalCount: global
  };
  Object.entries(map).forEach(([id,value]) => { const el=document.getElementById(id); if(el) el.textContent=String(value); });
}

function renderUsersTable() {
  const body = document.getElementById('usersTableBody');
  if (!body) return;
  const q = (document.getElementById('usersSearch')?.value || '').trim().toLowerCase();
  const role = document.getElementById('usersRoleFilter')?.value || '';
  const status = document.getElementById('usersStatusFilter')?.value || '';
  const rows = systemUsers.filter(u => {
    const hay = `${u.nombres||''} ${u.apellidos||''} ${u.email||''} ${u.cargo||''}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (role && u.rol_codigo !== role) return false;
    if (status === 'active' && !u.activo) return false;
    if (status === 'inactive' && u.activo) return false;
    return true;
  });
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" class="table-empty">No se encontraron usuarios.</td></tr>';
    return;
  }
  body.innerHTML = rows.map(u => {
    const names = [u.nombres,u.apellidos].filter(Boolean).join(' ').trim() || '—';
    const projects = systemUserProjectNames(u.id);
    const projectHtml = u.rol_codigo === 'PROYECTO'
      ? (projects.length ? projects.map(x=>`<span class="user-project-chip">${escapeHtml(x)}</span>`).join('') : '<span class="user-project-missing">Sin proyecto</span>')
      : '<span class="user-global-access">Todos</span>';
    const isSelf = u.id === currentProfile?.id;
    return `<tr>
      <td><strong>${escapeHtml(names)}</strong>${isSelf ? '<small class="current-user-tag">Tu usuario</small>' : ''}</td>
      <td>${escapeHtml(u.email || '—')}</td>
      <td>${escapeHtml(u.cargo || '—')}</td>
      <td><span class="user-role-badge ${String(u.rol_codigo||'').toLowerCase()}">${escapeHtml(systemRoleLabel(u.rol_codigo))}</span></td>
      <td><div class="user-project-chips">${projectHtml}</div></td>
      <td><span class="status-badge ${u.activo ? 'active' : 'inactive'}">${u.activo ? 'ACTIVO' : 'INACTIVO'}</span></td>
      <td><div class="row-actions"><button type="button" onclick="openSystemUserModal('${u.id}')">Editar</button>${isSelf ? '' : `<button type="button" class="${u.activo ? 'danger-link' : 'success-link'}" onclick="toggleSystemUserStatus('${u.id}')">${u.activo ? 'Desactivar' : 'Activar'}</button>`}</div></td>
    </tr>`;
  }).join('');
}

async function loadUsersModule(force = false) {
  if (!client || currentProfile?.rol_codigo !== 'ADMIN') return;
  if (usersModuleLoaded && !force) { renderUsersTable(); return; }
  usersMessage('');
  const body = document.getElementById('usersTableBody');
  if (body) body.innerHTML = '<tr><td colspan="7" class="table-empty">Cargando usuarios…</td></tr>';
  const [profilesRes, assignmentsRes, projectsRes] = await Promise.all([
    client.from('profiles').select('id,email,nombres,apellidos,cargo,rol_codigo,activo,created_at,updated_at').order('nombres',{ascending:true}),
    client.from('usuarios_proyectos').select('user_id,proyecto_id,activo,created_at'),
    client.from('proyectos').select('id,codigo,nombre,cliente,activo').order('nombre',{ascending:true})
  ]);
  if (profilesRes.error) { console.error(profilesRes.error); usersMessage('No fue posible cargar los usuarios.'); return; }
  systemUsers = profilesRes.data || [];
  systemUserAssignments = assignmentsRes.error ? [] : (assignmentsRes.data || []);
  systemUserProjects = projectsRes.error ? [] : (projectsRes.data || []);
  usersModuleLoaded = true;
  updateUsersStats();
  renderUsersTable();
}

function renderSystemUserProjectOptions(selectedIds = []) {
  const box = document.getElementById('systemUserProjectOptions');
  if (!box) return;
  const activeProjects = systemUserProjects.filter(p => p.activo !== false);
  if (!activeProjects.length) {
    box.innerHTML = '<span class="user-project-empty">No hay proyectos activos registrados.</span>';
    return;
  }
  box.innerHTML = activeProjects.map(p => `<label class="user-project-option"><input type="checkbox" value="${p.id}" ${selectedIds.includes(p.id) ? 'checked' : ''}><span><b>${escapeHtml(p.nombre)}</b><small>${escapeHtml(p.cliente || p.codigo || '')}</small></span></label>`).join('');
}

function selectedSystemUserProjectIds() {
  return [...document.querySelectorAll('#systemUserProjectOptions input[type="checkbox"]:checked')].map(x => x.value);
}

function updateSystemUserRoleFields() {
  const role = document.getElementById('systemUserRole')?.value || 'PROYECTO';
  document.getElementById('systemUserProjectsField')?.classList.toggle('hidden', role !== 'PROYECTO');
}

function openSystemUserModal(userId = '') {
  if (currentProfile?.rol_codigo !== 'ADMIN') return;
  const modal = document.getElementById('userModal');
  const form = document.getElementById('userForm');
  form?.reset();
  userFormMessage('');
  document.getElementById('userEditId').value = userId || '';
  document.getElementById('systemUserActive').checked = true;
  document.getElementById('systemUserRole').value = 'PROYECTO';
  document.getElementById('systemUserEmail').disabled = false;
  document.getElementById('systemUserRole').disabled = false;
  document.getElementById('systemUserActive').disabled = false;
  document.getElementById('systemUserPasswordField').classList.remove('hidden');
  document.getElementById('systemUserActiveField').classList.toggle('hidden', !userId);
  document.getElementById('userModalTitle').textContent = userId ? 'Editar usuario' : 'Nuevo usuario';
  document.getElementById('userModalSubtitle').textContent = userId ? 'Actualiza el perfil, rol y proyectos asignados.' : 'Crea una cuenta para un usuario interno.';

  if (userId) {
    const user = systemUsers.find(x => x.id === userId);
    if (!user) return;
    document.getElementById('systemUserNames').value = user.nombres || '';
    document.getElementById('systemUserLastNames').value = user.apellidos || '';
    document.getElementById('systemUserEmail').value = user.email || '';
    document.getElementById('systemUserEmail').disabled = true;
    document.getElementById('systemUserPosition').value = user.cargo || '';
    document.getElementById('systemUserRole').value = user.rol_codigo || 'PROYECTO';
    document.getElementById('systemUserActive').checked = !!user.activo;
    document.getElementById('systemUserPasswordField').classList.add('hidden');
    const selected = systemUserAssignments.filter(x => x.user_id === userId && x.activo !== false).map(x => x.proyecto_id);
    renderSystemUserProjectOptions(selected);
    if (userId === currentProfile?.id) {
      document.getElementById('systemUserRole').disabled = true;
      document.getElementById('systemUserActive').disabled = true;
      userFormMessage('Por seguridad, no puedes cambiar tu propio rol ni desactivar tu cuenta desde esta pantalla.', 'success');
    }
  } else {
    renderSystemUserProjectOptions([]);
  }
  updateSystemUserRoleFields();
  modal?.classList.remove('hidden');
  setTimeout(()=>document.getElementById('systemUserNames')?.focus(),50);
}

function closeSystemUserModal() {
  document.getElementById('userModal')?.classList.add('hidden');
  userFormMessage('');
}

async function saveSystemUser(event) {
  event?.preventDefault();
  if (!client || currentProfile?.rol_codigo !== 'ADMIN') return;
  const id = document.getElementById('userEditId').value;
  const nombres = document.getElementById('systemUserNames').value.trim();
  const apellidos = document.getElementById('systemUserLastNames').value.trim();
  const email = document.getElementById('systemUserEmail').value.trim().toLowerCase();
  const password = document.getElementById('systemUserPassword').value;
  const cargo = document.getElementById('systemUserPosition').value.trim();
  const role = document.getElementById('systemUserRole').value;
  const activo = document.getElementById('systemUserActive').checked;
  const projectIds = role === 'PROYECTO' ? selectedSystemUserProjectIds() : [];

  if (!nombres || !apellidos || !cargo || !email) { userFormMessage('Completa todos los campos obligatorios.'); return; }
  if (!/^\S+@\S+\.\S+$/.test(email)) { userFormMessage('Ingresa un correo electrónico válido.'); return; }
  if (!id && password.length < 8) { userFormMessage('La contraseña inicial debe tener al menos 8 caracteres.'); return; }
  if (role === 'PROYECTO' && !projectIds.length) { userFormMessage('Selecciona al menos un proyecto para este usuario.'); return; }

  const saveButton = document.getElementById('saveSystemUserButton');
  const old = saveButton.textContent;
  saveButton.disabled = true; saveButton.textContent = 'Guardando…';
  try {
    if (!id) {
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Tu sesión expiró. Cierra sesión e ingresa nuevamente.');

      const { data, error } = await client.functions.invoke('admin-create-user', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { email, password, nombres, apellidos, cargo, rol_codigo: role, proyecto_ids: projectIds }
      });

      if (error || !data?.ok) {
        console.error('admin-create-user', error, data);
        let detail = data?.error || '';
        let status = null;

        if (error?.context) {
          try {
            status = error.context.status;
            const responseBody = await error.context.clone().json();
            detail = responseBody?.error || responseBody?.message || detail;
          } catch (_) {
            try { detail = await error.context.clone().text() || detail; } catch (_) {}
          }
        }

        if (!detail) detail = error?.message || 'No fue posible crear el usuario.';

        if (status === 401) {
          throw new Error(`La función rechazó la sesión administrativa: ${detail}`);
        }
        if (status === 403) {
          throw new Error(`No tienes autorización para crear usuarios: ${detail}`);
        }
        if (status === 404) {
          throw new Error('Supabase no encontró la función admin-create-user. Verifica el nombre exacto y vuelve a desplegarla.');
        }
        throw new Error(detail);
      }
      usersMessage('Usuario creado correctamente.', 'success');
    } else {
      const isSelf = id === currentProfile?.id;
      const user = systemUsers.find(x => x.id === id);
      const finalRole = isSelf ? user.rol_codigo : role;
      const finalActive = isSelf ? user.activo : activo;
      const profileUpdate = await client.from('profiles').update({nombres,apellidos,cargo,rol_codigo:finalRole,activo:finalActive}).eq('id',id);
      if (profileUpdate.error) throw profileUpdate.error;
      const del = await client.from('usuarios_proyectos').delete().eq('user_id',id);
      if (del.error) throw del.error;
      if (finalRole === 'PROYECTO' && projectIds.length) {
        const ins = await client.from('usuarios_proyectos').insert(projectIds.map(proyecto_id => ({user_id:id,proyecto_id,activo:true})));
        if (ins.error) throw ins.error;
      }
      usersMessage('Usuario actualizado correctamente.', 'success');
    }
    closeSystemUserModal();
    usersModuleLoaded = false;
    await loadUsersModule(true);
  } catch (err) {
    console.error(err);
    userFormMessage(err?.message || 'No fue posible guardar el usuario.');
  } finally {
    saveButton.disabled = false; saveButton.textContent = old;
  }
}

async function toggleSystemUserStatus(userId) {
  if (!client || currentProfile?.rol_codigo !== 'ADMIN') return;
  if (userId === currentProfile?.id) { alert('No puedes desactivar tu propia cuenta.'); return; }
  const user = systemUsers.find(x => x.id === userId);
  if (!user) return;
  const newStatus = !user.activo;
  if (!window.confirm(`¿${newStatus ? 'Activar' : 'Desactivar'} el acceso de ${[user.nombres,user.apellidos].filter(Boolean).join(' ')}?`)) return;
  const { error } = await client.from('profiles').update({activo:newStatus}).eq('id',userId);
  if (error) { console.error(error); usersMessage('No fue posible cambiar el estado del usuario.'); return; }
  usersMessage(`Usuario ${newStatus ? 'activado' : 'desactivado'} correctamente.`, 'success');
  usersModuleLoaded = false;
  await loadUsersModule(true);
}


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
    estado: document.getElementById('trainingCurrentStatus')?.value || 'BORRADOR',
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
  if (continueNext && ['BORRADOR','PROGRAMADA','REPROGRAMADA','EN CURSO'].includes(String(payload.estado || '').toUpperCase())) {
    payload.estado = 'ACTIVA';
  }
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
  document.getElementById('trainingCurrentStatus').value = payload.estado || 'BORRADOR';
  setTrainingMessage(`${payload.estado === 'ACTIVA' ? 'Capacitación activa' : 'Borrador'} ${response.data.codigo || ''} guardado correctamente.`, 'success');
  if (continueNext) {
    setTrainingFormMessage('Datos de la actividad guardados correctamente.', 'success');
    await openExamStep(response.data.id, response.data.codigo || '', payload);
  } else {
    setTrainingFormMessage('Borrador guardado correctamente.', 'success');
  }
}

function clearTrainingForm() {
  if (!window.confirm('¿Deseas limpiar el formulario actual? Los cambios no guardados se perderán.')) return;
  trainingForm?.reset();
  document.getElementById('trainingId').value = '';
  document.getElementById('trainingCurrentStatus').value = 'BORRADOR';
  document.getElementById('trainingCompany').value = 'EXPLO DRILLING PERU S.R.L.';
  document.getElementById('trainingDate').value = todayISO();
  setSignature('trainer', '');
  setSignature('responsible', '');
  setTrainingFormMessage('');
  setTrainingMessage('');
  resetParticipantsState();
  resetExamState();
  showTrainingDataStep();
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



// ============================== ETAPA 9B · HISTORIAL DE CAPACITACIONES ==============================
let scheduleRecords = [];
let scheduleSites = [];
let scheduleProjects = [];
let trainingLibraryExams = [];
let trainingLibraryParticipants = [];
let trainingLibraryQuestions = [];
let selectedTrainingDetailId = null;
let selectedTrainingDetailData = null;

const trainingLibraryView = document.getElementById('trainingLibraryView');
const trainingDetailView = document.getElementById('trainingDetailView');
const trainingLibraryList = document.getElementById('trainingLibraryList');

function scheduleMessage(message = '', type = 'error') {
  const el = document.getElementById('scheduleMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `module-message ${message ? 'visible' : ''} ${type}`;
}

function scheduleCanManage() {
  return ['ADMIN','PROYECTO'].includes(currentProfile?.rol_codigo);
}

function scheduleUnitLabel(item) {
  if (item?.sede_id) {
    const s = scheduleSites.find(x => x.id === item.sede_id);
    return s ? `Sede - ${s.nombre}` : 'Sede';
  }
  if (item?.proyecto_id) {
    const p = scheduleProjects.find(x => x.id === item.proyecto_id);
    return p ? `Proyecto - ${p.nombre}` : 'Proyecto';
  }
  return '—';
}

function normalizeTrainingState(state) {
  const value = String(state || 'BORRADOR').toUpperCase();
  if (['PROGRAMADA','REPROGRAMADA','EN CURSO','EN_CURSO'].includes(value)) return 'ACTIVA';
  return value;
}

function scheduleStatusClass(state) {
  return {
    'ACTIVA':'active',
    'FINALIZADA':'finished',
    'CANCELADA':'cancelled',
    'BORRADOR':'draft'
  }[normalizeTrainingState(state)] || 'draft';
}

function scheduleStatusLabel(state) {
  return normalizeTrainingState(state);
}

function trainingExamFor(trainingId) {
  return trainingLibraryExams.find(x => x.capacitacion_id === trainingId) || null;
}

function trainingParticipantsFor(trainingId) {
  return trainingLibraryParticipants.filter(x => x.capacitacion_id === trainingId);
}

function trainingQuestionCountFor(trainingId) {
  const exam = trainingExamFor(trainingId);
  return exam ? trainingLibraryQuestions.filter(x => x.examen_id === exam.id).length : 0;
}

function trainingPublicUrlFor(item) {
  const exam = trainingExamFor(item?.id);
  if (normalizeTrainingState(item?.estado) !== 'ACTIVA') return '';
  if (!item?.codigo || !exam?.requiere_evaluacion || !exam?.publicado || !exam?.activo) return '';
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('exam', item.codigo);
  return url.toString();
}

function trainingMetrics(item) {
  const participants = trainingParticipantsFor(item.id);
  const exam = trainingExamFor(item.id);
  const passGrade = Number(exam?.nota_aprobatoria ?? 16);
  const graded = participants.filter(x => x.nota !== null && x.nota !== undefined && Number.isFinite(Number(x.nota)));
  const average = graded.length ? graded.reduce((s,x)=>s+Number(x.nota),0) / graded.length : null;
  const approved = graded.filter(x => Number(x.nota) >= passGrade).length;
  const approval = graded.length ? (approved / graded.length) * 100 : null;
  return {
    participantCount: participants.length,
    signedCount: participants.filter(x => !!x.firma).length,
    questionCount: trainingQuestionCountFor(item.id),
    average,
    approved,
    approval,
    resultCount: graded.length,
    passGrade
  };
}

function formatTrainingDate(value) {
  if (!value) return '—';
  const [y,m,d] = String(value).split('-');
  if (!d) return value;
  return `${d}/${m}/${y}`;
}

function populateScheduleFilters() {
  const unit = document.getElementById('scheduleUnitFilter');
  if (unit) {
    const current = unit.value;
    unit.innerHTML = '<option value="all">Todas las sedes y proyectos</option>'
      + scheduleSites.map(x => `<option value="sede:${x.id}">Sede - ${escapeHtml(x.nombre)}</option>`).join('')
      + scheduleProjects.map(x => `<option value="proyecto:${x.id}">Proyecto - ${escapeHtml(x.nombre)}</option>`).join('');
    if ([...unit.options].some(o => o.value === current)) unit.value = current;
  }
  const classification = document.getElementById('scheduleClassificationFilter');
  if (classification) {
    const current = classification.value;
    const values = [...new Set(scheduleRecords.map(x => x.clasificacion).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es'));
    classification.innerHTML = '<option value="all">Todas las clasificaciones</option>' + values.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
    if ([...classification.options].some(o => o.value === current)) classification.value = current;
  }
  const year = document.getElementById('scheduleYearFilter');
  if (year) {
    const current = year.value;
    const years = [...new Set(scheduleRecords.map(x => String(x.fecha || '').slice(0,4)).filter(x => /^\d{4}$/.test(x)))].sort((a,b)=>b.localeCompare(a));
    year.innerHTML = '<option value="all">Todos los años</option>' + years.map(x => `<option value="${x}">${x}</option>`).join('');
    if ([...year.options].some(o => o.value === current)) year.value = current;
  }
}

function getFilteredScheduleRecords() {
  const unit = document.getElementById('scheduleUnitFilter')?.value || 'all';
  const classification = document.getElementById('scheduleClassificationFilter')?.value || 'all';
  const status = document.getElementById('scheduleStatusFilter')?.value || 'all';
  const year = document.getElementById('scheduleYearFilter')?.value || 'all';
  const search = (document.getElementById('scheduleSearch')?.value || '').trim().toLowerCase();
  return scheduleRecords.filter(item => {
    if (year !== 'all' && !String(item.fecha || '').startsWith(year)) return false;
    if (unit !== 'all') {
      const [type,id] = unit.split(':');
      if (type === 'sede' && item.sede_id !== id) return false;
      if (type === 'proyecto' && item.proyecto_id !== id) return false;
    }
    if (classification !== 'all' && item.clasificacion !== classification) return false;
    if (status !== 'all' && normalizeTrainingState(item.estado) !== status) return false;
    if (search) {
      const haystack = [item.codigo,item.tema,item.expositor_nombre,item.expositor_cargo,item.area,item.clasificacion,scheduleUnitLabel(item)].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function renderScheduleStats() {
  const records = getFilteredScheduleRecords();
  const participants = records.flatMap(x => trainingParticipantsFor(x.id));
  const active = records.filter(x => normalizeTrainingState(x.estado) === 'ACTIVA').length;
  const graded = participants.filter(x => x.nota !== null && x.nota !== undefined);
  let approved = 0;
  graded.forEach(p => {
    const training = records.find(x => x.id === p.capacitacion_id);
    const pass = Number(trainingExamFor(training?.id)?.nota_aprobatoria ?? 16);
    if (Number(p.nota) >= pass) approved++;
  });
  document.getElementById('scheduleTotalCount').textContent = String(records.length);
  document.getElementById('scheduleActiveCount').textContent = String(active);
  document.getElementById('scheduleParticipantCount').textContent = String(participants.length);
  document.getElementById('scheduleApprovalRate').textContent = graded.length ? `${Math.round(approved / graded.length * 100)}%` : '—';
}

function renderScheduleCards() {
  if (!trainingLibraryList) return;
  const records = getFilteredScheduleRecords().sort((a,b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const counter = document.getElementById('scheduleResultCount');
  if (counter) counter.textContent = `${records.length} ${records.length === 1 ? 'registro' : 'registros'}`;
  if (!records.length) {
    trainingLibraryList.innerHTML = '<div class="training-library-empty">No hay capacitaciones para los filtros seleccionados.</div>';
    return;
  }

  trainingLibraryList.innerHTML = records.map(item => {
    const metrics = trainingMetrics(item);
    const link = trainingPublicUrlFor(item);
    const state = scheduleStatusLabel(item.estado);
    const canManage = scheduleCanManage();
    return `<article class="training-history-card">
      <div class="training-history-main">
        <div class="training-history-icon">▤</div>
        <div class="training-history-content">
          <div class="training-history-title-row">
            <div>
              <h3>${escapeHtml(item.tema || 'Sin tema')}</h3>
              <p><strong>Expositor:</strong> ${escapeHtml(item.expositor_nombre || '—')} <span>· ${escapeHtml(item.expositor_cargo || '—')}</span></p>
            </div>
            <div class="training-history-badges">
              <span class="classification-badge">${escapeHtml(item.clasificacion || 'CAPACITACIÓN')}</span>
              <span class="training-status-badge ${scheduleStatusClass(state)}">${escapeHtml(state)}</span>
            </div>
          </div>
          <div class="training-history-meta">
            <span>▣ ${escapeHtml(formatTrainingDate(item.fecha))}</span>
            <span>♙ ${metrics.participantCount} participante${metrics.participantCount === 1 ? '' : 's'}</span>
            <span>▧ ${metrics.questionCount} pregunta${metrics.questionCount === 1 ? '' : 's'}</span>
            <span>⌖ ${escapeHtml(scheduleUnitLabel(item))}</span>
            <span>Área: ${escapeHtml(item.area || '—')}</span>
          </div>
          <div class="training-history-kpis">
            <span class="history-kpi ${metrics.average !== null ? 'good' : ''}">Nota promedio: <b>${metrics.average === null ? '—' : metrics.average.toFixed(1)}</b></span>
            <span class="history-kpi ${metrics.approval !== null ? 'good' : ''}">Aprobación: <b>${metrics.approval === null ? '—' : `${Math.round(metrics.approval)}%`}</b></span>
            <span class="history-kpi">Con firma: <b>${metrics.signedCount}/${metrics.participantCount}</b></span>
          </div>
        </div>
      </div>
      <div class="training-history-actions">
        <button class="history-action share" type="button" data-training-whatsapp="${item.id}" ${link ? '' : 'disabled'} title="Compartir por WhatsApp">⌘</button>
        <button class="history-action copy" type="button" data-training-copy="${item.id}" ${link ? '' : 'disabled'} title="Copiar enlace">▣</button>
        <button class="history-detail-btn" type="button" data-training-detail="${item.id}">◉ Ver detalles</button>
        ${canManage ? `<button class="history-edit-btn" type="button" data-training-edit="${item.id}">Editar</button>` : ''}
      </div>
    </article>`;
  }).join('');
}

function renderScheduleModule() {
  populateScheduleFilters();
  renderScheduleStats();
  renderScheduleCards();
}

async function loadScheduleModule(force = false) {
  if (!client) return;
  if (scheduleRecords.length && !force) { renderScheduleModule(); return; }
  scheduleMessage('');
  if (trainingLibraryList) trainingLibraryList.innerHTML = '<div class="training-library-empty">Cargando capacitaciones…</div>';
  const [trainings, sites, projects, exams, participants, questions] = await Promise.all([
    client.from('capacitaciones').select('id,codigo,clasificacion,tema,expositor_nombre,expositor_cargo,empresa,area,sede_id,proyecto_id,fecha,tiempo_texto,estado,responsable_nombre,responsable_cargo,responsable_dni,firma_expositor,firma_responsable,created_at,updated_at').order('fecha',{ascending:false}).limit(2000),
    client.from('sedes').select('id,nombre,activo').order('nombre'),
    client.from('proyectos').select('id,nombre,cliente,activo').order('nombre'),
    client.from('examenes').select('id,capacitacion_id,titulo,requiere_evaluacion,nota_aprobatoria,max_intentos,mostrar_resultado,publicado,activo'),
    client.from('capacitacion_participantes').select('id,capacitacion_id,trabajador_id,dni,apellidos_nombres,puesto,area,firma,fecha_firma,nota,created_at'),
    client.from('examen_preguntas').select('id,examen_id,orden,activo')
  ]);
  if (trainings.error) {
    console.error(trainings.error);
    scheduleMessage('No fue posible cargar las capacitaciones.');
    return;
  }
  scheduleRecords = trainings.data || [];
  scheduleSites = sites.data || [];
  scheduleProjects = projects.data || [];
  trainingLibraryExams = exams.error ? [] : (exams.data || []);
  trainingLibraryParticipants = participants.error ? [] : (participants.data || []);
  trainingLibraryQuestions = questions.error ? [] : (questions.data || []);
  renderScheduleModule();
}

function showTrainingLibrary() {
  selectedTrainingDetailId = null;
  selectedTrainingDetailData = null;
  trainingDetailView?.classList.add('hidden');
  trainingLibraryView?.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function trainingDetailTab(tab) {
  document.querySelectorAll('.training-detail-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.trainingDetailTab === tab));
  const map = {
    participants: 'trainingDetailParticipants',
    exam: 'trainingDetailExam',
    results: 'trainingDetailResults',
    document: 'trainingDetailDocument'
  };
  Object.entries(map).forEach(([key,id]) => document.getElementById(id)?.classList.toggle('hidden', key !== tab));
}

function renderDetailParticipants(participants) {
  const body = document.getElementById('detailParticipantsBody');
  if (!body) return;
  if (!participants.length) {
    body.innerHTML = '<tr><td colspan="8" class="table-empty">Aún no hay participantes evaluados.</td></tr>';
    return;
  }
  body.innerHTML = participants.map((p,i) => {
    const completed = !!p.firma;
    const signature = completed ? `<img class="preview-signature" src="${p.firma}" alt="Firma">` : '<span class="grade-pill pending">Pendiente</span>';
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${escapeHtml(p.apellidos_nombres || '—')}</strong></td>
      <td>${escapeHtml(p.dni || '—')}</td>
      <td>${escapeHtml(p.puesto || '—')}</td>
      <td>${escapeHtml(p.area || '—')}</td>
      <td>${signature}</td>
      <td>${p.nota == null ? '<span class="grade-pill pending">Pendiente</span>' : `<span class="grade-pill">${Number(p.nota).toFixed(2).replace(/\.00$/,'')}</span>`}</td>
      <td><span class="status-pill ${completed ? 'completed' : 'evaluated'}">${completed ? 'COMPLETADO' : 'EVALUADO'}</span></td>
    </tr>`;
  }).join('');
}

function renderDetailExam(exam, questions) {
  const box = document.getElementById('detailExamQuestions');
  if (!box) return;
  if (!exam?.requiere_evaluacion) {
    box.innerHTML = '<div class="training-library-empty">Esta capacitación no requiere examen.</div>';
    return;
  }
  if (!questions.length) {
    box.innerHTML = '<div class="training-library-empty">El examen todavía no tiene preguntas.</div>';
    return;
  }
  box.innerHTML = questions.map((q,index) => `<article class="detail-exam-card">
    <div class="detail-exam-question-head"><strong>${index+1}. ${escapeHtml(q.enunciado || '')}</strong><span>${q.examen_opciones?.length || 0} alternativas</span></div>
    <div class="detail-exam-options">
      ${(q.examen_opciones || []).sort((a,b)=>a.orden-b.orden).map((o,oi) => `<div class="detail-exam-option ${o.es_correcta ? 'correct' : ''}"><b>${String.fromCharCode(65+oi)})</b> ${escapeHtml(o.texto || '')}${o.es_correcta ? '<small>Respuesta correcta</small>' : ''}</div>`).join('')}
    </div>
  </article>`).join('');
}


function buildDetailResultRows(participants, attempts, responses, exam, totalQuestions) {
  const participantMap = new Map(participants.map(p => [p.id, p]));
  const grouped = new Map();
  attempts.forEach(a => {
    if (!grouped.has(a.participante_id)) grouped.set(a.participante_id, []);
    grouped.get(a.participante_id).push(a);
  });
  const rows = [];
  grouped.forEach((list, participantId) => {
    list.sort((a,b) => Number(b.nota)-Number(a.nota) || String(b.finalizado_at||'').localeCompare(String(a.finalizado_at||'')));
    const best = list[0];
    const p = participantMap.get(participantId) || {};
    const correct = responses.filter(r => r.intento_id === best.id && r.es_correcta).length;
    rows.push({p,best,correct,attempts:list.length,totalQuestions});
  });
  rows.sort((a,b) => String(a.p.apellidos_nombres || '').localeCompare(String(b.p.apellidos_nombres || ''),'es'));
  return rows;
}

function renderDetailResults(participants, attempts, responses, exam, totalQuestions) {
  const body = document.getElementById('detailResultsBody');
  if (!body) return;
  if (!exam?.requiere_evaluacion || !attempts.length) {
    body.innerHTML = '<tr><td colspan="7" class="table-empty">Aún no hay resultados de evaluación.</td></tr>';
    return;
  }
  const rows = buildDetailResultRows(participants, attempts, responses, exam, totalQuestions);
  body.innerHTML = rows.map(({p,best,correct,attempts:used}) => `<tr>
    <td><strong>${escapeHtml(p.apellidos_nombres || '—')}</strong><small class="result-dni">${escapeHtml(p.dni || '')}</small></td>
    <td>${correct} / ${totalQuestions}</td>
    <td>${Number(best.nota).toFixed(1)} / 20.0</td>
    <td><strong class="result-grade ${best.aprobado ? 'approved' : 'failed'}">${Number(best.nota).toFixed(1)}</strong></td>
    <td>${used} / ${exam.max_intentos}</td>
    <td><span class="result-status ${best.aprobado ? 'approved' : 'failed'}">${best.aprobado ? 'APROBADO' : 'DESAPROBADO'}</span></td>
    <td><div class="result-action-stack">
      <button type="button" class="secondary-btn result-download-btn" onclick="downloadParticipantExamPdf('${best.id}')">Descargar Examen</button>
      ${best.aprobado ? `<button type="button" class="certificate-btn" onclick="downloadParticipantCertificatePdf('${best.id}')">Certificado</button>` : '<span class="certificate-unavailable">Certificado no disponible</span>'}
    </div></td>
  </tr>`).join('');
}

function renderDocumentPreview(training, participants) {
  const box = document.getElementById('detailDocumentPreview');
  if (!box) return;
  const completed = participants.filter(x => !!x.firma);
  const classificationOptions = ['INDUCCIÓN','CAPACITACIÓN','ENTRENAMIENTO','SIMULACRO DE EMERGENCIA','VISITANTES','RE-INDUCCIÓN','CAMBIO DE PUESTO','REUNIÓN','OTROS'];
  const firstPage = completed.slice(0, 25);
  const rows = [];
  for (let i = 0; i < 25; i += 1) {
    const p = firstPage[i];
    rows.push(`<tr>
      <td>${i + 1}</td>
      <td>${p ? escapeHtml(p.apellidos_nombres || '') : ''}</td>
      <td>${p ? escapeHtml(p.dni || '') : ''}</td>
      <td>${p ? escapeHtml(p.puesto || '') : ''}</td>
      <td>${p ? escapeHtml(p.area || '') : ''}</td>
      <td>${p?.firma ? `<img src="${p.firma}" alt="Firma">` : ''}</td>
      <td>${p ? (p.nota == null ? 'N.A.' : Number(p.nota).toFixed(2).replace(/\.00$/, '')) : ''}</td>
    </tr>`);
  }
  const trainerSignature = training.firma_expositor
    ? `<img class="document-form-signature" src="${training.firma_expositor}" alt="Firma del expositor">`
    : '<span class="document-form-empty">Sin firma</span>';
  const responsibleSignature = training.firma_responsable
    ? `<img class="document-form-signature responsible" src="${training.firma_responsable}" alt="Firma del responsable">`
    : '<span class="document-form-empty">Sin firma</span>';
  box.innerHTML = `<div class="official-document-wrap">
    ${completed.length > 25 ? `<div class="official-document-note">Vista previa de la primera hoja. El PDF genera ${Math.ceil(completed.length / 25)} hojas.</div>` : ''}
    <div class="official-document-page">
      <div class="official-doc-header">
        <div class="official-doc-logo"><img src="assets/logo-explo.jpg" alt="Explo Drilling Perú"></div>
        <div class="official-doc-title"><div class="official-doc-sig">SIG - SSOMAC</div><div class="official-doc-red">REGISTRO DE INDUCCIÓN, CAPACITACIÓN, ENTRENAMIENTO Y SIMULACRO DE EMERGENCIA</div></div>
        <div class="official-doc-meta">
          <div><b>Código:</b><span>${PDF_EMPLOYER.codigoFormato}</span></div>
          <div><b>N°:</b><span>${PDF_EMPLOYER.numeroFormato}</span></div>
          <div><b>Versión:</b><span>${PDF_EMPLOYER.version}</span></div>
          <div><b>Fecha Act:</b><span>${PDF_EMPLOYER.fechaActualizacion}</span></div>
        </div>
      </div>
      <div class="official-doc-employer-title">DATOS DE EMPLEADOR:</div>
      <div class="official-doc-employer-head">
        <div>RAZÓN O DENOMINACIÓN SOCIAL</div><div>RUC</div><div>DOMICILIO<br><small>(Dirección, distrito, provincia, dpto.)</small></div><div>ACTIVIDAD ECONÓMICA</div><div>N° TRABAJADORES EN EL<br>CENTRO LABORAL</div>
      </div>
      <div class="official-doc-employer-values">
        <div>${PDF_EMPLOYER.razonSocial}</div><div>${PDF_EMPLOYER.ruc}</div><div>${PDF_EMPLOYER.domicilio}</div><div>${PDF_EMPLOYER.actividad}</div><div>—</div>
      </div>
      <div class="official-doc-training">
        <div class="official-doc-classification">
          <b>CLASIFICACIÓN</b>
          ${classificationOptions.map(x => `<span><i class="official-checkbox ${x === training.clasificacion ? 'checked' : ''}"></i>${escapeHtml(x)}</span>`).join('')}
        </div>
        <div class="official-doc-training-main">
          <div class="official-topic-row"><b>TEMA:</b><span>${escapeHtml(training.tema || '—')}</span></div>
          <div class="official-field-row"><div><b>EXPOSITOR:</b><span>${escapeHtml(training.expositor_nombre || '—')}</span></div><div class="official-signature-field"><b>FIRMA:</b>${trainerSignature}</div></div>
          <div class="official-field-row"><div><b>CARGO:</b><span>${escapeHtml(training.expositor_cargo || '—')}</span></div><div><b>DNI:</b><span>${escapeHtml(training.expositor_dni || '—')}</span></div></div>
          <div class="official-field-row"><div><b>EMPRESA:</b><span>${escapeHtml(training.empresa || PDF_EMPLOYER.razonSocial)}</span></div><div><b>FECHA:</b><span>${escapeHtml(formatDatePE(training.fecha))}</span></div></div>
          <div class="official-field-row"><div><b>ÁREA:</b><span>${escapeHtml(training.area || '—')}</span></div><div><b>TIEMPO:</b><span>${escapeHtml(training.tiempo_texto || '—')}</span></div></div>
        </div>
      </div>
      <table class="official-doc-participants">
        <colgroup><col class="c-num"><col class="c-name"><col class="c-dni"><col class="c-position"><col class="c-area"><col class="c-sign"><col class="c-grade"></colgroup>
        <thead><tr><th>N°</th><th>APELLIDOS Y NOMBRES</th><th>N° DNI</th><th>PUESTO DE TRABAJO</th><th>ÁREA</th><th>FIRMA</th><th>NOTA</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <div class="official-doc-responsible-title">RESPONSABLE DEL REGISTRO</div>
      <div class="official-doc-responsible">
        <div><p><b>NOMBRE:</b><span>${escapeHtml(training.responsable_nombre || '—')}</span></p><p><b>CARGO:</b><span>${escapeHtml(training.responsable_cargo || '—')}</span></p></div>
        <div><p class="responsible-sign"><b>FIRMA:</b>${responsibleSignature}</p><p><b>FECHA:</b><span>${escapeHtml(formatDatePE(training.fecha))}</span></p></div>
      </div>
    </div>
  </div>`;
}

async function openTrainingDetail(id) {
  if (!client) return;
  const item = scheduleRecords.find(x => x.id === id);
  if (!item) return;
  selectedTrainingDetailId = id;
  trainingLibraryView?.classList.add('hidden');
  trainingDetailView?.classList.remove('hidden');
  trainingDetailTab('participants');

  const existingExam = trainingExamFor(id);
  const [trainingRes, participantsRes, questionsRes, attemptsRes] = await Promise.all([
    client.from('capacitaciones').select('*').eq('id',id).single(),
    client.from('capacitacion_participantes').select('id,capacitacion_id,trabajador_id,dni,apellidos_nombres,puesto,area,firma,fecha_firma,nota,created_at').eq('capacitacion_id',id).order('created_at',{ascending:true}),
    existingExam ? client.from('examen_preguntas').select('id,examen_id,orden,enunciado,activo,examen_opciones(id,orden,texto,es_correcta)').eq('examen_id',existingExam.id).eq('activo',true).order('orden',{ascending:true}) : Promise.resolve({data:[],error:null}),
    existingExam ? client.from('examen_intentos').select('id,examen_id,participante_id,numero_intento,nota,aprobado,iniciado_at,finalizado_at').eq('examen_id',existingExam.id).order('finalizado_at',{ascending:true}) : Promise.resolve({data:[],error:null})
  ]);
  if (trainingRes.error || !trainingRes.data) {
    console.error(trainingRes.error);
    scheduleMessage('No fue posible abrir el detalle de la capacitación.');
    showTrainingLibrary();
    return;
  }
  const training = trainingRes.data;
  const participants = participantsRes.data || [];
  const questions = questionsRes.data || [];
  const attempts = attemptsRes.data || [];
  let responses = [];
  const attemptIds = attempts.map(x=>x.id);
  if (attemptIds.length) {
    const responseRes = await client.from('examen_respuestas').select('id,intento_id,pregunta_id,opcion_id,es_correcta').in('intento_id',attemptIds);
    if (!responseRes.error) responses = responseRes.data || [];
  }
  const exam = existingExam;
  selectedTrainingDetailData = {training,participants,questions,attempts,responses,exam};

  activeTrainingId = training.id;
  activeTrainingCode = training.codigo || '';
  activeTrainingPayload = training;
  activeExamId = exam?.id || null;
  activeExamConfig = exam || null;

  document.getElementById('detailTrainingTitle').textContent = training.tema || '—';
  document.getElementById('detailTrainerName').textContent = training.expositor_nombre || '—';
  document.getElementById('detailTrainerPosition').textContent = training.expositor_cargo || '—';
  document.getElementById('detailCompany').textContent = training.empresa || '—';
  document.getElementById('detailArea').textContent = training.area || '—';
  document.getElementById('detailTrainingDate').textContent = formatTrainingDate(training.fecha);
  document.getElementById('detailTrainingDuration').textContent = training.tiempo_texto || '—';
  document.getElementById('detailTrainingUnit').textContent = scheduleUnitLabel(training);
  document.getElementById('detailTrainingCode').textContent = training.codigo || '—';
  document.getElementById('detailTrainingClassification').textContent = training.clasificacion || 'CAPACITACIÓN';
  const state = normalizeTrainingState(training.estado);
  const stateBadge = document.getElementById('detailTrainingStatus');
  stateBadge.textContent = state;
  stateBadge.className = `training-status-badge ${scheduleStatusClass(state)}`;

  const metrics = (()=>{
    const pass = Number(exam?.nota_aprobatoria ?? 16);
    const graded = participants.filter(x=>x.nota!==null && x.nota!==undefined);
    const avg = graded.length ? graded.reduce((s,x)=>s+Number(x.nota),0)/graded.length : null;
    const approved = graded.filter(x=>Number(x.nota)>=pass).length;
    return {avg,approval:graded.length?approved/graded.length*100:null,graded:graded.length};
  })();
  document.getElementById('detailParticipantCount').textContent = String(participants.length);
  document.getElementById('detailQuestionCount').textContent = String(questions.length);
  document.getElementById('detailAverageGrade').textContent = metrics.avg===null?'—':metrics.avg.toFixed(1);
  document.getElementById('detailApprovalRate').textContent = metrics.approval===null?'—':`${Math.round(metrics.approval)}%`;
  document.getElementById('detailParticipantsTabCount').textContent = `(${participants.length})`;
  document.getElementById('detailExamTabCount').textContent = `(${questions.length})`;
  document.getElementById('detailResultsTabCount').textContent = `(${new Set(attempts.map(x=>x.participante_id)).size})`;

  const link = trainingPublicUrlFor({...item,...training});
  const linkInput = document.getElementById('detailPublicLink');
  linkInput.value = link || 'El examen no está publicado o la capacitación no está activa.';
  document.getElementById('detailCopyLinkButton').disabled = !link;
  document.getElementById('detailWhatsappButton').disabled = !link;
  document.getElementById('detailShareBox').classList.toggle('disabled', !link);

  const toggle = document.getElementById('detailToggleStateButton');
  const canManage = scheduleCanManage();
  document.getElementById('detailEditTrainingButton').classList.toggle('hidden', !canManage);
  toggle.classList.toggle('hidden', !canManage);
  toggle.textContent = state === 'ACTIVA' ? 'Finalizar capacitación' : (state === 'FINALIZADA' || state === 'CANCELADA' ? 'Reactivar capacitación' : 'Activar capacitación');
  toggle.className = state === 'ACTIVA' ? 'danger-outline-btn' : 'primary-btn';

  renderDetailParticipants(participants);
  renderDetailExam(exam, questions);
  renderDetailResults(participants, attempts, responses, exam, questions.length);
  renderDocumentPreview(training, participants);
  window.scrollTo({top:0,behavior:'smooth'});
}

async function toggleSelectedTrainingState() {
  if (!client || !selectedTrainingDetailData || !scheduleCanManage()) return;
  const training = selectedTrainingDetailData.training;
  const current = normalizeTrainingState(training.estado);
  const newState = current === 'ACTIVA' ? 'FINALIZADA' : 'ACTIVA';
  const confirmText = newState === 'FINALIZADA'
    ? '¿Finalizar esta capacitación? El enlace público dejará de estar disponible hasta que la reactives.'
    : '¿Reactivar esta capacitación? El examen se volverá a publicar si existe.';
  if (!window.confirm(confirmText)) return;
  const button = document.getElementById('detailToggleStateButton');
  const old = button.textContent;
  button.disabled = true; button.textContent = 'Guardando…';
  const trainingUpdate = await client.from('capacitaciones').update({estado:newState}).eq('id',training.id);
  if (!trainingUpdate.error && selectedTrainingDetailData.exam) {
    await client.from('examenes').update({publicado:newState==='ACTIVA', activo:true}).eq('id',selectedTrainingDetailData.exam.id);
  }
  button.disabled = false; button.textContent = old;
  if (trainingUpdate.error) {
    console.error(trainingUpdate.error);
    alert('No fue posible cambiar el estado de la capacitación.');
    return;
  }
  scheduleRecords = [];
  await loadScheduleModule(true);
  await openTrainingDetail(training.id);
}

async function editTrainingFromSchedule(id) {
  if (!client) return;
  const { data, error } = await client.from('capacitaciones').select('*').eq('id', id).single();
  if (error || !data) { console.error(error); scheduleMessage('No fue posible abrir la ficha de la capacitación.'); return; }
  if (!trainingCatalogLoaded) await loadTrainingCatalogs();
  showSection('nueva-capacitacion');
  showTrainingDataStep();
  document.getElementById('trainingId').value = data.id;
  document.getElementById('trainingCurrentStatus').value = normalizeTrainingState(data.estado || 'BORRADOR');
  document.getElementById('trainingClassification').value = data.clasificacion || 'CAPACITACIÓN';
  renderTrainingUnitOptions();
  const unitValue = data.sede_id ? `sede:${data.sede_id}` : (data.proyecto_id ? `proyecto:${data.proyecto_id}` : '');
  if (unitValue) document.getElementById('trainingUnit').value = unitValue;
  document.getElementById('trainingTopic').value = data.tema || '';
  document.getElementById('trainerName').value = data.expositor_nombre || '';
  document.getElementById('trainerDni').value = data.expositor_dni || '';
  document.getElementById('trainerPosition').value = data.expositor_cargo || '';
  document.getElementById('trainingCompany').value = data.empresa || 'EXPLO DRILLING PERU S.R.L.';
  document.getElementById('trainerArea').value = data.area || '';
  document.getElementById('trainingDate').value = data.fecha || '';
  document.getElementById('trainingDuration').value = data.tiempo_texto || '';
  document.getElementById('responsibleName').value = data.responsable_nombre || '';
  document.getElementById('responsiblePosition').value = data.responsable_cargo || '';
  document.getElementById('responsibleDni').value = data.responsable_dni || '';
  setSignature('trainer', data.firma_expositor || '');
  setSignature('responsible', data.firma_responsable || '');
  setTrainingFormMessage(`Editando ${data.codigo || 'capacitación'}. Estado actual: ${normalizeTrainingState(data.estado)}.`, 'success');
}

function exportDetailParticipantsCsv() {
  const data = selectedTrainingDetailData;
  if (!data?.participants?.length) { alert('No hay participantes para exportar.'); return; }
  const rows = [['N°','Apellidos y nombres','DNI','Puesto','Área','Nota','Estado']];
  data.participants.forEach((p,i)=>rows.push([i+1,p.apellidos_nombres||'',p.dni||'',p.puesto||'',p.area||'',p.nota==null?'':p.nota,p.firma?'COMPLETADO':'EVALUADO']));
  const csv = '\ufeff' + rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`${data.training.codigo || 'capacitacion'}_participantes.csv`; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}

function openTrainingWhatsapp(id) {
  const item = scheduleRecords.find(x=>x.id===id);
  const link = trainingPublicUrlFor(item);
  if (!link) return;
  const text = `Explo Drilling Perú - ${item.tema || 'Capacitación'}\nIngresa al siguiente enlace para registrarte y realizar la evaluación:\n${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank','noopener');
}

document.getElementById('scheduleNewTrainingButton')?.addEventListener('click', () => { showSection('nueva-capacitacion'); clearTrainingFormWithoutConfirm(); });
document.getElementById('scheduleRefreshButton')?.addEventListener('click', () => { scheduleRecords=[]; loadScheduleModule(true); });
['scheduleYearFilter','scheduleUnitFilter','scheduleClassificationFilter','scheduleStatusFilter'].forEach(id => document.getElementById(id)?.addEventListener('change', renderScheduleModule));
document.getElementById('scheduleSearch')?.addEventListener('input', renderScheduleModule);
document.getElementById('backTrainingLibraryButton')?.addEventListener('click', showTrainingLibrary);
document.getElementById('detailToggleStateButton')?.addEventListener('click', toggleSelectedTrainingState);
document.getElementById('detailEditTrainingButton')?.addEventListener('click', () => { if (selectedTrainingDetailId) editTrainingFromSchedule(selectedTrainingDetailId); });
document.getElementById('exportDetailParticipantsButton')?.addEventListener('click', exportDetailParticipantsCsv);
document.getElementById('detailDownloadPdfButton')?.addEventListener('click', downloadTrainingPdf);
document.getElementById('detailCopyLinkButton')?.addEventListener('click', () => { const value=document.getElementById('detailPublicLink')?.value || ''; if(value && value.startsWith('http')) copyText(value,'Enlace copiado.'); });
document.getElementById('detailWhatsappButton')?.addEventListener('click', () => { if(selectedTrainingDetailId) openTrainingWhatsapp(selectedTrainingDetailId); });
document.querySelectorAll('.training-detail-tab').forEach(btn => btn.addEventListener('click',()=>trainingDetailTab(btn.dataset.trainingDetailTab)));

document.getElementById('programacion')?.addEventListener('click', event => {
  const detail = event.target.closest('[data-training-detail]');
  if (detail) { openTrainingDetail(detail.dataset.trainingDetail); return; }
  const edit = event.target.closest('[data-training-edit]');
  if (edit) { editTrainingFromSchedule(edit.dataset.trainingEdit); return; }
  const copy = event.target.closest('[data-training-copy]');
  if (copy) {
    const item = scheduleRecords.find(x=>x.id===copy.dataset.trainingCopy);
    const link = trainingPublicUrlFor(item);
    if (link) copyText(link,'Enlace copiado.');
    return;
  }
  const whats = event.target.closest('[data-training-whatsapp]');
  if (whats) { openTrainingWhatsapp(whats.dataset.trainingWhatsapp); return; }
});

function clearTrainingFormWithoutConfirm() {
  trainingForm?.reset();
  document.getElementById('trainingId').value = '';
  document.getElementById('trainingCurrentStatus').value = 'BORRADOR';
  document.getElementById('trainingCompany').value = 'EXPLO DRILLING PERU S.R.L.';
  document.getElementById('trainingDate').value = todayISO();
  setSignature('trainer', '');
  setSignature('responsible', '');
  setTrainingFormMessage('');
  setTrainingMessage('');
  resetParticipantsState();
  resetExamState();
  showTrainingDataStep();
  renderTrainingUnitOptions();
  prefillResponsible();
}

// ============================== ETAPA 6 · PARTICIPANTES ==============================
let activeTrainingId = null;
let activeTrainingCode = '';
let participantsCache = [];
let pendingParticipantWorker = null;
let activeParticipantSignatureId = null;
let participantSignatureDrawing = false;
let participantSignatureHasStroke = false;

const participantsPanel = document.getElementById('participantsPanel');
const trainingPreviewPanel = document.getElementById('trainingPreviewPanel');
const participantsTableBody = document.getElementById('participantsTableBody');
const participantDniSearch = document.getElementById('participantDniSearch');
const addParticipantButton = document.getElementById('addParticipantButton');
const participantSignatureModal = document.getElementById('participantSignatureModal');
const participantSignatureCanvas = document.getElementById('participantSignatureCanvas');
const participantSignatureCtx = participantSignatureCanvas?.getContext('2d');

function setParticipantMessage(message = '', type = 'error') {
  const el = document.getElementById('participantFormMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `form-message ${message ? 'visible' : ''} ${type}`;
}

function setTrainingSteps(mode = 'data') {
  const steps = [...document.querySelectorAll('.training-step')];
  steps.forEach((step, index) => {
    step.classList.remove('active', 'completed');
    if (mode === 'exam') {
      if (index === 0) step.classList.add('completed');
      if (index === 1) step.classList.add('active');
    } else if (mode === 'preview') {
      if (index <= 1) step.classList.add('completed');
      if (index === 2) step.classList.add('active');
    } else if (index === 0) {
      step.classList.add('active');
    }
  });
  const pill = document.getElementById('trainingStagePill');
  if (!pill) return;
  pill.textContent = mode === 'exam' ? 'Etapa 2 de 3' : mode === 'preview' ? 'Etapa 3 de 3' : 'Etapa 1 de 3';
}

function showTrainingDataStep() {
  trainingForm?.classList.remove('hidden');
  document.getElementById('examPanel')?.classList.add('hidden');
  participantsPanel?.classList.add('hidden');
  trainingPreviewPanel?.classList.add('hidden');
  setTrainingSteps('data');
}

function participantUnitLabel(payload = {}) {
  const selected = trainingUnit?.selectedOptions?.[0]?.textContent?.trim();
  if (selected && !/^Seleccione/.test(selected)) return selected;
  if (payload.sede_id) {
    const item = trainingSitesCache.find(x => x.id === payload.sede_id);
    return item ? `Sede · ${item.nombre}` : 'Sede';
  }
  if (payload.proyecto_id) {
    const item = trainingProjectsCache.find(x => x.id === payload.proyecto_id);
    return item ? `Proyecto · ${item.nombre}` : 'Proyecto';
  }
  return '—';
}

async function openParticipantsStep(trainingId, code = '', payload = null) {
  activeTrainingId = trainingId;
  activeTrainingCode = code || activeTrainingCode;
  trainingForm?.classList.add('hidden');
  document.getElementById('examPanel')?.classList.add('hidden');
  participantsPanel?.classList.remove('hidden');
  setTrainingSteps('participants');

  const currentPayload = payload || activeTrainingPayload || collectTrainingPayload();
  activeTrainingPayload = currentPayload;
  document.getElementById('participantTrainingCode').textContent = activeTrainingCode || 'Capacitación';
  document.getElementById('participantTrainingTopic').textContent = currentPayload.tema || '—';
  document.getElementById('participantTrainingDate').textContent = currentPayload.fecha || '—';
  document.getElementById('participantTrainingUnit').textContent = participantUnitLabel(currentPayload);
  clearParticipantLookup();
  await loadParticipants();
  document.querySelector('.training-steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetParticipantsState() {
  activeTrainingId = null;
  activeTrainingCode = '';
  participantsCache = [];
  pendingParticipantWorker = null;
  activeParticipantSignatureId = null;
  if (participantsTableBody) participantsTableBody.innerHTML = '<tr><td colspan="8" class="table-empty">Aún no hay participantes registrados.</td></tr>';
  updateParticipantCounters();
  clearParticipantLookup();
}

function clearParticipantLookup() {
  pendingParticipantWorker = null;
  if (participantDniSearch) participantDniSearch.value = '';
  const preview = document.getElementById('participantWorkerPreview');
  preview?.classList.add('empty');
  document.getElementById('participantWorkerName').textContent = 'Sin trabajador seleccionado';
  document.getElementById('participantWorkerDetails').textContent = 'Ingresa un DNI para consultar la base maestra.';
  if (addParticipantButton) addParticipantButton.disabled = true;
  setParticipantMessage('');
}

function updateParticipantCounters() {
  const total = participantsCache.length;
  const signed = participantsCache.filter(x => !!x.firma).length;
  const totalEl = document.getElementById('participantCount');
  const signedEl = document.getElementById('participantSignedCount');
  if (totalEl) totalEl.textContent = String(total);
  if (signedEl) signedEl.textContent = String(signed);
}

function renderParticipants() {
  if (!participantsTableBody) return;
  const term = (document.getElementById('participantListSearch')?.value || '').trim().toLowerCase();
  const filtered = participantsCache.filter(item => {
    const haystack = `${item.dni || ''} ${item.apellidos_nombres || ''} ${item.puesto || ''} ${item.area || ''}`.toLowerCase();
    return !term || haystack.includes(term);
  });

  updateParticipantCounters();
  if (!filtered.length) {
    participantsTableBody.innerHTML = `<tr><td colspan="8" class="table-empty">${participantsCache.length ? 'No hay coincidencias.' : 'Aún no hay participantes registrados.'}</td></tr>`;
    return;
  }

  participantsTableBody.innerHTML = filtered.map((item, index) => {
    const signature = item.firma
      ? `<div class="participant-signature-cell"><img src="${item.firma}" alt="Firma" class="participant-signature-thumb"><button class="table-link" type="button" data-sign-participant="${item.id}">Actualizar</button></div>`
      : `<button class="table-action" type="button" data-sign-participant="${item.id}">Firmar</button>`;
    const grade = item.nota === null || item.nota === undefined
      ? (activeExamConfig?.requiere_evaluacion === false
          ? '<span class="grade-pill pending">N.A.</span>'
          : '<span class="grade-pill pending">Pendiente</span>')
      : `<span class="grade-pill">${Number(item.nota).toFixed(2).replace(/\.00$/, '')}</span>`;
    return `<tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(item.apellidos_nombres || '')}</strong></td>
      <td>${escapeHtml(item.dni || '')}</td>
      <td>${escapeHtml(item.puesto || '')}</td>
      <td>${escapeHtml(item.area || '')}</td>
      <td>${signature}</td>
      <td>${grade}</td>
      <td><button class="table-action danger" type="button" data-remove-participant="${item.id}">Retirar</button></td>
    </tr>`;
  }).join('');
}

async function loadParticipants() {
  if (!client || !activeTrainingId) return;
  if (participantsTableBody) participantsTableBody.innerHTML = '<tr><td colspan="8" class="table-empty">Cargando participantes…</td></tr>';
  const { data, error } = await client
    .from('capacitacion_participantes')
    .select('id,capacitacion_id,trabajador_id,dni,apellidos_nombres,puesto,area,firma,fecha_firma,nota,created_at')
    .eq('capacitacion_id', activeTrainingId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error(error);
    const missing = /capacitacion_participantes/i.test(error.message || '') && /schema cache|does not exist|relation/i.test(error.message || '');
    setParticipantMessage(missing ? 'Primero ejecuta ETAPA6_SUPABASE.sql en Supabase.' : 'No fue posible cargar los participantes.');
    participantsCache = [];
    renderParticipants();
    return;
  }
  participantsCache = data || [];
  renderParticipants();
}

async function lookupParticipantWorker() {
  if (!client) return;
  const dni = (participantDniSearch?.value || '').replace(/\D/g, '').slice(0, 8);
  if (participantDniSearch) participantDniSearch.value = dni;
  pendingParticipantWorker = null;
  if (addParticipantButton) addParticipantButton.disabled = true;
  if (!/^\d{8}$/.test(dni)) {
    setParticipantMessage('Ingresa un DNI de 8 dígitos.');
    return;
  }

  setParticipantMessage('');
  const { data, error } = await client
    .from('trabajadores')
    .select('id,dni,nombres,apellidos,cargo,area,sede_id,activo')
    .eq('dni', dni)
    .maybeSingle();

  if (error) { console.error(error); setParticipantMessage('No fue posible consultar el trabajador.'); return; }
  if (!data) {
    document.getElementById('participantWorkerPreview')?.classList.add('empty');
    document.getElementById('participantWorkerName').textContent = 'Trabajador no encontrado';
    document.getElementById('participantWorkerDetails').textContent = 'Regístralo primero en el módulo Trabajadores.';
    setParticipantMessage('El DNI no se encuentra en la base maestra.');
    return;
  }

  const duplicate = participantsCache.some(x => x.trabajador_id === data.id);
  const fullName = `${data.apellidos || ''} ${data.nombres || ''}`.trim();
  const preview = document.getElementById('participantWorkerPreview');
  preview?.classList.remove('empty');
  document.getElementById('participantWorkerName').textContent = fullName || data.dni;
  document.getElementById('participantWorkerDetails').textContent = `${data.cargo || 'Sin puesto'} · ${data.area || 'Sin área'}${data.activo ? '' : ' · INACTIVO'}`;

  if (!data.activo) { setParticipantMessage('El trabajador está inactivo y no puede agregarse a una capacitación.'); return; }
  if (duplicate) { setParticipantMessage('El trabajador ya está registrado en esta capacitación.'); return; }

  pendingParticipantWorker = data;
  if (addParticipantButton) addParticipantButton.disabled = false;
  setParticipantMessage('Trabajador encontrado. Puedes agregarlo a la lista.', 'success');
}

async function addParticipant() {
  if (!client || !activeTrainingId || !pendingParticipantWorker) return;
  const w = pendingParticipantWorker;
  if (addParticipantButton) { addParticipantButton.disabled = true; addParticipantButton.textContent = 'Agregando…'; }
  const payload = {
    capacitacion_id: activeTrainingId,
    trabajador_id: w.id,
    dni: w.dni,
    apellidos_nombres: `${w.apellidos || ''} ${w.nombres || ''}`.trim(),
    puesto: w.cargo || 'SIN PUESTO',
    area: w.area || 'SIN ÁREA'
  };
  const { error } = await client.from('capacitacion_participantes').insert(payload);
  if (addParticipantButton) addParticipantButton.textContent = 'Agregar participante';
  if (error) {
    console.error(error);
    if (addParticipantButton) addParticipantButton.disabled = false;
    setParticipantMessage(error.code === '23505' ? 'El trabajador ya está registrado en esta capacitación.' : 'No fue posible agregar al participante.');
    return;
  }
  clearParticipantLookup();
  setTrainingMessage('Participante agregado correctamente.', 'success');
  await loadParticipants();
}

async function removeParticipant(id) {
  const item = participantsCache.find(x => x.id === id);
  if (!item || !client) return;
  if (!window.confirm(`¿Retirar a ${item.apellidos_nombres} de esta capacitación?`)) return;
  const { error } = await client.from('capacitacion_participantes').delete().eq('id', id);
  if (error) { console.error(error); setParticipantMessage('No fue posible retirar al participante.'); return; }
  await loadParticipants();
}

function resetParticipantSignatureCanvas() {
  if (!participantSignatureCanvas || !participantSignatureCtx) return;
  participantSignatureCtx.clearRect(0, 0, participantSignatureCanvas.width, participantSignatureCanvas.height);
  participantSignatureCtx.fillStyle = '#ffffff';
  participantSignatureCtx.fillRect(0, 0, participantSignatureCanvas.width, participantSignatureCanvas.height);
  participantSignatureCtx.strokeStyle = '#17263c';
  participantSignatureCtx.lineWidth = 4;
  participantSignatureCtx.lineCap = 'round';
  participantSignatureCtx.lineJoin = 'round';
  participantSignatureHasStroke = false;
}

function participantCanvasPoint(event) {
  const rect = participantSignatureCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (participantSignatureCanvas.width / rect.width),
    y: (event.clientY - rect.top) * (participantSignatureCanvas.height / rect.height)
  };
}

function startParticipantSignature(event) {
  if (!participantSignatureCtx || !participantSignatureCanvas) return;
  event.preventDefault();
  participantSignatureDrawing = true;
  participantSignatureHasStroke = true;
  const p = participantCanvasPoint(event);
  participantSignatureCtx.beginPath();
  participantSignatureCtx.moveTo(p.x, p.y);
}

function drawParticipantSignature(event) {
  if (!participantSignatureDrawing || !participantSignatureCtx) return;
  event.preventDefault();
  const p = participantCanvasPoint(event);
  participantSignatureCtx.lineTo(p.x, p.y);
  participantSignatureCtx.stroke();
}

function stopParticipantSignature(event) {
  if (!participantSignatureDrawing) return;
  event?.preventDefault?.();
  participantSignatureDrawing = false;
  participantSignatureCtx?.closePath();
}

function openParticipantSignature(id) {
  const item = participantsCache.find(x => x.id === id);
  if (!item) return;
  activeParticipantSignatureId = id;
  document.getElementById('participantSignatureName').textContent = `${item.apellidos_nombres} · DNI ${item.dni}`;
  resetParticipantSignatureCanvas();
  if (item.firma) {
    const img = new Image();
    img.onload = () => {
      resetParticipantSignatureCanvas();
      participantSignatureCtx.drawImage(img, 0, 0, participantSignatureCanvas.width, participantSignatureCanvas.height);
      participantSignatureHasStroke = true;
    };
    img.src = item.firma;
  }
  participantSignatureModal?.classList.remove('hidden');
}

function closeParticipantSignature() {
  participantSignatureModal?.classList.add('hidden');
  activeParticipantSignatureId = null;
  participantSignatureDrawing = false;
}

async function saveParticipantSignature() {
  if (!client || !activeParticipantSignatureId || !participantSignatureCanvas || !participantSignatureHasStroke) {
    alert('Registra una firma antes de guardar.');
    return;
  }
  const signature = participantSignatureCanvas.toDataURL('image/png');
  const button = document.getElementById('saveParticipantSignatureButton');
  if (button) { button.disabled = true; button.textContent = 'Guardando…'; }
  const { error } = await client
    .from('capacitacion_participantes')
    .update({ firma: signature, fecha_firma: new Date().toISOString() })
    .eq('id', activeParticipantSignatureId);
  if (button) { button.disabled = false; button.textContent = 'Guardar firma'; }
  if (error) { console.error(error); alert('No fue posible guardar la firma.'); return; }
  closeParticipantSignature();
  await loadParticipants();
}

participantDniSearch?.addEventListener('input', e => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
  pendingParticipantWorker = null;
  if (addParticipantButton) addParticipantButton.disabled = true;
});
participantDniSearch?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); lookupParticipantWorker(); } });
document.getElementById('participantSearchButton')?.addEventListener('click', lookupParticipantWorker);
addParticipantButton?.addEventListener('click', addParticipant);
document.getElementById('refreshParticipantsButton')?.addEventListener('click', loadParticipants);
document.getElementById('participantListSearch')?.addEventListener('input', renderParticipants);
document.getElementById('backToTrainingData')?.addEventListener('click', () => openExamStep(activeTrainingId, activeTrainingCode, activeTrainingPayload));
document.getElementById('finishParticipantsButton')?.addEventListener('click', () => {
  const examText = activeExamConfig?.requiere_evaluacion ? ' El examen quedará disponible mediante el enlace configurado.' : ' Esta capacitación no requiere evaluación.';
  setTrainingMessage(`${participantsCache.length} participante(s) guardado(s).${examText}`, 'success');
  document.querySelector('.training-steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

participantsTableBody?.addEventListener('click', e => {
  const sign = e.target.closest('[data-sign-participant]');
  const remove = e.target.closest('[data-remove-participant]');
  if (sign) openParticipantSignature(sign.dataset.signParticipant);
  if (remove) removeParticipant(remove.dataset.removeParticipant);
});

participantSignatureCanvas?.addEventListener('pointerdown', startParticipantSignature);
participantSignatureCanvas?.addEventListener('pointermove', drawParticipantSignature);
participantSignatureCanvas?.addEventListener('pointerup', stopParticipantSignature);
participantSignatureCanvas?.addEventListener('pointerleave', stopParticipantSignature);
participantSignatureCanvas?.addEventListener('pointercancel', stopParticipantSignature);
document.getElementById('clearParticipantSignatureCanvas')?.addEventListener('click', resetParticipantSignatureCanvas);
document.getElementById('closeParticipantSignatureModal')?.addEventListener('click', closeParticipantSignature);
document.getElementById('cancelParticipantSignatureModal')?.addEventListener('click', closeParticipantSignature);
document.getElementById('saveParticipantSignatureButton')?.addEventListener('click', saveParticipantSignature);
participantSignatureModal?.addEventListener('click', e => { if (e.target === participantSignatureModal) closeParticipantSignature(); });


// ============================== ETAPA 7 · EXAMEN ==============================
let activeTrainingPayload = null;
let activeExamId = null;
let activeExamConfig = null;
let examQuestionsCache = [];
let examStructureLocked = false;
let publicExamCode = '';
let publicExamData = null;
let publicSignatureDrawing = false;
let publicSignatureHasStroke = false;

const examPanel = document.getElementById('examPanel');
const examQuestionList = document.getElementById('examQuestionList');
const examRequired = document.getElementById('examRequired');
const examSettings = document.getElementById('examSettings');
const examQuestionsCard = document.getElementById('examQuestionsCard');

function setExamMessage(message = '', type = 'error') {
  const el = document.getElementById('examFormMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `form-message ${message ? 'visible' : ''} ${type}`;
}

function examPublicUrl() {
  if (!activeTrainingCode) return '';
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('exam', activeTrainingCode);
  return url.toString();
}

function updateExamLink() {
  const link = document.getElementById('examPublicLink');
  const copy = document.getElementById('copyExamLinkButton');
  const copyParticipants = document.getElementById('copyExamLinkParticipantsButton');
  const hasExam = !!activeExamId && !!activeExamConfig?.requiere_evaluacion;
  const url = hasExam ? examPublicUrl() : '';
  if (link) link.textContent = url || 'Guarda el examen para generar el enlace.';
  if (copy) copy.disabled = !url;
  copyParticipants?.classList.toggle('hidden', !url);
}

function applyExamRequiredVisibility() {
  const required = !!examRequired?.checked;
  examSettings?.classList.toggle('hidden', !required);
  examQuestionsCard?.classList.toggle('hidden', !required);
  if (!required) {
    const published = document.getElementById('examPublished');
    if (published) published.checked = false;
  }
}

function defaultExamQuestion() {
  return {
    id: null,
    enunciado: '',
    opciones: [
      { id: null, texto: '', es_correcta: true },
      { id: null, texto: '', es_correcta: false },
      { id: null, texto: '', es_correcta: false },
      { id: null, texto: '', es_correcta: false }
    ]
  };
}

function normalizeQuestionOptions(options = []) {
  const sorted = [...options].sort((a,b) => Number(a.orden || 0) - Number(b.orden || 0));
  const result = sorted.slice(0,4).map(x => ({ id: x.id || null, texto: x.texto || '', es_correcta: !!x.es_correcta }));
  while (result.length < 4) result.push({ id: null, texto: '', es_correcta: false });
  if (!result.some(x => x.es_correcta)) result[0].es_correcta = true;
  return result;
}

function renderExamQuestions() {
  if (!examQuestionList) return;
  if (!examQuestionsCache.length) {
    examQuestionList.innerHTML = '<div class="exam-empty">Aún no hay preguntas. Pulsa <strong>+ Agregar pregunta</strong>.</div>';
    return;
  }

  examQuestionList.innerHTML = examQuestionsCache.map((q, index) => {
    const options = normalizeQuestionOptions(q.opciones);
    return `<article class="exam-question-card" data-question-index="${index}">
      <div class="exam-question-top">
        <div class="exam-question-number"><b>${index + 1}</b><span>Pregunta ${index + 1}</span></div>
        <button class="exam-question-remove" type="button" data-remove-exam-question="${index}" ${examStructureLocked ? 'disabled' : ''}>Eliminar</button>
      </div>
      <textarea class="exam-question-text" maxlength="700" placeholder="Escribe la pregunta…" ${examStructureLocked ? 'disabled' : ''}>${escapeHtml(q.enunciado || '')}</textarea>
      <div class="exam-options">
        ${options.map((o, oi) => `<label class="exam-option-row">
          <input type="radio" name="exam-correct-${index}" value="${oi}" ${o.es_correcta ? 'checked' : ''} ${examStructureLocked ? 'disabled' : ''} aria-label="Marcar alternativa correcta" />
          <input class="exam-option-text" type="text" maxlength="350" value="${escapeHtml(o.texto || '')}" placeholder="Alternativa ${String.fromCharCode(65 + oi)}" ${examStructureLocked ? 'disabled' : ''} />
        </label>`).join('')}
      </div>
    </article>`;
  }).join('');

  const addButton = document.getElementById('addExamQuestionButton');
  if (addButton) addButton.disabled = examStructureLocked;
}

function syncQuestionsFromDom() {
  if (!examQuestionList || !examQuestionsCache.length || examStructureLocked) return;
  const cards = [...examQuestionList.querySelectorAll('.exam-question-card')];
  examQuestionsCache = cards.map((card, index) => {
    const correct = Number(card.querySelector(`input[name="exam-correct-${index}"]:checked`)?.value ?? 0);
    const optionInputs = [...card.querySelectorAll('.exam-option-text')];
    return {
      id: examQuestionsCache[index]?.id || null,
      enunciado: card.querySelector('.exam-question-text')?.value.trim() || '',
      opciones: optionInputs.map((input, oi) => ({
        id: examQuestionsCache[index]?.opciones?.[oi]?.id || null,
        texto: input.value.trim(),
        es_correcta: oi === correct
      }))
    };
  });
}

function collectExamConfiguration() {
  syncQuestionsFromDom();
  return {
    requiere_evaluacion: !!examRequired?.checked,
    titulo: document.getElementById('examTitle')?.value.trim() || '',
    nota_aprobatoria: Number(document.getElementById('examPassGrade')?.value || 16),
    max_intentos: Number(document.getElementById('examMaxAttempts')?.value || 2),
    mostrar_resultado: !!document.getElementById('examShowResult')?.checked,
    publicado: !!document.getElementById('examPublished')?.checked,
    preguntas: examQuestionsCache
  };
}

function validateExamConfiguration(data) {
  if (!data.requiere_evaluacion) return '';
  if (!data.titulo) return 'Ingresa el título del examen.';
  if (!Number.isFinite(data.nota_aprobatoria) || data.nota_aprobatoria < 0 || data.nota_aprobatoria > 20) return 'La nota aprobatoria debe estar entre 0 y 20.';
  if (!Number.isInteger(data.max_intentos) || data.max_intentos < 1 || data.max_intentos > 10) return 'Los intentos deben estar entre 1 y 10.';
  if (!data.preguntas.length) return 'Agrega al menos una pregunta.';

  for (let i = 0; i < data.preguntas.length; i++) {
    const q = data.preguntas[i];
    if (!q.enunciado) return `Completa el enunciado de la pregunta ${i + 1}.`;
    const filled = q.opciones.filter(x => x.texto);
    if (filled.length < 2) return `La pregunta ${i + 1} debe tener al menos dos alternativas.`;
    const correct = q.opciones.find(x => x.es_correcta);
    if (!correct?.texto) return `Marca como correcta una alternativa con texto en la pregunta ${i + 1}.`;
  }
  return '';
}

async function loadExamConfiguration() {
  if (!client || !activeTrainingId) return;
  setExamMessage('');
  examStructureLocked = false;
  const { data: exam, error } = await client
    .from('examenes')
    .select('id,capacitacion_id,titulo,requiere_evaluacion,nota_aprobatoria,max_intentos,mostrar_resultado,publicado,activo')
    .eq('capacitacion_id', activeTrainingId)
    .maybeSingle();

  if (error) {
    console.error(error);
    const missing = /examenes/i.test(error.message || '') && /schema cache|does not exist|relation/i.test(error.message || '');
    setExamMessage(missing ? 'Primero ejecuta ETAPA7_SUPABASE.sql en Supabase.' : 'No fue posible cargar la configuración del examen.');
    activeExamId = null;
    activeExamConfig = null;
    examQuestionsCache = [defaultExamQuestion()];
    renderExamQuestions();
    return;
  }

  if (!exam) {
    activeExamId = null;
    activeExamConfig = null;
    examQuestionsCache = [defaultExamQuestion()];
    examRequired.disabled = false;
    examRequired.checked = true;
    document.getElementById('examTitle').value = activeTrainingPayload?.tema ? `Evaluación - ${activeTrainingPayload.tema}` : 'Evaluación de capacitación';
    document.getElementById('examPassGrade').value = '16';
    document.getElementById('examMaxAttempts').value = '2';
    document.getElementById('examShowResult').checked = true;
    document.getElementById('examPublished').checked = false;
    applyExamRequiredVisibility();
    renderExamQuestions();
    updateExamLink();
    return;
  }

  activeExamId = exam.id;
  activeExamConfig = exam;
  examRequired.checked = !!exam.requiere_evaluacion;
  document.getElementById('examTitle').value = exam.titulo || '';
  document.getElementById('examPassGrade').value = String(exam.nota_aprobatoria ?? 16);
  document.getElementById('examMaxAttempts').value = String(exam.max_intentos ?? 2);
  document.getElementById('examShowResult').checked = !!exam.mostrar_resultado;
  document.getElementById('examPublished').checked = !!exam.publicado;

  if (exam.requiere_evaluacion) {
    const [{ data: questions, error: qError }, attempts] = await Promise.all([
      client.from('examen_preguntas')
        .select('id,orden,enunciado,activo,examen_opciones(id,orden,texto,es_correcta)')
        .eq('examen_id', exam.id)
        .eq('activo', true)
        .order('orden', { ascending: true }),
      client.from('examen_intentos').select('*', { count: 'exact', head: true }).eq('examen_id', exam.id)
    ]);
    if (qError) console.error(qError);
    examStructureLocked = (attempts.count || 0) > 0;
    examRequired.disabled = examStructureLocked;
    examQuestionsCache = (questions || []).map(q => ({
      id: q.id,
      enunciado: q.enunciado,
      opciones: normalizeQuestionOptions(q.examen_opciones || [])
    }));
    if (!examQuestionsCache.length && !examStructureLocked) examQuestionsCache = [defaultExamQuestion()];
    if (examStructureLocked) setExamMessage('El examen ya tiene intentos registrados. Las preguntas quedan bloqueadas para conservar la trazabilidad; aún puedes cambiar publicación, intentos y nota aprobatoria.', 'success');
  } else {
    examQuestionsCache = [];
  }

  applyExamRequiredVisibility();
  renderExamQuestions();
  updateExamLink();
}

async function openExamStep(trainingId, code = '', payload = null) {
  if (!trainingId) return;
  activeTrainingId = trainingId;
  activeTrainingCode = code || activeTrainingCode;
  activeTrainingPayload = payload || activeTrainingPayload || collectTrainingPayload();
  trainingForm?.classList.add('hidden');
  participantsPanel?.classList.add('hidden');
  trainingPreviewPanel?.classList.add('hidden');
  examPanel?.classList.remove('hidden');
  setTrainingSteps('exam');
  document.getElementById('examTrainingCode').textContent = activeTrainingCode || 'Capacitación';
  document.getElementById('examTrainingTopic').textContent = activeTrainingPayload?.tema || '—';
  await loadExamConfiguration();
  document.querySelector('.training-steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetExamState() {
  activeTrainingPayload = null;
  activeExamId = null;
  activeExamConfig = null;
  examQuestionsCache = [];
  examStructureLocked = false;
  examPanel?.classList.add('hidden');
  trainingPreviewPanel?.classList.add('hidden');
  if (examRequired) { examRequired.disabled = false; examRequired.checked = true; }
  updateExamLink();
}

async function saveExamConfiguration({ continueNext = false } = {}) {
  if (!client || !activeTrainingId || !currentProfile) return false;
  const cfgExam = collectExamConfiguration();
  const validation = validateExamConfiguration(cfgExam);
  if (validation) { setExamMessage(validation); return false; }

  const button = continueNext ? document.getElementById('continueToPreviewButton') : document.getElementById('saveExamButton');
  const oldLabel = button?.textContent;
  if (button) { button.disabled = true; button.textContent = 'Guardando…'; }
  setExamMessage('');

  const header = {
    capacitacion_id: activeTrainingId,
    titulo: cfgExam.requiere_evaluacion ? cfgExam.titulo : `Sin evaluación - ${activeTrainingPayload?.tema || activeTrainingCode}`,
    requiere_evaluacion: cfgExam.requiere_evaluacion,
    nota_aprobatoria: cfgExam.requiere_evaluacion ? cfgExam.nota_aprobatoria : 16,
    max_intentos: cfgExam.requiere_evaluacion ? cfgExam.max_intentos : 1,
    mostrar_resultado: cfgExam.requiere_evaluacion ? cfgExam.mostrar_resultado : false,
    publicado: false,
    activo: true,
    created_by: currentProfile.id
  };

  let result;
  if (activeExamId) {
    const { created_by, capacitacion_id, ...updateHeader } = header;
    result = await client.from('examenes').update(updateHeader).eq('id', activeExamId).select('id').single();
  } else {
    result = await client.from('examenes').insert(header).select('id').single();
  }

  if (result.error) {
    console.error(result.error);
    if (button) { button.disabled = false; button.textContent = oldLabel; }
    const missing = /examenes/i.test(result.error.message || '') && /schema cache|does not exist|relation/i.test(result.error.message || '');
    setExamMessage(missing ? 'Primero ejecuta ETAPA7_SUPABASE.sql en Supabase.' : 'No fue posible guardar la configuración del examen.');
    return false;
  }

  activeExamId = result.data.id;

  if (!cfgExam.requiere_evaluacion) {
    if (!examStructureLocked) await client.from('examen_preguntas').delete().eq('examen_id', activeExamId);
  } else if (!examStructureLocked) {
    const del = await client.from('examen_preguntas').delete().eq('examen_id', activeExamId);
    if (del.error) {
      console.error(del.error);
      if (button) { button.disabled = false; button.textContent = oldLabel; }
      setExamMessage('No fue posible actualizar las preguntas del examen.');
      return false;
    }

    for (let qi = 0; qi < cfgExam.preguntas.length; qi++) {
      const q = cfgExam.preguntas[qi];
      const { data: savedQ, error: qError } = await client.from('examen_preguntas').insert({
        examen_id: activeExamId,
        orden: qi + 1,
        enunciado: q.enunciado,
        activo: true
      }).select('id').single();
      if (qError) {
        console.error(qError);
        if (button) { button.disabled = false; button.textContent = oldLabel; }
        setExamMessage(`No fue posible guardar la pregunta ${qi + 1}.`);
        return false;
      }

      const nonEmpty = q.opciones
        .map((o, oi) => ({ ...o, originalIndex: oi }))
        .filter(o => o.texto);
      const optionRows = nonEmpty.map((o, oi) => ({
        pregunta_id: savedQ.id,
        orden: oi + 1,
        texto: o.texto,
        es_correcta: !!o.es_correcta
      }));
      const { error: oError } = await client.from('examen_opciones').insert(optionRows);
      if (oError) {
        console.error(oError);
        if (button) { button.disabled = false; button.textContent = oldLabel; }
        setExamMessage(`No fue posible guardar las alternativas de la pregunta ${qi + 1}.`);
        return false;
      }
    }
  }

  let published = false;
  if (cfgExam.requiere_evaluacion && cfgExam.publicado) {
    const { data: validationResult, error: validationError } = await client.rpc('validar_examen_publicable', { p_examen_id: activeExamId });
    if (validationError || !validationResult?.ok) {
      console.error(validationError);
      document.getElementById('examPublished').checked = false;
      setExamMessage(validationResult?.error || 'El examen se guardó, pero no pudo publicarse. Revisa las preguntas.');
    } else {
      const { error: publishError } = await client.from('examenes').update({ publicado: true }).eq('id', activeExamId);
      if (publishError) console.error(publishError); else published = true;
    }
  }

  activeExamConfig = {
    id: activeExamId,
    ...header,
    publicado: published,
    requiere_evaluacion: cfgExam.requiere_evaluacion
  };
  updateExamLink();
  if (button) { button.disabled = false; button.textContent = oldLabel; }

  if (!cfgExam.requiere_evaluacion) setExamMessage('Configuración guardada: esta capacitación no tendrá evaluación.', 'success');
  else if (published) setExamMessage('Examen guardado y habilitado para los participantes.', 'success');
  else if (!cfgExam.publicado) setExamMessage('Examen guardado como no publicado. Puedes habilitarlo cuando estés listo.', 'success');

  if (continueNext) await openTrainingPreviewStep();
  return true;
}


async function loadPreviewParticipants() {
  const body = document.getElementById('previewParticipantsTableBody');
  if (!body || !client || !activeTrainingId) return;
  body.innerHTML = '<tr><td colspan="8" class="table-empty">Cargando participantes…</td></tr>';

  const { data, error } = await client
    .from('capacitacion_participantes')
    .select('id,dni,apellidos_nombres,puesto,area,firma,fecha_firma,nota,created_at')
    .eq('capacitacion_id', activeTrainingId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    body.innerHTML = '<tr><td colspan="8" class="table-empty">No fue posible cargar el registro.</td></tr>';
    return;
  }

  const rows = data || [];
  const count = document.getElementById('previewParticipantCount');
  if (count) count.textContent = String(rows.length);

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8" class="table-empty">Aún no hay participantes evaluados.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((item, index) => {
    const completed = !!item.firma;
    const signature = completed
      ? `<img class="preview-signature" src="${item.firma}" alt="Firma de ${escapeHtml(item.apellidos_nombres || 'participante')}">`
      : '<span class="grade-pill pending">Pendiente</span>';
    return `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(item.apellidos_nombres || '—')}</strong></td>
        <td>${escapeHtml(item.dni || '—')}</td>
        <td>${escapeHtml(item.puesto || '—')}</td>
        <td>${escapeHtml(item.area || '—')}</td>
        <td>${signature}</td>
        <td>${item.nota === null || item.nota === undefined
          ? '<span class="grade-pill pending">Pendiente</span>'
          : `<span class="grade-pill">${Number(item.nota).toFixed(2).replace(/\.00$/, '')}</span>`}</td>
        <td><span class="status-pill ${completed ? 'completed' : 'evaluated'}">${completed ? 'COMPLETADO' : 'EVALUADO'}</span></td>
      </tr>
    `;
  }).join('');
}


const PDF_EMPLOYER = {
  razonSocial: 'EXPLO DRILLING PERU S.R.L.',
  ruc: '20527775851',
  domicilio: 'Calle Las Acacias I-7, Urb. La Capitana - Huachipa - Lurigancho - Lima',
  actividad: 'Perforación Diamantina',
  codigoFormato: 'EDP-SIG-SSOMAC-RE-EA-121',
  numeroFormato: '2',
  version: '7',
  fechaActualizacion: 'Jul-25'
};

function formatDatePE(value) {
  if (!value) return '—';
  const parts = String(value).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return value;
}

function formatLongDatePE(value) {
  if (!value) return '—';
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre'];
  const parts = String(value).split('-');
  if (parts.length === 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) return `${d} de ${months[m-1] || parts[1]} de ${y}`;
  }
  return value;
}

async function imageToDataUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', .95));
      } catch (err) { reject(err); }
    };
    img.onerror = reject;
    img.src = src;
  });
}

async function getTrainingPdfData() {
  if (!client || !activeTrainingId) throw new Error('No hay una capacitación seleccionada.');

  const { data: training, error: trainingError } = await client
    .from('capacitaciones')
    .select('*')
    .eq('id', activeTrainingId)
    .single();
  if (trainingError || !training) throw trainingError || new Error('Capacitación no encontrada.');

  let unidad = '—';
  let trabajadoresCentro = 0;
  if (training.sede_id) {
    const [{ data: sede }, { count }] = await Promise.all([
      client.from('sedes').select('nombre').eq('id', training.sede_id).single(),
      client.from('trabajadores').select('id', { count: 'exact', head: true }).eq('sede_id', training.sede_id).eq('activo', true)
    ]);
    unidad = sede?.nombre ? `Sede - ${sede.nombre}` : 'Sede';
    trabajadoresCentro = count || 0;
  } else if (training.proyecto_id) {
    const [{ data: proyecto }, { count }] = await Promise.all([
      client.from('proyectos').select('nombre,cliente').eq('id', training.proyecto_id).single(),
      client.from('trabajadores').select('id', { count: 'exact', head: true }).eq('proyecto_id', training.proyecto_id).eq('activo', true)
    ]);
    unidad = proyecto?.nombre ? `Proyecto - ${proyecto.nombre}` : 'Proyecto';
    trabajadoresCentro = count || 0;
  }

  const { data: participants, error: participantsError } = await client
    .from('capacitacion_participantes')
    .select('dni,apellidos_nombres,puesto,area,firma,fecha_firma,nota,created_at')
    .eq('capacitacion_id', activeTrainingId)
    .order('created_at', { ascending: true });
  if (participantsError) throw participantsError;

  return {
    training,
    unidad,
    trabajadoresCentro,
    participants: (participants || []).filter(x => !!x.firma)
  };
}

async function downloadTrainingPdf() {
  const button = document.getElementById('downloadTrainingPdfButton');
  const original = button?.textContent || 'Descargar registro PDF';
  if (button) { button.disabled = true; button.textContent = 'Generando PDF…'; }
  try {
    if (!window.jspdf?.jsPDF) throw new Error('No se cargó el generador PDF. Actualiza la página e inténtalo nuevamente.');
    const data = await getTrainingPdfData();
    if (!data.participants.length) {
      alert('Todavía no hay participantes con estado COMPLETADO. El PDF final incluirá únicamente a quienes hayan rendido la evaluación y registrado su firma.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const t = data.training;
    const BLACK = [20, 20, 20];
    const DARK = [87, 87, 87];
    const LIGHT = [230, 230, 230];
    const RED = [192, 0, 0];
    const WHITE = [255, 255, 255];
    const left = 5;
    const right = 205;
    const totalWidth = 200;
    const pageHeight = 297;
    let logoData = null;
    try { logoData = await imageToDataUrl('assets/logo-explo.jpg'); } catch (e) { console.warn(e); }

    const setStroke = (width = 0.2) => { doc.setDrawColor(...BLACK); doc.setLineWidth(width); };
    const rect = (x, y, w, h, fill = null, lineWidth = 0.2) => {
      setStroke(lineWidth);
      if (fill) { doc.setFillColor(...fill); doc.rect(x, y, w, h, 'FD'); }
      else doc.rect(x, y, w, h, 'S');
    };
    const line = (x1, y1, x2, y2, width = 0.2) => { setStroke(width); doc.line(x1, y1, x2, y2); };
    const text = (value, x, y, size = 5, bold = false, align = 'left', color = BLACK) => {
      doc.setTextColor(...color);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.text(String(value ?? ''), x, y, { align });
    };
    const fitText = (value, x, y, maxWidth, size = 5, bold = false, align = 'left') => {
      let s = String(value ?? '');
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      if (doc.getTextWidth(s) <= maxWidth) return text(s, x, y, size, bold, align);
      while (s.length > 3 && doc.getTextWidth(`${s}…`) > maxWidth) s = s.slice(0, -1);
      text(`${s}…`, x, y, size, bold, align);
    };
    const drawSignature = (src, x, y, w, h) => {
      if (!src) return;
      try { doc.addImage(src, 'PNG', x, y, w, h, undefined, 'FAST'); } catch (e) { console.warn('Firma no insertada', e); }
    };
    const drawCheckbox = (checked, x, y) => {
      rect(x, y, 2.3, 2.3, null, 0.18);
      if (checked) {
        line(x + 0.45, y + 1.25, x + 1.0, y + 1.85, 0.35);
        line(x + 1.0, y + 1.85, x + 1.95, y + 0.45, 0.35);
      }
    };

    const classificationOptions = ['INDUCCIÓN','CAPACITACIÓN','ENTRENAMIENTO','SIMULACRO DE EMERGENCIA','VISITANTES','RE-INDUCCIÓN','CAMBIO DE PUESTO','REUNIÓN','OTROS'];
    const chunks = [];
    for (let i = 0; i < data.participants.length; i += 25) chunks.push(data.participants.slice(i, i + 25));

    const drawPage = (participants) => {
      // Encabezado original del formato
      const hy = 5, hh = 19, logoW = 36, titleW = 120, metaW = 44;
      rect(left, hy, totalWidth, hh);
      line(left + logoW, hy, left + logoW, hy + hh);
      line(left + logoW + titleW, hy, left + logoW + titleW, hy + hh);
      if (logoData) doc.addImage(logoData, 'JPEG', left + 2, hy + 1, logoW - 4, hh - 2, undefined, 'FAST');
      const tx = left + logoW;
      line(tx, hy + 8.3, tx + titleW, hy + 8.3);
      text('SIG - SSOMAC', tx + titleW / 2, hy + 5.7, 8.2, true, 'center');
      rect(tx, hy + 8.3, titleW, 10.7, RED);
      text('REGISTRO DE INDUCCIÓN, CAPACITACIÓN, ENTRENAMIENTO Y SIMULACRO DE EMERGENCIA', tx + titleW / 2, hy + 14.8, 5.5, true, 'center', WHITE);

      const mx = tx + titleW;
      const meta = [
        ['Código:', PDF_EMPLOYER.codigoFormato],
        ['N°:', PDF_EMPLOYER.numeroFormato],
        ['Versión:', PDF_EMPLOYER.version],
        ['Fecha Act:', PDF_EMPLOYER.fechaActualizacion]
      ];
      meta.forEach((row, i) => {
        const y = hy + i * (hh / 4);
        if (i > 0) line(mx, y, right, y);
        line(mx + 13, y, mx + 13, y + hh / 4);
        text(row[0], mx + 2, y + 3.25, 4.35, true);
        fitText(row[1], mx + 14.5, y + 3.25, metaW - 15.5, 4.1, i < 3);
      });

      // Datos del empleador
      let y = 24;
      rect(left, y, totalWidth, 4.5);
      text('DATOS DE EMPLEADOR:', left + 1, y + 3.15, 5.0, true);
      y += 4.5;
      const employerWidths = [36, 30, 66, 33, 35];
      const employerHead = [
        ['RAZÓN O DENOMINACIÓN SOCIAL'],
        ['RUC'],
        ['DOMICILIO', '(Dirección, distrito, provincia, dpto.)'],
        ['ACTIVIDAD ECONÓMICA'],
        ['N° TRABAJADORES EN EL', 'CENTRO LABORAL']
      ];
      let x = left;
      employerWidths.forEach((w, i) => {
        rect(x, y, w, 8, DARK);
        const lines = employerHead[i];
        lines.forEach((s, j) => text(s, x + w / 2, y + 3.15 + j * 2.45, j ? 3.45 : 3.7, true, 'center', WHITE));
        x += w;
      });
      y += 8;
      const employerValues = [PDF_EMPLOYER.razonSocial, PDF_EMPLOYER.ruc, PDF_EMPLOYER.domicilio, PDF_EMPLOYER.actividad, String(data.trabajadoresCentro || 0)];
      x = left;
      employerWidths.forEach((w, i) => {
        rect(x, y, w, 7, LIGHT);
        const val = employerValues[i];
        if (i === 2) {
          const lines = doc.splitTextToSize(val, w - 3).slice(0, 2);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(3.8); doc.setTextColor(...BLACK);
          doc.text(lines, x + w / 2, y + 2.9, { align: 'center', lineHeightFactor: 1.05 });
        } else fitText(val, x + w / 2, y + 4.35, w - 2, 4.0, false, 'center');
        x += w;
      });
      y += 7;

      // Clasificación + datos del capacitador
      const classW = 33, detailW = 167, leftDetail = 117, rightDetail = 50;
      const trainingY = y;
      rect(left, trainingY, classW, 38);
      rect(left + classW, trainingY, detailW, 10);
      text('TEMA:', left + classW + 1.5, trainingY + 6.0, 4.8, true);
      fitText(t.tema || '—', left + classW + 14.0, trainingY + 6.0, detailW - 16, 4.7);
      const labelsLeft = [
        ['EXPOSITOR:', t.expositor_nombre || '—'],
        ['CARGO:', t.expositor_cargo || '—'],
        ['EMPRESA:', t.empresa || PDF_EMPLOYER.razonSocial],
        ['ÁREA:', t.area || '—']
      ];
      const labelsRight = [
        ['FIRMA:', ''],
        ['DNI:', t.expositor_dni || '—'],
        ['FECHA:', formatDatePE(t.fecha)],
        ['TIEMPO:', t.tiempo_texto || '—']
      ];
      const rowY = trainingY + 10;
      for (let i = 0; i < 4; i += 1) {
        rect(left + classW, rowY + i * 7, leftDetail, 7);
        rect(left + classW + leftDetail, rowY + i * 7, rightDetail, 7);
        text(labelsLeft[i][0], left + classW + 1.5, rowY + i * 7 + 4.45, 4.6, true);
        fitText(labelsLeft[i][1], left + classW + 18.5, rowY + i * 7 + 4.45, leftDetail - 20.5, 4.5);
        text(labelsRight[i][0], left + classW + leftDetail + 1.5, rowY + i * 7 + 4.45, 4.6, true);
        if (i > 0) fitText(labelsRight[i][1], left + classW + leftDetail + 17.0, rowY + i * 7 + 4.45, rightDetail - 19, 4.5);
      }
      drawSignature(t.firma_expositor, left + classW + leftDetail + 18.0, rowY + 0.8, 25, 5.4);

      text('CLASIFICACIÓN', left + 1.6, trainingY + 4.0, 4.7, true);
      let cy = trainingY + 7.0;
      classificationOptions.forEach((label) => {
        drawCheckbox(label === t.clasificacion, left + 1.6, cy - 2.15);
        if (label === 'SIMULACRO DE EMERGENCIA') {
          text('SIMULACRO DE', left + 5.0, cy, 4.0);
          text('EMERGENCIA', left + 6.5, cy + 2.45, 4.0);
          cy += 5.2;
        } else {
          text(label, left + 5.0, cy, 4.0);
          cy += 3.2;
        }
      });

      // Tabla de participantes - 25 filas por hoja
      y = trainingY + 38;
      const widths = [6, 59, 20, 45, 25, 33, 12];
      const headers = ['N°', 'APELLIDOS Y NOMBRES', 'N° DNI', 'PUESTO DE TRABAJO', 'ÁREA', 'FIRMA', 'NOTA'];
      x = left;
      widths.forEach((w, i) => {
        rect(x, y, w, 6.5, DARK);
        text(headers[i], x + w / 2, y + 4.2, 4.0, true, 'center', WHITE);
        x += w;
      });
      y += 6.5;
      for (let r = 0; r < 25; r += 1) {
        const p = participants[r];
        x = left;
        widths.forEach((w, ci) => {
          rect(x, y, w, 7);
          if (ci === 0) text(String(r + 1), x + w / 2, y + 4.55, 4.15, false, 'center');
          if (p) {
            if (ci === 1) fitText(p.apellidos_nombres || '', x + 1, y + 4.55, w - 2, 4.05);
            if (ci === 2) fitText(p.dni || '', x + w / 2, y + 4.55, w - 2, 4.05, false, 'center');
            if (ci === 3) fitText(p.puesto || '', x + 1, y + 4.55, w - 2, 4.05);
            if (ci === 4) fitText(p.area || '', x + 1, y + 4.55, w - 2, 4.05);
            if (ci === 5) drawSignature(p.firma, x + 4, y + 0.75, w - 8, 5.5);
            if (ci === 6) text(p.nota == null ? 'N.A.' : Number(p.nota).toFixed(2).replace(/\.00$/, ''), x + w / 2, y + 4.55, 4.3, true, 'center');
          }
          x += w;
        });
        y += 7;
      }

      // Responsable del registro - exactamente en la parte inferior del formato
      rect(left, y, totalWidth, 5.5, LIGHT);
      text('RESPONSABLE DEL REGISTRO', left + totalWidth / 2, y + 3.75, 4.55, true, 'center');
      y += 5.5;
      const respLeft = 120, respRight = 80;
      rect(left, y, respLeft, 13.5);
      rect(left + respLeft, y, respRight, 13.5);
      line(left, y + 6.75, left + respLeft, y + 6.75);
      line(left + respLeft, y + 6.75, right, y + 6.75);
      text('NOMBRE:', left + 1.5, y + 4.35, 4.35, true);
      fitText(t.responsable_nombre || '—', left + 18.0, y + 4.35, respLeft - 20, 4.2);
      text('CARGO:', left + 1.5, y + 11.0, 4.35, true);
      fitText(t.responsable_cargo || '—', left + 16.0, y + 11.0, respLeft - 18, 4.0);
      text('FIRMA:', left + respLeft + 1.5, y + 4.35, 4.35, true);
      drawSignature(t.firma_responsable, left + respLeft + 19.5, y + 0.9, 31, 5.3);
      text('FECHA:', left + respLeft + 1.5, y + 11.0, 4.35, true);
      fitText(formatDatePE(t.fecha), left + respLeft + 18, y + 11.0, respRight - 20, 4.2);
    };

    chunks.forEach((chunk, index) => {
      if (index > 0) doc.addPage();
      drawPage(chunk);
    });

    const safe = String(t.codigo || 'CAPACITACION').replace(/[^A-Za-z0-9_-]+/g, '_');
    doc.save(`${safe}_Registro_Oficial_Capacitacion.pdf`);
  } catch (err) {
    console.error(err);
    alert(err?.message || 'No fue posible generar el registro PDF.');
  } finally {
    if (button) { button.disabled = false; button.textContent = original; }
  }
}


async function downloadParticipantExamPdf(attemptId) {
  const attempt = selectedTrainingDetailData?.attempts?.find(x => x.id === attemptId);
  if (!attempt) { alert('No se encontró el intento seleccionado.'); return; }
  if (!window.jspdf?.jsPDF) { alert('No se cargó el generador PDF. Actualiza la página e inténtalo nuevamente.'); return; }

  try {
    const exam = selectedTrainingDetailData.exam;
    const training = selectedTrainingDetailData.training;
    const questions = (selectedTrainingDetailData.questions || []).slice().sort((a,b)=>Number(a.orden)-Number(b.orden));
    const attemptResponses = (selectedTrainingDetailData.responses || []).filter(r => r.intento_id === attemptId);
    const participant = (selectedTrainingDetailData.participants || []).find(p => p.id === attempt.participante_id) || {};
    const correctCount = attemptResponses.filter(r => r.es_correcta).length;
    const responseMap = new Map(attemptResponses.map(r => [r.pregunta_id, r]));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    let logoData = null;
    try { logoData = await imageToDataUrl('assets/logo-explo.jpg'); } catch (e) { console.warn(e); }
    const BLACK = [20,20,20], GREEN = [0,140,50], RED = [192,0,0], GRAY = [90,98,112], LIGHT = [245,245,245];

    const text = (value, x, y, size = 10, bold = false, align = 'left', color = BLACK) => {
      doc.setTextColor(...color);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.text(String(value ?? ''), x, y, { align });
    };
    const fitText = (value, x, y, maxWidth, size = 10, bold = false, align = 'left', color = BLACK) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(...color);
      let s = String(value ?? '');
      if (doc.getTextWidth(s) <= maxWidth) { doc.text(s, x, y, { align }); return; }
      while (s.length > 3 && doc.getTextWidth(`${s}…`) > maxWidth) s = s.slice(0,-1);
      doc.text(`${s}…`, x, y, { align });
    };
    const addWrapped = (value, x, y, maxWidth, size = 10, bold = false, color = BLACK, lineGap = 4.2) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(String(value ?? ''), maxWidth);
      doc.text(lines, x, y, { lineHeightFactor: 1.1 });
      return y + (lines.length * lineGap);
    };
    const ensureSpace = (needed = 20) => {
      if (cursorY + needed > 285) {
        doc.addPage();
        cursorY = 20;
      }
    };
    const drawSignature = (src, x, y, w, h) => {
      if (!src) return;
      try { doc.addImage(src, 'PNG', x, y, w, h, undefined, 'FAST'); } catch (e) { console.warn(e); }
    };
    const drawHeader = () => {
      if (logoData) doc.addImage(logoData, 'JPEG', 14, 10, 28, 17, undefined, 'FAST');
      text('SIG - SSOMAC', 105, 16, 10, true, 'center');
      text('EXAMEN', 105, 25, 16, true, 'center');
      text('Código: EDP-SIG-SSOMAC-RE-EA-122', 150, 14, 7.5, false);
      text('N°: 8', 150, 20, 7.5, false);
      text('Versión: 1', 150, 26, 7.5, false);
      doc.setDrawColor(0,0,0); doc.setLineWidth(0.5); doc.line(14, 31, 196, 31);
      text('RESOLUCIÓN DEL EXAMEN', 105, 40, 13, true, 'center');
    };

    drawHeader();
    let cursorY = 52;
    const labelX = 18, valueX = 48;
    const metaRows = [
      ['Participante:', participant.apellidos_nombres || '—'],
      ['DNI:', participant.dni || '—'],
      ['Curso:', training.tema || '—'],
      ['Fecha:', formatLongDatePE(training.fecha)]
    ];
    metaRows.forEach(([label,val]) => {
      text(label, labelX, cursorY, 9.5, true);
      const maxW = label === 'Curso:' ? 140 : 110;
      cursorY = addWrapped(val, valueX, cursorY, maxW, 9.3, false, BLACK, 4.2) + 1.2;
    });
    cursorY += 4;
    text(`Nota Final: ${Number(attempt.nota).toFixed(1)}`, 18, cursorY, 12, true, 'left', GREEN);
    cursorY += 7;
    text(`Estado: ${attempt.aprobado ? 'APROBADO' : 'DESAPROBADO'}`, 18, cursorY, 12, true, 'left', attempt.aprobado ? GREEN : RED);
    cursorY += 7;
    text(`Preguntas Correctas: ${correctCount} / ${questions.length}`, 18, cursorY, 12, true);
    cursorY += 10;

    questions.forEach((question, index) => {
      ensureSpace(42);
      doc.setDrawColor(228, 232, 239);
      doc.setFillColor(252, 252, 252);
      doc.roundedRect(16, cursorY - 5, 178, 6, 1.5, 1.5, 'F');
      cursorY = addWrapped(`${index + 1}. ${question.enunciado || ''}`, 18, cursorY, 168, 10.3, true, BLACK, 4.8);
      cursorY += 1.5;
      const response = responseMap.get(question.id);
      const options = (question.examen_opciones || []).slice().sort((a,b)=>Number(a.orden)-Number(b.orden));
      const selected = options.find(o => o.id === response?.opcion_id);
      const answerText = selected ? `${String.fromCharCode(65 + options.indexOf(selected))}) ${selected.texto || ''}` : 'No respondida';
      cursorY = addWrapped(`Tu respuesta: ${answerText}`, 21, cursorY, 160, 8.4, false, GRAY, 4.1);
      cursorY += 2.2;
      options.forEach((opt, oi) => {
        ensureSpace(9);
        const isCorrect = !!opt.es_correcta;
        const isSelected = response?.opcion_id === opt.id;
        const prefix = `${String.fromCharCode(65 + oi)}) `;
        let color = BLACK;
        let fontBold = false;
        if (isCorrect) { color = GREEN; fontBold = true; }
        else if (isSelected && !isCorrect) { color = RED; fontBold = true; }
        let line = prefix + (opt.texto || '');
        if (isSelected) line += '  ← tu respuesta';
        cursorY = addWrapped(line, 24, cursorY, 162, 8.7, fontBold, color, 4.4);
        cursorY += 0.8;
      });
      const qPoints = response?.es_correcta ? 2 : 0;
      ensureSpace(8);
      text(`Puntos: ${qPoints} / 2`, 21, cursorY + 1, 8.8, true, 'left', response?.es_correcta ? GREEN : RED);
      cursorY += 10;
    });

    ensureSpace(30);
    doc.setDrawColor(...LIGHT); doc.setLineWidth(0.2); doc.line(18, cursorY, 190, cursorY);
    cursorY += 8;
    if (participant.firma) {
      text('Firma del participante:', 18, cursorY, 9.8, true);
      drawSignature(participant.firma, 58, cursorY - 8, 40, 16);
      cursorY += 12;
    }
    text(`Nombre: ${participant.apellidos_nombres || '—'}`, 18, cursorY, 9.2, false);
    cursorY += 6;
    text(`Fecha: ${formatLongDatePE(training.fecha)}`, 18, cursorY, 9.2, false);

    const safeCode = String(training.codigo || 'CAPACITACION').replace(/[^A-Za-z0-9_-]+/g, '_');
    const safeName = String(participant.apellidos_nombres || 'Participante').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0,40);
    doc.save(`${safeCode}_Examen_${safeName}.pdf`);
  } catch (err) {
    console.error(err);
    alert(err?.message || 'No fue posible generar el PDF del examen.');
  }
}


function extractTrainingHoursOnly(value) {
  const match = String(value || '').match(/\d+(?:[.,]\d+)?/);
  if (!match) return '0';
  return match[0].replace(',', '.');
}

function certificateIssueDatePE(dateValue = new Date()) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const months = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SETIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `LIMA, ${day} DE ${month} DEL ${year}`;
}

async function getWorkerAssignmentLabel(participant, training) {
  if (!client) return scheduleUnitLabel(training);
  let worker = null;
  if (participant?.trabajador_id) {
    const res = await client.from('trabajadores').select('id,dni,cargo,sede_id,proyecto_id').eq('id', participant.trabajador_id).maybeSingle();
    if (!res.error) worker = res.data;
  }
  if (!worker && participant?.dni) {
    const res = await client.from('trabajadores').select('id,dni,cargo,sede_id,proyecto_id').eq('dni', participant.dni).maybeSingle();
    if (!res.error) worker = res.data;
  }
  if (worker?.proyecto_id) {
    const res = await client.from('proyectos').select('nombre').eq('id', worker.proyecto_id).maybeSingle();
    if (!res.error && res.data?.nombre) return `PROYECTO - ${res.data.nombre}`;
  }
  if (worker?.sede_id) {
    const res = await client.from('sedes').select('nombre').eq('id', worker.sede_id).maybeSingle();
    if (!res.error && res.data?.nombre) return `SEDE - ${res.data.nombre}`;
  }
  return scheduleUnitLabel(training) || '—';
}

async function downloadParticipantCertificatePdf(attemptId) {
  const data = selectedTrainingDetailData;
  const attempt = data?.attempts?.find(x => x.id === attemptId);
  if (!attempt || !data?.training) { alert('No se encontró el resultado seleccionado.'); return; }
  if (!attempt.aprobado) { alert('El certificado solo está disponible para participantes aprobados.'); return; }
  if (!window.PDFLib?.PDFDocument) { alert('No se cargó el generador de certificados. Actualiza la página e inténtalo nuevamente.'); return; }

  const participant = (data.participants || []).find(p => p.id === attempt.participante_id) || {};
  const training = data.training;
  const clicked = document.activeElement;
  const original = clicked?.textContent || 'Certificado';
  if (clicked?.tagName === 'BUTTON') { clicked.disabled = true; clicked.textContent = 'Generando…'; }

  try {
    const templateResponse = await fetch('assets/certificado-ssomac.pdf?v=20260922-1', { cache: 'no-store' });
    if (!templateResponse.ok) throw new Error('No se pudo cargar la plantilla del certificado.');
    const templateBytes = await templateResponse.arrayBuffer();
    const { PDFDocument, StandardFonts } = window.PDFLib;
    const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const assignment = await getWorkerAssignmentLabel(participant, training);
    const workerName = String(participant.apellidos_nombres || '—').toUpperCase();
    const workerDni = String(participant.dni || '—');
    const workerPosition = String(participant.puesto || '—').toUpperCase();
    const course = String(training.tema || '—').toUpperCase();
    const unit = String(assignment || '—').toUpperCase();
    const trainingDate = formatDatePE(training.fecha);
    const hours = extractTrainingHoursOnly(training.tiempo_texto);
    const issueDate = certificateIssueDatePE(new Date());

    const fields = {
      name: form.getTextField('Text-QQh6idkzuB'),
      dni: form.getTextField('Text-WGoQnviAjR'),
      position: form.getTextField('Text-Zj1fRcZFWe'),
      course: form.getTextField('Paragraph-wrnRK3cXBm'),
      unit: form.getTextField('Text-l5ujXqIrLl'),
      date: form.getTextField('Text-s92wHHPxgV'),
      hours: form.getTextField('Text-cVZ0Unv8rm'),
      issueDate: form.getTextField('Text-qK1FcojYj_')
    };

    fields.name.setText(workerName);
    fields.dni.setText(workerDni);
    fields.position.setText(workerPosition);
    fields.course.setText(course);
    fields.unit.setText(unit);
    fields.date.setText(trainingDate);
    fields.hours.setText(hours);
    fields.issueDate.setText(issueDate);

    // Mantiene la jerarquía visual de la plantilla original y evita desbordes.
    const fitField = (field, value, maxWidth, preferred, minimum) => {
      let size = preferred;
      while (size > minimum && font.widthOfTextAtSize(String(value || ''), size) > maxWidth) size -= 0.5;
      field.setFontSize(size);
    };
    fitField(fields.name, workerName, 450, 20, 12);
    fitField(fields.dni, workerDni, 180, 16, 12);
    fitField(fields.position, workerPosition, 310, 16, 10);
    fitField(fields.course, course, 475, 14, 9);
    fitField(fields.unit, unit, 155, 14, 8);
    fitField(fields.date, trainingDate, 95, 14, 9);
    fitField(fields.hours, hours, 20, 14, 10);
    fitField(fields.issueDate, issueDate, 270, 14, 9);

    form.updateFieldAppearances(font);
    form.flatten();
    const output = await pdfDoc.save();
    const blob = new Blob([output], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeCode = String(training.codigo || 'CAPACITACION').replace(/[^A-Za-z0-9_-]+/g, '_');
    const safeName = String(participant.apellidos_nombres || 'Participante').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 55);
    a.href = url;
    a.download = `${safeCode}_Certificado_${safeName || 'Participante'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (err) {
    console.error(err);
    alert(err?.message || 'No fue posible generar el certificado.');
  } finally {
    if (clicked?.tagName === 'BUTTON') { clicked.disabled = false; clicked.textContent = original; }
  }
}

async function openTrainingPreviewStep() {
  trainingForm?.classList.add('hidden');
  examPanel?.classList.add('hidden');
  participantsPanel?.classList.add('hidden');
  trainingPreviewPanel?.classList.remove('hidden');
  setTrainingSteps('preview');

  const payload = activeTrainingPayload || collectTrainingPayload();
  document.getElementById('previewTrainingCode').textContent = activeTrainingCode || 'Capacitación';
  document.getElementById('previewTrainingTopic').textContent = payload?.tema || '—';
  document.getElementById('previewTrainingDate').textContent = payload?.fecha || '—';
  document.getElementById('previewTrainingUnit').textContent = participantUnitLabel(payload || {});

  const link = activeExamConfig?.requiere_evaluacion && activeExamConfig?.publicado ? examPublicUrl() : '';
  const linkEl = document.getElementById('previewExamPublicLink');
  if (linkEl) {
    linkEl.textContent = link
      || (activeExamConfig?.requiere_evaluacion
        ? 'El examen está guardado, pero todavía no está habilitado.'
        : 'Esta actividad no tiene evaluación.');
  }
  const copyBtn = document.getElementById('copyPreviewExamLinkButton');
  if (copyBtn) copyBtn.disabled = !link;

  await loadPreviewParticipants();
  document.querySelector('.training-steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('backToExamFromPreview')?.addEventListener('click', () => {
  openExamStep(activeTrainingId, activeTrainingCode, activeTrainingPayload);
});
document.getElementById('refreshPreviewParticipantsButton')?.addEventListener('click', loadPreviewParticipants);
document.getElementById('downloadTrainingPdfButton')?.addEventListener('click', downloadTrainingPdf);
document.getElementById('copyPreviewExamLinkButton')?.addEventListener('click', () => {
  if (activeExamConfig?.requiere_evaluacion && activeExamConfig?.publicado) copyText(examPublicUrl(), 'Enlace del examen copiado.');
});
document.getElementById('finishTrainingConfigurationButton')?.addEventListener('click', () => {
  setTrainingMessage('Configuración guardada. Comparte el enlace del examen; el registro de participantes se llenará automáticamente al finalizar cada evaluación.', 'success');
  showTrainingDataStep();
  document.getElementById('nueva-capacitacion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

async function copyText(text, successMessage = 'Enlace copiado.') {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setTrainingMessage(successMessage, 'success');
  } catch {
    window.prompt('Copia este enlace:', text);
  }
}

examRequired?.addEventListener('change', applyExamRequiredVisibility);
document.getElementById('addExamQuestionButton')?.addEventListener('click', () => {
  if (examStructureLocked) return;
  syncQuestionsFromDom();
  examQuestionsCache.push(defaultExamQuestion());
  renderExamQuestions();
});
examQuestionList?.addEventListener('click', e => {
  const button = e.target.closest('[data-remove-exam-question]');
  if (!button || examStructureLocked) return;
  syncQuestionsFromDom();
  const index = Number(button.dataset.removeExamQuestion);
  examQuestionsCache.splice(index, 1);
  renderExamQuestions();
});
document.getElementById('backToTrainingFromExam')?.addEventListener('click', showTrainingDataStep);
document.getElementById('saveExamButton')?.addEventListener('click', () => saveExamConfiguration({ continueNext: false }));
document.getElementById('continueToPreviewButton')?.addEventListener('click', () => saveExamConfiguration({ continueNext: true }));
document.getElementById('copyExamLinkButton')?.addEventListener('click', () => copyText(examPublicUrl(), 'Enlace del examen copiado.'));
document.getElementById('copyExamLinkParticipantsButton')?.addEventListener('click', () => copyText(examPublicUrl(), 'Enlace del examen copiado.'));


// ------------------------------ EXAMEN PÚBLICO DEL TRABAJADOR ------------------------------
function setPublicExamMessage(message = '', type = 'error', targetId = 'publicExamMessage') {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.textContent = message;
  el.className = `form-message ${message ? 'visible' : ''} ${type}`;
}

function initializePublicExamView(code) {
  publicExamCode = (code || '').trim();
  publicExamData = null;
  authLoading?.classList.add('hidden');
  authScreen?.classList.add('hidden');
  appShell?.classList.add('hidden');
  publicExamScreen?.classList.remove('hidden');
  document.getElementById('publicExamHeaderCode').textContent = publicExamCode || 'Código de capacitación';
  document.getElementById('publicExamIdentity')?.classList.remove('hidden');
  document.getElementById('publicExamQuestions')?.classList.add('hidden');
  document.getElementById('publicExamResult')?.classList.add('hidden');
  document.getElementById('publicSignatureCard')?.classList.remove('hidden');
  document.getElementById('publicCompletionBox')?.classList.add('hidden');
  document.getElementById('publicCertificateActions')?.classList.add('hidden');
  resetPublicSignatureCanvas();
  document.getElementById('publicExamRegistration')?.classList.add('hidden');
  setTimeout(() => document.getElementById('publicExamDni')?.focus(), 50);
}

async function initializePublicExamMode(code) {
  initializePublicExamView(code);
}

async function loadPublicRegistrationSites() {
  const select = document.getElementById('publicRegSite');
  if (!select || !client) return false;
  select.innerHTML = '<option value="">Cargando sedes…</option>';

  const { data, error } = await client.rpc('listar_sedes_registro_examen', { p_codigo: publicExamCode });
  if (error || !data?.ok) {
    console.error(error);
    select.innerHTML = '<option value="">No disponible</option>';
    setPublicExamMessage(data?.error || 'No fue posible cargar las sedes.', 'error', 'publicRegistrationMessage');
    return false;
  }

  const sites = Array.isArray(data.sedes) ? data.sedes : [];
  select.innerHTML = '<option value="">Seleccione una sede</option>' +
    sites.map(site => `<option value="${site.id}">${escapeHtml(site.nombre || '')}</option>`).join('');
  return true;
}

async function showPublicRegistration(dni) {
  document.getElementById('publicExamParticipantPreview')?.classList.add('hidden');
  const section = document.getElementById('publicExamRegistration');
  section?.classList.remove('hidden');
  const dniField = document.getElementById('publicRegDni');
  if (dniField) dniField.value = dni;
  document.getElementById('publicRegLastName').value = '';
  document.getElementById('publicRegFirstName').value = '';
  document.getElementById('publicRegPosition').value = '';
  document.getElementById('publicRegArea').value = '';
  setPublicExamMessage('Usted no está registrado. Regístrese, por favor, para continuar con la evaluación.');
  setPublicExamMessage('', 'error', 'publicRegistrationMessage');
  await loadPublicRegistrationSites();
  setTimeout(() => document.getElementById('publicRegLastName')?.focus(), 30);
}

async function lookupPublicExam() {
  if (!client) return;
  const dniEl = document.getElementById('publicExamDni');
  const dni = (dniEl?.value || '').replace(/\D/g, '').slice(0,8);
  if (dniEl) dniEl.value = dni;
  document.getElementById('publicExamParticipantPreview')?.classList.add('hidden');
  document.getElementById('publicExamRegistration')?.classList.add('hidden');
  publicExamData = null;
  if (!/^\d{8}$/.test(dni)) {
    setPublicExamMessage('Ingresa un DNI de 8 dígitos.');
    return;
  }

  const button = document.getElementById('publicExamLookupButton');
  if (button) { button.disabled = true; button.textContent = 'Consultando…'; }
  setPublicExamMessage('');
  const { data, error } = await client.rpc('obtener_examen_participante', { p_codigo: publicExamCode, p_dni: dni });
  if (button) { button.disabled = false; button.textContent = 'Continuar'; }
  if (error) {
    console.error(error);
    const missing = /obtener_examen_participante|schema cache|function/i.test(error.message || '');
    setPublicExamMessage(missing ? 'La evaluación todavía no está habilitada en el sistema. Comunícate con el responsable.' : 'No fue posible consultar la evaluación.');
    return;
  }

  if (!data?.ok) {
    if (data?.status === 'NO_REGISTRADO' && data?.allow_registro) {
      await showPublicRegistration(dni);
      return;
    }
    if (data?.status === 'APROBADO' || data?.status === 'SIN_INTENTOS') {
      const recovered = await showExistingEvaluationSignatureState(dni);
      if (recovered) return;
    }
    const extra = data?.mejor_nota !== null && data?.mejor_nota !== undefined ? ` Mejor nota registrada: ${Number(data.mejor_nota).toFixed(2).replace(/\.00$/, '')}.` : '';
    setPublicExamMessage(`${data?.error || 'No fue posible acceder a la evaluación.'}${extra}`);
    return;
  }

  publicExamData = data;
  document.getElementById('publicExamParticipantName').textContent = data.nombre || 'Participante';
  document.getElementById('publicExamParticipantDetails').textContent = `DNI ${data.dni || '—'} · ${data.puesto || 'Sin puesto'} · ${data.area || 'Sin área'} · ${data.sede || 'Sin sede'}`;
  document.getElementById('publicExamAttempts').textContent = `Intentos disponibles: ${data.intentos_disponibles} de ${data.max_intentos} · Nota aprobatoria: ${Number(data.nota_aprobatoria).toFixed(2).replace(/\.00$/, '')}`;
  document.getElementById('publicExamParticipantPreview')?.classList.remove('hidden');
  setPublicExamMessage('Datos encontrados correctamente.', 'success');
}

async function registerWorkerFromPublicExam(event) {
  event.preventDefault();
  if (!client) return;

  const dni = (document.getElementById('publicRegDni')?.value || '').replace(/\D/g, '').slice(0, 8);
  const apellidos = (document.getElementById('publicRegLastName')?.value || '').trim();
  const nombres = (document.getElementById('publicRegFirstName')?.value || '').trim();
  const cargo = (document.getElementById('publicRegPosition')?.value || '').trim();
  const area = (document.getElementById('publicRegArea')?.value || '').trim();
  const sedeId = document.getElementById('publicRegSite')?.value || null;

  if (!/^\d{8}$/.test(dni) || !apellidos || !nombres || !cargo || !area || !sedeId) {
    setPublicExamMessage('Completa DNI, apellidos, nombres, puesto, área y sede.', 'error', 'publicRegistrationMessage');
    return;
  }

  const button = document.getElementById('publicRegistrationSaveButton');
  if (button) { button.disabled = true; button.textContent = 'Registrando…'; }
  setPublicExamMessage('', 'error', 'publicRegistrationMessage');

  const { data, error } = await client.rpc('registrar_trabajador_examen', {
    p_codigo: publicExamCode,
    p_dni: dni,
    p_apellidos: apellidos,
    p_nombres: nombres,
    p_cargo: cargo,
    p_area: area,
    p_sede_id: sedeId
  });

  if (button) { button.disabled = false; button.textContent = 'Registrarme y continuar'; }

  if (error || !data?.ok) {
    console.error(error);
    setPublicExamMessage(data?.error || 'No fue posible registrar tus datos.', 'error', 'publicRegistrationMessage');
    return;
  }

  document.getElementById('publicExamRegistration')?.classList.add('hidden');
  setPublicExamMessage('Registro realizado correctamente. Ya puedes continuar con la evaluación.', 'success');
  await lookupPublicExam();
}

function renderPublicExamQuestions() {
  if (!publicExamData) return;
  document.getElementById('publicExamTopic').textContent = publicExamData.tema || publicExamData.titulo || '—';
  document.getElementById('publicExamWorker').textContent = publicExamData.nombre || '—';
  document.getElementById('publicExamPassGrade').textContent = Number(publicExamData.nota_aprobatoria).toFixed(2).replace(/\.00$/, '');
  const list = document.getElementById('publicExamQuestionList');
  const questions = Array.isArray(publicExamData.preguntas) ? publicExamData.preguntas : [];
  list.innerHTML = questions.map((q, index) => `<article class="public-question-card">
    <h3>${index + 1}. ${escapeHtml(q.enunciado || '')}</h3>
    <div class="public-question-options">
      ${(q.opciones || []).map((o, oi) => `<label class="public-option">
        <input type="radio" name="public-q-${q.id}" value="${o.id}" />
        <span>${String.fromCharCode(65 + oi)}. ${escapeHtml(o.texto || '')}</span>
      </label>`).join('')}
    </div>
  </article>`).join('');
}

function startPublicExam() {
  if (!publicExamData) return;
  document.getElementById('publicExamIdentity')?.classList.add('hidden');
  document.getElementById('publicExamResult')?.classList.add('hidden');
  document.getElementById('publicCertificateActions')?.classList.add('hidden');
  document.getElementById('publicExamQuestions')?.classList.remove('hidden');
  renderPublicExamQuestions();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitPublicExam(event) {
  event.preventDefault();
  if (!client || !publicExamData) return;
  const questions = Array.isArray(publicExamData.preguntas) ? publicExamData.preguntas : [];
  const answers = [];
  for (const q of questions) {
    const selected = document.querySelector(`input[name="public-q-${q.id}"]:checked`);
    if (!selected) {
      setPublicExamMessage('Responde todas las preguntas antes de finalizar.', 'error', 'publicExamSubmitMessage');
      return;
    }
    answers.push({ pregunta_id: q.id, opcion_id: selected.value });
  }

  const button = document.getElementById('publicExamSubmitButton');
  if (button) { button.disabled = true; button.textContent = 'Calificando…'; }
  setPublicExamMessage('', 'error', 'publicExamSubmitMessage');
  const dni = document.getElementById('publicExamDni')?.value || '';
  const { data, error } = await client.rpc('enviar_examen_participante', {
    p_codigo: publicExamCode,
    p_dni: dni,
    p_respuestas: answers
  });
  if (button) { button.disabled = false; button.textContent = 'Finalizar y enviar examen'; }
  if (error || !data?.ok) {
    console.error(error);
    setPublicExamMessage(data?.error || 'No fue posible registrar la evaluación. Inténtalo nuevamente.', 'error', 'publicExamSubmitMessage');
    return;
  }

  document.getElementById('publicExamQuestions')?.classList.add('hidden');
  document.getElementById('publicExamResult')?.classList.remove('hidden');
  const icon = document.getElementById('publicExamResultIcon');
  icon.textContent = data.aprobado ? '✓' : '×';
  icon.classList.toggle('fail', !data.aprobado);
  document.getElementById('publicExamResultTitle').textContent = data.aprobado ? 'APROBADO' : 'DESAPROBADO';
  document.getElementById('publicExamGrade').textContent = data.mostrar_resultado ? `${Number(data.nota).toFixed(2).replace(/\.00$/, '')} / 20` : 'Registrado';
  document.getElementById('publicExamResultText').textContent = data.mostrar_resultado
    ? `Intento ${data.intento}. Respuestas correctas: ${data.correctas} de ${data.total_preguntas}. Nota aprobatoria: ${Number(data.nota_aprobatoria).toFixed(2).replace(/\.00$/, '')}.`
    : `Tu evaluación fue registrada correctamente. Intento ${data.intento}.`;
  document.getElementById('publicCertificateActions')?.classList.toggle('hidden', !data.aprobado);
  const retry = document.getElementById('publicExamRetryButton');
  retry.classList.toggle('hidden', data.aprobado || Number(data.intentos_restantes || 0) <= 0);
  publicExamData.intentos_disponibles = Number(data.intentos_restantes || 0);
  document.getElementById('publicSignatureCard')?.classList.remove('hidden');
  document.getElementById('publicCompletionBox')?.classList.add('hidden');
  resetPublicSignatureCanvas();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}



async function downloadPublicCertificatePdf() {
  if (!client) return;
  if (!window.PDFLib?.PDFDocument) {
    alert('No se cargó el generador de certificados. Actualiza la página e inténtalo nuevamente.');
    return;
  }

  const dni = (document.getElementById('publicExamDni')?.value || '').replace(/\D/g, '').slice(0,8);
  if (!/^\d{8}$/.test(dni)) {
    alert('No se pudo identificar el DNI del participante.');
    return;
  }

  const button = document.getElementById('publicDownloadCertificateButton');
  const original = button?.textContent || 'Descargar certificado';
  if (button) { button.disabled = true; button.textContent = 'Generando…'; }

  try {
    const { data, error } = await client.rpc('obtener_certificado_publico', {
      p_codigo: publicExamCode,
      p_dni: dni
    });

    if (error || !data?.ok) {
      console.error(error);
      const missing = /obtener_certificado_publico|schema cache|function/i.test(error?.message || '');
      throw new Error(missing
        ? 'La descarga pública del certificado todavía no está habilitada. Ejecuta el SQL de la Etapa 10B.1.'
        : (data?.error || 'No fue posible obtener los datos del certificado.'));
    }

    const templateResponse = await fetch('assets/certificado-ssomac.pdf?v=20260922-1', { cache: 'no-store' });
    if (!templateResponse.ok) throw new Error('No se pudo cargar la plantilla del certificado.');

    const templateBytes = await templateResponse.arrayBuffer();
    const { PDFDocument, StandardFonts } = window.PDFLib;
    const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const workerName = String(data.nombre || '—').toUpperCase();
    const workerDni = String(data.dni || '—');
    const workerPosition = String(data.puesto || '—').toUpperCase();
    const course = String(data.tema || '—').toUpperCase();
    const unit = String(data.unidad || '—').toUpperCase();
    const trainingDate = formatDatePE(data.fecha);
    const hours = extractTrainingHoursOnly(data.tiempo_texto);
    const issueDate = certificateIssueDatePE(new Date());

    const fields = {
      name: form.getTextField('Text-QQh6idkzuB'),
      dni: form.getTextField('Text-WGoQnviAjR'),
      position: form.getTextField('Text-Zj1fRcZFWe'),
      course: form.getTextField('Paragraph-wrnRK3cXBm'),
      unit: form.getTextField('Text-l5ujXqIrLl'),
      date: form.getTextField('Text-s92wHHPxgV'),
      hours: form.getTextField('Text-cVZ0Unv8rm'),
      issueDate: form.getTextField('Text-qK1FcojYj_')
    };

    fields.name.setText(workerName);
    fields.dni.setText(workerDni);
    fields.position.setText(workerPosition);
    fields.course.setText(course);
    fields.unit.setText(unit);
    fields.date.setText(trainingDate);
    fields.hours.setText(hours);
    fields.issueDate.setText(issueDate);

    const fitField = (field, value, maxWidth, preferred, minimum) => {
      let size = preferred;
      while (size > minimum && font.widthOfTextAtSize(String(value || ''), size) > maxWidth) size -= 0.5;
      field.setFontSize(size);
    };

    fitField(fields.name, workerName, 450, 20, 12);
    fitField(fields.dni, workerDni, 180, 16, 12);
    fitField(fields.position, workerPosition, 310, 16, 10);
    fitField(fields.course, course, 475, 14, 9);
    fitField(fields.unit, unit, 155, 14, 8);
    fitField(fields.date, trainingDate, 95, 14, 9);
    fitField(fields.hours, hours, 20, 14, 10);
    fitField(fields.issueDate, issueDate, 270, 14, 9);

    form.updateFieldAppearances(font);
    form.flatten();

    const output = await pdfDoc.save();
    const blob = new Blob([output], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeCode = String(data.codigo || publicExamCode || 'CAPACITACION').replace(/[^A-Za-z0-9_-]+/g, '_');
    const safeName = String(data.nombre || 'Participante')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0,55);

    a.href = url;
    a.download = `${safeCode}_Certificado_${safeName || 'Participante'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (err) {
    console.error(err);
    alert(err?.message || 'No fue posible generar el certificado.');
  } finally {
    if (button) { button.disabled = false; button.textContent = original; }
  }
}

const publicSignatureCanvas = document.getElementById('publicSignatureCanvas');
const publicSignatureCtx = publicSignatureCanvas?.getContext('2d');

function resetPublicSignatureCanvas() {
  if (!publicSignatureCanvas || !publicSignatureCtx) return;
  publicSignatureCtx.clearRect(0, 0, publicSignatureCanvas.width, publicSignatureCanvas.height);
  publicSignatureCtx.fillStyle = '#ffffff';
  publicSignatureCtx.fillRect(0, 0, publicSignatureCanvas.width, publicSignatureCanvas.height);
  publicSignatureCtx.strokeStyle = '#17263c';
  publicSignatureCtx.lineWidth = 4;
  publicSignatureCtx.lineCap = 'round';
  publicSignatureCtx.lineJoin = 'round';
  publicSignatureDrawing = false;
  publicSignatureHasStroke = false;
  setPublicExamMessage('', 'error', 'publicSignatureMessage');
}

function publicSignaturePoint(event) {
  const rect = publicSignatureCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (publicSignatureCanvas.width / rect.width),
    y: (event.clientY - rect.top) * (publicSignatureCanvas.height / rect.height)
  };
}

function startPublicSignature(event) {
  if (!publicSignatureCtx || !publicSignatureCanvas) return;
  event.preventDefault();
  publicSignatureDrawing = true;
  publicSignatureHasStroke = true;
  const point = publicSignaturePoint(event);
  publicSignatureCtx.beginPath();
  publicSignatureCtx.moveTo(point.x, point.y);
  try { publicSignatureCanvas.setPointerCapture(event.pointerId); } catch {}
}

function drawPublicSignature(event) {
  if (!publicSignatureDrawing || !publicSignatureCtx) return;
  event.preventDefault();
  const point = publicSignaturePoint(event);
  publicSignatureCtx.lineTo(point.x, point.y);
  publicSignatureCtx.stroke();
}

function stopPublicSignature(event) {
  if (!publicSignatureDrawing) return;
  event?.preventDefault?.();
  publicSignatureDrawing = false;
  publicSignatureCtx?.closePath();
}

async function savePublicParticipantSignature() {
  if (!client || !publicSignatureCanvas) return;
  if (!publicSignatureHasStroke) {
    setPublicExamMessage('Registra tu firma antes de finalizar.', 'error', 'publicSignatureMessage');
    return;
  }
  const dni = (document.getElementById('publicExamDni')?.value || '').replace(/\D/g,'').slice(0,8);
  const button = document.getElementById('savePublicSignatureButton');
  if (button) { button.disabled = true; button.textContent = 'Guardando firma…'; }
  const firma = publicSignatureCanvas.toDataURL('image/png');
  const { data, error } = await client.rpc('guardar_firma_participante_examen', {
    p_codigo: publicExamCode,
    p_dni: dni,
    p_firma: firma
  });
  if (button) { button.disabled = false; button.textContent = 'Registrar firma y finalizar'; }
  if (error || !data?.ok) {
    console.error(error);
    const missing = /guardar_firma_participante_examen|schema cache|function/i.test(error?.message || '');
    setPublicExamMessage(missing ? 'La función de firma todavía no está habilitada. Ejecuta el SQL de la Etapa 8.' : (data?.error || 'No fue posible guardar la firma.'), 'error', 'publicSignatureMessage');
    return;
  }
  document.getElementById('publicSignatureCard')?.classList.add('hidden');
  document.getElementById('publicCompletionBox')?.classList.remove('hidden');
  setPublicExamMessage('', 'success', 'publicSignatureMessage');
  window.scrollTo({ top: document.getElementById('publicExamResult')?.offsetTop || 0, behavior: 'smooth' });
}

async function showExistingEvaluationSignatureState(dni) {
  const { data, error } = await client.rpc('consultar_participacion_examen', {
    p_codigo: publicExamCode,
    p_dni: dni
  });
  if (error || !data?.ok || !data?.evaluado) return false;

  document.getElementById('publicExamIdentity')?.classList.add('hidden');
  document.getElementById('publicExamQuestions')?.classList.add('hidden');
  document.getElementById('publicExamResult')?.classList.remove('hidden');
  const icon = document.getElementById('publicExamResultIcon');
  icon.textContent = data.aprobado ? '✓' : '×';
  icon.classList.toggle('fail', !data.aprobado);
  document.getElementById('publicExamResultTitle').textContent = data.aprobado ? 'APROBADO' : 'EVALUACIÓN REGISTRADA';
  document.getElementById('publicExamGrade').textContent = data.mostrar_resultado && data.nota !== null ? `${Number(data.nota).toFixed(2).replace(/\.00$/, '')} / 20` : 'Registrado';
  document.getElementById('publicExamResultText').textContent = data.mostrar_resultado
    ? `Tu evaluación ya se encuentra registrada. Nota aprobatoria: ${Number(data.nota_aprobatoria).toFixed(2).replace(/\.00$/, '')}.`
    : 'Tu evaluación ya se encuentra registrada.';
  document.getElementById('publicCertificateActions')?.classList.toggle('hidden', !data.aprobado);
  document.getElementById('publicExamRetryButton')?.classList.add('hidden');

  if (data.firma_registrada) {
    document.getElementById('publicSignatureCard')?.classList.add('hidden');
    document.getElementById('publicCompletionBox')?.classList.remove('hidden');
  } else {
    document.getElementById('publicSignatureCard')?.classList.remove('hidden');
    document.getElementById('publicCompletionBox')?.classList.add('hidden');
    resetPublicSignatureCanvas();
  }
  setPublicExamMessage('Evaluación encontrada. Completa la firma si todavía está pendiente.', 'success');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  return true;
}

publicSignatureCanvas?.addEventListener('pointerdown', startPublicSignature);
publicSignatureCanvas?.addEventListener('pointermove', drawPublicSignature);
publicSignatureCanvas?.addEventListener('pointerup', stopPublicSignature);
publicSignatureCanvas?.addEventListener('pointerleave', stopPublicSignature);
publicSignatureCanvas?.addEventListener('pointercancel', stopPublicSignature);
document.getElementById('clearPublicSignatureButton')?.addEventListener('click', resetPublicSignatureCanvas);
document.getElementById('savePublicSignatureButton')?.addEventListener('click', savePublicParticipantSignature);
document.getElementById('publicDownloadCertificateButton')?.addEventListener('click', downloadPublicCertificatePdf);

document.getElementById('publicExamDni')?.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0,8); });
document.getElementById('publicExamDni')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); lookupPublicExam(); } });
document.getElementById('publicExamLookupButton')?.addEventListener('click', lookupPublicExam);
document.getElementById('publicExamStartButton')?.addEventListener('click', startPublicExam);
document.getElementById('publicExamForm')?.addEventListener('submit', submitPublicExam);
document.getElementById('publicRegistrationForm')?.addEventListener('submit', registerWorkerFromPublicExam);
document.getElementById('publicRegistrationCancelButton')?.addEventListener('click', () => {
  document.getElementById('publicExamRegistration')?.classList.add('hidden');
  setPublicExamMessage('');
  document.getElementById('publicExamDni')?.focus();
});
document.getElementById('publicExamRetryButton')?.addEventListener('click', async () => {
  document.getElementById('publicExamResult')?.classList.add('hidden');
  await lookupPublicExam();
  if (publicExamData) startPublicExam();
});



document.getElementById('newUserButton')?.addEventListener('click', () => openSystemUserModal(''));
document.getElementById('closeUserModal')?.addEventListener('click', closeSystemUserModal);
document.getElementById('cancelUserModal')?.addEventListener('click', closeSystemUserModal);
document.getElementById('userForm')?.addEventListener('submit', saveSystemUser);
document.getElementById('systemUserRole')?.addEventListener('change', updateSystemUserRoleFields);
document.getElementById('usersSearch')?.addEventListener('input', renderUsersTable);
document.getElementById('usersRoleFilter')?.addEventListener('change', renderUsersTable);
document.getElementById('usersStatusFilter')?.addEventListener('change', renderUsersTable);
document.getElementById('refreshUsersButton')?.addEventListener('click', () => loadUsersModule(true));
document.getElementById('toggleSystemUserPassword')?.addEventListener('click', () => {
  const input = document.getElementById('systemUserPassword');
  const button = document.getElementById('toggleSystemUserPassword');
  if (!input || !button) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  button.textContent = show ? 'Ocultar' : 'Mostrar';
});
document.getElementById('userModal')?.addEventListener('click', (event) => { if (event.target?.id === 'userModal') closeSystemUserModal(); });


// ============================================================
// ETAPA 12 · PRACTICAR
// ============================================================

let practiceRecords = [];
let practiceSites = [];
let practiceProjects = [];
let practiceQuestions = [];
let practiceAttempts = [];
let activePracticeId = null;
let practiceQuestionEditId = null;

function practiceCanCreate() {
  return ['ADMIN','PROYECTO'].includes(currentProfile?.rol_codigo);
}

function practiceCanManageRecord(record) {
  if (currentProfile?.rol_codigo === 'ADMIN') return true;
  return currentProfile?.rol_codigo === 'PROYECTO' && !!record?.proyecto_id;
}

function practiceUnitLabel(p) {
  if (p.proyecto_id) return `Proyecto · ${practiceProjects.find(x=>x.id===p.proyecto_id)?.nombre || 'Proyecto'}`;
  if (p.sede_id) return `Sede · ${practiceSites.find(x=>x.id===p.sede_id)?.nombre || 'Sede'}`;
  return 'Corporativo · Todos';
}

function practicePublicUrl(p) {
  if (!p?.codigo || !p?.activo || !p?.publicado) return '';
  return `${window.location.origin}${window.location.pathname}?practice=${encodeURIComponent(p.codigo)}`;
}

function practiceMsg(message='', type='error') {
  const el = document.getElementById('practiceModuleMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `module-message ${message ? 'visible' : ''} ${type}`;
}

function renderPracticeUnitOptions(selected='') {
  const select = document.getElementById('practiceUnit');
  if (!select) return;
  const options = [];
  if (currentProfile?.rol_codigo === 'ADMIN') {
    options.push('<option value="global">Corporativo · Todos</option>');
    practiceSites.filter(x=>x.activo).forEach(s=>options.push(`<option value="sede:${s.id}">Sede · ${escapeHtml(s.nombre)}</option>`));
  }
  practiceProjects.filter(x=>x.activo).forEach(p=>options.push(`<option value="proyecto:${p.id}">Proyecto · ${escapeHtml(p.nombre)}</option>`));
  if (!options.length) options.push('<option value="">Sin unidades disponibles</option>');
  select.innerHTML = options.join('');
  if (selected && [...select.options].some(o=>o.value===selected)) select.value=selected;
}

function practiceMetrics() {
  const final = practiceAttempts.filter(a=>a.finalizado_at);
  const avg = final.length ? final.reduce((s,a)=>s+Number(a.puntaje_total||0),0)/final.length : 0;
  return { final, avg };
}

function renderPracticeModule() {
  const search = (document.getElementById('practiceSearch')?.value || '').trim().toLowerCase();
  const status = document.getElementById('practiceStatusFilter')?.value || '';
  const { final, avg } = practiceMetrics();

  document.getElementById('practiceTotalCount').textContent = String(practiceRecords.length);
  document.getElementById('practiceActiveCount').textContent = String(practiceRecords.filter(x=>x.activo&&x.publicado).length);
  document.getElementById('practiceAttemptCount').textContent = String(final.length);
  document.getElementById('practiceAverageScore').textContent = String(Math.round(avg));
  document.getElementById('newPracticeButton')?.classList.toggle('hidden', !practiceCanCreate());

  let rows = practiceRecords.filter(p=>{
    if (search && !`${p.titulo||''} ${p.codigo||''}`.toLowerCase().includes(search)) return false;
    if (status==='ACTIVE' && !(p.activo&&p.publicado)) return false;
    if (status==='DRAFT' && (p.activo&&p.publicado)) return false;
    return true;
  });

  const box = document.getElementById('practiceCards');
  if (!box) return;
  if (!rows.length) {
    box.innerHTML = '<div class="training-library-empty">No hay quizzes con los filtros seleccionados.</div>';
    return;
  }

  box.innerHTML = rows.map(p=>{
    const qs = practiceQuestions.filter(q=>q.practica_id===p.id).length;
    const attempts = final.filter(a=>a.practica_id===p.id);
    const avgScore = attempts.length ? Math.round(attempts.reduce((s,a)=>s+Number(a.puntaje_total||0),0)/attempts.length) : 0;
    const link = practicePublicUrl(p);
    const canManage = practiceCanManageRecord(p);
    return `<article class="practice-list-card">
      <div class="practice-list-icon">★</div>
      <div class="practice-list-main">
        <div class="practice-list-title"><div><h3>${escapeHtml(p.titulo||'Sin título')}</h3><span>${escapeHtml(p.codigo||'—')} · ${escapeHtml(practiceUnitLabel(p))}</span></div><span class="practice-state ${p.activo&&p.publicado?'active':'draft'}">${p.activo&&p.publicado?'ACTIVO':'BORRADOR'}</span></div>
        <p>${escapeHtml(p.descripcion||'Quiz didáctico')}</p>
        <div class="practice-list-meta"><span>⏱ ${p.tiempo_pregunta_seg}s/pregunta</span><span>▤ ${qs} preguntas</span><span>♟ ${attempts.length} participaciones</span><span>★ Promedio ${avgScore} pts</span></div>
      </div>
      <div class="practice-list-actions">
        ${link?`<button class="practice-share-btn" data-practice-share="${p.id}" title="Copiar enlace">Compartir</button>`:''}
        <button class="secondary-btn" data-practice-open="${p.id}">${canManage?'Administrar':'Ver ranking'}</button>
      </div>
    </article>`;
  }).join('');

  box.querySelectorAll('[data-practice-open]').forEach(b=>b.addEventListener('click',()=>openPracticeEditor(b.dataset.practiceOpen)));
  box.querySelectorAll('[data-practice-share]').forEach(b=>b.addEventListener('click',async()=>{
    const p=practiceRecords.find(x=>x.id===b.dataset.practiceShare);
    const link=practicePublicUrl(p);
    if (!link) return;
    try { await navigator.clipboard.writeText(link); practiceMsg('Enlace de práctica copiado.','success'); }
    catch { window.prompt('Copia el enlace:',link); }
  }));
}

async function loadPracticeModule(force=false) {
  if (!client) return;
  if (practiceRecords.length && !force) { renderPracticeModule(); return; }
  practiceMsg('');
  const box=document.getElementById('practiceCards');
  if (box) box.innerHTML='<div class="training-library-empty">Cargando quizzes…</div>';

  const [p,s,pr,q,a] = await Promise.all([
    client.from('practicas').select('*').order('created_at',{ascending:false}),
    client.from('sedes').select('id,nombre,activo').order('nombre'),
    client.from('proyectos').select('id,nombre,activo').order('nombre'),
    client.from('practica_preguntas').select('id,practica_id,orden,enunciado,activo').eq('activo',true),
    client.from('practica_intentos').select('id,practica_id,trabajador_id,dni,apellidos_nombres,puntaje_total,correctas,total_preguntas,iniciado_at,finalizado_at').order('finalizado_at',{ascending:false})
  ]);
  if (p.error) { console.error(p.error); practiceMsg('No fue posible cargar Practicar. Ejecuta el SQL de la Etapa 12.'); return; }
  practiceRecords=p.data||[]; practiceSites=s.data||[]; practiceProjects=pr.data||[];
  practiceQuestions=q.error?[]:(q.data||[]); practiceAttempts=a.error?[]:(a.data||[]);
  renderPracticeModule();
}

function showPracticeList() {
  activePracticeId=null;
  document.getElementById('practiceEditorView')?.classList.add('hidden');
  document.getElementById('practiceListView')?.classList.remove('hidden');
  renderPracticeModule();
}

function openPracticeQuestionModal(question=null) {
  practiceQuestionEditId=question?.id||null;
  document.getElementById('practiceQuestionId').value=question?.id||'';
  document.getElementById('practiceQuestionModalTitle').textContent=question?'Editar pregunta':'Nueva pregunta';
  document.getElementById('practiceQuestionText').value=question?.enunciado||'';
  const inputs=[...document.querySelectorAll('.practice-option-input')];
  inputs.forEach((input,i)=>input.value=question?.opciones?.[i]?.texto||'');
  const correctIndex=question?.opciones?.findIndex(o=>o.es_correcta) ?? 0;
  const radio=document.querySelector(`input[name="practiceCorrectOption"][value="${correctIndex<0?0:correctIndex}"]`);
  if (radio) radio.checked=true;
  document.getElementById('practiceQuestionMessage').textContent='';
  const modal=document.getElementById('practiceQuestionModal');
  modal?.classList.remove('hidden'); modal?.setAttribute('aria-hidden','false');
}

function closePracticeQuestionModal() {
  const modal=document.getElementById('practiceQuestionModal');
  modal?.classList.add('hidden'); modal?.setAttribute('aria-hidden','true');
  practiceQuestionEditId=null;
}

async function loadPracticeQuestionsFull(practiceId) {
  const { data,error }=await client.from('practica_preguntas')
    .select('id,practica_id,orden,enunciado,activo,practica_opciones(id,orden,texto,es_correcta)')
    .eq('practica_id',practiceId).eq('activo',true).order('orden');
  if (error) { console.error(error); return []; }
  return (data||[]).map(q=>({...q,opciones:(q.practica_opciones||[]).sort((a,b)=>a.orden-b.orden)}));
}

async function renderPracticeEditorQuestions() {
  if (!activePracticeId) return;
  const list=document.getElementById('practiceQuestionList');
  const questions=await loadPracticeQuestionsFull(activePracticeId);
  if (!questions.length) { list.innerHTML='<div class="training-library-empty">Aún no hay preguntas. Agrega la primera.</div>'; return; }
  const rec=practiceRecords.find(x=>x.id===activePracticeId);
  const canManage=practiceCanManageRecord(rec);
  list.innerHTML=questions.map((q,i)=>`<article class="practice-admin-question">
    <div><span class="practice-question-number">${i+1}</span><div><strong>${escapeHtml(q.enunciado)}</strong><div class="practice-admin-options">${q.opciones.map((o,oi)=>`<span class="${o.es_correcta?'correct':''}">${String.fromCharCode(65+oi)}) ${escapeHtml(o.texto)}</span>`).join('')}</div></div></div>
    ${canManage?`<div class="practice-admin-question-actions"><button class="table-link" data-pq-edit="${q.id}">Editar</button><button class="table-action danger" data-pq-delete="${q.id}">Eliminar</button></div>`:''}
  </article>`).join('');
  list.querySelectorAll('[data-pq-edit]').forEach(b=>b.addEventListener('click',()=>{
    const q=questions.find(x=>x.id===b.dataset.pqEdit); openPracticeQuestionModal(q);
  }));
  list.querySelectorAll('[data-pq-delete]').forEach(b=>b.addEventListener('click',async()=>{
    if (!confirm('¿Eliminar esta pregunta?')) return;
    const {error}=await client.from('practica_preguntas').delete().eq('id',b.dataset.pqDelete);
    if (error) alert(error.message); else { practiceRecords=[]; await loadPracticeModule(true); activePracticeId=rec.id; await renderPracticeEditorQuestions(); }
  }));
}

async function renderPracticeRanking(practiceId) {
  const body=document.getElementById('practiceRankingBody');
  if (!body) return;
  const attempts=practiceAttempts.filter(a=>a.practica_id===practiceId&&a.finalizado_at);
  const best=new Map();
  attempts.forEach(a=>{
    const key=a.trabajador_id||a.dni;
    if (!best.has(key)||Number(a.puntaje_total)>Number(best.get(key).puntaje_total)) best.set(key,a);
  });
  const rows=[...best.values()].sort((a,b)=>Number(b.puntaje_total)-Number(a.puntaje_total));
  if (!rows.length) { body.innerHTML='<tr><td colspan="6" class="table-empty">Todavía no hay participaciones.</td></tr>'; return; }
  body.innerHTML=rows.map((a,i)=>`<tr><td><strong>#${i+1}</strong></td><td>${escapeHtml(a.apellidos_nombres||'—')}</td><td>${escapeHtml(a.dni||'—')}</td><td><strong>${Number(a.puntaje_total||0)}</strong></td><td>${a.correctas||0} / ${a.total_preguntas||0}</td><td>${a.finalizado_at?new Date(a.finalizado_at).toLocaleString('es-PE'):'—'}</td></tr>`).join('');
}

async function openPracticeEditor(id=null) {
  if (!practiceRecords.length) await loadPracticeModule();
  const rec=id?practiceRecords.find(x=>x.id===id):null;
  const canCreate=practiceCanCreate();
  if (!rec && !canCreate) return;
  activePracticeId=rec?.id||null;
  document.getElementById('practiceListView')?.classList.add('hidden');
  document.getElementById('practiceEditorView')?.classList.remove('hidden');
  document.getElementById('practiceId').value=rec?.id||'';
  document.getElementById('practiceEditorTitle').textContent=rec?'Administrar quiz':'Nuevo quiz';
  document.getElementById('practiceEditorCode').textContent=rec?.codigo||'NUEVO';
  document.getElementById('practiceTitle').value=rec?.titulo||'';
  document.getElementById('practiceDescription').value=rec?.descripcion||'';
  const unit=rec?.proyecto_id?`proyecto:${rec.proyecto_id}`:(rec?.sede_id?`sede:${rec.sede_id}`:'global');
  renderPracticeUnitOptions(unit);
  document.getElementById('practiceTime').value=String(rec?.tiempo_pregunta_seg||20);
  document.getElementById('practiceMaxAttempts').value=String(rec?.max_intentos||0);
  document.getElementById('practiceShuffleQuestions').checked=rec?.mezclar_preguntas??true;
  document.getElementById('practiceShuffleOptions').checked=rec?.mezclar_opciones??true;
  document.getElementById('practicePublished').checked=!!rec?.publicado;
  document.getElementById('practiceActive').checked=rec?.activo??true;
  document.getElementById('practiceFormMessage').textContent='';
  const canManage=rec?practiceCanManageRecord(rec):canCreate;
  [...document.querySelectorAll('#practiceForm input,#practiceForm select')].forEach(el=>{ if(el.id!=='practiceId') el.disabled=!canManage; });
  document.getElementById('savePracticeButton').classList.toggle('hidden',!canManage);
  document.getElementById('newPracticeQuestionButton').classList.toggle('hidden',!canManage);
  document.getElementById('practiceQuestionsPanel').classList.toggle('hidden',!rec);
  document.getElementById('practiceRankingPanel').classList.toggle('hidden',!rec);

  const link=rec?practicePublicUrl(rec):'';
  document.getElementById('copyPracticeLinkButton').classList.toggle('hidden',!link);
  document.getElementById('whatsappPracticeButton').classList.toggle('hidden',!link);
  if (rec) { await renderPracticeEditorQuestions(); await renderPracticeRanking(rec.id); }
  window.scrollTo({top:0,behavior:'smooth'});
}

async function savePractice(event) {
  event.preventDefault();
  if (!client||!practiceCanCreate()) return;
  const id=document.getElementById('practiceId').value||null;
  const title=document.getElementById('practiceTitle').value.trim();
  const unit=document.getElementById('practiceUnit').value;
  if (!title||!unit) { document.getElementById('practiceFormMessage').textContent='Completa el título y la asignación.'; return; }
  let sede_id=null,proyecto_id=null;
  if (unit.startsWith('sede:')) sede_id=unit.split(':')[1];
  if (unit.startsWith('proyecto:')) proyecto_id=unit.split(':')[1];
  const payload={
    titulo:title,
    descripcion:document.getElementById('practiceDescription').value.trim()||null,
    sede_id,proyecto_id,
    tiempo_pregunta_seg:Number(document.getElementById('practiceTime').value),
    max_intentos:Number(document.getElementById('practiceMaxAttempts').value),
    mezclar_preguntas:document.getElementById('practiceShuffleQuestions').checked,
    mezclar_opciones:document.getElementById('practiceShuffleOptions').checked,
    publicado:document.getElementById('practicePublished').checked,
    activo:document.getElementById('practiceActive').checked,
    created_by:currentProfile?.id||null
  };
  const msg=document.getElementById('practiceFormMessage'); msg.textContent='';
  let res;
  if (id) { delete payload.created_by; res=await client.from('practicas').update(payload).eq('id',id).select().single(); }
  else res=await client.from('practicas').insert(payload).select().single();
  if (res.error) { console.error(res.error); msg.textContent=res.error.message; return; }
  practiceRecords=[];
  await loadPracticeModule(true);
  await openPracticeEditor(res.data.id);
  msg.textContent='Quiz guardado correctamente.'; msg.className='form-message visible success';
}

async function savePracticeQuestion(event) {
  event.preventDefault();
  if (!client || !activePracticeId) return;

  const questionText = document.getElementById('practiceQuestionText').value.trim();
  const optionInputs = [...document.querySelectorAll('.practice-option-input')];
  const options = optionInputs.map(x => x.value.trim());
  const correctIndex = Number(document.querySelector('input[name="practiceCorrectOption"]:checked')?.value ?? -1);
  const msg = document.getElementById('practiceQuestionMessage');
  const submit = document.querySelector('#practiceQuestionForm button[type="submit"]');

  const showQuestionMessage = (message, type = 'error') => {
    msg.textContent = message || '';
    msg.className = `form-message ${message ? 'visible' : ''} ${type}`;
  };

  showQuestionMessage('');

  if (!questionText) {
    showQuestionMessage('Ingresa el enunciado de la pregunta.');
    document.getElementById('practiceQuestionText').focus();
    return;
  }

  const missingIndex = options.findIndex(x => !x);
  if (missingIndex >= 0) {
    showQuestionMessage(`Completa la alternativa ${String.fromCharCode(65 + missingIndex)}.`);
    optionInputs[missingIndex]?.focus();
    return;
  }

  if (correctIndex < 0 || correctIndex > 3) {
    showQuestionMessage('Selecciona cuál de las alternativas es la respuesta correcta.');
    return;
  }

  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Guardando…';
  }

  try {
    const { data, error } = await client.rpc('guardar_pregunta_practica', {
      p_practica_id: activePracticeId,
      p_pregunta_id: practiceQuestionEditId || null,
      p_enunciado: questionText,
      p_opcion_a: options[0],
      p_opcion_b: options[1],
      p_opcion_c: options[2],
      p_opcion_d: options[3],
      p_correcta: correctIndex + 1
    });

    if (error || !data?.ok) {
      console.error('guardar_pregunta_practica', error, data);
      throw new Error(data?.error || error?.message || 'No fue posible guardar la pregunta.');
    }

    closePracticeQuestionModal();
    await renderPracticeEditorQuestions();

    const moduleMessage = document.getElementById('practiceModuleMessage');
    if (moduleMessage) {
      moduleMessage.textContent = practiceQuestionEditId
        ? 'Pregunta actualizada correctamente.'
        : 'Pregunta agregada correctamente.';
      moduleMessage.className = 'module-message visible success';
    }
  } catch (err) {
    showQuestionMessage(err?.message || 'No fue posible guardar la pregunta.');
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Guardar pregunta';
    }
  }
}

async function copyActivePracticeLink() {
  const p=practiceRecords.find(x=>x.id===activePracticeId); const link=practicePublicUrl(p);
  if (!link) return;
  try{await navigator.clipboard.writeText(link);alert('Enlace copiado.');}catch{window.prompt('Copia el enlace:',link);}
}
function whatsappActivePractice() {
  const p=practiceRecords.find(x=>x.id===activePracticeId); const link=practicePublicUrl(p); if(!link)return;
  const text=`Practica: ${p.titulo}\n${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank','noopener');
}

// ---------------- PUBLIC PRACTICE ----------------
let publicPracticeCode='';
let publicPracticeData=null;
let publicPracticeRun=null;
let publicPracticeIndex=0;
let publicPracticeScore=0;
let publicPracticeCorrect=0;
let publicPracticeTimer=null;
let publicPracticeStartedAt=0;
let publicPracticeAnswering=false;

function setPublicPracticeMessage(message='',type='error',id='publicPracticeMessage'){
  const el=document.getElementById(id); if(!el)return;
  el.textContent=message; el.className=`form-message ${message?'visible':''} ${type}`;
}

async function initializePublicPracticeMode(code) {
  publicPracticeCode=(code||'').trim();
  publicPracticeData=null;
  publicExamScreen?.classList.add('hidden'); appShell?.classList.add('hidden'); authScreen?.classList.add('hidden'); authLoading?.classList.add('hidden');
  publicPracticeScreen?.classList.remove('hidden');
  document.getElementById('publicPracticeHeaderCode').textContent=publicPracticeCode||'Código de práctica';
  document.getElementById('publicPracticeIdentity')?.classList.remove('hidden');
  document.getElementById('publicPracticePlay')?.classList.add('hidden');
  document.getElementById('publicPracticeResult')?.classList.add('hidden');
  document.getElementById('publicPracticeRegistration')?.classList.add('hidden');
  setTimeout(()=>document.getElementById('publicPracticeDni')?.focus(),50);
}

async function lookupPublicPractice() {
  const dni=(document.getElementById('publicPracticeDni')?.value||'').replace(/\D/g,'').slice(0,8);
  setPublicPracticeMessage('');
  document.getElementById('publicPracticeParticipantPreview')?.classList.add('hidden');
  document.getElementById('publicPracticeRegistration')?.classList.add('hidden');
  if(!/^\d{8}$/.test(dni)){setPublicPracticeMessage('Ingresa un DNI válido de 8 dígitos.');return;}
  const btn=document.getElementById('publicPracticeLookupButton'); btn.disabled=true; btn.textContent='Buscando…';
  const {data,error}=await client.rpc('obtener_practica_participante',{p_codigo:publicPracticeCode,p_dni:dni});
  btn.disabled=false; btn.textContent='Continuar';
  if(error||!data?.ok){console.error(error);setPublicPracticeMessage(data?.error||'No fue posible consultar la práctica.');return;}
  document.getElementById('publicPracticeHeaderTitle').textContent=data.titulo||'Practicar';
  if(!data.registrado){
    publicPracticeData=data;
    document.getElementById('publicPracticeRegDni').value=dni;
    const {data:sites}=await client.rpc('listar_sedes_registro_practica',{p_codigo:publicPracticeCode});
    const select=document.getElementById('publicPracticeRegSite');
    select.innerHTML='<option value="">Seleccione una sede</option>'+(sites||[]).map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('');
    document.getElementById('publicPracticeSiteField').classList.toggle('hidden',!!data.sede_id||!!data.proyecto_id);
    document.getElementById('publicPracticeRegistration')?.classList.remove('hidden');
    setPublicPracticeMessage('No estás registrado. Regístrate para continuar.','error');
    return;
  }
  publicPracticeData=data;
  document.getElementById('publicPracticeParticipantName').textContent=data.nombre||'Participante';
  const unit=data.proyecto?`Proyecto ${data.proyecto}`:(data.sede?`Sede ${data.sede}`:'');
  document.getElementById('publicPracticeParticipantDetails').textContent=`DNI ${data.dni} · ${data.puesto||'Sin puesto'} · ${data.area||'Sin área'}${unit?` · ${unit}`:''}`;
  document.getElementById('publicPracticeAttempts').textContent=data.max_intentos>0?`Intentos: ${data.intentos_realizados} de ${data.max_intentos}`:`Intentos realizados: ${data.intentos_realizados} · Sin límite`;
  document.getElementById('publicPracticeParticipantPreview')?.classList.remove('hidden');
}

async function registerPublicPracticeWorker(event){
  event.preventDefault();
  const payload={
    p_codigo:publicPracticeCode,
    p_dni:document.getElementById('publicPracticeRegDni').value,
    p_nombres:document.getElementById('publicPracticeRegFirstName').value.trim(),
    p_apellidos:document.getElementById('publicPracticeRegLastName').value.trim(),
    p_cargo:document.getElementById('publicPracticeRegPosition').value.trim(),
    p_area:document.getElementById('publicPracticeRegArea').value.trim(),
    p_sede_id:document.getElementById('publicPracticeRegSite').value||null
  };
  const {data,error}=await client.rpc('registrar_trabajador_practica',payload);
  if(error||!data?.ok){setPublicPracticeMessage(data?.error||'No fue posible registrarte.','error','publicPracticeRegistrationMessage');return;}
  document.getElementById('publicPracticeRegistration')?.classList.add('hidden');
  await lookupPublicPractice();
}

async function startPublicPractice(){
  const dni=document.getElementById('publicPracticeDni').value;
  const btn=document.getElementById('publicPracticeStartButton');btn.disabled=true;btn.textContent='Preparando…';
  const {data,error}=await client.rpc('iniciar_practica',{p_codigo:publicPracticeCode,p_dni:dni});
  btn.disabled=false;btn.textContent='¡Empezar!';
  if(error||!data?.ok){setPublicPracticeMessage(data?.error||'No fue posible iniciar.');return;}
  publicPracticeRun=data; publicPracticeIndex=0; publicPracticeScore=0; publicPracticeCorrect=0;
  document.getElementById('publicPracticeIdentity')?.classList.add('hidden');
  document.getElementById('publicPracticeResult')?.classList.add('hidden');
  document.getElementById('publicPracticePlay')?.classList.remove('hidden');
  document.getElementById('publicPracticePlayer').textContent=data.participante||'Participante';
  document.getElementById('publicPracticeLiveScore').textContent='0';
  renderPublicPracticeQuestion();
}

function stopPracticeTimer(){ if(publicPracticeTimer){clearInterval(publicPracticeTimer);publicPracticeTimer=null;} }

function renderPublicPracticeQuestion(){
  stopPracticeTimer(); publicPracticeAnswering=false;
  const qs=publicPracticeRun?.preguntas||[];
  if(publicPracticeIndex>=qs.length){finishPublicPractice();return;}
  const q=qs[publicPracticeIndex];
  document.getElementById('publicPracticeProgress').textContent=`Pregunta ${publicPracticeIndex+1} de ${qs.length}`;
  document.getElementById('publicPracticeQuestionText').textContent=q.enunciado||'—';
  document.getElementById('publicPracticeFeedback').classList.add('hidden');
  const colors=['red','blue','yellow','green'];
  const shapes=['▲','◆','●','■'];
  const box=document.getElementById('publicPracticeOptions');
  box.innerHTML=(q.opciones||[]).map((o,i)=>`<button type="button" class="practice-option-btn ${colors[i%4]}" data-option="${o.id}"><span>${shapes[i%4]}</span><strong>${escapeHtml(o.texto||'')}</strong></button>`).join('');
  box.querySelectorAll('[data-option]').forEach(b=>b.addEventListener('click',()=>answerPublicPractice(b.dataset.option)));
  const total=Number(publicPracticeRun.tiempo_pregunta_seg||20);
  publicPracticeStartedAt=performance.now();
  document.getElementById('publicPracticeTimerText').textContent=String(total);
  document.getElementById('publicPracticeTimerBar').style.width='100%';
  publicPracticeTimer=setInterval(()=>{
    const elapsed=performance.now()-publicPracticeStartedAt;
    const remaining=Math.max(0,total-elapsed/1000);
    document.getElementById('publicPracticeTimerText').textContent=String(Math.ceil(remaining));
    document.getElementById('publicPracticeTimerBar').style.width=`${Math.max(0,remaining/total*100)}%`;
    if(remaining<=0){stopPracticeTimer();answerPublicPractice(null,true);}
  },100);
}

async function answerPublicPractice(optionId=null,timedOut=false){
  if(publicPracticeAnswering)return; publicPracticeAnswering=true; stopPracticeTimer();
  const q=publicPracticeRun.preguntas[publicPracticeIndex];
  const elapsed=Math.round(performance.now()-publicPracticeStartedAt);
  document.querySelectorAll('.practice-option-btn').forEach(b=>b.disabled=true);
  const dni=document.getElementById('publicPracticeDni').value;
  const {data,error}=await client.rpc('responder_practica',{
    p_intento_id:publicPracticeRun.intento_id,p_dni:dni,p_pregunta_id:q.id,p_opcion_id:optionId,p_tiempo_ms:elapsed
  });
  if(error||!data?.ok){alert(data?.error||'No fue posible guardar la respuesta.');publicPracticeAnswering=false;return;}
  const buttons=[...document.querySelectorAll('.practice-option-btn')];
  buttons.forEach(b=>{
    if(b.dataset.option===data.opcion_correcta_id)b.classList.add('answer-correct');
    else if(optionId&&b.dataset.option===optionId)b.classList.add('answer-wrong');
  });
  if(data.es_correcta){publicPracticeCorrect++;publicPracticeScore+=Number(data.puntaje||0);}
  document.getElementById('publicPracticeLiveScore').textContent=String(publicPracticeScore);
  const fb=document.getElementById('publicPracticeFeedback');
  fb.textContent=data.es_correcta?`✓ ¡Correcto! +${data.puntaje} puntos`:(timedOut?'⌛ Se acabó el tiempo':'✕ Respuesta incorrecta');
  fb.className=`practice-feedback ${data.es_correcta?'correct':'wrong'}`;
  setTimeout(()=>{publicPracticeIndex++;renderPublicPracticeQuestion();},1300);
}

async function finishPublicPractice(){
  stopPracticeTimer();
  const dni=document.getElementById('publicPracticeDni').value;
  const {data,error}=await client.rpc('finalizar_practica',{p_intento_id:publicPracticeRun.intento_id,p_dni:dni});
  document.getElementById('publicPracticePlay')?.classList.add('hidden');
  document.getElementById('publicPracticeResult')?.classList.remove('hidden');
  if(error||!data?.ok){document.getElementById('publicPracticeFinalText').textContent=data?.error||'No fue posible finalizar.';return;}
  document.getElementById('publicPracticeFinalScore').textContent=`${data.puntaje} pts`;
  document.getElementById('publicPracticeCorrect').textContent=`${data.correctas} / ${data.total}`;
  document.getElementById('publicPracticeRank').textContent=`#${data.posicion}`;
  document.getElementById('publicPracticeFinalText').textContent=`Completaste ${data.total} preguntas. ¡Sigue practicando para mejorar tu puntaje!`;
  const board=document.getElementById('publicPracticeRanking');
  board.innerHTML=(data.ranking||[]).map(r=>`<div class="practice-ranking-row ${r.posicion===data.posicion?'me':''}"><span>#${r.posicion}</span><strong>${escapeHtml(r.nombre)}</strong><b>${r.puntaje} pts</b></div>`).join('');
}

function resetPublicPracticeForRetry(){
  document.getElementById('publicPracticeResult')?.classList.add('hidden');
  document.getElementById('publicPracticeIdentity')?.classList.remove('hidden');
  document.getElementById('publicPracticeParticipantPreview')?.classList.add('hidden');
  lookupPublicPractice();
}

document.getElementById('newPracticeButton')?.addEventListener('click',()=>openPracticeEditor());
document.getElementById('backPracticeListButton')?.addEventListener('click',showPracticeList);
document.getElementById('practiceForm')?.addEventListener('submit',savePractice);
document.getElementById('refreshPracticeButton')?.addEventListener('click',()=>{practiceRecords=[];loadPracticeModule(true);});
document.getElementById('practiceSearch')?.addEventListener('input',renderPracticeModule);
document.getElementById('practiceStatusFilter')?.addEventListener('change',renderPracticeModule);
document.getElementById('newPracticeQuestionButton')?.addEventListener('click',()=>openPracticeQuestionModal());
document.getElementById('practiceQuestionForm')?.addEventListener('submit',savePracticeQuestion);
document.getElementById('closePracticeQuestionModal')?.addEventListener('click',closePracticeQuestionModal);
document.getElementById('cancelPracticeQuestionModal')?.addEventListener('click',closePracticeQuestionModal);
document.getElementById('practiceQuestionModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closePracticeQuestionModal);
document.getElementById('copyPracticeLinkButton')?.addEventListener('click',copyActivePracticeLink);
document.getElementById('whatsappPracticeButton')?.addEventListener('click',whatsappActivePractice);

document.getElementById('publicPracticeDni')?.addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,8);});
document.getElementById('publicPracticeDni')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupPublicPractice();}});
document.getElementById('publicPracticeLookupButton')?.addEventListener('click',lookupPublicPractice);
document.getElementById('publicPracticeStartButton')?.addEventListener('click',startPublicPractice);
document.getElementById('publicPracticeRegistrationForm')?.addEventListener('submit',registerPublicPracticeWorker);
document.getElementById('publicPracticeRegistrationCancelButton')?.addEventListener('click',()=>{
  document.getElementById('publicPracticeRegistration')?.classList.add('hidden');
  document.getElementById('publicPracticeDni')?.focus();
});
document.getElementById('publicPracticeAgainButton')?.addEventListener('click',resetPublicPracticeForRetry);


initializeAuth();
