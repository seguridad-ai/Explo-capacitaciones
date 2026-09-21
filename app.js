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

initializeAuth();
