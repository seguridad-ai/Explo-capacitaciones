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
const publicEvaluationScreen = document.getElementById('publicEvaluationScreen');
const publicMeetingSignatureScreen = document.getElementById('publicMeetingSignatureScreen');
const publicCommitteeTrainingScreen = document.getElementById('publicCommitteeTrainingScreen');

const menuItems = [...document.querySelectorAll('.menu-item')];
const sections = [...document.querySelectorAll('.page-section')];
const sidebar = document.getElementById('sidebar');
const mobileMenu = document.getElementById('mobileMenu');

let client = null;
let currentProfile = null;
let planningProjects = [];
let planningActivities = [];
let planningDependencies = [];
let planningOperationalProjects = [];
let planningLoaded = false;
let activePlanningProjectId = null;
let planningGanttZoom = 'WEEK';
let planningDetailMode = 'gantt';
let planningModuleTab = 'PROJECTS';
let planningTaskRecords = [];
let planningTaskHistory = [];
let planningAssignableUsers = [];
let planningTasksLoaded = false;
let planningTaskPeriod = 'TODAY';
let activePlanningTaskId = null;

let planningReminderPreferences = {
  sonido_habilitado:true,
  sonido_codigo:'BANCO',
  volumen:0.55,
  notificacion_navegador:false,
  minutos_default:[60,30,10,0]
};
let planningReminderTimer = null;
let planningReminderAudioContext = null;
let planningReminderQueue = [];
let planningReminderActive = null;
let planningReminderChecking = false;
let planningReminderInitialized = false;


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
  publicEvaluationScreen?.classList.add('hidden');
  publicMeetingSignatureScreen?.classList.add('hidden');
  publicCommitteeTrainingScreen?.classList.add('hidden');
  appShell?.classList.add('hidden');
  authScreen?.classList.remove('hidden');
  authLoading?.classList.add('hidden');
  setTimeout(() => loginEmail?.focus(), 50);
}

function showLoading() {
  publicExamScreen?.classList.add('hidden');
  publicPracticeScreen?.classList.add('hidden');
  publicEvaluationScreen?.classList.add('hidden');
  publicMeetingSignatureScreen?.classList.add('hidden');
  publicCommitteeTrainingScreen?.classList.add('hidden');
  appShell?.classList.add('hidden');
  authScreen?.classList.add('hidden');
  authLoading?.classList.remove('hidden');
}

function showApp() {
  publicExamScreen?.classList.add('hidden');
  publicPracticeScreen?.classList.add('hidden');
  publicEvaluationScreen?.classList.add('hidden');
  publicMeetingSignatureScreen?.classList.add('hidden');
  publicCommitteeTrainingScreen?.classList.add('hidden');
  authScreen?.classList.add('hidden');
  authLoading?.classList.add('hidden');
  appShell?.classList.remove('hidden');
  setTimeout(()=>initializePlanningReminderEngine(),600);
}

function showSection(sectionId) {
  sections.forEach(section => section.classList.toggle('active-section', section.id === sectionId));
  menuItems.forEach(item => item.classList.toggle('active', item.dataset.section === sectionId));
  sidebar?.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (sectionId === 'planificacion') loadPlanningModule();
  if (sectionId === 'programacion') loadScheduleModule();
  if (sectionId === 'sedes-proyectos') loadCatalogs();
  if (sectionId === 'trabajadores') loadWorkersModule();
  if (sectionId === 'nueva-capacitacion') loadTrainingModule();
  if (sectionId === 'practicar') { switchPracticeMode(practiceEvaluationMode || 'quiz'); }
  if (sectionId === 'comite') loadCommitteeModule();
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
  const publicInductionTokenParam = publicParams.get('induction');
  const publicPracticeCodeParam = publicParams.get('practice');
  const publicEvaluationCodeParam = publicParams.get('evaluation');
  const publicMeetingSignatureTokenParam = publicParams.get('meetingSign');
  const publicCommitteeTrainingTokenParam = publicParams.get('committeeTraining');
  if (publicExamCode) {
    await initializePublicExamMode(publicExamCode);
    return;
  }
  if (publicInductionTokenParam) {
    await initializePublicInductionMode(publicInductionTokenParam);
    return;
  }
  if (publicPracticeCodeParam) {
    await initializePublicPracticeMode(publicPracticeCodeParam);
    return;
  }
  if (publicEvaluationCodeParam) {
    await initializePublicEvaluationMode(publicEvaluationCodeParam);
    return;
  }
  if (publicMeetingSignatureTokenParam) {
    await initializePublicCommitteeMeetingSignature(publicMeetingSignatureTokenParam);
    return;
  }
  if (publicCommitteeTrainingTokenParam) {
    await initializePublicCommitteeTrainingMode(publicCommitteeTrainingTokenParam);
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
// ETAPA 17A · PLANIFICACIÓN · PROYECTOS Y GANTT
// ============================================================

function planningMessage(message='',type='error') {
  const el=document.getElementById('planningMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`module-message ${message?'visible':''} ${type}`;
}

function planningProjectFormMessage(message='',type='error') {
  const el=document.getElementById('planningProjectFormMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function planningActivityFormMessage(message='',type='error') {
  const el=document.getElementById('planningActivityFormMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function planningParseDate(value) {
  if (!value) return null;
  const d=new Date(`${String(value).slice(0,10)}T00:00:00`);
  return Number.isNaN(d.getTime())?null:d;
}

function planningIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,'0');
  const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function planningAddDays(date,days) {
  const d=new Date(date);
  d.setDate(d.getDate()+days);
  return d;
}

function planningDaysBetween(a,b) {
  const da=planningParseDate(a); const db=planningParseDate(b);
  if (!da || !db) return 0;
  return Math.round((db-da)/86400000);
}

function planningDurationDays(start,end) {
  return Math.max(1,planningDaysBetween(start,end)+1);
}

function planningOperationalProjectName(id) {
  const p=planningOperationalProjects.find(x=>x.id===id);
  if (!p) return 'Corporativo / sin vínculo';
  return p.cliente ? `${p.nombre} · ${p.cliente}` : p.nombre;
}

function planningActivitiesFor(projectId) {
  return planningActivities.filter(x=>x.planificacion_proyecto_id===projectId)
    .sort((a,b)=>(Number(a.orden)||0)-(Number(b.orden)||0));
}

function planningDependenciesFor(activityId) {
  return planningDependencies.filter(x=>x.actividad_id===activityId);
}

function planningDependencyNames(activityId) {
  const ids=planningDependenciesFor(activityId).map(x=>x.depende_de_actividad_id);
  return ids.map(id=>planningActivities.find(a=>a.id===id)?.nombre).filter(Boolean);
}

function planningProjectProgress(projectId) {
  const rows=planningActivitiesFor(projectId).filter(x=>x.estado!=='CANCELADO');
  if (!rows.length) return 0;
  const tasks=rows.filter(x=>x.tipo==='TAREA');
  const basis=tasks.length?tasks:rows;
  const total=basis.reduce((sum,x)=>sum+Number(x.progreso||0),0);
  return Math.round(total/basis.length);
}

function planningProjectCompletedCount(projectId) {
  return planningActivitiesFor(projectId).filter(x=>x.estado==='COMPLETADO' || Number(x.progreso)>=100).length;
}

function planningActivitySituation(activity) {
  if (!activity) return {code:'PENDIENTE',label:'Pendiente'};
  if (activity.estado==='CANCELADO') return {code:'CANCELADO',label:'Cancelado'};
  if (activity.estado==='COMPLETADO' || Number(activity.progreso)>=100) return {code:'COMPLETADO',label:'Completado'};
  if (activity.estado==='BLOQUEADO') return {code:'BLOQUEADO',label:'Bloqueado'};
  const today=new Date(); today.setHours(0,0,0,0);
  const end=planningParseDate(activity.fecha_fin);
  if (end && end<today) {
    const days=Math.abs(Math.floor((today-end)/86400000));
    return {code:'ATRASADO',label:`Atrasado ${days} día(s)`};
  }
  if (activity.estado==='EN_PROCESO' || Number(activity.progreso)>0) return {code:'EN_PROCESO',label:'En proceso'};
  return {code:'PENDIENTE',label:'Pendiente'};
}

function planningPriorityLabel(value) {
  return {BAJA:'Baja',MEDIA:'Media',ALTA:'Alta',CRITICA:'Crítica'}[value] || value || '—';
}

function planningCategoryLabel(value) {
  return {SIG:'SIG',SST:'SST',AMBIENTAL:'Ambiental',CALIDAD:'Calidad',AUDITORIA:'Auditoría',CLIENTE:'Cliente',OPERACIONES:'Operaciones',OTRO:'Otro'}[value] || value || '—';
}

function planningCanManage(project) {
  if (!project || !currentProfile) return false;
  if (currentProfile.rol_codigo==='ADMIN') return true;
  if (project.created_by===currentProfile.id || project.responsable_profile_id===currentProfile.id) return true;
  return true; // RLS de Supabase mantiene la autorización efectiva en escritura.
}

function populatePlanningOperationalProjects() {
  const select=document.getElementById('planningProjectOperationalProject');
  if (!select) return;
  const current=select.value;
  select.innerHTML='<option value="">Ninguno / corporativo</option>'+
    planningOperationalProjects.filter(x=>x.activo!==false).map(p=>
      `<option value="${p.id}">${escapeHtml(p.nombre)}${p.cliente?` · ${escapeHtml(p.cliente)}`:''}</option>`
    ).join('');
  if ([...select.options].some(o=>o.value===current)) select.value=current;
}

function populatePlanningYearFilter() {
  const select=document.getElementById('planningYearFilter');
  if (!select) return;
  const current=select.value || 'ALL';
  const years=[...new Set(planningProjects.map(x=>String(x.fecha_inicio||'').slice(0,4)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
  select.innerHTML='<option value="ALL">Todos los años</option>'+years.map(y=>`<option value="${y}">${y}</option>`).join('');
  if ([...select.options].some(o=>o.value===current)) select.value=current;
}

function updatePlanningStats() {
  const active=planningProjects.filter(x=>x.estado==='ACTIVO').length;
  const activities=planningActivities.filter(x=>x.estado!=='CANCELADO').length;
  const overdue=planningActivities.filter(x=>planningActivitySituation(x).code==='ATRASADO').length;
  const today=new Date(); today.setHours(0,0,0,0);
  const limit=planningAddDays(today,30);
  const milestones=planningActivities.filter(x=>{
    if (x.tipo!=='HITO' || x.estado==='COMPLETADO' || x.estado==='CANCELADO') return false;
    const d=planningParseDate(x.fecha_inicio); return d && d>=today && d<=limit;
  }).length;
  const progresses=planningProjects.filter(x=>x.estado!=='CANCELADO').map(x=>planningProjectProgress(x.id));
  const avg=progresses.length?Math.round(progresses.reduce((a,b)=>a+b,0)/progresses.length):0;
  const map={planningActiveProjectsCount:active,planningActivitiesCount:activities,planningOverdueCount:overdue,planningMilestonesCount:milestones,planningAverageProgress:`${avg}%`};
  Object.entries(map).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.textContent=String(value);});
}

function renderPlanningProjectList() {
  const container=document.getElementById('planningProjectList');
  if (!container) return;
  const q=(document.getElementById('planningSearch')?.value||'').trim().toLowerCase();
  const status=document.getElementById('planningStatusFilter')?.value||'ALL';
  const category=document.getElementById('planningCategoryFilter')?.value||'ALL';
  const year=document.getElementById('planningYearFilter')?.value||'ALL';

  const rows=planningProjects.filter(p=>{
    if (status!=='ALL' && p.estado!==status) return false;
    if (category!=='ALL' && p.categoria!==category) return false;
    if (year!=='ALL' && String(p.fecha_inicio||'').slice(0,4)!==year) return false;
    const hay=[p.codigo,p.nombre,p.descripcion,p.objetivo,p.responsable_nombre,planningOperationalProjectName(p.proyecto_id),p.categoria].filter(Boolean).join(' ').toLowerCase();
    return !q || hay.includes(q);
  });

  const count=document.getElementById('planningResultCount');
  if (count) count.textContent=`${rows.length} proyecto${rows.length===1?'':'s'}`;

  if (!rows.length) {
    container.innerHTML='<div class="training-library-empty">No se encontraron proyectos planificados.</div>';
    return;
  }

  container.innerHTML=rows.map(p=>{
    const acts=planningActivitiesFor(p.id);
    const progress=planningProjectProgress(p.id);
    const overdue=acts.filter(a=>planningActivitySituation(a).code==='ATRASADO').length;
    const milestones=acts.filter(a=>a.tipo==='HITO' && a.estado!=='COMPLETADO' && a.estado!=='CANCELADO').length;
    return `<article class="planning-project-card" data-planning-project-card="${p.id}">
      <div class="planning-project-card-icon">▤</div>
      <div class="planning-project-card-main">
        <div class="planning-project-card-top">
          <div><span class="eyebrow">${escapeHtml(p.codigo||'PROYECTO')} · ${escapeHtml(planningCategoryLabel(p.categoria))}</span><h4>${escapeHtml(p.nombre)}</h4><p>${escapeHtml(planningOperationalProjectName(p.proyecto_id))}</p></div>
          <span class="planning-project-status ${String(p.estado||'').toLowerCase()}">${escapeHtml(p.estado||'—')}</span>
        </div>
        <div class="planning-project-card-meta">
          <span>Responsable: ${escapeHtml(p.responsable_nombre||'—')}</span><span>▣ ${escapeHtml(formatDatePE(p.fecha_inicio))} → ${escapeHtml(formatDatePE(p.fecha_fin))}</span><span>${acts.length} actividad(es)</span><span>${milestones} hito(s)</span>${overdue?`<span class="planning-card-overdue">${overdue} atrasada(s)</span>`:''}<span class="planning-priority ${String(p.prioridad||'').toLowerCase()}">${escapeHtml(planningPriorityLabel(p.prioridad))}</span>
        </div>
        <div class="planning-card-progress-row"><div class="planning-progress-track"><div class="planning-progress-fill" style="width:${progress}%"></div></div><strong>${progress}%</strong></div>
      </div>
      <div class="planning-project-card-actions"><button class="committee-manage-btn" type="button" data-open-planning-project="${p.id}">Abrir Gantt</button></div>
    </article>`;
  }).join('');

  container.querySelectorAll('[data-open-planning-project]').forEach(btn=>btn.addEventListener('click',()=>openPlanningProject(btn.dataset.openPlanningProject)));
}

async function loadPlanningModule(force=false) {
  if (!client) return;
  if (planningLoaded && !force) {
    populatePlanningYearFilter(); updatePlanningStats(); renderPlanningProjectList(); return;
  }
  planningMessage('');
  const [projects,activities,deps,operational]=await Promise.all([
    client.from('planificacion_proyectos').select('*').order('fecha_inicio',{ascending:false}).order('created_at',{ascending:false}),
    client.from('planificacion_actividades').select('*').order('planificacion_proyecto_id').order('orden'),
    client.from('planificacion_dependencias').select('*'),
    client.from('proyectos').select('id,nombre,cliente,activo').order('nombre')
  ]);
  const err=projects.error||activities.error||deps.error||operational.error;
  if (err) {console.error(err); planningMessage(err.message||'No fue posible cargar Planificación.'); return;}
  planningProjects=projects.data||[]; planningActivities=activities.data||[]; planningDependencies=deps.data||[]; planningOperationalProjects=operational.data||[]; planningLoaded=true;
  populatePlanningOperationalProjects(); populatePlanningYearFilter(); updatePlanningStats(); renderPlanningProjectList();
  if (activePlanningProjectId && planningProjects.some(x=>x.id===activePlanningProjectId)) renderPlanningProjectDetail();
}

function switchPlanningTab(tab) {
  planningModuleTab=tab==='TASKS'?'TASKS':'PROJECTS';
  const projects=planningModuleTab==='PROJECTS';

  document.getElementById('planningProjectsTab')?.classList.toggle('active',projects);
  document.getElementById('planningTasksTab')?.classList.toggle('active',!projects);
  document.getElementById('planningProjectsView')?.classList.toggle('hidden',!projects);
  document.getElementById('planningTasksView')?.classList.toggle('hidden',projects);

  const topButton=document.getElementById('planningNewProjectButton');
  if (topButton) {
    topButton.classList.remove('hidden');
    topButton.textContent=projects?'＋ Nuevo proyecto':'＋ Nuevo pendiente';
  }

  if (!projects) loadPlanningTasksModule();
}

function openPlanningProjectModal(project=null) {
  planningProjectFormMessage('');
  populatePlanningOperationalProjects();
  document.getElementById('planningProjectModalTitle').textContent=project?'Editar proyecto':'Nuevo proyecto';
  document.getElementById('planningProjectId').value=project?.id||'';
  document.getElementById('planningProjectName').value=project?.nombre||'';
  document.getElementById('planningProjectCategory').value=project?.categoria||'SIG';
  document.getElementById('planningProjectPriority').value=project?.prioridad||'MEDIA';
  document.getElementById('planningProjectStart').value=project?.fecha_inicio||new Date().toISOString().slice(0,10);
  document.getElementById('planningProjectEnd').value=project?.fecha_fin||planningIsoDate(planningAddDays(new Date(),30));
  document.getElementById('planningProjectResponsible').value=project?.responsable_nombre||[currentProfile?.nombres,currentProfile?.apellidos].filter(Boolean).join(' ');
  document.getElementById('planningProjectOperationalProject').value=project?.proyecto_id||'';
  document.getElementById('planningProjectStatus').value=project?.estado||'ACTIVO';
  document.getElementById('planningProjectObjective').value=project?.objetivo||'';
  document.getElementById('planningProjectDescription').value=project?.descripcion||'';
  document.getElementById('planningProjectNotes').value=project?.observaciones||'';
  const modal=document.getElementById('planningProjectModal'); modal?.classList.remove('hidden'); modal?.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
}

function closePlanningProjectModal() {document.getElementById('planningProjectModal')?.classList.add('hidden');document.getElementById('planningProjectModal')?.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');}

async function savePlanningProject(event) {
  event.preventDefault(); planningProjectFormMessage('');
  const id=document.getElementById('planningProjectId').value||null;
  const payload={
    nombre:document.getElementById('planningProjectName').value.trim(),
    categoria:document.getElementById('planningProjectCategory').value,
    prioridad:document.getElementById('planningProjectPriority').value,
    fecha_inicio:document.getElementById('planningProjectStart').value,
    fecha_fin:document.getElementById('planningProjectEnd').value,
    responsable_nombre:document.getElementById('planningProjectResponsible').value.trim(),
    proyecto_id:document.getElementById('planningProjectOperationalProject').value||null,
    estado:document.getElementById('planningProjectStatus').value,
    objetivo:document.getElementById('planningProjectObjective').value.trim()||null,
    descripcion:document.getElementById('planningProjectDescription').value.trim()||null,
    observaciones:document.getElementById('planningProjectNotes').value.trim()||null
  };
  if (!payload.nombre||!payload.responsable_nombre||!payload.fecha_inicio||!payload.fecha_fin) {planningProjectFormMessage('Completa nombre, responsable y fechas.');return;}
  if (payload.fecha_fin<payload.fecha_inicio) {planningProjectFormMessage('La fecha de fin no puede ser anterior a la fecha de inicio.');return;}
  const button=document.getElementById('planningProjectSave'); const old=button.textContent; button.disabled=true;button.textContent='Guardando…';
  const res=id?await client.from('planificacion_proyectos').update(payload).eq('id',id).select().single():await client.from('planificacion_proyectos').insert({...payload,created_by:currentProfile?.id||undefined}).select().single();
  button.disabled=false;button.textContent=old;
  if (res.error) {console.error(res.error);planningProjectFormMessage(res.error.message||'No fue posible guardar el proyecto.');return;}
  closePlanningProjectModal();planningLoaded=false;await loadPlanningModule(true);openPlanningProject(res.data.id);planningMessage(id?'Proyecto actualizado correctamente.':'Proyecto creado. Ahora agrega actividades.','success');
}

async function deletePlanningProject() {
  const project=planningProjects.find(x=>x.id===activePlanningProjectId); if(!project)return;
  const count=planningActivitiesFor(project.id).length;
  if(!confirm(`¿Eliminar definitivamente "${project.nombre}"?\n\nSe eliminarán también ${count} actividad(es) y sus dependencias.`))return;
  const {error}=await client.from('planificacion_proyectos').delete().eq('id',project.id);
  if(error){planningMessage(error.message||'No fue posible eliminar el proyecto.');return;}
  activePlanningProjectId=null;planningLoaded=false;await loadPlanningModule(true);showPlanningPortfolio();planningMessage('Proyecto eliminado.','success');
}

function showPlanningPortfolio() {
  activePlanningProjectId=null;
  document.getElementById('planningPortfolioView')?.classList.remove('hidden');
  document.getElementById('planningProjectDetailView')?.classList.add('hidden');
  document.getElementById('planningNewProjectButton')?.classList.remove('hidden');
  renderPlanningProjectList();
}

function openPlanningProject(id) {
  activePlanningProjectId=id;
  document.getElementById('planningPortfolioView')?.classList.add('hidden');
  document.getElementById('planningProjectDetailView')?.classList.remove('hidden');
  document.getElementById('planningNewProjectButton')?.classList.add('hidden');
  renderPlanningProjectDetail();
}

function renderPlanningProjectDetail() {
  const p=planningProjects.find(x=>x.id===activePlanningProjectId); if(!p)return;
  const acts=planningActivitiesFor(p.id); const progress=planningProjectProgress(p.id); const completed=planningProjectCompletedCount(p.id);
  document.getElementById('planningDetailCode').textContent=`${p.codigo||'—'} · ${planningCategoryLabel(p.categoria)} · ${planningPriorityLabel(p.prioridad)}`;
  document.getElementById('planningDetailName').textContent=p.nombre||'—';
  const status=document.getElementById('planningDetailStatus');status.textContent=p.estado||'—';status.className=`planning-project-status ${String(p.estado||'').toLowerCase()}`;
  document.getElementById('planningDetailDescription').textContent=p.descripcion||'Sin descripción registrada.';
  document.getElementById('planningDetailResponsible').textContent=p.responsable_nombre||'—';
  document.getElementById('planningDetailStart').textContent=formatDatePE(p.fecha_inicio);
  document.getElementById('planningDetailEnd').textContent=formatDatePE(p.fecha_fin);
  document.getElementById('planningDetailDuration').textContent=`${planningDurationDays(p.fecha_inicio,p.fecha_fin)} días`;
  document.getElementById('planningDetailUnit').textContent=planningOperationalProjectName(p.proyecto_id);
  document.getElementById('planningDetailProgress').textContent=`${progress}%`;
  document.getElementById('planningDetailProgressBar').style.width=`${progress}%`;
  document.getElementById('planningDetailProgressText').textContent=`${completed} de ${acts.length} actividades completadas`;
  const objBox=document.getElementById('planningDetailObjectiveBox');objBox.classList.toggle('hidden',!p.objetivo);document.getElementById('planningDetailObjective').textContent=p.objetivo||'';
  renderPlanningActivityTable(); renderPlanningGantt();
}

function switchPlanningDetailView(mode) {
  planningDetailMode=mode==='list'?'list':'gantt';
  document.querySelectorAll('[data-planning-detail-view]').forEach(b=>b.classList.toggle('active',b.dataset.planningDetailView===planningDetailMode));
  document.getElementById('planningGanttPanel')?.classList.toggle('hidden',planningDetailMode!=='gantt');
  document.getElementById('planningListPanel')?.classList.toggle('hidden',planningDetailMode!=='list');
}

function populatePlanningActivityDependencies(editingId=null,selected=[]) {
  const select=document.getElementById('planningActivityDependencies'); if(!select)return;
  select.innerHTML=planningActivitiesFor(activePlanningProjectId).filter(x=>x.id!==editingId).map(x=>`<option value="${x.id}" ${selected.includes(x.id)?'selected':''}>${x.orden}. ${escapeHtml(x.nombre)}</option>`).join('');
  if(!select.options.length) select.innerHTML='<option disabled>No hay otras actividades</option>';
}

function updatePlanningActivityTypeFields() {
  const type=document.getElementById('planningActivityType')?.value||'TAREA';
  const start=document.getElementById('planningActivityStart'); const end=document.getElementById('planningActivityEnd'); const label=document.getElementById('planningActivityEndLabel');
  if(type==='HITO'){label.textContent='Fecha del hito *'; if(start?.value)end.value=start.value; end.disabled=true;} else {label.textContent='Fin *';end.disabled=false;}
}

function openPlanningActivityModal(activity=null) {
  const project=planningProjects.find(x=>x.id===activePlanningProjectId); if(!project)return;
  planningActivityFormMessage('');
  document.getElementById('planningActivityModalTitle').textContent=activity?'Editar actividad':'Nueva actividad';
  document.getElementById('planningActivityModalSubtitle').textContent=`${project.codigo||''} · ${project.nombre}`;
  document.getElementById('planningActivityId').value=activity?.id||'';
  document.getElementById('planningActivityType').value=activity?.tipo||'TAREA';
  document.getElementById('planningActivityPriority').value=activity?.prioridad||'MEDIA';
  document.getElementById('planningActivityName').value=activity?.nombre||'';
  document.getElementById('planningActivityResponsible').value=activity?.responsable_nombre||project.responsable_nombre||'';
  document.getElementById('planningActivityStatus').value=activity?.estado||'PENDIENTE';
  document.getElementById('planningActivityStart').value=activity?.fecha_inicio||project.fecha_inicio;
  document.getElementById('planningActivityEnd').value=activity?.fecha_fin||project.fecha_inicio;
  document.getElementById('planningActivityProgress').value=activity?.progreso??0;
  document.getElementById('planningActivityDescription').value=activity?.descripcion||'';
  document.getElementById('planningActivityNotes').value=activity?.observaciones||'';
  const deps=activity?planningDependenciesFor(activity.id).map(x=>x.depende_de_actividad_id):[];populatePlanningActivityDependencies(activity?.id||null,deps);updatePlanningActivityTypeFields();
  const modal=document.getElementById('planningActivityModal');modal?.classList.remove('hidden');modal?.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');
}

function closePlanningActivityModal(){document.getElementById('planningActivityModal')?.classList.add('hidden');document.getElementById('planningActivityModal')?.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');}

async function savePlanningActivity(event) {
  event.preventDefault(); planningActivityFormMessage('');
  const project=planningProjects.find(x=>x.id===activePlanningProjectId); if(!project)return;
  const id=document.getElementById('planningActivityId').value||null; const type=document.getElementById('planningActivityType').value; const start=document.getElementById('planningActivityStart').value; let end=document.getElementById('planningActivityEnd').value; if(type==='HITO')end=start;
  const progress=Math.max(0,Math.min(100,Number(document.getElementById('planningActivityProgress').value||0))); let estado=document.getElementById('planningActivityStatus').value; if(progress>=100)estado='COMPLETADO'; else if(progress>0 && estado==='PENDIENTE')estado='EN_PROCESO';
  const payload={planificacion_proyecto_id:project.id,tipo,nombre:document.getElementById('planningActivityName').value.trim(),descripcion:document.getElementById('planningActivityDescription').value.trim()||null,responsable_nombre:document.getElementById('planningActivityResponsible').value.trim()||null,fecha_inicio:start,fecha_fin:end,progreso:progress,estado,prioridad:document.getElementById('planningActivityPriority').value,observaciones:document.getElementById('planningActivityNotes').value.trim()||null};
  if(!payload.nombre||!start||!end){planningActivityFormMessage('Completa actividad y fechas.');return;}
  if(end<start){planningActivityFormMessage('La fecha de fin no puede ser anterior al inicio.');return;}
  if(start<project.fecha_inicio||end>project.fecha_fin){planningActivityFormMessage(`La actividad debe estar dentro del rango del proyecto (${formatDatePE(project.fecha_inicio)} al ${formatDatePE(project.fecha_fin)}).`);return;}
  const selected=[...document.getElementById('planningActivityDependencies').selectedOptions].map(o=>o.value).filter(Boolean);
  const button=document.getElementById('planningActivitySave');const old=button.textContent;button.disabled=true;button.textContent='Guardando…';
  let res;
  if(id){res=await client.from('planificacion_actividades').update(payload).eq('id',id).select().single();}
  else {const order=(planningActivitiesFor(project.id).at(-1)?.orden||0)+1;res=await client.from('planificacion_actividades').insert({...payload,orden:order,created_by:currentProfile?.id||undefined}).select().single();}
  if(res.error){button.disabled=false;button.textContent=old;console.error(res.error);planningActivityFormMessage(res.error.message||'No fue posible guardar la actividad.');return;}
  const activityId=res.data.id;
  const del=await client.from('planificacion_dependencias').delete().eq('actividad_id',activityId); if(del.error){console.error(del.error);}
  if(selected.length){const ins=await client.from('planificacion_dependencias').insert(selected.map(dep=>({actividad_id:activityId,depende_de_actividad_id:dep})));if(ins.error){button.disabled=false;button.textContent=old;planningActivityFormMessage(ins.error.message||'La actividad se guardó, pero no fue posible guardar sus dependencias.');return;}}
  button.disabled=false;button.textContent=old;closePlanningActivityModal();planningLoaded=false;await loadPlanningModule(true);activePlanningProjectId=project.id;openPlanningProject(project.id);planningMessage(id?'Actividad actualizada.':'Actividad agregada al Gantt.','success');
}

async function deletePlanningActivity(id) {
  const a=planningActivities.find(x=>x.id===id);if(!a)return;if(!confirm(`¿Eliminar la actividad "${a.nombre}"?`))return;
  const {error}=await client.from('planificacion_actividades').delete().eq('id',id);if(error){planningMessage(error.message||'No fue posible eliminar la actividad.');return;}
  const projectId=a.planificacion_proyecto_id;planningLoaded=false;await loadPlanningModule(true);activePlanningProjectId=projectId;openPlanningProject(projectId);planningMessage('Actividad eliminada.','success');
}

async function movePlanningActivity(id,direction) {
  const rows=planningActivitiesFor(activePlanningProjectId);const idx=rows.findIndex(x=>x.id===id);const otherIdx=direction==='up'?idx-1:idx+1;if(idx<0||otherIdx<0||otherIdx>=rows.length)return;const a=rows[idx],b=rows[otherIdx];
  const [ra,rb]=await Promise.all([client.from('planificacion_actividades').update({orden:b.orden}).eq('id',a.id),client.from('planificacion_actividades').update({orden:a.orden}).eq('id',b.id)]);if(ra.error||rb.error){planningMessage(ra.error?.message||rb.error?.message||'No fue posible reordenar.');return;}planningLoaded=false;await loadPlanningModule(true);openPlanningProject(activePlanningProjectId);
}

function renderPlanningActivityTable() {
  const body=document.getElementById('planningActivityTableBody');if(!body)return;const rows=planningActivitiesFor(activePlanningProjectId);
  if(!rows.length){body.innerHTML='<tr><td colspan="9" class="table-empty">Aún no existen actividades. Usa “Nueva actividad”.</td></tr>';return;}
  body.innerHTML=rows.map((a,i)=>{const sit=planningActivitySituation(a);const deps=planningDependencyNames(a.id);return `<tr class="${sit.code==='ATRASADO'?'planning-overdue-row':''}"><td><div class="planning-order-cell"><button type="button" data-move-plan-activity="${a.id}" data-dir="up" ${i===0?'disabled':''}>↑</button><strong>${a.orden}</strong><button type="button" data-move-plan-activity="${a.id}" data-dir="down" ${i===rows.length-1?'disabled':''}>↓</button></div></td><td><strong>${a.tipo==='HITO'?'◆ ':''}${escapeHtml(a.nombre)}</strong><small>${escapeHtml(planningPriorityLabel(a.prioridad))}</small></td><td>${escapeHtml(a.responsable_nombre||'—')}</td><td>${escapeHtml(formatDatePE(a.fecha_inicio))}</td><td>${escapeHtml(formatDatePE(a.fecha_fin))}</td><td>${deps.length?deps.map(escapeHtml).join('<br>'):'—'}</td><td><div class="planning-table-progress"><div><span style="width:${Number(a.progreso||0)}%"></span></div><b>${Number(a.progreso||0)}%</b></div></td><td><span class="planning-situation ${sit.code.toLowerCase()}">${escapeHtml(sit.label)}</span></td><td class="planning-row-actions"><button class="secondary-btn small-btn" type="button" data-edit-plan-activity="${a.id}">Editar</button><button class="induction-delete-btn small-btn" type="button" data-delete-plan-activity="${a.id}">Eliminar</button></td></tr>`;}).join('');
  body.querySelectorAll('[data-edit-plan-activity]').forEach(b=>b.addEventListener('click',()=>openPlanningActivityModal(planningActivities.find(x=>x.id===b.dataset.editPlanActivity))));
  body.querySelectorAll('[data-delete-plan-activity]').forEach(b=>b.addEventListener('click',()=>deletePlanningActivity(b.dataset.deletePlanActivity)));
  body.querySelectorAll('[data-move-plan-activity]').forEach(b=>b.addEventListener('click',()=>movePlanningActivity(b.dataset.movePlanActivity,b.dataset.dir)));
}

function planningZoomDayWidth() {return planningGanttZoom==='DAY'?30:planningGanttZoom==='WEEK'?9:3.5;}

function buildPlanningGanttHeaders(start,end,dayWidth) {
  const total=planningDurationDays(planningIsoDate(start),planningIsoDate(end));
  const segments=[];let cursor=new Date(start);
  if(planningGanttZoom==='DAY') {
    for(let i=0;i<total;i++){const d=planningAddDays(start,i);segments.push({label:`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`,days:1});}
  } else if(planningGanttZoom==='WEEK') {
    let i=0;while(i<total){const d=planningAddDays(start,i);const days=Math.min(7,total-i);segments.push({label:`${String(d.getDate()).padStart(2,'0')} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]}`,days});i+=days;}
  } else {
    let d=new Date(start);let consumed=0;while(consumed<total){const month=d.getMonth(),year=d.getFullYear();let days=0;while(consumed+days<total){const x=planningAddDays(start,consumed+days);if(x.getMonth()!==month||x.getFullYear()!==year)break;days++;}segments.push({label:`${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][month]} ${year}`,days});consumed+=days;d=planningAddDays(start,consumed);}
  }
  return segments.map(s=>`<div class="planning-gantt-header-segment" style="width:${s.days*dayWidth}px">${escapeHtml(s.label)}</div>`).join('');
}

function renderPlanningGantt() {
  const host=document.getElementById('planningGantt');const empty=document.getElementById('planningGanttEmpty');if(!host)return;const p=planningProjects.find(x=>x.id===activePlanningProjectId);const rows=planningActivitiesFor(activePlanningProjectId);
  if(!p||!rows.length){host.innerHTML='';empty?.classList.remove('hidden');return;}empty?.classList.add('hidden');
  let start=planningParseDate(p.fecha_inicio),end=planningParseDate(p.fecha_fin);const dayWidth=planningZoomDayWidth();const totalDays=planningDurationDays(p.fecha_inicio,p.fecha_fin);const timelineWidth=Math.max(680,totalDays*dayWidth);const today=new Date();today.setHours(0,0,0,0);const todayOffset=Math.round((today-start)/86400000)*dayWidth;const todayVisible=today>=start&&today<=end;
  const header=buildPlanningGanttHeaders(start,end,dayWidth);
  const body=rows.map(a=>{const offset=Math.max(0,planningDaysBetween(p.fecha_inicio,a.fecha_inicio))*dayWidth;const days=planningDurationDays(a.fecha_inicio,a.fecha_fin);const width=Math.max(a.tipo==='HITO'?14:18,days*dayWidth);const sit=planningActivitySituation(a);const deps=planningDependencyNames(a.id);return `<div class="planning-gantt-row" data-gantt-activity="${a.id}"><div class="planning-gantt-task"><div class="planning-gantt-task-main"><strong>${a.tipo==='HITO'?'◆ ':''}${escapeHtml(a.nombre)}</strong><small>${escapeHtml(a.responsable_nombre||'Sin responsable')}${deps.length?` · Depende de: ${escapeHtml(deps.join(', '))}`:''}</small></div><span>${Number(a.progreso||0)}%</span></div><div class="planning-gantt-timeline" style="width:${timelineWidth}px">${todayVisible?`<div class="planning-gantt-today-line" style="left:${todayOffset}px"></div>`:''}${a.tipo==='HITO'?`<button class="planning-gantt-milestone ${sit.code.toLowerCase()}" data-gantt-edit="${a.id}" style="left:${offset}px" title="${escapeHtml(a.nombre)} · ${escapeHtml(formatDatePE(a.fecha_inicio))}"></button>`:`<button class="planning-gantt-bar ${sit.code.toLowerCase()}" data-gantt-edit="${a.id}" style="left:${offset}px;width:${width}px" title="${escapeHtml(a.nombre)} · ${escapeHtml(formatDatePE(a.fecha_inicio))} a ${escapeHtml(formatDatePE(a.fecha_fin))}"><span style="width:${Number(a.progreso||0)}%"></span><b>${width>70?`${Number(a.progreso||0)}%`:''}</b></button>`}</div></div>`;}).join('');
  host.innerHTML=`<div class="planning-gantt-grid"><div class="planning-gantt-left-header">Actividad / responsable</div><div id="planningGanttTimelineScroll" class="planning-gantt-scroll"><div class="planning-gantt-header" style="width:${timelineWidth}px">${header}${todayVisible?`<div class="planning-gantt-today-header" style="left:${todayOffset}px">HOY</div>`:''}</div></div><div class="planning-gantt-body" style="grid-column:1/-1">${body}</div></div>`;
  host.querySelectorAll('[data-gantt-edit]').forEach(b=>b.addEventListener('click',()=>openPlanningActivityModal(planningActivities.find(x=>x.id===b.dataset.ganttEdit))));
  setTimeout(()=>{syncPlanningGanttScroll();scrollPlanningGanttToday(false);},0);
}

function scrollPlanningGanttToday(force=true) {
  const p=planningProjects.find(x=>x.id===activePlanningProjectId);const scroller=document.getElementById('planningGanttTimelineScroll');if(!p||!scroller)return;const today=new Date();today.setHours(0,0,0,0);const start=planningParseDate(p.fecha_inicio);const end=planningParseDate(p.fecha_fin);if(today<start||today>end){if(force)scroller.scrollLeft=0;return;}const left=Math.max(0,Math.round((today-start)/86400000)*planningZoomDayWidth()-scroller.clientWidth/2);scroller.scrollLeft=left;document.querySelectorAll('.planning-gantt-row .planning-gantt-timeline').forEach(el=>el.parentElement?.querySelector('.planning-gantt-timeline'));const bodyScrollers=document.querySelectorAll('.planning-gantt-timeline');bodyScrollers.forEach(el=>{el.style.transform=`translateX(${-scroller.scrollLeft}px)`;});
}

// Sincroniza el scroll del encabezado con las líneas de tiempo de cada fila.
function syncPlanningGanttScroll() {
  const scroller=document.getElementById('planningGanttTimelineScroll');if(!scroller)return;
  scroller.addEventListener('scroll',()=>{const x=scroller.scrollLeft;document.querySelectorAll('.planning-gantt-row .planning-gantt-timeline').forEach(el=>{el.style.transform=`translateX(${-x}px)`;});});
}


// ============================================================
// ETAPA 17B · PENDIENTES Y SEGUIMIENTO TIPO TICKET
// ============================================================

function planningTaskFormMessage(message='',type='error') {
  const el=document.getElementById('planningTaskFormMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function planningTaskRescheduleMessage(message='',type='error') {
  const el=document.getElementById('planningTaskRescheduleMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function planningProfileDisplayName(profile) {
  if (!profile) return '';
  if (profile.nombre) return String(profile.nombre).trim();
  return [profile.apellidos,profile.nombres].filter(Boolean).join(' ').trim();
}

function planningTaskStatusLabel(value) {
  return {
    PENDIENTE:'PENDIENTE',
    EN_PROCESO:'EN PROCESO',
    EN_ESPERA:'EN ESPERA',
    COMPLETADO:'COMPLETADO',
    CANCELADO:'CANCELADO'
  }[value] || value || '—';
}

function planningTaskCategoryLabel(value) {
  return {
    PERSONAL:'Personal',SIG:'SIG',SST:'SST',AMBIENTAL:'Ambiental',CALIDAD:'Calidad',
    AUDITORIA:'Auditoría',CLIENTE:'Cliente',OPERACIONES:'Operaciones',COMITE_SST:'Comité SST',
    CAPACITACION:'Capacitación',INDICADORES:'Indicadores',OTRO:'Otro'
  }[value] || value || '—';
}

function planningTaskOriginLabel(value) {
  return {
    PERSONAL:'Personal',GANTT:'Gantt / proyecto',COMITE_SST:'Comité SST',
    CAPACITACION:'Capacitación',AUDITORIA:'Auditoría',INDICADORES:'Indicadores',
    CLIENTE:'Cliente',PROYECTO:'Proyecto',OTRO:'Otro'
  }[value] || value || '—';
}

function planningTaskDateTime(task) {
  if (!task?.fecha_objetivo) return null;
  const time=task.hora_objetivo ? String(task.hora_objetivo).slice(0,5) : '23:59';
  const d=new Date(`${task.fecha_objetivo}T${time}:00`);
  return Number.isNaN(d.getTime())?null:d;
}

function planningTaskSituation(task) {
  if (!task) return {code:'PENDIENTE',label:'Pendiente'};
  if (task.estado==='COMPLETADO') return {code:'COMPLETADO',label:'Completado'};
  if (task.estado==='CANCELADO') return {code:'CANCELADO',label:'Cancelado'};

  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const dueDate=planningParseDate(task.fecha_objetivo);
  const dueDateTime=planningTaskDateTime(task);

  if (dueDateTime && dueDateTime<now) {
    const diffMs=now-dueDateTime;
    const hours=Math.floor(diffMs/3600000);
    const days=Math.floor(diffMs/86400000);
    const label=days>=1?`Vencido hace ${days} día(s)`:`Vencido hace ${Math.max(1,hours)} h`;
    return {code:'VENCIDO',label};
  }

  if (dueDate && dueDate.getTime()===today.getTime()) {
    return {code:'HOY',label:task.hora_objetivo?`Hoy · ${String(task.hora_objetivo).slice(0,5)}`:'Hoy'};
  }

  if (task.estado==='EN_ESPERA') {
    return {code:'EN_ESPERA',label:'En espera'};
  }

  if (dueDate) {
    const diff=Math.ceil((dueDate-today)/86400000);
    if (diff===1) return {code:'MANANA',label:'Mañana'};
    if (diff>1 && diff<=7) return {code:'PROXIMO',label:`En ${diff} días`};
  }

  return {code:'PROGRAMADO',label:'Programado'};
}

function planningTaskPriorityRank(value) {
  return {CRITICA:0,ALTA:1,MEDIA:2,BAJA:3}[value] ?? 9;
}

function planningTaskSortRows(rows) {
  return [...rows].sort((a,b)=>{
    const aSituation=planningTaskSituation(a).code;
    const bSituation=planningTaskSituation(b).code;
    const urgency={VENCIDO:0,HOY:1,EN_ESPERA:2,MANANA:3,PROXIMO:4,PROGRAMADO:5,COMPLETADO:8,CANCELADO:9};
    const au=urgency[aSituation] ?? 7;
    const bu=urgency[bSituation] ?? 7;
    if (au!==bu) return au-bu;

    const ap=planningTaskPriorityRank(a.prioridad);
    const bp=planningTaskPriorityRank(b.prioridad);
    if (ap!==bp) return ap-bp;

    const ad=planningTaskDateTime(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bd=planningTaskDateTime(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return ad-bd;
  });
}

function planningTaskCanManage(task) {
  if (!task || !currentProfile) return false;
  if (currentProfile.rol_codigo==='ADMIN') return true;
  if (task.created_by===currentProfile.id || task.asignado_a_profile_id===currentProfile.id) return true;
  if (currentProfile.rol_codigo==='GERENCIA') return false;
  return true; // La autorización efectiva permanece protegida por RLS.
}

function planningTaskCanDelete(task) {
  if (!task || !currentProfile) return false;
  return currentProfile.rol_codigo==='ADMIN' || task.created_by===currentProfile.id;
}

function planningTaskOperationalProjectName(task) {
  return task?.proyecto_id ? planningOperationalProjectName(task.proyecto_id) : 'Corporativo / sin vínculo';
}

function planningTaskPlanningProjectName(task) {
  const p=planningProjects.find(x=>x.id===task?.planificacion_proyecto_id);
  return p ? `${p.codigo || ''} · ${p.nombre}` : '';
}

function planningTaskPlanningActivityName(task) {
  const a=planningActivities.find(x=>x.id===task?.planificacion_actividad_id);
  return a?.nombre || '';
}

function planningTaskWeekBounds(date=new Date()) {
  const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  const day=d.getDay() || 7;
  const start=new Date(d);
  start.setDate(d.getDate()-day+1);
  const end=new Date(start);
  end.setDate(start.getDate()+6);
  return {start,end};
}

function planningTaskMatchesPeriod(task,period=planningTaskPeriod) {
  if (period==='ALL') return true;
  const due=planningParseDate(task.fecha_objetivo);
  if (!due) return false;

  const today=new Date();
  today.setHours(0,0,0,0);
  const terminal=['COMPLETADO','CANCELADO'].includes(task.estado);

  if (period==='TODAY') {
    return due.getTime()===today.getTime() || (!terminal && due<today);
  }

  if (period==='WEEK') {
    const {start,end}=planningTaskWeekBounds(today);
    return (due>=start && due<=end) || (!terminal && due<start);
  }

  if (period==='MONTH') {
    const start=new Date(today.getFullYear(),today.getMonth(),1);
    const end=new Date(today.getFullYear(),today.getMonth()+1,0);
    return (due>=start && due<=end) || (!terminal && due<start);
  }

  return true;
}

function planningTaskOwnershipMatch(task,mode) {
  if (!currentProfile) return true;
  if (mode==='ALL') return true;
  if (mode==='CREATED') {
    return task.created_by===currentProfile.id && task.asignado_a_profile_id!==currentProfile.id;
  }
  return task.asignado_a_profile_id===currentProfile.id
    || (!task.asignado_a_profile_id && task.created_by===currentProfile.id);
}

function populatePlanningTaskAssignees(selectedId=null,responsibleName='') {
  const select=document.getElementById('planningTaskAssignee');
  if (!select) return;

  const me=planningAssignableUsers.find(x=>x.id===currentProfile?.id);
  const rows=planningAssignableUsers
    .filter(x=>x.id!==currentProfile?.id)
    .map(x=>`<option value="${x.id}">${escapeHtml(x.nombre || 'Usuario')}${x.cargo?` · ${escapeHtml(x.cargo)}`:''}</option>`)
    .join('');

  select.innerHTML=
    `${currentProfile?.id?`<option value="${currentProfile.id}">Yo mismo${me?.nombre?` · ${escapeHtml(me.nombre)}`:''}</option>`:''}`+
    rows+
    '<option value="MANUAL">Responsable sin usuario del sistema</option>';

  if (selectedId && [...select.options].some(o=>o.value===selectedId)) {
    select.value=selectedId;
  } else if (!selectedId && responsibleName && currentProfile && responsibleName!==planningProfileDisplayName(currentProfile)) {
    select.value='MANUAL';
  } else if (currentProfile?.id) {
    select.value=currentProfile.id;
  } else {
    select.value='MANUAL';
  }

  document.getElementById('planningTaskAssigneeManual').value=
    select.value==='MANUAL' ? (responsibleName || '') : '';
  togglePlanningTaskManualAssignee();
}

function togglePlanningTaskManualAssignee() {
  const manual=document.getElementById('planningTaskAssignee')?.value==='MANUAL';
  document.getElementById('planningTaskManualAssigneeField')?.classList.toggle('hidden',!manual);
}

function populatePlanningTaskOperationalProjects() {
  const select=document.getElementById('planningTaskOperationalProject');
  if (!select) return;
  const current=select.value;
  select.innerHTML='<option value="">Ninguno / corporativo</option>'+
    planningOperationalProjects.filter(x=>x.activo!==false).map(p=>
      `<option value="${p.id}">${escapeHtml(p.nombre)}${p.cliente?` · ${escapeHtml(p.cliente)}`:''}</option>`
    ).join('');
  if ([...select.options].some(o=>o.value===current)) select.value=current;
}

function populatePlanningTaskPlanningProjects() {
  const select=document.getElementById('planningTaskPlanningProject');
  if (!select) return;
  const current=select.value;
  select.innerHTML='<option value="">Ninguno</option>'+
    planningProjects.filter(x=>!['CANCELADO'].includes(x.estado)).map(p=>
      `<option value="${p.id}">${escapeHtml(p.codigo || '')} · ${escapeHtml(p.nombre)}</option>`
    ).join('');
  if ([...select.options].some(o=>o.value===current)) select.value=current;
}

function populatePlanningTaskActivities(projectId,selectedId=null) {
  const select=document.getElementById('planningTaskPlanningActivity');
  if (!select) return;
  const rows=projectId
    ? planningActivitiesFor(projectId).filter(x=>x.estado!=='CANCELADO')
    : [];

  select.innerHTML='<option value="">Ninguna</option>'+rows.map(a=>
    `<option value="${a.id}">${a.tipo==='HITO'?'◆ ':''}${escapeHtml(a.nombre)}</option>`
  ).join('');

  if (selectedId && [...select.options].some(o=>o.value===selectedId)) {
    select.value=selectedId;
  }
}

function updatePlanningTaskWaitingFields() {
  const waiting=document.getElementById('planningTaskStatus')?.value==='EN_ESPERA';
  document.getElementById('planningTaskWaitingFields')?.classList.toggle('hidden',!waiting);
}

function updatePlanningTaskStats() {
  const rows=planningTaskRecords.filter(x=>x.estado!=='CANCELADO');
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const {start:weekStart,end:weekEnd}=planningTaskWeekBounds(today);

  const overdue=rows.filter(x=>planningTaskSituation(x).code==='VENCIDO').length;
  const todayCount=rows.filter(x=>
    !['COMPLETADO'].includes(x.estado)
    && planningParseDate(x.fecha_objetivo)?.getTime()===today.getTime()
  ).length;
  const inProgress=rows.filter(x=>x.estado==='EN_PROCESO').length;
  const waiting=rows.filter(x=>x.estado==='EN_ESPERA').length;

  const completedWeek=rows.filter(x=>{
    if (x.estado!=='COMPLETADO' || !x.completado_at) return false;
    const d=new Date(x.completado_at);
    return d>=weekStart && d<planningAddDays(weekEnd,1);
  }).length;

  const dueWeek=rows.filter(x=>{
    const d=planningParseDate(x.fecha_objetivo);
    return d && d>=weekStart && d<=weekEnd;
  });
  const dueWeekCompleted=dueWeek.filter(x=>x.estado==='COMPLETADO').length;
  const compliance=dueWeek.length?Math.round((dueWeekCompleted/dueWeek.length)*100):0;

  const map={
    planningTaskOverdueCount:overdue,
    planningTaskTodayCount:todayCount,
    planningTaskInProgressCount:inProgress,
    planningTaskWaitingCount:waiting,
    planningTaskCompletedWeekCount:completedWeek,
    planningTaskWeeklyCompliance:`${compliance}%`
  };

  Object.entries(map).forEach(([id,value])=>{
    const el=document.getElementById(id);
    if (el) el.textContent=String(value);
  });
}

function planningTaskNextCandidate() {
  if (!currentProfile) return null;

  const today=planningIsoDate(new Date());
  const candidates=planningTaskRecords.filter(task=>{
    if (['COMPLETADO','CANCELADO'].includes(task.estado)) return false;
    const mine=task.asignado_a_profile_id===currentProfile.id
      || (!task.asignado_a_profile_id && task.created_by===currentProfile.id);
    if (!mine) return false;

    if (task.estado==='EN_ESPERA') {
      return !!task.fecha_seguimiento && task.fecha_seguimiento<=today;
    }
    return true;
  });

  return planningTaskSortRows(candidates)[0] || null;
}

function renderPlanningNextTask() {
  const next=planningTaskNextCandidate();
  const code=document.getElementById('planningNextTaskCode');
  const title=document.getElementById('planningNextTaskTitle');
  const meta=document.getElementById('planningNextTaskMeta');
  const button=document.getElementById('planningAttendNextButton');

  if (!code || !title || !meta || !button) return;

  if (!next) {
    code.textContent='—';
    title.textContent='No hay pendientes por atender';
    meta.textContent='Tu bandeja está al día.';
    button.disabled=true;
    button.dataset.taskId='';
    return;
  }

  const situation=planningTaskSituation(next);
  code.textContent=next.codigo || 'TK';
  title.textContent=next.titulo || 'Pendiente';
  meta.textContent=[
    planningPriorityLabel(next.prioridad),
    situation.label,
    next.responsable_nombre,
    next.hora_objetivo?`Hora ${String(next.hora_objetivo).slice(0,5)}`:''
  ].filter(Boolean).join(' · ');
  button.disabled=false;
  button.dataset.taskId=next.id;
  button.textContent=next.estado==='EN_PROCESO'?'Continuar atención':'Atender siguiente';
}

function planningTaskPeriodLabel() {
  return {
    TODAY:'Pendientes de hoy',
    WEEK:'Pendientes de la semana',
    MONTH:'Pendientes del mes',
    ALL:'Todos los pendientes'
  }[planningTaskPeriod] || 'Pendientes';
}

function renderPlanningTaskList() {
  const container=document.getElementById('planningTaskList');
  if (!container) return;

  const q=(document.getElementById('planningTaskSearch')?.value || '').trim().toLowerCase();
  const ownership=document.getElementById('planningTaskOwnershipFilter')?.value || 'MINE';
  const status=document.getElementById('planningTaskStatusFilter')?.value || 'ALL';
  const priority=document.getElementById('planningTaskPriorityFilter')?.value || 'ALL';
  const category=document.getElementById('planningTaskCategoryFilter')?.value || 'ALL';

  let rows=planningTaskRecords.filter(task=>{
    if (!planningTaskMatchesPeriod(task)) return false;
    if (!planningTaskOwnershipMatch(task,ownership)) return false;
    if (status!=='ALL' && task.estado!==status) return false;
    if (priority!=='ALL' && task.prioridad!==priority) return false;
    if (category!=='ALL' && task.categoria!==category) return false;

    const hay=[
      task.codigo,task.titulo,task.descripcion,task.responsable_nombre,
      planningTaskOperationalProjectName(task),
      planningTaskPlanningProjectName(task),
      planningTaskPlanningActivityName(task),
      task.esperando_de,task.categoria,task.origen
    ].filter(Boolean).join(' ').toLowerCase();

    return !q || hay.includes(q);
  });

  rows=planningTaskSortRows(rows);

  const resultCount=document.getElementById('planningTaskResultCount');
  if (resultCount) resultCount.textContent=`${rows.length} pendiente${rows.length===1?'':'s'}`;
  const periodTitle=document.getElementById('planningTaskPeriodTitle');
  if (periodTitle) periodTitle.textContent=planningTaskPeriodLabel();

  if (!rows.length) {
    container.innerHTML='<div class="training-library-empty">No se encontraron pendientes para esta vista.</div>';
    return;
  }

  container.innerHTML=rows.map(task=>{
    const situation=planningTaskSituation(task);
    const canManage=planningTaskCanManage(task);
    const canDelete=planningTaskCanDelete(task);
    const planName=planningTaskPlanningProjectName(task);
    const activityName=planningTaskPlanningActivityName(task);
    const waiting=task.estado==='EN_ESPERA';

    return `
      <article class="planning-ticket-card ${situation.code.toLowerCase()}">
        <div class="planning-ticket-code">
          <span>${escapeHtml(task.codigo || 'TK')}</span>
          <small>${escapeHtml(planningTaskCategoryLabel(task.categoria))}</small>
        </div>

        <div class="planning-ticket-main">
          <div class="planning-ticket-top">
            <div>
              <div class="planning-ticket-badges">
                <span class="planning-ticket-priority ${String(task.prioridad||'').toLowerCase()}">${escapeHtml(planningPriorityLabel(task.prioridad))}</span>
                <span class="planning-ticket-status ${String(task.estado||'').toLowerCase()}">${escapeHtml(planningTaskStatusLabel(task.estado))}</span>
                <span class="planning-ticket-situation ${situation.code.toLowerCase()}">${escapeHtml(situation.label)}</span>
              </div>
              <h4>${escapeHtml(task.titulo || 'Pendiente')}</h4>
              ${task.descripcion?`<p>${escapeHtml(task.descripcion)}</p>`:''}
            </div>
          </div>

          <div class="planning-ticket-meta">
            <span>Responsable: <strong>${escapeHtml(task.responsable_nombre || '—')}</strong></span>
            <span>Fecha: <strong>${escapeHtml(formatDatePE(task.fecha_objetivo))}</strong>${task.hora_objetivo?` · ${escapeHtml(String(task.hora_objetivo).slice(0,5))}`:''}</span>
            <span>Origen: ${escapeHtml(planningTaskOriginLabel(task.origen))}</span>
            ${task.proyecto_id?`<span>${escapeHtml(planningTaskOperationalProjectName(task))}</span>`:''}
            ${planName?`<span>Gantt: ${escapeHtml(planName)}</span>`:''}
            ${activityName?`<span>Actividad: ${escapeHtml(activityName)}</span>`:''}
          </div>

          ${waiting?`
            <div class="planning-ticket-waiting">
              <strong>En espera de:</strong> ${escapeHtml(task.esperando_de || 'tercero')}
              ${task.fecha_seguimiento?` · Próximo seguimiento: ${escapeHtml(formatDatePE(task.fecha_seguimiento))}`:''}
              ${task.motivo_espera?`<small>${escapeHtml(task.motivo_espera)}</small>`:''}
            </div>
          `:''}
        </div>

        <div class="planning-ticket-actions">
          ${canManage && task.estado==='PENDIENTE'?`<button class="task-action-start" type="button" data-task-start="${task.id}">Iniciar</button>`:''}
          ${canManage && ['PENDIENTE','EN_PROCESO'].includes(task.estado)?`<button class="task-action-wait" type="button" data-task-wait="${task.id}">En espera</button>`:''}
          ${canManage && !['COMPLETADO','CANCELADO'].includes(task.estado)?`<button class="task-action-reschedule" type="button" data-task-reschedule="${task.id}">Reprogramar</button>`:''}
          ${canManage && !['COMPLETADO','CANCELADO'].includes(task.estado)?`<button class="task-action-complete" type="button" data-task-complete="${task.id}">Completar</button>`:''}
          <button class="secondary-btn small-btn" type="button" data-task-edit="${task.id}">${canManage?'Editar':'Ver'}</button>
          ${canDelete?`<button class="induction-delete-btn small-btn" type="button" data-task-delete="${task.id}">Eliminar</button>`:''}
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('[data-task-start]').forEach(button=>{
    button.addEventListener('click',()=>quickUpdatePlanningTask(button.dataset.taskStart,'EN_PROCESO','Atención iniciada desde la bandeja.'));
  });

  container.querySelectorAll('[data-task-wait]').forEach(button=>{
    button.addEventListener('click',()=>{
      const task=planningTaskRecords.find(x=>x.id===button.dataset.taskWait);
      openPlanningTaskModal(task);
      document.getElementById('planningTaskStatus').value='EN_ESPERA';
      updatePlanningTaskWaitingFields();
      setTimeout(()=>document.getElementById('planningTaskWaitingFor')?.focus(),50);
    });
  });

  container.querySelectorAll('[data-task-reschedule]').forEach(button=>{
    button.addEventListener('click',()=>openPlanningTaskRescheduleModal(button.dataset.taskReschedule));
  });

  container.querySelectorAll('[data-task-complete]').forEach(button=>{
    button.addEventListener('click',()=>completePlanningTask(button.dataset.taskComplete));
  });

  container.querySelectorAll('[data-task-edit]').forEach(button=>{
    button.addEventListener('click',()=>openPlanningTaskModal(
      planningTaskRecords.find(x=>x.id===button.dataset.taskEdit)
    ));
  });

  container.querySelectorAll('[data-task-delete]').forEach(button=>{
    button.addEventListener('click',()=>deletePlanningTask(button.dataset.taskDelete));
  });
}

async function loadPlanningTasksModule(force=false) {
  if (!client) return;

  if (planningTasksLoaded && !force) {
    updatePlanningTaskStats();
    renderPlanningNextTask();
    renderPlanningTaskList();
    return;
  }

  const [tasks,history,users]=await Promise.all([
    client.from('planificacion_pendientes')
      .select('*')
      .order('fecha_objetivo',{ascending:true})
      .order('hora_objetivo',{ascending:true}),
    client.from('planificacion_pendiente_historial')
      .select('*')
      .order('changed_at',{ascending:false}),
    client.rpc('planificacion_usuarios_asignables')
  ]);

  const error=tasks.error || history.error || users.error;
  if (error) {
    console.error(error);
    planningMessage(
      error.message || 'No fue posible cargar la bandeja de pendientes.'
    );
    return;
  }

  planningTaskRecords=tasks.data || [];
  planningTaskHistory=history.data || [];
  planningAssignableUsers=users.data || [];
  planningTasksLoaded=true;

  updatePlanningTaskStats();
  renderPlanningNextTask();
  renderPlanningTaskList();
}

function renderPlanningTaskHistory(taskId) {
  const container=document.getElementById('planningTaskHistoryList');
  if (!container) return;

  const rows=planningTaskHistory.filter(x=>x.pendiente_id===taskId);
  if (!rows.length) {
    container.innerHTML='<div class="meeting-empty-note">Todavía no existe historial adicional para este ticket.</div>';
    return;
  }

  const labels={
    CREADO:'Creado',
    EDITADO:'Editado',
    ESTADO:'Cambio de estado',
    REPROGRAMADO:'Reprogramado',
    ASIGNACION:'Asignación',
    ESPERA:'En espera',
    COMPLETADO:'Completado',
    CANCELADO:'Cancelado'
  };

  container.innerHTML=rows.map(row=>{
    const details=[];
    if (row.estado_anterior!==row.estado_nuevo && row.estado_nuevo) {
      details.push(`${planningTaskStatusLabel(row.estado_anterior)} → ${planningTaskStatusLabel(row.estado_nuevo)}`);
    }
    if (row.fecha_anterior!==row.fecha_nueva && row.fecha_nueva) {
      details.push(`${row.fecha_anterior?formatDatePE(row.fecha_anterior):'—'} → ${formatDatePE(row.fecha_nueva)}`);
    }
    if (row.hora_anterior!==row.hora_nueva && row.hora_nueva) {
      details.push(`Hora ${String(row.hora_nueva).slice(0,5)}`);
    }
    if (row.responsable_anterior!==row.responsable_nuevo && row.responsable_nuevo) {
      details.push(`Responsable: ${row.responsable_nuevo}`);
    }

    return `
      <article class="planning-task-history-item">
        <span class="planning-task-history-dot"></span>
        <div>
          <strong>${escapeHtml(labels[row.evento] || row.evento || 'Actualización')}</strong>
          ${details.length?`<p>${escapeHtml(details.join(' · '))}</p>`:''}
          ${row.detalle?`<p>${escapeHtml(row.detalle)}</p>`:''}
          <small>${row.changed_at?new Date(row.changed_at).toLocaleString('es-PE'):'—'}</small>
        </div>
      </article>
    `;
  }).join('');
}

function openPlanningTaskModal(task=null) {
  activePlanningTaskId=task?.id || null;
  planningTaskFormMessage('');

  populatePlanningTaskOperationalProjects();
  populatePlanningTaskPlanningProjects();

  document.getElementById('planningTaskId').value=task?.id || '';
  document.getElementById('planningTaskModalTitle').textContent=task?'Editar pendiente':'Nuevo pendiente';
  document.getElementById('planningTaskModalSubtitle').textContent=
    task ? `${task.codigo || ''} · ${planningTaskStatusLabel(task.estado)}` : 'Registra el ticket, responsable y fecha de atención.';

  document.getElementById('planningTaskTitle').value=task?.titulo || '';
  document.getElementById('planningTaskCategory').value=task?.categoria || 'SIG';
  document.getElementById('planningTaskOrigin').value=task?.origen || 'PERSONAL';
  document.getElementById('planningTaskPriority').value=task?.prioridad || 'MEDIA';
  document.getElementById('planningTaskStatus').value=task?.estado || 'PENDIENTE';
  document.getElementById('planningTaskDueDate').value=task?.fecha_objetivo || planningIsoDate(new Date());
  document.getElementById('planningTaskDueTime').value=task?.hora_objetivo ? String(task.hora_objetivo).slice(0,5) : '';
  document.getElementById('planningTaskOperationalProject').value=task?.proyecto_id || '';
  document.getElementById('planningTaskPlanningProject').value=task?.planificacion_proyecto_id || '';
  populatePlanningTaskActivities(task?.planificacion_proyecto_id || '',task?.planificacion_actividad_id || null);

  document.getElementById('planningTaskWaitingFor').value=task?.esperando_de || '';
  document.getElementById('planningTaskFollowupDate').value=task?.fecha_seguimiento || '';
  document.getElementById('planningTaskWaitingReason').value=task?.motivo_espera || '';
  document.getElementById('planningTaskDescription').value=task?.descripcion || '';
  document.getElementById('planningTaskNotes').value=task?.observaciones || '';

  const taskReminderMinutes=Array.isArray(task?.recordatorios_minutos)
    ? task.recordatorios_minutos.map(Number)
    : [...(planningReminderPreferences.minutos_default || [60,30,10,0])];

  document.getElementById('planningTaskRemindersEnabled').checked=task?.recordatorios_habilitados ?? true;
  [60,30,10,0].forEach(minutes=>{
    const el=document.getElementById(`planningTaskReminder${minutes}`);
    if (el) el.checked=taskReminderMinutes.includes(minutes);
  });
  updatePlanningTaskReminderOptions();

  populatePlanningTaskAssignees(task?.asignado_a_profile_id || null,task?.responsable_nombre || '');
  updatePlanningTaskWaitingFields();

  const canManage=task ? planningTaskCanManage(task) : true;
  document.querySelectorAll('#planningTaskForm input,#planningTaskForm textarea,#planningTaskForm select').forEach(el=>{
    if (el.id!=='planningTaskId') el.disabled=!canManage;
  });
  document.getElementById('planningTaskSave')?.classList.toggle('hidden',!canManage);
  document.getElementById('planningTaskDeleteButton')?.classList.toggle('hidden',!task || !planningTaskCanDelete(task));

  const historySection=document.getElementById('planningTaskHistorySection');
  historySection?.classList.toggle('hidden',!task);
  if (task) renderPlanningTaskHistory(task.id);

  const modal=document.getElementById('planningTaskModal');
  modal?.classList.remove('hidden');
  modal?.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closePlanningTaskModal() {
  document.getElementById('planningTaskModal')?.classList.add('hidden');
  document.getElementById('planningTaskModal')?.setAttribute('aria-hidden','true');
  activePlanningTaskId=null;
  document.body.classList.remove('modal-open');
}

function selectedPlanningTaskAssignee() {
  const value=document.getElementById('planningTaskAssignee')?.value || 'MANUAL';

  if (value==='MANUAL') {
    return {
      id:null,
      name:document.getElementById('planningTaskAssigneeManual')?.value.trim() || ''
    };
  }

  const user=planningAssignableUsers.find(x=>x.id===value);
  if (user) return {id:user.id,name:user.nombre || 'Usuario'};

  if (value===currentProfile?.id) {
    return {id:currentProfile.id,name:planningProfileDisplayName(currentProfile) || 'Usuario'};
  }

  return {id:null,name:''};
}

async function savePlanningTask(event) {
  event.preventDefault();
  planningTaskFormMessage('');

  const id=document.getElementById('planningTaskId').value || null;
  const assignee=selectedPlanningTaskAssignee();
  const estado=document.getElementById('planningTaskStatus').value;

  const payload={
    titulo:document.getElementById('planningTaskTitle').value.trim(),
    descripcion:document.getElementById('planningTaskDescription').value.trim() || null,
    categoria:document.getElementById('planningTaskCategory').value,
    origen:document.getElementById('planningTaskOrigin').value,
    prioridad:document.getElementById('planningTaskPriority').value,
    estado,
    asignado_a_profile_id:assignee.id,
    responsable_nombre:assignee.name,
    fecha_objetivo:document.getElementById('planningTaskDueDate').value,
    hora_objetivo:document.getElementById('planningTaskDueTime').value || null,
    esperando_de:estado==='EN_ESPERA' ? (document.getElementById('planningTaskWaitingFor').value.trim() || null) : null,
    motivo_espera:estado==='EN_ESPERA' ? (document.getElementById('planningTaskWaitingReason').value.trim() || null) : null,
    fecha_seguimiento:estado==='EN_ESPERA' ? (document.getElementById('planningTaskFollowupDate').value || null) : null,
    proyecto_id:document.getElementById('planningTaskOperationalProject').value || null,
    planificacion_proyecto_id:document.getElementById('planningTaskPlanningProject').value || null,
    planificacion_actividad_id:document.getElementById('planningTaskPlanningActivity').value || null,
    observaciones:document.getElementById('planningTaskNotes').value.trim() || null,
    recordatorios_habilitados:document.getElementById('planningTaskRemindersEnabled')?.checked ?? true,
    recordatorios_minutos:[60,30,10,0].filter(minutes=>
      document.getElementById(`planningTaskReminder${minutes}`)?.checked
    ),
    pospuesto_hasta:null,
    ultimo_motivo_cambio:id ? 'Datos del pendiente actualizados.' : 'Pendiente creado desde Planificación.'
  };

  if (!payload.titulo || !payload.responsable_nombre || !payload.fecha_objetivo) {
    planningTaskFormMessage('Completa pendiente, responsable y fecha objetivo.');
    return;
  }

  if (estado==='EN_ESPERA' && !payload.esperando_de) {
    planningTaskFormMessage('Indica de quién o de qué área estás esperando una respuesta o acción.');
    return;
  }

  const button=document.getElementById('planningTaskSave');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Guardando…';

  const result=id
    ? await client.from('planificacion_pendientes').update(payload).eq('id',id).select().single()
    : await client.from('planificacion_pendientes').insert({
        ...payload,
        created_by:currentProfile?.id || undefined
      }).select().single();

  button.disabled=false;
  button.textContent=old;

  if (result.error) {
    console.error(result.error);
    planningTaskFormMessage(result.error.message || 'No fue posible guardar el pendiente.');
    return;
  }

  closePlanningTaskModal();
  planningTasksLoaded=false;
  await loadPlanningTasksModule(true);
  planningMessage(id?'Pendiente actualizado correctamente.':'Pendiente creado correctamente.','success');
}

async function quickUpdatePlanningTask(id,status,reason) {
  const task=planningTaskRecords.find(x=>x.id===id);
  if (!task || !planningTaskCanManage(task)) return;

  const payload={
    estado:status,
    ultimo_motivo_cambio:reason || `Estado actualizado a ${planningTaskStatusLabel(status)}.`
  };

  if (status!=='EN_ESPERA') {
    payload.esperando_de=null;
    payload.motivo_espera=null;
    payload.fecha_seguimiento=null;
  }

  const {error}=await client.from('planificacion_pendientes').update(payload).eq('id',id);
  if (error) {
    planningMessage(error.message || 'No fue posible actualizar el pendiente.');
    return;
  }

  planningTasksLoaded=false;
  await loadPlanningTasksModule(true);
}

async function completePlanningTask(id) {
  const task=planningTaskRecords.find(x=>x.id===id);
  if (!task || !planningTaskCanManage(task)) return;
  if (!confirm(`¿Marcar como COMPLETADO el ticket ${task.codigo || ''}?\n\n${task.titulo}`)) return;

  await quickUpdatePlanningTask(id,'COMPLETADO','Pendiente completado desde la bandeja de trabajo.');
  planningMessage('Pendiente completado.','success');
}

function openPlanningTaskRescheduleModal(id) {
  const task=planningTaskRecords.find(x=>x.id===id);
  if (!task || !planningTaskCanManage(task)) return;

  planningTaskRescheduleMessage('');
  document.getElementById('planningTaskRescheduleId').value=task.id;
  document.getElementById('planningTaskRescheduleTitle').textContent=`Reprogramar · ${task.codigo || ''}`;
  document.getElementById('planningTaskRescheduleDate').value=task.fecha_objetivo || planningIsoDate(new Date());
  document.getElementById('planningTaskRescheduleTime').value=task.hora_objetivo ? String(task.hora_objetivo).slice(0,5) : '';
  document.getElementById('planningTaskRescheduleReason').value='';

  const modal=document.getElementById('planningTaskRescheduleModal');
  modal?.classList.remove('hidden');
  modal?.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closePlanningTaskRescheduleModal() {
  document.getElementById('planningTaskRescheduleModal')?.classList.add('hidden');
  document.getElementById('planningTaskRescheduleModal')?.setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
}

async function savePlanningTaskReschedule() {
  const id=document.getElementById('planningTaskRescheduleId').value;
  const task=planningTaskRecords.find(x=>x.id===id);
  if (!task || !planningTaskCanManage(task)) return;

  const date=document.getElementById('planningTaskRescheduleDate').value;
  const time=document.getElementById('planningTaskRescheduleTime').value || null;
  const reason=document.getElementById('planningTaskRescheduleReason').value.trim();

  if (!date || !reason) {
    planningTaskRescheduleMessage('Completa la nueva fecha y el motivo de reprogramación.');
    return;
  }

  const button=document.getElementById('planningTaskRescheduleSave');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Reprogramando…';

  const {error}=await client.from('planificacion_pendientes').update({
    fecha_objetivo:date,
    hora_objetivo:time,
    ultimo_motivo_cambio:reason
  }).eq('id',id);

  button.disabled=false;
  button.textContent=old;

  if (error) {
    planningTaskRescheduleMessage(error.message || 'No fue posible reprogramar.');
    return;
  }

  closePlanningTaskRescheduleModal();
  planningTasksLoaded=false;
  await loadPlanningTasksModule(true);
  planningMessage('Pendiente reprogramado. El cambio quedó registrado en la trazabilidad.','success');
}

async function deletePlanningTask(id) {
  const task=planningTaskRecords.find(x=>x.id===id);
  if (!task || !planningTaskCanDelete(task)) return;

  if (!confirm(`¿Eliminar definitivamente ${task.codigo || 'este ticket'}?\n\n${task.titulo}`)) return;

  const {error}=await client.from('planificacion_pendientes').delete().eq('id',id);
  if (error) {
    planningTaskFormMessage(error.message || 'No fue posible eliminar el pendiente.');
    return;
  }

  closePlanningTaskModal();
  planningTasksLoaded=false;
  await loadPlanningTasksModule(true);
  planningMessage('Pendiente eliminado.','success');
}

function syncPlanningTaskFromActivity() {
  const activityId=document.getElementById('planningTaskPlanningActivity')?.value;
  if (!activityId) return;

  const activity=planningActivities.find(x=>x.id===activityId);
  if (!activity) return;

  const title=document.getElementById('planningTaskTitle');
  const due=document.getElementById('planningTaskDueDate');
  if (title && !title.value.trim()) title.value=activity.nombre || '';
  if (due && !due.value) due.value=activity.fecha_fin || activity.fecha_inicio || '';
  document.getElementById('planningTaskOrigin').value='GANTT';

  if (activity.responsable_nombre && !document.getElementById('planningTaskAssigneeManual').value) {
    const match=planningAssignableUsers.find(x=>
      String(x.nombre || '').trim().toLowerCase()===String(activity.responsable_nombre || '').trim().toLowerCase()
    );

    if (match) {
      document.getElementById('planningTaskAssignee').value=match.id;
    } else {
      document.getElementById('planningTaskAssignee').value='MANUAL';
      document.getElementById('planningTaskAssigneeManual').value=activity.responsable_nombre;
    }
    togglePlanningTaskManualAssignee();
  }
}

async function attendNextPlanningTask() {
  const id=document.getElementById('planningAttendNextButton')?.dataset.taskId;
  const task=planningTaskRecords.find(x=>x.id===id);
  if (!task) return;

  if (task.estado==='PENDIENTE') {
    const {error}=await client.from('planificacion_pendientes').update({
      estado:'EN_PROCESO',
      ultimo_motivo_cambio:'Atención iniciada desde “Siguiente pendiente”.'
    }).eq('id',task.id);

    if (error) {
      planningMessage(error.message || 'No fue posible iniciar el pendiente.');
      return;
    }

    planningTasksLoaded=false;
    await loadPlanningTasksModule(true);
  }

  openPlanningTaskModal(planningTaskRecords.find(x=>x.id===task.id) || task);
}


// Eventos 17A
document.getElementById('planningProjectsTab')?.addEventListener('click',()=>switchPlanningTab('PROJECTS'));
document.getElementById('planningTasksTab')?.addEventListener('click',()=>switchPlanningTab('TASKS'));
document.getElementById('planningNewProjectButton')?.addEventListener('click',()=>{
  if (planningModuleTab==='TASKS') openPlanningTaskModal();
  else openPlanningProjectModal();
});
document.getElementById('planningProjectForm')?.addEventListener('submit',savePlanningProject);
document.getElementById('planningProjectModalClose')?.addEventListener('click',closePlanningProjectModal);
document.getElementById('planningProjectCancel')?.addEventListener('click',closePlanningProjectModal);
document.getElementById('planningProjectModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closePlanningProjectModal);
document.getElementById('planningBackButton')?.addEventListener('click',showPlanningPortfolio);
document.getElementById('planningEditProjectButton')?.addEventListener('click',()=>openPlanningProjectModal(planningProjects.find(x=>x.id===activePlanningProjectId)));
document.getElementById('planningDeleteProjectButton')?.addEventListener('click',deletePlanningProject);
document.getElementById('planningAddActivityButton')?.addEventListener('click',()=>openPlanningActivityModal());
document.getElementById('planningActivityForm')?.addEventListener('submit',savePlanningActivity);
document.getElementById('planningActivityModalClose')?.addEventListener('click',closePlanningActivityModal);
document.getElementById('planningActivityCancel')?.addEventListener('click',closePlanningActivityModal);
document.getElementById('planningActivityModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closePlanningActivityModal);
document.getElementById('planningActivityType')?.addEventListener('change',updatePlanningActivityTypeFields);
document.getElementById('planningActivityStart')?.addEventListener('change',()=>{if(document.getElementById('planningActivityType')?.value==='HITO')document.getElementById('planningActivityEnd').value=document.getElementById('planningActivityStart').value;});
document.getElementById('planningActivityProgress')?.addEventListener('input',e=>{const v=Number(e.target.value||0);if(v>=100)document.getElementById('planningActivityStatus').value='COMPLETADO';else if(v>0&&document.getElementById('planningActivityStatus').value==='PENDIENTE')document.getElementById('planningActivityStatus').value='EN_PROCESO';});
document.querySelectorAll('[data-planning-detail-view]').forEach(b=>b.addEventListener('click',()=>switchPlanningDetailView(b.dataset.planningDetailView)));
document.querySelectorAll('[data-gantt-zoom]').forEach(b=>b.addEventListener('click',()=>{planningGanttZoom=b.dataset.ganttZoom;document.querySelectorAll('[data-gantt-zoom]').forEach(x=>x.classList.toggle('active',x===b));renderPlanningGantt();setTimeout(syncPlanningGanttScroll,0);}));
document.getElementById('planningGanttTodayButton')?.addEventListener('click',()=>scrollPlanningGanttToday(true));
document.getElementById('planningSearch')?.addEventListener('input',renderPlanningProjectList);
document.getElementById('planningStatusFilter')?.addEventListener('change',renderPlanningProjectList);
document.getElementById('planningCategoryFilter')?.addEventListener('change',renderPlanningProjectList);
document.getElementById('planningYearFilter')?.addEventListener('change',renderPlanningProjectList);
document.getElementById('planningRefreshButton')?.addEventListener('click',()=>{planningLoaded=false;loadPlanningModule(true);});



// ============================================================
// ETAPA 17C.1 · RECORDATORIOS SONOROS
// ============================================================

function planningReminderSettingsMessage(message='',type='error') {
  const el=document.getElementById('planningReminderSettingsMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function updatePlanningTaskReminderOptions() {
  const enabled=document.getElementById('planningTaskRemindersEnabled')?.checked ?? true;
  const box=document.getElementById('planningTaskReminderOptions');
  box?.classList.toggle('disabled',!enabled);
  box?.querySelectorAll('input').forEach(input=>{input.disabled=!enabled;});
}

function planningReminderSeenStorage() {
  try {
    return JSON.parse(localStorage.getItem('planningReminderSeen') || '{}') || {};
  } catch {
    return {};
  }
}

function savePlanningReminderSeenStorage(value) {
  try {
    localStorage.setItem('planningReminderSeen',JSON.stringify(value || {}));
  } catch {}
}

function planningReminderKey(task,slot) {
  const due=planningTaskDateTime(task);
  return `${task.id}|${due?.toISOString() || task.fecha_objetivo}|${slot}`;
}

function planningReminderWasSeen(task,slot) {
  const store=planningReminderSeenStorage();
  return !!store[planningReminderKey(task,slot)];
}

function planningReminderMarkSeen(task,slot) {
  const store=planningReminderSeenStorage();
  store[planningReminderKey(task,slot)]=new Date().toISOString();

  // Keep local storage small.
  const entries=Object.entries(store)
    .sort((a,b)=>String(b[1]).localeCompare(String(a[1])))
    .slice(0,300);
  savePlanningReminderSeenStorage(Object.fromEntries(entries));
}

function planningReminderUnmarkSeen(task,slot) {
  const store=planningReminderSeenStorage();
  delete store[planningReminderKey(task,slot)];
  savePlanningReminderSeenStorage(store);
}

function planningReminderSelectedDefaults() {
  return [60,30,10,0].filter(minutes=>
    document.getElementById(`planningReminderDefault${minutes}`)?.checked
  );
}

function planningReminderSoundLabel(code) {
  return {
    BANCO:'Turno bancario · Tin–Ton',
    CAMPANA:'Campana corta',
    SUAVE:'Aviso suave',
    SIN_SONIDO:'Sin sonido'
  }[code] || 'Turno bancario · Tin–Ton';
}

function updatePlanningReminderStatusCard() {
  const title=document.getElementById('planningReminderStatusTitle');
  const text=document.getElementById('planningReminderStatusText');
  if (!title || !text) return;

  const enabled=planningReminderPreferences.sonido_habilitado
    && planningReminderPreferences.sonido_codigo!=='SIN_SONIDO';

  title.textContent=enabled?'Avisos sonoros activos':'Avisos sonoros desactivados';

  const minutes=(planningReminderPreferences.minutos_default || [60,30,10,0])
    .map(x=>Number(x))
    .sort((a,b)=>b-a);

  const labels=minutes.map(x=>
    x===60?'1 h'
    : x===30?'30 min'
    : x===10?'10 min'
    : x===0?'vencimiento'
    : `${x} min`
  );

  text.textContent=
    `${planningReminderSoundLabel(planningReminderPreferences.sonido_codigo)} · `+
    `${labels.length?labels.join(', '):'sin momentos predeterminados'}`;
}

async function loadPlanningReminderPreferences() {
  if (!client || !currentProfile?.id) return;

  const {data,error}=await client.from('planificacion_preferencias_usuario')
    .select('*')
    .eq('profile_id',currentProfile.id)
    .maybeSingle();

  if (error) {
    console.warn('No fue posible cargar preferencias de avisos:',error);
    updatePlanningReminderStatusCard();
    return;
  }

  if (data) {
    planningReminderPreferences={
      sonido_habilitado:data.sonido_habilitado ?? true,
      sonido_codigo:data.sonido_codigo || 'BANCO',
      volumen:Number(data.volumen ?? 0.55),
      notificacion_navegador:data.notificacion_navegador ?? false,
      minutos_default:Array.isArray(data.minutos_default)
        ? data.minutos_default.map(Number)
        : [60,30,10,0]
    };
  }

  updatePlanningReminderStatusCard();
}

function planningReminderNotificationStatusText() {
  if (!('Notification' in window)) return 'Este navegador no admite notificaciones';
  if (Notification.permission==='granted') return 'Notificaciones autorizadas';
  if (Notification.permission==='denied') return 'Notificaciones bloqueadas por el navegador';
  return 'Permiso no solicitado';
}

function updatePlanningBrowserNotificationUi() {
  const status=document.getElementById('planningBrowserNotificationStatus');
  const button=document.getElementById('planningBrowserNotificationButton');
  const check=document.getElementById('planningReminderBrowserEnabled');

  if (status) status.textContent=planningReminderNotificationStatusText();

  if (button) {
    if (!('Notification' in window)) {
      button.disabled=true;
      button.textContent='No compatible';
    } else if (Notification.permission==='granted') {
      button.disabled=true;
      button.textContent='Autorizadas ✓';
    } else if (Notification.permission==='denied') {
      button.disabled=true;
      button.textContent='Bloqueadas';
    } else {
      button.disabled=false;
      button.textContent='Autorizar notificaciones';
    }
  }

  if (check) {
    check.disabled=!('Notification' in window) || Notification.permission==='denied';
  }
}

function openPlanningReminderSettings() {
  planningReminderSettingsMessage('');

  document.getElementById('planningReminderSoundEnabled').checked=
    planningReminderPreferences.sonido_habilitado ?? true;
  document.getElementById('planningReminderSoundType').value=
    planningReminderPreferences.sonido_codigo || 'BANCO';

  const volume=Math.round(Number(planningReminderPreferences.volumen ?? 0.55)*100);
  document.getElementById('planningReminderVolume').value=String(volume);
  document.getElementById('planningReminderVolumeLabel').textContent=`${volume}%`;

  const defaults=(planningReminderPreferences.minutos_default || [60,30,10,0]).map(Number);
  [60,30,10,0].forEach(minutes=>{
    const el=document.getElementById(`planningReminderDefault${minutes}`);
    if (el) el.checked=defaults.includes(minutes);
  });

  document.getElementById('planningReminderBrowserEnabled').checked=
    planningReminderPreferences.notificacion_navegador ?? false;

  updatePlanningBrowserNotificationUi();

  const modal=document.getElementById('planningReminderSettingsModal');
  modal?.classList.remove('hidden');
  modal?.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closePlanningReminderSettings() {
  const modal=document.getElementById('planningReminderSettingsModal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
}

async function savePlanningReminderSettings() {
  if (!client || !currentProfile?.id) return;

  planningReminderSettingsMessage('');

  const sonido_habilitado=document.getElementById('planningReminderSoundEnabled').checked;
  const sonido_codigo=document.getElementById('planningReminderSoundType').value;
  const volumen=Number(document.getElementById('planningReminderVolume').value || 55)/100;
  const notificacion_navegador=document.getElementById('planningReminderBrowserEnabled').checked;
  const minutos_default=planningReminderSelectedDefaults();

  const payload={
    profile_id:currentProfile.id,
    sonido_habilitado,
    sonido_codigo,
    volumen,
    notificacion_navegador,
    minutos_default
  };

  const button=document.getElementById('planningReminderSettingsSave');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Guardando…';

  const {error}=await client.from('planificacion_preferencias_usuario')
    .upsert(payload,{onConflict:'profile_id'});

  button.disabled=false;
  button.textContent=old;

  if (error) {
    console.error(error);
    planningReminderSettingsMessage(error.message || 'No fue posible guardar la configuración.');
    return;
  }

  planningReminderPreferences={...payload};
  updatePlanningReminderStatusCard();
  closePlanningReminderSettings();
  planningMessage('Configuración de avisos guardada.','success');
}

async function requestPlanningBrowserNotifications() {
  if (!('Notification' in window)) {
    planningReminderSettingsMessage('Este navegador no admite notificaciones.');
    return;
  }

  if (Notification.permission==='denied') {
    planningReminderSettingsMessage(
      'Las notificaciones están bloqueadas. Debes habilitarlas desde la configuración del navegador.'
    );
    return;
  }

  try {
    const result=await Notification.requestPermission();
    updatePlanningBrowserNotificationUi();

    if (result==='granted') {
      document.getElementById('planningReminderBrowserEnabled').checked=true;
      planningReminderSettingsMessage('Notificaciones del navegador autorizadas.','success');
    } else {
      planningReminderSettingsMessage('No se concedió permiso para notificaciones.');
    }
  } catch(err) {
    console.error(err);
    planningReminderSettingsMessage('No fue posible solicitar el permiso.');
  }
}

function getPlanningReminderAudioContext() {
  if (!planningReminderAudioContext) {
    const AudioCtx=window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    planningReminderAudioContext=new AudioCtx();
  }

  if (planningReminderAudioContext.state==='suspended') {
    planningReminderAudioContext.resume().catch(()=>{});
  }

  return planningReminderAudioContext;
}

function planningReminderTone(ctx,frequency,start,duration,volume) {
  const oscillator=ctx.createOscillator();
  const gain=ctx.createGain();

  oscillator.type='sine';
  oscillator.frequency.setValueAtTime(frequency,start);
  gain.gain.setValueAtTime(0.0001,start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001,volume),start+0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(start);
  oscillator.stop(start+duration+0.03);
}

function playPlanningReminderSound(code=null,urgent=false) {
  const soundCode=code || planningReminderPreferences.sonido_codigo || 'BANCO';
  if (
    !planningReminderPreferences.sonido_habilitado
    || soundCode==='SIN_SONIDO'
  ) return;

  const ctx=getPlanningReminderAudioContext();
  if (!ctx) return;

  const base=Math.min(0.35,Math.max(0.02,Number(planningReminderPreferences.volumen || 0.55)*0.28));
  const now=ctx.currentTime+0.03;

  const playBank=(offset=0)=>{
    planningReminderTone(ctx,880,now+offset,0.17,base);
    planningReminderTone(ctx,659.25,now+offset+0.24,0.23,base*0.95);
  };

  if (soundCode==='CAMPANA') {
    planningReminderTone(ctx,1046.5,now,0.28,base*0.75);
    planningReminderTone(ctx,1318.5,now+0.16,0.34,base*0.55);
    if (urgent) {
      planningReminderTone(ctx,1046.5,now+0.65,0.28,base*0.75);
      planningReminderTone(ctx,1318.5,now+0.81,0.34,base*0.55);
    }
  } else if (soundCode==='SUAVE') {
    planningReminderTone(ctx,659.25,now,0.22,base*0.55);
    planningReminderTone(ctx,783.99,now+0.28,0.25,base*0.42);
    if (urgent) {
      planningReminderTone(ctx,659.25,now+0.68,0.22,base*0.55);
      planningReminderTone(ctx,783.99,now+0.96,0.25,base*0.42);
    }
  } else {
    playBank(0);
    if (urgent) playBank(0.72);
  }
}

function planningReminderSlot(task,now=new Date()) {
  if (!task?.recordatorios_habilitados) return null;
  if (['COMPLETADO','CANCELADO','EN_ESPERA'].includes(task.estado)) return null;

  const due=planningTaskDateTime(task);
  if (!due) return null;

  const snooze=task.pospuesto_hasta ? new Date(task.pospuesto_hasta) : null;
  if (snooze && snooze>now) return null;

  const diffMinutes=(due-now)/60000;
  const configured=Array.isArray(task.recordatorios_minutos)
    ? task.recordatorios_minutos.map(Number)
    : [...(planningReminderPreferences.minutos_default || [60,30,10,0])];

  const has=value=>configured.includes(value);

  if (diffMinutes<=0 && has(0)) {
    return {slot:'DUE',minutes:0,label:'El plazo venció',urgent:true};
  }

  if (diffMinutes>0 && diffMinutes<=10 && has(10)) {
    return {slot:'R10',minutes:10,label:`Vence en ${Math.max(1,Math.ceil(diffMinutes))} min`,urgent:true};
  }

  if (diffMinutes>10 && diffMinutes<=30 && has(30)) {
    return {slot:'R30',minutes:30,label:`Vence en ${Math.ceil(diffMinutes)} min`,urgent:false};
  }

  if (diffMinutes>30 && diffMinutes<=60 && has(60)) {
    return {slot:'R60',minutes:60,label:`Vence en ${Math.ceil(diffMinutes)} min`,urgent:false};
  }

  return null;
}

function planningReminderTaskIsMine(task) {
  if (!currentProfile?.id || !task) return false;
  return task.asignado_a_profile_id===currentProfile.id
    || (!task.asignado_a_profile_id && task.created_by===currentProfile.id);
}

async function checkPlanningReminders() {
  if (
    planningReminderChecking
    || !client
    || !currentProfile?.id
    || document.visibilityState==='prerender'
  ) return;

  planningReminderChecking=true;

  try {
    const {data,error}=await client.from('planificacion_pendientes')
      .select('id,codigo,titulo,prioridad,estado,asignado_a_profile_id,created_by,responsable_nombre,fecha_objetivo,hora_objetivo,recordatorios_habilitados,recordatorios_minutos,pospuesto_hasta')
      .in('estado',['PENDIENTE','EN_PROCESO'])
      .order('fecha_objetivo',{ascending:true});

    if (error) {
      console.warn('Recordatorios:',error);
      return;
    }

    const now=new Date();
    const candidates=(data || [])
      .filter(planningReminderTaskIsMine)
      .map(task=>({task,reminder:planningReminderSlot(task,now)}))
      .filter(x=>x.reminder && !planningReminderWasSeen(x.task,x.reminder.slot));

    candidates.sort((a,b)=>{
      const rank={DUE:0,R10:1,R30:2,R60:3};
      const ar=rank[a.reminder.slot] ?? 9;
      const br=rank[b.reminder.slot] ?? 9;
      if (ar!==br) return ar-br;
      return planningTaskPriorityRank(a.task.prioridad)-planningTaskPriorityRank(b.task.prioridad);
    });

    for (const item of candidates) {
      const exists=planningReminderQueue.some(x=>x.task.id===item.task.id && x.reminder.slot===item.reminder.slot)
        || (
          planningReminderActive?.task.id===item.task.id
          && planningReminderActive?.reminder.slot===item.reminder.slot
        );
      if (!exists) planningReminderQueue.push(item);
    }

    showNextPlanningReminder();
  } finally {
    planningReminderChecking=false;
  }
}

function planningReminderNotificationTitle(item) {
  return item.reminder.slot==='DUE'
    ? '⚠️ Pendiente vencido'
    : '🔔 Pendiente próximo a vencer';
}

function showPlanningBrowserNotification(item) {
  if (
    !planningReminderPreferences.notificacion_navegador
    || !('Notification' in window)
    || Notification.permission!=='granted'
  ) return;

  try {
    const notification=new Notification(planningReminderNotificationTitle(item),{
      body:`${item.task.codigo || 'Ticket'} · ${item.task.titulo}\n${item.reminder.label}`,
      tag:`planning-${item.task.id}-${item.reminder.slot}`,
      renotify:false
    });

    notification.onclick=()=>{
      window.focus();
      attendPlanningReminder(item,false);
      notification.close();
    };
  } catch(err) {
    console.warn('Notificación no disponible:',err);
  }
}

function showNextPlanningReminder() {
  if (planningReminderActive || !planningReminderQueue.length) return;

  const item=planningReminderQueue.shift();
  planningReminderActive=item;

  const layer=document.getElementById('planningReminderCallLayer');
  const eyebrow=document.getElementById('planningReminderCallEyebrow');
  const code=document.getElementById('planningReminderCallCode');
  const title=document.getElementById('planningReminderCallTitle');
  const meta=document.getElementById('planningReminderCallMeta');

  if (eyebrow) eyebrow.textContent=
    item.reminder.slot==='DUE'
      ? '⚠ PENDIENTE VENCIDO'
      : '🔔 PENDIENTE PRÓXIMO A VENCER';

  if (code) code.textContent=item.task.codigo || 'TK';
  if (title) title.textContent=item.task.titulo || 'Pendiente';
  if (meta) meta.textContent=[
    item.reminder.label,
    planningPriorityLabel(item.task.prioridad),
    item.task.hora_objetivo?`Hora ${String(item.task.hora_objetivo).slice(0,5)}`:''
  ].filter(Boolean).join(' · ');

  layer?.classList.remove('hidden');
  layer?.classList.toggle('urgent',item.reminder.urgent);

  planningReminderMarkSeen(item.task,item.reminder.slot);
  playPlanningReminderSound(null,item.reminder.urgent);
  showPlanningBrowserNotification(item);
}

function closeActivePlanningReminder(showNext=true) {
  const layer=document.getElementById('planningReminderCallLayer');
  layer?.classList.add('hidden');
  layer?.classList.remove('urgent');
  planningReminderActive=null;
  if (showNext) setTimeout(showNextPlanningReminder,180);
}

async function snoozePlanningReminder() {
  const item=planningReminderActive;
  if (!item || !client) return;

  const until=new Date(Date.now()+10*60000);
  const {error}=await client.from('planificacion_pendientes')
    .update({
      pospuesto_hasta:until.toISOString(),
      ultimo_motivo_cambio:'Aviso sonoro pospuesto por 10 minutos.'
    })
    .eq('id',item.task.id);

  if (error) {
    console.error(error);
    return;
  }

  planningReminderUnmarkSeen(item.task,item.reminder.slot);

  const local=planningTaskRecords.find(x=>x.id===item.task.id);
  if (local) local.pospuesto_hasta=until.toISOString();

  closeActivePlanningReminder();
  planningMessage(`Aviso de ${item.task.codigo || 'ticket'} pospuesto 10 minutos.`,'success');
}

async function attendPlanningReminder(item=planningReminderActive,closeToast=true) {
  if (!item || !client) return;

  const {error}=await client.from('planificacion_pendientes')
    .update({
      estado:'EN_PROCESO',
      pospuesto_hasta:null,
      ultimo_motivo_cambio:'Atención iniciada desde el aviso de vencimiento.'
    })
    .eq('id',item.task.id);

  if (error) {
    console.error(error);
    return;
  }

  if (closeToast) closeActivePlanningReminder(false);

  planningTasksLoaded=false;
  planningLoaded=false;

  showSection('planificacion');
  await loadPlanningModule(true);
  switchPlanningTab('TASKS');
  await loadPlanningTasksModule(true);

  const refreshed=planningTaskRecords.find(x=>x.id===item.task.id);
  if (refreshed) openPlanningTaskModal(refreshed);

  if (closeToast) setTimeout(showNextPlanningReminder,250);
}

async function initializePlanningReminderEngine() {
  if (planningReminderInitialized || !client || !currentProfile?.id) return;
  planningReminderInitialized=true;

  await loadPlanningReminderPreferences();

  const unlock=()=>{
    const ctx=getPlanningReminderAudioContext();
    if (ctx?.state==='suspended') ctx.resume().catch(()=>{});
  };
  document.addEventListener('pointerdown',unlock,{once:true});
  document.addEventListener('keydown',unlock,{once:true});

  await checkPlanningReminders();

  if (planningReminderTimer) clearInterval(planningReminderTimer);
  planningReminderTimer=setInterval(checkPlanningReminders,30000);

  document.addEventListener('visibilitychange',()=>{
    if (document.visibilityState==='visible') checkPlanningReminders();
  });
}


// Eventos 17C.1
document.getElementById('planningTaskRemindersEnabled')?.addEventListener('change',updatePlanningTaskReminderOptions);

document.getElementById('planningReminderSettingsButton')?.addEventListener('click',openPlanningReminderSettings);
document.getElementById('planningReminderSettingsClose')?.addEventListener('click',closePlanningReminderSettings);
document.getElementById('planningReminderSettingsCancel')?.addEventListener('click',closePlanningReminderSettings);
document.getElementById('planningReminderSettingsModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closePlanningReminderSettings);
document.getElementById('planningReminderSettingsSave')?.addEventListener('click',savePlanningReminderSettings);

document.getElementById('planningReminderVolume')?.addEventListener('input',event=>{
  document.getElementById('planningReminderVolumeLabel').textContent=`${event.target.value}%`;
});

document.getElementById('planningReminderTestButton')?.addEventListener('click',()=>playPlanningReminderSound());
document.getElementById('planningReminderModalTestButton')?.addEventListener('click',()=>{
  const previous={...planningReminderPreferences};
  planningReminderPreferences={
    ...planningReminderPreferences,
    sonido_habilitado:document.getElementById('planningReminderSoundEnabled').checked,
    sonido_codigo:document.getElementById('planningReminderSoundType').value,
    volumen:Number(document.getElementById('planningReminderVolume').value || 55)/100
  };
  playPlanningReminderSound(null,false);
  planningReminderPreferences=previous;
});

document.getElementById('planningBrowserNotificationButton')?.addEventListener('click',requestPlanningBrowserNotifications);

document.getElementById('planningReminderDismissButton')?.addEventListener('click',()=>closeActivePlanningReminder());
document.getElementById('planningReminderSnoozeButton')?.addEventListener('click',snoozePlanningReminder);
document.getElementById('planningReminderAttendButton')?.addEventListener('click',()=>attendPlanningReminder());

// Eventos 17B
document.querySelectorAll('[data-planning-task-period]').forEach(button=>{
  button.addEventListener('click',()=>{
    planningTaskPeriod=button.dataset.planningTaskPeriod || 'TODAY';
    document.querySelectorAll('[data-planning-task-period]').forEach(x=>x.classList.toggle('active',x===button));
    renderPlanningTaskList();
  });
});

document.getElementById('planningTaskSearch')?.addEventListener('input',renderPlanningTaskList);
document.getElementById('planningTaskOwnershipFilter')?.addEventListener('change',renderPlanningTaskList);
document.getElementById('planningTaskStatusFilter')?.addEventListener('change',renderPlanningTaskList);
document.getElementById('planningTaskPriorityFilter')?.addEventListener('change',renderPlanningTaskList);
document.getElementById('planningTaskCategoryFilter')?.addEventListener('change',renderPlanningTaskList);
document.getElementById('planningTaskRefreshButton')?.addEventListener('click',()=>{
  planningTasksLoaded=false;
  loadPlanningTasksModule(true);
});
document.getElementById('planningAttendNextButton')?.addEventListener('click',attendNextPlanningTask);

document.getElementById('planningTaskForm')?.addEventListener('submit',savePlanningTask);
document.getElementById('planningTaskModalClose')?.addEventListener('click',closePlanningTaskModal);
document.getElementById('planningTaskCancel')?.addEventListener('click',closePlanningTaskModal);
document.getElementById('planningTaskModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closePlanningTaskModal);
document.getElementById('planningTaskDeleteButton')?.addEventListener('click',()=>{
  const id=document.getElementById('planningTaskId')?.value;
  if (id) deletePlanningTask(id);
});

document.getElementById('planningTaskAssignee')?.addEventListener('change',togglePlanningTaskManualAssignee);
document.getElementById('planningTaskStatus')?.addEventListener('change',updatePlanningTaskWaitingFields);
document.getElementById('planningTaskPlanningProject')?.addEventListener('change',event=>{
  populatePlanningTaskActivities(event.target.value || '');
});
document.getElementById('planningTaskPlanningActivity')?.addEventListener('change',syncPlanningTaskFromActivity);

document.getElementById('planningTaskRescheduleClose')?.addEventListener('click',closePlanningTaskRescheduleModal);
document.getElementById('planningTaskRescheduleCancel')?.addEventListener('click',closePlanningTaskRescheduleModal);
document.getElementById('planningTaskRescheduleModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closePlanningTaskRescheduleModal);
document.getElementById('planningTaskRescheduleSave')?.addEventListener('click',savePlanningTaskReschedule);


// ============================================================
// ETAPA 16A · COMITÉ SST / SUBCOMITÉ SST
// CONFORMACIÓN E INTEGRANTES
// ============================================================

let committeeRecords = [];
let committeeMembers = [];
let committeeSites = [];
let committeeProjects = [];
let committeeModuleLoaded = false;
let committeeActiveId = null;
let committeeCurrentType = 'COMITE';
let committeeSelectedWorker = null;
let committeeModuleMode = 'CONFORMATIONS';
let committeeMeetingRecords = [];
let committeeMeetingAttendees = [];
let committeeMeetingEvidences = [];
let committeeMeetingAgreements = [];
let committeeMeetingsLoaded = false;
let activeCommitteeMeetingId = null;
let committeeMeetingAdditionalAgenda = [];
let publicCommitteeMeetingSignatureToken = '';
let publicCommitteeMeetingSignatureData = null;
let publicCommitteeMeetingSignatureDrawing = false;
let publicCommitteeMeetingSignatureCtx = null;
let committeeAgreementEvidences = [];
let committeeAgreementHistory = [];
let committeeAgreementsLoaded = false;
let activeCommitteeAgreementId = null;
let committeeTrainingRecords = [];
let committeeTrainingVideos = [];
let committeeTrainingsLoaded = false;
let activeCommitteeTrainingId = null;
let activeCommitteeTrainingVideoId = null;
let committeeTrainingQuestionRecords = [];
let committeeTrainingQuestionDetails = [];
let committeeTrainingParticipants = [];
let committeeTrainingAttempts = [];
let activeCommitteeTrainingQuestionId = null;
let committeeTrainingQuestionRemovedImagePath = null;

let publicCommitteeTrainingToken = '';
let publicCommitteeTrainingDni = '';
let publicCommitteeTrainingData = null;
let publicCommitteeTrainingSignatureCtx = null;
let publicCommitteeTrainingSignatureDrawing = false;
let publicCommitteeTrainingCurrentVideoId = null;
let publicCommitteeTrainingCurrentMaxSecond = 0;
let publicCommitteeTrainingLastSaveAt = 0;
let publicCommitteeTrainingHtml5Player = null;
let publicCommitteeTrainingYoutubePlayer = null;
let publicCommitteeTrainingYoutubeTimer = null;
let publicCommitteeTrainingExternalTimer = null;
let publicCommitteeTrainingExternalStartedAt = null;
let publicCommitteeTrainingCompletionBusy = false;
let publicCommitteeTrainingExamState = null;
let publicCommitteeTrainingExamRun = null;
let publicCommitteeTrainingLastExamResult = null;
let publicCommitteeTrainingLastExamAttemptId = null;
let publicCommitteeTrainingExamTimerInterval = null;
let publicCommitteeTrainingExamDeadline = null;
let youtubeApiPromise = null;




const COMMITTEE_BASE_AGENDA = [
  'Revisión de incidentes/ accidentes',
  'Revisión de estadísticas de SST',
  'Revisión de estadísticas de SO',
  'Revisión de Objetivos y asuntos relevantes de Seguridad y Salud en el Trabajo.',
  'Revisión de las inspecciones realizadas.',
  'Revisión de las actas del subcomité de SST.',
  'Revisión de acuerdos pendientes',
  'Acuerdos de la reunión'
];


function committeeMessage(message='',type='error') {
  const el=document.getElementById('committeeModuleMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`module-message ${message?'visible':''} ${type}`;
}

function committeeFormMessage(message='',type='error') {
  const el=document.getElementById('committeeFormMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function committeeMemberMessage(message='',type='error') {
  const el=document.getElementById('committeeMemberMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function committeeDetailMessage(message='',type='error') {
  const el=document.getElementById('committeeDetailMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function committeeUnitName(record) {
  if (!record) return '—';
  if (record.tipo==='COMITE') {
    return committeeSites.find(x=>x.id===record.sede_id)?.nombre || 'Sede';
  }
  return committeeProjects.find(x=>x.id===record.proyecto_id)?.nombre || 'Proyecto';
}

function committeeTypeLabel(type) {
  return type==='SUBCOMITE' ? 'Subcomité SST' : 'Comité SST Corporativo';
}

function committeeStatusClass(status) {
  return String(status || '').toLowerCase();
}

function committeeStatusLabel(status) {
  return {
    ACTIVO:'ACTIVO',
    BORRADOR:'BORRADOR',
    CERRADO:'CERRADO'
  }[status] || status || '—';
}

function committeeCanCreate() {
  return ['ADMIN','PROYECTO'].includes(currentProfile?.rol_codigo);
}

function committeeCanManage(record) {
  if (!record) return false;
  if (currentProfile?.rol_codigo==='ADMIN') return true;
  if (currentProfile?.rol_codigo!=='PROYECTO') return false;
  return record.tipo==='SUBCOMITE' &&
    committeeProjects.some(p=>p.id===record.proyecto_id);
}

function committeeRecordMembers(comiteId) {
  return committeeMembers.filter(x=>x.comite_id===comiteId);
}

function committeeActiveMembers(comiteId) {
  return committeeRecordMembers(comiteId).filter(x=>x.activo);
}

function committeeWorkerName(worker) {
  if (!worker) return '—';
  return [worker.apellidos,worker.nombres].filter(Boolean).join(' ').trim() || '—';
}

function committeeGeneratedName() {
  const type=document.getElementById('committeeType')?.value || 'COMITE';
  if (type==='COMITE') {
    const id=document.getElementById('committeeSite')?.value;
    const unit=committeeSites.find(x=>x.id===id)?.nombre || '';
    return unit ? `Comité SST Corporativo - ${unit}` : 'Comité SST Corporativo';
  }
  const id=document.getElementById('committeeProject')?.value;
  const unit=committeeProjects.find(x=>x.id===id)?.nombre || '';
  return unit ? `Subcomité SST - ${unit}` : 'Subcomité SST';
}

function updateCommitteeGeneratedName() {
  const input=document.getElementById('committeeGeneratedName');
  if (input) input.value=committeeGeneratedName();
}

function setCommitteeType(type) {
  committeeCurrentType=type==='SUBCOMITE' ? 'SUBCOMITE' : 'COMITE';
  const hidden=document.getElementById('committeeType');
  if (hidden) hidden.value=committeeCurrentType;

  document.getElementById('committeeTypeSiteButton')?.classList.toggle('active',committeeCurrentType==='COMITE');
  document.getElementById('committeeTypeProjectButton')?.classList.toggle('active',committeeCurrentType==='SUBCOMITE');
  document.getElementById('committeeSiteField')?.classList.toggle('hidden',committeeCurrentType!=='COMITE');
  document.getElementById('committeeProjectField')?.classList.toggle('hidden',committeeCurrentType!=='SUBCOMITE');

  updateCommitteeGeneratedName();
}

function populateCommitteeUnits() {
  const site=document.getElementById('committeeSite');
  const project=document.getElementById('committeeProject');

  if (site) {
    site.innerHTML='<option value="">Seleccione una sede</option>' +
      committeeSites.filter(x=>x.activo!==false)
        .map(x=>`<option value="${x.id}">${escapeHtml(x.nombre || 'Sede')}</option>`)
        .join('');
  }

  if (project) {
    project.innerHTML='<option value="">Seleccione un proyecto</option>' +
      committeeProjects.filter(x=>x.activo!==false)
        .map(x=>`<option value="${x.id}">${escapeHtml(x.nombre || 'Proyecto')}</option>`)
        .join('');
  }
}

function updateCommitteeStats() {
  const total=committeeRecords.length;
  const site=committeeRecords.filter(x=>x.tipo==='COMITE').length;
  const project=committeeRecords.filter(x=>x.tipo==='SUBCOMITE').length;
  const memberCount=committeeMembers.filter(x=>x.activo).length;

  const values={
    committeeTotalCount:total,
    committeeSiteCount:site,
    committeeProjectCount:project,
    committeeMemberCount:memberCount
  };
  Object.entries(values).forEach(([id,value])=>{
    const el=document.getElementById(id);
    if (el) el.textContent=String(value);
  });
}

function renderCommitteeList() {
  const list=document.getElementById('committeeList');
  if (!list) return;

  const q=(document.getElementById('committeeSearch')?.value || '').trim().toLowerCase();
  const type=document.getElementById('committeeTypeFilter')?.value || '';
  const status=document.getElementById('committeeStatusFilter')?.value || '';

  const rows=committeeRecords.filter(record=>{
    if (type && record.tipo!==type) return false;
    if (status && record.estado!==status) return false;

    const hay=[
      record.codigo,
      record.nombre,
      committeeUnitName(record),
      record.numero_acta
    ].filter(Boolean).join(' ').toLowerCase();

    return !q || hay.includes(q);
  });

  if (!rows.length) {
    list.innerHTML='<div class="training-library-empty">No se encontraron conformaciones del Comité SST.</div>';
    return;
  }

  list.innerHTML=rows.map(record=>{
    const members=committeeRecordMembers(record.id);
    const active=members.filter(x=>x.activo).length;
    const titular=members.filter(x=>x.activo && x.condicion==='TITULAR').length;
    const suplente=members.filter(x=>x.activo && x.condicion==='SUPLENTE').length;
    const canManage=committeeCanManage(record);
    const unit=committeeUnitName(record);

    return `
      <article class="committee-card">
        <div class="committee-card-icon ${record.tipo==='SUBCOMITE'?'project':'site'}">${record.tipo==='SUBCOMITE'?'◆':'◎'}</div>
        <div class="committee-card-main">
          <div class="committee-card-title-row">
            <div>
              <span class="eyebrow">${record.tipo==='SUBCOMITE'?'SUBCOMITÉ SST · PROYECTO':'COMITÉ SST · SEDE'}</span>
              <h4>${escapeHtml(record.nombre || committeeTypeLabel(record.tipo))}</h4>
            </div>
            <span class="committee-status ${committeeStatusClass(record.estado)}">${escapeHtml(committeeStatusLabel(record.estado))}</span>
          </div>

          <div class="committee-card-meta">
            <span><b>${escapeHtml(record.codigo || '—')}</b></span>
            <span>${escapeHtml(unit)}</span>
            <span>${escapeHtml(formatDatePE(record.vigencia_desde))} - ${escapeHtml(formatDatePE(record.vigencia_hasta))}</span>
            ${record.numero_acta ? `<span>Acta: ${escapeHtml(record.numero_acta)}</span>` : ''}
          </div>

          <div class="committee-card-stats">
            <span><b>${active}</b> activos</span>
            <span><b>${titular}</b> titulares</span>
            <span><b>${suplente}</b> suplentes</span>
          </div>
        </div>

        <div class="committee-card-actions">
          <button class="committee-manage-btn" type="button" data-committee-detail="${record.id}">Integrantes</button>
          ${canManage ? `<button class="secondary-btn" type="button" data-committee-edit="${record.id}">Editar</button>` : ''}
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-committee-detail]').forEach(button=>{
    button.addEventListener('click',()=>openCommitteeDetail(button.dataset.committeeDetail));
  });

  list.querySelectorAll('[data-committee-edit]').forEach(button=>{
    button.addEventListener('click',()=>{
      const record=committeeRecords.find(x=>x.id===button.dataset.committeeEdit);
      openCommitteeForm(record);
    });
  });
}

async function loadCommitteeModule(force=false) {
  if (!client) return;
  if (committeeModuleLoaded && !force) {
    updateCommitteeStats();
    renderCommitteeList();
    return;
  }

  committeeMessage('');
  const button=document.getElementById('newCommitteeButton');
  if (button) {
    button.classList.toggle('hidden',!committeeCanCreate());
  }

  const [committees,members,sites,projects]=await Promise.all([
    client.from('comites_sst')
      .select('id,codigo,tipo,nombre,sede_id,proyecto_id,fecha_constitucion,vigencia_desde,vigencia_hasta,numero_acta,estado,observaciones,created_by,created_at,updated_at')
      .order('vigencia_desde',{ascending:false}),
    client.from('comite_sst_integrantes')
      .select('id,comite_id,trabajador_id,representacion,condicion,cargo_comite,fecha_inicio,fecha_fin,activo,created_at,updated_at,trabajadores(id,dni,nombres,apellidos,cargo,area,sede_id,proyecto_id,activo)')
      .order('created_at',{ascending:true}),
    client.from('sedes').select('id,codigo,nombre,ubicacion,activo').order('nombre'),
    client.from('proyectos').select('id,codigo,nombre,cliente,ubicacion,activo').order('nombre')
  ]);

  const errors=[committees.error,members.error,sites.error,projects.error].filter(Boolean);
  if (errors.length) {
    console.error(errors);
    committeeMessage(errors[0].message || 'No fue posible cargar el módulo Comité SST.');
    return;
  }

  committeeRecords=committees.data || [];
  committeeMembers=members.data || [];
  committeeSites=sites.data || [];
  committeeProjects=projects.data || [];
  committeeModuleLoaded=true;

  populateCommitteeUnits();
  updateCommitteeStats();
  renderCommitteeList();
}

function openCommitteeForm(record=null) {
  const modal=document.getElementById('committeeFormModal');
  if (!modal) return;

  committeeFormMessage('');
  document.getElementById('committeeEditId').value=record?.id || '';
  document.getElementById('committeeFormTitle').textContent=record ? 'Editar conformación' : 'Nueva conformación';

  let type=record?.tipo || (currentProfile?.rol_codigo==='PROYECTO' ? 'SUBCOMITE' : 'COMITE');
  setCommitteeType(type);

  const siteButton=document.getElementById('committeeTypeSiteButton');
  if (siteButton) {
    const disabled=currentProfile?.rol_codigo==='PROYECTO';
    siteButton.disabled=disabled;
    siteButton.classList.toggle('disabled',disabled);
  }

  document.getElementById('committeeSite').value=record?.sede_id || '';
  document.getElementById('committeeProject').value=record?.proyecto_id || '';

  const today=new Date().toISOString().slice(0,10);
  document.getElementById('committeeConstitutionDate').value=record?.fecha_constitucion || today;
  document.getElementById('committeeValidFrom').value=record?.vigencia_desde || today;
  document.getElementById('committeeValidTo').value=record?.vigencia_hasta || '';
  document.getElementById('committeeActNumber').value=record?.numero_acta || '';
  document.getElementById('committeeStatus').value=record?.estado || 'ACTIVO';
  document.getElementById('committeeNotes').value=record?.observaciones || '';

  updateCommitteeGeneratedName();

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closeCommitteeForm() {
  const modal=document.getElementById('committeeFormModal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden','true');
  if (document.getElementById('committeeDetailModal')?.classList.contains('hidden')) {
    document.body.classList.remove('modal-open');
  }
}

async function saveCommitteeForm(event) {
  event.preventDefault();
  committeeFormMessage('');

  const id=document.getElementById('committeeEditId').value || null;
  const type=document.getElementById('committeeType').value;
  const sede_id=type==='COMITE' ? (document.getElementById('committeeSite').value || null) : null;
  const proyecto_id=type==='SUBCOMITE' ? (document.getElementById('committeeProject').value || null) : null;
  const fecha_constitucion=document.getElementById('committeeConstitutionDate').value;
  const vigencia_desde=document.getElementById('committeeValidFrom').value;
  const vigencia_hasta=document.getElementById('committeeValidTo').value;
  const numero_acta=document.getElementById('committeeActNumber').value.trim() || null;
  const estado=document.getElementById('committeeStatus').value;
  const observaciones=document.getElementById('committeeNotes').value.trim() || null;
  const nombre=committeeGeneratedName();

  if (type==='COMITE' && !sede_id) {
    committeeFormMessage('Selecciona la sede del Comité SST.');
    return;
  }
  if (type==='SUBCOMITE' && !proyecto_id) {
    committeeFormMessage('Selecciona el proyecto del Subcomité SST.');
    return;
  }
  if (!fecha_constitucion || !vigencia_desde || !vigencia_hasta) {
    committeeFormMessage('Completa la fecha de constitución y el periodo de vigencia.');
    return;
  }
  if (new Date(`${vigencia_hasta}T00:00:00`) < new Date(`${vigencia_desde}T00:00:00`)) {
    committeeFormMessage('La vigencia hasta no puede ser anterior a la vigencia desde.');
    return;
  }

  const payload={
    tipo:type,
    nombre,
    sede_id,
    proyecto_id,
    fecha_constitucion,
    vigencia_desde,
    vigencia_hasta,
    numero_acta,
    estado,
    observaciones
  };

  if (!id) payload.created_by=currentProfile?.id || null;

  const button=document.getElementById('saveCommitteeButton');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Guardando…';

  const result=id
    ? await client.from('comites_sst').update(payload).eq('id',id).select().single()
    : await client.from('comites_sst').insert(payload).select().single();

  button.disabled=false;
  button.textContent=old;

  if (result.error) {
    console.error(result.error);
    committeeFormMessage(result.error.message || 'No fue posible guardar la conformación.');
    return;
  }

  closeCommitteeForm();
  committeeModuleLoaded=false;
  await loadCommitteeModule(true);

  committeeMessage(id ? 'Conformación actualizada correctamente.' : 'Conformación creada correctamente.','success');
  await openCommitteeDetail(result.data.id);
}

function openCommitteeMemberEditor(member=null) {
  const editor=document.getElementById('committeeMemberEditor');
  if (!editor || !committeeActiveId) return;

  committeeMemberMessage('');
  committeeSelectedWorker=null;

  document.getElementById('committeeMemberEditId').value=member?.id || '';
  document.getElementById('committeeMemberWorkerId').value=member?.trabajador_id || '';
  document.getElementById('committeeMemberEditorTitle').textContent=member ? 'Editar integrante' : 'Agregar integrante';
  document.getElementById('committeeMemberDni').disabled=!!member;
  document.getElementById('searchCommitteeWorkerButton').disabled=!!member;

  const worker=member?.trabajadores || null;
  document.getElementById('committeeMemberDni').value=worker?.dni || '';
  document.getElementById('committeeMemberRepresentation').value=member?.representacion || 'EMPLEADOR';
  document.getElementById('committeeMemberCondition').value=member?.condicion || 'TITULAR';
  document.getElementById('committeeMemberCommitteeRole').value=member?.cargo_comite || 'MIEMBRO';

  const committee=committeeRecords.find(x=>x.id===committeeActiveId);
  document.getElementById('committeeMemberStartDate').value=member?.fecha_inicio || committee?.vigencia_desde || '';
  document.getElementById('committeeMemberEndDate').value=member?.fecha_fin || '';
  document.getElementById('committeeMemberActive').checked=member ? member.activo!==false : true;

  if (worker) {
    committeeSelectedWorker=worker;
    renderCommitteeFoundWorker(worker);
  } else {
    document.getElementById('committeeWorkerFound')?.classList.add('hidden');
  }

  editor.classList.remove('hidden');
  setTimeout(()=>document.getElementById('committeeMemberDni')?.focus(),50);
}

function closeCommitteeMemberEditor() {
  document.getElementById('committeeMemberEditor')?.classList.add('hidden');
  committeeMemberMessage('');
  committeeSelectedWorker=null;
}

function renderCommitteeFoundWorker(worker) {
  committeeSelectedWorker=worker;
  document.getElementById('committeeMemberWorkerId').value=worker?.id || '';
  document.getElementById('committeeWorkerFoundName').textContent=committeeWorkerName(worker);
  document.getElementById('committeeWorkerFoundPosition').textContent=worker?.cargo || '—';
  document.getElementById('committeeWorkerFoundArea').textContent=worker?.area || '—';
  document.getElementById('committeeWorkerFound')?.classList.remove('hidden');
}

async function searchCommitteeWorker() {
  committeeMemberMessage('');
  if (!committeeActiveId) return;

  const dni=document.getElementById('committeeMemberDni').value.replace(/\D/g,'').slice(0,8);
  document.getElementById('committeeMemberDni').value=dni;

  if (!/^\d{8}$/.test(dni)) {
    committeeMemberMessage('Ingresa un DNI válido de 8 dígitos.');
    return;
  }

  const button=document.getElementById('searchCommitteeWorkerButton');
  button.disabled=true;
  button.textContent='Buscando…';

  const {data,error}=await client.rpc('buscar_trabajador_comite',{
    p_comite_id:committeeActiveId,
    p_dni:dni
  });

  button.disabled=false;
  button.textContent='Buscar';

  if (error || !data?.ok) {
    console.error(error,data);
    committeeSelectedWorker=null;
    document.getElementById('committeeMemberWorkerId').value='';
    document.getElementById('committeeWorkerFound')?.classList.add('hidden');
    committeeMemberMessage(data?.error || error?.message || 'No se encontró el trabajador.');
    return;
  }

  renderCommitteeFoundWorker(data.trabajador);
  committeeMemberMessage('Trabajador encontrado correctamente.','success');
}

async function saveCommitteeMember() {
  committeeMemberMessage('');
  if (!committeeActiveId) return;

  const integranteId=document.getElementById('committeeMemberEditId').value || null;
  const trabajadorId=document.getElementById('committeeMemberWorkerId').value || null;
  const representacion=document.getElementById('committeeMemberRepresentation').value;
  const condicion=document.getElementById('committeeMemberCondition').value;
  const cargoComite=document.getElementById('committeeMemberCommitteeRole').value;
  const fechaInicio=document.getElementById('committeeMemberStartDate').value;
  const fechaFin=document.getElementById('committeeMemberEndDate').value || null;
  const activo=document.getElementById('committeeMemberActive').checked;

  if (!trabajadorId) {
    committeeMemberMessage('Busca y selecciona primero al trabajador por DNI.');
    return;
  }
  if (!fechaInicio) {
    committeeMemberMessage('Registra la fecha de inicio del integrante.');
    return;
  }

  const button=document.getElementById('saveCommitteeMemberButton');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Guardando…';

  const {data,error}=await client.rpc('guardar_integrante_comite',{
    p_integrante_id:integranteId,
    p_comite_id:committeeActiveId,
    p_trabajador_id:trabajadorId,
    p_representacion:representacion,
    p_condicion:condicion,
    p_cargo_comite:cargoComite,
    p_fecha_inicio:fechaInicio,
    p_fecha_fin:fechaFin,
    p_activo:activo
  });

  button.disabled=false;
  button.textContent=old;

  if (error || !data?.ok) {
    console.error(error,data);
    committeeMemberMessage(data?.error || error?.message || 'No fue posible guardar al integrante.');
    return;
  }

  closeCommitteeMemberEditor();
  committeeModuleLoaded=false;
  await loadCommitteeModule(true);
  await openCommitteeDetail(committeeActiveId,true);
  committeeDetailMessage(data.message || 'Integrante guardado correctamente.','success');
}

function renderCommitteeMembersTable(record) {
  const body=document.getElementById('committeeMembersBody');
  if (!body) return;

  const rows=committeeRecordMembers(record.id);
  const canManage=committeeCanManage(record);

  if (!rows.length) {
    body.innerHTML='<tr><td colspan="9" class="table-empty">Todavía no se han registrado integrantes.</td></tr>';
    return;
  }

  const roleOrder={PRESIDENTE:1,SECRETARIO:2,VOCAL:3,MIEMBRO:4};
  const sorted=[...rows].sort((a,b)=>{
    if (a.activo!==b.activo) return a.activo ? -1 : 1;
    const ar=roleOrder[a.cargo_comite] || 99;
    const br=roleOrder[b.cargo_comite] || 99;
    if (ar!==br) return ar-br;
    return committeeWorkerName(a.trabajadores).localeCompare(committeeWorkerName(b.trabajadores),'es');
  });

  body.innerHTML=sorted.map(member=>{
    const worker=member.trabajadores || {};
    const validity=member.fecha_fin
      ? `${formatDatePE(member.fecha_inicio)} - ${formatDatePE(member.fecha_fin)}`
      : `Desde ${formatDatePE(member.fecha_inicio)}`;

    return `
      <tr>
        <td>${escapeHtml(worker.dni || '—')}</td>
        <td><strong>${escapeHtml(committeeWorkerName(worker))}</strong></td>
        <td><strong>${escapeHtml(worker.cargo || '—')}</strong><br><small>${escapeHtml(worker.area || '—')}</small></td>
        <td><span class="committee-representation ${String(member.representacion||'').toLowerCase()}">${member.representacion==='EMPLEADOR'?'Empleador':'Trabajadores'}</span></td>
        <td>${member.condicion==='TITULAR'?'Titular':'Suplente'}</td>
        <td><strong>${escapeHtml(member.cargo_comite || '—')}</strong></td>
        <td>${escapeHtml(validity)}</td>
        <td><span class="committee-member-status ${member.activo?'active':'inactive'}">${member.activo?'Activo':'Inactivo'}</span></td>
        <td>
          <div class="committee-member-actions">
            ${canManage ? `<button type="button" data-committee-member-edit="${member.id}">Editar</button>` : ''}
            ${canManage ? `<button type="button" class="${member.activo?'danger':'success'}" data-committee-member-toggle="${member.id}" data-next="${member.activo?'false':'true'}">${member.activo?'Desactivar':'Activar'}</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  body.querySelectorAll('[data-committee-member-edit]').forEach(button=>{
    button.addEventListener('click',()=>{
      const member=committeeMembers.find(x=>x.id===button.dataset.committeeMemberEdit);
      openCommitteeMemberEditor(member);
    });
  });

  body.querySelectorAll('[data-committee-member-toggle]').forEach(button=>{
    button.addEventListener('click',()=>{
      toggleCommitteeMember(
        button.dataset.committeeMemberToggle,
        button.dataset.next==='true'
      );
    });
  });
}

async function openCommitteeDetail(id,preserveMessage=false) {
  const record=committeeRecords.find(x=>x.id===id);
  if (!record) return;

  committeeActiveId=id;
  const modal=document.getElementById('committeeDetailModal');
  const unit=committeeUnitName(record);
  const active=committeeActiveMembers(id).length;
  const canManage=committeeCanManage(record);

  document.getElementById('committeeDetailTypeLabel').textContent=record.tipo==='SUBCOMITE'?'SUBCOMITÉ SST · PROYECTO':'COMITÉ SST · CORPORATIVO';
  document.getElementById('committeeDetailTitle').textContent=record.nombre || committeeTypeLabel(record.tipo);
  document.getElementById('committeeDetailSubtitle').textContent=`${unit}${record.numero_acta ? ` · ${record.numero_acta}` : ''}`;
  document.getElementById('committeeDetailCode').textContent=record.codigo || '—';
  document.getElementById('committeeDetailValidity').textContent=`${formatDatePE(record.vigencia_desde)} - ${formatDatePE(record.vigencia_hasta)}`;
  document.getElementById('committeeDetailStatus').textContent=committeeStatusLabel(record.estado);
  document.getElementById('committeeDetailMemberCount').textContent=String(active);

  document.getElementById('addCommitteeMemberButton')?.classList.toggle('hidden',!canManage);
  document.getElementById('editCommitteeFromDetailButton')?.classList.toggle('hidden',!canManage);

  if (!preserveMessage) committeeDetailMessage('');
  closeCommitteeMemberEditor();
  renderCommitteeMembersTable(record);

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closeCommitteeDetail() {
  const modal=document.getElementById('committeeDetailModal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden','true');
  closeCommitteeMemberEditor();
  committeeActiveId=null;
  document.body.classList.remove('modal-open');
}

async function toggleCommitteeMember(memberId,next) {
  const member=committeeMembers.find(x=>x.id===memberId);
  if (!member) return;

  const workerName=committeeWorkerName(member.trabajadores);
  if (!confirm(`¿Deseas ${next?'activar':'desactivar'} a ${workerName} como integrante?`)) return;

  const {data,error}=await client.rpc('cambiar_estado_integrante_comite',{
    p_integrante_id:memberId,
    p_activo:next
  });

  if (error || !data?.ok) {
    console.error(error,data);
    committeeDetailMessage(data?.error || error?.message || 'No fue posible actualizar al integrante.');
    return;
  }

  const activeId=committeeActiveId;
  committeeModuleLoaded=false;
  await loadCommitteeModule(true);
  await openCommitteeDetail(activeId,true);
  committeeDetailMessage(data.message || 'Estado actualizado correctamente.','success');
}

// ------------------------------------------------------------
// Eventos
// ------------------------------------------------------------
document.getElementById('newCommitteeButton')?.addEventListener('click',async()=>{
  if (!committeeModuleLoaded) await loadCommitteeModule(true);
  if (committeeModuleMode==='MEETINGS') {
    openCommitteeMeetingProgramModal();
  } else if (committeeModuleMode==='TRAININGS') {
    openCommitteeTrainingModal();
  } else if (committeeModuleMode==='CONFORMATIONS') {
    openCommitteeForm();
  }
});

document.getElementById('committeeTypeSiteButton')?.addEventListener('click',()=>{
  if (currentProfile?.rol_codigo==='PROYECTO') return;
  setCommitteeType('COMITE');
});

document.getElementById('committeeTypeProjectButton')?.addEventListener('click',()=>{
  setCommitteeType('SUBCOMITE');
});

document.getElementById('committeeSite')?.addEventListener('change',updateCommitteeGeneratedName);
document.getElementById('committeeProject')?.addEventListener('change',updateCommitteeGeneratedName);

document.getElementById('committeeForm')?.addEventListener('submit',saveCommitteeForm);
document.getElementById('closeCommitteeFormModal')?.addEventListener('click',closeCommitteeForm);
document.getElementById('cancelCommitteeFormModal')?.addEventListener('click',closeCommitteeForm);
document.getElementById('committeeFormModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closeCommitteeForm);

document.getElementById('closeCommitteeDetailModal')?.addEventListener('click',closeCommitteeDetail);
document.getElementById('closeCommitteeDetailBottom')?.addEventListener('click',closeCommitteeDetail);
document.getElementById('committeeDetailModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closeCommitteeDetail);

document.getElementById('editCommitteeFromDetailButton')?.addEventListener('click',()=>{
  const record=committeeRecords.find(x=>x.id===committeeActiveId);
  if (!record) return;
  closeCommitteeDetail();
  openCommitteeForm(record);
});

document.getElementById('addCommitteeMemberButton')?.addEventListener('click',()=>openCommitteeMemberEditor());
document.getElementById('closeCommitteeMemberEditor')?.addEventListener('click',closeCommitteeMemberEditor);
document.getElementById('cancelCommitteeMemberButton')?.addEventListener('click',closeCommitteeMemberEditor);
document.getElementById('searchCommitteeWorkerButton')?.addEventListener('click',searchCommitteeWorker);
document.getElementById('saveCommitteeMemberButton')?.addEventListener('click',saveCommitteeMember);

document.getElementById('committeeMemberDni')?.addEventListener('input',event=>{
  event.target.value=event.target.value.replace(/\D/g,'').slice(0,8);
  committeeSelectedWorker=null;
  document.getElementById('committeeMemberWorkerId').value='';
  document.getElementById('committeeWorkerFound')?.classList.add('hidden');
});

document.getElementById('committeeMemberDni')?.addEventListener('keydown',event=>{
  if (event.key==='Enter') {
    event.preventDefault();
    searchCommitteeWorker();
  }
});

document.getElementById('committeeSearch')?.addEventListener('input',renderCommitteeList);
document.getElementById('committeeTypeFilter')?.addEventListener('change',renderCommitteeList);
document.getElementById('committeeStatusFilter')?.addEventListener('change',renderCommitteeList);
document.getElementById('refreshCommitteeButton')?.addEventListener('click',()=>{
  committeeModuleLoaded=false;
  loadCommitteeModule(true);
});



// ============================================================
// ETAPA 16B · REUNIONES Y ACTAS DEL COMITÉ / SUBCOMITÉ SST
// ============================================================

function setCommitteeModuleMode(mode) {
  committeeModuleMode=['MEETINGS','AGREEMENTS','TRAININGS'].includes(mode) ? mode : 'CONFORMATIONS';

  document.getElementById('committeeConformationsTab')?.classList.toggle('active',committeeModuleMode==='CONFORMATIONS');
  document.getElementById('committeeMeetingsTab')?.classList.toggle('active',committeeModuleMode==='MEETINGS');
  document.getElementById('committeeAgreementsTab')?.classList.toggle('active',committeeModuleMode==='AGREEMENTS');
  document.getElementById('committeeTrainingsTab')?.classList.toggle('active',committeeModuleMode==='TRAININGS');

  document.getElementById('committeeConformationsStats')?.classList.toggle('hidden',committeeModuleMode!=='CONFORMATIONS');
  document.getElementById('committeeConformationsPanel')?.classList.toggle('hidden',committeeModuleMode!=='CONFORMATIONS');
  document.getElementById('committeeMeetingsView')?.classList.toggle('hidden',committeeModuleMode!=='MEETINGS');
  document.getElementById('committeeAgreementsView')?.classList.toggle('hidden',committeeModuleMode!=='AGREEMENTS');
  document.getElementById('committeeTrainingsView')?.classList.toggle('hidden',committeeModuleMode!=='TRAININGS');

  const button=document.getElementById('newCommitteeButton');
  if (button) {
    button.classList.toggle('hidden',committeeModuleMode==='AGREEMENTS');
    button.textContent=
      committeeModuleMode==='MEETINGS' ? '+ Programar reunión'
      : committeeModuleMode==='TRAININGS' ? '+ Nueva capacitación'
      : '+ Nueva conformación';
  }

  if (committeeModuleMode==='MEETINGS') {
    loadCommitteeMeetingsModule();
  } else if (committeeModuleMode==='AGREEMENTS') {
    loadCommitteeAgreementsModule();
  } else if (committeeModuleMode==='TRAININGS') {
    loadCommitteeTrainingsModule();
  }
}

function committeeMeetingProgramMessage(message='',type='error') {
  const el=document.getElementById('committeeMeetingProgramMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function committeeMeetingEditorMessage(message='',type='error') {
  const el=document.getElementById('committeeMeetingEditorMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function committeeMeetingCommittee(record) {
  if (!record) return null;
  return record.comites_sst || committeeRecords.find(x=>x.id===record.comite_id) || null;
}

function committeeMeetingCanManage(record) {
  return committeeCanManage(committeeMeetingCommittee(record));
}

function committeeMeetingStatusLabel(status) {
  return {
    PROGRAMADA:'PROGRAMADA',
    BORRADOR:'BORRADOR',
    EN_FIRMA:'EN FIRMA',
    CERRADA:'CERRADA'
  }[status] || status || '—';
}

function committeeMeetingStatusClass(status) {
  return String(status || '').toLowerCase();
}

function formatCommitteeTime(value) {
  if (!value) return '—';
  return String(value).slice(0,5);
}

function formatCommitteeTime12(value) {
  if (!value) return '—';
  const [hh,mm]=String(value).slice(0,5).split(':').map(Number);
  if (Number.isNaN(hh)) return value;
  const suffix=hh>=12?'p.m.':'a.m.';
  const hour=(hh%12)||12;
  return `${hour}:${String(mm||0).padStart(2,'0')} ${suffix}`;
}

function committeeMonthLabel(value) {
  if (!value) return '—';
  const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre'];
  const parts=String(value).split('-');
  const y=Number(parts[0]);
  const m=Number(parts[1]);
  if (!y || !m) return value;
  return `${months[m-1] || parts[1]} de ${y}`;
}

function meetingDatePhrase(value) {
  if (!value) return '—';
  const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre'];
  const [y,m,d]=String(value).split('-').map(Number);
  if (!y || !m || !d) return value;
  return `${d} días del mes de ${months[m-1]} del año ${y}`;
}

function populateCommitteeMeetingSelectors() {
  const selects=[
    document.getElementById('committeeMeetingCommittee'),
    document.getElementById('committeeMeetingCommitteeFilter')
  ];

  selects.forEach((select,index)=>{
    if (!select) return;
    const current=select.value;
    const first=index===0
      ? '<option value="">Seleccione una conformación</option>'
      : '<option value="">Todos los Comités/Subcomités</option>';

    const items=committeeRecords
      .filter(x=>index!==0 || x.estado==='ACTIVO')
      .map(x=>{
        const unit=committeeUnitName(x);
        const type=x.tipo==='SUBCOMITE'?'Subcomité':'Comité';
        return `<option value="${x.id}">${escapeHtml(type)} · ${escapeHtml(unit)} · ${escapeHtml(x.codigo || '')}</option>`;
      }).join('');

    select.innerHTML=first+items;
    if ([...select.options].some(o=>o.value===current)) select.value=current;
  });
}

function updateCommitteeMeetingStats() {
  const total=committeeMeetingRecords.length;
  const scheduled=committeeMeetingRecords.filter(x=>x.estado==='PROGRAMADA').length;
  const closed=committeeMeetingRecords.filter(x=>x.estado==='CERRADA').length;
  const visibleCommitteeIds=new Set(committeeRecords.map(x=>x.id));
  const pending=committeeMeetingAgreements.filter(x=>visibleCommitteeIds.has(x.comite_id) && x.estado!=='CERRADO').length;

  const map={
    committeeMeetingTotalCount:total,
    committeeMeetingScheduledCount:scheduled,
    committeeMeetingClosedCount:closed,
    committeeMeetingAgreementCount:pending
  };
  Object.entries(map).forEach(([id,value])=>{
    const el=document.getElementById(id);
    if (el) el.textContent=String(value);
  });
}

function renderCommitteeMeetingList() {
  const list=document.getElementById('committeeMeetingList');
  if (!list) return;

  const q=(document.getElementById('committeeMeetingSearch')?.value || '').trim().toLowerCase();
  const committeeId=document.getElementById('committeeMeetingCommitteeFilter')?.value || '';
  const status=document.getElementById('committeeMeetingStatusFilter')?.value || '';

  const rows=committeeMeetingRecords.filter(record=>{
    if (committeeId && record.comite_id!==committeeId) return false;
    if (status && record.estado!==status) return false;

    const committee=committeeMeetingCommittee(record);
    const hay=[
      record.numero_acta,
      committee?.nombre,
      committee?.codigo,
      committeeUnitName(committee),
      record.lugar,
      record.tipo_reunion
    ].filter(Boolean).join(' ').toLowerCase();

    return !q || hay.includes(q);
  });

  if (!rows.length) {
    list.innerHTML='<div class="training-library-empty">No se encontraron reuniones.</div>';
    return;
  }

  list.innerHTML=rows.map(record=>{
    const committee=committeeMeetingCommittee(record);
    const canManage=committeeMeetingCanManage(record);
    const attendees=committeeMeetingAttendees.filter(x=>x.reunion_id===record.id);
    const present=attendees.filter(x=>x.presente).length;
    const total=attendees.length;
    const evidence=committeeMeetingEvidences.filter(x=>x.reunion_id===record.id).length;
    const agreements=committeeMeetingAgreements.filter(x=>x.reunion_id===record.id).length;
    const signed=attendees.filter(x=>x.firmado_at && x.consentimiento_firma).length;
    const unit=committeeUnitName(committee);

    return `
      <article class="committee-meeting-card">
        <div class="committee-meeting-card-icon ${committee?.tipo==='SUBCOMITE'?'project':'site'}">▤</div>
        <div class="committee-meeting-card-main">
          <div class="committee-meeting-card-top">
            <div>
              <span class="eyebrow">${committee?.tipo==='SUBCOMITE'?'SUBCOMITÉ SST · PROYECTO':'COMITÉ SST · CORPORATIVO'}</span>
              <h4>Acta N° ${escapeHtml(record.numero_acta || '—')}</h4>
              <p>${escapeHtml(committee?.nombre || '—')} · ${escapeHtml(unit)}</p>
            </div>
            <span class="committee-status ${committeeMeetingStatusClass(record.estado)}">${escapeHtml(committeeMeetingStatusLabel(record.estado))}</span>
          </div>

          <div class="committee-meeting-card-meta">
            <span>▣ ${escapeHtml(formatDatePE(record.fecha))}</span>
            <span>◷ ${escapeHtml(formatCommitteeTime(record.hora_inicio))}${record.hora_fin ? ` - ${escapeHtml(formatCommitteeTime(record.hora_fin))}` : ''}</span>
            <span>${record.tipo_reunion==='EXTRAORDINARIA'?'Extraordinaria':'Ordinaria'}</span>
            <span>Resultados: ${escapeHtml(committeeMonthLabel(record.mes_resultados))}</span>
            <span>${present}/${total} presentes</span>
            <span>${evidence} imagen(es)</span>
            <span>${agreements} acuerdo(s)</span>
            <span>${signed}/${total} firma(s)</span>
          </div>
        </div>

        <div class="committee-meeting-card-actions">
          <button class="committee-manage-btn" type="button" data-committee-meeting-open="${record.id}">${canManage?'Desarrollar':'Ver reunión'}</button>
          <button class="meeting-pdf-outline" type="button" data-committee-meeting-pdf="${record.id}">Acta PDF</button>
          ${canManage && record.estado==='EN_FIRMA' ? `<button class="meeting-share-sign-btn" type="button" data-committee-meeting-share-sign="${record.id}">Compartir firma</button>` : ''}
          ${canManage ? `<button class="secondary-btn" type="button" data-committee-meeting-edit="${record.id}">Editar datos</button>` : ''}
          ${canManage ? `<button class="induction-delete-btn" type="button" data-committee-meeting-delete="${record.id}">Eliminar</button>` : ''}
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-committee-meeting-open]').forEach(button=>{
    button.addEventListener('click',()=>openCommitteeMeetingEditor(button.dataset.committeeMeetingOpen));
  });

  list.querySelectorAll('[data-committee-meeting-pdf]').forEach(button=>{
    button.addEventListener('click',()=>downloadCommitteeMeetingMinutesById(button.dataset.committeeMeetingPdf,button));
  });

  list.querySelectorAll('[data-committee-meeting-share-sign]').forEach(button=>{
    button.addEventListener('click',()=>{
      const record=committeeMeetingRecords.find(x=>x.id===button.dataset.committeeMeetingShareSign);
      if (record) shareCommitteeMeetingSignatureLink(record);
    });
  });

  list.querySelectorAll('[data-committee-meeting-edit]').forEach(button=>{
    button.addEventListener('click',()=>{
      const record=committeeMeetingRecords.find(x=>x.id===button.dataset.committeeMeetingEdit);
      openCommitteeMeetingProgramModal(record);
    });
  });

  list.querySelectorAll('[data-committee-meeting-delete]').forEach(button=>{
    button.addEventListener('click',()=>deleteCommitteeMeeting(button.dataset.committeeMeetingDelete));
  });
}

async function loadCommitteeMeetingsModule(force=false) {
  if (!client) return;
  if (!committeeModuleLoaded) await loadCommitteeModule(true);

  if (committeeMeetingsLoaded && !force) {
    populateCommitteeMeetingSelectors();
    updateCommitteeMeetingStats();
    renderCommitteeMeetingList();
    return;
  }

  const [meetings,attendees,evidences,agreements]=await Promise.all([
    client.from('comite_sst_reuniones')
      .select('*,comites_sst(id,codigo,tipo,nombre,sede_id,proyecto_id,estado)')
      .order('fecha',{ascending:false})
      .order('hora_inicio',{ascending:false}),
    client.from('comite_sst_reunion_asistentes')
      .select('id,reunion_id,integrante_id,presente,observacion,firma_electronica,consentimiento_firma,consentimiento_texto,firmado_at,user_agent,comite_sst_integrantes(id,comite_id,trabajador_id,representacion,condicion,cargo_comite,fecha_inicio,fecha_fin,activo,trabajadores(id,dni,nombres,apellidos,cargo,area,sede_id,proyecto_id,activo))'),
    client.from('comite_sst_reunion_evidencias')
      .select('*')
      .order('orden',{ascending:true}),
    client.from('comite_sst_acuerdos')
      .select('*')
      .order('created_at',{ascending:true})
  ]);

  const errors=[meetings.error,attendees.error,evidences.error,agreements.error].filter(Boolean);
  if (errors.length) {
    console.error(errors);
    committeeMessage(errors[0].message || 'No fue posible cargar las reuniones del Comité SST.');
    return;
  }

  committeeMeetingRecords=meetings.data || [];
  committeeMeetingAttendees=attendees.data || [];
  committeeMeetingEvidences=evidences.data || [];
  committeeMeetingAgreements=agreements.data || [];
  committeeMeetingsLoaded=true;

  if (committeeModuleMode==='AGREEMENTS') {
    committeeAgreementsLoaded=false;
  }

  populateCommitteeMeetingSelectors();
  updateCommitteeMeetingStats();
  renderCommitteeMeetingList();
}

function openCommitteeMeetingProgramModal(record=null) {
  if (!committeeModuleLoaded) return;

  committeeMeetingProgramMessage('');
  const modal=document.getElementById('committeeMeetingProgramModal');
  document.getElementById('committeeMeetingProgramId').value=record?.id || '';
  document.getElementById('committeeMeetingProgramTitle').textContent=record ? `Editar programación · Acta ${record.numero_acta || ''}` : 'Nueva reunión';

  populateCommitteeMeetingSelectors();

  document.getElementById('committeeMeetingCommittee').value=record?.comite_id || '';
  document.getElementById('committeeMeetingCommittee').disabled=!!record;
  document.getElementById('committeeMeetingActNumber').value=record?.numero_acta || '';
  document.getElementById('committeeMeetingType').value=record?.tipo_reunion || 'ORDINARIA';
  document.getElementById('committeeMeetingStatus').value=record?.estado || 'PROGRAMADA';

  const today=new Date().toISOString().slice(0,10);
  document.getElementById('committeeMeetingDate').value=record?.fecha || today;
  document.getElementById('committeeMeetingStartTime').value=record?.hora_inicio ? String(record.hora_inicio).slice(0,5) : '16:00';
  document.getElementById('committeeMeetingEndTime').value=record?.hora_fin ? String(record.hora_fin).slice(0,5) : '';
  document.getElementById('committeeMeetingPlace').value=record?.lugar || 'Lima';

  const baseMonth=record?.mes_resultados
    ? String(record.mes_resultados).slice(0,7)
    : new Date(new Date().setMonth(new Date().getMonth()-1)).toISOString().slice(0,7);
  document.getElementById('committeeMeetingResultsMonth').value=baseMonth;
  document.getElementById('committeeMeetingProgramNotes').value=record?.observaciones || '';

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closeCommitteeMeetingProgramModal() {
  const modal=document.getElementById('committeeMeetingProgramModal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden','true');
  document.getElementById('committeeMeetingCommittee').disabled=false;
  document.body.classList.remove('modal-open');
}

async function saveCommitteeMeetingProgram(event) {
  event.preventDefault();
  committeeMeetingProgramMessage('');

  const id=document.getElementById('committeeMeetingProgramId').value || null;
  const comite_id=document.getElementById('committeeMeetingCommittee').value || null;
  const numero_acta=document.getElementById('committeeMeetingActNumber').value.trim();
  const tipo_reunion=document.getElementById('committeeMeetingType').value;
  const estado=document.getElementById('committeeMeetingStatus').value;
  const fecha=document.getElementById('committeeMeetingDate').value;
  const hora_inicio=document.getElementById('committeeMeetingStartTime').value;
  const hora_fin=document.getElementById('committeeMeetingEndTime').value || null;
  const lugar=document.getElementById('committeeMeetingPlace').value.trim();
  const month=document.getElementById('committeeMeetingResultsMonth').value;
  const mes_resultados=month ? `${month}-01` : null;
  const observaciones=document.getElementById('committeeMeetingProgramNotes').value.trim() || null;

  if (!comite_id || !numero_acta || !fecha || !hora_inicio || !lugar || !mes_resultados) {
    committeeMeetingProgramMessage('Completa número de acta, Comité/Subcomité, fecha, hora de inicio, lugar y mes de resultados.');
    return;
  }

  const duplicateAct=committeeMeetingRecords.find(x=>
    x.id!==id &&
    x.comite_id===comite_id &&
    String(x.numero_acta || '').trim().toLowerCase()===numero_acta.toLowerCase()
  );
  if (duplicateAct) {
    committeeMeetingProgramMessage(`Ya existe el Acta N° ${numero_acta} para esta conformación. Coloca otro número.`);
    return;
  }

  const committee=committeeRecords.find(x=>x.id===comite_id);
  if (!committee || !committeeCanManage(committee)) {
    committeeMeetingProgramMessage('No tienes permiso para programar una reunión para esta conformación.');
    return;
  }

  const payload={
    comite_id,numero_acta,tipo_reunion,fecha,hora_inicio,hora_fin,lugar,mes_resultados,
    observaciones,estado
  };
  if (!id) payload.created_by=currentProfile?.id || null;

  const button=document.getElementById('saveCommitteeMeetingProgramButton');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Guardando…';

  const result=id
    ? await client.from('comite_sst_reuniones').update(payload).eq('id',id).select().single()
    : await client.from('comite_sst_reuniones').insert(payload).select().single();

  button.disabled=false;
  button.textContent=old;

  if (result.error) {
    console.error(result.error);
    committeeMeetingProgramMessage(result.error.message || 'No fue posible guardar la reunión.');
    return;
  }

  closeCommitteeMeetingProgramModal();
  committeeMeetingsLoaded=false;
  await loadCommitteeMeetingsModule(true);
  await openCommitteeMeetingEditor(result.data.id);
}

function meetingRowInput(value='',placeholder='',cls='') {
  return `<textarea class="${cls}" rows="2" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value || '')}</textarea>`;
}

function renderCommitteeMeetingAgenda(record) {
  const container=document.getElementById('committeeMeetingAgendaOptions');
  if (!container) return;

  const selected=Array.isArray(record.agenda) ? record.agenda : COMMITTEE_BASE_AGENDA;
  container.innerHTML=COMMITTEE_BASE_AGENDA.map((item,index)=>`
    <label class="meeting-agenda-option">
      <input type="checkbox" data-meeting-agenda-index="${index}" ${selected.includes(item)?'checked':''} />
      <span>${escapeHtml(item)}</span>
    </label>
  `).join('');

  committeeMeetingAdditionalAgenda=Array.isArray(record.agenda_adicional) ? [...record.agenda_adicional] : [];
  renderCommitteeMeetingAdditionalAgenda();
}

function renderCommitteeMeetingAdditionalAgenda() {
  const list=document.getElementById('committeeMeetingAdditionalAgendaList');
  if (!list) return;
  list.innerHTML=committeeMeetingAdditionalAgenda.map((item,index)=>`
    <span class="meeting-chip">${escapeHtml(item)}<button type="button" data-remove-meeting-agenda="${index}">×</button></span>
  `).join('');

  list.querySelectorAll('[data-remove-meeting-agenda]').forEach(button=>{
    button.addEventListener('click',()=>{
      committeeMeetingAdditionalAgenda.splice(Number(button.dataset.removeMeetingAgenda),1);
      renderCommitteeMeetingAdditionalAgenda();
    });
  });
}

function renderCommitteeMeetingIncidents(rows=[]) {
  const container=document.getElementById('committeeMeetingIncidentsRows');
  if (!container) return;
  const data=rows.length ? rows : [{incidente:'',comentarios:''}];

  container.innerHTML=data.map((row,index)=>`
    <div class="meeting-row-card" data-meeting-incident-row>
      <span class="meeting-row-number">${index+1}</span>
      <label><span>Incidente / accidente</span>${meetingRowInput(row.incidente,'Descripción del evento','meeting-incident-event')}</label>
      <label><span>Comentarios / plan de acción</span>${meetingRowInput(row.comentarios,'Comentarios o plan de acción','meeting-incident-comments')}</label>
      <button class="meeting-row-remove" type="button" data-remove-meeting-incident="${index}">×</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-remove-meeting-incident]').forEach(button=>{
    button.addEventListener('click',()=>{
      const current=collectMeetingIncidentRows();
      current.splice(Number(button.dataset.removeMeetingIncident),1);
      renderCommitteeMeetingIncidents(current);
    });
  });
}

function collectMeetingIncidentRows() {
  return [...document.querySelectorAll('[data-meeting-incident-row]')].map(row=>({
    incidente:row.querySelector('.meeting-incident-event')?.value.trim() || '',
    comentarios:row.querySelector('.meeting-incident-comments')?.value.trim() || ''
  })).filter(x=>x.incidente || x.comentarios);
}

function renderCommitteeMeetingObjectives(rows=[]) {
  const container=document.getElementById('committeeMeetingObjectivesRows');
  if (!container) return;
  const data=rows.length ? rows : [{tema:'',comentarios:''},{tema:'',comentarios:''}];

  container.innerHTML=data.map((row,index)=>`
    <div class="meeting-row-card" data-meeting-objective-row>
      <span class="meeting-row-number">${index+1}</span>
      <label><span>Tema</span>${meetingRowInput(row.tema,'Objetivo o asunto relevante','meeting-objective-topic')}</label>
      <label><span>Comentarios / repercusión</span>${meetingRowInput(row.comentarios,'Comentarios o repercusión','meeting-objective-comments')}</label>
      <button class="meeting-row-remove" type="button" data-remove-meeting-objective="${index}">×</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-remove-meeting-objective]').forEach(button=>{
    button.addEventListener('click',()=>{
      const current=collectMeetingObjectiveRows();
      current.splice(Number(button.dataset.removeMeetingObjective),1);
      renderCommitteeMeetingObjectives(current);
    });
  });
}

function collectMeetingObjectiveRows() {
  return [...document.querySelectorAll('[data-meeting-objective-row]')].map(row=>({
    tema:row.querySelector('.meeting-objective-topic')?.value.trim() || '',
    comentarios:row.querySelector('.meeting-objective-comments')?.value.trim() || ''
  })).filter(x=>x.tema || x.comentarios);
}

function renderCommitteeMeetingSubcommitteeRows(rows=[]) {
  const container=document.getElementById('committeeMeetingSubcommitteeRows');
  if (!container) return;
  const data=rows.length ? rows : [{proyecto:'',acuerdo:'',acciones:'',estado:''}];

  container.innerHTML=data.map((row,index)=>`
    <div class="meeting-row-card meeting-row-four" data-meeting-subcommittee-row>
      <span class="meeting-row-number">${index+1}</span>
      <label><span>Proyecto</span><input class="meeting-sub-project" value="${escapeHtml(row.proyecto || '')}" /></label>
      <label><span>Acuerdo</span><textarea class="meeting-sub-agreement" rows="2">${escapeHtml(row.acuerdo || '')}</textarea></label>
      <label><span>Acciones</span><textarea class="meeting-sub-actions" rows="2">${escapeHtml(row.acciones || '')}</textarea></label>
      <label><span>Estado</span><input class="meeting-sub-status" value="${escapeHtml(row.estado || '')}" placeholder="Pendiente / Cerrado" /></label>
      <button class="meeting-row-remove" type="button" data-remove-meeting-sub="${index}">×</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-remove-meeting-sub]').forEach(button=>{
    button.addEventListener('click',()=>{
      const current=collectMeetingSubcommitteeRows();
      current.splice(Number(button.dataset.removeMeetingSub),1);
      renderCommitteeMeetingSubcommitteeRows(current);
    });
  });
}

function collectMeetingSubcommitteeRows() {
  return [...document.querySelectorAll('[data-meeting-subcommittee-row]')].map(row=>({
    proyecto:row.querySelector('.meeting-sub-project')?.value.trim() || '',
    acuerdo:row.querySelector('.meeting-sub-agreement')?.value.trim() || '',
    acciones:row.querySelector('.meeting-sub-actions')?.value.trim() || '',
    estado:row.querySelector('.meeting-sub-status')?.value.trim() || ''
  })).filter(x=>x.proyecto || x.acuerdo || x.acciones || x.estado);
}

function previousCommitteeMeetingAgreements(meeting) {
  return committeeMeetingAgreements.filter(a=>
    a.comite_id===meeting.comite_id &&
    a.reunion_id!==meeting.id &&
    a.estado!=='CERRADO'
  );
}

function renderCommitteeMeetingPreviousAgreements(meeting) {
  const container=document.getElementById('committeeMeetingPreviousAgreements');
  if (!container) return;

  const rows=previousCommitteeMeetingAgreements(meeting);
  if (!rows.length) {
    container.innerHTML='<div class="meeting-empty-note">No existen acuerdos pendientes de reuniones anteriores.</div>';
    return;
  }

  container.innerHTML=`
    <div class="meeting-previous-table">
      <div class="meeting-previous-head"><span>N°</span><span>Tema</span><span>Responsable</span><span>Estado</span></div>
      ${rows.map((row,index)=>`
        <div class="meeting-previous-row">
          <span>${index+1}</span>
          <span>${escapeHtml(row.accion)}</span>
          <span>${escapeHtml(row.responsable || '—')}</span>
          <span><b>${escapeHtml(row.estado)}</b></span>
        </div>
      `).join('')}
    </div>
  `;
}


function renderCommitteeMeetingPreviousManualRows(rows=[]) {
  const container=document.getElementById('committeeMeetingPreviousManualRows');
  if (!container) return;
  const data=rows.length ? rows : [];

  if (!data.length) {
    container.innerHTML='<div class="meeting-empty-note">No hay texto manual adicional. Usa “Agregar texto” si necesitas incorporar un pendiente que no proviene del historial automático.</div>';
    return;
  }

  container.innerHTML=data.map((row,index)=>`
    <div class="meeting-row-card meeting-previous-manual-row" data-meeting-previous-manual-row>
      <span class="meeting-row-number">${index+1}</span>
      <label><span>Tema / pendiente</span><textarea class="meeting-prev-manual-topic" rows="2">${escapeHtml(row.tema || '')}</textarea></label>
      <label><span>Responsable</span><input class="meeting-prev-manual-responsible" value="${escapeHtml(row.responsable || '')}" /></label>
      <label><span>Estado</span><input class="meeting-prev-manual-status" value="${escapeHtml(row.estado || '')}" placeholder="Pendiente / En proceso / Cerrado" /></label>
      <button class="meeting-row-remove" type="button" data-remove-meeting-prev-manual="${index}">×</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-remove-meeting-prev-manual]').forEach(button=>{
    button.addEventListener('click',()=>{
      const current=collectCommitteeMeetingPreviousManualRows();
      current.splice(Number(button.dataset.removeMeetingPrevManual),1);
      renderCommitteeMeetingPreviousManualRows(current);
    });
  });
}

function collectCommitteeMeetingPreviousManualRows() {
  return [...document.querySelectorAll('[data-meeting-previous-manual-row]')].map(row=>({
    tema:row.querySelector('.meeting-prev-manual-topic')?.value.trim() || '',
    responsable:row.querySelector('.meeting-prev-manual-responsible')?.value.trim() || '',
    estado:row.querySelector('.meeting-prev-manual-status')?.value.trim() || ''
  })).filter(x=>x.tema || x.responsable || x.estado);
}

function renderCommitteeMeetingAgreements(rows=[]) {
  const container=document.getElementById('committeeMeetingAgreementsRows');
  if (!container) return;
  const data=rows.length ? rows : [{accion:'',responsable:'',fecha_cumplimiento:''}];

  container.innerHTML=data.map((row,index)=>`
    <div class="meeting-row-card meeting-agreement-row" data-meeting-agreement-row data-agreement-id="${escapeHtml(row.id || '')}">
      <span class="meeting-row-number">${index+1}</span>
      <label><span>Acción requerida</span><textarea class="meeting-agreement-action" rows="2">${escapeHtml(row.accion || '')}</textarea></label>
      <label><span>Persona responsable</span><input class="meeting-agreement-responsible" list="committeeMeetingResponsibleOptions" value="${escapeHtml(row.responsable || '')}" /></label>
      <label><span>Fecha de cumplimiento</span><input class="meeting-agreement-date" type="date" value="${escapeHtml(row.fecha_cumplimiento || '')}" /></label>
      ${row.id ? `<span class="meeting-agreement-status-chip ${String(row.estado||'PENDIENTE').toLowerCase()}">${escapeHtml((row.estado||'PENDIENTE').replace('_',' '))}</span>` : ''}
      <button class="meeting-row-remove" type="button" data-remove-meeting-agreement="${index}">×</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-remove-meeting-agreement]').forEach(button=>{
    button.addEventListener('click',()=>{
      const current=collectMeetingAgreementRows();
      current.splice(Number(button.dataset.removeMeetingAgreement),1);
      renderCommitteeMeetingAgreements(current);
    });
  });
}

function collectMeetingAgreementRows() {
  return [...document.querySelectorAll('[data-meeting-agreement-row]')].map(row=>({
    id:row.dataset.agreementId || null,
    accion:row.querySelector('.meeting-agreement-action')?.value.trim() || '',
    responsable:row.querySelector('.meeting-agreement-responsible')?.value.trim() || '',
    fecha_cumplimiento:row.querySelector('.meeting-agreement-date')?.value || null
  })).filter(x=>x.accion || x.responsable || x.fecha_cumplimiento);
}

function renderCommitteeMeetingResponsibleOptions(meeting) {
  const list=document.getElementById('committeeMeetingResponsibleOptions');
  if (!list) return;
  const attendees=committeeMeetingAttendees.filter(x=>x.reunion_id===meeting.id);
  list.innerHTML=attendees.map(a=>{
    const worker=a.comite_sst_integrantes?.trabajadores;
    return `<option value="${escapeHtml(committeeWorkerName(worker))}"></option>`;
  }).join('');
}

function renderCommitteeMeetingAttendance(meeting) {
  const body=document.getElementById('committeeMeetingAttendanceBody');
  if (!body) return;

  const rows=committeeMeetingAttendees.filter(x=>x.reunion_id===meeting.id);
  if (!rows.length) {
    body.innerHTML='<tr><td colspan="5" class="table-empty">No hay integrantes sincronizados.</td></tr>';
    return;
  }

  const roleOrder={PRESIDENTE:1,SECRETARIO:2,VOCAL:3,MIEMBRO:4};
  rows.sort((a,b)=>{
    const ar=roleOrder[a.comite_sst_integrantes?.cargo_comite] || 99;
    const br=roleOrder[b.comite_sst_integrantes?.cargo_comite] || 99;
    return ar-br;
  });

  body.innerHTML=rows.map(row=>{
    const member=row.comite_sst_integrantes || {};
    const worker=member.trabajadores || {};
    return `
      <tr>
        <td><input class="meeting-attendance-check" type="checkbox" data-attendance-id="${row.id}" ${row.presente?'checked':''} /></td>
        <td>${escapeHtml(worker.dni || '—')}</td>
        <td><strong>${escapeHtml(committeeWorkerName(worker))}</strong></td>
        <td>${escapeHtml(member.cargo_comite || '—')}</td>
        <td>${member.representacion==='EMPLEADOR'?'Empleador':'Trabajadores'}</td>
      </tr>
    `;
  }).join('');
}

function renderCommitteeMeetingEvidence(meeting) {
  const grid=document.getElementById('committeeMeetingEvidenceGrid');
  if (!grid) return;
  const rows=committeeMeetingEvidences.filter(x=>x.reunion_id===meeting.id);

  if (!rows.length) {
    grid.innerHTML='<div class="meeting-empty-note">Todavía no se han cargado imágenes de inspección.</div>';
    return;
  }

  grid.innerHTML=rows.map((row,index)=>`
    <article class="meeting-evidence-card" data-evidence-id="${row.id}">
      <img src="${escapeHtml(row.url)}" alt="Evidencia ${index+1}" />
      <div>
        <span>Evidencia ${index+1}</span>
        <input class="meeting-evidence-description" value="${escapeHtml(row.descripcion || '')}" placeholder="Descripción / hallazgo / levantamiento" />
      </div>
      <button class="meeting-evidence-delete" type="button" data-delete-meeting-evidence="${row.id}">Eliminar</button>
    </article>
  `).join('');

  grid.querySelectorAll('[data-delete-meeting-evidence]').forEach(button=>{
    button.addEventListener('click',()=>deleteCommitteeMeetingEvidence(button.dataset.deleteMeetingEvidence));
  });
}

function fillCommitteeMeetingMetrics(record) {
  const sst=record.estadisticas_sst || {};
  document.getElementById('committeeMeetingIF').value=sst.if ?? 0;
  document.getElementById('committeeMeetingIS').value=sst.is ?? 0;
  document.getElementById('committeeMeetingIA').value=sst.ia ?? 0;
  document.getElementById('committeeMeetingSstComments').value=sst.comentarios || '';

  const so=record.estadisticas_so || {};
  document.getElementById('committeeMeetingOccupationalDiseases').value=so.enfermedades_ocupacionales ?? 0;
  document.getElementById('committeeMeetingExposedWorkers').value=so.trabajadores_expuestos ?? 0;
  document.getElementById('committeeMeetingIncidenceRate').value=so.tasa_incidencia ?? 0;
  document.getElementById('committeeMeetingWorkersWithDisease').value=so.trabajadores_con_enfermedad ?? 0;
  document.getElementById('committeeMeetingSoComments').value=so.comentarios || '';

  document.getElementById('committeeMeetingNextDate').value=record.proxima_fecha || '';
  document.getElementById('committeeMeetingNextTime').value=record.proxima_hora ? String(record.proxima_hora).slice(0,5) : '';
  document.getElementById('committeeMeetingNextAgenda').value=record.proxima_agenda || '';
  document.getElementById('committeeMeetingActualEndTime').value=record.hora_fin ? String(record.hora_fin).slice(0,5) : '';
}

async function openCommitteeMeetingEditor(id) {
  if (!committeeMeetingsLoaded) await loadCommitteeMeetingsModule(true);
  const record=committeeMeetingRecords.find(x=>x.id===id);
  if (!record) return;

  activeCommitteeMeetingId=id;
  const committee=committeeMeetingCommittee(record);
  const canManage=committeeMeetingCanManage(record);

  document.getElementById('committeeMeetingEditorType').textContent=
    committee?.tipo==='SUBCOMITE' ? 'ACTA DE REUNIÓN DEL SUBCOMITÉ SST' : 'ACTA DE REUNIÓN DEL COMITÉ SST';
  document.getElementById('committeeMeetingEditorTitle').textContent=`Acta N° ${record.numero_acta || '—'}`;
  document.getElementById('committeeMeetingEditorSubtitle').textContent=
    `${committee?.nombre || '—'} · ${committeeUnitName(committee)} · ${record.tipo_reunion==='EXTRAORDINARIA'?'Reunión extraordinaria':'Reunión ordinaria'}`;

  document.getElementById('committeeMeetingEditorActNumber').textContent=record.numero_acta || '—';
  document.getElementById('committeeMeetingEditorDate').textContent=formatDatePE(record.fecha);
  document.getElementById('committeeMeetingEditorTime').textContent=
    `${formatCommitteeTime(record.hora_inicio)}${record.hora_fin ? ` - ${formatCommitteeTime(record.hora_fin)}` : ''}`;
  document.getElementById('committeeMeetingEditorStatus').textContent=committeeMeetingStatusLabel(record.estado);

  renderCommitteeMeetingAgenda(record);
  renderCommitteeMeetingIncidents(Array.isArray(record.incidentes)?record.incidentes:[]);
  renderCommitteeMeetingObjectives(Array.isArray(record.objetivos_sst)?record.objetivos_sst:[]);
  renderCommitteeMeetingSubcommitteeRows(Array.isArray(record.acuerdos_subcomites)?record.acuerdos_subcomites:[]);
  renderCommitteeMeetingPreviousAgreements(record);
  renderCommitteeMeetingPreviousManualRows(Array.isArray(record.pendientes_adicionales)?record.pendientes_adicionales:[]);
  renderCommitteeMeetingAgreements(committeeMeetingAgreements.filter(x=>x.reunion_id===record.id));
  renderCommitteeMeetingResponsibleOptions(record);
  renderCommitteeMeetingAttendance(record);
  renderCommitteeMeetingEvidence(record);
  fillCommitteeMeetingMetrics(record);

  // Etapa 16B.2: el administrador puede editar el acta aun EN_FIRMA o CERRADA.
  // Las firmas ya registradas se conservan.
  const canEditContent=canManage;

  document.getElementById('saveCommitteeMeetingEditorButton').classList.toggle('hidden',!canEditContent);
  document.getElementById('closeCommitteeMeetingButton').classList.toggle('hidden',!canManage || record.estado==='CERRADA');
  document.getElementById('syncCommitteeMeetingAttendeesButton').classList.toggle('hidden',!canEditContent);
  document.getElementById('uploadCommitteeMeetingEvidenceButton').classList.toggle('hidden',!canEditContent);
  document.getElementById('committeeMeetingEvidenceFiles').disabled=!canEditContent;

  document.querySelectorAll('#committeeMeetingEditorModal input,#committeeMeetingEditorModal textarea,#committeeMeetingEditorModal select').forEach(el=>{
    if (!el.classList.contains('meeting-attendance-check') && el.id!=='committeeMeetingEvidenceFiles' && el.id!=='committeeMeetingSignatureLink') {
      el.disabled=!canEditContent;
    }
  });

  renderCommitteeMeetingSigningAdmin(record,canManage);

  const alreadySigned=committeeMeetingAttendees.filter(
    x=>x.reunion_id===record.id && x.firmado_at && x.consentimiento_firma
  ).length;

  if (alreadySigned>0 && canManage) {
    committeeMeetingEditorMessage(
      `Esta acta tiene ${alreadySigned} firma(s) registrada(s). Puedes editarla; las firmas existentes se conservarán.`,
      'success'
    );
  } else {
    committeeMeetingEditorMessage('');
  }
  const modal=document.getElementById('committeeMeetingEditorModal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closeCommitteeMeetingEditorModal() {
  const modal=document.getElementById('committeeMeetingEditorModal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden','true');
  activeCommitteeMeetingId=null;
  document.body.classList.remove('modal-open');
}

function collectCommitteeMeetingEditorPayload(record) {
  const agenda=COMMITTEE_BASE_AGENDA.filter((item,index)=>
    document.querySelector(`[data-meeting-agenda-index="${index}"]`)?.checked
  );

  return {
    agenda,
    agenda_adicional:[...committeeMeetingAdditionalAgenda],
    incidentes:collectMeetingIncidentRows(),
    estadisticas_sst:{
      if:Number(document.getElementById('committeeMeetingIF').value || 0),
      is:Number(document.getElementById('committeeMeetingIS').value || 0),
      ia:Number(document.getElementById('committeeMeetingIA').value || 0),
      comentarios:document.getElementById('committeeMeetingSstComments').value.trim()
    },
    estadisticas_so:{
      enfermedades_ocupacionales:Number(document.getElementById('committeeMeetingOccupationalDiseases').value || 0),
      trabajadores_expuestos:Number(document.getElementById('committeeMeetingExposedWorkers').value || 0),
      tasa_incidencia:Number(document.getElementById('committeeMeetingIncidenceRate').value || 0),
      trabajadores_con_enfermedad:Number(document.getElementById('committeeMeetingWorkersWithDisease').value || 0),
      comentarios:document.getElementById('committeeMeetingSoComments').value.trim()
    },
    objetivos_sst:collectMeetingObjectiveRows(),
    acuerdos_subcomites:collectMeetingSubcommitteeRows(),
    pendientes_adicionales:collectCommitteeMeetingPreviousManualRows(),
    proxima_fecha:document.getElementById('committeeMeetingNextDate').value || null,
    proxima_hora:document.getElementById('committeeMeetingNextTime').value || null,
    proxima_agenda:document.getElementById('committeeMeetingNextAgenda').value.trim() || null,
    hora_fin:document.getElementById('committeeMeetingActualEndTime').value || record.hora_fin || null
  };
}

async function persistCommitteeMeetingEditor(closeMeeting=false,silent=false) {
  if (!activeCommitteeMeetingId) return false;
  const record=committeeMeetingRecords.find(x=>x.id===activeCommitteeMeetingId);
  if (!record) return false;

  const payload=collectCommitteeMeetingEditorPayload(record);
  if (closeMeeting) {
    if (!payload.hora_fin) {
      if (!silent) committeeMeetingEditorMessage('Registra la hora real de culminación antes de cerrar la reunión.');
      return false;
    }
    payload.estado='CERRADA';
  }

  if (!silent) committeeMeetingEditorMessage('');

  const button=document.getElementById('saveCommitteeMeetingEditorButton');
  const old=button?.textContent || '';
  if (button && !silent) {
    button.disabled=true;
    button.textContent='Guardando…';
  }

  const {error}=await client.from('comite_sst_reuniones')
    .update(payload)
    .eq('id',activeCommitteeMeetingId);

  if (error) {
    console.error(error);
    if (!silent) committeeMeetingEditorMessage(error.message || 'No fue posible guardar el acta.');
    if (button && !silent) {button.disabled=false;button.textContent=old;}
    return false;
  }

  const attendanceUpdates=[...document.querySelectorAll('.meeting-attendance-check')].map(check=>
    client.from('comite_sst_reunion_asistentes')
      .update({presente:check.checked})
      .eq('id',check.dataset.attendanceId)
  );
  const attendanceResults=await Promise.all(attendanceUpdates);
  const attendanceError=attendanceResults.find(x=>x.error)?.error;
  if (attendanceError) {
    console.error(attendanceError);
    if (!silent) committeeMeetingEditorMessage(attendanceError.message || 'No fue posible guardar la asistencia.');
    if (button && !silent) {button.disabled=false;button.textContent=old;}
    return false;
  }

  const evidenceUpdates=[...document.querySelectorAll('.meeting-evidence-card')].map(card=>{
    const id=card.dataset.evidenceId;
    const descripcion=card.querySelector('.meeting-evidence-description')?.value.trim() || null;
    return client.from('comite_sst_reunion_evidencias').update({descripcion}).eq('id',id);
  });
  await Promise.all(evidenceUpdates);

  const agreements=collectMeetingAgreementRows();
  const existingMeetingAgreements=committeeMeetingAgreements.filter(x=>x.reunion_id===activeCommitteeMeetingId);
  const submittedIds=new Set(agreements.map(x=>x.id).filter(Boolean));

  // Actualiza los acuerdos existentes conservando su ID, estado, historial y evidencias.
  for (const agreement of agreements.filter(x=>x.id)) {
    const updateResult=await client.from('comite_sst_acuerdos')
      .update({
        accion:agreement.accion || '—',
        responsable:agreement.responsable || '—',
        fecha_cumplimiento:agreement.fecha_cumplimiento
      })
      .eq('id',agreement.id);

    if (updateResult.error) {
      console.error(updateResult.error);
      if (!silent) committeeMeetingEditorMessage(updateResult.error.message || 'No fue posible actualizar un acuerdo.');
      if (button && !silent) {button.disabled=false;button.textContent=old;}
      return false;
    }
  }

  // Inserta únicamente acuerdos nuevos.
  const newAgreements=agreements.filter(x=>!x.id);
  if (newAgreements.length) {
    const insertResult=await client.from('comite_sst_acuerdos').insert(
      newAgreements.map(a=>({
        reunion_id:activeCommitteeMeetingId,
        comite_id:record.comite_id,
        accion:a.accion || '—',
        responsable:a.responsable || '—',
        fecha_cumplimiento:a.fecha_cumplimiento,
        estado:'PENDIENTE'
      }))
    );
    if (insertResult.error) {
      console.error(insertResult.error);
      if (!silent) committeeMeetingEditorMessage(insertResult.error.message || 'No fue posible guardar los acuerdos nuevos.');
      if (button && !silent) {button.disabled=false;button.textContent=old;}
      return false;
    }
  }

  // Elimina solamente los acuerdos retirados manualmente del acta.
  const removedIds=existingMeetingAgreements
    .filter(x=>!submittedIds.has(x.id))
    .map(x=>x.id);

  if (removedIds.length) {
    const deleteResult=await client.from('comite_sst_acuerdos').delete().in('id',removedIds);
    if (deleteResult.error) {
      console.error(deleteResult.error);
      if (!silent) committeeMeetingEditorMessage(deleteResult.error.message || 'No fue posible eliminar los acuerdos retirados.');
      if (button && !silent) {button.disabled=false;button.textContent=old;}
      return false;
    }
  }

  if (button && !silent) {
    button.disabled=false;
    button.textContent=old;
  }

  committeeMeetingsLoaded=false;
  await loadCommitteeMeetingsModule(true);

  if (!silent) {
    committeeMeetingEditorMessage(closeMeeting ? 'Reunión cerrada correctamente.' : 'Cambios guardados correctamente.','success');
  }

  return true;
}

async function syncCommitteeMeetingAttendees() {
  if (!activeCommitteeMeetingId) return;
  const button=document.getElementById('syncCommitteeMeetingAttendeesButton');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Sincronizando…';

  const {data,error}=await client.rpc('sincronizar_asistentes_reunion',{
    p_reunion_id:activeCommitteeMeetingId
  });

  button.disabled=false;
  button.textContent=old;

  if (error || !data?.ok) {
    committeeMeetingEditorMessage(data?.error || error?.message || 'No fue posible sincronizar los integrantes.');
    return;
  }

  committeeMeetingsLoaded=false;
  await loadCommitteeMeetingsModule(true);
  await openCommitteeMeetingEditor(activeCommitteeMeetingId);
  committeeMeetingEditorMessage(data.message || 'Integrantes sincronizados correctamente.','success');
}

async function resizeCommitteeMeetingImage(file) {
  if (!file) throw new Error('Selecciona una imagen.');
  if (file.size>5*1024*1024) throw new Error(`${file.name}: la imagen no puede superar 5 MB.`);

  const bitmap=await createImageBitmap(file);
  const max=1600;
  const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(bitmap.width*scale);
  canvas.height=Math.round(bitmap.height*scale);
  const ctx=canvas.getContext('2d');
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);

  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));
  bitmap.close();
  if (!blob) throw new Error(`No fue posible procesar ${file.name}.`);
  return blob;
}

async function uploadCommitteeMeetingEvidence() {
  if (!activeCommitteeMeetingId) return;

  const input=document.getElementById('committeeMeetingEvidenceFiles');
  const files=[...(input.files || [])];
  if (!files.length) {
    committeeMeetingEditorMessage('Selecciona una o más imágenes.');
    return;
  }

  const existing=committeeMeetingEvidences.filter(x=>x.reunion_id===activeCommitteeMeetingId);
  if (existing.length+files.length>4) {
    committeeMeetingEditorMessage('El acta permite un máximo de 4 imágenes de inspección.');
    return;
  }

  const button=document.getElementById('uploadCommitteeMeetingEvidenceButton');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Subiendo…';

  try {
    let order=existing.length+1;
    for (const file of files) {
      const blob=await resizeCommitteeMeetingImage(file);
      const path=`${activeCommitteeMeetingId}/${crypto.randomUUID()}.jpg`;

      const {error:uploadError}=await client.storage
        .from('comite-sst-evidencias')
        .upload(path,blob,{contentType:'image/jpeg',cacheControl:'3600',upsert:false});

      if (uploadError) throw uploadError;

      const url=client.storage.from('comite-sst-evidencias').getPublicUrl(path).data.publicUrl;

      const {error:rowError}=await client.from('comite_sst_reunion_evidencias').insert({
        reunion_id:activeCommitteeMeetingId,
        storage_path:path,
        url,
        descripcion:null,
        orden:order++
      });

      if (rowError) throw rowError;
    }

    input.value='';
    committeeMeetingsLoaded=false;
    await loadCommitteeMeetingsModule(true);
    await openCommitteeMeetingEditor(activeCommitteeMeetingId);
    committeeMeetingEditorMessage('Imágenes cargadas correctamente. Agrega una descripción a cada evidencia.','success');
  } catch(err) {
    console.error(err);
    committeeMeetingEditorMessage(err?.message || 'No fue posible cargar las imágenes.');
  } finally {
    button.disabled=false;
    button.textContent=old;
  }
}

async function deleteCommitteeMeetingEvidence(id) {
  const row=committeeMeetingEvidences.find(x=>x.id===id);
  if (!row) return;
  if (!confirm('¿Eliminar esta evidencia fotográfica?')) return;

  const {error:storageError}=await client.storage.from('comite-sst-evidencias').remove([row.storage_path]);
  if (storageError) console.warn(storageError);

  const {error}=await client.from('comite_sst_reunion_evidencias').delete().eq('id',id);
  if (error) {
    committeeMeetingEditorMessage(error.message || 'No fue posible eliminar la evidencia.');
    return;
  }

  committeeMeetingsLoaded=false;
  await loadCommitteeMeetingsModule(true);
  await openCommitteeMeetingEditor(activeCommitteeMeetingId);
  committeeMeetingEditorMessage('Evidencia eliminada.','success');
}

async function deleteCommitteeMeeting(id) {
  const record=committeeMeetingRecords.find(x=>x.id===id);
  if (!record || !committeeMeetingCanManage(record)) return;

  const signedCount=committeeMeetingAttendees.filter(
    x=>x.reunion_id===id && x.firmado_at && x.consentimiento_firma
  ).length;

  const warning=signedCount>0
    ? `Esta acta tiene ${signedCount} firma(s) registrada(s). Al eliminarla también se eliminarán participantes, firmas, acuerdos y evidencias asociadas.\n\n¿Eliminar definitivamente el Acta N° ${record.numero_acta || ''}?`
    : `¿Eliminar definitivamente el Acta N° ${record.numero_acta || ''} y todos sus datos?`;

  if (!confirm(warning)) return;

  const evidences=committeeMeetingEvidences.filter(x=>x.reunion_id===id);
  if (evidences.length) {
    const paths=evidences.map(x=>x.storage_path).filter(Boolean);
    if (paths.length) {
      const result=await client.storage.from('comite-sst-evidencias').remove(paths);
      if (result.error) console.warn(result.error);
    }
  }

  const {error}=await client.from('comite_sst_reuniones').delete().eq('id',id);
  if (error) {
    committeeMessage(error.message || 'No fue posible eliminar la reunión.');
    return;
  }

  committeeMeetingsLoaded=false;
  await loadCommitteeMeetingsModule(true);
  committeeMessage('Reunión eliminada correctamente.','success');
}



// ============================================================
// ETAPA 16C · SEGUIMIENTO DE ACUERDOS
// ============================================================

function committeeAgreementMessage(message='',type='error') {
  const el=document.getElementById('committeeAgreementModalMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function committeeAgreementMeeting(agreement) {
  return committeeMeetingRecords.find(x=>x.id===agreement?.reunion_id) || null;
}

function committeeAgreementCommittee(agreement) {
  return committeeRecords.find(x=>x.id===agreement?.comite_id)
    || committeeMeetingCommittee(committeeAgreementMeeting(agreement));
}

function committeeAgreementCanManage(agreement) {
  return committeeCanManage(committeeAgreementCommittee(agreement));
}

function committeeAgreementDueState(agreement) {
  if (!agreement || agreement.estado==='CERRADO') return {code:'CERRADO',label:'Cerrado',days:null};

  if (!agreement.fecha_cumplimiento) {
    return {code:'SIN_FECHA',label:'Sin fecha',days:null};
  }

  const today=new Date();
  today.setHours(0,0,0,0);
  const due=new Date(`${agreement.fecha_cumplimiento}T00:00:00`);
  const diff=Math.ceil((due-today)/86400000);

  if (diff<0) return {code:'VENCIDO',label:`Vencido ${Math.abs(diff)} día(s)`,days:diff};
  if (diff===0) return {code:'HOY',label:'Vence hoy',days:0};
  if (diff<=7) return {code:'PROXIMO',label:`Vence en ${diff} día(s)`,days:diff};
  return {code:'VIGENTE',label:`${diff} día(s) restantes`,days:diff};
}

function committeeAgreementStatusLabel(status) {
  return {
    PENDIENTE:'PENDIENTE',
    EN_PROCESO:'EN PROCESO',
    CERRADO:'CERRADO'
  }[status] || status || '—';
}

function populateCommitteeAgreementSelectors() {
  const select=document.getElementById('committeeAgreementCommitteeFilter');
  if (!select) return;
  const current=select.value;

  select.innerHTML=
    '<option value="">Todos los Comités/Subcomités</option>'+
    committeeRecords.map(record=>{
      const type=record.tipo==='SUBCOMITE'?'Subcomité':'Comité';
      return `<option value="${record.id}">${escapeHtml(type)} · ${escapeHtml(committeeUnitName(record))} · ${escapeHtml(record.codigo || '')}</option>`;
    }).join('');

  if ([...select.options].some(o=>o.value===current)) select.value=current;
}

function updateCommitteeAgreementStats() {
  const agreements=committeeMeetingAgreements;
  const total=agreements.length;
  const pending=agreements.filter(x=>x.estado==='PENDIENTE').length;
  const inProgress=agreements.filter(x=>x.estado==='EN_PROCESO').length;
  const closed=agreements.filter(x=>x.estado==='CERRADO').length;
  const overdue=agreements.filter(x=>committeeAgreementDueState(x).code==='VENCIDO').length;
  const compliance=total ? Math.round((closed/total)*100) : 0;

  const map={
    committeeAgreementTotalCount:total,
    committeeAgreementPendingCount:pending,
    committeeAgreementInProgressCount:inProgress,
    committeeAgreementOverdueCount:overdue,
    committeeAgreementClosedCount:closed,
    committeeAgreementCompliance:`${compliance}%`
  };

  Object.entries(map).forEach(([id,value])=>{
    const el=document.getElementById(id);
    if (el) el.textContent=String(value);
  });
}

function renderCommitteeAgreementTable() {
  const body=document.getElementById('committeeAgreementTableBody');
  if (!body) return;

  const q=(document.getElementById('committeeAgreementSearch')?.value || '').trim().toLowerCase();
  const committeeId=document.getElementById('committeeAgreementCommitteeFilter')?.value || '';
  const status=document.getElementById('committeeAgreementStatusFilter')?.value || '';
  const deadline=document.getElementById('committeeAgreementDeadlineFilter')?.value || '';

  const rows=committeeMeetingAgreements.filter(agreement=>{
    const meeting=committeeAgreementMeeting(agreement);
    const committee=committeeAgreementCommittee(agreement);
    const due=committeeAgreementDueState(agreement);

    if (committeeId && agreement.comite_id!==committeeId) return false;
    if (status && agreement.estado!==status) return false;
    if (deadline==='VENCIDO' && due.code!=='VENCIDO') return false;
    if (deadline==='PROXIMO' && !['PROXIMO','HOY'].includes(due.code)) return false;
    if (deadline==='SIN_FECHA' && due.code!=='SIN_FECHA') return false;

    const hay=[
      agreement.accion,
      agreement.responsable,
      meeting?.numero_acta,
      committee?.nombre,
      committeeUnitName(committee),
      agreement.estado
    ].filter(Boolean).join(' ').toLowerCase();

    return !q || hay.includes(q);
  });

  if (!rows.length) {
    body.innerHTML='<tr><td colspan="8" class="table-empty">No se encontraron acuerdos con los filtros seleccionados.</td></tr>';
    return;
  }

  body.innerHTML=rows.map(agreement=>{
    const meeting=committeeAgreementMeeting(agreement);
    const committee=committeeAgreementCommittee(agreement);
    const due=committeeAgreementDueState(agreement);
    const evidenceCount=committeeAgreementEvidences.filter(x=>x.acuerdo_id===agreement.id).length;
    const canManage=committeeAgreementCanManage(agreement);

    return `
      <tr class="${due.code==='VENCIDO'?'agreement-overdue-row':''}">
        <td class="agreement-origin-cell">
          <strong>${escapeHtml(meeting?.numero_acta || '—')}</strong>
          <small>${escapeHtml(formatDatePE(meeting?.fecha))}</small>
          <small>${escapeHtml(committeeUnitName(committee))}</small>
        </td>
        <td class="agreement-action-cell">${escapeHtml(agreement.accion || '—')}</td>
        <td>${escapeHtml(agreement.responsable || '—')}</td>
        <td>${agreement.fecha_cumplimiento ? escapeHtml(formatDatePE(agreement.fecha_cumplimiento)) : '<span class="muted">Sin fecha</span>'}</td>
        <td><span class="agreement-deadline-badge ${due.code.toLowerCase()}">${escapeHtml(due.label)}</span></td>
        <td><span class="agreement-status-badge ${String(agreement.estado||'').toLowerCase()}">${escapeHtml(committeeAgreementStatusLabel(agreement.estado))}</span></td>
        <td><span class="agreement-evidence-count">${evidenceCount} archivo(s)</span></td>
        <td class="agreement-actions-cell">
          <button class="committee-manage-btn small-btn" type="button" data-open-agreement="${agreement.id}">${canManage?'Gestionar':'Ver'}</button>
          ${meeting ? `<button class="secondary-btn small-btn" type="button" data-open-agreement-meeting="${meeting.id}">Acta</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  body.querySelectorAll('[data-open-agreement]').forEach(button=>{
    button.addEventListener('click',()=>openCommitteeAgreementModal(button.dataset.openAgreement));
  });

  body.querySelectorAll('[data-open-agreement-meeting]').forEach(button=>{
    button.addEventListener('click',()=>openCommitteeMeetingEditor(button.dataset.openAgreementMeeting));
  });
}

async function loadCommitteeAgreementsModule(force=false) {
  if (!client) return;

  if (!committeeModuleLoaded) await loadCommitteeModule(true);
  if (!committeeMeetingsLoaded || force) await loadCommitteeMeetingsModule(true);

  if (committeeAgreementsLoaded && !force) {
    populateCommitteeAgreementSelectors();
    updateCommitteeAgreementStats();
    renderCommitteeAgreementTable();
    return;
  }

  const [evidences,history]=await Promise.all([
    client.from('comite_sst_acuerdo_evidencias')
      .select('*')
      .order('created_at',{ascending:false}),
    client.from('comite_sst_acuerdo_historial')
      .select('*')
      .order('changed_at',{ascending:false})
  ]);

  if (evidences.error || history.error) {
    console.error(evidences.error,history.error);
    committeeMessage(
      evidences.error?.message || history.error?.message || 'No fue posible cargar el seguimiento de acuerdos.'
    );
    return;
  }

  committeeAgreementEvidences=evidences.data || [];
  committeeAgreementHistory=history.data || [];
  committeeAgreementsLoaded=true;

  populateCommitteeAgreementSelectors();
  updateCommitteeAgreementStats();
  renderCommitteeAgreementTable();
}

function renderCommitteeAgreementEvidence(agreement) {
  const container=document.getElementById('committeeAgreementEvidenceList');
  if (!container) return;

  const rows=committeeAgreementEvidences.filter(x=>x.acuerdo_id===agreement.id);
  if (!rows.length) {
    container.innerHTML='<div class="meeting-empty-note">Todavía no se han cargado evidencias para este acuerdo.</div>';
    return;
  }

  container.innerHTML=rows.map(row=>{
    const isPdf=(row.tipo_archivo || '').includes('pdf') || String(row.nombre_archivo || '').toLowerCase().endsWith('.pdf');
    return `
      <article class="agreement-evidence-item">
        <div class="agreement-evidence-preview">
          ${isPdf
            ? `<a href="${escapeHtml(row.url)}" target="_blank" rel="noopener" class="agreement-pdf-preview">PDF</a>`
            : `<a href="${escapeHtml(row.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(row.url)}" alt="Evidencia del acuerdo" /></a>`
          }
        </div>
        <div class="agreement-evidence-meta">
          <strong>${escapeHtml(row.nombre_archivo || 'Evidencia')}</strong>
          <input class="agreement-evidence-description-input" data-agreement-evidence-description="${row.id}" value="${escapeHtml(row.descripcion || '')}" placeholder="Descripción de la evidencia" />
          <small>${row.created_at ? new Date(row.created_at).toLocaleString('es-PE') : ''}</small>
        </div>
        ${committeeAgreementCanManage(agreement) ? `<button type="button" class="meeting-evidence-delete" data-delete-agreement-evidence="${row.id}">Eliminar</button>` : ''}
      </article>
    `;
  }).join('');

  container.querySelectorAll('[data-delete-agreement-evidence]').forEach(button=>{
    button.addEventListener('click',()=>deleteCommitteeAgreementEvidence(button.dataset.deleteAgreementEvidence));
  });
}

function renderCommitteeAgreementHistory(agreement) {
  const container=document.getElementById('committeeAgreementHistoryList');
  if (!container) return;

  const rows=committeeAgreementHistory.filter(x=>x.acuerdo_id===agreement.id);
  if (!rows.length) {
    container.innerHTML='<div class="meeting-empty-note">Aún no existen cambios registrados en el historial.</div>';
    return;
  }

  container.innerHTML=rows.map(row=>{
    const statusChanged=row.estado_anterior!==row.estado_nuevo;
    const responsibleChanged=row.responsable_anterior!==row.responsable_nuevo;
    const dateChanged=row.fecha_anterior!==row.fecha_nueva;
    const details=[];

    if (statusChanged) details.push(`Estado: ${committeeAgreementStatusLabel(row.estado_anterior)} → ${committeeAgreementStatusLabel(row.estado_nuevo)}`);
    if (responsibleChanged) details.push(`Responsable: ${row.responsable_anterior || '—'} → ${row.responsable_nuevo || '—'}`);
    if (dateChanged) details.push(`Fecha: ${row.fecha_anterior ? formatDatePE(row.fecha_anterior) : '—'} → ${row.fecha_nueva ? formatDatePE(row.fecha_nueva) : '—'}`);

    return `
      <article class="agreement-history-item">
        <span class="agreement-history-dot"></span>
        <div>
          <strong>${escapeHtml(details.join(' · ') || 'Actualización del acuerdo')}</strong>
          ${row.observacion ? `<p>${escapeHtml(row.observacion)}</p>` : ''}
          <small>${row.changed_at ? new Date(row.changed_at).toLocaleString('es-PE') : ''}</small>
        </div>
      </article>
    `;
  }).join('');
}

function toggleCommitteeAgreementCloseFields() {
  const status=document.getElementById('committeeAgreementStatus')?.value;
  document.getElementById('committeeAgreementCloseObservationField')?.classList.toggle('hidden',status!=='CERRADO');
}

async function openCommitteeAgreementModal(id) {
  if (!committeeAgreementsLoaded) await loadCommitteeAgreementsModule(true);

  const agreement=committeeMeetingAgreements.find(x=>x.id===id);
  if (!agreement) return;

  activeCommitteeAgreementId=id;
  const meeting=committeeAgreementMeeting(agreement);
  const committee=committeeAgreementCommittee(agreement);
  const canManage=committeeAgreementCanManage(agreement);

  document.getElementById('committeeAgreementId').value=agreement.id;
  document.getElementById('committeeAgreementModalTitle').textContent=`Acuerdo · ${agreement.estado==='CERRADO'?'Cerrado':'Seguimiento'}`;
  document.getElementById('committeeAgreementModalOrigin').textContent=
    `${meeting?.numero_acta || 'Acta'} · ${committee?.nombre || 'Comité SST'} · ${committeeUnitName(committee)}`;

  document.getElementById('committeeAgreementActNumber').textContent=meeting?.numero_acta || '—';
  document.getElementById('committeeAgreementMeetingDate').textContent=formatDatePE(meeting?.fecha);
  document.getElementById('committeeAgreementCommitteeName').textContent=committee?.nombre || '—';
  document.getElementById('committeeAgreementUnitName').textContent=committeeUnitName(committee);

  document.getElementById('committeeAgreementAction').value=agreement.accion || '';
  document.getElementById('committeeAgreementResponsible').value=agreement.responsable || '';
  document.getElementById('committeeAgreementDueDate').value=agreement.fecha_cumplimiento || '';
  document.getElementById('committeeAgreementStatus').value=agreement.estado || 'PENDIENTE';
  document.getElementById('committeeAgreementCloseDate').value=agreement.fecha_cierre || '';
  document.getElementById('committeeAgreementObservation').value=agreement.observacion || '';
  document.getElementById('committeeAgreementCloseObservation').value=agreement.cierre_observacion || '';

  toggleCommitteeAgreementCloseFields();
  renderCommitteeAgreementEvidence(agreement);
  renderCommitteeAgreementHistory(agreement);
  committeeAgreementMessage('');

  [
    'committeeAgreementAction',
    'committeeAgreementResponsible',
    'committeeAgreementDueDate',
    'committeeAgreementStatus',
    'committeeAgreementObservation',
    'committeeAgreementCloseObservation',
    'committeeAgreementEvidenceFiles'
  ].forEach(fieldId=>{
    const el=document.getElementById(fieldId);
    if (el) el.disabled=!canManage;
  });

  document.getElementById('saveCommitteeAgreementButton')?.classList.toggle('hidden',!canManage);
  document.getElementById('uploadCommitteeAgreementEvidenceButton')?.classList.toggle('hidden',!canManage);

  const modal=document.getElementById('committeeAgreementModal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closeCommitteeAgreementModal() {
  const modal=document.getElementById('committeeAgreementModal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden','true');
  activeCommitteeAgreementId=null;
  document.body.classList.remove('modal-open');
}

async function saveCommitteeAgreement() {
  if (!activeCommitteeAgreementId) return;

  const agreement=committeeMeetingAgreements.find(x=>x.id===activeCommitteeAgreementId);
  if (!agreement || !committeeAgreementCanManage(agreement)) return;

  committeeAgreementMessage('');

  const accion=document.getElementById('committeeAgreementAction').value.trim();
  const responsable=document.getElementById('committeeAgreementResponsible').value.trim();
  const fecha_cumplimiento=document.getElementById('committeeAgreementDueDate').value || null;
  const estado=document.getElementById('committeeAgreementStatus').value;
  const observacion=document.getElementById('committeeAgreementObservation').value.trim() || null;
  const cierre_observacion=document.getElementById('committeeAgreementCloseObservation').value.trim() || null;

  if (!accion || !responsable) {
    committeeAgreementMessage('Completa la acción requerida y el responsable.');
    return;
  }

  if (estado==='CERRADO' && !cierre_observacion) {
    committeeAgreementMessage('Para cerrar el acuerdo registra el comentario de cierre.');
    return;
  }

  const descriptionUpdates=[...document.querySelectorAll('[data-agreement-evidence-description]')].map(input=>
    client.from('comite_sst_acuerdo_evidencias')
      .update({descripcion:input.value.trim() || null})
      .eq('id',input.dataset.agreementEvidenceDescription)
  );
  await Promise.all(descriptionUpdates);

  const button=document.getElementById('saveCommitteeAgreementButton');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Guardando…';

  const payload={
    accion,
    responsable,
    fecha_cumplimiento,
    estado,
    observacion,
    cierre_observacion:estado==='CERRADO' ? cierre_observacion : null
  };

  const {error}=await client.from('comite_sst_acuerdos')
    .update(payload)
    .eq('id',activeCommitteeAgreementId);

  button.disabled=false;
  button.textContent=old;

  if (error) {
    console.error(error);
    committeeAgreementMessage(error.message || 'No fue posible guardar el seguimiento.');
    return;
  }

  const id=activeCommitteeAgreementId;
  committeeAgreementsLoaded=false;
  committeeMeetingsLoaded=false;
  await loadCommitteeAgreementsModule(true);
  await openCommitteeAgreementModal(id);
  committeeAgreementMessage('Seguimiento actualizado correctamente.','success');
}

async function uploadCommitteeAgreementEvidence() {
  if (!activeCommitteeAgreementId) return;
  const agreement=committeeMeetingAgreements.find(x=>x.id===activeCommitteeAgreementId);
  if (!agreement || !committeeAgreementCanManage(agreement)) return;

  const input=document.getElementById('committeeAgreementEvidenceFiles');
  const files=[...(input.files || [])];

  if (!files.length) {
    committeeAgreementMessage('Selecciona uno o más archivos.');
    return;
  }

  const existing=committeeAgreementEvidences.filter(x=>x.acuerdo_id===activeCommitteeAgreementId);
  if (existing.length+files.length>6) {
    committeeAgreementMessage('Se permite un máximo de 6 evidencias por acuerdo.');
    return;
  }

  const button=document.getElementById('uploadCommitteeAgreementEvidenceButton');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Subiendo…';

  try {
    for (const file of files) {
      if (file.size>8*1024*1024) {
        throw new Error(`${file.name}: supera el máximo de 8 MB.`);
      }

      const allowed=['image/jpeg','image/png','image/webp','application/pdf'];
      if (!allowed.includes(file.type)) {
        throw new Error(`${file.name}: formato no permitido.`);
      }

      let uploadBody=file;
      let contentType=file.type;
      let extension=file.name.split('.').pop()?.toLowerCase() || '';

      if (file.type.startsWith('image/')) {
        uploadBody=await resizeCommitteeMeetingImage(file);
        contentType='image/jpeg';
        extension='jpg';
      }

      const path=`${activeCommitteeAgreementId}/${crypto.randomUUID()}.${extension || 'bin'}`;

      const {error:uploadError}=await client.storage
        .from('comite-sst-acuerdos')
        .upload(path,uploadBody,{contentType,cacheControl:'3600',upsert:false});

      if (uploadError) throw uploadError;

      const url=client.storage.from('comite-sst-acuerdos').getPublicUrl(path).data.publicUrl;

      const {error:rowError}=await client.from('comite_sst_acuerdo_evidencias').insert({
        acuerdo_id:activeCommitteeAgreementId,
        storage_path:path,
        url,
        nombre_archivo:file.name,
        tipo_archivo:contentType,
        descripcion:null,
        created_by:currentProfile?.id || null
      });

      if (rowError) throw rowError;
    }

    input.value='';
    committeeAgreementsLoaded=false;
    await loadCommitteeAgreementsModule(true);
    await openCommitteeAgreementModal(activeCommitteeAgreementId);
    committeeAgreementMessage('Evidencia cargada correctamente.','success');
  } catch(err) {
    console.error(err);
    committeeAgreementMessage(err?.message || 'No fue posible cargar la evidencia.');
  } finally {
    button.disabled=false;
    button.textContent=old;
  }
}

async function deleteCommitteeAgreementEvidence(id) {
  const row=committeeAgreementEvidences.find(x=>x.id===id);
  if (!row) return;

  const agreement=committeeMeetingAgreements.find(x=>x.id===row.acuerdo_id);
  if (!agreement || !committeeAgreementCanManage(agreement)) return;

  if (!confirm('¿Eliminar esta evidencia del acuerdo?')) return;

  if (row.storage_path) {
    const storageResult=await client.storage.from('comite-sst-acuerdos').remove([row.storage_path]);
    if (storageResult.error) console.warn(storageResult.error);
  }

  const {error}=await client.from('comite_sst_acuerdo_evidencias').delete().eq('id',id);
  if (error) {
    committeeAgreementMessage(error.message || 'No fue posible eliminar la evidencia.');
    return;
  }

  committeeAgreementsLoaded=false;
  await loadCommitteeAgreementsModule(true);
  await openCommitteeAgreementModal(activeCommitteeAgreementId);
  committeeAgreementMessage('Evidencia eliminada.','success');
}

async function exportCommitteeAgreementsOfficialExcel() {
  if (!window.JSZip) {
    alert('No se cargó el generador de Excel. Actualiza la página e inténtalo nuevamente.');
    return;
  }

  const button=document.getElementById('exportCommitteeAgreementsButton');
  const oldText=button?.textContent || '';
  if (button) {
    button.disabled=true;
    button.textContent='Generando Excel…';
  }

  try {
    // Se exportan todos los acuerdos visibles para el usuario, no solo los filtrados en pantalla.
    const agreements=[...committeeMeetingAgreements].sort((a,b)=>{
      const ma=committeeAgreementMeeting(a);
      const mb=committeeAgreementMeeting(b);
      const dateA=ma?.fecha || '';
      const dateB=mb?.fecha || '';
      if (dateA!==dateB) return dateA.localeCompare(dateB);
      const actA=ma?.numero_acta || '';
      const actB=mb?.numero_acta || '';
      if (actA!==actB) return actA.localeCompare(actB,'es',{numeric:true});
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });

    if (!agreements.length) {
      alert('No hay acuerdos registrados para descargar.');
      return;
    }

    const templateUrl=new URL('assets/seguimiento-acuerdos-comite-sst-2026.xlsx',window.location.href);
    const response=await fetch(templateUrl);
    if (!response.ok) {
      throw new Error(`No se pudo cargar el formato oficial (${response.status}).`);
    }

    const templateBuffer=await response.arrayBuffer();
    const zip=await JSZip.loadAsync(templateBuffer);

    const sheetFile=zip.file('xl/worksheets/sheet1.xml');
    const workbookFile=zip.file('xl/workbook.xml');
    if (!sheetFile || !workbookFile) {
      throw new Error('El formato Excel no contiene la estructura esperada.');
    }

    const [sheetXmlText,workbookXmlText]=await Promise.all([
      sheetFile.async('text'),
      workbookFile.async('text')
    ]);

    const parser=new DOMParser();
    const serializer=new XMLSerializer();

    const sheetDoc=parser.parseFromString(sheetXmlText,'application/xml');
    const workbookDoc=parser.parseFromString(workbookXmlText,'application/xml');

    if (sheetDoc.querySelector('parsererror') || workbookDoc.querySelector('parsererror')) {
      throw new Error('No fue posible leer la estructura XML del formato Excel.');
    }

    const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const sheetData=sheetDoc.getElementsByTagNameNS(NS,'sheetData')[0];
    if (!sheetData) throw new Error('No se encontró la hoja principal del formato.');

    const sourceRow=[...sheetData.getElementsByTagNameNS(NS,'row')]
      .find(row=>row.getAttribute('r')==='6');

    if (!sourceRow) throw new Error('No se encontró la fila modelo del formato.');

    // Guardamos una fila base con todos los estilos/bordes del formato oficial.
    const rowTemplate=sourceRow.cloneNode(true);

    // Elimina únicamente las filas de contenido (6 en adelante). Se conservan encabezados 1-5.
    [...sheetData.getElementsByTagNameNS(NS,'row')].forEach(row=>{
      const number=Number(row.getAttribute('r') || 0);
      if (number>=6) row.remove();
    });

    const escapeXmlText=value=>String(value ?? '');
    const excelSerial=isoDate=>{
      if (!isoDate) return null;
      const match=String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) return null;
      const utc=Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]));
      return Math.round((utc-Date.UTC(1899,11,30))/86400000);
    };

    const getCell=(row,col,rowNumber)=>{
      const ref=`${col}${rowNumber}`;
      let cell=[...row.getElementsByTagNameNS(NS,'c')].find(c=>c.getAttribute('r')===ref);
      if (cell) return cell;

      // Fallback: locate the original template cell by column and retarget it.
      cell=[...row.getElementsByTagNameNS(NS,'c')].find(c=>
        String(c.getAttribute('r') || '').replace(/\d+/g,'')===col
      );
      if (cell) {
        cell.setAttribute('r',ref);
        return cell;
      }

      cell=sheetDoc.createElementNS(NS,'c');
      cell.setAttribute('r',ref);
      row.appendChild(cell);
      return cell;
    };

    const clearCellContent=cell=>{
      [...cell.childNodes].forEach(node=>cell.removeChild(node));
      cell.removeAttribute('t');
    };

    const setInlineText=(cell,value)=>{
      clearCellContent(cell);
      cell.setAttribute('t','inlineStr');
      const is=sheetDoc.createElementNS(NS,'is');
      const t=sheetDoc.createElementNS(NS,'t');
      t.setAttribute('xml:space','preserve');
      t.textContent=escapeXmlText(value);
      is.appendChild(t);
      cell.appendChild(is);
    };

    const setDate=(cell,isoDate)=>{
      clearCellContent(cell);
      const serial=excelSerial(isoDate);
      if (serial===null) return;
      const v=sheetDoc.createElementNS(NS,'v');
      v.textContent=String(serial);
      cell.appendChild(v);
    };

    const statusForTemplate=status=>{
      if (status==='CERRADO') return 'CERRADO';
      if (status==='EN_PROCESO') return 'EN PROCESO';
      return 'ABIERTO';
    };

    const evidenceText=agreement=>{
      const evidences=committeeAgreementEvidences.filter(x=>x.acuerdo_id===agreement.id);
      if (!evidences.length) return 'Sin evidencia adjunta';
      return evidences.map((ev,index)=>{
        const name=ev.nombre_archivo || `Evidencia ${index+1}`;
        return `${index+1}. ${name}${ev.url ? `\n${ev.url}` : ''}`;
      }).join('\n\n');
    };

    const dataRows=agreements.length ? agreements : [null];
    const lastRow=5+dataRows.length;

    dataRows.forEach((agreement,index)=>{
      const rowNumber=6+index;
      const row=rowTemplate.cloneNode(true);
      row.setAttribute('r',String(rowNumber));

      // Corrige referencias de todas las celdas clonadas.
      [...row.getElementsByTagNameNS(NS,'c')].forEach(cell=>{
        const col=String(cell.getAttribute('r') || '').replace(/\d+/g,'');
        cell.setAttribute('r',`${col}${rowNumber}`);
        clearCellContent(cell);
      });

      if (agreement) {
        const meeting=committeeAgreementMeeting(agreement);
        const committee=committeeAgreementCommittee(agreement);

        setInlineText(getCell(row,'A',rowNumber),index+1);
        setInlineText(
          getCell(row,'B',rowNumber),
          meeting?.numero_acta ? `Acta N° ${meeting.numero_acta}` : (committee?.nombre || 'Reunión SST')
        );
        setDate(getCell(row,'C',rowNumber),meeting?.fecha || null);
        setInlineText(getCell(row,'D',rowNumber),agreement.accion || '');
        setInlineText(getCell(row,'E',rowNumber),agreement.responsable || '');
        setDate(getCell(row,'F',rowNumber),agreement.fecha_cumplimiento || null);
        setDate(getCell(row,'G',rowNumber),agreement.fecha_cierre || null);
        setInlineText(getCell(row,'H',rowNumber),evidenceText(agreement));
        setInlineText(getCell(row,'J',rowNumber),statusForTemplate(agreement.estado));
      }

      sheetData.appendChild(row);
    });

    // Actualiza la dimensión de la hoja.
    const dimension=sheetDoc.getElementsByTagNameNS(NS,'dimension')[0];
    if (dimension) dimension.setAttribute('ref',`A1:L${lastRow}`);

    // Mantiene las combinaciones del encabezado y recrea H:I en cada fila de seguimiento.
    const mergeCells=sheetDoc.getElementsByTagNameNS(NS,'mergeCells')[0];
    if (mergeCells) {
      [...mergeCells.getElementsByTagNameNS(NS,'mergeCell')].forEach(node=>{
        const ref=node.getAttribute('ref') || '';
        if (/^H\d+:I\d+$/.test(ref) && Number(ref.match(/\d+/)?.[0] || 0)>=6) {
          node.remove();
        }
      });

      for (let rowNumber=6;rowNumber<=lastRow;rowNumber++) {
        const merge=sheetDoc.createElementNS(NS,'mergeCell');
        merge.setAttribute('ref',`H${rowNumber}:I${rowNumber}`);
        mergeCells.appendChild(merge);
      }

      mergeCells.setAttribute(
        'count',
        String(mergeCells.getElementsByTagNameNS(NS,'mergeCell').length)
      );
    }

    // Extiende la validación de Estado a todas las filas exportadas.
    const validations=sheetDoc.getElementsByTagNameNS(NS,'dataValidations')[0];
    if (validations) {
      const validation=[...validations.getElementsByTagNameNS(NS,'dataValidation')]
        .find(v=>(v.getAttribute('sqref') || '').includes('J6'));
      if (validation) validation.setAttribute('sqref',`J6:J${lastRow}`);
    }

    // El área de impresión crece según el número real de acuerdos.
    const definedNames=workbookDoc.getElementsByTagNameNS(NS,'definedNames')[0];
    if (definedNames) {
      [...definedNames.getElementsByTagNameNS(NS,'definedName')].forEach(name=>{
        if (
          name.getAttribute('name')==='_xlnm.Print_Area' &&
          name.getAttribute('localSheetId')==='0'
        ) {
          name.textContent=`'Acuerdos del Sub Comité'!$A$1:$J$${lastRow}`;
        }
      });
    }

    zip.file('xl/worksheets/sheet1.xml',serializer.serializeToString(sheetDoc));
    zip.file('xl/workbook.xml',serializer.serializeToString(workbookDoc));

    const output=await zip.generateAsync({
      type:'arraybuffer',
      mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      compression:'DEFLATE',
      compressionOptions:{level:6}
    });

    const blob=new Blob(
      [output],
      {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
    );
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`EDP-SIG-SSOMAC-RE-EA-131-17 Seguimiento a los acuerdos del Comité de SST 2026.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  } catch(err) {
    console.error(err);
    alert(err?.message || 'No fue posible generar el Excel de seguimiento.');
  } finally {
    if (button) {
      button.disabled=false;
      button.textContent=oldText;
    }
  }
}



// ============================================================
// ETAPA 16D.1 · CAPACITACIONES + VIDEOS DEL COMITÉ SST
// ============================================================

function committeeTrainingMessage(message='',type='error') {
  const el=document.getElementById('committeeTrainingMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function committeeTrainingVideoMessage(message='',type='error') {
  const el=document.getElementById('committeeTrainingVideoMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function committeeTrainingCommittee(record) {
  if (!record) return null;
  return record.comites_sst
    || committeeRecords.find(x=>x.id===record.comite_id)
    || null;
}

function committeeTrainingCanManage(record) {
  return committeeCanManage(committeeTrainingCommittee(record));
}

function committeeTrainingStatusLabel(status) {
  return {
    BORRADOR:'BORRADOR',
    LISTA:'LISTA',
    INACTIVA:'INACTIVA'
  }[status] || status || '—';
}

function committeeTrainingStatusClass(status) {
  return String(status || '').toLowerCase();
}

function committeeTrainingVideosFor(trainingId) {
  return committeeTrainingVideos
    .filter(x=>x.capacitacion_id===trainingId)
    .sort((a,b)=>(Number(a.orden)||0)-(Number(b.orden)||0));
}

function committeeTrainingTotalMinutes(trainingId) {
  return committeeTrainingVideosFor(trainingId)
    .reduce((sum,row)=>sum+Number(row.duracion_minutos || 0),0);
}

function committeeTrainingSourceLabel(type) {
  return {
    YOUTUBE:'YouTube',
    MP4_UPLOAD:'MP4',
    ENLACE:'Enlace'
  }[type] || type || '—';
}

function populateCommitteeTrainingSelectors() {
  const selectors=[
    document.getElementById('committeeTrainingCommittee'),
    document.getElementById('committeeTrainingCommitteeFilter')
  ];

  selectors.forEach((select,index)=>{
    if (!select) return;
    const current=select.value;
    const first=index===0
      ? '<option value="">Seleccione una conformación</option>'
      : '<option value="">Todos los Comités/Subcomités</option>';

    const options=committeeRecords
      .filter(record=>index!==0 || record.estado==='ACTIVO')
      .map(record=>{
        const type=record.tipo==='SUBCOMITE'?'Subcomité':'Comité';
        return `<option value="${record.id}">${escapeHtml(type)} · ${escapeHtml(committeeUnitName(record))} · ${escapeHtml(record.codigo || '')}</option>`;
      })
      .join('');

    select.innerHTML=first+options;
    if ([...select.options].some(option=>option.value===current)) {
      select.value=current;
    }
  });
}

function updateCommitteeTrainingStats() {
  const total=committeeTrainingRecords.length;
  const draft=committeeTrainingRecords.filter(x=>x.estado==='BORRADOR').length;
  const ready=committeeTrainingRecords.filter(x=>x.estado==='LISTA').length;
  const videos=committeeTrainingVideos.length;

  const values={
    committeeTrainingTotalCount:total,
    committeeTrainingDraftCount:draft,
    committeeTrainingReadyCount:ready,
    committeeTrainingVideoCount:videos
  };

  Object.entries(values).forEach(([id,value])=>{
    const el=document.getElementById(id);
    if (el) el.textContent=String(value);
  });
}

function committeeTrainingPublicUrl(record) {
  if (!record?.public_token) return '';
  const url=new URL(window.location.href);
  url.search='';
  url.hash='';
  url.searchParams.set('committeeTraining',record.public_token);
  return url.toString();
}

async function copyCommitteeTrainingPublicLink(record=null) {
  const item=record || committeeTrainingRecords.find(x=>x.id===activeCommitteeTrainingId);
  const link=committeeTrainingPublicUrl(item);
  if (!link) return;

  try {
    await navigator.clipboard.writeText(link);
    if (activeCommitteeTrainingId===item?.id) {
      committeeTrainingMessage('Link copiado correctamente.','success');
    } else {
      alert('Link copiado correctamente.');
    }
  } catch {
    window.prompt('Copia el link:',link);
  }
}

function shareCommitteeTrainingPublicLink(record=null) {
  const item=record || committeeTrainingRecords.find(x=>x.id===activeCommitteeTrainingId);
  const link=committeeTrainingPublicUrl(item);
  if (!link) return;
  const committee=committeeTrainingCommittee(item);
  const text=
    `Capacitación del ${committee?.tipo==='SUBCOMITE'?'Subcomité':'Comité'} SST\n`+
    `${item.titulo || ''}\n`+
    `Ingresa con tu DNI, registra tu firma y completa los videos en el orden indicado:\n${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank','noopener');
}

function renderCommitteeTrainingList() {
  const container=document.getElementById('committeeTrainingList');
  if (!container) return;

  const q=(document.getElementById('committeeTrainingSearch')?.value || '').trim().toLowerCase();
  const committeeId=document.getElementById('committeeTrainingCommitteeFilter')?.value || '';
  const status=document.getElementById('committeeTrainingStatusFilter')?.value || '';

  const rows=committeeTrainingRecords.filter(record=>{
    if (committeeId && record.comite_id!==committeeId) return false;
    if (status && record.estado!==status) return false;

    const committee=committeeTrainingCommittee(record);
    const hay=[
      record.codigo,
      record.titulo,
      record.expositor,
      record.cargo_expositor,
      committee?.nombre,
      committeeUnitName(committee)
    ].filter(Boolean).join(' ').toLowerCase();

    return !q || hay.includes(q);
  });

  if (!rows.length) {
    container.innerHTML='<div class="training-library-empty">No se encontraron capacitaciones.</div>';
    return;
  }

  container.innerHTML=rows.map(record=>{
    const committee=committeeTrainingCommittee(record);
    const videos=committeeTrainingVideosFor(record.id);
    const totalMinutes=committeeTrainingTotalMinutes(record.id);
    const canManage=committeeTrainingCanManage(record);
    const questions=committeeTrainingQuestionRecords.filter(x=>x.capacitacion_id===record.id);
    const attempts=committeeTrainingAttempts.filter(x=>x.capacitacion_id===record.id);
    const sources=[...new Set(videos.map(x=>committeeTrainingSourceLabel(x.tipo_fuente)))];

    return `
      <article class="committee-training-card">
        <div class="committee-training-card-icon">▶</div>

        <div class="committee-training-card-main">
          <div class="committee-training-card-top">
            <div>
              <span class="eyebrow">${committee?.tipo==='SUBCOMITE'?'CAPACITACIÓN · SUBCOMITÉ SST':'CAPACITACIÓN · COMITÉ SST'}</span>
              <h4>${escapeHtml(record.titulo || 'Capacitación')}</h4>
              <p>${escapeHtml(record.codigo || '—')} · ${escapeHtml(committeeUnitName(committee))}</p>
            </div>
            <span class="committee-training-status ${committeeTrainingStatusClass(record.estado)}">${escapeHtml(committeeTrainingStatusLabel(record.estado))}</span>
          </div>

          <div class="committee-training-card-meta">
            <span>▣ ${escapeHtml(formatDatePE(record.fecha))}</span>
            <span>Expositor: ${escapeHtml(record.expositor || '—')}</span>
            <span>${Number(record.duracion_horas || 0)} h</span>
            <span>${videos.length} video(s)</span>
            <span>${questions.length} pregunta(s)</span>
            <span>${attempts.length} resultado(s)</span>
            ${totalMinutes ? `<span>${Math.round(totalMinutes)} min de video</span>` : ''}
            ${sources.length ? `<span>${escapeHtml(sources.join(' · '))}</span>` : ''}
            <span>Nota mín.: ${Number(record.nota_minima || 0)}</span>
            <span>${Number(record.max_intentos || 1)} intento(s)</span>
          </div>
        </div>

        <div class="committee-training-card-actions">
          ${canManage && record.estado==='LISTA' && videos.length>0 && questions.length>0 ? `<button class="meeting-share-sign-btn" type="button" data-share-committee-training="${record.id}">Compartir</button>` : ''}
          <button class="evaluation-results-btn" type="button" data-results-committee-training="${record.id}">Resultados</button>
          <button class="committee-manage-btn" type="button" data-open-committee-training="${record.id}">
            ${canManage?'Administrar':'Ver contenido'}
          </button>
          ${canManage ? `<button class="induction-delete-btn" type="button" data-delete-committee-training="${record.id}">Eliminar</button>` : ''}
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('[data-open-committee-training]').forEach(button=>{
    button.addEventListener('click',()=>openCommitteeTrainingModal(
      committeeTrainingRecords.find(x=>x.id===button.dataset.openCommitteeTraining)
    ));
  });

  container.querySelectorAll('[data-share-committee-training]').forEach(button=>{
    button.addEventListener('click',()=>{
      const record=committeeTrainingRecords.find(x=>x.id===button.dataset.shareCommitteeTraining);
      if (record) shareCommitteeTrainingPublicLink(record);
    });
  });

  container.querySelectorAll('[data-results-committee-training]').forEach(button=>{
    button.addEventListener('click',()=>openCommitteeTrainingResultsModal(button.dataset.resultsCommitteeTraining));
  });

  container.querySelectorAll('[data-delete-committee-training]').forEach(button=>{
    button.addEventListener('click',()=>deleteCommitteeTraining(button.dataset.deleteCommitteeTraining));
  });
}

async function loadCommitteeTrainingsModule(force=false) {
  if (!client) return;
  if (!committeeModuleLoaded) await loadCommitteeModule(true);

  if (committeeTrainingsLoaded && !force) {
    populateCommitteeTrainingSelectors();
    updateCommitteeTrainingStats();
    renderCommitteeTrainingList();
    return;
  }

  const [trainings,videos,questions,participants,attempts]=await Promise.all([
    client.from('comite_sst_capacitaciones')
      .select('*,comites_sst(id,codigo,tipo,nombre,sede_id,proyecto_id,estado)')
      .order('fecha',{ascending:false})
      .order('created_at',{ascending:false}),
    client.from('comite_sst_capacitacion_videos')
      .select('*')
      .order('capacitacion_id',{ascending:true})
      .order('orden',{ascending:true}),
    client.from('comite_sst_capacitacion_preguntas')
      .select('id,capacitacion_id,orden,nivel_tema,peso,activo')
      .eq('activo',true)
      .order('capacitacion_id',{ascending:true})
      .order('orden',{ascending:true}),
    client.from('comite_sst_capacitacion_participantes')
      .select('id,capacitacion_id,trabajador_id,firma_electronica,estado,contenido_completado_at,trabajadores(id,dni,nombres,apellidos,cargo,area)')
      .order('created_at',{ascending:false}),
    client.from('comite_sst_capacitacion_intentos')
      .select('*')
      .not('finalizado_at','is',null)
      .order('finalizado_at',{ascending:false})
  ]);

  if (trainings.error || videos.error || questions.error || participants.error || attempts.error) {
    console.error(trainings.error,videos.error,questions.error,participants.error,attempts.error);
    committeeMessage(
      trainings.error?.message || videos.error?.message || questions.error?.message ||
      participants.error?.message || attempts.error?.message ||
      'No fue posible cargar las capacitaciones del Comité SST. Ejecuta el SQL de la Etapa 16D.3.'
    );
    return;
  }

  committeeTrainingRecords=trainings.data || [];
  committeeTrainingVideos=videos.data || [];
  committeeTrainingQuestionRecords=questions.data || [];
  committeeTrainingParticipants=participants.data || [];
  committeeTrainingAttempts=attempts.data || [];
  committeeTrainingsLoaded=true;

  populateCommitteeTrainingSelectors();
  updateCommitteeTrainingStats();
  renderCommitteeTrainingList();
}

async function openCommitteeTrainingModal(record=null) {
  committeeTrainingMessage('');
  activeCommitteeTrainingId=record?.id || null;

  populateCommitteeTrainingSelectors();

  document.getElementById('committeeTrainingId').value=record?.id || '';
  document.getElementById('committeeTrainingModalTitle').textContent=
    record ? 'Administrar capacitación' : 'Nueva capacitación';
  document.getElementById('committeeTrainingModalSubtitle').textContent=
    record
      ? `${record.codigo || ''} · Administra los datos y la secuencia de videos.`
      : 'Primero registra los datos generales. Luego podrás agregar los videos.';

  const committeeSelect=document.getElementById('committeeTrainingCommittee');
  committeeSelect.value=record?.comite_id || '';
  committeeSelect.disabled=!!record;

  document.getElementById('committeeTrainingTitle').value=record?.titulo || '';
  document.getElementById('committeeTrainingPresenter').value=record?.expositor || '';
  document.getElementById('committeeTrainingPresenterRole').value=record?.cargo_expositor || '';
  document.getElementById('committeeTrainingDate').value=record?.fecha || new Date().toISOString().slice(0,10);
  document.getElementById('committeeTrainingHours').value=record?.duracion_horas ?? 1;
  document.getElementById('committeeTrainingMinGrade').value=record?.nota_minima ?? 16;
  document.getElementById('committeeTrainingAttempts').value=String(record?.max_intentos ?? 2);
  document.getElementById('committeeTrainingExamTime').value=record?.tiempo_examen_min ?? '';
  document.getElementById('committeeTrainingShuffleQuestions').checked=record?.mezclar_preguntas ?? true;
  document.getElementById('committeeTrainingShuffleOptions').checked=record?.mezclar_opciones ?? true;
  document.getElementById('committeeTrainingShowCorrectFinal').checked=record?.mostrar_correctas_final ?? true;
  document.getElementById('committeeTrainingShowExplanation').checked=record?.mostrar_explicacion ?? true;
  document.getElementById('committeeTrainingRetryFailed').checked=record?.reintento_solo_desaprobado ?? true;
  document.getElementById('committeeTrainingObjective').value=record?.objetivo || '';
  document.getElementById('committeeTrainingDescription').value=record?.descripcion || '';
  document.getElementById('committeeTrainingStatus').value=record?.estado || 'BORRADOR';

  const canManage=record ? committeeTrainingCanManage(record) : true;
  document.querySelectorAll('#committeeTrainingForm input,#committeeTrainingForm textarea,#committeeTrainingForm select')
    .forEach(el=>{
      if (el.id!=='committeeTrainingId' && el.id!=='committeeTrainingCommittee') {
        el.disabled=!canManage;
      }
    });
  committeeSelect.disabled=!!record || !canManage;
  document.getElementById('saveCommitteeTrainingButton')?.classList.toggle('hidden',!canManage);

  const shareSection=document.getElementById('committeeTrainingShareSection');
  const shareAvailable=!!record && record.estado==='LISTA'
    && committeeTrainingVideosFor(record.id).length>0
    && committeeTrainingQuestionRecords.filter(x=>x.capacitacion_id===record.id).length>0;
  shareSection?.classList.toggle('hidden',!shareAvailable);
  const shareInput=document.getElementById('committeeTrainingPublicLink');
  if (shareInput) shareInput.value=shareAvailable ? committeeTrainingPublicUrl(record) : '';

  const videoSection=document.getElementById('committeeTrainingVideoSection');
  videoSection.classList.toggle('hidden',!record);
  document.getElementById('addCommitteeTrainingVideoButton')?.classList.toggle('hidden',!record || !canManage);

  if (record) renderCommitteeTrainingVideoList(record.id);

  const examSection=document.getElementById('committeeTrainingExamSection');
  examSection?.classList.toggle('hidden',!record);
  const examHasResults=!!record && committeeTrainingAttempts.some(x=>x.capacitacion_id===record.id && x.finalizado_at);
  document.getElementById('addCommitteeTrainingQuestionButton')?.classList.toggle('hidden',!record || !canManage || examHasResults);
  ['committeeTrainingExamTime','committeeTrainingMinGrade','committeeTrainingAttempts','committeeTrainingShuffleQuestions','committeeTrainingShuffleOptions','committeeTrainingShowCorrectFinal','committeeTrainingShowExplanation','committeeTrainingRetryFailed'].forEach(id=>{
    const el=document.getElementById(id);
    if (el && examHasResults) el.disabled=true;
  });
  if (record) await loadCommitteeTrainingQuestions(record.id);

  const modal=document.getElementById('committeeTrainingModal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closeCommitteeTrainingModal() {
  const modal=document.getElementById('committeeTrainingModal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden','true');
  activeCommitteeTrainingId=null;
  document.body.classList.remove('modal-open');
}

async function saveCommitteeTraining(event) {
  event.preventDefault();
  committeeTrainingMessage('');

  const id=document.getElementById('committeeTrainingId').value || null;
  const comite_id=document.getElementById('committeeTrainingCommittee').value || null;
  const titulo=document.getElementById('committeeTrainingTitle').value.trim();
  const expositor=document.getElementById('committeeTrainingPresenter').value.trim();
  const cargo_expositor=document.getElementById('committeeTrainingPresenterRole').value.trim() || null;
  const fecha=document.getElementById('committeeTrainingDate').value;
  const duracion_horas=Number(document.getElementById('committeeTrainingHours').value || 0);
  const nota_minima=Number(document.getElementById('committeeTrainingMinGrade').value || 0);
  const max_intentos=Number(document.getElementById('committeeTrainingAttempts').value || 1);
  const examTimeRaw=document.getElementById('committeeTrainingExamTime').value;
  const tiempo_examen_min=examTimeRaw ? Number(examTimeRaw) : null;
  const mezclar_preguntas=document.getElementById('committeeTrainingShuffleQuestions').checked;
  const mezclar_opciones=document.getElementById('committeeTrainingShuffleOptions').checked;
  const mostrar_correctas_final=document.getElementById('committeeTrainingShowCorrectFinal').checked;
  const mostrar_explicacion=document.getElementById('committeeTrainingShowExplanation').checked;
  const reintento_solo_desaprobado=document.getElementById('committeeTrainingRetryFailed').checked;
  const objetivo=document.getElementById('committeeTrainingObjective').value.trim() || null;
  const descripcion=document.getElementById('committeeTrainingDescription').value.trim() || null;
  const estado=document.getElementById('committeeTrainingStatus').value;

  if (!comite_id || !titulo || !expositor || !fecha || !duracion_horas) {
    committeeTrainingMessage('Completa Comité/Subcomité, tema, expositor, fecha y duración.');
    return;
  }

  if (nota_minima<0 || nota_minima>20) {
    committeeTrainingMessage('La nota mínima debe estar entre 0 y 20.');
    return;
  }

  const committee=committeeRecords.find(x=>x.id===comite_id);
  if (!committee || !committeeCanManage(committee)) {
    committeeTrainingMessage('No tienes permiso para gestionar esta capacitación.');
    return;
  }

  const existingVideos=id ? committeeTrainingVideosFor(id) : [];
  const existingQuestions=id ? committeeTrainingQuestionRecords.filter(x=>x.capacitacion_id===id) : [];
  if (estado==='LISTA' && (existingVideos.length===0 || existingQuestions.length===0)) {
    committeeTrainingMessage(
      id
        ? 'Para marcar la capacitación como LISTA agrega al menos un video y una pregunta de examen.'
        : 'Primero guárdala como BORRADOR, agrega los videos y las preguntas, y después cambia el estado a LISTA.'
    );
    return;
  }

  const payload={
    comite_id,
    titulo,
    expositor,
    cargo_expositor,
    fecha,
    duracion_horas,
    nota_minima,
    max_intentos,
    tiempo_examen_min,
    mezclar_preguntas,
    mezclar_opciones,
    mostrar_correctas_final,
    mostrar_explicacion,
    reintento_solo_desaprobado,
    objetivo,
    descripcion,
    estado
  };
  if (!id) payload.created_by=currentProfile?.id || null;

  const button=document.getElementById('saveCommitteeTrainingButton');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Guardando…';

  const result=id
    ? await client.from('comite_sst_capacitaciones').update(payload).eq('id',id).select().single()
    : await client.from('comite_sst_capacitaciones').insert(payload).select().single();

  button.disabled=false;
  button.textContent=old;

  if (result.error) {
    console.error(result.error);
    committeeTrainingMessage(result.error.message || 'No fue posible guardar la capacitación.');
    return;
  }

  const savedId=result.data.id;
  committeeTrainingsLoaded=false;
  await loadCommitteeTrainingsModule(true);

  const savedRecord=committeeTrainingRecords.find(x=>x.id===savedId);
  openCommitteeTrainingModal(savedRecord);
  committeeTrainingMessage(
    id ? 'Capacitación actualizada correctamente.' : 'Capacitación creada. Ahora agrega los videos.',
    'success'
  );
}

function renderCommitteeTrainingVideoList(trainingId) {
  const container=document.getElementById('committeeTrainingVideoList');
  if (!container) return;

  const videos=committeeTrainingVideosFor(trainingId);
  const training=committeeTrainingRecords.find(x=>x.id===trainingId);
  const canManage=committeeTrainingCanManage(training);

  if (!videos.length) {
    container.innerHTML=`
      <div class="committee-video-empty">
        <span>▶</span>
        <strong>Aún no hay videos</strong>
        <p>Agrega el primer contenido audiovisual de esta capacitación.</p>
      </div>
    `;
    return;
  }

  container.innerHTML=videos.map((video,index)=>`
    <article class="committee-video-card">
      <div class="committee-video-order">${video.orden}</div>

      <div class="committee-video-card-main">
        <div class="committee-video-title-row">
          <div>
            <strong>${escapeHtml(video.titulo)}</strong>
            <div class="committee-video-badges">
              <span class="video-source-badge ${String(video.tipo_fuente||'').toLowerCase()}">${escapeHtml(committeeTrainingSourceLabel(video.tipo_fuente))}</span>
              ${video.obligatorio ? '<span class="video-required-badge">OBLIGATORIO</span>' : '<span class="video-optional-badge">OPCIONAL</span>'}
              ${video.duracion_minutos ? `<span class="video-duration-badge">${Number(video.duracion_minutos)} min</span>` : ''}
            </div>
          </div>
        </div>
        ${video.descripcion ? `<p>${escapeHtml(video.descripcion)}</p>` : ''}
      </div>

      <div class="committee-video-card-actions">
        <button class="secondary-btn small-btn" type="button" data-preview-training-video="${video.id}">Vista previa</button>
        ${canManage ? `
          <button class="video-order-btn" type="button" data-move-training-video="${video.id}" data-direction="up" ${index===0?'disabled':''}>↑</button>
          <button class="video-order-btn" type="button" data-move-training-video="${video.id}" data-direction="down" ${index===videos.length-1?'disabled':''}>↓</button>
          <button class="secondary-btn small-btn" type="button" data-edit-training-video="${video.id}">Editar</button>
          <button class="induction-delete-btn small-btn" type="button" data-delete-training-video="${video.id}">Eliminar</button>
        ` : ''}
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-preview-training-video]').forEach(button=>{
    button.addEventListener('click',()=>openCommitteeTrainingVideoPreview(button.dataset.previewTrainingVideo));
  });

  container.querySelectorAll('[data-edit-training-video]').forEach(button=>{
    button.addEventListener('click',()=>{
      const video=committeeTrainingVideos.find(x=>x.id===button.dataset.editTrainingVideo);
      openCommitteeTrainingVideoModal(video);
    });
  });

  container.querySelectorAll('[data-delete-training-video]').forEach(button=>{
    button.addEventListener('click',()=>deleteCommitteeTrainingVideo(button.dataset.deleteTrainingVideo));
  });

  container.querySelectorAll('[data-move-training-video]').forEach(button=>{
    button.addEventListener('click',()=>moveCommitteeTrainingVideo(
      button.dataset.moveTrainingVideo,
      button.dataset.direction
    ));
  });
}

function normalizeYoutubeUrl(value) {
  const raw=String(value || '').trim();
  if (!raw) return null;

  try {
    const url=new URL(raw);
    let id='';

    if (url.hostname.includes('youtu.be')) {
      id=url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (url.hostname.includes('youtube.com')) {
      if (url.pathname==='/watch') id=url.searchParams.get('v') || '';
      else {
        const parts=url.pathname.split('/').filter(Boolean);
        if (['embed','shorts','live'].includes(parts[0])) id=parts[1] || '';
      }
    }

    id=id.replace(/[^A-Za-z0-9_-]/g,'').slice(0,20);
    if (!id) return null;

    return {
      id,
      watch:`https://www.youtube.com/watch?v=${id}`,
      embed:`https://www.youtube.com/embed/${id}`
    };
  } catch {
    return null;
  }
}

function validHttpUrl(value) {
  try {
    const url=new URL(String(value || '').trim());
    return ['http:','https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function updateCommitteeTrainingVideoSourceFields() {
  const type=document.getElementById('committeeTrainingVideoSourceType')?.value || 'YOUTUBE';
  const urlField=document.getElementById('committeeTrainingVideoUrlField');
  const fileField=document.getElementById('committeeTrainingVideoFileField');
  const label=document.getElementById('committeeTrainingVideoUrlLabel');
  const input=document.getElementById('committeeTrainingVideoUrl');

  const isUpload=type==='MP4_UPLOAD';
  urlField?.classList.toggle('hidden',isUpload);
  fileField?.classList.toggle('hidden',!isUpload);

  if (!isUpload && label && input) {
    if (type==='YOUTUBE') {
      label.textContent='Enlace de YouTube *';
      input.placeholder='https://www.youtube.com/watch?v=...';
    } else {
      label.textContent='Enlace externo *';
      input.placeholder='https://...';
    }
  }
}

function openCommitteeTrainingVideoModal(video=null) {
  if (!activeCommitteeTrainingId) return;

  activeCommitteeTrainingVideoId=video?.id || null;
  committeeTrainingVideoMessage('');

  document.getElementById('committeeTrainingVideoModalTitle').textContent=
    video ? 'Editar video' : 'Agregar video';

  document.getElementById('committeeTrainingVideoId').value=video?.id || '';
  document.getElementById('committeeTrainingVideoTitle').value=video?.titulo || '';
  document.getElementById('committeeTrainingVideoSourceType').value=video?.tipo_fuente || 'YOUTUBE';
  document.getElementById('committeeTrainingVideoMinutes').value=video?.duracion_minutos ?? '';
  document.getElementById('committeeTrainingVideoUrl').value=video?.url || '';
  document.getElementById('committeeTrainingVideoDescription').value=video?.descripcion || '';
  document.getElementById('committeeTrainingVideoRequired').checked=video?.obligatorio ?? true;
  document.getElementById('committeeTrainingVideoFile').value='';

  updateCommitteeTrainingVideoSourceFields();

  const modal=document.getElementById('committeeTrainingVideoModal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closeCommitteeTrainingVideoModal() {
  const modal=document.getElementById('committeeTrainingVideoModal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden','true');
  activeCommitteeTrainingVideoId=null;

  // El modal principal sigue abierto.
  if (!document.getElementById('committeeTrainingModal')?.classList.contains('hidden')) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }
}

async function saveCommitteeTrainingVideo(event) {
  event.preventDefault();
  committeeTrainingVideoMessage('');

  if (!activeCommitteeTrainingId) {
    committeeTrainingVideoMessage('Primero guarda la capacitación.');
    return;
  }

  const training=committeeTrainingRecords.find(x=>x.id===activeCommitteeTrainingId);
  if (!training || !committeeTrainingCanManage(training)) {
    committeeTrainingVideoMessage('No tienes permiso para modificar este contenido.');
    return;
  }

  const id=document.getElementById('committeeTrainingVideoId').value || null;
  const title=document.getElementById('committeeTrainingVideoTitle').value.trim();
  const type=document.getElementById('committeeTrainingVideoSourceType').value;
  const description=document.getElementById('committeeTrainingVideoDescription').value.trim() || null;
  const minutesRaw=document.getElementById('committeeTrainingVideoMinutes').value;
  const duracion_minutos=minutesRaw ? Number(minutesRaw) : null;
  const obligatorio=document.getElementById('committeeTrainingVideoRequired').checked;
  const rawUrl=document.getElementById('committeeTrainingVideoUrl').value.trim();
  const file=document.getElementById('committeeTrainingVideoFile').files?.[0] || null;
  const existing=id ? committeeTrainingVideos.find(x=>x.id===id) : null;

  if (!title) {
    committeeTrainingVideoMessage('Ingresa el título del video.');
    return;
  }

  if (duracion_minutos!==null && (!Number.isFinite(duracion_minutos) || duracion_minutos<=0)) {
    committeeTrainingVideoMessage('La duración debe ser mayor a 0.');
    return;
  }

  let url=null;
  let storage_path=existing?.storage_path || null;
  let uploadedNewPath=null;

  if (type==='YOUTUBE') {
    const youtube=normalizeYoutubeUrl(rawUrl);
    if (!youtube) {
      committeeTrainingVideoMessage('Ingresa un enlace válido de YouTube.');
      return;
    }
    url=youtube.watch;
    storage_path=null;
  } else if (type==='ENLACE') {
    url=validHttpUrl(rawUrl);
    if (!url) {
      committeeTrainingVideoMessage('Ingresa un enlace externo válido que empiece con http:// o https://.');
      return;
    }
    storage_path=null;
  } else if (type==='MP4_UPLOAD') {
    if (!file && !(existing?.tipo_fuente==='MP4_UPLOAD' && existing?.storage_path)) {
      committeeTrainingVideoMessage('Selecciona el archivo MP4.');
      return;
    }

    if (file) {
      const isMp4=file.type==='video/mp4' || file.name.toLowerCase().endsWith('.mp4');
      if (!isMp4) {
        committeeTrainingVideoMessage('El archivo debe ser MP4.');
        return;
      }

      if (file.size>50*1024*1024) {
        committeeTrainingVideoMessage(
          'El MP4 supera 50 MB. Para videos pesados utiliza YouTube no listado o un enlace externo.'
        );
        return;
      }
    }
    url=null;
  }

  const button=document.getElementById('saveCommitteeTrainingVideoButton');
  const old=button.textContent;
  button.disabled=true;
  button.textContent=type==='MP4_UPLOAD' && file ? 'Subiendo video…' : 'Guardando…';

  try {
    if (type==='MP4_UPLOAD' && file) {
      const path=`${activeCommitteeTrainingId}/${crypto.randomUUID()}.mp4`;

      const {error:uploadError}=await client.storage
        .from('comite-sst-capacitaciones')
        .upload(path,file,{
          contentType:'video/mp4',
          cacheControl:'3600',
          upsert:false
        });

      if (uploadError) throw uploadError;

      storage_path=path;
      uploadedNewPath=path;
    }

    const videos=committeeTrainingVideosFor(activeCommitteeTrainingId);
    const order=existing?.orden || ((videos.at(-1)?.orden || 0)+1);

    const payload={
      capacitacion_id:activeCommitteeTrainingId,
      orden:order,
      titulo:title,
      descripcion:description,
      tipo_fuente:type,
      url,
      storage_path,
      duracion_minutos,
      obligatorio
    };

    const result=id
      ? await client.from('comite_sst_capacitacion_videos').update(payload).eq('id',id)
      : await client.from('comite_sst_capacitacion_videos').insert(payload);

    if (result.error) throw result.error;

    // Si se reemplazó un MP4 anterior, elimina el archivo anterior después de guardar correctamente.
    if (
      existing?.storage_path &&
      existing.storage_path!==storage_path &&
      existing.tipo_fuente==='MP4_UPLOAD'
    ) {
      const remove=await client.storage
        .from('comite-sst-capacitaciones')
        .remove([existing.storage_path]);
      if (remove.error) console.warn(remove.error);
    }

    closeCommitteeTrainingVideoModal();
    committeeTrainingsLoaded=false;
    await loadCommitteeTrainingsModule(true);

    const refreshed=committeeTrainingRecords.find(x=>x.id===activeCommitteeTrainingId);
    if (refreshed) {
      openCommitteeTrainingModal(refreshed);
      committeeTrainingMessage(
        id ? 'Video actualizado correctamente.' : 'Video agregado correctamente.',
        'success'
      );
    }
  } catch(err) {
    console.error(err);

    if (uploadedNewPath) {
      const cleanup=await client.storage
        .from('comite-sst-capacitaciones')
        .remove([uploadedNewPath]);
      if (cleanup.error) console.warn(cleanup.error);
    }

    committeeTrainingVideoMessage(err?.message || 'No fue posible guardar el video.');
  } finally {
    button.disabled=false;
    button.textContent=old;
  }
}

async function moveCommitteeTrainingVideo(id,direction) {
  const video=committeeTrainingVideos.find(x=>x.id===id);
  if (!video) return;

  const training=committeeTrainingRecords.find(x=>x.id===video.capacitacion_id);
  if (!training || !committeeTrainingCanManage(training)) return;

  const videos=committeeTrainingVideosFor(video.capacitacion_id);
  const index=videos.findIndex(x=>x.id===id);
  const otherIndex=direction==='up' ? index-1 : index+1;

  if (index<0 || otherIndex<0 || otherIndex>=videos.length) return;

  const other=videos[otherIndex];
  const currentOrder=video.orden;
  const otherOrder=other.orden;

  const [a,b]=await Promise.all([
    client.from('comite_sst_capacitacion_videos').update({orden:otherOrder}).eq('id',video.id),
    client.from('comite_sst_capacitacion_videos').update({orden:currentOrder}).eq('id',other.id)
  ]);

  if (a.error || b.error) {
    committeeTrainingMessage(a.error?.message || b.error?.message || 'No fue posible reordenar los videos.');
    return;
  }

  committeeTrainingsLoaded=false;
  await loadCommitteeTrainingsModule(true);
  const refreshed=committeeTrainingRecords.find(x=>x.id===activeCommitteeTrainingId);
  if (refreshed) openCommitteeTrainingModal(refreshed);
}

async function deleteCommitteeTrainingVideo(id) {
  const video=committeeTrainingVideos.find(x=>x.id===id);
  if (!video) return;

  const training=committeeTrainingRecords.find(x=>x.id===video.capacitacion_id);
  if (!training || !committeeTrainingCanManage(training)) return;

  if (!confirm(`¿Eliminar el video "${video.titulo}"?`)) return;

  const {error}=await client.from('comite_sst_capacitacion_videos').delete().eq('id',id);
  if (error) {
    committeeTrainingMessage(error.message || 'No fue posible eliminar el video.');
    return;
  }

  if (video.tipo_fuente==='MP4_UPLOAD' && video.storage_path) {
    const remove=await client.storage
      .from('comite-sst-capacitaciones')
      .remove([video.storage_path]);
    if (remove.error) console.warn(remove.error);
  }

  // Reordena los videos restantes.
  const remaining=committeeTrainingVideosFor(video.capacitacion_id)
    .filter(x=>x.id!==id);

  // Una capacitación LISTA no puede quedar publicada sin videos.
  if (remaining.length===0 && training.estado==='LISTA') {
    const downgrade=await client.from('comite_sst_capacitaciones')
      .update({estado:'BORRADOR'})
      .eq('id',training.id);
    if (downgrade.error) console.warn(downgrade.error);
  }

  for (let i=0;i<remaining.length;i++) {
    if (remaining[i].orden!==i+1) {
      const update=await client.from('comite_sst_capacitacion_videos')
        .update({orden:i+1})
        .eq('id',remaining[i].id);
      if (update.error) console.warn(update.error);
    }
  }

  committeeTrainingsLoaded=false;
  await loadCommitteeTrainingsModule(true);
  const refreshed=committeeTrainingRecords.find(x=>x.id===activeCommitteeTrainingId);
  if (refreshed) {
    openCommitteeTrainingModal(refreshed);
    committeeTrainingMessage('Video eliminado.','success');
  }
}

async function deleteCommitteeTraining(id) {
  const training=committeeTrainingRecords.find(x=>x.id===id);
  if (!training || !committeeTrainingCanManage(training)) return;

  const videos=committeeTrainingVideosFor(id);
  if (!confirm(
    `¿Eliminar definitivamente la capacitación "${training.titulo}"?\n\n`+
    `También se eliminarán ${videos.length} video(s) asociados.`
  )) return;

  const paths=videos
    .filter(x=>x.tipo_fuente==='MP4_UPLOAD' && x.storage_path)
    .map(x=>x.storage_path);

  const questionImages=await client.from('comite_sst_capacitacion_preguntas')
    .select('imagen_path')
    .eq('capacitacion_id',id);
  const questionImagePaths=(questionImages.data || []).map(x=>x.imagen_path).filter(Boolean);

  const {error}=await client.from('comite_sst_capacitaciones').delete().eq('id',id);
  if (error) {
    committeeMessage(error.message || 'No fue posible eliminar la capacitación.');
    return;
  }

  if (paths.length) {
    const remove=await client.storage.from('comite-sst-capacitaciones').remove(paths);
    if (remove.error) console.warn(remove.error);
  }
  if (questionImagePaths.length) {
    const removeImages=await client.storage.from('comite-sst-preguntas').remove(questionImagePaths);
    if (removeImages.error) console.warn(removeImages.error);
  }

  committeeTrainingsLoaded=false;
  await loadCommitteeTrainingsModule(true);
  committeeMessage('Capacitación eliminada correctamente.','success');
}

async function openCommitteeTrainingVideoPreview(id) {
  const video=committeeTrainingVideos.find(x=>x.id===id);
  if (!video) return;

  const title=document.getElementById('committeeTrainingVideoPreviewTitle');
  const body=document.getElementById('committeeTrainingVideoPreviewBody');
  if (!title || !body) return;

  title.textContent=video.titulo || 'Video';
  body.innerHTML='<div class="training-library-empty">Cargando vista previa…</div>';

  const modal=document.getElementById('committeeTrainingVideoPreviewModal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');

  try {
    if (video.tipo_fuente==='YOUTUBE') {
      const youtube=normalizeYoutubeUrl(video.url);
      if (!youtube) throw new Error('El enlace de YouTube no es válido.');

      body.innerHTML=`
        <div class="committee-video-preview-frame">
          <iframe
            src="${escapeHtml(youtube.embed)}"
            title="${escapeHtml(video.titulo)}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      `;
      return;
    }

    if (video.tipo_fuente==='MP4_UPLOAD') {
      const {data,error}=await client.storage
        .from('comite-sst-capacitaciones')
        .createSignedUrl(video.storage_path,3600);

      if (error || !data?.signedUrl) {
        throw error || new Error('No fue posible generar el enlace temporal del video.');
      }

      body.innerHTML=`
        <video class="committee-video-preview-player" src="${escapeHtml(data.signedUrl)}" controls playsinline></video>
      `;
      return;
    }

    const url=validHttpUrl(video.url);
    if (!url) throw new Error('El enlace externo no es válido.');

    if (/\.mp4(?:$|\?)/i.test(url)) {
      body.innerHTML=`
        <video class="committee-video-preview-player" src="${escapeHtml(url)}" controls playsinline></video>
      `;
    } else {
      body.innerHTML=`
        <div class="committee-external-video-card">
          <span>↗</span>
          <strong>Contenido alojado externamente</strong>
          <p>Este enlace se abrirá en una nueva pestaña.</p>
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="primary-btn">Abrir video</a>
        </div>
      `;
    }
  } catch(err) {
    console.error(err);
    body.innerHTML=`<div class="form-message visible error">${escapeHtml(err?.message || 'No fue posible mostrar el video.')}</div>`;
  }
}

function closeCommitteeTrainingVideoPreview() {
  const modal=document.getElementById('committeeTrainingVideoPreviewModal');
  const body=document.getElementById('committeeTrainingVideoPreviewBody');
  if (body) body.innerHTML='';
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden','true');

  if (
    !document.getElementById('committeeTrainingModal')?.classList.contains('hidden')
    || !document.getElementById('committeeTrainingVideoModal')?.classList.contains('hidden')
  ) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }
}



// ============================================================
// ETAPA 16D.3 · EXAMEN FINAL + RESULTADOS + RETROALIMENTACIÓN
// ============================================================

function committeeTrainingQuestionMessage(message='',type='error') {
  const el=document.getElementById('committeeTrainingQuestionMessage');
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function committeeTrainingQuestionTypeLabel(type) {
  return {
    SINGLE:'Opción múltiple',
    TRUE_FALSE:'Verdadero / Falso',
    MULTIPLE:'Varias respuestas',
    FREE_TEXT:'Respuesta libre'
  }[type] || type || '—';
}

async function loadCommitteeTrainingQuestions(trainingId) {
  const container=document.getElementById('committeeTrainingQuestionList');
  if (container) container.innerHTML='<div class="training-library-empty">Cargando preguntas…</div>';

  const {data,error}=await client.rpc('listar_preguntas_capacitacion_comite',{
    p_capacitacion_id:trainingId
  });

  if (error || !data?.ok) {
    console.error(error,data);
    committeeTrainingQuestionDetails=[];
    if (container) container.innerHTML=`<div class="training-library-empty">${escapeHtml(data?.error || error?.message || 'No fue posible cargar las preguntas.')}</div>`;
    return [];
  }

  committeeTrainingQuestionDetails=data.preguntas || [];
  renderCommitteeTrainingQuestions(trainingId);
  return committeeTrainingQuestionDetails;
}

function renderCommitteeTrainingQuestions(trainingId) {
  const container=document.getElementById('committeeTrainingQuestionList');
  if (!container) return;

  const training=committeeTrainingRecords.find(x=>x.id===trainingId);
  const canManage=committeeTrainingCanManage(training);
  const examLocked=committeeTrainingAttempts.some(x=>x.capacitacion_id===trainingId && x.finalizado_at);
  const questions=committeeTrainingQuestionDetails || [];
  const totalPoints=questions.reduce((sum,q)=>sum+Number(q.peso || 0),0);

  document.getElementById('committeeTrainingQuestionCount').textContent=String(questions.length);
  document.getElementById('committeeTrainingQuestionPoints').textContent=String(Number(totalPoints.toFixed(2)));
  document.getElementById('committeeTrainingExamPassing').textContent=String(Number(training?.nota_minima ?? 16));
  document.getElementById('committeeTrainingExamAttempts').textContent=String(Number(training?.max_intentos ?? 1));

  if (!questions.length) {
    container.innerHTML=`
      <div class="committee-question-empty">
        <span>?</span>
        <strong>El examen todavía no tiene preguntas</strong>
        <p>Agrega preguntas para que el examen pueda habilitarse al finalizar los videos.</p>
      </div>
    `;
    return;
  }

  container.innerHTML=questions.map((q,index)=>{
    const correct=q.tipo==='FREE_TEXT'
      ? (q.respuestas_aceptadas || []).join(' / ')
      : (q.opciones || []).filter(o=>o.es_correcta).map(o=>o.texto).join(' / ');

    return `
      <article class="committee-question-card">
        <div class="committee-question-number">${index+1}</div>
        <div class="committee-question-main">
          <div class="committee-question-title-row">
            <strong>${escapeHtml(q.enunciado || '')}</strong>
            <span class="committee-question-points">${Number(q.peso || 0)} pts</span>
          </div>
          <div class="committee-question-meta">
            <span>${escapeHtml(committeeTrainingQuestionTypeLabel(q.tipo))}</span>
            <span>${escapeHtml(q.nivel_tema || 'General')}</span>
          </div>
          ${q.imagen_url ? `<img src="${escapeHtml(q.imagen_url)}" alt="Imagen de la pregunta" class="committee-question-thumb" />` : ''}
          <div class="committee-question-correct"><b>Correcta:</b> ${escapeHtml(correct || '—')}</div>
          ${q.explicacion ? `<p class="committee-question-explanation"><b>Explicación:</b> ${escapeHtml(q.explicacion)}</p>` : ''}
        </div>
        ${canManage && !examLocked ? `<div class="committee-question-actions"><button class="secondary-btn small-btn" type="button" data-edit-committee-question="${q.id}">Editar</button><button class="induction-delete-btn small-btn" type="button" data-delete-committee-question="${q.id}">Eliminar</button></div>` : (examLocked ? '<span class="committee-exam-locked-note">Examen bloqueado por resultados existentes</span>' : '')}
      </article>
    `;
  }).join('');

  container.querySelectorAll('[data-edit-committee-question]').forEach(button=>{
    button.addEventListener('click',()=>{
      const question=committeeTrainingQuestionDetails.find(x=>x.id===button.dataset.editCommitteeQuestion);
      openCommitteeTrainingQuestionModal(question);
    });
  });

  container.querySelectorAll('[data-delete-committee-question]').forEach(button=>{
    button.addEventListener('click',()=>deleteCommitteeTrainingQuestion(button.dataset.deleteCommitteeQuestion));
  });
}

function committeeTrainingDefaultOptions(type) {
  if (type==='TRUE_FALSE') {
    return [
      {texto:'Verdadero',es_correcta:true},
      {texto:'Falso',es_correcta:false}
    ];
  }
  return [
    {texto:'',es_correcta:true},
    {texto:'',es_correcta:false},
    {texto:'',es_correcta:false},
    {texto:'',es_correcta:false}
  ];
}

function collectCommitteeTrainingQuestionOptionDrafts() {
  return [...document.querySelectorAll('[data-committee-question-option-row]')].map(row=>({
    texto:row.querySelector('.committee-question-option-text')?.value || '',
    es_correcta:!!row.querySelector('.committee-question-option-correct')?.checked
  }));
}

function renderCommitteeTrainingQuestionOptions(type='SINGLE',question=null,overrideOptions=null) {
  const editor=document.getElementById('committeeTrainingQuestionOptionsEditor');
  const freeField=document.getElementById('committeeTrainingFreeTextField');
  const help=document.getElementById('committeeTrainingQuestionAnswerHelp');
  if (!editor || !freeField) return;

  const isFree=type==='FREE_TEXT';
  freeField.classList.toggle('hidden',!isFree);
  editor.classList.toggle('hidden',isFree);

  if (isFree) {
    help.textContent='Escribe una o más respuestas aceptadas, una por línea.';
    const accepted=question?.respuestas_aceptadas || [];
    document.getElementById('committeeTrainingFreeTextAnswers').value=accepted.join('\n');
    editor.innerHTML='';
    return;
  }

  let options=overrideOptions || question?.opciones || committeeTrainingDefaultOptions(type);
  if (type==='TRUE_FALSE') {
    const correctText=(options.find(x=>x.es_correcta)?.texto || 'Verdadero').toLowerCase();
    options=[
      {texto:'Verdadero',es_correcta:correctText==='verdadero'},
      {texto:'Falso',es_correcta:correctText==='falso'}
    ];
  }

  help.textContent=type==='MULTIPLE'
    ? 'Marca todas las alternativas correctas.'
    : 'Marca una sola alternativa correcta.';

  const inputType=type==='MULTIPLE'?'checkbox':'radio';
  editor.innerHTML=`
    <div class="committee-question-option-list">
      ${options.map((option,index)=>`
        <div class="committee-question-option-row" data-committee-question-option-row>
          <input class="committee-question-option-correct" type="${inputType}" ${inputType==='radio'?'name="committee-question-correct"':''} ${option.es_correcta?'checked':''} aria-label="Respuesta correcta" />
          <span class="committee-question-option-letter">${String.fromCharCode(65+index)}</span>
          <input class="committee-question-option-text" value="${escapeHtml(option.texto || '')}" placeholder="Alternativa ${String.fromCharCode(65+index)}" ${type==='TRUE_FALSE'?'readonly':''} />
          ${type!=='TRUE_FALSE' && options.length>2 ? `<button class="committee-question-remove-option" type="button" data-remove-committee-question-option="${index}">×</button>` : ''}
        </div>
      `).join('')}
    </div>
    ${type!=='TRUE_FALSE' ? '<button id="addCommitteeTrainingQuestionOptionButton" class="secondary-btn small-btn" type="button">+ Agregar alternativa</button>' : ''}
  `;

  editor.querySelectorAll('[data-remove-committee-question-option]').forEach(button=>{
    button.addEventListener('click',()=>{
      const current=collectCommitteeTrainingQuestionOptionDrafts();
      current.splice(Number(button.dataset.removeCommitteeQuestionOption),1);
      renderCommitteeTrainingQuestionOptions(type,null,current);
    });
  });

  document.getElementById('addCommitteeTrainingQuestionOptionButton')?.addEventListener('click',()=>{
    const current=collectCommitteeTrainingQuestionOptionDrafts();
    if (current.length>=8) {
      committeeTrainingQuestionMessage('Se permite un máximo de 8 alternativas.');
      return;
    }
    current.push({texto:'',es_correcta:false});
    renderCommitteeTrainingQuestionOptions(type,null,current);
  });
}

function renderCommitteeTrainingQuestionImagePreview(url='',path='') {
  const box=document.getElementById('committeeTrainingQuestionImagePreview');
  if (!box) return;
  box.classList.toggle('hidden',!url);
  box.innerHTML=url ? `
    <div class="committee-question-image-preview-card">
      <img src="${escapeHtml(url)}" alt="Imagen actual de la pregunta" />
      <button id="removeCommitteeTrainingQuestionImageButton" class="induction-delete-btn small-btn" type="button">Quitar imagen</button>
    </div>
  ` : '';

  document.getElementById('removeCommitteeTrainingQuestionImageButton')?.addEventListener('click',()=>{
    committeeTrainingQuestionRemovedImagePath=path || document.getElementById('committeeTrainingQuestionImagePath').value || null;
    document.getElementById('committeeTrainingQuestionImagePath').value='';
    document.getElementById('committeeTrainingQuestionImageUrl').value='';
    document.getElementById('committeeTrainingQuestionImage').value='';
    renderCommitteeTrainingQuestionImagePreview('','');
  });
}

function openCommitteeTrainingQuestionModal(question=null) {
  if (!activeCommitteeTrainingId) return;
  activeCommitteeTrainingQuestionId=question?.id || null;
  committeeTrainingQuestionRemovedImagePath=null;
  committeeTrainingQuestionMessage('');

  document.getElementById('committeeTrainingQuestionModalTitle').textContent=question?'Editar pregunta':'Nueva pregunta';
  document.getElementById('committeeTrainingQuestionId').value=question?.id || '';
  document.getElementById('committeeTrainingQuestionText').value=question?.enunciado || '';
  document.getElementById('committeeTrainingQuestionType').value=question?.tipo || 'SINGLE';
  document.getElementById('committeeTrainingQuestionTopic').value=question?.nivel_tema || 'General';
  document.getElementById('committeeTrainingQuestionWeight').value=question?.peso ?? 1;
  document.getElementById('committeeTrainingQuestionExplanation').value=question?.explicacion || '';
  document.getElementById('committeeTrainingQuestionImage').value='';
  document.getElementById('committeeTrainingQuestionImagePath').value=question?.imagen_path || '';
  document.getElementById('committeeTrainingQuestionImageUrl').value=question?.imagen_url || '';
  document.getElementById('committeeTrainingFreeTextAnswers').value=(question?.respuestas_aceptadas || []).join('\n');

  renderCommitteeTrainingQuestionImagePreview(question?.imagen_url || '',question?.imagen_path || '');
  renderCommitteeTrainingQuestionOptions(question?.tipo || 'SINGLE',question);

  const modal=document.getElementById('committeeTrainingQuestionModal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closeCommitteeTrainingQuestionModal() {
  const modal=document.getElementById('committeeTrainingQuestionModal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden','true');
  activeCommitteeTrainingQuestionId=null;
  committeeTrainingQuestionRemovedImagePath=null;
  if (!document.getElementById('committeeTrainingModal')?.classList.contains('hidden')) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }
}

async function saveCommitteeTrainingQuestion() {
  if (!activeCommitteeTrainingId) return;
  committeeTrainingQuestionMessage('');

  const training=committeeTrainingRecords.find(x=>x.id===activeCommitteeTrainingId);
  if (!training || !committeeTrainingCanManage(training)) return;

  const id=document.getElementById('committeeTrainingQuestionId').value || null;
  const enunciado=document.getElementById('committeeTrainingQuestionText').value.trim();
  const tipo=document.getElementById('committeeTrainingQuestionType').value;
  const nivel_tema=document.getElementById('committeeTrainingQuestionTopic').value.trim() || 'General';
  const peso=Number(document.getElementById('committeeTrainingQuestionWeight').value || 0);
  const explicacion=document.getElementById('committeeTrainingQuestionExplanation').value.trim() || '';
  const file=document.getElementById('committeeTrainingQuestionImage').files?.[0] || null;
  const previousPath=document.getElementById('committeeTrainingQuestionImagePath').value || null;
  let imagen_path=previousPath;
  let imagen_url=document.getElementById('committeeTrainingQuestionImageUrl').value || '';
  let uploadedPath=null;

  if (!enunciado) {
    committeeTrainingQuestionMessage('Ingresa el enunciado de la pregunta.');
    return;
  }
  if (!peso || peso<=0) {
    committeeTrainingQuestionMessage('El peso debe ser mayor que cero.');
    return;
  }

  let opciones=[];
  let respuestas_aceptadas=[];

  if (tipo==='FREE_TEXT') {
    respuestas_aceptadas=document.getElementById('committeeTrainingFreeTextAnswers').value
      .split('\n')
      .map(x=>x.trim())
      .filter(Boolean);
    if (!respuestas_aceptadas.length) {
      committeeTrainingQuestionMessage('Agrega al menos una respuesta aceptada.');
      return;
    }
  } else {
    opciones=collectCommitteeTrainingQuestionOptionDrafts()
      .map(x=>({texto:x.texto.trim(),es_correcta:x.es_correcta}))
      .filter(x=>x.texto);
    if (opciones.length<2) {
      committeeTrainingQuestionMessage('Agrega al menos dos alternativas.');
      return;
    }
    const correct=opciones.filter(x=>x.es_correcta).length;
    if (['SINGLE','TRUE_FALSE'].includes(tipo) && correct!==1) {
      committeeTrainingQuestionMessage('Marca una sola alternativa correcta.');
      return;
    }
    if (tipo==='MULTIPLE' && correct<1) {
      committeeTrainingQuestionMessage('Marca al menos una alternativa correcta.');
      return;
    }
  }

  if (file) {
    const allowed=['image/jpeg','image/png','image/webp','image/gif'];
    if (!allowed.includes(file.type)) {
      committeeTrainingQuestionMessage('La imagen debe ser JPG, PNG, WEBP o GIF.');
      return;
    }
    if (file.size>5*1024*1024) {
      committeeTrainingQuestionMessage('La imagen supera el máximo de 5 MB.');
      return;
    }
  }

  const button=document.getElementById('saveCommitteeTrainingQuestionButton');
  const old=button.textContent;
  button.disabled=true;
  button.textContent=file?'Subiendo imagen…':'Guardando…';

  try {
    if (file) {
      const extension=(file.name.split('.').pop() || 'jpg').toLowerCase();
      const path=`${activeCommitteeTrainingId}/${crypto.randomUUID()}.${extension}`;
      const upload=await client.storage.from('comite-sst-preguntas').upload(path,file,{
        contentType:file.type,
        cacheControl:'3600',
        upsert:false
      });
      if (upload.error) throw upload.error;
      uploadedPath=path;
      imagen_path=path;
      imagen_url=client.storage.from('comite-sst-preguntas').getPublicUrl(path).data.publicUrl;
    }

    const payload={
      enunciado,
      tipo,
      nivel_tema,
      explicacion,
      peso,
      imagen_url,
      imagen_path,
      respuestas_aceptadas,
      opciones
    };

    const {data,error}=await client.rpc('guardar_pregunta_capacitacion_comite',{
      p_capacitacion_id:activeCommitteeTrainingId,
      p_pregunta_id:id,
      p_data:payload
    });

    if (error || !data?.ok) throw new Error(data?.error || error?.message || 'No fue posible guardar la pregunta.');

    const pathsToRemove=new Set();
    if (committeeTrainingQuestionRemovedImagePath) pathsToRemove.add(committeeTrainingQuestionRemovedImagePath);
    if (file && previousPath && previousPath!==imagen_path) pathsToRemove.add(previousPath);
    pathsToRemove.delete(imagen_path);
    if (pathsToRemove.size) {
      const remove=await client.storage.from('comite-sst-preguntas').remove([...pathsToRemove]);
      if (remove.error) console.warn(remove.error);
    }

    closeCommitteeTrainingQuestionModal();
    committeeTrainingsLoaded=false;
    await loadCommitteeTrainingsModule(true);
    await loadCommitteeTrainingQuestions(activeCommitteeTrainingId);
    committeeTrainingMessage(id?'Pregunta actualizada correctamente.':'Pregunta agregada correctamente.','success');
  } catch(err) {
    console.error(err);
    if (uploadedPath) {
      const cleanup=await client.storage.from('comite-sst-preguntas').remove([uploadedPath]);
      if (cleanup.error) console.warn(cleanup.error);
    }
    committeeTrainingQuestionMessage(err?.message || 'No fue posible guardar la pregunta.');
  } finally {
    button.disabled=false;
    button.textContent=old;
  }
}

async function deleteCommitteeTrainingQuestion(id) {
  const q=committeeTrainingQuestionDetails.find(x=>x.id===id);
  if (!q) return;
  if (!confirm(`¿Eliminar la pregunta ${q.orden}? Esta acción también elimina sus alternativas.`)) return;

  const {data,error}=await client.rpc('eliminar_pregunta_capacitacion_comite',{
    p_pregunta_id:id
  });
  if (error || !data?.ok) {
    committeeTrainingMessage(data?.error || error?.message || 'No fue posible eliminar la pregunta.');
    return;
  }

  if (q.imagen_path) {
    const remove=await client.storage.from('comite-sst-preguntas').remove([q.imagen_path]);
    if (remove.error) console.warn(remove.error);
  }

  committeeTrainingsLoaded=false;
  await loadCommitteeTrainingsModule(true);
  await loadCommitteeTrainingQuestions(activeCommitteeTrainingId);
  committeeTrainingMessage('Pregunta eliminada.','success');
}

function committeeTrainingParticipantById(id) {
  return committeeTrainingParticipants.find(x=>x.id===id) || null;
}

function committeeTrainingParticipantWorker(participant) {
  const value=participant?.trabajadores;
  return Array.isArray(value) ? (value[0] || {}) : (value || {});
}

function committeeTrainingParticipantName(participant) {
  const worker=committeeTrainingParticipantWorker(participant);
  return [worker.apellidos,worker.nombres].filter(Boolean).join(' ') || '—';
}

async function openCommitteeTrainingResultsModal(trainingId) {
  committeeTrainingsLoaded=false;
  await loadCommitteeTrainingsModule(true);

  const training=committeeTrainingRecords.find(x=>x.id===trainingId);
  if (!training) return;

  const attempts=committeeTrainingAttempts
    .filter(x=>x.capacitacion_id===trainingId && x.finalizado_at)
    .sort((a,b)=>new Date(b.finalizado_at)-new Date(a.finalizado_at));

  const uniqueParticipants=[...new Set(attempts.map(x=>x.participante_id))];
  const approvedParticipants=new Set(attempts.filter(x=>x.aprobado).map(x=>x.participante_id));
  const bestNotes=uniqueParticipants.map(pid=>Math.max(...attempts.filter(x=>x.participante_id===pid).map(x=>Number(x.nota || 0))));
  const average=bestNotes.length ? bestNotes.reduce((a,b)=>a+b,0)/bestNotes.length : 0;
  const approval=uniqueParticipants.length ? Math.round(approvedParticipants.size/uniqueParticipants.length*100) : 0;

  document.getElementById('committeeTrainingResultsTitle').textContent=training.titulo || 'Resultados';
  document.getElementById('committeeTrainingResultsSubtitle').textContent=`${training.codigo || ''} · Nota mínima ${Number(training.nota_minima || 0)}`;
  document.getElementById('committeeTrainingResultsAttempts').textContent=String(attempts.length);
  document.getElementById('committeeTrainingResultsParticipants').textContent=String(uniqueParticipants.length);
  document.getElementById('committeeTrainingResultsApproval').textContent=`${approval}%`;
  document.getElementById('committeeTrainingResultsAverage').textContent=average.toFixed(1);

  const body=document.getElementById('committeeTrainingResultsBody');
  body.innerHTML=attempts.length ? attempts.map(attempt=>{
    const participant=committeeTrainingParticipantById(attempt.participante_id);
    const worker=committeeTrainingParticipantWorker(participant);
    return `
      <tr>
        <td><strong>${escapeHtml(committeeTrainingParticipantName(participant))}</strong><small>${escapeHtml(worker.dni || '')}</small></td>
        <td>${attempt.numero_intento}</td>
        <td><strong>${Number(attempt.nota || 0).toFixed(1)}</strong></td>
        <td><span class="result-status ${attempt.aprobado?'approved':'failed'}">${attempt.aprobado?'APROBADO':'DESAPROBADO'}</span></td>
        <td>${new Date(attempt.finalizado_at).toLocaleString('es-PE')}</td>
        <td class="committee-training-result-actions-cell">
          <button class="eval-row-btn" type="button" data-committee-training-attempt-detail="${attempt.id}">⌄ Ver</button>
          <button class="result-download-btn" type="button" data-download-committee-training-exam="${attempt.id}">Examen PDF</button>
        </td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="6" class="table-empty">Todavía no hay resultados.</td></tr>';

  body.querySelectorAll('[data-committee-training-attempt-detail]').forEach(button=>{
    button.addEventListener('click',()=>toggleCommitteeTrainingAttemptDetail(button.dataset.committeeTrainingAttemptDetail));
  });
  body.querySelectorAll('[data-download-committee-training-exam]').forEach(button=>{
    button.addEventListener('click',()=>downloadCommitteeTrainingAttemptPdf(button.dataset.downloadCommitteeTrainingExam,button));
  });

  document.getElementById('committeeTrainingAttemptDetail').classList.add('hidden');
  document.getElementById('committeeTrainingAttemptDetail').innerHTML='';
  await renderCommitteeTrainingGapAnalysis(trainingId,attempts);

  const modal=document.getElementById('committeeTrainingResultsModal');
  modal.dataset.trainingId=trainingId;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closeCommitteeTrainingResultsModal() {
  const modal=document.getElementById('committeeTrainingResultsModal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden','true');
  const detail=document.getElementById('committeeTrainingAttemptDetail');
  if (detail) { detail.classList.add('hidden'); detail.innerHTML=''; detail.dataset.attemptId=''; }
  if (!document.getElementById('committeeTrainingModal')?.classList.contains('hidden')) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }
}

async function toggleCommitteeTrainingAttemptDetail(attemptId) {
  const box=document.getElementById('committeeTrainingAttemptDetail');
  if (!box) return;
  if (box.dataset.attemptId===attemptId && !box.classList.contains('hidden')) {
    box.classList.add('hidden');
    box.dataset.attemptId='';
    return;
  }

  box.classList.remove('hidden');
  box.dataset.attemptId=attemptId;
  box.innerHTML='<div class="training-library-empty">Cargando respuestas…</div>';

  const {data,error}=await client.rpc('obtener_resultado_capacitacion_comite_admin',{
    p_intento_id:attemptId
  });

  if (error || !data?.ok) {
    box.innerHTML=`<div class="training-library-empty">${escapeHtml(data?.error || error?.message || 'No fue posible cargar el resultado.')}</div>`;
    return;
  }

  const participant=data.participante || {};
  const attempt=data.intento || {};
  box.innerHTML=`
    <div class="committee-training-attempt-detail-head">
      <div><span class="eyebrow">DETALLE DEL INTENTO</span><h4>${escapeHtml(participant.nombre || 'Participante')}</h4><p>DNI ${escapeHtml(participant.dni || '—')} · Intento ${attempt.numero_intento || '—'} · Nota ${Number(attempt.nota || 0).toFixed(1)}</p></div>
      ${participant.firma ? `<img src="${participant.firma}" alt="Firma" class="evaluation-signature-thumb large" />` : ''}
    </div>
    <div class="committee-training-admin-answer-list">
      ${(data.preguntas || []).map((q,index)=>{
        const selected=q.tipo==='FREE_TEXT'
          ? (q.respuesta_texto || 'Sin respuesta')
          : ((q.respuesta_seleccionada || []).join(' / ') || 'Sin respuesta');
        const correct=(q.respuestas_correctas || []).join(' / ') || '—';
        return `<article class="${q.es_correcta?'correct':'wrong'}"><strong>${index+1}. ${escapeHtml(q.enunciado || '')}</strong>${q.imagen_url?`<img src="${escapeHtml(q.imagen_url)}" alt="Imagen de la pregunta" />`:''}<p><b>Respuesta:</b> ${escapeHtml(selected)}</p><p><b>Correcta:</b> ${escapeHtml(correct)}</p><p><b>Puntaje:</b> ${Number(q.puntaje || 0)} / ${Number(q.peso || 0)}</p>${q.explicacion?`<small>${escapeHtml(q.explicacion)}</small>`:''}</article>`;
      }).join('')}
    </div>
  `;
}

async function renderCommitteeTrainingGapAnalysis(trainingId,attempts) {
  const box=document.getElementById('committeeTrainingGapAnalysis');
  if (!box) return;
  if (!attempts.length) {
    box.innerHTML='<div class="training-library-empty">Sin datos todavía.</div>';
    return;
  }

  // Para no sobreponderar reintentos se analiza el último intento finalizado de cada participante.
  const latestByParticipant=new Map();
  attempts.forEach(attempt=>{
    const current=latestByParticipant.get(attempt.participante_id);
    if (!current || Number(attempt.numero_intento)>Number(current.numero_intento)) {
      latestByParticipant.set(attempt.participante_id,attempt);
    }
  });
  const ids=[...latestByParticipant.values()].map(x=>x.id);
  if (!ids.length) return;

  const {data,error}=await client.from('comite_sst_capacitacion_respuestas')
    .select('intento_id,pregunta_id,es_correcta')
    .in('intento_id',ids);

  if (error) {
    console.error(error);
    box.innerHTML='<div class="training-library-empty">No se pudo calcular el análisis de brechas.</div>';
    return;
  }

  const qmap=new Map(
    committeeTrainingQuestionRecords
      .filter(q=>q.capacitacion_id===trainingId)
      .map(q=>[q.id,q])
  );
  const stats=new Map();
  (data || []).forEach(row=>{
    const q=qmap.get(row.pregunta_id);
    if (!q) return;
    const topic=q.nivel_tema || 'General';
    if (!stats.has(topic)) stats.set(topic,{total:0,errors:0});
    const item=stats.get(topic);
    item.total++;
    if (!row.es_correcta) item.errors++;
  });

  const rows=[...stats.entries()]
    .map(([tema,x])=>({tema,pct:x.total?Math.round(x.errors/x.total*100):0}))
    .sort((a,b)=>b.pct-a.pct || a.tema.localeCompare(b.tema));

  box.innerHTML=rows.length ? rows.map(x=>`
    <div class="evaluation-gap-row">
      <div><span>${escapeHtml(x.tema)}</span><strong>${x.pct}% error</strong></div>
      <div><i style="width:${x.pct}%"></i></div>
    </div>
  `).join('') : '<div class="training-library-empty">Sin brechas registradas.</div>';
}

// ============================================================
// ETAPA 16D.4 · DOCUMENTOS Y REPORTES
// ============================================================

function committeeTrainingLatestAttempts(trainingId) {
  const rows=committeeTrainingAttempts
    .filter(x=>x.capacitacion_id===trainingId && x.finalizado_at)
    .sort((a,b)=>{
      if (a.participante_id===b.participante_id) {
        return Number(b.numero_intento||0)-Number(a.numero_intento||0) || new Date(b.finalizado_at)-new Date(a.finalizado_at);
      }
      return new Date(b.finalizado_at)-new Date(a.finalizado_at);
    });

  const map=new Map();
  rows.forEach(row=>{
    if (!map.has(row.participante_id)) map.set(row.participante_id,row);
  });
  return [...map.values()];
}

function committeeTrainingDocumentUnit(training) {
  const committee=committeeTrainingCommittee(training);
  if (!committee) return '—';
  return `${committee.tipo==='SUBCOMITE'?'Proyecto':'Sede'} - ${committeeUnitName(committee)}`;
}

function committeeTrainingDocumentParticipantRows(trainingId) {
  return committeeTrainingLatestAttempts(trainingId)
    .map(attempt=>{
      const participant=committeeTrainingParticipantById(attempt.participante_id);
      const worker=committeeTrainingParticipantWorker(participant);
      return {attempt,participant,worker};
    })
    .filter(x=>x.participant && x.worker)
    .sort((a,b)=>committeeTrainingParticipantName(a.participant).localeCompare(committeeTrainingParticipantName(b.participant),'es'));
}

function safeDocumentFileName(value,fallback='documento') {
  const text=String(value || fallback)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^A-Za-z0-9_-]+/g,'_')
    .replace(/^_+|_+$/g,'')
    .slice(0,80);
  return text || fallback;
}

function committeeTrainingPdfText(doc,value,x,y,size=8,bold=false,align='left',color=[20,20,20]) {
  doc.setFont('helvetica',bold?'bold':'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(String(value ?? ''),x,y,{align});
}

function committeeTrainingPdfFitText(doc,value,x,y,maxWidth,size=8,bold=false,align='left',color=[20,20,20]) {
  let text=String(value ?? '');
  doc.setFont('helvetica',bold?'bold':'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  if (doc.getTextWidth(text)<=maxWidth) {
    doc.text(text,x,y,{align});
    return;
  }
  while (text.length>3 && doc.getTextWidth(`${text}…`)>maxWidth) text=text.slice(0,-1);
  doc.text(`${text}…`,x,y,{align});
}

function committeeTrainingRegisterDrawCheckbox(doc,checked,x,y) {
  doc.setDrawColor(30,30,30);
  doc.setLineWidth(.18);
  doc.rect(x,y,2.7,2.7);
  if (checked) {
    doc.setLineWidth(.38);
    doc.line(x+.45,y+1.35,x+1.12,y+2.05);
    doc.line(x+1.12,y+2.05,x+2.35,y+.5);
  }
}

async function downloadCommitteeTrainingRegisterPdf(trainingId=null,button=null) {
  const id=trainingId || document.getElementById('committeeTrainingResultsModal')?.dataset.trainingId;
  const training=committeeTrainingRecords.find(x=>x.id===id);
  if (!training) return alert('No se encontró la capacitación.');
  if (!window.jspdf?.jsPDF) return alert('No se cargó el generador PDF.');

  const rows=committeeTrainingDocumentParticipantRows(id);
  if (!rows.length) {
    alert('Todavía no existen participantes con evaluación finalizada para generar el registro.');
    return;
  }

  const old=button?.textContent || '';
  if (button) { button.disabled=true; button.textContent='Generando…'; }

  try {
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    let logo=null;
    try { logo=await imageToDataUrl('assets/logo-explo.jpg'); } catch(err) { console.warn(err); }

    const BLACK=[20,20,20], DARK=[82,82,82], LIGHT=[232,232,232], RED=[192,0,0], WHITE=[255,255,255];
    const pageW=210,left=5,right=205,totalW=200;
    const committee=committeeTrainingCommittee(training);
    const members=committeeActiveMembers(training.comite_id).length;
    const chunks=[];
    for (let i=0;i<rows.length;i+=20) chunks.push(rows.slice(i,i+20));

    const rect=(x,y,w,h,fill=null,lw=.2)=>{
      doc.setDrawColor(...BLACK); doc.setLineWidth(lw);
      if (fill) { doc.setFillColor(...fill); doc.rect(x,y,w,h,'FD'); }
      else doc.rect(x,y,w,h,'S');
    };
    const line=(x1,y1,x2,y2,lw=.2)=>{doc.setDrawColor(...BLACK);doc.setLineWidth(lw);doc.line(x1,y1,x2,y2);};
    const txt=(v,x,y,size=5,bold=false,align='left',color=BLACK)=>committeeTrainingPdfText(doc,v,x,y,size,bold,align,color);
    const fit=(v,x,y,w,size=5,bold=false,align='left',color=BLACK)=>committeeTrainingPdfFitText(doc,v,x,y,w,size,bold,align,color);

    for (let pageIndex=0;pageIndex<chunks.length;pageIndex++) {
      if (pageIndex>0) doc.addPage();
      const participants=chunks[pageIndex];
      const hy=5,hh=19,logoW=36,titleW=120,metaW=44;
      rect(left,hy,totalW,hh);
      line(left+logoW,hy,left+logoW,hy+hh);
      line(left+logoW+titleW,hy,left+logoW+titleW,hy+hh);
      if (logo) doc.addImage(logo,'JPEG',left+2,hy+1,logoW-4,hh-2,undefined,'FAST');
      const tx=left+logoW;
      line(tx,hy+8.3,tx+titleW,hy+8.3);
      txt('SIG - SSOMAC',tx+titleW/2,hy+5.7,8.2,true,'center');
      rect(tx,hy+8.3,titleW,10.7,RED);
      txt('REGISTRO DE INDUCCIÓN, CAPACITACIÓN, ENTRENAMIENTO Y SIMULACRO DE EMERGENCIA',tx+titleW/2,hy+14.8,5.3,true,'center',WHITE);

      const mx=tx+titleW;
      const meta=[['Código:',PDF_EMPLOYER.codigoFormato],['N°:',PDF_EMPLOYER.numeroFormato],['Versión:',PDF_EMPLOYER.version],['Fecha Act:',PDF_EMPLOYER.fechaActualizacion]];
      meta.forEach((row,i)=>{
        const y=hy+i*(hh/4);
        if (i>0) line(mx,y,right,y);
        line(mx+13,y,mx+13,y+hh/4);
        txt(row[0],mx+1.5,y+3.2,4.2,true);
        fit(row[1],mx+14.5,y+3.2,metaW-15.5,4.0,i<3);
      });

      let y=24;
      rect(left,y,totalW,4.5);
      txt('DATOS DE EMPLEADOR:',left+1,y+3.15,5,true);
      y+=4.5;
      const ew=[36,30,66,33,35];
      const eh=['RAZÓN O DENOMINACIÓN SOCIAL','RUC','DOMICILIO (Dirección, distrito, provincia, dpto.)','ACTIVIDAD ECONÓMICA','N° TRABAJADORES EN EL CENTRO LABORAL'];
      let x=left;
      ew.forEach((w,i)=>{rect(x,y,w,8,DARK);fit(eh[i],x+w/2,y+4.6,w-2,3.7,true,'center',WHITE);x+=w;});
      y+=8;
      const ev=[PDF_EMPLOYER.razonSocial,PDF_EMPLOYER.ruc,PDF_EMPLOYER.domicilio,PDF_EMPLOYER.actividad,String(members||0)];
      x=left;
      ew.forEach((w,i)=>{rect(x,y,w,7,LIGHT);fit(ev[i],x+w/2,y+4.35,w-2,3.8,false,'center');x+=w;});
      y+=7;

      // Clasificación + datos de la capacitación.
      const classW=33, detailX=left+classW, detailW=167;
      rect(left,y,classW,32);
      rect(detailX,y,detailW,32);
      txt('CLASIFICACIÓN',left+1,y+3.2,4.5,true);
      const opts=['INDUCCIÓN','CAPACITACIÓN','ENTRENAMIENTO','SIMULACRO DE EMERGENCIA','VISITANTES','RE-INDUCCIÓN','CAMBIO DE PUESTO','REUNIÓN','OTROS'];
      opts.forEach((opt,i)=>{
        const yy=y+5.2+i*2.85;
        committeeTrainingRegisterDrawCheckbox(doc,opt==='CAPACITACIÓN',left+1,yy-2.1);
        txt(opt,left+4.4,yy,3.8,opt==='CAPACITACIÓN');
      });

      const rowH=5.33;
      const labelW=17,rightColX=detailX+119,rightLabelW=16;
      const labelsLeft=[
        ['TEMA:',training.titulo || '—'],
        ['EXPOSITOR:',training.expositor || '—'],
        ['CARGO:',training.cargo_expositor || '—'],
        ['EMPRESA:',PDF_EMPLOYER.razonSocial],
        ['ÁREA:','SSOMAC'],
        ['UNIDAD:',committeeTrainingDocumentUnit(training)]
      ];
      const labelsRight=[
        ['FIRMA:',''],
        ['DNI:',''],
        ['FECHA:',formatDatePE(training.fecha)],
        ['TIEMPO:',`${Number(training.duracion_horas||0)} h`],
        ['CÓDIGO:',training.codigo || '—'],
        ['COMITÉ:',committee?.codigo || '—']
      ];
      for (let i=0;i<6;i++) {
        const yy=y+i*rowH;
        if (i>0) line(detailX,yy,detailX+detailW,yy);
        line(detailX+labelW,yy,detailX+labelW,yy+rowH);
        line(rightColX,yy,rightColX,yy+rowH);
        line(rightColX+rightLabelW,yy,rightColX+rightLabelW,yy+rowH);
        txt(labelsLeft[i][0],detailX+1,yy+3.55,4.1,true);
        fit(labelsLeft[i][1],detailX+labelW+1,yy+3.55,rightColX-(detailX+labelW)-2,4.0,false);
        txt(labelsRight[i][0],rightColX+1,yy+3.55,4.1,true);
        fit(labelsRight[i][1],rightColX+rightLabelW+1,yy+3.55,(detailX+detailW)-(rightColX+rightLabelW)-2,4.0,false);
      }
      y+=32;

      const body=[];
      for (let i=0;i<20;i++) {
        const item=participants[i] || null;
        body.push(item ? [
          String(pageIndex*20+i+1),
          committeeTrainingParticipantName(item.participant),
          item.worker.dni || '',
          item.worker.cargo || '',
          item.worker.area || '',
          '',
          Number(item.attempt.nota || 0).toFixed(1)
        ] : [String(pageIndex*20+i+1),'','','','','','']);
      }

      doc.autoTable({
        startY:y,
        head:[['N°','APELLIDOS Y NOMBRES','N° DNI','PUESTO DE TRABAJO','ÁREA','FIRMA','NOTA']],
        body,
        margin:{left,right:5},
        tableWidth:200,
        styles:{font:'helvetica',fontSize:4.5,cellPadding:1.2,minCellHeight:7.1,valign:'middle',lineColor:[25,25,25],lineWidth:.18,textColor:BLACK},
        headStyles:{fillColor:DARK,textColor:WHITE,fontStyle:'bold',halign:'center',minCellHeight:7},
        columnStyles:{0:{cellWidth:9,halign:'center'},1:{cellWidth:47},2:{cellWidth:22,halign:'center'},3:{cellWidth:41},4:{cellWidth:27},5:{cellWidth:38},6:{cellWidth:16,halign:'center'}},
        didDrawCell:(cellData)=>{
          if (cellData.section!=='body' || cellData.column.index!==5) return;
          const item=participants[cellData.row.index];
          if (!item?.participant?.firma_electronica) return;
          try {
            const sig=item.participant.firma_electronica;
            const prop=doc.getImageProperties(sig);
            const maxW=cellData.cell.width-2,maxH=cellData.cell.height-1.4;
            const ratio=Math.min(maxW/prop.width,maxH/prop.height);
            const w=prop.width*ratio,h=prop.height*ratio;
            doc.addImage(sig,'PNG',cellData.cell.x+(cellData.cell.width-w)/2,cellData.cell.y+(cellData.cell.height-h)/2,w,h,undefined,'FAST');
          } catch(err) { console.warn('Firma no insertada',err); }
        }
      });

      const fy=Math.min(281,doc.lastAutoTable.finalY+2);
      rect(left,fy,totalW,4,LIGHT);
      txt('RESPONSABLE DEL REGISTRO',105,fy+2.8,4.3,true,'center');
      rect(left,fy+4,100,10);
      rect(left+100,fy+4,100,10);
      txt('NOMBRE:',left+1,fy+7.4,4,true);
      fit([currentProfile?.nombres,currentProfile?.apellidos].filter(Boolean).join(' ') || training.expositor || '—',left+18,fy+7.4,77,4.1,false);
      txt('FIRMA:',left+101,fy+7.4,4,true);
      txt('CARGO:',left+1,fy+12.2,4,true);
      fit(currentProfile?.cargo || training.cargo_expositor || '—',left+18,fy+12.2,77,4.1,false);
      txt('FECHA:',left+101,fy+12.2,4,true);
      txt(formatDatePE(training.fecha),left+116,fy+12.2,4.1,false);
      txt(`Página ${pageIndex+1} de ${chunks.length}`,right,291,4,false,'right',[110,110,110]);
    }

    doc.save(`${safeDocumentFileName(training.codigo,'CAP_COMITE')}_Registro_Capacitacion.pdf`);
  } catch(err) {
    console.error(err);
    alert(err?.message || 'No fue posible generar el registro PDF.');
  } finally {
    if (button) { button.disabled=false; button.textContent=old; }
  }
}

async function generateCommitteeTrainingExamPdf(detail,options={}) {
  if (!window.jspdf?.jsPDF) throw new Error('No se cargó el generador PDF.');
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  const training=detail.capacitacion || detail.training || {};
  const participant=detail.participante || {};
  const attempt=detail.intento || {};
  const questions=detail.preguntas || [];
  const GREEN=[0,145,55], RED=[192,0,0], BLACK=[20,20,20], GRAY=[95,105,118], LIGHT=[225,230,236];
  let logo=null;
  try { logo=await imageToDataUrl('assets/logo-explo.jpg'); } catch(err) { console.warn(err); }

  const text=(v,x,y,size=8,bold=false,align='left',color=BLACK)=>committeeTrainingPdfText(doc,v,x,y,size,bold,align,color);
  const wrapped=(v,x,y,maxW,size=8,bold=false,color=BLACK,lineGap=4)=>{
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);
    const lines=doc.splitTextToSize(String(v ?? ''),maxW);
    doc.text(lines,x,y,{lineHeightFactor:1.12});
    return y+lines.length*lineGap;
  };
  const header=()=>{
    if (logo) doc.addImage(logo,'JPEG',14,8,31,18,undefined,'FAST');
    text('SIG - SSOMAC',105,14,10,true,'center');
    text('EXAMEN',105,23,15,true,'center');
    text('Código: EDP-SIG-SSOMAC-RE-EA-122',151,12,6.8);
    text('N°: 8',151,18,6.8);
    text('Versión: 1',151,24,6.8);
    doc.setDrawColor(0,0,0);doc.setLineWidth(.45);doc.line(14,30,196,30);
    text('RESOLUCIÓN DEL EXAMEN',105,39,12.5,true,'center');
  };
  const footer=()=>{
    const page=doc.internal.getCurrentPageInfo().pageNumber;
    text(`Explo Drilling Perú S.R.L. · Sistema Integrado de Gestión · Página ${page}`,105,291,5,false,'center',[130,130,130]);
  };
  const ensure=(needed=20)=>{
    if (cursor+needed>282) { footer(); doc.addPage(); header(); cursor=48; }
  };

  header();
  let cursor=51;
  const meta=[
    ['Participante:',participant.nombre || '—'],
    ['DNI:',participant.dni || '—'],
    ['Cargo:',participant.cargo || '—'],
    ['Área:',participant.area || '—'],
    ['Curso:',training.titulo || training.tema || '—'],
    ['Fecha:',formatLongDatePE(training.fecha)]
  ];
  for (const [label,value] of meta) {
    text(label,18,cursor,8.5,true);
    cursor=wrapped(value,48,cursor,140,8.5,false,BLACK,4)+1;
  }
  cursor+=3;
  text(`Nota Final: ${Number(attempt.nota || 0).toFixed(1)}`,18,cursor,11,true,'left',attempt.aprobado?GREEN:RED);cursor+=6;
  text(`Estado: ${attempt.aprobado?'APROBADO':'DESAPROBADO'}`,18,cursor,11,true,'left',attempt.aprobado?GREEN:RED);cursor+=6;
  text(`Preguntas Correctas: ${attempt.correctas || 0} / ${attempt.total || questions.length}`,18,cursor,10,true);cursor+=8;

  for (let i=0;i<questions.length;i++) {
    const q=questions[i];
    ensure(28);
    doc.setDrawColor(...LIGHT);doc.setLineWidth(.25);doc.line(17,cursor-3,193,cursor-3);
    cursor=wrapped(`${i+1}. ${q.enunciado || ''}`,18,cursor,173,9.2,true,BLACK,4.3)+1;
    text(`Tema: ${q.nivel_tema || 'General'} · ${q.es_correcta?'CORRECTA':'INCORRECTA'}`,20,cursor,7.4,true,'left',q.es_correcta?GREEN:RED);cursor+=5;

    if (q.imagen_url) {
      try {
        ensure(45);
        const img=await imageToDataUrl(q.imagen_url);
        const prop=doc.getImageProperties(img);
        const maxW=90,maxH=40,ratio=Math.min(maxW/prop.width,maxH/prop.height);
        const w=prop.width*ratio,h=prop.height*ratio;
        doc.addImage(img,'JPEG',20,cursor,w,h,undefined,'FAST');
        cursor+=h+4;
      } catch(err) { console.warn('Imagen de pregunta no insertada',err); }
    }

    const response=q.tipo==='FREE_TEXT'
      ? (q.respuesta_texto || 'Sin respuesta')
      : ((q.respuesta_seleccionada || []).join(' / ') || 'Sin respuesta');
    const correct=(q.respuestas_correctas || []).join(' / ') || '—';
    cursor=wrapped(`Tu respuesta: ${response}`,20,cursor,168,8,false,q.es_correcta?GREEN:RED,3.8)+1;
    cursor=wrapped(`Respuesta correcta: ${correct}`,20,cursor,168,8,true,GREEN,3.8)+1;
    text(`Puntos: ${Number(q.puntaje || 0)} / ${Number(q.peso || 0)}`,20,cursor,7.7,true);cursor+=5;
    if (q.explicacion) {
      cursor=wrapped(`Retroalimentación: ${q.explicacion}`,20,cursor,168,7.7,false,GRAY,3.7)+2;
    } else cursor+=2;
  }

  ensure(30);
  doc.setDrawColor(...LIGHT);doc.line(18,cursor,192,cursor);cursor+=8;
  if (participant.firma) {
    text('Firma del participante:',18,cursor,8.5,true);
    try {
      const prop=doc.getImageProperties(participant.firma);
      const ratio=Math.min(40/prop.width,16/prop.height);
      const w=prop.width*ratio,h=prop.height*ratio;
      doc.addImage(participant.firma,'PNG',55,cursor-7,w,h,undefined,'FAST');
    } catch(err) { console.warn(err); }
    cursor+=12;
  }
  text(`Intento: ${attempt.numero_intento || '—'}`,18,cursor,8);cursor+=5;
  text(`Finalizado: ${attempt.finalizado_at ? new Date(attempt.finalizado_at).toLocaleString('es-PE') : '—'}`,18,cursor,8);
  footer();

  const name=safeDocumentFileName(participant.nombre,'Participante');
  const code=safeDocumentFileName(training.codigo,'CAP_COMITE');
  const filename=`${code}_Examen_${name}_Intento_${attempt.numero_intento || 1}.pdf`;
  if (options.returnBlob) return {blob:doc.output('blob'),filename};
  doc.save(filename);
  return {filename};
}

async function downloadCommitteeTrainingAttemptPdf(attemptId,button=null) {
  const old=button?.textContent || '';
  if (button) { button.disabled=true; button.textContent='Generando…'; }
  try {
    const attempt=committeeTrainingAttempts.find(x=>x.id===attemptId);
    const training=committeeTrainingRecords.find(x=>x.id===attempt?.capacitacion_id);
    if (!attempt || !training) throw new Error('No se encontró el resultado.');
    const {data,error}=await client.rpc('obtener_resultado_capacitacion_comite_admin',{p_intento_id:attemptId});
    if (error || !data?.ok) throw new Error(data?.error || error?.message || 'No fue posible cargar el examen.');
    await generateCommitteeTrainingExamPdf({...data,capacitacion:training});
  } catch(err) {
    console.error(err); alert(err?.message || 'No fue posible generar el examen PDF.');
  } finally {
    if (button) { button.disabled=false; button.textContent=old; }
  }
}

async function downloadPublicCommitteeTrainingExamPdf() {
  if (!publicCommitteeTrainingLastExamAttemptId || !publicCommitteeTrainingToken || !publicCommitteeTrainingDni) {
    alert('No se encontró el resultado del examen.');
    return;
  }
  const button=document.getElementById('publicCommitteeTrainingDownloadExamButton');
  const old=button?.textContent || '';
  if (button) { button.disabled=true; button.textContent='Generando…'; }
  try {
    const {data,error}=await client.rpc('obtener_documento_examen_capacitacion_comite_publico',{
      p_token:publicCommitteeTrainingToken,
      p_dni:publicCommitteeTrainingDni,
      p_intento_id:publicCommitteeTrainingLastExamAttemptId
    });
    if (error || !data?.ok) throw new Error(data?.error || error?.message || 'No fue posible cargar el documento.');
    await generateCommitteeTrainingExamPdf(data);
  } catch(err) {
    console.error(err); alert(err?.message || 'No fue posible generar el examen PDF.');
  } finally {
    if (button) { button.disabled=false; button.textContent=old || 'Descargar mi examen PDF'; }
  }
}

async function committeeTrainingGapRows(trainingIds=null) {
  const idSet=trainingIds ? new Set(Array.isArray(trainingIds)?trainingIds:[trainingIds]) : null;
  const latest=[];
  const grouped=new Map();
  committeeTrainingAttempts.filter(x=>x.finalizado_at && (!idSet || idSet.has(x.capacitacion_id))).forEach(a=>{
    const key=`${a.capacitacion_id}:${a.participante_id}`;
    const current=grouped.get(key);
    if (!current || Number(a.numero_intento)>Number(current.numero_intento)) grouped.set(key,a);
  });
  latest.push(...grouped.values());
  if (!latest.length) return [];

  const {data,error}=await client.from('comite_sst_capacitacion_respuestas')
    .select('intento_id,pregunta_id,es_correcta')
    .in('intento_id',latest.map(x=>x.id));
  if (error) throw error;

  const qMap=new Map(committeeTrainingQuestionRecords.map(q=>[q.id,q]));
  const attemptMap=new Map(latest.map(a=>[a.id,a]));
  const stats=new Map();
  (data || []).forEach(r=>{
    const a=attemptMap.get(r.intento_id),q=qMap.get(r.pregunta_id);
    if (!a || !q) return;
    const key=`${a.capacitacion_id}|||${q.nivel_tema || 'General'}`;
    if (!stats.has(key)) stats.set(key,{capacitacion_id:a.capacitacion_id,tema:q.nivel_tema || 'General',total:0,errores:0});
    const item=stats.get(key); item.total++; if (!r.es_correcta) item.errores++;
  });
  return [...stats.values()].map(x=>({...x,error_pct:x.total?Math.round(x.errores/x.total*100):0}));
}

async function downloadCommitteeTrainingResultsReportPdf(trainingId=null,button=null) {
  const id=trainingId || document.getElementById('committeeTrainingResultsModal')?.dataset.trainingId;
  const training=committeeTrainingRecords.find(x=>x.id===id);
  if (!training) return alert('No se encontró la capacitación.');
  if (!window.jspdf?.jsPDF) return alert('No se cargó el generador PDF.');

  const old=button?.textContent || '';
  if (button) { button.disabled=true; button.textContent='Generando…'; }
  try {
    const rows=committeeTrainingDocumentParticipantRows(id);
    const gap=await committeeTrainingGapRows(id);
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
    let logo=null;try{logo=await imageToDataUrl('assets/logo-explo.jpg');}catch{}
    if (logo) doc.addImage(logo,'JPEG',12,8,30,17,undefined,'FAST');
    committeeTrainingPdfText(doc,'SIG - SSOMAC',148,13,10,true,'center');
    committeeTrainingPdfText(doc,'REPORTE DE RESULTADOS - CAPACITACIÓN DEL COMITÉ SST',148,21,13,true,'center');
    committeeTrainingPdfText(doc,training.codigo || '—',285,12,7,false,'right');
    doc.setDrawColor(192,0,0);doc.setLineWidth(.8);doc.line(12,28,285,28);

    const approved=rows.filter(x=>x.attempt.aprobado).length;
    const avg=rows.length?rows.reduce((s,x)=>s+Number(x.attempt.nota||0),0)/rows.length:0;
    committeeTrainingPdfText(doc,`Tema: ${training.titulo}`,12,37,9,true);
    committeeTrainingPdfText(doc,`Comité / Unidad: ${committeeTrainingDocumentUnit(training)}`,12,43,8);
    committeeTrainingPdfText(doc,`Expositor: ${training.expositor || '—'} · Fecha: ${formatDatePE(training.fecha)} · Duración: ${Number(training.duracion_horas||0)} h`,12,49,8);
    committeeTrainingPdfText(doc,`Participantes evaluados: ${rows.length}    Aprobados: ${approved}    Aprobación: ${rows.length?Math.round(approved/rows.length*100):0}%    Promedio: ${avg.toFixed(1)}`,12,56,9,true);

    doc.autoTable({
      startY:62,
      head:[['N°','APELLIDOS Y NOMBRES','DNI','PUESTO','ÁREA','INTENTO FINAL','NOTA','ESTADO','FECHA']],
      body:rows.map((x,i)=>[i+1,committeeTrainingParticipantName(x.participant),x.worker.dni||'',x.worker.cargo||'',x.worker.area||'',x.attempt.numero_intento,Number(x.attempt.nota||0).toFixed(1),x.attempt.aprobado?'APROBADO':'DESAPROBADO',new Date(x.attempt.finalizado_at).toLocaleDateString('es-PE')]),
      styles:{fontSize:6.6,cellPadding:1.8,lineColor:[210,215,222],lineWidth:.15,valign:'middle'},
      headStyles:{fillColor:[70,70,70],textColor:[255,255,255],fontStyle:'bold'},
      columnStyles:{0:{cellWidth:10},1:{cellWidth:55},2:{cellWidth:25},3:{cellWidth:45},4:{cellWidth:35},5:{cellWidth:22},6:{cellWidth:18},7:{cellWidth:28},8:{cellWidth:25}}
    });

    let y=doc.lastAutoTable.finalY+9;
    if (y>165) { doc.addPage(); y=20; }
    committeeTrainingPdfText(doc,'TEMAS A REFORZAR',12,y,9,true);y+=5;
    const gapRows=gap.sort((a,b)=>b.error_pct-a.error_pct);
    doc.autoTable({
      startY:y,
      head:[['NIVEL / TEMA','RESPUESTAS','ERRORES','% ERROR']],
      body:(gapRows.length?gapRows:[{tema:'Sin brechas registradas',total:0,errores:0,error_pct:0}]).map(x=>[x.tema,x.total,x.errores,`${x.error_pct}%`]),
      styles:{fontSize:7,cellPadding:2,lineColor:[215,220,226],lineWidth:.15},
      headStyles:{fillColor:[192,0,0],textColor:[255,255,255]}
    });
    const pages=doc.getNumberOfPages();
    for(let i=1;i<=pages;i++){doc.setPage(i);committeeTrainingPdfText(doc,`Explo Drilling Perú S.R.L. · Sistema Integrado de Gestión · Página ${i} de ${pages}`,148,202,5,false,'center',[125,125,125]);}
    doc.save(`${safeDocumentFileName(training.codigo,'CAP_COMITE')}_Reporte_Resultados.pdf`);
  } catch(err) {
    console.error(err);alert(err?.message || 'No fue posible generar el reporte PDF.');
  } finally {
    if(button){button.disabled=false;button.textContent=old;}
  }
}

async function buildCommitteeTrainingWorkbook(trainingIds=null) {
  if (!window.XLSX) throw new Error('No se cargó el generador de Excel.');
  const ids=trainingIds ? new Set(Array.isArray(trainingIds)?trainingIds:[trainingIds]) : null;
  const trainings=committeeTrainingRecords.filter(t=>!ids || ids.has(t.id));
  const gapRows=await committeeTrainingGapRows(trainings.map(t=>t.id));

  const summary=trainings.map(t=>{
    const latest=committeeTrainingDocumentParticipantRows(t.id);
    const approved=latest.filter(x=>x.attempt.aprobado).length;
    const avg=latest.length?latest.reduce((s,x)=>s+Number(x.attempt.nota||0),0)/latest.length:0;
    const committee=committeeTrainingCommittee(t);
    return {
      'Código':t.codigo || '',
      'Capacitación':t.titulo || '',
      'Tipo':committee?.tipo==='SUBCOMITE'?'Subcomité SST':'Comité SST',
      'Unidad':committeeTrainingDocumentUnit(t),
      'Fecha':formatDatePE(t.fecha),
      'Expositor':t.expositor || '',
      'Horas':Number(t.duracion_horas||0),
      'Videos':committeeTrainingVideosFor(t.id).length,
      'Preguntas':committeeTrainingQuestionRecords.filter(q=>q.capacitacion_id===t.id).length,
      'Participantes evaluados':latest.length,
      'Aprobados':approved,
      'Aprobación %':latest.length?Math.round(approved/latest.length*100):0,
      'Promedio':Number(avg.toFixed(1)),
      'Estado':t.estado || ''
    };
  });

  const participants=[];
  trainings.forEach(t=>{
    committeeTrainingDocumentParticipantRows(t.id).forEach(x=>participants.push({
      'Código':t.codigo || '',
      'Capacitación':t.titulo || '',
      'Unidad':committeeTrainingDocumentUnit(t),
      'Fecha capacitación':formatDatePE(t.fecha),
      'Apellidos y nombres':committeeTrainingParticipantName(x.participant),
      'DNI':x.worker.dni || '',
      'Puesto':x.worker.cargo || '',
      'Área':x.worker.area || '',
      'Intento final':x.attempt.numero_intento,
      'Nota':Number(Number(x.attempt.nota||0).toFixed(1)),
      'Resultado':x.attempt.aprobado?'APROBADO':'DESAPROBADO',
      'Contenido completado':x.participant.contenido_completado_at ? new Date(x.participant.contenido_completado_at).toLocaleString('es-PE') : '',
      'Examen finalizado':x.attempt.finalizado_at ? new Date(x.attempt.finalizado_at).toLocaleString('es-PE') : ''
    }));
  });

  const attempts=committeeTrainingAttempts
    .filter(a=>a.finalizado_at && trainings.some(t=>t.id===a.capacitacion_id))
    .map(a=>{
      const t=trainings.find(x=>x.id===a.capacitacion_id);
      const p=committeeTrainingParticipantById(a.participante_id);
      const w=committeeTrainingParticipantWorker(p);
      return {
        'Código':t?.codigo || '',
        'Capacitación':t?.titulo || '',
        'Participante':committeeTrainingParticipantName(p),
        'DNI':w.dni || '',
        'Intento':a.numero_intento,
        'Nota':Number(Number(a.nota||0).toFixed(1)),
        'Correctas':a.correctas,
        'Total preguntas':a.total_preguntas,
        'Resultado':a.aprobado?'APROBADO':'DESAPROBADO',
        'Fecha y hora':new Date(a.finalizado_at).toLocaleString('es-PE')
      };
    });

  const gaps=gapRows.map(x=>{
    const t=trainings.find(t=>t.id===x.capacitacion_id);
    return {'Código':t?.codigo || '', 'Capacitación':t?.titulo || '', 'Tema / nivel':x.tema, 'Respuestas analizadas':x.total, 'Errores':x.errores, '% Error':x.error_pct};
  });

  const wb=XLSX.utils.book_new();
  const addSheet=(name,data,widths)=>{
    const ws=XLSX.utils.json_to_sheet(data.length?data:[{'Sin datos':'No existen registros'}]);
    ws['!cols']=widths.map(w=>({wch:w}));
    ws['!autofilter']=data.length?{ref:ws['!ref']}:undefined;
    XLSX.utils.book_append_sheet(wb,ws,name);
  };
  addSheet('Resumen',summary,[18,42,18,28,15,30,10,10,12,20,12,14,12,14]);
  addSheet('Participantes',participants,[18,40,28,16,38,14,28,24,14,12,16,22,22]);
  addSheet('Intentos',attempts,[18,40,38,14,10,10,10,14,16,22]);
  addSheet('Brechas',gaps,[18,40,30,20,12,12]);
  return wb;
}

async function downloadCommitteeTrainingResultsExcel(trainingId=null,button=null) {
  const id=trainingId || document.getElementById('committeeTrainingResultsModal')?.dataset.trainingId;
  const training=committeeTrainingRecords.find(x=>x.id===id);
  if (!training) return alert('No se encontró la capacitación.');
  const old=button?.textContent || '';
  if(button){button.disabled=true;button.textContent='Generando…';}
  try {
    const wb=await buildCommitteeTrainingWorkbook([id]);
    XLSX.writeFile(wb,`${safeDocumentFileName(training.codigo,'CAP_COMITE')}_Resultados.xlsx`);
  } catch(err) {console.error(err);alert(err?.message || 'No fue posible generar el Excel.');}
  finally{if(button){button.disabled=false;button.textContent=old;}}
}

async function downloadCommitteeTrainingConsolidatedExcel() {
  const button=document.getElementById('downloadCommitteeTrainingConsolidatedExcelButton');
  const old=button?.textContent || '';
  if(button){button.disabled=true;button.textContent='Generando…';}
  try {
    if (!committeeTrainingsLoaded) await loadCommitteeTrainingsModule(true);
    const wb=await buildCommitteeTrainingWorkbook();
    XLSX.writeFile(wb,`Reporte_Consolidado_Capacitaciones_Comite_SST_${new Date().toISOString().slice(0,10)}.xlsx`);
  } catch(err) {console.error(err);alert(err?.message || 'No fue posible generar el Excel consolidado.');}
  finally{if(button){button.disabled=false;button.textContent=old;}}
}

async function downloadCommitteeTrainingConsolidatedPdf() {
  const button=document.getElementById('downloadCommitteeTrainingConsolidatedPdfButton');
  const old=button?.textContent || '';
  if(button){button.disabled=true;button.textContent='Generando…';}
  try {
    if (!window.jspdf?.jsPDF) throw new Error('No se cargó el generador PDF.');
    if (!committeeTrainingsLoaded) await loadCommitteeTrainingsModule(true);
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
    let logo=null;try{logo=await imageToDataUrl('assets/logo-explo.jpg');}catch{}
    if(logo)doc.addImage(logo,'JPEG',12,8,30,17,undefined,'FAST');
    committeeTrainingPdfText(doc,'SIG - SSOMAC',148,13,10,true,'center');
    committeeTrainingPdfText(doc,'REPORTE CONSOLIDADO DE CAPACITACIONES DEL COMITÉ SST',148,21,13,true,'center');
    doc.setDrawColor(192,0,0);doc.setLineWidth(.8);doc.line(12,28,285,28);

    const rows=committeeTrainingRecords.map(t=>{
      const latest=committeeTrainingDocumentParticipantRows(t.id);
      const approved=latest.filter(x=>x.attempt.aprobado).length;
      const avg=latest.length?latest.reduce((s,x)=>s+Number(x.attempt.nota||0),0)/latest.length:0;
      return [t.codigo||'',t.titulo||'',committeeTrainingDocumentUnit(t),formatDatePE(t.fecha),committeeTrainingVideosFor(t.id).length,committeeTrainingQuestionRecords.filter(q=>q.capacitacion_id===t.id).length,latest.length,`${latest.length?Math.round(approved/latest.length*100):0}%`,avg.toFixed(1),t.estado||''];
    });

    doc.autoTable({
      startY:35,
      head:[['CÓDIGO','CAPACITACIÓN','UNIDAD','FECHA','VIDEOS','PREG.','PART.','APROB.','PROM.','ESTADO']],
      body:rows.length?rows:[['','','','','','','','','','']],
      styles:{fontSize:6.2,cellPadding:1.7,lineColor:[215,220,226],lineWidth:.15},
      headStyles:{fillColor:[70,70,70],textColor:[255,255,255],fontStyle:'bold'},
      columnStyles:{0:{cellWidth:27},1:{cellWidth:65},2:{cellWidth:40},3:{cellWidth:22},4:{cellWidth:16},5:{cellWidth:16},6:{cellWidth:16},7:{cellWidth:18},8:{cellWidth:18},9:{cellWidth:22}}
    });
    const pages=doc.getNumberOfPages();
    for(let i=1;i<=pages;i++){doc.setPage(i);committeeTrainingPdfText(doc,`Explo Drilling Perú S.R.L. · Sistema Integrado de Gestión · ${new Date().toLocaleDateString('es-PE')} · Página ${i} de ${pages}`,148,202,5,false,'center',[125,125,125]);}
    doc.save(`Reporte_Consolidado_Capacitaciones_Comite_SST_${new Date().toISOString().slice(0,10)}.pdf`);
  } catch(err) {console.error(err);alert(err?.message || 'No fue posible generar el reporte consolidado PDF.');}
  finally{if(button){button.disabled=false;button.textContent=old;}}
}

// ------------------------------------------------------------
// 16D.3 · EXAMEN PÚBLICO
// ------------------------------------------------------------
function resetPublicCommitteeTrainingExamViews() {
  clearInterval(publicCommitteeTrainingExamTimerInterval);
  publicCommitteeTrainingExamTimerInterval=null;
  publicCommitteeTrainingExamDeadline=null;
  publicCommitteeTrainingExamRun=null;
  document.getElementById('publicCommitteeTrainingExamView')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingResultView')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingReviewView')?.classList.add('hidden');
}

async function refreshPublicCommitteeTrainingExamState() {
  if (!publicCommitteeTrainingToken || !publicCommitteeTrainingDni) return null;

  const button=document.getElementById('publicCommitteeTrainingExamButton');
  const text=document.getElementById('publicCommitteeTrainingExamReadyText');
  if (button) {
    button.disabled=true;
    button.textContent='Consultando examen…';
    button.dataset.mode='';
  }

  const {data,error}=await client.rpc('obtener_estado_examen_capacitacion_comite',{
    p_token:publicCommitteeTrainingToken,
    p_dni:publicCommitteeTrainingDni
  });

  if (error || !data?.ok) {
    console.error(error,data);
    if (text) text.textContent=data?.error || error?.message || 'No fue posible consultar el examen.';
    if (button) button.textContent='Examen no disponible';
    return null;
  }

  publicCommitteeTrainingExamState=data;

  if (!data.contenido_completado) {
    if (button) { button.disabled=true; button.textContent='Completa los videos'; }
    return data;
  }

  if (!data.preguntas) {
    if (text) text.textContent='El contenido está completo, pero el evaluador todavía no ha configurado las preguntas del examen.';
    if (button) { button.disabled=true; button.textContent='Examen pendiente de configuración'; }
    return data;
  }

  if (data.aprobado && data.reintento_solo_desaprobado!==false) {
    if (text) text.textContent='Ya aprobaste esta capacitación. Puedes revisar nuevamente el resultado de tu último intento.';
    if (button) { button.disabled=false; button.textContent='Ver mi resultado'; button.dataset.mode='result'; }
    return data;
  }

  if (Number(data.intentos_disponibles || 0)<=0) {
    if (text) text.textContent='Alcanzaste el máximo de intentos. Puedes revisar el resultado de tu último intento.';
    if (button) { button.disabled=false; button.textContent='Ver último resultado'; button.dataset.mode='result'; }
    return data;
  }

  if (text) {
    text.textContent=data.intentos_realizados>0
      ? `Tienes ${data.intentos_disponibles} intento(s) disponible(s).`
      : `El examen tiene ${data.preguntas} pregunta(s). Tienes ${data.max_intentos} intento(s) disponible(s).`;
  }
  if (button) {
    button.disabled=false;
    button.textContent=data.intentos_realizados>0?(data.aprobado?'Realizar otro intento':'Reintentar examen'):'Iniciar examen';
    button.dataset.mode='start';
  }
  return data;
}

function renderPublicCommitteeTrainingExamQuestions(questions) {
  const container=document.getElementById('publicCommitteeTrainingExamQuestions');
  if (!container) return;

  container.innerHTML=(questions || []).map((q,index)=>`
    <article class="public-committee-training-exam-question" data-committee-training-exam-question="${q.id}">
      <div class="public-training-question-head">
        <span>Pregunta ${index+1}</span>
        <strong>${Number(q.peso || 0)} pts · ${escapeHtml(q.nivel_tema || 'General')}</strong>
      </div>
      <h3>${escapeHtml(q.enunciado || '')}</h3>
      ${q.imagen_url ? `<img src="${escapeHtml(q.imagen_url)}" alt="Imagen de la pregunta" class="public-training-question-image" />` : ''}
      ${renderPublicCommitteeTrainingExamAnswerControls(q)}
    </article>
  `).join('');
}

function renderPublicCommitteeTrainingExamAnswerControls(q) {
  if (q.tipo==='FREE_TEXT') {
    return '<textarea class="public-training-exam-free" rows="4" placeholder="Escribe tu respuesta"></textarea>';
  }
  const input=q.tipo==='MULTIPLE'?'checkbox':'radio';
  return `<div class="public-training-exam-options">${(q.opciones || []).map((o,index)=>`
    <label><input type="${input}" name="committee-training-exam-${q.id}" value="${o.id}" /><span>${String.fromCharCode(65+index)}) ${escapeHtml(o.texto || '')}</span></label>
  `).join('')}</div>`;
}

function collectPublicCommitteeTrainingExamAnswer(q) {
  const article=document.querySelector(`[data-committee-training-exam-question="${q.id}"]`);
  if (!article) return {pregunta_id:q.id,opcion_ids:[],texto:''};
  if (q.tipo==='FREE_TEXT') {
    return {
      pregunta_id:q.id,
      opcion_ids:[],
      texto:article.querySelector('.public-training-exam-free')?.value.trim() || ''
    };
  }
  return {
    pregunta_id:q.id,
    opcion_ids:[...article.querySelectorAll('input:checked')].map(x=>x.value),
    texto:''
  };
}

function startPublicCommitteeTrainingExamTimer(minutes) {
  clearInterval(publicCommitteeTrainingExamTimerInterval);
  const box=document.getElementById('publicCommitteeTrainingExamTimerBox');
  const text=document.getElementById('publicCommitteeTrainingExamTimer');

  if (!minutes) {
    box?.classList.add('hidden');
    if (text) text.textContent='Sin límite';
    return;
  }

  box?.classList.remove('hidden');
  publicCommitteeTrainingExamDeadline=Date.now()+Number(minutes)*60000;

  const tick=()=>{
    const remaining=Math.max(0,publicCommitteeTrainingExamDeadline-Date.now());
    const min=Math.floor(remaining/60000);
    const sec=Math.floor((remaining%60000)/1000);
    if (text) text.textContent=`${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    if (remaining<=0) {
      clearInterval(publicCommitteeTrainingExamTimerInterval);
      publicCommitteeTrainingExamTimerInterval=null;
      submitPublicCommitteeTrainingExam(true);
    }
  };
  tick();
  publicCommitteeTrainingExamTimerInterval=setInterval(tick,1000);
}

async function startPublicCommitteeTrainingExam() {
  if (!publicCommitteeTrainingToken || !publicCommitteeTrainingDni) return;

  clearPublicCommitteeTrainingPlayer();
  const button=document.getElementById('publicCommitteeTrainingExamButton');
  const old=button?.textContent || '';
  if (button) { button.disabled=true; button.textContent='Preparando examen…'; }

  const {data,error}=await client.rpc('iniciar_examen_capacitacion_comite',{
    p_token:publicCommitteeTrainingToken,
    p_dni:publicCommitteeTrainingDni
  });

  if (button) { button.disabled=false; button.textContent=old; }

  if (error || !data?.ok) {
    alert(data?.error || error?.message || 'No fue posible iniciar el examen.');
    await refreshPublicCommitteeTrainingExamState();
    return;
  }

  publicCommitteeTrainingExamRun=data;
  publicCommitteeTrainingLastExamAttemptId=data.intento_id;
  document.getElementById('publicCommitteeTrainingContent')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingResultView')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingReviewView')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingExamView')?.classList.remove('hidden');
  document.getElementById('publicCommitteeTrainingExamTitle').textContent=data.titulo || 'Examen de capacitación';
  document.getElementById('publicCommitteeTrainingExamParticipant').textContent=data.participante || '—';
  document.getElementById('publicCommitteeTrainingExamAttempt').textContent=`${data.numero_intento} de ${data.max_intentos}`;
  document.getElementById('publicCommitteeTrainingExamPassingGrade').textContent=String(Number(data.nota_minima || 0));
  document.getElementById('publicCommitteeTrainingExamSubmitMessage').textContent='';
  document.getElementById('publicCommitteeTrainingExamSubmitMessage').className='form-message';
  renderPublicCommitteeTrainingExamQuestions(data.preguntas || []);
  startPublicCommitteeTrainingExamTimer(data.tiempo_max_min);
  window.scrollTo({top:0,behavior:'smooth'});
}

async function submitPublicCommitteeTrainingExam(auto=false) {
  if (!publicCommitteeTrainingExamRun) return;
  const msg=document.getElementById('publicCommitteeTrainingExamSubmitMessage');
  const button=document.getElementById('publicCommitteeTrainingExamSubmitButton');

  const answers=(publicCommitteeTrainingExamRun.preguntas || [])
    .map(collectPublicCommitteeTrainingExamAnswer);

  if (!auto) {
    const answered=answers.filter(a=>a.texto || (a.opcion_ids || []).length).length;
    if (answered<answers.length) {
      const proceed=confirm(`Has respondido ${answered} de ${answers.length} preguntas. ¿Deseas finalizar de todas formas?`);
      if (!proceed) return;
    }
  }

  const old=button?.textContent || '';
  if (button) { button.disabled=true; button.textContent='Calificando…'; }

  const {data,error}=await client.rpc('finalizar_examen_capacitacion_comite',{
    p_token:publicCommitteeTrainingToken,
    p_dni:publicCommitteeTrainingDni,
    p_intento_id:publicCommitteeTrainingExamRun.intento_id,
    p_respuestas:answers
  });

  if (button) { button.disabled=false; button.textContent=old; }

  if (error || !data?.ok) {
    if (msg) {
      msg.textContent=data?.error || error?.message || 'No fue posible finalizar el examen.';
      msg.className='form-message visible error';
    }
    return;
  }

  clearInterval(publicCommitteeTrainingExamTimerInterval);
  publicCommitteeTrainingExamTimerInterval=null;
  publicCommitteeTrainingLastExamResult=data;
  publicCommitteeTrainingLastExamAttemptId=data.intento_id;
  publicCommitteeTrainingExamRun=null;
  showPublicCommitteeTrainingExamResult(data);
  try {
    await fetchPublicCommitteeTrainingData();
    await refreshPublicCommitteeTrainingExamState();
  } catch(err) {
    console.warn(err);
  }
}

function showPublicCommitteeTrainingExamResult(data) {
  document.getElementById('publicCommitteeTrainingContent')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingExamView')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingReviewView')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingResultView')?.classList.remove('hidden');

  const approved=!!data.aprobado;
  const icon=document.getElementById('publicCommitteeTrainingResultIcon');
  icon.textContent=approved?'✓':'!';
  icon.classList.toggle('fail',!approved);
  document.getElementById('publicCommitteeTrainingResultTitle').textContent=approved?'APROBADO':'DESAPROBADO';
  document.getElementById('publicCommitteeTrainingResultGrade').innerHTML=`${Number(data.nota || 0).toFixed(1)} <small>/ 20</small>`;
  document.getElementById('publicCommitteeTrainingResultCorrect').textContent=`${data.correctas || 0} de ${data.total || 0} respuestas correctas · Intento ${data.numero_intento || '—'}`;

  const topics=data.temas_reforzar || [];
  const reinforce=document.getElementById('publicCommitteeTrainingReinforceCard');
  reinforce?.classList.toggle('hidden',!topics.length);
  document.getElementById('publicCommitteeTrainingReinforceList').innerHTML=topics.length
    ? topics.map(x=>`<div>⚠ ${escapeHtml(x.tema)} <small>${x.errores} error(es)</small></div>`).join('')
    : '<div>✓ No tienes temas pendientes de reforzar.</div>';

  const retry=document.getElementById('publicCommitteeTrainingRetryButton');
  retry?.classList.toggle('hidden',approved || Number(data.intentos_restantes || 0)<=0);
  if (retry && !approved && Number(data.intentos_restantes || 0)>0) {
    retry.textContent=`Realizar otro intento (${data.intentos_restantes} disponible${Number(data.intentos_restantes)===1?'':'s'})`;
  }
  window.scrollTo({top:0,behavior:'smooth'});
}

async function openExistingPublicCommitteeTrainingResult() {
  const attemptId=publicCommitteeTrainingExamState?.ultimo_resultado?.intento_id;
  if (!attemptId) {
    alert('No se encontró un resultado anterior.');
    return;
  }

  const {data,error}=await client.rpc('revisar_examen_capacitacion_comite',{
    p_token:publicCommitteeTrainingToken,
    p_dni:publicCommitteeTrainingDni,
    p_intento_id:attemptId
  });

  if (error || !data?.ok) {
    alert(data?.error || error?.message || 'No fue posible recuperar el resultado.');
    return;
  }

  publicCommitteeTrainingLastExamAttemptId=attemptId;
  publicCommitteeTrainingLastExamResult={
    ...data.intento,
    temas_reforzar:data.temas_reforzar || [],
    temas_dominados:data.temas_dominados || [],
    intentos_restantes:publicCommitteeTrainingExamState?.intentos_disponibles || 0
  };
  showPublicCommitteeTrainingExamResult(publicCommitteeTrainingLastExamResult);
}

async function reviewPublicCommitteeTrainingExam() {
  if (!publicCommitteeTrainingLastExamAttemptId) return;

  const {data,error}=await client.rpc('revisar_examen_capacitacion_comite',{
    p_token:publicCommitteeTrainingToken,
    p_dni:publicCommitteeTrainingDni,
    p_intento_id:publicCommitteeTrainingLastExamAttemptId
  });

  if (error || !data?.ok) {
    alert(data?.error || error?.message || 'No fue posible cargar la revisión.');
    return;
  }

  document.getElementById('publicCommitteeTrainingResultView')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingReviewView')?.classList.remove('hidden');

  document.getElementById('publicCommitteeTrainingReviewQuestions').innerHTML=(data.preguntas || []).map((q,index)=>{
    const selected=q.tipo==='FREE_TEXT'
      ? (q.respuesta_texto || 'Sin respuesta')
      : ((q.respuesta_seleccionada || []).join(' / ') || 'Sin respuesta');
    const correct=(q.respuestas_correctas || []).join(' / ');
    return `
      <article class="public-training-review-question ${q.es_correcta?'correct':'wrong'}">
        <h3>${index+1}. ${escapeHtml(q.enunciado || '')}</h3>
        ${q.imagen_url ? `<img src="${escapeHtml(q.imagen_url)}" alt="Imagen de la pregunta" />` : ''}
        <p><b>Tu respuesta:</b> ${escapeHtml(selected)}</p>
        ${correct ? `<p><b>Respuesta correcta:</b> ${escapeHtml(correct)}</p>` : ''}
        ${q.explicacion ? `<p class="public-training-review-explanation">${escapeHtml(q.explicacion)}</p>` : ''}
        <small>Tema: ${escapeHtml(q.nivel_tema || 'General')}</small>
      </article>
    `;
  }).join('');

  document.getElementById('publicCommitteeTrainingMasteredList').innerHTML=(data.temas_dominados || []).length
    ? data.temas_dominados.map(x=>`<div>✓ ${escapeHtml(x)}</div>`).join('')
    : '<div>—</div>';
  document.getElementById('publicCommitteeTrainingReviewReinforceList').innerHTML=(data.temas_reforzar || []).length
    ? data.temas_reforzar.map(x=>`<div>⚠ ${escapeHtml(x.tema)}</div>`).join('')
    : '<div>✓ Sin temas pendientes</div>';
  window.scrollTo({top:0,behavior:'smooth'});
}


// ------------------------------------------------------------
// ETAPA 16D.2 · LINK PÚBLICO + FIRMA + PROGRESO DE VIDEOS
// ------------------------------------------------------------
function publicCommitteeTrainingMessage(message='',type='error',target='publicCommitteeTrainingIdentityMessage') {
  const el=document.getElementById(target);
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

function initializePublicCommitteeTrainingMode(token) {
  publicCommitteeTrainingToken=String(token || '').trim();
  publicCommitteeTrainingDni='';
  publicCommitteeTrainingData=null;
  publicCommitteeTrainingCurrentVideoId=null;
  publicCommitteeTrainingExamState=null;
  publicCommitteeTrainingLastExamResult=null;
  publicCommitteeTrainingLastExamAttemptId=null;
  resetPublicCommitteeTrainingExamViews();
  clearPublicCommitteeTrainingPlayer();

  publicExamScreen?.classList.add('hidden');
  publicPracticeScreen?.classList.add('hidden');
  publicEvaluationScreen?.classList.add('hidden');
  publicMeetingSignatureScreen?.classList.add('hidden');
  appShell?.classList.add('hidden');
  authScreen?.classList.add('hidden');
  authLoading?.classList.add('hidden');
  publicCommitteeTrainingScreen?.classList.remove('hidden');

  document.getElementById('publicCommitteeTrainingIdentity')?.classList.remove('hidden');
  document.getElementById('publicCommitteeTrainingSignature')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingContent')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingExamView')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingResultView')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingReviewView')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingHeaderTitle').textContent='Capacitación del Comité SST';
  document.getElementById('publicCommitteeTrainingHeaderCode').textContent='Identificación requerida';
  document.getElementById('publicCommitteeTrainingDni').value='';
  const examButton=document.getElementById('publicCommitteeTrainingExamButton');
  if (examButton) { examButton.dataset.mode=''; examButton.disabled=true; examButton.textContent='Examen'; }
  publicCommitteeTrainingMessage('');
  setTimeout(()=>document.getElementById('publicCommitteeTrainingDni')?.focus(),60);
}

async function fetchPublicCommitteeTrainingData() {
  const {data,error}=await client.rpc('obtener_capacitacion_comite_publica',{
    p_token:publicCommitteeTrainingToken,
    p_dni:publicCommitteeTrainingDni
  });

  if (error || !data?.ok) {
    throw new Error(data?.error || error?.message || 'No fue posible cargar la capacitación.');
  }

  publicCommitteeTrainingData=data;
  return data;
}

async function lookupPublicCommitteeTraining() {
  const input=document.getElementById('publicCommitteeTrainingDni');
  const dni=(input?.value || '').replace(/\D/g,'').slice(0,8);
  if (input) input.value=dni;
  publicCommitteeTrainingMessage('');

  if (!/^\d{8}$/.test(dni)) {
    publicCommitteeTrainingMessage('Ingresa un DNI válido de 8 dígitos.');
    return;
  }

  const button=document.getElementById('publicCommitteeTrainingLookupButton');
  const old=button?.textContent || '';
  if (button) {
    button.disabled=true;
    button.textContent='Verificando…';
  }

  publicCommitteeTrainingDni=dni;

  try {
    const data=await fetchPublicCommitteeTrainingData();
    const cap=data.capacitacion || {};
    const member=data.integrante || {};
    const committee=data.comite || {};

    document.getElementById('publicCommitteeTrainingHeaderTitle').textContent=cap.titulo || 'Capacitación';
    document.getElementById('publicCommitteeTrainingHeaderCode').textContent=cap.codigo || 'Capacitación del Comité SST';
    document.getElementById('publicCommitteeTrainingParticipantName').textContent=
      [member.apellidos,member.nombres].filter(Boolean).join(' ') || 'Integrante';
    document.getElementById('publicCommitteeTrainingParticipantMeta').textContent=
      `DNI ${member.dni || '—'} · ${member.cargo || '—'} · ${member.area || '—'}`;
    document.getElementById('publicCommitteeTrainingCommitteeMeta').textContent=
      `${committee.tipo==='SUBCOMITE'?'Subcomité SST':'Comité SST'} · ${committee.nombre || committee.codigo || '—'} · ${member.cargo_comite || 'Integrante'}`;

    document.getElementById('publicCommitteeTrainingIdentity')?.classList.add('hidden');

    if (data.participacion?.firmado) {
      showPublicCommitteeTrainingContent();
    } else {
      document.getElementById('publicCommitteeTrainingSignature')?.classList.remove('hidden');
      document.getElementById('publicCommitteeTrainingContent')?.classList.add('hidden');
      document.getElementById('publicCommitteeTrainingConsent').checked=false;
      setupPublicCommitteeTrainingSignatureCanvas();
      window.scrollTo({top:0,behavior:'smooth'});
    }
  } catch(err) {
    console.error(err);
    publicCommitteeTrainingMessage(err?.message || 'No fue posible validar tu participación.');
  } finally {
    if (button) {
      button.disabled=false;
      button.textContent=old;
    }
  }
}

function setupPublicCommitteeTrainingSignatureCanvas() {
  const canvas=document.getElementById('publicCommitteeTrainingSignatureCanvas');
  if (!canvas) return;

  const ctx=canvas.getContext('2d');
  publicCommitteeTrainingSignatureCtx=ctx;
  publicCommitteeTrainingSignatureDrawing=false;

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.lineWidth=4;
  ctx.lineCap='round';
  ctx.lineJoin='round';
  ctx.strokeStyle='#17263c';

  const point=(event)=>{
    const rect=canvas.getBoundingClientRect();
    const source=event.touches?.[0] || event;
    return {
      x:(source.clientX-rect.left)*(canvas.width/rect.width),
      y:(source.clientY-rect.top)*(canvas.height/rect.height)
    };
  };

  canvas.onpointerdown=(event)=>{
    publicCommitteeTrainingSignatureDrawing=true;
    const p=point(event);
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
    canvas.setPointerCapture?.(event.pointerId);
  };

  canvas.onpointermove=(event)=>{
    if (!publicCommitteeTrainingSignatureDrawing) return;
    const p=point(event);
    ctx.lineTo(p.x,p.y);
    ctx.stroke();
  };

  canvas.onpointerup=()=>{publicCommitteeTrainingSignatureDrawing=false;};
  canvas.onpointercancel=()=>{publicCommitteeTrainingSignatureDrawing=false;};
  canvas.onpointerleave=()=>{publicCommitteeTrainingSignatureDrawing=false;};
}

function publicCommitteeTrainingSignatureBlank() {
  const canvas=document.getElementById('publicCommitteeTrainingSignatureCanvas');
  if (!canvas) return true;
  const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  for (let i=3;i<pixels.length;i+=4) {
    if (pixels[i]!==0) return false;
  }
  return true;
}

async function savePublicCommitteeTrainingSignature() {
  publicCommitteeTrainingMessage('','error','publicCommitteeTrainingSignatureMessage');

  const consent=document.getElementById('publicCommitteeTrainingConsent')?.checked;
  if (!consent) {
    publicCommitteeTrainingMessage(
      'Marca la casilla de conformidad antes de registrar tu firma.',
      'error',
      'publicCommitteeTrainingSignatureMessage'
    );
    return;
  }

  if (publicCommitteeTrainingSignatureBlank()) {
    publicCommitteeTrainingMessage(
      'Registra tu firma dentro del recuadro.',
      'error',
      'publicCommitteeTrainingSignatureMessage'
    );
    return;
  }

  const canvas=document.getElementById('publicCommitteeTrainingSignatureCanvas');
  const firma=canvas.toDataURL('image/png');
  const consentText=document.getElementById('publicCommitteeTrainingConsentText')?.textContent?.trim() || '';
  const button=document.getElementById('savePublicCommitteeTrainingSignatureButton');
  const old=button?.textContent || '';

  if (button) {
    button.disabled=true;
    button.textContent='Registrando…';
  }

  const {data,error}=await client.rpc('registrar_firma_capacitacion_comite',{
    p_token:publicCommitteeTrainingToken,
    p_dni:publicCommitteeTrainingDni,
    p_firma:firma,
    p_consentimiento:true,
    p_consentimiento_texto:consentText,
    p_user_agent:navigator.userAgent || ''
  });

  if (button) {
    button.disabled=false;
    button.textContent=old;
  }

  if (error || !data?.ok) {
    console.error(error,data);
    publicCommitteeTrainingMessage(
      data?.error || error?.message || 'No fue posible registrar tu firma.',
      'error',
      'publicCommitteeTrainingSignatureMessage'
    );
    return;
  }

  try {
    await fetchPublicCommitteeTrainingData();
    document.getElementById('publicCommitteeTrainingSignature')?.classList.add('hidden');
    showPublicCommitteeTrainingContent();
  } catch(err) {
    publicCommitteeTrainingMessage(
      err?.message || 'La firma fue registrada, pero no fue posible cargar el contenido.',
      'error',
      'publicCommitteeTrainingSignatureMessage'
    );
  }
}

function publicCommitteeTrainingVideoLocked(video) {
  const videos=publicCommitteeTrainingData?.videos || [];
  return videos.some(prev=>
    Number(prev.orden)<Number(video.orden) &&
    prev.obligatorio &&
    !prev.completado
  );
}

function publicCommitteeTrainingProgressSummary() {
  const videos=publicCommitteeTrainingData?.videos || [];
  const required=videos.filter(v=>v.obligatorio);
  const base=required.length ? required : videos;
  const completed=base.filter(v=>v.completado).length;
  const percent=base.length ? Math.round((completed/base.length)*100) : 100;
  return {total:base.length,completed,percent};
}

function renderPublicCommitteeTrainingSummary() {
  const data=publicCommitteeTrainingData;
  if (!data) return;

  const summary=publicCommitteeTrainingProgressSummary();
  document.getElementById('publicCommitteeTrainingProgressText').textContent=`${summary.completed} / ${summary.total}`;
  document.getElementById('publicCommitteeTrainingProgressPercent').textContent=`${summary.percent}%`;
  document.getElementById('publicCommitteeTrainingMinGrade').textContent=String(data.capacitacion?.nota_minima ?? '—');
  const bar=document.getElementById('publicCommitteeTrainingOverallProgressBar');
  if (bar) bar.style.width=`${summary.percent}%`;

  const contentDone=summary.total===0 || summary.completed>=summary.total;
  document.getElementById('publicCommitteeTrainingExamLocked')?.classList.toggle('hidden',contentDone);
  document.getElementById('publicCommitteeTrainingExamReady')?.classList.toggle('hidden',!contentDone);

  if (!contentDone) {
    document.getElementById('publicCommitteeTrainingExamMessage').textContent=
      `Completa ${summary.total-summary.completed} contenido(s) obligatorio(s) para habilitar el examen.`;
  }
}

function renderPublicCommitteeTrainingVideoList() {
  const container=document.getElementById('publicCommitteeTrainingVideoList');
  if (!container || !publicCommitteeTrainingData) return;

  const videos=publicCommitteeTrainingData.videos || [];
  if (!videos.length) {
    container.innerHTML='<div class="training-library-empty">Esta capacitación todavía no tiene videos disponibles.</div>';
    return;
  }

  container.innerHTML=videos.map(video=>{
    const locked=publicCommitteeTrainingVideoLocked(video);
    const active=publicCommitteeTrainingCurrentVideoId===video.id;
    const completed=!!video.completado;
    const percent=Math.round(Number(video.porcentaje || 0));

    return `
      <button
        type="button"
        class="public-training-video-item ${locked?'locked':''} ${completed?'completed':''} ${active?'active':''}"
        data-public-training-video="${video.id}"
        ${locked?'disabled':''}
      >
        <span class="public-training-video-order">${completed?'✓':locked?'🔒':video.orden}</span>
        <span class="public-training-video-info">
          <strong>${escapeHtml(video.titulo || `Video ${video.orden}`)}</strong>
          <small>${escapeHtml(committeeTrainingSourceLabel(video.tipo_fuente))}${video.duracion_minutos ? ` · ${Number(video.duracion_minutos)} min` : ''}${video.obligatorio ? ' · Obligatorio' : ' · Opcional'}</small>
        </span>
        <span class="public-training-video-percent">${completed?'100%':`${percent}%`}</span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('[data-public-training-video]').forEach(button=>{
    button.addEventListener('click',()=>loadPublicCommitteeTrainingVideo(button.dataset.publicTrainingVideo));
  });
}

function choosePublicCommitteeTrainingVideo() {
  const videos=publicCommitteeTrainingData?.videos || [];
  if (!videos.length) return null;

  const current=videos.find(v=>v.id===publicCommitteeTrainingCurrentVideoId);
  if (current && !publicCommitteeTrainingVideoLocked(current)) return current;

  return videos.find(v=>!v.completado && !publicCommitteeTrainingVideoLocked(v))
    || videos.find(v=>!publicCommitteeTrainingVideoLocked(v))
    || null;
}

function showPublicCommitteeTrainingContent() {
  if (!publicCommitteeTrainingData) return;

  const cap=publicCommitteeTrainingData.capacitacion || {};
  const member=publicCommitteeTrainingData.integrante || {};

  document.getElementById('publicCommitteeTrainingIdentity')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingSignature')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingExamView')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingResultView')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingReviewView')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingContent')?.classList.remove('hidden');
  document.getElementById('publicCommitteeTrainingContentTitle').textContent=cap.titulo || 'Contenido de la capacitación';
  document.getElementById('publicCommitteeTrainingContentSubtitle').textContent=
    `${[member.apellidos,member.nombres].filter(Boolean).join(' ')} · Completa los videos obligatorios en el orden establecido.`;

  renderPublicCommitteeTrainingSummary();
  renderPublicCommitteeTrainingVideoList();

  const selected=choosePublicCommitteeTrainingVideo();
  if (selected) loadPublicCommitteeTrainingVideo(selected.id);
  else document.getElementById('publicCommitteeTrainingPlayerCard')?.classList.add('hidden');

  refreshPublicCommitteeTrainingExamState().catch(err=>console.warn('No se pudo consultar el examen.',err));
  window.scrollTo({top:0,behavior:'smooth'});
}

function clearPublicCommitteeTrainingPlayer() {
  if (publicCommitteeTrainingYoutubeTimer) {
    clearInterval(publicCommitteeTrainingYoutubeTimer);
    publicCommitteeTrainingYoutubeTimer=null;
  }
  if (publicCommitteeTrainingExternalTimer) {
    clearInterval(publicCommitteeTrainingExternalTimer);
    publicCommitteeTrainingExternalTimer=null;
  }
  publicCommitteeTrainingExternalStartedAt=null;

  if (publicCommitteeTrainingYoutubePlayer?.destroy) {
    try { publicCommitteeTrainingYoutubePlayer.destroy(); } catch {}
  }
  publicCommitteeTrainingYoutubePlayer=null;

  if (publicCommitteeTrainingHtml5Player) {
    try { publicCommitteeTrainingHtml5Player.pause(); } catch {}
  }
  publicCommitteeTrainingHtml5Player=null;

  const host=document.getElementById('publicCommitteeTrainingPlayerHost');
  if (host) host.innerHTML='';
}

function updatePublicCommitteeTrainingVideoProgressUi(percent) {
  const clean=Math.max(0,Math.min(100,Number(percent || 0)));
  const bar=document.getElementById('publicCommitteeTrainingVideoProgressBar');
  const text=document.getElementById('publicCommitteeTrainingVideoProgressText');
  if (bar) bar.style.width=`${clean}%`;
  if (text) text.textContent=`${Math.round(clean)}%`;
}

async function savePublicCommitteeTrainingProgress(video,current,duration,completed=false,force=false) {
  if (!video || !publicCommitteeTrainingData) return null;

  const now=Date.now();
  if (!force && !completed && now-publicCommitteeTrainingLastSaveAt<9000) return null;
  if (publicCommitteeTrainingCompletionBusy && completed) return null;

  const safeCurrent=Math.max(0,Number(current || 0));
  const safeDuration=Math.max(0,Number(duration || 0));
  publicCommitteeTrainingCurrentMaxSecond=Math.max(publicCommitteeTrainingCurrentMaxSecond,safeCurrent);
  const percentage=safeDuration>0
    ? Math.min(100,(publicCommitteeTrainingCurrentMaxSecond/safeDuration)*100)
    : Math.max(Number(video.porcentaje || 0),completed?100:0);

  if (completed) publicCommitteeTrainingCompletionBusy=true;
  publicCommitteeTrainingLastSaveAt=now;

  const {data,error}=await client.rpc('actualizar_progreso_video_comite',{
    p_token:publicCommitteeTrainingToken,
    p_dni:publicCommitteeTrainingDni,
    p_video_id:video.id,
    p_ultimo_segundo:safeCurrent,
    p_max_segundo:publicCommitteeTrainingCurrentMaxSecond,
    p_porcentaje:completed ? 100 : Math.min(100,percentage),
    p_completado:!!completed
  });

  if (completed) publicCommitteeTrainingCompletionBusy=false;

  if (error || !data?.ok) {
    console.error(error,data);
    if (data?.locked) {
      publicCommitteeTrainingMessage(
        data.error || 'Completa primero el video anterior.',
        'error',
        'publicCommitteeTrainingPlayerMessage'
      );
    }
    return null;
  }

  video.ultimo_segundo=Number(data.ultimo_segundo || safeCurrent);
  video.max_segundo=Number(data.max_segundo || publicCommitteeTrainingCurrentMaxSecond);
  video.porcentaje=Number(data.porcentaje || percentage);
  video.completado=!!data.completado;
  video.completado_at=data.completado_at || video.completado_at;

  updatePublicCommitteeTrainingVideoProgressUi(video.completado ? 100 : video.porcentaje);

  if (video.completado) {
    const status=document.getElementById('publicCommitteeTrainingCurrentVideoStatus');
    if (status) {
      status.textContent='COMPLETADO';
      status.className='public-video-status completed';
    }
    document.getElementById('publicCommitteeTrainingSeekNotice')?.classList.add('hidden');

    // Refresca los datos para que el servidor entregue la URL del siguiente video recién desbloqueado.
    try {
      await fetchPublicCommitteeTrainingData();
      await refreshPublicCommitteeTrainingExamState();
    } catch(err) {
      console.warn('No fue posible refrescar la ruta de aprendizaje.',err);
    }
  }

  renderPublicCommitteeTrainingVideoList();
  renderPublicCommitteeTrainingSummary();

  if (video.completado) {
    const next=(publicCommitteeTrainingData?.videos || [])
      .find(v=>!v.completado && !publicCommitteeTrainingVideoLocked(v));
    if (next && next.id!==video.id) {
      setTimeout(()=>loadPublicCommitteeTrainingVideo(next.id),900);
    }
  }

  return data;
}

function loadYouTubeIframeApiForTraining() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    const previous=window.onYouTubeIframeAPIReady;
    let done=false;

    const finish=()=>{
      if (done) return;
      done=true;
      try { if (typeof previous==='function') previous(); } catch {}
      resolve(window.YT);
    };

    window.onYouTubeIframeAPIReady=finish;

    if (!existing) {
      const script=document.createElement('script');
      script.src='https://www.youtube.com/iframe_api';
      script.async=true;
      script.onerror=()=>reject(new Error('No fue posible cargar el reproductor de YouTube.'));
      document.head.appendChild(script);
    }

    const started=Date.now();
    const timer=setInterval(()=>{
      if (window.YT?.Player) {
        clearInterval(timer);
        finish();
      } else if (Date.now()-started>15000) {
        clearInterval(timer);
        reject(new Error('YouTube tardó demasiado en responder.'));
      }
    },200);
  });

  return youtubeApiPromise;
}

async function setupPublicCommitteeTrainingYoutube(video) {
  const youtube=normalizeYoutubeUrl(video.url);
  if (!youtube) throw new Error('El enlace de YouTube no es válido.');
  await loadYouTubeIframeApiForTraining();

  const host=document.getElementById('publicCommitteeTrainingPlayerHost');
  host.innerHTML='<div id="publicCommitteeTrainingYoutubePlayer"></div>';
  publicCommitteeTrainingCurrentMaxSecond=Math.max(Number(video.max_segundo || 0),Number(video.ultimo_segundo || 0));

  publicCommitteeTrainingYoutubePlayer=new YT.Player('publicCommitteeTrainingYoutubePlayer',{
    videoId:youtube.id,
    width:'100%',
    height:'100%',
    playerVars:{
      controls:1,
      rel:0,
      modestbranding:1,
      playsinline:1
    },
    events:{
      onReady:(event)=>{
        const duration=Number(event.target.getDuration() || 0);
        const resume=Math.min(Number(video.ultimo_segundo || 0),Math.max(0,duration-1));
        if (resume>1) event.target.seekTo(resume,true);
        updatePublicCommitteeTrainingVideoProgressUi(video.completado?100:Number(video.porcentaje || 0));

        publicCommitteeTrainingYoutubeTimer=setInterval(()=>{
          const player=publicCommitteeTrainingYoutubePlayer;
          if (!player?.getCurrentTime) return;
          const current=Number(player.getCurrentTime() || 0);
          const total=Number(player.getDuration() || duration || 0);
          const state=player.getPlayerState?.();

          if (!video.completado) {
            if (current>publicCommitteeTrainingCurrentMaxSecond+2.5) {
              player.seekTo(Math.max(0,publicCommitteeTrainingCurrentMaxSecond),true);
              return;
            }
            if (state===YT.PlayerState.PLAYING && current<=publicCommitteeTrainingCurrentMaxSecond+2.5) {
              publicCommitteeTrainingCurrentMaxSecond=Math.max(publicCommitteeTrainingCurrentMaxSecond,current);
            }
          }

          const percent=video.completado ? 100 : (total>0 ? (publicCommitteeTrainingCurrentMaxSecond/total)*100 : 0);
          updatePublicCommitteeTrainingVideoProgressUi(percent);

          if (!video.completado && total>0 && percent>=98) {
            savePublicCommitteeTrainingProgress(video,current,total,true,true);
          } else if (state===YT.PlayerState.PLAYING) {
            savePublicCommitteeTrainingProgress(video,current,total,false,false);
          }
        },1000);
      },
      onStateChange:(event)=>{
        const player=event.target;
        const current=Number(player.getCurrentTime?.() || 0);
        const duration=Number(player.getDuration?.() || 0);
        if (event.data===YT.PlayerState.ENDED) {
          publicCommitteeTrainingCurrentMaxSecond=Math.max(publicCommitteeTrainingCurrentMaxSecond,duration,current);
          savePublicCommitteeTrainingProgress(video,duration || current,duration || current,true,true);
        } else if (event.data===YT.PlayerState.PAUSED) {
          savePublicCommitteeTrainingProgress(video,current,duration,false,true);
        }
      },
      onError:()=>{
        publicCommitteeTrainingMessage(
          'YouTube no pudo reproducir este video. Revisa el enlace o intenta nuevamente.',
          'error',
          'publicCommitteeTrainingPlayerMessage'
        );
      }
    }
  });
}

function setupPublicCommitteeTrainingHtml5(video,sourceUrl) {
  const host=document.getElementById('publicCommitteeTrainingPlayerHost');
  host.innerHTML='';

  const media=document.createElement('video');
  media.className='public-training-html5-video';
  media.controls=true;
  media.playsInline=true;
  media.preload='metadata';
  media.src=sourceUrl;
  host.appendChild(media);
  publicCommitteeTrainingHtml5Player=media;
  publicCommitteeTrainingCurrentMaxSecond=Math.max(Number(video.max_segundo || 0),Number(video.ultimo_segundo || 0));

  let restoring=false;

  media.addEventListener('loadedmetadata',()=>{
    const duration=Number(media.duration || 0);
    const resume=Math.min(Number(video.ultimo_segundo || 0),Math.max(0,duration-1));
    if (resume>1) {
      restoring=true;
      media.currentTime=resume;
      setTimeout(()=>{restoring=false;},250);
    }
    updatePublicCommitteeTrainingVideoProgressUi(video.completado?100:Number(video.porcentaje || 0));
  });

  media.addEventListener('seeking',()=>{
    if (video.completado || restoring) return;
    if (media.currentTime>publicCommitteeTrainingCurrentMaxSecond+2.5) {
      restoring=true;
      media.currentTime=Math.max(0,publicCommitteeTrainingCurrentMaxSecond);
      setTimeout(()=>{restoring=false;},200);
    }
  });

  media.addEventListener('timeupdate',()=>{
    const current=Number(media.currentTime || 0);
    const duration=Number(media.duration || 0);

    if (!video.completado && !media.seeking && current<=publicCommitteeTrainingCurrentMaxSecond+2.5) {
      publicCommitteeTrainingCurrentMaxSecond=Math.max(publicCommitteeTrainingCurrentMaxSecond,current);
    }

    const percent=video.completado ? 100 : (duration>0 ? (publicCommitteeTrainingCurrentMaxSecond/duration)*100 : 0);
    updatePublicCommitteeTrainingVideoProgressUi(percent);

    if (!video.completado && duration>0 && percent>=98) {
      savePublicCommitteeTrainingProgress(video,current,duration,true,true);
    } else if (!media.paused) {
      savePublicCommitteeTrainingProgress(video,current,duration,false,false);
    }
  });

  media.addEventListener('pause',()=>{
    if (!media.ended) savePublicCommitteeTrainingProgress(video,media.currentTime,media.duration,false,true);
  });

  media.addEventListener('ended',()=>{
    const duration=Number(media.duration || media.currentTime || 0);
    publicCommitteeTrainingCurrentMaxSecond=Math.max(publicCommitteeTrainingCurrentMaxSecond,duration);
    savePublicCommitteeTrainingProgress(video,duration,duration,true,true);
  });

  media.addEventListener('error',()=>{
    publicCommitteeTrainingMessage(
      'No fue posible reproducir el video. Verifica tu conexión o el archivo.',
      'error',
      'publicCommitteeTrainingPlayerMessage'
    );
  });
}

async function setupPublicCommitteeTrainingUploadedMp4(video) {
  const {data,error}=await client.functions.invoke('committee-training-video',{
    body:{
      token:publicCommitteeTrainingToken,
      dni:publicCommitteeTrainingDni,
      video_id:video.id
    }
  });

  if (error || !data?.ok || !data?.signed_url) {
    console.error(error,data);
    throw new Error(
      data?.error || error?.message ||
      'No fue posible abrir el MP4. Verifica que la Edge Function committee-training-video esté desplegada.'
    );
  }

  setupPublicCommitteeTrainingHtml5(video,data.signed_url);
}

function setupPublicCommitteeTrainingExternal(video) {
  const url=validHttpUrl(video.url);
  if (!url) throw new Error('El enlace externo no es válido.');

  if (/\.mp4(?:$|\?)/i.test(url)) {
    setupPublicCommitteeTrainingHtml5(video,url);
    return;
  }

  const host=document.getElementById('publicCommitteeTrainingPlayerHost');
  const requiredSeconds=Math.max(60,Math.round(Number(video.duracion_minutos || 1)*60));
  host.innerHTML=`
    <div class="public-training-external-card">
      <span class="public-training-external-icon">↗</span>
      <strong>Contenido alojado en un sitio externo</strong>
      <p>El control exacto de reproducción no es técnicamente posible fuera de la plataforma. Para mantener un control mínimo, primero abre el contenido y permanece el tiempo estimado antes de confirmar.</p>
      <button id="publicTrainingOpenExternalButton" class="primary-btn" type="button">Abrir contenido</button>
      <div id="publicTrainingExternalCountdown" class="public-training-external-countdown">Duración mínima: ${Math.ceil(requiredSeconds/60)} min</div>
      <button id="publicTrainingCompleteExternalButton" class="secondary-btn hidden" type="button">Confirmar contenido revisado</button>
    </div>
  `;

  document.getElementById('publicTrainingOpenExternalButton')?.addEventListener('click',()=>{
    window.open(url,'_blank','noopener');
    if (publicCommitteeTrainingExternalStartedAt) return;
    publicCommitteeTrainingExternalStartedAt=Date.now();

    const countdown=document.getElementById('publicTrainingExternalCountdown');
    const completeButton=document.getElementById('publicTrainingCompleteExternalButton');

    publicCommitteeTrainingExternalTimer=setInterval(()=>{
      const elapsed=Math.floor((Date.now()-publicCommitteeTrainingExternalStartedAt)/1000);
      const remaining=Math.max(0,requiredSeconds-elapsed);
      const percent=Math.min(99,(elapsed/requiredSeconds)*100);
      updatePublicCommitteeTrainingVideoProgressUi(percent);
      if (countdown) {
        const min=Math.floor(remaining/60);
        const sec=String(remaining%60).padStart(2,'0');
        countdown.textContent=remaining>0 ? `Tiempo mínimo restante: ${min}:${sec}` : 'Ya puedes confirmar la revisión.';
      }
      if (remaining<=0) {
        clearInterval(publicCommitteeTrainingExternalTimer);
        publicCommitteeTrainingExternalTimer=null;
        completeButton?.classList.remove('hidden');
      }
    },1000);
  });

  document.getElementById('publicTrainingCompleteExternalButton')?.addEventListener('click',()=>{
    publicCommitteeTrainingCurrentMaxSecond=requiredSeconds;
    savePublicCommitteeTrainingProgress(video,requiredSeconds,requiredSeconds,true,true);
  });
}

async function loadPublicCommitteeTrainingVideo(videoId) {
  if (!publicCommitteeTrainingData) return;
  const video=(publicCommitteeTrainingData.videos || []).find(x=>x.id===videoId);
  if (!video) return;

  if (publicCommitteeTrainingVideoLocked(video)) {
    publicCommitteeTrainingMessage(
      'Este video está bloqueado. Completa primero los contenidos obligatorios anteriores.',
      'error',
      'publicCommitteeTrainingPlayerMessage'
    );
    return;
  }

  clearPublicCommitteeTrainingPlayer();
  publicCommitteeTrainingCurrentVideoId=video.id;
  publicCommitteeTrainingCurrentMaxSecond=Math.max(Number(video.max_segundo || 0),Number(video.ultimo_segundo || 0));
  publicCommitteeTrainingLastSaveAt=0;
  publicCommitteeTrainingCompletionBusy=false;

  document.getElementById('publicCommitteeTrainingPlayerCard')?.classList.remove('hidden');
  document.getElementById('publicCommitteeTrainingCurrentOrder').textContent=`VIDEO ${video.orden}`;
  document.getElementById('publicCommitteeTrainingCurrentVideoTitle').textContent=video.titulo || `Video ${video.orden}`;
  document.getElementById('publicCommitteeTrainingCurrentVideoDescription').textContent=video.descripcion || '';
  const status=document.getElementById('publicCommitteeTrainingCurrentVideoStatus');
  status.textContent=video.completado?'COMPLETADO':'EN CURSO';
  status.className=`public-video-status ${video.completado?'completed':''}`;
  document.getElementById('publicCommitteeTrainingSeekNotice')?.classList.toggle('hidden',!!video.completado);
  publicCommitteeTrainingMessage('','error','publicCommitteeTrainingPlayerMessage');
  updatePublicCommitteeTrainingVideoProgressUi(video.completado?100:Number(video.porcentaje || 0));
  renderPublicCommitteeTrainingVideoList();

  const host=document.getElementById('publicCommitteeTrainingPlayerHost');
  if (host) host.innerHTML='<div class="public-training-player-loading">Cargando video…</div>';

  try {
    if (video.tipo_fuente==='YOUTUBE') {
      await setupPublicCommitteeTrainingYoutube(video);
    } else if (video.tipo_fuente==='MP4_UPLOAD') {
      await setupPublicCommitteeTrainingUploadedMp4(video);
    } else {
      setupPublicCommitteeTrainingExternal(video);
    }
  } catch(err) {
    console.error(err);
    if (host) host.innerHTML='';
    publicCommitteeTrainingMessage(
      err?.message || 'No fue posible preparar este video.',
      'error',
      'publicCommitteeTrainingPlayerMessage'
    );
  }
}


// ------------------------------------------------------------
// FIRMA ELECTRÓNICA DE CONFORMIDAD - ADMINISTRACIÓN
// ------------------------------------------------------------
function committeeMeetingSignaturePublicUrl(record) {
  if (!record?.public_token) return '';
  const url=new URL(window.location.href);
  url.search='';
  url.hash='';
  url.searchParams.set('meetingSign',record.public_token);
  return url.toString();
}

function renderCommitteeMeetingSigningAdmin(record,canManage=true) {
  const attendees=committeeMeetingAttendees.filter(x=>x.reunion_id===record.id);
  const signed=attendees.filter(x=>x.firmado_at && x.consentimiento_firma && x.firma_electronica);
  const count=document.getElementById('committeeMeetingSignedCount');
  const state=document.getElementById('committeeMeetingSigningState');
  const box=document.getElementById('committeeMeetingSignatureLinkBox');
  const input=document.getElementById('committeeMeetingSignatureLink');
  const enable=document.getElementById('enableCommitteeMeetingSignaturesButton');

  if (count) count.textContent=`${signed.length} / ${attendees.length}`;
  if (state) {
    state.textContent=record.estado==='EN_FIRMA'
      ? 'HABILITADA'
      : record.estado==='CERRADA'
        ? 'CERRADA'
        : 'NO HABILITADA';
  }

  const showLink=['EN_FIRMA','CERRADA'].includes(record.estado) && !!record.public_token;
  box?.classList.toggle('hidden',!showLink);
  if (input) input.value=showLink ? committeeMeetingSignaturePublicUrl(record) : '';

  if (enable) {
    enable.classList.toggle('hidden',!canManage || ['EN_FIRMA','CERRADA'].includes(record.estado));
    enable.disabled=!canManage;
  }
}

async function enableCommitteeMeetingSignatures() {
  if (!activeCommitteeMeetingId) return;
  const record=committeeMeetingRecords.find(x=>x.id===activeCommitteeMeetingId);
  if (!record || !committeeMeetingCanManage(record)) return;

  const endTime=document.getElementById('committeeMeetingActualEndTime')?.value || record.hora_fin || '';
  if (!endTime) {
    committeeMeetingEditorMessage('Antes de habilitar las firmas registra la hora real de culminación de la reunión.');
    document.getElementById('committeeMeetingActualEndTime')?.focus();
    return;
  }

  if (!confirm(
    'Se habilitará el enlace para que los integrantes registren su conformidad y firma. '+
    'El acta seguirá siendo editable por el administrador. ¿Continuar?'
  )) return;

  const saved=await persistCommitteeMeetingEditor(false,true);
  if (!saved) {
    committeeMeetingEditorMessage('No fue posible guardar el contenido antes de habilitar las firmas.');
    return;
  }

  const button=document.getElementById('enableCommitteeMeetingSignaturesButton');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Habilitando…';

  const {data,error}=await client.rpc('habilitar_firmas_reunion',{
    p_reunion_id:activeCommitteeMeetingId
  });

  button.disabled=false;
  button.textContent=old;

  if (error || !data?.ok) {
    console.error(error,data);
    committeeMeetingEditorMessage(data?.error || error?.message || 'No fue posible habilitar las firmas.');
    return;
  }

  committeeMeetingsLoaded=false;
  await loadCommitteeMeetingsModule(true);
  await openCommitteeMeetingEditor(activeCommitteeMeetingId);
  committeeMeetingEditorMessage(
    'Firma electrónica habilitada. Comparte el enlace únicamente con los integrantes convocados.',
    'success'
  );
}

async function copyCommitteeMeetingSignatureLink(record=null) {
  const item=record || committeeMeetingRecords.find(x=>x.id===activeCommitteeMeetingId);
  const link=committeeMeetingSignaturePublicUrl(item);
  if (!link) return;

  try {
    await navigator.clipboard.writeText(link);
    if (activeCommitteeMeetingId===item.id) {
      committeeMeetingEditorMessage('Enlace de firma copiado.','success');
    } else {
      alert('Enlace de firma copiado.');
    }
  } catch {
    window.prompt('Copia el enlace de firma:',link);
  }
}

function shareCommitteeMeetingSignatureLink(record=null) {
  const item=record || committeeMeetingRecords.find(x=>x.id===activeCommitteeMeetingId);
  const link=committeeMeetingSignaturePublicUrl(item);
  if (!link) return;

  const committee=committeeMeetingCommittee(item);
  const text=
    `Firma de conformidad - Acta N° ${item.numero_acta || ''}\n`+
    `${committee?.nombre || 'Comité SST'}\n`+
    `Ingresa con tu DNI, revisa los datos del acta y registra tu conformidad:\n${link}`;

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank','noopener');
}

// ------------------------------------------------------------
// FIRMA ELECTRÓNICA DE CONFORMIDAD - PÚBLICO
// ------------------------------------------------------------
function publicCommitteeMeetingSignatureMessage(message='',type='error',target='publicMeetingSignatureMessage') {
  const el=document.getElementById(target);
  if (!el) return;
  el.textContent=message || '';
  el.className=`form-message ${message?'visible':''} ${type}`;
}

async function initializePublicCommitteeMeetingSignature(token) {
  publicCommitteeMeetingSignatureToken=String(token || '').trim();
  publicCommitteeMeetingSignatureData=null;

  publicExamScreen?.classList.add('hidden');
  publicPracticeScreen?.classList.add('hidden');
  publicEvaluationScreen?.classList.add('hidden');
  appShell?.classList.add('hidden');
  authScreen?.classList.add('hidden');
  authLoading?.classList.add('hidden');
  publicMeetingSignatureScreen?.classList.remove('hidden');

  document.getElementById('publicMeetingSignatureIdentity')?.classList.remove('hidden');
  document.getElementById('publicMeetingSignatureReview')?.classList.add('hidden');
  document.getElementById('publicMeetingSignatureCompleted')?.classList.add('hidden');
  document.getElementById('publicMeetingSignatureAct').textContent='Acta de reunión · Identificación requerida';
  document.getElementById('publicMeetingSignatureDni').value='';
  publicCommitteeMeetingSignatureMessage('');
  setTimeout(()=>document.getElementById('publicMeetingSignatureDni')?.focus(),50);
}

function setupPublicCommitteeMeetingSignatureCanvas() {
  const canvas=document.getElementById('publicMeetingSignatureCanvas');
  if (!canvas) return;

  const ctx=canvas.getContext('2d');
  publicCommitteeMeetingSignatureCtx=ctx;
  publicCommitteeMeetingSignatureDrawing=false;

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.lineWidth=4;
  ctx.lineCap='round';
  ctx.lineJoin='round';
  ctx.strokeStyle='#17263c';

  const point=(event)=>{
    const rect=canvas.getBoundingClientRect();
    const p=event.touches?.[0] || event;
    return {
      x:(p.clientX-rect.left)*(canvas.width/rect.width),
      y:(p.clientY-rect.top)*(canvas.height/rect.height)
    };
  };

  canvas.onpointerdown=(event)=>{
    publicCommitteeMeetingSignatureDrawing=true;
    const p=point(event);
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
    canvas.setPointerCapture?.(event.pointerId);
  };

  canvas.onpointermove=(event)=>{
    if (!publicCommitteeMeetingSignatureDrawing) return;
    const p=point(event);
    ctx.lineTo(p.x,p.y);
    ctx.stroke();
  };

  canvas.onpointerup=()=>{publicCommitteeMeetingSignatureDrawing=false;};
  canvas.onpointercancel=()=>{publicCommitteeMeetingSignatureDrawing=false;};
  canvas.onpointerleave=()=>{publicCommitteeMeetingSignatureDrawing=false;};
}

function publicCommitteeMeetingSignatureIsBlank() {
  const canvas=document.getElementById('publicMeetingSignatureCanvas');
  if (!canvas) return true;
  const ctx=canvas.getContext('2d');
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  for (let i=3;i<pixels.length;i+=4) {
    if (pixels[i]!==0) return false;
  }
  return true;
}

function showPublicCommitteeMeetingAlreadySigned(data) {
  document.getElementById('publicMeetingSignatureIdentity')?.classList.add('hidden');
  document.getElementById('publicMeetingSignatureReview')?.classList.add('hidden');
  document.getElementById('publicMeetingSignatureCompleted')?.classList.remove('hidden');

  const participant=data.participante || {};
  const signedAt=participant.firmado_at
    ? new Date(participant.firmado_at).toLocaleString('es-PE')
    : '';
  document.getElementById('publicMeetingSignatureCompletedText').textContent=
    `La conformidad de ${[participant.apellidos,participant.nombres].filter(Boolean).join(' ')} ya fue registrada${signedAt ? ` el ${signedAt}` : ''}.`;
  document.getElementById('publicMeetingSignatureAct').textContent=
    `Acta N° ${data.reunion?.numero_acta || '—'}`;
}

async function lookupPublicCommitteeMeetingSignature() {
  const dni=(document.getElementById('publicMeetingSignatureDni')?.value || '').replace(/\D/g,'').slice(0,8);
  document.getElementById('publicMeetingSignatureDni').value=dni;
  publicCommitteeMeetingSignatureMessage('');

  if (!/^\d{8}$/.test(dni)) {
    publicCommitteeMeetingSignatureMessage('Ingresa un DNI válido de 8 dígitos.');
    return;
  }

  const button=document.getElementById('publicMeetingSignatureLookupButton');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Verificando…';

  const {data,error}=await client.rpc('obtener_reunion_publica_firma',{
    p_token:publicCommitteeMeetingSignatureToken,
    p_dni:dni
  });

  button.disabled=false;
  button.textContent=old;

  if (error || !data?.ok) {
    console.error(error,data);
    publicCommitteeMeetingSignatureMessage(data?.error || error?.message || 'No fue posible validar tu participación.');
    return;
  }

  publicCommitteeMeetingSignatureData=data;

  if (data.participante?.firmado) {
    showPublicCommitteeMeetingAlreadySigned(data);
    return;
  }

  const participant=data.participante || {};
  const meeting=data.reunion || {};
  const fullName=[participant.apellidos,participant.nombres].filter(Boolean).join(' ');

  document.getElementById('publicMeetingSignatureAct').textContent=`Acta N° ${meeting.numero_acta || '—'}`;
  document.getElementById('publicMeetingSignatureName').textContent=fullName || 'Integrante';
  document.getElementById('publicMeetingSignatureWorkerMeta').textContent=
    `DNI ${participant.dni || '—'} · ${participant.cargo_comite || participant.cargo || 'Integrante'} · ${participant.area || '—'}`;
  document.getElementById('publicMeetingSignatureActNumber').textContent=meeting.numero_acta || '—';
  document.getElementById('publicMeetingSignatureDate').textContent=formatDatePE(meeting.fecha);
  document.getElementById('publicMeetingSignatureTime').textContent=
    `${formatCommitteeTime12(meeting.hora_inicio)} - ${formatCommitteeTime12(meeting.hora_fin)}`;
  document.getElementById('publicMeetingSignaturePlace').textContent=meeting.lugar || '—';

  const agenda=[...(meeting.agenda || []),...(meeting.agenda_adicional || [])];
  document.getElementById('publicMeetingSignatureAgenda').innerHTML=
    agenda.map(item=>`<div class="public-meeting-agenda-item">✓ ${escapeHtml(item)}</div>`).join('');

  document.getElementById('publicMeetingSignatureConsent').checked=false;
  document.getElementById('publicMeetingSignatureIdentity')?.classList.add('hidden');
  document.getElementById('publicMeetingSignatureReview')?.classList.remove('hidden');
  document.getElementById('publicMeetingSignatureCompleted')?.classList.add('hidden');

  setupPublicCommitteeMeetingSignatureCanvas();
  publicCommitteeMeetingSignatureMessage('','error','publicMeetingSignatureSubmitMessage');
  window.scrollTo({top:0,behavior:'smooth'});
}

async function submitPublicCommitteeMeetingSignature() {
  if (!publicCommitteeMeetingSignatureData) return;

  const consent=document.getElementById('publicMeetingSignatureConsent')?.checked;
  const consentText=document.getElementById('publicMeetingSignatureConsentText')?.textContent?.trim() || '';
  const dni=document.getElementById('publicMeetingSignatureDni')?.value || '';

  publicCommitteeMeetingSignatureMessage('','error','publicMeetingSignatureSubmitMessage');

  if (!consent) {
    publicCommitteeMeetingSignatureMessage(
      'Marca voluntariamente la casilla de conformidad antes de firmar.',
      'error',
      'publicMeetingSignatureSubmitMessage'
    );
    return;
  }

  if (publicCommitteeMeetingSignatureIsBlank()) {
    publicCommitteeMeetingSignatureMessage(
      'Registra tu firma dentro del recuadro.',
      'error',
      'publicMeetingSignatureSubmitMessage'
    );
    return;
  }

  const canvas=document.getElementById('publicMeetingSignatureCanvas');
  const firma=canvas.toDataURL('image/png');

  const button=document.getElementById('savePublicMeetingSignatureButton');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Registrando…';

  const {data,error}=await client.rpc('registrar_firma_reunion',{
    p_token:publicCommitteeMeetingSignatureToken,
    p_dni:dni,
    p_firma:firma,
    p_consentimiento:true,
    p_consentimiento_texto:consentText,
    p_user_agent:navigator.userAgent || ''
  });

  button.disabled=false;
  button.textContent=old;

  if (error || !data?.ok) {
    console.error(error,data);
    publicCommitteeMeetingSignatureMessage(
      data?.error || error?.message || 'No fue posible registrar tu firma.',
      'error',
      'publicMeetingSignatureSubmitMessage'
    );
    return;
  }

  document.getElementById('publicMeetingSignatureReview')?.classList.add('hidden');
  document.getElementById('publicMeetingSignatureCompleted')?.classList.remove('hidden');
  document.getElementById('publicMeetingSignatureCompletedText').textContent=
    `${data.nombre || 'Integrante'}, tu conformidad quedó registrada para el Acta N° ${data.numero_acta || '—'}.`;
  window.scrollTo({top:0,behavior:'smooth'});
}


// ------------------------------------------------------------
// PDF - ACTA EDP-SIG-SSOMAC-RE-EA-131
// ------------------------------------------------------------
function meetingPdfHeader(doc,logo,title) {
  const x=10,y=8,totalW=190,h=20;
  const logoW=32,centerW=110,metaW=48;

  doc.setDrawColor(20);
  doc.setLineWidth(.25);
  doc.rect(x,y,logoW,h);
  doc.rect(x+logoW,y,centerW,h);
  doc.rect(x+logoW+centerW,y,metaW,h);

  if (logo) {
    try {doc.addImage(logo,'JPEG',x+2,y+3,28,14,undefined,'FAST');} catch(e){}
  }

  doc.setFont('helvetica','bold');
  doc.setFontSize(9);
  doc.text('SIG - SSOMAC',x+logoW+centerW/2,y+6,{align:'center'});

  doc.setFillColor(192,0,0);
  doc.rect(x+logoW,y+9,centerW,6,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(7.2);
  let titleSize=7.2;
  while (titleSize>5.2) {
    doc.setFontSize(titleSize);
    if (doc.getTextWidth(title)<=centerW-4) break;
    titleSize-=.2;
  }
  doc.text(title,x+logoW+centerW/2,y+13.2,{align:'center'});

  const mx=x+logoW+centerW;
  const rows=[
    ['Código:','EDP-SIG-SSOMAC-RE-EA-131'],
    ['N°:','12'],
    ['Versión:','6'],
    ['Fecha Act:','Jul-25']
  ];
  doc.setTextColor(0);
  rows.forEach((row,index)=>{
    const rh=h/4,ry=y+index*rh;
    if (index>0) doc.line(mx,ry,mx+metaW,ry);
    doc.line(mx+16,ry,mx+16,ry+rh);
    doc.setFont('helvetica','normal');
    doc.setFontSize(5.5);
    doc.text(row[0],mx+1,ry+3.2);
    doc.setFontSize(index===0?4.6:5.5);
    doc.text(row[1],mx+32,ry+3.2,{align:'center'});
  });

  doc.setTextColor(0);
  return y+h+5;
}

function meetingPdfSectionTitle(doc,number,title,y) {
  doc.setFont('helvetica','bold');
  doc.setFontSize(8.2);
  doc.text(`${number}.`,16,y);
  doc.text(title,28,y);
  return y+4;
}

function meetingPdfTable(doc,head,body,startY,widths=null,options={}) {
  const styles={
    font:'helvetica',
    fontSize:6.2,
    cellPadding:1.5,
    lineWidth:.15,
    lineColor:[25,25,25],
    textColor:[20,20,20],
    valign:'middle',
    overflow:'linebreak'
  };

  const columnStyles={};
  if (Array.isArray(widths)) {
    widths.forEach((w,index)=>columnStyles[index]={cellWidth:w});
  }

  const pageWidth=doc.internal.pageSize.getWidth();
  const tableWidth=Array.isArray(widths) ? widths.reduce((sum,w)=>sum+Number(w||0),0) : pageWidth-32;
  const centeredLeft=Math.max(10,(pageWidth-tableWidth)/2);

  doc.autoTable({
    startY,
    head:[head],
    body:body.length ? body : [head.map((_,idx)=>idx===0?'1':'')],
    margin:{left:centeredLeft,right:centeredLeft,top:34,bottom:12},
    tableWidth:Array.isArray(widths)?tableWidth:'auto',
    styles,
    bodyStyles:options.bodyStyles || {},
    headStyles:{
      fillColor:[225,221,232],
      textColor:[10,10,10],
      fontStyle:'bold',
      halign:'center',
      lineWidth:.15,
      lineColor:[25,25,25]
    },
    columnStyles,
    theme:'grid',
    rowPageBreak:'avoid',
    didDrawPage:options.didDrawPage,
    didDrawCell:options.didDrawCell
  });

  return doc.lastAutoTable.finalY;
}

async function buildCommitteeMeetingPdfData(id) {
  if (!committeeMeetingsLoaded) await loadCommitteeMeetingsModule(true);
  const meeting=committeeMeetingRecords.find(x=>x.id===id);
  if (!meeting) throw new Error('No se encontró la reunión.');

  return {
    meeting,
    committee:committeeMeetingCommittee(meeting),
    attendees:committeeMeetingAttendees.filter(x=>x.reunion_id===id),
    evidences:committeeMeetingEvidences.filter(x=>x.reunion_id===id),
    agreements:committeeMeetingAgreements.filter(x=>x.reunion_id===id),
    previous:previousCommitteeMeetingAgreements(meeting)
  };
}

async function generateCommitteeMeetingMinutesPdf(data,button=null) {
  if (!window.jspdf?.jsPDF) throw new Error('No se cargó el generador PDF.');
  const original=button?.textContent || '';
  if (button) {button.disabled=true;button.textContent='Generando…';}

  try {
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});
    const meeting=data.meeting;
    const committee=data.committee || {};
    const isSub=committee.tipo==='SUBCOMITE';
    const committeeLabel=isSub?'Subcomité SST':'Comité SST';
    const title=isSub?'ACTA DE REUNIÓN DEL SUBCOMITÉ SST':'ACTA DE REUNIÓN DEL COMITÉ SST';

    let logo=null;
    try {logo=await imageToDataUrl('assets/logo-explo.jpg');} catch(e){console.warn(e);}

    const header=()=>meetingPdfHeader(doc,logo,title);
    const headerHook=()=>{ meetingPdfHeader(doc,logo,title); };

    let y=header();

    doc.setFont('helvetica','bold');
    doc.setFontSize(9);
    doc.text(`ACTA N° ${meeting.numero_acta || '—'}`,105,y+3,{align:'center'});
    y+=9;

    doc.setFont('helvetica','normal');
    doc.setFontSize(7.3);
    const p1=`En ${meeting.lugar || 'Lima'}, a los ${meetingDatePhrase(meeting.fecha)}, a las ${formatCommitteeTime12(meeting.hora_inicio)}, se lleva a cabo la reunión del ${committeeLabel}, de la empresa EXPLO DRILLING PERÚ S.R.L. En conformidad con la Ley 29783 Ley de Seguridad y Salud en el Trabajo.`;
    const p2=`Habiéndose verificado el quorum establecido en el articulo 69° del D.S. 005-2012-TR, se da inicio a la sesión, para analizar los resultados del mes de ${committeeMonthLabel(meeting.mes_resultados)}.`;

    let lines=doc.splitTextToSize(p1,174);
    doc.text(lines,18,y);
    y+=lines.length*3.8+2;
    lines=doc.splitTextToSize(p2,174);
    doc.text(lines,18,y);
    y+=lines.length*3.8+6;

    y=meetingPdfSectionTitle(doc,'1','AGENDA',y);
    const agenda=[...(Array.isArray(meeting.agenda)?meeting.agenda:[]),...(Array.isArray(meeting.agenda_adicional)?meeting.agenda_adicional:[])];
    doc.setFont('helvetica','normal');
    doc.setFontSize(7.2);
    agenda.forEach(item=>{
      // check mark drawn manually so standard PDF fonts are not required.
      doc.setLineWidth(.35);
      doc.line(30,y-1,31.5,y+.5);
      doc.line(31.5,y+.5,34,y-2.5);
      const wrapped=doc.splitTextToSize(item,150);
      doc.text(wrapped,37,y);
      y+=Math.max(4,wrapped.length*3.6);
    });
    y+=4;

    y=meetingPdfSectionTitle(doc,'2','DESARROLLO DE LA REUNIÓN',y);

    doc.setFont('helvetica','bold');doc.setFontSize(7.3);
    doc.text('2.1.     REVISIÓN DE INCIDENTES / ACCIDENTE / ESTADÍSTICAS',24,y);
    y+=2;

    const incidents=Array.isArray(meeting.incidentes)?meeting.incidentes:[];
    y=meetingPdfTable(
      doc,
      ['N°','INCIDENTE/ACCIDENTE','COMENTARIOS / PLAN DE ACCIÓN'],
      (incidents.length?incidents:[{incidente:'',comentarios:''}]).map((r,i)=>[String(i+1),r.incidente||'',r.comentarios||'']),
      y+2,[10,93,57],
      {didDrawPage:headerHook}
    )+6;

    doc.setFont('helvetica','bold');doc.setFontSize(7.3);
    doc.text('2.2.     REVISIÓN DE ESTADÍSTICAS DE SST',24,y);
    const sst=meeting.estadisticas_sst || {};
    const sstText=`En el mes de ${committeeMonthLabel(meeting.mes_resultados)}, los índices de seguridad a la fecha son:\nIF=${Number(sst.if||0).toFixed(2)}, IS=${Number(sst.is||0).toFixed(2)}, IA=${Number(sst.ia||0).toFixed(2)}`;
    y=meetingPdfTable(doc,['N°','TEMA','COMENTARIOS / REPERCUSIÓN'],[['1',sstText,sst.comentarios||'']],y+2,[10,93,57],{didDrawPage:headerHook})+6;

    doc.setFont('helvetica','bold');doc.setFontSize(7.3);
    doc.text('2.3.     REVISIÓN DE ESTADÍSTICAS DE SO',24,y);
    const so=meeting.estadisticas_so || {};
    const soText=`En el mes de ${committeeMonthLabel(meeting.mes_resultados)}, los índices de Salud Ocupacional a la fecha son:\nEnfermedades Ocupacionales=${Number(so.enfermedades_ocupacionales||0).toFixed(2)}, Trabajadores Expuestos al Agente=${Number(so.trabajadores_expuestos||0).toFixed(2)}, Tasa de Incidencia=${Number(so.tasa_incidencia||0).toFixed(2)}, Trabajadores con Enfermedades Ocupacionales=${Number(so.trabajadores_con_enfermedad||0).toFixed(2)}.`;
    y=meetingPdfTable(doc,['N°','TEMA','COMENTARIOS / REPERCUSIÓN'],[['1',soText,so.comentarios||'']],y+2,[10,93,57],{didDrawPage:headerHook})+6;

    doc.setFont('helvetica','bold');doc.setFontSize(7.3);
    doc.text('2.4.     REVISIÓN DE CUMPLIMIENTO DE OBJETIVOS Y ASUNTOS RELEVANTES DE SST',24,y);
    const objectives=Array.isArray(meeting.objetivos_sst)?meeting.objetivos_sst:[];
    y=meetingPdfTable(
      doc,['N°','TEMA','COMENTARIOS / REPERCUSIÓN'],
      (objectives.length?objectives:[{tema:'',comentarios:''},{tema:'',comentarios:''}]).map((r,i)=>[String(i+1),r.tema||'',r.comentarios||'']),
      y+2,[10,93,57],{didDrawPage:headerHook}
    )+7;

    doc.setFont('helvetica','bold');doc.setFontSize(7.3);
    doc.text('2.5.     REVISIÓN DE INSPECCIONES REALIZADAS',24,y);

    // Página dedicada a evidencias para respetar el espacio indicado en el formato.
    doc.addPage();
    y=header();

    const evidenceRows=data.evidences.slice(0,4);
    if (!evidenceRows.length) {
      doc.setTextColor(220,0,0);
      doc.setFont('helvetica','bold');
      doc.setFontSize(8);
      doc.text('(pegar la inspección realizada por el comité SST, evidenciando levantamientos)',105,y+8,{align:'center'});
      doc.setTextColor(0);
      y+=17;
    } else {
      doc.setFont('helvetica','bold');
      doc.setFontSize(8);
      doc.text('EVIDENCIAS DE INSPECCIÓN / LEVANTAMIENTOS',105,y+2,{align:'center'});
      y+=6;

      const images=[];
      for (const ev of evidenceRows) {
        try {images.push({ev,data:await imageToDataUrl(ev.url)});} catch(e){images.push({ev,data:null});}
      }

      const colW=84,rowH=51,gap=7,startX=18;
      for (let i=0;i<images.length;i++) {
        const col=i%2,row=Math.floor(i/2);
        const x=startX+col*(colW+gap);
        const yy=y+row*(rowH+8);
        doc.setDrawColor(130);doc.rect(x,yy,colW,rowH);
        if (images[i].data) {
          try {
            const props=doc.getImageProperties(images[i].data);
            const ratio=Math.min((colW-4)/props.width,(rowH-10)/props.height);
            const iw=props.width*ratio,ih=props.height*ratio;
            doc.addImage(images[i].data,'JPEG',x+(colW-iw)/2,yy+2,iw,ih,undefined,'FAST');
          } catch(e){}
        }
        doc.setFont('helvetica','normal');doc.setFontSize(5.8);
        const caption=images[i].ev.descripcion || `Evidencia ${i+1}`;
        const cap=doc.splitTextToSize(caption,colW-4).slice(0,2);
        doc.text(cap,x+2,yy+rowH-5);
      }
      y+=Math.ceil(images.length/2)*(rowH+8)+2;
    }

    if (y>120) {
      doc.addPage();
      y=header();
    }

    doc.setFont('helvetica','bold');doc.setFontSize(7.3);
    doc.text('2.6.     REVISIÓN DE ACUERDOS DE SUB COMITÉ SST DE PROYECTOS',24,y);
    const subs=Array.isArray(meeting.acuerdos_subcomites)?meeting.acuerdos_subcomites:[];
    y=meetingPdfTable(
      doc,['N°','PROYECTO','ACUERDOS','ACCIONES','ESTADO'],
      (subs.length?subs:[{proyecto:'',acuerdo:'',acciones:'',estado:''},{},{},]).map((r,i)=>[
        String(i+1),r.proyecto||'',r.acuerdo||'',r.acciones||'',r.estado||''
      ]),
      y+2,[10,28,58,47,17],{didDrawPage:headerHook}
    )+6;

    doc.setFont('helvetica','bold');doc.setFontSize(7.3);
    doc.text('2.7.     REVISIÓN DE PENDIENTES DE ACUERDOS DE REUNIONES ANTERIORES',24,y);
    const manualPrevious=Array.isArray(meeting.pendientes_adicionales)?meeting.pendientes_adicionales:[];
    const previousRows=[
      ...data.previous.map(r=>({tema:r.accion||'',responsable:r.responsable||'',estado:r.estado||''})),
      ...manualPrevious.map(r=>({tema:r.tema||'',responsable:r.responsable||'',estado:r.estado||''}))
    ];
    y=meetingPdfTable(
      doc,['N°','TEMA','RESPONSABLE','ESTADO'],
      (previousRows.length?previousRows:[{tema:'',responsable:'',estado:''},{},{},]).map((r,i)=>[
        String(i+1),r.tema||'',r.responsable||'',r.estado||''
      ]),
      y+2,[10,95,35,20],{didDrawPage:headerHook}
    )+6;

    doc.setFont('helvetica','bold');doc.setFontSize(7.3);
    doc.text('2.8.     ACUERDOS DE LA REUNIÓN',24,y);
    y=meetingPdfTable(
      doc,['N°','ACCIONES REQUERIDAS','PERSONA RESPONSABLE','FECHA DE CUMPLIMIENTO'],
      (data.agreements.length?data.agreements:[{accion:'',responsable:'',fecha_cumplimiento:null},{},{},]).map((r,i)=>[
        String(i+1),r.accion||'',r.responsable||'',r.fecha_cumplimiento?formatDatePE(r.fecha_cumplimiento):''
      ]),
      y+2,[10,92,34,24],{didDrawPage:headerHook}
    )+7;

    if (y>235) {doc.addPage();y=header();}

    doc.setFont('helvetica','bold');doc.setFontSize(8);
    doc.text('3.     PARTICIPANTES DE LA REUNIÓN:',24,y);
    y+=7;

    doc.setFont('helvetica','normal');doc.setFontSize(7);
    const closeText=`A horas ${formatCommitteeTime12(meeting.hora_fin)}, se da por culminado la reunión del comité de seguridad, firmando los presentes en señal de conformidad.`;
    const closeLines=doc.splitTextToSize(closeText,170);
    doc.text(closeLines,18,y);
    y+=closeLines.length*3.6+2;

    const signedAttendees=data.attendees.filter(x=>x.firmado_at && x.consentimiento_firma && x.firma_electronica);
    const participantRows=(signedAttendees.length?signedAttendees:[{}]).map((a,i)=>{
      const member=a.comite_sst_integrantes || {};
      const worker=member.trabajadores || {};
      let role=member.cargo_comite || '';
      if (role==='PRESIDENTE') role='Presidente CSST';
      else if (role==='SECRETARIO') role='Secretario Comité SST';
      else if (member.representacion==='TRABAJADORES') role='Representante de los trabajadores';
      else if (member.representacion==='EMPLEADOR') role='Representante del empleador';
      return [String(i+1),a.id?committeeWorkerName(worker):'',role,''];
    });

    y=meetingPdfTable(
      doc,['N°','PERSONAL','CARGO','FIRMA'],
      participantRows,
      y,[10,58,61,31],{
        didDrawPage:headerHook,
        bodyStyles:{minCellHeight:14},
        didDrawCell:(cellData)=>{
          if (
            cellData.section==='body' &&
            cellData.column.index===3 &&
            signedAttendees[cellData.row.index]?.firma_electronica
          ) {
            const sig=signedAttendees[cellData.row.index].firma_electronica;
            try {
              const pad=1.2;
              const maxW=cellData.cell.width-pad*2;
              const maxH=cellData.cell.height-pad*2;
              const img=doc.getImageProperties(sig);
              const ratio=Math.min(maxW/img.width,maxH/img.height);
              const drawW=img.width*ratio;
              const drawH=img.height*ratio;
              doc.addImage(
                sig,'PNG',
                cellData.cell.x+(cellData.cell.width-drawW)/2,
                cellData.cell.y+(cellData.cell.height-drawH)/2,
                drawW,drawH,undefined,'FAST'
              );
            } catch(e) {
              console.warn('No se pudo insertar firma de participante',e);
            }
          }
        }
      }
    )+7;

    if (y>235) {doc.addPage();y=header();}

    doc.setFont('helvetica','bold');doc.setFontSize(8);
    doc.text('4.     FECHA Y HORA PARA LA PRÓXIMA REUNIÓN',24,y);
    y+=3;

    const presidentAttendee=data.attendees.find(a=>a.firmado_at && a.comite_sst_integrantes?.cargo_comite==='PRESIDENTE')
      || data.attendees.find(a=>a.comite_sst_integrantes?.cargo_comite==='PRESIDENTE');
    const presidentName=presidentAttendee ? committeeWorkerName(presidentAttendee.comite_sst_integrantes?.trabajadores) : '';
    const nextDateTime=[
      meeting.proxima_fecha ? formatDatePE(meeting.proxima_fecha) : '',
      meeting.proxima_hora ? formatCommitteeTime12(meeting.proxima_hora) : ''
    ].filter(Boolean).join(' · ');

    const nextAgenda=[
      ...(Array.isArray(meeting.agenda)?meeting.agenda:[]),
      ...(meeting.proxima_agenda?[meeting.proxima_agenda]:[])
    ].join('\n');

    meetingPdfTable(
      doc,
      ['PRESIDENTE DE CSSOMA','FECHA Y HORA DE LA PRÓXIMA REUNIÓN','TEMA ESPECÍFICO PARA LA AGENDA'],
      [[presidentName,nextDateTime,nextAgenda]],
      y+2,[55,45,60],{didDrawPage:headerHook}
    );

    const code=(meeting.numero_acta || 'ACTA').replace(/[^\w-]+/g,'_');
    doc.save(`${code}_Acta_Reunion_${isSub?'Subcomite':'Comite'}_SST.pdf`);
  } finally {
    if (button) {button.disabled=false;button.textContent=original;}
  }
}

async function downloadCommitteeMeetingMinutesById(id,button=null) {
  try {
    const data=await buildCommitteeMeetingPdfData(id);
    await generateCommitteeMeetingMinutesPdf(data,button);
  } catch(err) {
    console.error(err);
    alert(err?.message || 'No fue posible generar el acta PDF.');
  }
}

async function downloadCurrentCommitteeMeetingMinutes() {
  if (!activeCommitteeMeetingId) return;
  const button=document.getElementById('downloadCommitteeMeetingMinutesButton');
  const current=committeeMeetingRecords.find(x=>x.id===activeCommitteeMeetingId);
  if (committeeMeetingCanManage(current)) {
    const ok=await persistCommitteeMeetingEditor(false,true);
    if (!ok) return;
  }
  await downloadCommitteeMeetingMinutesById(activeCommitteeMeetingId,button);
}

async function closeCurrentCommitteeMeeting() {
  if (!activeCommitteeMeetingId) return;
  const record=committeeMeetingRecords.find(x=>x.id===activeCommitteeMeetingId);
  if (!record) return;

  if (!confirm('¿Cerrar la reunión? El acta quedará marcada como CERRADA y ya no aceptará nuevas firmas.')) return;
  const id=activeCommitteeMeetingId;

  if (record.estado==='EN_FIRMA') {
    const {error}=await client.from('comite_sst_reuniones').update({estado:'CERRADA'}).eq('id',id);
    if (error) {
      committeeMeetingEditorMessage(error.message || 'No fue posible cerrar la reunión.');
      return;
    }
    committeeMeetingsLoaded=false;
    await loadCommitteeMeetingsModule(true);
  } else {
    const ok=await persistCommitteeMeetingEditor(true,false);
    if (!ok) return;
  }

  await openCommitteeMeetingEditor(id);
  committeeMeetingEditorMessage('Reunión cerrada correctamente. El PDF final mostrará únicamente a quienes registraron su firma electrónica.','success');
}

// ------------------------------------------------------------
// Eventos Etapa 16B
// ------------------------------------------------------------
document.getElementById('committeeConformationsTab')?.addEventListener('click',()=>setCommitteeModuleMode('CONFORMATIONS'));
document.getElementById('committeeMeetingsTab')?.addEventListener('click',()=>setCommitteeModuleMode('MEETINGS'));
document.getElementById('committeeAgreementsTab')?.addEventListener('click',()=>setCommitteeModuleMode('AGREEMENTS'));
document.getElementById('committeeTrainingsTab')?.addEventListener('click',()=>setCommitteeModuleMode('TRAININGS'));

document.getElementById('committeeMeetingProgramForm')?.addEventListener('submit',saveCommitteeMeetingProgram);
document.getElementById('closeCommitteeMeetingProgramModal')?.addEventListener('click',closeCommitteeMeetingProgramModal);
document.getElementById('cancelCommitteeMeetingProgramModal')?.addEventListener('click',closeCommitteeMeetingProgramModal);
document.getElementById('committeeMeetingProgramModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closeCommitteeMeetingProgramModal);

document.getElementById('closeCommitteeMeetingEditorModal')?.addEventListener('click',closeCommitteeMeetingEditorModal);
document.getElementById('committeeMeetingEditorModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closeCommitteeMeetingEditorModal);

document.getElementById('addCommitteeMeetingAgendaButton')?.addEventListener('click',()=>{
  const input=document.getElementById('committeeMeetingAdditionalAgendaInput');
  const value=input.value.trim();
  if (!value) return;
  committeeMeetingAdditionalAgenda.push(value);
  input.value='';
  renderCommitteeMeetingAdditionalAgenda();
});

document.getElementById('addCommitteeMeetingIncidentButton')?.addEventListener('click',()=>{
  const rows=collectMeetingIncidentRows();
  rows.push({incidente:'',comentarios:''});
  renderCommitteeMeetingIncidents(rows);
});

document.getElementById('addCommitteeMeetingObjectiveButton')?.addEventListener('click',()=>{
  const rows=collectMeetingObjectiveRows();
  rows.push({tema:'',comentarios:''});
  renderCommitteeMeetingObjectives(rows);
});

document.getElementById('addCommitteeMeetingSubcommitteeAgreementButton')?.addEventListener('click',()=>{
  const rows=collectMeetingSubcommitteeRows();
  rows.push({proyecto:'',acuerdo:'',acciones:'',estado:''});
  renderCommitteeMeetingSubcommitteeRows(rows);
});

document.getElementById('addCommitteeMeetingPreviousManualButton')?.addEventListener('click',()=>{
  const rows=collectCommitteeMeetingPreviousManualRows();
  rows.push({tema:'',responsable:'',estado:'PENDIENTE'});
  renderCommitteeMeetingPreviousManualRows(rows);
});

document.getElementById('addCommitteeMeetingAgreementButton')?.addEventListener('click',()=>{
  const rows=collectMeetingAgreementRows();
  rows.push({id:null,accion:'',responsable:'',fecha_cumplimiento:''});
  renderCommitteeMeetingAgreements(rows);
});

document.getElementById('saveCommitteeMeetingEditorButton')?.addEventListener('click',()=>persistCommitteeMeetingEditor(false,false));
document.getElementById('closeCommitteeMeetingButton')?.addEventListener('click',closeCurrentCommitteeMeeting);
document.getElementById('downloadCommitteeMeetingMinutesButton')?.addEventListener('click',downloadCurrentCommitteeMeetingMinutes);
document.getElementById('syncCommitteeMeetingAttendeesButton')?.addEventListener('click',syncCommitteeMeetingAttendees);
document.getElementById('uploadCommitteeMeetingEvidenceButton')?.addEventListener('click',uploadCommitteeMeetingEvidence);

document.getElementById('enableCommitteeMeetingSignaturesButton')?.addEventListener('click',enableCommitteeMeetingSignatures);
document.getElementById('copyCommitteeMeetingSignatureLinkButton')?.addEventListener('click',()=>copyCommitteeMeetingSignatureLink());
document.getElementById('whatsappCommitteeMeetingSignatureButton')?.addEventListener('click',()=>shareCommitteeMeetingSignatureLink());

document.getElementById('committeeMeetingSearch')?.addEventListener('input',renderCommitteeMeetingList);
document.getElementById('committeeMeetingCommitteeFilter')?.addEventListener('change',renderCommitteeMeetingList);
document.getElementById('committeeMeetingStatusFilter')?.addEventListener('change',renderCommitteeMeetingList);
document.getElementById('refreshCommitteeMeetingsButton')?.addEventListener('click',()=>{
  committeeMeetingsLoaded=false;
  loadCommitteeMeetingsModule(true);
});

document.getElementById('committeeAgreementSearch')?.addEventListener('input',renderCommitteeAgreementTable);
document.getElementById('committeeAgreementCommitteeFilter')?.addEventListener('change',renderCommitteeAgreementTable);
document.getElementById('committeeAgreementStatusFilter')?.addEventListener('change',renderCommitteeAgreementTable);
document.getElementById('committeeAgreementDeadlineFilter')?.addEventListener('change',renderCommitteeAgreementTable);

document.getElementById('refreshCommitteeAgreementsButton')?.addEventListener('click',()=>{
  committeeAgreementsLoaded=false;
  loadCommitteeAgreementsModule(true);
});

document.getElementById('committeeTrainingSearch')?.addEventListener('input',renderCommitteeTrainingList);
document.getElementById('committeeTrainingCommitteeFilter')?.addEventListener('change',renderCommitteeTrainingList);
document.getElementById('committeeTrainingStatusFilter')?.addEventListener('change',renderCommitteeTrainingList);
document.getElementById('refreshCommitteeTrainingsButton')?.addEventListener('click',()=>{
  committeeTrainingsLoaded=false;
  loadCommitteeTrainingsModule(true);
});

document.getElementById('committeeTrainingForm')?.addEventListener('submit',saveCommitteeTraining);
document.getElementById('copyCommitteeTrainingPublicLinkButton')?.addEventListener('click',()=>copyCommitteeTrainingPublicLink());
document.getElementById('whatsappCommitteeTrainingPublicLinkButton')?.addEventListener('click',()=>shareCommitteeTrainingPublicLink());
document.getElementById('closeCommitteeTrainingModal')?.addEventListener('click',closeCommitteeTrainingModal);
document.getElementById('cancelCommitteeTrainingModal')?.addEventListener('click',closeCommitteeTrainingModal);
document.getElementById('committeeTrainingModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closeCommitteeTrainingModal);

document.getElementById('addCommitteeTrainingVideoButton')?.addEventListener('click',()=>openCommitteeTrainingVideoModal());
document.getElementById('committeeTrainingVideoSourceType')?.addEventListener('change',updateCommitteeTrainingVideoSourceFields);
document.getElementById('committeeTrainingVideoForm')?.addEventListener('submit',saveCommitteeTrainingVideo);
document.getElementById('closeCommitteeTrainingVideoModal')?.addEventListener('click',closeCommitteeTrainingVideoModal);
document.getElementById('cancelCommitteeTrainingVideoModal')?.addEventListener('click',closeCommitteeTrainingVideoModal);
document.getElementById('committeeTrainingVideoModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closeCommitteeTrainingVideoModal);

document.getElementById('closeCommitteeTrainingVideoPreviewModal')?.addEventListener('click',closeCommitteeTrainingVideoPreview);
document.getElementById('committeeTrainingVideoPreviewModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closeCommitteeTrainingVideoPreview);

document.getElementById('addCommitteeTrainingQuestionButton')?.addEventListener('click',()=>openCommitteeTrainingQuestionModal());
document.getElementById('committeeTrainingQuestionType')?.addEventListener('change',event=>{
  renderCommitteeTrainingQuestionOptions(event.target.value,null);
});
document.getElementById('committeeTrainingQuestionImage')?.addEventListener('change',event=>{
  const file=event.target.files?.[0];
  if (!file) return;
  const url=URL.createObjectURL(file);
  renderCommitteeTrainingQuestionImagePreview(url,document.getElementById('committeeTrainingQuestionImagePath').value || '');
  setTimeout(()=>URL.revokeObjectURL(url),60000);
});
document.getElementById('saveCommitteeTrainingQuestionButton')?.addEventListener('click',saveCommitteeTrainingQuestion);
document.getElementById('closeCommitteeTrainingQuestionModal')?.addEventListener('click',closeCommitteeTrainingQuestionModal);
document.getElementById('cancelCommitteeTrainingQuestionModal')?.addEventListener('click',closeCommitteeTrainingQuestionModal);
document.getElementById('committeeTrainingQuestionModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closeCommitteeTrainingQuestionModal);
document.getElementById('committeeTrainingResultsButton')?.addEventListener('click',()=>{
  if (activeCommitteeTrainingId) openCommitteeTrainingResultsModal(activeCommitteeTrainingId);
});
document.getElementById('closeCommitteeTrainingResultsModal')?.addEventListener('click',closeCommitteeTrainingResultsModal);
document.getElementById('committeeTrainingResultsModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closeCommitteeTrainingResultsModal);
document.getElementById('downloadCommitteeTrainingRegisterPdfButton')?.addEventListener('click',event=>downloadCommitteeTrainingRegisterPdf(null,event.currentTarget));
document.getElementById('downloadCommitteeTrainingResultsPdfButton')?.addEventListener('click',event=>downloadCommitteeTrainingResultsReportPdf(null,event.currentTarget));
document.getElementById('downloadCommitteeTrainingResultsExcelButton')?.addEventListener('click',event=>downloadCommitteeTrainingResultsExcel(null,event.currentTarget));
document.getElementById('downloadCommitteeTrainingConsolidatedExcelButton')?.addEventListener('click',downloadCommitteeTrainingConsolidatedExcel);
document.getElementById('downloadCommitteeTrainingConsolidatedPdfButton')?.addEventListener('click',downloadCommitteeTrainingConsolidatedPdf);

document.getElementById('exportCommitteeAgreementsButton')?.addEventListener('click',exportCommitteeAgreementsOfficialExcel);

document.getElementById('committeeAgreementStatus')?.addEventListener('change',toggleCommitteeAgreementCloseFields);
document.getElementById('saveCommitteeAgreementButton')?.addEventListener('click',saveCommitteeAgreement);
document.getElementById('uploadCommitteeAgreementEvidenceButton')?.addEventListener('click',uploadCommitteeAgreementEvidence);

document.getElementById('closeCommitteeAgreementModal')?.addEventListener('click',closeCommitteeAgreementModal);
document.getElementById('cancelCommitteeAgreementModal')?.addEventListener('click',closeCommitteeAgreementModal);
document.getElementById('committeeAgreementModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closeCommitteeAgreementModal);

document.getElementById('viewCommitteeAgreementMeetingButton')?.addEventListener('click',()=>{
  const agreement=committeeMeetingAgreements.find(x=>x.id===activeCommitteeAgreementId);
  if (!agreement) return;
  const meeting=committeeAgreementMeeting(agreement);
  if (!meeting) return;
  closeCommitteeAgreementModal();
  setCommitteeModuleMode('MEETINGS');
  openCommitteeMeetingEditor(meeting.id);
});


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
let workerProjectsCache = [];
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

function projectNameById(id) {
  const project = workerProjectsCache.find(x => x.id === id);
  return project?.nombre || '—';
}

function workerUnitName(worker) {
  if (worker?.proyecto_id) return `Proyecto · ${projectNameById(worker.proyecto_id)}`;
  if (worker?.sede_id) return `Sede · ${siteNameById(worker.sede_id)}`;
  return '—';
}

function renderWorkerSiteOptions() {
  const siteSelect = document.getElementById('workerSite');
  const projectSelect = document.getElementById('workerProject');
  const currentSite = siteSelect?.value || '';
  const currentProject = projectSelect?.value || '';
  const currentFilterValue = workerSiteFilter?.value || 'all';

  const siteOptions = workerSitesCache.map(site =>
    `<option value="${site.id}">${escapeHtml(site.nombre)}${site.activo ? '' : ' (Inactiva)'}</option>`
  ).join('');

  const projectOptions = workerProjectsCache.map(project =>
    `<option value="${project.id}">${escapeHtml(project.nombre)}${project.activo ? '' : ' (Inactivo)'}</option>`
  ).join('');

  if (siteSelect) {
    siteSelect.innerHTML = `<option value="">Sin sede / Seleccione una sede</option>${siteOptions}`;
    if ([...siteSelect.options].some(o => o.value === currentSite)) siteSelect.value = currentSite;
  }

  if (projectSelect) {
    projectSelect.innerHTML = `<option value="">Sin proyecto / Seleccione un proyecto</option>${projectOptions}`;
    if ([...projectSelect.options].some(o => o.value === currentProject)) projectSelect.value = currentProject;
  }

  if (workerSiteFilter) {
    workerSiteFilter.innerHTML = `
      <option value="all">Todas las sedes y proyectos</option>
      <optgroup label="Sedes">
        ${workerSitesCache.map(site => `<option value="sede:${site.id}">${escapeHtml(site.nombre)}</option>`).join('')}
      </optgroup>
      <optgroup label="Proyectos">
        ${workerProjectsCache.map(project => `<option value="proyecto:${project.id}">${escapeHtml(project.nombre)}</option>`).join('')}
      </optgroup>`;
    if ([...workerSiteFilter.options].some(o => o.value === currentFilterValue)) {
      workerSiteFilter.value = currentFilterValue;
    }
  }
}

function filteredWorkers() {
  const q = (workerSearch?.value || '').trim().toLowerCase();
  const unit = workerSiteFilter?.value || 'all';
  const status = workerStatusFilter?.value || 'all';

  return workersCache.filter(worker => {
    const searchable = `${worker.dni || ''} ${worker.apellidos || ''} ${worker.nombres || ''} ${worker.cargo || ''} ${worker.area || ''} ${siteNameById(worker.sede_id)} ${projectNameById(worker.proyecto_id)}`.toLowerCase();
    const qOk = !q || searchable.includes(q);

    let unitOk = true;
    if (unit !== 'all') {
      const [type, id] = unit.split(':');
      unitOk = type === 'sede'
        ? worker.sede_id === id
        : type === 'proyecto'
          ? worker.proyecto_id === id
          : true;
    }

    const statusOk = status === 'all' || (status === 'active' ? worker.activo : !worker.activo);
    return qOk && unitOk && statusOk;
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
        <td>${escapeHtml(workerUnitName(worker))}</td>
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

async function loadWorkerProjects() {
  if (!client) return;
  const { data, error } = await client
    .from('proyectos')
    .select('id,codigo,nombre,activo')
    .order('nombre');

  if (error) {
    console.error(error);
    setWorkerMessage('No fue posible cargar los proyectos para los trabajadores.');
    return;
  }

  workerProjectsCache = data || [];
  renderWorkerSiteOptions();
}

async function loadWorkers() {
  if (!client) return;
  if (workersTableBody) workersTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Cargando…</td></tr>`;

  const { data, error } = await client
    .from('trabajadores')
    .select('id,dni,nombres,apellidos,cargo,area,sede_id,proyecto_id,activo,created_at,updated_at')
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
  await Promise.all([loadWorkerSites(), loadWorkerProjects()]);
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
  document.getElementById('workerProject').value = record?.proyecto_id || '';
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
  const proyecto_id = document.getElementById('workerProject').value || null;
  const activo = document.getElementById('workerActive').checked;
  const saveButton = document.getElementById('saveWorkerButton');

  if (!/^\d{8}$/.test(dni)) {
    setWorkerFormMessage('El DNI debe contener exactamente 8 dígitos.');
    return;
  }
  if (!apellidos || !nombres || !cargo || !area) {
    setWorkerFormMessage('Completa apellidos, nombres, puesto y área.');
    return;
  }
  if (!sede_id && !proyecto_id) {
    setWorkerFormMessage('Selecciona una sede o un proyecto para el trabajador.');
    return;
  }
  if (sede_id && proyecto_id) {
    setWorkerFormMessage('Selecciona solo una asignación: sede o proyecto, no ambos.');
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = 'Guardando…';
  setWorkerFormMessage('');

  const payload = { dni, apellidos, nombres, cargo, area, sede_id, proyecto_id, activo };
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
  if (!workerSitesCache.length || !workerProjectsCache.length) {
    await Promise.all([loadWorkerSites(), loadWorkerProjects()]);
  }
  openWorkerModal();
});
document.getElementById('closeWorkerModal')?.addEventListener('click', closeWorkerModal);
document.getElementById('cancelWorkerModal')?.addEventListener('click', closeWorkerModal);
workerModal?.addEventListener('click', e => { if (e.target === workerModal) closeWorkerModal(); });
workerForm?.addEventListener('submit', saveWorker);
workerSearch?.addEventListener('input', renderWorkers);
workerSiteFilter?.addEventListener('change', renderWorkers);
workerStatusFilter?.addEventListener('change', renderWorkers);

document.getElementById('workerSite')?.addEventListener('change', e => {
  if (e.target.value) {
    const project = document.getElementById('workerProject');
    if (project) project.value = '';
  }
});

document.getElementById('workerProject')?.addEventListener('change', e => {
  if (e.target.value) {
    const site = document.getElementById('workerSite');
    if (site) site.value = '';
  }
});

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

function trainingCanDelete(item) {
  if (!scheduleCanManage() || !item) return false;
  const state = normalizeTrainingState(item.estado);
  return ['ACTIVA','BORRADOR'].includes(state);
}

async function deleteTrainingFromSchedule(trainingId) {
  const item = scheduleRecords.find(x => x.id === trainingId);
  if (!item) return;

  if (!trainingCanDelete(item)) {
    alert('Solo se pueden eliminar capacitaciones ACTIVAS o en BORRADOR.');
    return;
  }

  const metrics = trainingMetrics(item);
  const state = normalizeTrainingState(item.estado);
  const details = [
    `Capacitación: ${item.codigo || '—'} · ${item.tema || 'Sin tema'}`,
    `Estado: ${state}`,
    `Participantes registrados: ${metrics.participantCount}`,
    `Preguntas: ${metrics.questionCount}`
  ].join('\n');

  const warning = state === 'ACTIVA'
    ? `Esta capacitación está ACTIVA. Al eliminarla, su enlace dejará de funcionar inmediatamente.\n\n${details}\n\nTambién se eliminarán definitivamente participantes, firmas, notas, examen, intentos, respuestas y resultados asociados.\n\n¿Deseas continuar?`
    : `Vas a eliminar definitivamente esta capacitación en BORRADOR.\n\n${details}\n\nTambién se eliminarán sus participantes, firmas, notas, examen, intentos, respuestas y resultados asociados.\n\n¿Deseas continuar?`;

  if (!window.confirm(warning)) return;

  const secondConfirm = window.confirm(
    `CONFIRMACIÓN FINAL\n\n¿Eliminar definitivamente "${item.tema || item.codigo || 'esta capacitación'}"?\n\nEsta acción no se puede deshacer.`
  );
  if (!secondConfirm) return;

  scheduleMessage('Eliminando capacitación…', 'success');

  try {
    const { data, error } = await client.rpc('eliminar_capacitacion', {
      p_capacitacion_id: trainingId
    });

    if (error || !data?.ok) {
      console.error('eliminar_capacitacion', error, data);
      throw new Error(data?.error || error?.message || 'No fue posible eliminar la capacitación.');
    }

    if (selectedTrainingDetailId === trainingId) {
      selectedTrainingDetailId = null;
      selectedTrainingDetailData = null;
      showTrainingLibrary();
    }

    scheduleRecords = [];
    trainingLibraryExams = [];
    trainingLibraryParticipants = [];
    trainingLibraryQuestions = [];

    await loadScheduleModule(true);
    scheduleMessage(`Capacitación ${data.codigo || ''} eliminada correctamente.`, 'success');
  } catch (err) {
    scheduleMessage(err?.message || 'No fue posible eliminar la capacitación.');
  }
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
        ${trainingCanDelete(item) ? `<button class="history-delete-btn" type="button" data-training-delete="${item.id}" title="Eliminar capacitación">Eliminar</button>` : ''}
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
document.getElementById('detailDeleteTrainingButton')?.addEventListener('click', () => { if (selectedTrainingDetailId) deleteTrainingFromSchedule(selectedTrainingDetailId); });
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
  const del = event.target.closest('[data-training-delete]');
  if (del) { deleteTrainingFromSchedule(del.dataset.trainingDelete); return; }
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
  document.getElementById('publicSignatureCard')?.classList.add('hidden');
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
  document.getElementById('publicSignatureCard')?.classList.add('hidden');
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
  document.getElementById('publicSignatureCard')?.classList.remove('hidden');
  resetPublicSignatureCanvas();
  setPublicExamMessage('Datos encontrados correctamente. Registra tu firma para iniciar el examen.', 'success');
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
  document.getElementById('publicSignatureCard')?.classList.add('hidden');
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
  document.getElementById('publicCompletionBox')?.classList.remove('hidden');
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
    setPublicExamMessage('Registra tu firma antes de continuar.', 'error', 'publicSignatureMessage');
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
  if (button) { button.disabled = false; button.textContent = 'Registrar firma y continuar'; }
  if (error || !data?.ok) {
    console.error(error);
    const missing = /guardar_firma_participante_examen|schema cache|function/i.test(error?.message || '');
    setPublicExamMessage(missing ? 'La función de firma todavía no está habilitada. Ejecuta el SQL de la Etapa 8.' : (data?.error || 'No fue posible guardar la firma.'), 'error', 'publicSignatureMessage');
    return;
  }
  setPublicExamMessage('Firma registrada correctamente. Iniciando examen…', 'success', 'publicSignatureMessage');
  setTimeout(() => startPublicExam(), 250);
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
    setPublicExamMessage('Evaluación encontrada. La firma quedó pendiente; regístrala para completar tu participación.', 'success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }
  setPublicExamMessage('Evaluación encontrada.', 'success');
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
// ETAPA 14A · INDUCCIÓN SEDE LIMA
// Programación -> Examen -> Trabajadores
// ============================================================

let inductionRecords = [];
let inductionSites = [];
let inductionProjects = [];
let inductionTypeFilter = 'ALL';

let inductionWizardType = 'LIMA';
let activeInductionId = null;
let inductionQuestionsCache = [];
let inductionWorkersCache = [];
let inductionQuestionEditId = null;
let activeInductionResults = null;
let publicInductionLastAttemptId = null;
let publicInductionApprovedDetail = null;

let inductionSignatureCanvas = null;
let inductionSignatureCtx = null;
let inductionSignatureDrawing = false;
let inductionSignatureHasStroke = false;
let inductionSignatureLastPoint = null;
let inductionSavedSignature = null;

function inductionCanCreate() {
  return ['ADMIN','PROYECTO'].includes(currentProfile?.rol_codigo);
}

function inductionCanManage(item) {
  if (currentProfile?.rol_codigo === 'ADMIN') return true;
  return currentProfile?.rol_codigo === 'PROYECTO' && item?.tipo === 'PROYECTO' && !!item?.proyecto_id;
}

function inductionMessage(message='', type='error') {
  const el = document.getElementById('inductionModuleMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `module-message ${message ? 'visible' : ''} ${type}`;
}

function inductionUnitName(item) {
  if (item?.tipo === 'LIMA') {
    return `Sede · ${inductionSites.find(x=>x.id===item.sede_id)?.nombre || 'Lima'}`;
  }
  return `Proyecto · ${inductionProjects.find(x=>x.id===item.proyecto_id)?.nombre || 'Proyecto'}`;
}

function populateInductionUnitOptions() {
  const site = document.getElementById('inductionSite');
  const project = document.getElementById('projectInductionProject');
  const filter = document.getElementById('inductionUnitFilter');

  if (site) {
    const lima = inductionSites.filter(x => x.activo && String(x.nombre || '').trim().toLowerCase() === 'lima');
    site.innerHTML = '<option value="">Seleccione Lima</option>' +
      lima.map(x => `<option value="${x.id}">${escapeHtml(x.nombre)}</option>`).join('');
  }

  if (project) {
    project.innerHTML = '<option value="">Seleccione un proyecto</option>' +
      inductionProjects.filter(x=>x.activo).map(x => `<option value="${x.id}">${escapeHtml(x.nombre)}</option>`).join('');
  }

  if (filter) {
    filter.innerHTML = '<option value="ALL">Todas las sedes y proyectos</option>' +
      '<option value="LIMA">Sede Lima</option>' +
      inductionProjects.filter(x=>x.activo).map(x => `<option value="PROYECTO:${x.id}">Proyecto · ${escapeHtml(x.nombre)}</option>`).join('');
  }
}

function renderInductions() {
  const search = (document.getElementById('inductionSearch')?.value || '').trim().toLowerCase();
  const unit = document.getElementById('inductionUnitFilter')?.value || 'ALL';
  const status = document.getElementById('inductionStatusFilter')?.value || 'ALL';

  document.getElementById('inductionAllCount').textContent = String(inductionRecords.length);
  document.getElementById('inductionLimaCount').textContent = String(inductionRecords.filter(x=>x.tipo==='LIMA').length);
  document.getElementById('inductionProjectCount').textContent = String(inductionRecords.filter(x=>x.tipo==='PROYECTO').length);
  document.getElementById('newInductionButton')?.classList.toggle('hidden', !inductionCanCreate());

  let rows = inductionRecords.filter(item => {
    if (inductionTypeFilter !== 'ALL' && item.tipo !== inductionTypeFilter) return false;
    if (status !== 'ALL' && item.estado !== status) return false;
    if (unit === 'LIMA' && item.tipo !== 'LIMA') return false;
    if (unit.startsWith('PROYECTO:') && item.proyecto_id !== unit.split(':')[1]) return false;
    const haystack = `${item.codigo||''} ${item.tema||item.titulo||''} ${item.expositor||''} ${item.area||''} ${inductionUnitName(item)}`.toLowerCase();
    return !search || haystack.includes(search);
  });

  const list = document.getElementById('inductionList');
  if (!list) return;

  if (!rows.length) {
    list.innerHTML = '<div class="training-library-empty">No hay inducciones con los filtros seleccionados.</div>';
    return;
  }

  list.innerHTML = rows.map(item => {
    const canManage = inductionCanManage(item);
    return `<article class="induction-card">
      <div class="induction-card-type ${item.tipo === 'LIMA' ? 'lima' : 'project'}"><span>${item.tipo === 'LIMA' ? '⌂' : '◆'}</span></div>
      <div class="induction-card-main">
        <div class="induction-card-head">
          <div>
            <span class="induction-kind">${item.tipo === 'LIMA' ? 'INDUCCIÓN SEDE LIMA' : 'INDUCCIÓN DE PROYECTO'}</span>
            <h3>${escapeHtml(item.tema || item.titulo || 'Sin tema')}</h3>
          </div>
          <span class="schedule-status ${item.estado === 'ACTIVA' ? 'active' : item.estado === 'BORRADOR' ? 'draft' : 'closed'}">${escapeHtml(item.estado)}</span>
        </div>
        <p>${item.expositor ? `<strong>Expositor:</strong> ${escapeHtml(item.expositor)} · ${escapeHtml(item.expositor_cargo || '')}` : escapeHtml(item.descripcion || 'Sin descripción')}</p>
        <div class="induction-card-meta">
          <span>${escapeHtml(item.codigo)}</span>
          <span>${escapeHtml(inductionUnitName(item))}</span>
          <span>${item.tipo==='PROYECTO'
            ? `${formatDatePE(item.fecha_dia1)} - ${formatDatePE(item.fecha_dia4)}`
            : formatDatePE(item.fecha)}</span>
          <span>${item.tipo==='PROYECTO'
            ? '4 días · 8 h/día'
            : (item.tiempo_horas ? `${Number(item.tiempo_horas)} h` : '—')}</span>
          <span>Nota mínima: ${Number(item.nota_minima).toFixed(1).replace('.0','')}</span>
        </div>
      </div>
      <div class="induction-card-actions">
        <button class="induction-results-btn" type="button" data-induction-results="${item.id}">Ver resultados</button>
        ${item.public_token ? `<button class="induction-share-btn" type="button" data-induction-share="${item.id}">Compartir</button>` : ''}
        ${canManage ? `<button class="induction-duplicate-btn" type="button" data-induction-duplicate="${item.id}">Duplicar</button>` : ''}
        ${canManage ? `<button class="secondary-btn" type="button" data-induction-edit="${item.id}">Editar</button>` : ''}
        ${canManage ? `<button class="induction-delete-btn" type="button" data-induction-delete="${item.id}">Eliminar</button>` : ''}
      </div>
    </article>`;
  }).join('');

  list.querySelectorAll('[data-induction-duplicate]').forEach(btn => btn.addEventListener('click', () => {
    duplicateInduction(btn.dataset.inductionDuplicate,btn);
  }));

  list.querySelectorAll('[data-induction-edit]').forEach(btn => btn.addEventListener('click', () => {
    const item = inductionRecords.find(x=>x.id===btn.dataset.inductionEdit);
    openInductionWizard(item);
  }));

  list.querySelectorAll('[data-induction-results]').forEach(btn => btn.addEventListener('click', () => {
    openInductionResults(btn.dataset.inductionResults);
  }));

  list.querySelectorAll('[data-induction-share]').forEach(btn => btn.addEventListener('click', async () => {
    const item = inductionRecords.find(x=>x.id===btn.dataset.inductionShare);
    if (!item?.public_token) return;
    const link = buildInductionPublicLink(item.public_token);
    try {
      await navigator.clipboard.writeText(link);
      inductionMessage('Enlace de inducción copiado correctamente.','success');
    } catch {
      window.prompt('Copia este enlace:', link);
    }
  }));

  list.querySelectorAll('[data-induction-delete]').forEach(btn => btn.addEventListener('click', async () => {
    const item = inductionRecords.find(x=>x.id===btn.dataset.inductionDelete);
    if (!item || !confirm(`¿Eliminar la inducción "${item.tema || item.titulo}"?`)) return;
    const { error } = await client.from('inducciones').delete().eq('id', item.id);
    if (error) { inductionMessage(error.message); return; }
    await loadInductionModule(true);
    inductionMessage('Inducción eliminada correctamente.','success');
  }));
}


async function duplicateInduction(inductionId,button=null) {
  const original=inductionRecords.find(x=>x.id===inductionId);
  if (!original) return;

  const title=original.tema || original.titulo || 'esta inducción';
  const questionCount=inductionQuestionsCache?.length || 0;

  const confirmed=confirm(
    `¿Duplicar "${title}"?\n\n` +
    `Se copiará toda la programación y el examen completo.\n` +
    `NO se copiarán participantes ni resultados.\n` +
    `La nueva inducción quedará en BORRADOR para que edites la fecha y el expositor.`
  );

  if (!confirmed) return;

  const originalText=button?.textContent || '';
  if (button) {
    button.disabled=true;
    button.textContent='Duplicando…';
  }

  inductionMessage('');

  try {
    const {data,error}=await client.rpc('duplicar_induccion',{
      p_induccion_id:inductionId
    });

    if (error || !data?.ok) {
      console.error(error,data);
      throw new Error(
        data?.error ||
        error?.message ||
        'No fue posible duplicar la inducción.'
      );
    }

    await loadInductionModule(true);

    const duplicated=inductionRecords.find(x=>x.id===data.id);
    if (!duplicated) {
      inductionMessage(
        `Inducción duplicada como ${data.codigo}. Edítala para actualizar fecha y expositor.`,
        'success'
      );
      return;
    }

    openInductionWizard(duplicated);

    const msg=document.getElementById('inductionFormMessage');
    if (msg) {
      msg.textContent=
        `Copia creada como ${data.codigo}. Se copiaron ${data.preguntas_copiadas || 0} pregunta(s). ` +
        `Actualiza la fecha y el expositor. La firma del expositor debe registrarse nuevamente.`;
      msg.className='form-message visible success';
    }
  } catch(err) {
    console.error(err);
    inductionMessage(err?.message || 'No fue posible duplicar la inducción.');
  } finally {
    if (button) {
      button.disabled=false;
      button.textContent=originalText;
    }
  }
}

async function loadInductionModule(force=false) {
  if (!client) return;
  if (inductionRecords.length && !force) { renderInductions(); return; }

  inductionMessage('');
  const list = document.getElementById('inductionList');
  if (list) list.innerHTML = '<div class="training-library-empty">Cargando inducciones…</div>';

  const [records, sites, projects] = await Promise.all([
    client.from('inducciones').select('*').order('created_at',{ascending:false}),
    client.from('sedes').select('id,codigo,nombre,activo').order('nombre'),
    client.from('proyectos').select('id,codigo,nombre,activo').order('nombre')
  ]);

  if (records.error) {
    console.error(records.error);
    inductionMessage('No fue posible cargar Inducciones. Ejecuta el SQL de la Etapa 14A.');
    return;
  }

  inductionRecords = records.data || [];
  inductionSites = sites.data || [];
  inductionProjects = projects.data || [];
  populateInductionUnitOptions();
  renderInductions();
}

function setInductionWizardStep(step) {
  [1,2,3].forEach(n => {
    document.getElementById(`inductionStep${n}`)?.classList.toggle('hidden', n !== step);
    document.querySelector(`[data-induction-step-indicator="${n}"]`)?.classList.toggle('active', n === step);
    document.querySelector(`[data-induction-step-indicator="${n}"]`)?.classList.toggle('done', n < step);
  });
}

function setInductionWizardType(type) {
  inductionWizardType = type;
  document.getElementById('inductionChoiceLima')?.classList.toggle('active', type === 'LIMA');
  document.getElementById('inductionChoiceProject')?.classList.toggle('active', type === 'PROYECTO');
  document.getElementById('inductionLimaProgramming')?.classList.toggle('hidden', type !== 'LIMA');
  document.getElementById('inductionProjectProgramming')?.classList.toggle('hidden', type !== 'PROYECTO');
  document.getElementById('saveInductionProgrammingButton')?.classList.remove('hidden');
  document.getElementById('saveInductionProgrammingButton').textContent =
    type === 'PROYECTO' ? 'Registrar 4 días y continuar al examen' : 'Registrar y continuar al examen';
}

function initInductionSignatureCanvas() {
  inductionSignatureCanvas = document.getElementById('inductionSpeakerSignatureCanvas');
  if (!inductionSignatureCanvas) return;
  inductionSignatureCtx = inductionSignatureCanvas.getContext('2d');
  inductionSignatureCtx.lineCap = 'round';
  inductionSignatureCtx.lineJoin = 'round';
  inductionSignatureCtx.lineWidth = 4;
  inductionSignatureCtx.strokeStyle = '#17263c';

  const point = ev => {
    const rect = inductionSignatureCanvas.getBoundingClientRect();
    const touch = ev.touches?.[0] || ev.changedTouches?.[0];
    const clientX = touch ? touch.clientX : ev.clientX;
    const clientY = touch ? touch.clientY : ev.clientY;
    return {
      x:(clientX-rect.left)*(inductionSignatureCanvas.width/rect.width),
      y:(clientY-rect.top)*(inductionSignatureCanvas.height/rect.height)
    };
  };

  const start = ev => {
    ev.preventDefault();
    inductionSignatureDrawing = true;
    inductionSignatureLastPoint = point(ev);
  };

  const move = ev => {
    if (!inductionSignatureDrawing) return;
    ev.preventDefault();
    const p = point(ev);
    inductionSignatureCtx.beginPath();
    inductionSignatureCtx.moveTo(inductionSignatureLastPoint.x,inductionSignatureLastPoint.y);
    inductionSignatureCtx.lineTo(p.x,p.y);
    inductionSignatureCtx.stroke();
    inductionSignatureLastPoint = p;
    inductionSignatureHasStroke = true;
  };

  const end = ev => {
    if (inductionSignatureDrawing) ev.preventDefault();
    inductionSignatureDrawing = false;
    inductionSignatureLastPoint = null;
  };

  inductionSignatureCanvas.onpointerdown = start;
  inductionSignatureCanvas.onpointermove = move;
  inductionSignatureCanvas.onpointerup = end;
  inductionSignatureCanvas.onpointercancel = end;
  inductionSignatureCanvas.onpointerleave = end;
}

function resetInductionSignature() {
  if (!inductionSignatureCanvas || !inductionSignatureCtx) initInductionSignatureCanvas();
  if (!inductionSignatureCanvas || !inductionSignatureCtx) return;
  inductionSignatureCtx.clearRect(0,0,inductionSignatureCanvas.width,inductionSignatureCanvas.height);
  inductionSignatureHasStroke = false;
  inductionSavedSignature = null;
}

function drawSavedInductionSignature(dataUrl) {
  resetInductionSignature();
  if (!dataUrl || !inductionSignatureCanvas || !inductionSignatureCtx) return;
  const img = new Image();
  img.onload = () => {
    inductionSignatureCtx.drawImage(img,0,0,inductionSignatureCanvas.width,inductionSignatureCanvas.height);
    inductionSignatureHasStroke = true;
    inductionSavedSignature = dataUrl;
  };
  img.src = dataUrl;
}

async function openInductionWizard(item=null) {
  activeInductionId = item?.id || null;
  document.getElementById('inductionId').value = activeInductionId || '';
  document.getElementById('inductionModalTitle').textContent = item ? 'Editar inducción' : 'Nueva inducción';
  populateInductionUnitOptions();

  setInductionWizardType(item?.tipo || 'LIMA');
  setInductionWizardStep(1);

  document.getElementById('inductionCompany').value = item?.empresa || 'EXPLO DRILLING PERU S.R.L.';
  document.getElementById('inductionContractor').value = item?.contratista === 'N.A.' ? '' : (item?.contratista || '');
  document.getElementById('inductionSite').value = item?.sede_id || '';
  document.getElementById('inductionDistrict').value = item?.distrito || '';
  document.getElementById('inductionProvince').value = item?.provincia || '';
  document.getElementById('inductionTopic').value = item?.tema || item?.titulo || '';
  document.getElementById('inductionSpeaker').value = item?.expositor || '';
  document.getElementById('inductionSpeakerPosition').value = item?.expositor_cargo || '';
  document.getElementById('inductionSpeakerDni').value = item?.expositor_dni || '';
  document.getElementById('inductionDate').value = item?.fecha || new Date().toISOString().slice(0,10);
  document.getElementById('inductionArea').value = item?.area || '';
  document.getElementById('inductionHours').value = item?.tiempo_horas || '';
  document.getElementById('inductionMinGrade').value = item?.nota_minima ?? 14;
  document.getElementById('inductionStatus').value = item?.estado === 'CERRADA' ? 'BORRADOR' : (item?.estado || 'BORRADOR');
  document.getElementById('inductionDescription').value = item?.descripcion || '';

  document.getElementById('projectInductionMiningOwner').value = item?.titular_minero || '';
  document.getElementById('projectInductionProject').value = item?.proyecto_id || '';
  document.getElementById('projectInductionDistrict').value = item?.distrito || '';
  document.getElementById('projectInductionProvince').value = item?.provincia || '';
  document.getElementById('projectInductionSpeaker').value = item?.expositor || '';
  document.getElementById('projectInductionSpeakerPosition').value = item?.expositor_cargo || '';
  document.getElementById('projectInductionSpeakerDni').value = item?.expositor_dni || '';
  document.getElementById('projectInductionArea').value = item?.area || '';
  document.getElementById('projectInductionTopic1').value = item?.tema_dia1 || '';
  document.getElementById('projectInductionTopic2').value = item?.tema_dia2 || '';
  document.getElementById('projectInductionTopic3').value = item?.tema_dia3 || '';
  document.getElementById('projectInductionTopic4').value = item?.tema_dia4 || '';
  document.getElementById('projectInductionDate1').value = item?.fecha_dia1 || '';
  document.getElementById('projectInductionDate2').value = item?.fecha_dia2 || '';
  document.getElementById('projectInductionDate3').value = item?.fecha_dia3 || '';
  document.getElementById('projectInductionDate4').value = item?.fecha_dia4 || '';
  document.getElementById('projectInductionMinGrade').value = item?.nota_minima ?? 14;
  document.getElementById('projectInductionStatus').value = item?.estado === 'CERRADA' ? 'BORRADOR' : (item?.estado || 'BORRADOR');

  document.getElementById('inductionFormMessage').textContent = '';

  initInductionSignatureCanvas();
  if (item?.firma_expositor) drawSavedInductionSignature(item.firma_expositor);
  else resetInductionSignature();

  if (item?.id) {
    await loadInductionQuestions(item.id);
  } else {
    inductionQuestionsCache = [];
  }

  const modal = document.getElementById('inductionModal');
  modal?.classList.remove('hidden');
  modal?.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closeInductionModal() {
  document.getElementById('inductionModal')?.classList.add('hidden');
  document.getElementById('inductionModal')?.setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
}

async function saveInductionProgramming() {
  const msg = document.getElementById('inductionFormMessage');
  const show = (text,type='error') => {
    msg.textContent=text;
    msg.className=`form-message ${text?'visible':''} ${type}`;
  };
  show('');

  if (!inductionSignatureHasStroke && !inductionSavedSignature) {
    show('Registra la firma del expositor.');
    return;
  }

  const firma_expositor = inductionSignatureHasStroke
    ? inductionSignatureCanvas.toDataURL('image/png')
    : inductionSavedSignature;

  let payload={};

  if (inductionWizardType === 'LIMA') {
    const empresa='EXPLO DRILLING PERU S.R.L.';
    const contratista=document.getElementById('inductionContractor').value.trim() || 'N.A.';
    const sede_id=document.getElementById('inductionSite').value || null;
    const distrito=document.getElementById('inductionDistrict').value.trim();
    const provincia=document.getElementById('inductionProvince').value.trim();
    const tema=document.getElementById('inductionTopic').value.trim();
    const expositor=document.getElementById('inductionSpeaker').value.trim();
    const expositor_cargo=document.getElementById('inductionSpeakerPosition').value.trim();
    const expositor_dni=document.getElementById('inductionSpeakerDni').value.replace(/\D/g,'').slice(0,8);
    const fecha=document.getElementById('inductionDate').value;
    const area=document.getElementById('inductionArea').value.trim();
    const tiempo_horas=Number(document.getElementById('inductionHours').value);
    const nota_minima=Number(document.getElementById('inductionMinGrade').value);
    const estado=document.getElementById('inductionStatus').value;
    const descripcion=document.getElementById('inductionDescription').value.trim() || null;

    if (!sede_id || !distrito || !provincia || !tema || !expositor || !expositor_cargo || !fecha || !area) {
      show('Completa todos los campos obligatorios.');
      return;
    }
    if (!/^\d{8}$/.test(expositor_dni)) {
      show('El DNI del expositor debe tener 8 dígitos.');
      return;
    }
    if (!Number.isFinite(tiempo_horas) || tiempo_horas<=0) {
      show('Ingresa el tiempo de la inducción en horas.');
      return;
    }
    if (!Number.isFinite(nota_minima) || nota_minima<0 || nota_minima>20) {
      show('La nota mínima debe estar entre 0 y 20.');
      return;
    }

    payload={
      tipo:'LIMA',
      titulo:tema,
      tema,
      empresa,
      contratista,
      sede_id,
      proyecto_id:null,
      titular_minero:null,
      unidad_produccion:null,
      distrito,
      provincia,
      expositor,
      expositor_cargo,
      expositor_dni,
      fecha,
      area,
      tiempo_horas,
      firma_expositor,
      nota_minima,
      estado,
      descripcion,
      tema_dia1:null,tema_dia2:null,tema_dia3:null,tema_dia4:null,
      fecha_dia1:null,fecha_dia2:null,fecha_dia3:null,fecha_dia4:null
    };
  } else {
    const titular_minero=document.getElementById('projectInductionMiningOwner').value.trim();
    const proyecto_id=document.getElementById('projectInductionProject').value || null;
    const project=inductionProjects.find(x=>x.id===proyecto_id);
    const unidad_produccion=project?.nombre || '';
    const distrito=document.getElementById('projectInductionDistrict').value.trim();
    const provincia=document.getElementById('projectInductionProvince').value.trim();
    const expositor=document.getElementById('projectInductionSpeaker').value.trim();
    const expositor_cargo=document.getElementById('projectInductionSpeakerPosition').value.trim();
    const expositor_dni=document.getElementById('projectInductionSpeakerDni').value.replace(/\D/g,'').slice(0,8);
    const area=document.getElementById('projectInductionArea').value.trim();
    const tema_dia1=document.getElementById('projectInductionTopic1').value.trim();
    const tema_dia2=document.getElementById('projectInductionTopic2').value.trim();
    const tema_dia3=document.getElementById('projectInductionTopic3').value.trim();
    const tema_dia4=document.getElementById('projectInductionTopic4').value.trim();
    const fecha_dia1=document.getElementById('projectInductionDate1').value;
    const fecha_dia2=document.getElementById('projectInductionDate2').value;
    const fecha_dia3=document.getElementById('projectInductionDate3').value;
    const fecha_dia4=document.getElementById('projectInductionDate4').value;
    const nota_minima=Number(document.getElementById('projectInductionMinGrade').value);
    const estado=document.getElementById('projectInductionStatus').value;

    if (!titular_minero || !proyecto_id || !distrito || !provincia || !expositor || !expositor_cargo ||
        !area || !tema_dia1 || !tema_dia2 || !tema_dia3 || !tema_dia4 ||
        !fecha_dia1 || !fecha_dia2 || !fecha_dia3 || !fecha_dia4) {
      show('Completa todos los campos obligatorios de la inducción de proyecto.');
      return;
    }
    if (!/^\d{8}$/.test(expositor_dni)) {
      show('El DNI del expositor debe tener 8 dígitos.');
      return;
    }
    if (!Number.isFinite(nota_minima) || nota_minima<0 || nota_minima>20) {
      show('La nota mínima debe estar entre 0 y 20.');
      return;
    }

    const dates=[fecha_dia1,fecha_dia2,fecha_dia3,fecha_dia4].map(x=>new Date(`${x}T00:00:00`));
    for (let i=1;i<dates.length;i++) {
      if (!(dates[i]>dates[i-1])) {
        show(`La Fecha Día ${i+1} debe ser posterior a la Fecha Día ${i}.`);
        return;
      }
    }

    const tema=`Inducción de Proyecto - ${unidad_produccion}`;

    payload={
      tipo:'PROYECTO',
      titulo:tema,
      tema,
      empresa:'EXPLO DRILLING PERU S.R.L.',
      contratista:'EXPLO DRILLING PERU S.R.L.',
      sede_id:null,
      proyecto_id,
      titular_minero,
      unidad_produccion,
      distrito,
      provincia,
      expositor,
      expositor_cargo,
      expositor_dni,
      fecha:fecha_dia1,
      area,
      tiempo_horas:32,
      firma_expositor,
      nota_minima,
      estado,
      descripcion:`Inducción específica de proyecto de 4 días para ${unidad_produccion}.`,
      tema_dia1,tema_dia2,tema_dia3,tema_dia4,
      fecha_dia1,fecha_dia2,fecha_dia3,fecha_dia4,
      tiempo_dia1:8,tiempo_dia2:8,tiempo_dia3:8,tiempo_dia4:8
    };
  }

  let result;
  if (activeInductionId) {
    result=await client.from('inducciones').update(payload).eq('id',activeInductionId).select().single();
  } else {
    payload.created_by=currentProfile?.id || null;
    result=await client.from('inducciones').insert(payload).select().single();
  }

  if (result.error) {
    console.error(result.error);
    show(result.error.message);
    return;
  }

  activeInductionId=result.data.id;
  document.getElementById('inductionId').value=activeInductionId;
  inductionSavedSignature=firma_expositor;
  await loadInductionQuestions(activeInductionId);
  setInductionWizardStep(2);
}

async function loadInductionQuestions(inductionId) {
  const { data,error } = await client
    .from('induccion_preguntas')
    .select('id,induccion_id,orden,enunciado,tipo,peso,explicacion,respuestas_aceptadas,activo,induccion_opciones(id,orden,texto,es_correcta)')
    .eq('induccion_id',inductionId)
    .eq('activo',true)
    .order('orden');

  if (error) {
    console.error(error);
    inductionQuestionsCache = [];
    renderInductionQuestions();
    return;
  }

  inductionQuestionsCache = (data||[]).map(q => ({
    ...q,
    opciones:(q.induccion_opciones||[]).sort((a,b)=>a.orden-b.orden)
  }));
  renderInductionQuestions();
}

function renderInductionQuestions() {
  const list = document.getElementById('inductionQuestionList');
  if (!list) return;

  if (!inductionQuestionsCache.length) {
    list.innerHTML = '<div class="training-library-empty">Aún no hay preguntas. Agrega la primera pregunta del examen.</div>';
    return;
  }

  list.innerHTML = inductionQuestionsCache.map((q,index) => `
    <article class="induction-question-card">
      <div>
        <span class="induction-question-number">${index+1}</span>
        <div>
          <strong>${escapeHtml(q.enunciado)}</strong>
          <small>${escapeHtml(inductionQuestionTypeLabel(q.tipo))} · ${Number(q.peso)} punto(s)</small>
          ${q.opciones?.length ? `<div class="induction-question-options">${q.opciones.map((o,i)=>`<span class="${o.es_correcta?'correct':''}">${String.fromCharCode(65+i)}) ${escapeHtml(o.texto)}</span>`).join('')}</div>` : ''}
          ${q.tipo==='RESPUESTA_LIBRE' ? `<div class="induction-free-answer">Respuesta(s) aceptada(s): ${(q.respuestas_aceptadas||[]).map(escapeHtml).join(', ')}</div>` : ''}
        </div>
      </div>
      <div class="induction-question-actions">
        <button type="button" class="table-link" data-induction-q-edit="${q.id}">Editar</button>
        <button type="button" class="table-action danger" data-induction-q-delete="${q.id}">Eliminar</button>
      </div>
    </article>
  `).join('');

  list.querySelectorAll('[data-induction-q-edit]').forEach(b => b.addEventListener('click',()=>{
    const q=inductionQuestionsCache.find(x=>x.id===b.dataset.inductionQEdit);
    openInductionQuestionModal(q);
  }));

  list.querySelectorAll('[data-induction-q-delete]').forEach(b => b.addEventListener('click',async()=>{
    if (!confirm('¿Eliminar esta pregunta?')) return;
    const {error}=await client.from('induccion_preguntas').delete().eq('id',b.dataset.inductionQDelete);
    if (error) alert(error.message);
    else await loadInductionQuestions(activeInductionId);
  }));
}

function inductionQuestionTypeLabel(type) {
  return {
    OPCION_MULTIPLE:'Opción múltiple',
    VERDADERO_FALSO:'Verdadero / Falso',
    VARIAS_RESPUESTAS:'Varias respuestas',
    RESPUESTA_LIBRE:'Respuesta libre'
  }[type] || type;
}

function renderInductionQuestionAnswerEditor(question=null) {
  const type = document.getElementById('inductionQuestionType').value;
  const box = document.getElementById('inductionQuestionAnswers');
  if (!box) return;

  if (type === 'RESPUESTA_LIBRE') {
    const accepted = Array.isArray(question?.respuestas_aceptadas) ? question.respuestas_aceptadas.join(' | ') : '';
    box.innerHTML = `<label class="induction-free-editor"><span>Respuesta(s) aceptada(s) *</span><input id="inductionAcceptedAnswers" value="${escapeHtml(accepted)}" placeholder="Ej. detener trabajo | paralizar tarea" /><small>Separa varias respuestas aceptadas con |</small></label>`;
    return;
  }

  if (type === 'VERDADERO_FALSO') {
    const correct = question?.opciones?.find(o=>o.es_correcta)?.texto || 'Verdadero';
    box.innerHTML = `
      <div class="induction-answer-editor">
        <p>Marca la respuesta correcta:</p>
        <label><input type="radio" name="inductionCorrectSingle" value="Verdadero" ${correct==='Verdadero'?'checked':''}/><span>Verdadero</span></label>
        <label><input type="radio" name="inductionCorrectSingle" value="Falso" ${correct==='Falso'?'checked':''}/><span>Falso</span></label>
      </div>`;
    return;
  }

  const existing = question?.opciones || [];
  box.innerHTML = `<div class="induction-answer-editor"><p>${type==='VARIAS_RESPUESTAS'?'Marca todas las respuestas correctas:':'Marca la respuesta correcta:'}</p>
    ${[0,1,2,3].map(i => {
      const o=existing[i]||{};
      const inputType=type==='VARIAS_RESPUESTAS'?'checkbox':'radio';
      const name=type==='VARIAS_RESPUESTAS'?'':'name="inductionCorrectSingle"';
      return `<label class="induction-option-row">
        <input type="${inputType}" ${name} class="induction-correct-marker" data-option-index="${i}" ${o.es_correcta?'checked':''}/>
        <b>${String.fromCharCode(65+i)}</b>
        <input class="induction-option-text" data-option-index="${i}" value="${escapeHtml(o.texto||'')}" placeholder="Alternativa ${String.fromCharCode(65+i)}" />
      </label>`;
    }).join('')}
  </div>`;
}

function openInductionQuestionModal(question=null) {
  inductionQuestionEditId = question?.id || null;
  document.getElementById('inductionQuestionId').value = inductionQuestionEditId || '';
  document.getElementById('inductionQuestionModalTitle').textContent = question ? 'Editar pregunta' : 'Nueva pregunta';
  document.getElementById('inductionQuestionText').value = question?.enunciado || '';
  document.getElementById('inductionQuestionType').value = question?.tipo || 'OPCION_MULTIPLE';
  document.getElementById('inductionQuestionWeight').value = question?.peso || 1;
  document.getElementById('inductionQuestionExplanation').value = question?.explicacion || '';
  document.getElementById('inductionQuestionMessage').textContent = '';
  renderInductionQuestionAnswerEditor(question);

  const modal=document.getElementById('inductionQuestionModal');
  modal?.classList.remove('hidden');
  modal?.setAttribute('aria-hidden','false');
}

function closeInductionQuestionModal() {
  document.getElementById('inductionQuestionModal')?.classList.add('hidden');
  document.getElementById('inductionQuestionModal')?.setAttribute('aria-hidden','true');
  inductionQuestionEditId = null;
}

async function saveInductionQuestion() {
  if (!activeInductionId) return;

  const msg=document.getElementById('inductionQuestionMessage');
  const show=(text,type='error')=>{
    msg.textContent=text;
    msg.className=`form-message ${text?'visible':''} ${type}`;
  };
  show('');

  const enunciado=document.getElementById('inductionQuestionText').value.trim();
  const tipo=document.getElementById('inductionQuestionType').value;
  const peso=Number(document.getElementById('inductionQuestionWeight').value);
  const explicacion=document.getElementById('inductionQuestionExplanation').value.trim() || null;

  if (!enunciado) { show('Ingresa la pregunta.'); return; }
  if (!Number.isFinite(peso) || peso<=0) { show('Ingresa un peso válido.'); return; }

  let opciones=[];
  let respuestas_aceptadas=[];

  if (tipo==='RESPUESTA_LIBRE') {
    const raw=(document.getElementById('inductionAcceptedAnswers')?.value||'').trim();
    respuestas_aceptadas=raw.split('|').map(x=>x.trim()).filter(Boolean);
    if (!respuestas_aceptadas.length) { show('Ingresa al menos una respuesta aceptada.'); return; }
  } else if (tipo==='VERDADERO_FALSO') {
    const correct=document.querySelector('input[name="inductionCorrectSingle"]:checked')?.value;
    if (!correct) { show('Selecciona la respuesta correcta.'); return; }
    opciones=[
      {orden:1,texto:'Verdadero',es_correcta:correct==='Verdadero'},
      {orden:2,texto:'Falso',es_correcta:correct==='Falso'}
    ];
  } else {
    const texts=[...document.querySelectorAll('.induction-option-text')].map(x=>x.value.trim());
    if (texts.some(x=>!x)) { show('Completa las cuatro alternativas.'); return; }

    if (tipo==='OPCION_MULTIPLE') {
      const checked=document.querySelector('input[name="inductionCorrectSingle"]:checked');
      if (!checked) { show('Selecciona la respuesta correcta.'); return; }
      const correctIndex=Number(checked.dataset.optionIndex);
      opciones=texts.map((texto,i)=>({orden:i+1,texto,es_correcta:i===correctIndex}));
    } else {
      const markers=[...document.querySelectorAll('.induction-correct-marker')];
      if (!markers.some(x=>x.checked)) { show('Selecciona al menos una respuesta correcta.'); return; }
      opciones=texts.map((texto,i)=>({orden:i+1,texto,es_correcta:!!markers[i]?.checked}));
    }
  }

  const {data,error}=await client.rpc('guardar_pregunta_induccion',{
    p_induccion_id:activeInductionId,
    p_pregunta_id:inductionQuestionEditId || null,
    p_enunciado:enunciado,
    p_tipo:tipo,
    p_peso:peso,
    p_explicacion:explicacion,
    p_opciones:opciones,
    p_respuestas_aceptadas:respuestas_aceptadas
  });

  if (error || !data?.ok) {
    console.error(error,data);
    show(data?.error || error?.message || 'No fue posible guardar la pregunta.');
    return;
  }

  closeInductionQuestionModal();
  await loadInductionQuestions(activeInductionId);
}

function buildInductionPublicLink(token) {
  return `${window.location.origin}${window.location.pathname}?induction=${encodeURIComponent(token)}`;
}

async function loadInductionShareStep() {
  if (!activeInductionId) return;

  const {data,error}=await client
    .from('inducciones')
    .select('id,codigo,public_token,tema,titulo,estado')
    .eq('id',activeInductionId)
    .single();

  if (error) {
    const msg=document.getElementById('inductionWorkersMessage');
    msg.textContent=error.message;
    msg.className='form-message visible error';
    return;
  }

  const link=buildInductionPublicLink(data.public_token);
  document.getElementById('inductionPublicLink').value=link;
  document.getElementById('inductionShareCode').textContent=data.codigo || '—';
  document.getElementById('inductionShareQuestions').textContent=String(inductionQuestionsCache.length);
  const current=inductionRecords.find(x=>x.id===activeInductionId);
  const title=document.querySelector('#inductionStep3 .induction-public-link-card h4');
  const paragraph=document.querySelector('#inductionStep3 .induction-public-link-card p');
  if (title) title.textContent=current?.tipo==='PROYECTO'
    ? `Inducción de Proyecto - ${current.unidad_produccion || inductionUnitName(current).replace('Proyecto · ','')}`
    : 'Inducción Sede Lima';
  if (paragraph) paragraph.textContent=current?.tipo==='PROYECTO'
    ? 'Al abrir el enlace, el trabajador registrará apellidos y nombres, Registro o DNI, cargo o puesto, fecha de ingreso, área de trabajo y firma; luego desarrollará el examen final correspondiente al Día 4.'
    : 'Al abrir el enlace, el trabajador registrará DNI, nombre, fecha de ingreso, puesto, área y firma; luego pasará directamente al examen.';
}

async function saveInductionExamAndContinue() {
  const msg=document.getElementById('inductionExamMessage');
  if (!inductionQuestionsCache.length) {
    msg.textContent='Agrega al menos una pregunta al examen antes de continuar.';
    msg.className='form-message visible error';
    return;
  }
  msg.textContent='';
  await loadInductionShareStep();
  setInductionWizardStep(3);
}

async function finishInductionAssignment() {
  if (!activeInductionId) return;

  const msg=document.getElementById('inductionWorkersMessage');
  msg.textContent='';
  msg.className='form-message';

  const {error}=await client
    .from('inducciones')
    .update({estado:'ACTIVA'})
    .eq('id',activeInductionId);

  if (error) {
    msg.textContent=error.message;
    msg.className='form-message visible error';
    return;
  }

  closeInductionModal();
  inductionRecords=[];
  await loadInductionModule(true);
  inductionMessage('Inducción activada. Ya puedes compartir el enlace con los trabajadores nuevos.','success');
}

document.getElementById('newInductionButton')?.addEventListener('click', async () => {
  if (!inductionSites.length || !inductionProjects.length) await loadInductionModule(true);
  openInductionWizard();
});
document.getElementById('closeInductionModal')?.addEventListener('click', closeInductionModal);
document.getElementById('cancelInductionModal')?.addEventListener('click', closeInductionModal);
document.getElementById('inductionModal')?.querySelector('.modal-backdrop')?.addEventListener('click', closeInductionModal);

document.getElementById('inductionChoiceLima')?.addEventListener('click',()=>setInductionWizardType('LIMA'));
document.getElementById('inductionChoiceProject')?.addEventListener('click',()=>setInductionWizardType('PROYECTO'));
document.getElementById('saveInductionProgrammingButton')?.addEventListener('click',saveInductionProgramming);
document.getElementById('clearInductionSpeakerSignature')?.addEventListener('click',resetInductionSignature);

document.getElementById('addInductionQuestionButton')?.addEventListener('click',()=>openInductionQuestionModal());
document.getElementById('closeInductionQuestionModal')?.addEventListener('click',closeInductionQuestionModal);
document.getElementById('cancelInductionQuestionModal')?.addEventListener('click',closeInductionQuestionModal);
document.getElementById('inductionQuestionModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closeInductionQuestionModal);
document.getElementById('inductionQuestionType')?.addEventListener('change',()=>renderInductionQuestionAnswerEditor());
document.getElementById('saveInductionQuestionButton')?.addEventListener('click',saveInductionQuestion);

document.getElementById('backInductionStep1')?.addEventListener('click',()=>setInductionWizardStep(1));
document.getElementById('saveInductionExamButton')?.addEventListener('click',saveInductionExamAndContinue);
document.getElementById('backInductionStep2')?.addEventListener('click',()=>setInductionWizardStep(2));
document.getElementById('finishInductionButton')?.addEventListener('click',finishInductionAssignment);

document.getElementById('copyInductionPublicLink')?.addEventListener('click',async()=>{
  const link=document.getElementById('inductionPublicLink')?.value || '';
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
    const msg=document.getElementById('inductionWorkersMessage');
    msg.textContent='Enlace copiado correctamente.';
    msg.className='form-message visible success';
  } catch {
    window.prompt('Copia este enlace:',link);
  }
});
document.getElementById('whatsappInductionPublicLink')?.addEventListener('click',()=>{
  const link=document.getElementById('inductionPublicLink')?.value || '';
  if (!link) return;
  const current=inductionRecords.find(x=>x.id===activeInductionId);
  const text=current?.tipo==='PROYECTO'
    ? `Inducción de Proyecto - ${current.unidad_produccion || 'Explo Drilling Perú'}\n\nRegistra tus datos, firma y desarrolla la evaluación final en el siguiente enlace:\n${link}`
    : `Inducción de ingreso - Explo Drilling Perú\n\nRegistra tus datos, firma y desarrolla tu examen en el siguiente enlace:\n${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank','noopener');
});

document.getElementById('inductionSpeakerDni')?.addEventListener('input',e=>{
  e.target.value=e.target.value.replace(/\D/g,'').slice(0,8);
});
document.getElementById('projectInductionSpeakerDni')?.addEventListener('input',e=>{
  e.target.value=e.target.value.replace(/\D/g,'').slice(0,8);
});

document.getElementById('inductionSearch')?.addEventListener('input',renderInductions);
document.getElementById('inductionUnitFilter')?.addEventListener('change',renderInductions);
document.getElementById('inductionStatusFilter')?.addEventListener('change',renderInductions);
document.getElementById('refreshInductionButton')?.addEventListener('click',()=>{
  inductionRecords=[];
  loadInductionModule(true);
});
document.querySelectorAll('[data-induction-type-filter]').forEach(button=>button.addEventListener('click',()=>{
  inductionTypeFilter=button.dataset.inductionTypeFilter||'ALL';
  document.querySelectorAll('[data-induction-type-filter]').forEach(x=>x.classList.toggle('active',x===button));
  renderInductions();
}));



// ============================================================
// ETAPA 14C · RESULTADOS Y DOCUMENTOS DE INDUCCIÓN
// ============================================================

function inductionDocumentDatePE(value) {
  if (!value) return '—';
  const raw=String(value).slice(0,10);
  const [y,m,d]=raw.split('-');
  if (!y || !m || !d) return formatDatePE(value);
  return `${d}/${m}/${y}`;
}

function inductionPlaceDatePE(place, value) {
  const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const date=value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return `${place || 'Lima'}, —`;
  const day=String(date.getDate()).padStart(2,'0');
  const month=months[date.getMonth()];
  const year=date.getFullYear();
  return `${place || 'Lima'}, ${day} de ${month} del ${year}`;
}

function inductionSafeFile(value,fallback='Documento') {
  const cleaned=String(value||fallback)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^A-Za-z0-9_-]+/g,'_')
    .replace(/^_+|_+$/g,'');
  return cleaned || fallback;
}

function inductionDownloadBlob(bytes,filename) {
  const blob=new Blob([bytes],{type:'application/pdf'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1800);
}

async function getInductionResultDetail(attemptId) {
  const {data,error}=await client.rpc('obtener_detalle_resultado_induccion',{
    p_intento_id:attemptId
  });
  if (error || !data?.ok) {
    console.error(error,data);
    throw new Error(data?.error || error?.message || 'No fue posible obtener el detalle del resultado.');
  }
  return data.detalle;
}

async function openInductionResults(inductionId) {
  activeInductionResults={...(activeInductionResults||{}),induction_id:inductionId};
  const modal=document.getElementById('inductionResultsModal');
  const body=document.getElementById('inductionResultsBody');
  const message=document.getElementById('inductionResultsMessage');

  body.innerHTML='<tr><td colspan="8" class="table-empty">Cargando resultados…</td></tr>';
  message.textContent='';
  message.className='form-message';

  modal?.classList.remove('hidden');
  modal?.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');

  const {data,error}=await client.rpc('obtener_resultados_induccion',{
    p_induccion_id:inductionId
  });

  if (error || !data?.ok) {
    console.error(error,data);
    body.innerHTML='<tr><td colspan="8" class="table-empty">No fue posible cargar los resultados.</td></tr>';
    message.textContent=data?.error || error?.message || 'No fue posible cargar los resultados.';
    message.className='form-message visible error';
    return;
  }

  activeInductionResults={...data,induction_id:inductionId};
  const induction=data.induccion || {};
  const rows=Array.isArray(data.resultados) ? data.resultados : [];

  document.getElementById('inductionResultsTitle').textContent=induction.tema || 'Resultados';
  document.getElementById('inductionResultsSubtitle').textContent=
    `${induction.codigo || ''} · ${induction.sede_nombre || 'Lima'} · Participantes que culminaron la evaluación.`;

  const approved=rows.filter(x=>x.aprobado).length;
  const failed=rows.length-approved;
  const avg=rows.length ? rows.reduce((s,x)=>s+Number(x.nota||0),0)/rows.length : 0;

  document.getElementById('inductionResultsTotal').textContent=String(rows.length);
  document.getElementById('inductionResultsApproved').textContent=String(approved);
  document.getElementById('inductionResultsFailed').textContent=String(failed);
  document.getElementById('inductionResultsAverage').textContent=avg.toFixed(1);

  const isProject=induction.tipo==='PROYECTO';
  document.getElementById('inductionLimaRegisterBar')?.classList.toggle('hidden',isProject);
  document.getElementById('inductionProjectRegisterBar')?.classList.toggle('hidden',!isProject);

  if (!rows.length) {
    body.innerHTML='<tr><td colspan="8" class="table-empty">Todavía no hay trabajadores que hayan culminado esta inducción y evaluación.</td></tr>';
    return;
  }

  body.innerHTML=rows.map(r=>`
    <tr>
      <td><strong>${escapeHtml(r.nombre || '—')}</strong></td>
      <td>${escapeHtml(r.dni || '—')}</td>
      <td>${escapeHtml(inductionDocumentDatePE(r.fecha_ingreso))}</td>
      <td><strong>${escapeHtml(r.puesto || '—')}</strong><br><small>${escapeHtml(r.area || '—')}</small></td>
      <td><strong class="${r.aprobado?'result-pass-text':'result-fail-text'}">${Number(r.nota||0).toFixed(1)}</strong></td>
      <td><span class="induction-result-status ${r.aprobado?'approved':'failed'}">${r.aprobado?'APROBADO':'DESAPROBADO'}</span></td>
      <td>${escapeHtml(formatLongDatePE(r.finalizado_at))}</td>
      <td>
        <div class="induction-result-actions">
          ${r.aprobado ? `<button class="certificate-btn" type="button" data-induction-cert="${r.intento_id}">${isProject?'Anexo 5':'Certificado'}</button>` : ''}
          <button class="result-download-btn" type="button" data-induction-exam="${r.intento_id}">Examen</button>
        </div>
      </td>
    </tr>
  `).join('');

  body.querySelectorAll('[data-induction-cert]').forEach(btn=>btn.addEventListener('click',async()=>{
    await downloadInductionCertificateFromAdmin(btn.dataset.inductionCert,btn);
  }));
  body.querySelectorAll('[data-induction-exam]').forEach(btn=>btn.addEventListener('click',async()=>{
    await downloadInductionExamFromAdmin(btn.dataset.inductionExam,btn);
  }));
}


async function getInductionRegisterData(inductionId) {
  const {data,error}=await client.rpc('obtener_registro_induccion',{
    p_induccion_id:inductionId
  });
  if (error || !data?.ok) {
    console.error(error,data);
    throw new Error(data?.error || error?.message || 'No fue posible obtener el registro de inducción.');
  }
  return data;
}

async function generateInductionRegisterPdf(record,button=null,options={}) {
  if (!window.jspdf?.jsPDF) throw new Error('No se cargó el generador PDF.');

  const original=button?.textContent || '';
  if (button) {
    button.disabled=true;
    button.textContent='Generando PDF…';
  }

  try {
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({
      orientation:'portrait',
      unit:'mm',
      format:'a4',
      compress:true
    });

    const baseInduction=record?.induccion || {};
    const induction={
      ...baseInduction,
      tema:options.tema ?? baseInduction.tema,
      fecha:options.fecha ?? baseInduction.fecha,
      tiempo_horas:options.tiempo_horas ?? baseInduction.tiempo_horas
    };
    const participants=Array.isArray(record?.participantes) ? record.participantes : [];

    let logoData=null;
    try {
      logoData=await imageToDataUrl('assets/logo-explo.jpg');
    } catch(e) {
      console.warn('No se pudo cargar logo',e);
    }

    const BLACK=[18,18,18];
    const WHITE=[255,255,255];
    const RED=[192,0,0];
    const DARKGRAY=[92,92,92];
    const LIGHTGRAY=[218,218,218];

    const x=7;
    const usableW=196;

    const setFont=(size=7,bold=false,color=BLACK)=>{
      doc.setFont('helvetica',bold?'bold':'normal');
      doc.setFontSize(size);
      doc.setTextColor(...color);
    };

    const text=(value,tx,ty,size=7,bold=false,align='left',color=BLACK)=>{
      setFont(size,bold,color);
      doc.text(String(value ?? ''),tx,ty,{align});
    };

    const fitText=(value,tx,ty,maxW,maxSize=7,minSize=4.5,bold=false,align='left',color=BLACK)=>{
      const str=String(value ?? '');
      let size=maxSize;
      doc.setFont('helvetica',bold?'bold':'normal');
      while (size>minSize) {
        doc.setFontSize(size);
        if (doc.getTextWidth(str)<=maxW) break;
        size-=0.25;
      }
      text(str,tx,ty,size,bold,align,color);
    };

    const cell=(cx,cy,cw,ch,opts={})=>{
      const fill=opts.fill || null;
      doc.setDrawColor(...(opts.border || BLACK));
      doc.setLineWidth(opts.lineWidth ?? .18);
      if (fill) {
        doc.setFillColor(...fill);
        doc.rect(cx,cy,cw,ch,'FD');
      } else {
        doc.rect(cx,cy,cw,ch);
      }
    };

    const centerLines=(value,cx,cy,cw,ch,size=6,bold=false,color=BLACK)=>{
      setFont(size,bold,color);
      const lines=doc.splitTextToSize(String(value ?? ''),cw-2);
      const lineH=size*.38;
      const total=(lines.length-1)*lineH;
      const base=cy+(ch/2)-(total/2)+1.2;
      lines.forEach((ln,idx)=>doc.text(ln,cx+cw/2,base+(idx*lineH),{align:'center'}));
    };

    const drawImageContain=(data,cx,cy,cw,ch,type='PNG')=>{
      if (!data) return;
      try {
        doc.addImage(data,type,cx+1,cy+1,cw-2,ch-2,undefined,'FAST');
      } catch(e) {
        console.warn('Imagen no insertada',e);
      }
    };

    const responsibleName=[currentProfile?.nombres,currentProfile?.apellidos].filter(Boolean).join(' ').trim();
    const responsibleCargo=currentProfile?.cargo || '';
    const today=inductionDocumentDatePE(new Date().toISOString());

    const drawPage=(pageParticipants,pageIndex,totalPages)=>{
      let y=7;

      // ------------------------------------------------------
      // CABECERA
      // ------------------------------------------------------
      const headerH=21;
      const logoW=35;
      const centerW=131;
      const metaW=30;

      cell(x,y,logoW,headerH);
      cell(x+logoW,y,centerW,headerH);
      cell(x+logoW+centerW,y,metaW,headerH);

      if (logoData) {
        try { doc.addImage(logoData,'JPEG',x+3,y+3,29,15,undefined,'FAST'); } catch(e){}
      }

      text('SIG - SSOMAC',x+logoW+(centerW/2),y+6.1,8.2,true,'center');

      doc.setFillColor(...RED);
      doc.rect(x+logoW,y+9,centerW,6.2,'F');
      fitText(
        'REGISTRO DE INDUCCION, CAPACITACION, ENTRENAMIENTO Y SIMULACRO DE EMERGENCIA',
        x+logoW+(centerW/2),y+13.15,centerW-3,6.4,4.2,true,'center',WHITE
      );

      const metaX=x+logoW+centerW;
      const metaRows=[
        ['Código:','EDP-SIG-SSOMAC-RE-EA-121'],
        ['N°:','2'],
        ['Versión:','7'],
        ['Fecha Act:','Jul-25']
      ];
      metaRows.forEach(([label,value],idx)=>{
        const rh=headerH/4;
        const ry=y+(idx*rh);
        if (idx>0) doc.line(metaX,ry,metaX+metaW,ry);
        doc.line(metaX+10.5,ry,metaX+10.5,ry+rh);
        fitText(label,metaX+.8,ry+3.4,9,4.6,3.6,true);
        fitText(value,metaX+20.2,ry+3.4,18,4.5,3.2,true,'center');
      });

      if (totalPages>1) {
        text(`Página ${pageIndex+1} de ${totalPages}`,x+usableW-1,y+headerH+3,4.3,false,'right',[90,90,90]);
      }

      y+=headerH;

      // ------------------------------------------------------
      // DATOS DEL EMPLEADOR
      // ------------------------------------------------------
      const employerTitleH=4.5;
      cell(x,y,usableW,employerTitleH);
      text('DATOS DE EMPLEADOR:',x+1.2,y+3.1,5.8,true);
      y+=employerTitleH;

      const empHeaderH=8;
      const empWidths=[39,30,64,32,31];
      const empHeaders=[
        'RAZON O DENOMINACION SOCIAL',
        'RUC',
        'DOMICILIO\n(Dirección, distrito, provincia, dpto.)',
        'ACTIVIDAD ECONOMICA',
        'N° TRABAJADORES EN EL\nCENTRO LABORAL'
      ];
      let cx=x;
      empWidths.forEach((w,idx)=>{
        cell(cx,y,w,empHeaderH,{fill:DARKGRAY});
        centerLines(empHeaders[idx],cx,y,w,empHeaderH,5,true,WHITE);
        cx+=w;
      });
      y+=empHeaderH;

      const empValueH=7;
      const domicilio='Calle Las Acacias I-7, Urb. La Capitana - Huachipa - Lurigancho - Lima';
      const empValues=[
        induction.empresa || 'EXPLO DRILLING PERU S.R.L.',
        '20527775851',
        domicilio,
        'Perforación Diamantina',
        ''
      ];
      cx=x;
      empWidths.forEach((w,idx)=>{
        cell(cx,y,w,empValueH);
        centerLines(empValues[idx],cx,y,w,empValueH,4.8,false,BLACK);
        cx+=w;
      });
      y+=empValueH;

      // ------------------------------------------------------
      // CLASIFICACIÓN + DATOS DE LA INDUCCIÓN
      // ------------------------------------------------------
      const classW=36;
      const detailsW=usableW-classW;
      const detailsLeftW=112;
      const detailsRightW=detailsW-detailsLeftW;
      const detailsH=36;

      cell(x,y,classW,detailsH);
      text('CLASIFICACIÓN',x+1.5,y+4,5.6,true);

      const classifications=[
        ['INDUCCIÓN',true],
        ['CAPACITACIÓN',false],
        ['ENTRENAMIENTO',false],
        ['SIMULACRO DE EMERGENCIA',false],
        ['VISITANTES',false],
        ['RE-INDUCCIÓN',false],
        ['CAMBIO DE PUESTO',false],
        ['REUNIÓN',false],
        ['OTROS',false]
      ];
      let classY=y+7;
      classifications.forEach(([label,checked])=>{
        doc.setLineWidth(.18);
        doc.rect(x+2,classY-2.2,2.6,2.6);
        if (checked) {
          setFont(6,true,BLACK);
          doc.text('X',x+3.3,classY+.05,{align:'center'});
        }
        fitText(label,x+6,classY,27,4.6,3.8,checked);
        classY+=3.05;
      });

      const detailRows=[
        ['TEMA:',induction.tema || ''],
        ['EXPOSITOR:',induction.expositor || ''],
        ['CARGO:',induction.expositor_cargo || ''],
        ['EMPRESA:',induction.empresa || 'EXPLO DRILLING PERU S.R.L.'],
        ['ÁREA:',induction.area || '']
      ];
      const detailRowH=detailsH/5;
      detailRows.forEach(([label,value],idx)=>{
        const ry=y+(idx*detailRowH);
        cell(x+classW,ry,detailsLeftW,detailRowH);
        fitText(label,x+classW+1,ry+4.4,19,5.1,4.2,true);
        fitText(value,x+classW+22,ry+4.4,detailsLeftW-24,5.3,3.8,false);
      });

      const rx=x+classW+detailsLeftW;
      const rightRows=[
        ['FIRMA:',null],
        ['DNI:',induction.expositor_dni || ''],
        ['FECHA:',inductionDocumentDatePE(induction.fecha)],
        ['TIEMPO:',induction.tiempo_horas ? `${Number(induction.tiempo_horas)} hora${Number(induction.tiempo_horas)===1?'':'s'}` : '']
      ];
      const rightRowH=detailsH/4;
      rightRows.forEach(([label,value],idx)=>{
        const ry=y+(idx*rightRowH);
        cell(rx,ry,detailsRightW,rightRowH);
        fitText(label,rx+1,ry+5.2,13,5.1,4,true);
        if (idx===0) {
          drawImageContain(induction.firma_expositor,rx+15,ry+.5,detailsRightW-16,rightRowH-1,'PNG');
        } else {
          fitText(value,rx+15,ry+5.2,detailsRightW-17,5,3.7,false);
        }
      });
      y+=detailsH;

      // ------------------------------------------------------
      // PARTICIPANTES
      // ------------------------------------------------------
      const tableHeaderH=7;
      const rowH=6.55;
      const colWidths=[5,60,17,47,19,48];
      const headers=['N°','APELLIDOS Y NOMBRES','N° DNI','PUESTO DE TRABAJO','AREA','FIRMA'];

      cx=x;
      colWidths.forEach((w,idx)=>{
        cell(cx,y,w,tableHeaderH,{fill:DARKGRAY});
        centerLines(headers[idx],cx,y,w,tableHeaderH,5.1,true,WHITE);
        cx+=w;
      });
      y+=tableHeaderH;

      for (let localIdx=0; localIdx<20; localIdx++) {
        const p=pageParticipants[localIdx] || null;
        const globalNumber=(pageIndex*20)+localIdx+1;
        cx=x;

        colWidths.forEach((w,colIdx)=>{
          cell(cx,y,w,rowH);
          if (colIdx===0) {
            text(String(globalNumber),cx+w/2,y+4.3,5.1,false,'center');
          } else if (p) {
            if (colIdx===1) fitText(p.nombre || '',cx+1,y+4.25,w-2,4.8,3.5,false);
            if (colIdx===2) fitText(p.dni || '',cx+w/2,y+4.25,w-2,4.7,3.6,false,'center');
            if (colIdx===3) fitText(p.puesto || '',cx+1,y+4.25,w-2,4.6,3.3,false);
            if (colIdx===4) fitText(p.area || '',cx+1,y+4.25,w-2,4.5,3.2,false);
            if (colIdx===5 && p.firma) drawImageContain(p.firma,cx+2,y+.4,w-4,rowH-.8,'PNG');
          }
          cx+=w;
        });
        y+=rowH;
      }

      // ------------------------------------------------------
      // RESPONSABLE DEL REGISTRO
      // ------------------------------------------------------
      const respTitleH=5;
      cell(x,y,usableW,respTitleH,{fill:LIGHTGRAY});
      text('RESPONSABLE DEL REGISTRO',x+usableW/2,y+3.5,5.8,true,'center');
      y+=respTitleH;

      const respRowH=6.2;
      const leftResp=116;
      const rightResp=usableW-leftResp;

      cell(x,y,leftResp,respRowH);
      cell(x+leftResp,y,rightResp,respRowH);
      text('NOMBRE:',x+1,y+4.1,4.8,true);
      fitText(responsibleName,x+18,y+4.1,leftResp-20,4.8,3.4,false);
      text('FIRMA:',x+leftResp+1,y+4.1,4.8,true);
      y+=respRowH;

      cell(x,y,leftResp,respRowH);
      cell(x+leftResp,y,rightResp,respRowH);
      text('CARGO:',x+1,y+4.1,4.8,true);
      fitText(responsibleCargo,x+18,y+4.1,leftResp-20,4.8,3.4,false);
      text('FECHA:',x+leftResp+1,y+4.1,4.8,true);
      fitText(today,x+leftResp+17,y+4.1,rightResp-19,4.8,3.6,false);
    };

    const pageCount=Math.max(1,Math.ceil(participants.length/20));
    for (let pageIndex=0; pageIndex<pageCount; pageIndex++) {
      if (pageIndex>0) doc.addPage();
      drawPage(participants.slice(pageIndex*20,(pageIndex+1)*20),pageIndex,pageCount);
    }

    const code=inductionSafeFile(induction.codigo,'INDUCCION');
    const suffix=options.filenameSuffix ? `_${inductionSafeFile(options.filenameSuffix,'Registro')}` : '';
    doc.save(`${code}_Registro_Induccion${suffix}.pdf`);
  } finally {
    if (button) {
      button.disabled=false;
      button.textContent=original;
    }
  }
}

async function downloadCurrentInductionRegister(button) {
  try {
    const inductionId=activeInductionResults?.induction_id || activeInductionResults?.induccion?.id;
    if (!inductionId) throw new Error('No se pudo identificar la inducción.');
    const record=await getInductionRegisterData(inductionId);
    await generateInductionRegisterPdf(record,button);
  } catch(err) {
    console.error(err);
    alert(err?.message || 'No fue posible generar el registro de inducción.');
  }
}

document.getElementById('downloadInductionRegisterPdf')?.addEventListener('click',e=>{
  downloadCurrentInductionRegister(e.currentTarget);
});


async function downloadProjectDailyRegister(day,button) {
  try {
    const inductionId=activeInductionResults?.induction_id || activeInductionResults?.induccion?.id;
    if (!inductionId) throw new Error('No se pudo identificar la inducción.');
    const record=await getInductionRegisterData(inductionId);
    const i=record.induccion || {};
    if (i.tipo!=='PROYECTO') throw new Error('Este registro corresponde únicamente a inducciones de proyecto.');

    const tema=i[`tema_dia${day}`];
    const fecha=i[`fecha_dia${day}`];
    if (!tema || !fecha) throw new Error(`No se encontraron los datos del Día ${day}.`);

    await generateInductionRegisterPdf(record,button,{
      tema,
      fecha,
      tiempo_horas:8,
      filenameSuffix:`Dia_${day}`
    });
  } catch(err) {
    console.error(err);
    alert(err?.message || `No fue posible generar el Registro Día ${day}.`);
  }
}

async function inductionDataUrlBytes(dataUrl) {
  if (!dataUrl || !dataUrl.includes(',')) return null;
  const base64=dataUrl.split(',')[1];
  const binary=atob(base64);
  const bytes=new Uint8Array(binary.length);
  for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes;
}

async function generateProjectAnexo5Pdf(detail,button=null) {
  if (!window.PDFLib?.PDFDocument) throw new Error('No se cargó el generador PDF.');
  const original=button?.textContent || '';
  if (button) {button.disabled=true;button.textContent='Generando…';}

  try {
    const response=await fetch('assets/anexo5-proyecto.pdf?v=20261011-1',{cache:'no-store'});
    if (!response.ok) throw new Error('No se pudo cargar la plantilla del Anexo N° 5.');

    const input=await response.arrayBuffer();
    const {PDFDocument,StandardFonts,rgb}=window.PDFLib;
    const pdfDoc=await PDFDocument.load(input,{ignoreEncryption:true});
    const form=pdfDoc.getForm();
    const font=await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page=pdfDoc.getPages()[0];

    const i=detail.induccion || {};
    const p=detail.participante || {};

    const values={
      'Text-4kipHSXJk-':String(i.titular_minero || '—'),
      'Text-blq9yDLOib':'EXPLO DRILLING PERU S.R.L.',
      'Text-Gf3YtZRZb2':String(i.unidad_produccion || i.proyecto_nombre || '—'),
      'Text-loJlbNkCWO':String(i.distrito || '—'),
      'Text-bv9xsFb7v8':String(i.provincia || '—'),
      'Text-4iB_eSMh3m':String(p.nombre || '—'),
      'Text-nk_1CkVM8Y':String(p.dni || '—'),
      'Text-d9WIr0uRBE':String(p.puesto || '—'),
      'Text-vZ90jn3Efe':inductionDocumentDatePE(p.fecha_ingreso),
      'Text-GR6FNIhaQk':String(p.area || '—'),
      'Paragraph-nDrY_4SFmc':inductionDocumentDatePE(i.fecha_dia4 || i.fecha)
    };

    for (const [name,value] of Object.entries(values)) {
      try {
        const field=form.getTextField(name);
        field.setText(value);
        let size=10;
        while (size>6 && font.widthOfTextAtSize(value,size)>235) size-=0.25;
        field.setFontSize(size);
      } catch(e) {
        console.warn('Campo PDF no encontrado',name,e);
      }
    }

    form.updateFieldAppearances(font);

    // IMPORTANTE:
    // En el Anexo N° 5 los campos inferiores se dejan en blanco
    // para que el documento sea impreso y firmado físicamente.
    // Por ello NO se inserta:
    // - nombre del expositor / ingeniero supervisor;
    // - firma del expositor;
    // - firma del trabajador.
    // La fecha se mantiene porque forma parte de los datos del registro.

    form.flatten();

    const output=await pdfDoc.save();
    const code=inductionSafeFile(i.codigo,'INDUCCION');
    const name=inductionSafeFile(p.nombre,'Trabajador').slice(0,55);
    inductionDownloadBlob(output,`${code}_Anexo_5_${name}.pdf`);
  } finally {
    if (button) {button.disabled=false;button.textContent=original;}
  }
}

document.querySelectorAll('[data-project-register-day]').forEach(button=>{
  button.addEventListener('click',()=>{
    downloadProjectDailyRegister(Number(button.dataset.projectRegisterDay),button);
  });
});

function closeInductionResults() {
  document.getElementById('inductionResultsModal')?.classList.add('hidden');
  document.getElementById('inductionResultsModal')?.setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
}

async function generateInductionLimaCertificatePdf(detail,button=null) {
  if (!window.PDFLib?.PDFDocument) throw new Error('No se cargó el generador PDF.');
  const original=button?.textContent || '';
  if (button) {button.disabled=true;button.textContent='Generando…';}

  try {
    const response=await fetch('assets/certificado-lima.pdf?v=20261005-1',{cache:'no-store'});
    if (!response.ok) throw new Error('No se pudo cargar la plantilla Certificado Lima.pdf.');

    const bytes=await response.arrayBuffer();
    const {PDFDocument,StandardFonts}=window.PDFLib;
    const pdfDoc=await PDFDocument.load(bytes,{ignoreEncryption:true});
    const form=pdfDoc.getForm();
    const font=await pdfDoc.embedFont(StandardFonts.Helvetica);

    const i=detail.induccion || {};
    const p=detail.participante || {};
    const a=detail.intento || {};
    const place=String(i.sede_nombre || 'Lima').trim() || 'Lima';
    const completionDate=a.finalizado_at || new Date().toISOString();

    const values={
      'Text-e3_6BUnAN3': String(i.empresa || 'EXPLO DRILLING PERU S.R.L.'),
      'Text-Yej_LtwvqB': String(i.contratista || 'N.A.'),
      'Text-Y1Ix00eq0v': place,
      'Text-t_TtQzoWDk': String(i.distrito || '—'),
      'Text-SKZgr8eYOE': String(i.provincia || '—'),
      'Text-mGu-yDxjy-': String(p.nombre || '—'),
      'Text-7FhzGWY-PR': inductionDocumentDatePE(p.fecha_ingreso),
      'Text-_gDMoLQmhJ': String(p.dni || '—'),
      'Text-BmT6lCfXCl': String(p.puesto || '—'),
      'Text-opjlkmpxWz': String(p.area || '—'),
      'Text-KjzwKQiKHP': inductionPlaceDatePE(place,completionDate),
      'Text-Vj-ytKan6-': String(p.nombre || '—')
    };

    const maxWidths={
      'Text-e3_6BUnAN3':150,
      'Text-Yej_LtwvqB':145,
      'Text-Y1Ix00eq0v':145,
      'Text-t_TtQzoWDk':165,
      'Text-SKZgr8eYOE':158,
      'Text-mGu-yDxjy-':170,
      'Text-7FhzGWY-PR':145,
      'Text-_gDMoLQmhJ':145,
      'Text-BmT6lCfXCl':165,
      'Text-opjlkmpxWz':148,
      'Text-KjzwKQiKHP':230,
      'Text-Vj-ytKan6-':220
    };

    Object.entries(values).forEach(([name,value])=>{
      const field=form.getTextField(name);
      field.setText(value);
      let size=name==='Text-KjzwKQiKHP' ? 10 : 9.5;
      const min=6;
      while (size>min && font.widthOfTextAtSize(value,size)>maxWidths[name]) size-=0.25;
      field.setFontSize(size);
    });

    form.updateFieldAppearances(font);
    form.flatten();

    const output=await pdfDoc.save();
    const code=inductionSafeFile(i.codigo,'INDUCCION');
    const name=inductionSafeFile(p.nombre,'Trabajador').slice(0,55);
    inductionDownloadBlob(output,`${code}_Registro_Induccion_${name}.pdf`);
  } finally {
    if (button) {button.disabled=false;button.textContent=original;}
  }
}

function inductionResponseLabels(question) {
  const response=question.respuesta || {};
  const options=Array.isArray(question.opciones) ? question.opciones : [];

  if (question.tipo==='RESPUESTA_LIBRE') {
    return {
      user:String(response.texto || 'No respondida'),
      correct:(question.respuestas_aceptadas || []).join(' / ') || 'Respuesta libre'
    };
  }

  const selectedIds=Array.isArray(response.seleccionadas) ? response.seleccionadas.map(String) : [];
  const user=options.filter(o=>selectedIds.includes(String(o.id)))
    .map((o,idx)=>`${String.fromCharCode(65+options.indexOf(o))}) ${o.texto}`)
    .join(' / ') || 'No respondida';
  const correct=options.filter(o=>o.es_correcta)
    .map(o=>`${String.fromCharCode(65+options.indexOf(o))}) ${o.texto}`)
    .join(' / ') || '—';
  return {user,correct};
}

async function generateInductionExamPdf(detail,button=null) {
  if (!window.jspdf?.jsPDF) throw new Error('No se cargó el generador PDF.');
  const original=button?.textContent || '';
  if (button) {button.disabled=true;button.textContent='Generando…';}

  try {
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    let logoData=null;
    try {logoData=await imageToDataUrl('assets/logo-explo.jpg');} catch(e) {console.warn(e);}

    const i=detail.induccion || {};
    const p=detail.participante || {};
    const a=detail.intento || {};
    const questions=(detail.preguntas || []).slice().sort((x,y)=>Number(x.orden)-Number(y.orden));

    const BLACK=[20,20,20],GREEN=[0,145,48],RED=[210,35,35],GRAY=[94,101,113],LIGHT=[244,246,248];
    const text=(value,x,y,size=10,bold=false,align='left',color=BLACK)=>{
      doc.setTextColor(...color);
      doc.setFont('helvetica',bold?'bold':'normal');
      doc.setFontSize(size);
      doc.text(String(value??''),x,y,{align});
    };
    const wrapped=(value,x,y,maxWidth,size=9,bold=false,color=BLACK,lineGap=4)=>{
      doc.setTextColor(...color);
      doc.setFont('helvetica',bold?'bold':'normal');
      doc.setFontSize(size);
      const lines=doc.splitTextToSize(String(value??''),maxWidth);
      doc.text(lines,x,y,{lineHeightFactor:1.12});
      return y+(lines.length*lineGap);
    };
    let y=0;
    const ensure=(need=20)=>{
      if (y+need>282) {
        doc.addPage();
        drawHeader(false);
        y=49;
      }
    };
    const drawHeader=(first=true)=>{
      // Cabecera corporativa en tres bloques, siguiendo el formato oficial.
      const x=10;
      const top=8;
      const boxW=190;
      const boxH=33;
      const logoW=31;
      const metaW=39;
      const centerW=boxW-logoW-metaW;
      const centerX=x+logoW+(centerW/2);
      const metaX=x+logoW+centerW;

      doc.setDrawColor(25,25,25);
      doc.setLineWidth(.35);
      doc.rect(x,top,boxW,boxH);
      doc.line(x+logoW,top,x+logoW,top+boxH);
      doc.line(metaX,top,metaX,top+boxH);

      if (logoData) {
        doc.addImage(logoData,'JPEG',x+3.5,top+6.5,24,20,undefined,'FAST');
      }

      text('SIG - SSOMAC',centerX,top+10,10.5,true,'center');
      text('EXAMEN DE INDUCCION PARA PERSONAL NUEVO',centerX,top+22,9.5,true,'center',RED);

      const metaLabelX=metaX+1.8;
      const metaValueX=metaX+12.6;
      const metaRows=[
        ['Código:','EDP-SIG-SSOMAC-EA-121'],
        ['N°:','9'],
        ['Versión:','1'],
        ['Fecha Act:','Julio 2025']
      ];
      metaRows.forEach(([label,value],idx)=>{
        const rowY=top+6.5+(idx*7);
        text(label,metaLabelX,rowY,5.8,false);
        text(value,metaValueX,rowY,5.8,true);
      });

      doc.setLineWidth(.35);
      doc.line(x,top+38,x+boxW,top+38);
      if (first) text('RESOLUCIÓN DEL EXAMEN',105,top+50,12,true,'center');
    };

    drawHeader(true);
    y=70;
    const rows=[
      ['Participante:',p.nombre || '—'],
      ['DNI:',p.dni || '—'],
      ['Curso:',i.tema || 'INDUCCIÓN PARA PERSONAL NUEVO'],
      ['Fecha:',formatLongDatePE(a.finalizado_at || i.fecha)]
    ];
    for (const [label,value] of rows) {
      text(label,14,y,9,true);
      y=wrapped(value,44,y,146,9,false,BLACK,4.1)+1.1;
    }
    y+=3;
    text(`Nota Final: ${Number(a.nota||0).toFixed(1)}`,14,y,11,true,'left',a.aprobado?GREEN:RED);
    y+=6;
    text(`Estado: ${a.aprobado?'APROBADO':'DESAPROBADO'}`,14,y,11,true,'left',a.aprobado?GREEN:RED);
    y+=6;
    text(`Preguntas Correctas: ${a.correctas||0} / ${a.total_preguntas||questions.length}`,14,y,10.5,true);
    y+=9;

    questions.forEach((q,index)=>{
      ensure(34);
      doc.setFillColor(...LIGHT);
      doc.roundedRect(12,y-4,186,6,1.3,1.3,'F');
      y=wrapped(`${index+1}. ${q.enunciado || ''}`,14,y,178,9.4,true,BLACK,4.3)+1;

      const labels=inductionResponseLabels(q);
      y=wrapped(`Tu respuesta: ${labels.user}`,17,y,172,8.2,false,GRAY,3.7)+1;

      if (q.tipo!=='RESPUESTA_LIBRE') {
        const options=Array.isArray(q.opciones)?q.opciones:[];
        const selectedIds=Array.isArray(q.respuesta?.seleccionadas)?q.respuesta.seleccionadas.map(String):[];

        options.forEach((o,oi)=>{
          ensure(8);
          const selected=selectedIds.includes(String(o.id));
          let color=BLACK,bold=false;
          if (o.es_correcta) {color=GREEN;bold=true;}
          else if (selected) {color=RED;bold=true;}
          let line=`${String.fromCharCode(65+oi)}) ${o.texto || ''}`;
          if (selected) line+='  ← tu respuesta';
          y=wrapped(line,20,y,168,8.2,bold,color,3.8)+.4;
        });
      } else {
        ensure(8);
        y=wrapped(`Respuesta esperada: ${labels.correct}`,20,y,166,8.2,true,GREEN,3.8)+1;
      }

      ensure(8);
      text(`Puntos: ${Number(q.puntos_obtenidos||0).toFixed(1).replace('.0','')} / ${Number(q.peso||0).toFixed(1).replace('.0','')}`,17,y+1,8.3,true,'left',q.es_correcta?GREEN:RED);
      y+=8;

      if (q.explicacion) {
        ensure(12);
        y=wrapped(`Retroalimentación: ${q.explicacion}`,17,y,172,7.7,false,GRAY,3.5)+2;
      }
      y+=2;
    });

    ensure(30);
    doc.setDrawColor(225,228,233);doc.line(14,y,196,y);y+=8;
    if (p.firma) {
      text('Firma digital registrada:',14,y,9,true);
      try {doc.addImage(p.firma,'PNG',54,y-8,42,16,undefined,'FAST');} catch(e){console.warn(e);}
      y+=13;
    }
    text(`Nombre: ${p.nombre || '—'}`,14,y,8.8);
    y+=5;
    text(`Fecha: ${formatLongDatePE(a.finalizado_at || i.fecha)}`,14,y,8.8);

    const code=inductionSafeFile(i.codigo,'INDUCCION');
    const name=inductionSafeFile(p.nombre,'Trabajador').slice(0,55);
    doc.save(`${code}_Examen_Desarrollado_${name}.pdf`);
  } finally {
    if (button) {button.disabled=false;button.textContent=original;}
  }
}

async function downloadInductionCertificateFromAdmin(attemptId,button) {
  try {
    const detail=await getInductionResultDetail(attemptId);
    if (!detail?.intento?.aprobado) throw new Error('El documento final solo está disponible para participantes aprobados.');
    if (detail?.induccion?.tipo==='PROYECTO') {
      await generateProjectAnexo5Pdf(detail,button);
    } else {
      await generateInductionLimaCertificatePdf(detail,button);
    }
  } catch(err) {
    console.error(err);
    alert(err?.message || 'No fue posible generar el documento final.');
  }
}

async function downloadInductionExamFromAdmin(attemptId,button) {
  try {
    const detail=await getInductionResultDetail(attemptId);
    await generateInductionExamPdf(detail,button);
  } catch(err) {
    console.error(err);
    alert(err?.message || 'No fue posible generar el examen.');
  }
}

document.getElementById('closeInductionResultsModal')?.addEventListener('click',closeInductionResults);
document.getElementById('closeInductionResultsBottom')?.addEventListener('click',closeInductionResults);
document.getElementById('inductionResultsModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closeInductionResults);


// ============================================================
// ETAPA 14B · INDUCCIÓN PÚBLICA PARA TRABAJADORES NUEVOS
// ============================================================

let publicInductionToken = '';
let publicInductionData = null;
let publicInductionParticipantId = null;
let publicInductionSignatureCanvas = null;
let publicInductionSignatureCtx = null;
let publicInductionSignatureDrawing = false;
let publicInductionSignatureHasStroke = false;
let publicInductionLastPoint = null;

async function initializePublicInductionMode(token) {
  publicInductionToken=(token||'').trim();

  document.getElementById('loadingScreen')?.classList.add('hidden');
  document.getElementById('authScreen')?.classList.add('hidden');
  document.getElementById('appShell')?.classList.add('hidden');
  document.getElementById('publicExamScreen')?.classList.add('hidden');
  document.getElementById('publicPracticeScreen')?.classList.add('hidden');
  document.getElementById('publicEvaluationScreen')?.classList.add('hidden');
  document.getElementById('publicInductionScreen')?.classList.remove('hidden');

  const {data,error}=await client.rpc('obtener_induccion_publica',{p_token:publicInductionToken});
  if (error || !data?.ok) {
    console.error(error,data);
    const box=document.getElementById('publicInductionRegistrationMessage');
    box.textContent=data?.error || error?.message || 'No fue posible abrir la inducción.';
    box.className='form-message visible error';
    document.getElementById('publicInductionRegisterButton').disabled=true;
    return;
  }

  publicInductionData=data;
  const i=data.induccion || {};
  const isProject=i.tipo==='PROYECTO';

  document.getElementById('publicInductionTitle').textContent=isProject
    ? `Inducción de Proyecto - ${i.unidad_produccion || i.proyecto_nombre || ''}`
    : (i.tema || 'Inducción Sede Lima');
  document.getElementById('publicInductionCode').textContent=i.codigo || 'Inducción';

  if (isProject) {
    document.getElementById('publicInductionMeta').innerHTML=`
      <div><span>Titular minero</span><strong>${escapeHtml(i.titular_minero || '—')}</strong></div>
      <div><span>Unidad de producción</span><strong>${escapeHtml(i.unidad_produccion || i.proyecto_nombre || '—')}</strong></div>
      ${[1,2,3,4].map(day=>`
        <div class="public-project-day">
          <span>Día ${day} · ${escapeHtml(formatDatePE(i[`fecha_dia${day}`]))} · 8 h</span>
          <strong>${escapeHtml(i[`tema_dia${day}`] || '—')}</strong>
        </div>
      `).join('')}
    `;

    document.getElementById('publicInductionNameLabel').textContent='Trabajador (apellidos y nombres) *';
    document.getElementById('publicInductionDniLabel').textContent='Registro o DNI *';
    document.getElementById('publicInductionPositionLabel').textContent='Cargo o Puesto *';
    document.getElementById('publicInductionEntryDateLabel').textContent='Fecha de ingreso *';
    document.getElementById('publicInductionAreaLabel').textContent='Área de trabajo *';

    document.getElementById('publicInductionNameField').style.order='1';
    document.getElementById('publicInductionDniField').style.order='2';
    document.getElementById('publicInductionPositionField').style.order='3';
    document.getElementById('publicInductionEntryDateField').style.order='4';
    document.getElementById('publicInductionAreaField').style.order='5';
  } else {
    document.getElementById('publicInductionMeta').innerHTML=`
      <div><span>Empresa</span><strong>${escapeHtml(i.empresa || 'EXPLO DRILLING PERU S.R.L.')}</strong></div>
      <div><span>Tema</span><strong>${escapeHtml(i.tema || '—')}</strong></div>
      <div><span>Fecha</span><strong>${escapeHtml(formatDatePE(i.fecha))}</strong></div>
      <div><span>Tiempo</span><strong>${i.tiempo_horas ? `${Number(i.tiempo_horas)} h` : '—'}</strong></div>
    `;

    document.getElementById('publicInductionDniLabel').textContent='DNI *';
    document.getElementById('publicInductionNameLabel').textContent='Nombre *';
    document.getElementById('publicInductionPositionLabel').textContent='Puesto de trabajo u ocupación *';

    document.getElementById('publicInductionDniField').style.order='1';
    document.getElementById('publicInductionNameField').style.order='2';
    document.getElementById('publicInductionEntryDateField').style.order='3';
    document.getElementById('publicInductionPositionField').style.order='4';
    document.getElementById('publicInductionAreaField').style.order='5';
  }

  initPublicInductionSignature();
}
function initPublicInductionSignature() {
  publicInductionSignatureCanvas=document.getElementById('publicInductionSignatureCanvas');
  if (!publicInductionSignatureCanvas) return;
  publicInductionSignatureCtx=publicInductionSignatureCanvas.getContext('2d');
  publicInductionSignatureCtx.lineCap='round';
  publicInductionSignatureCtx.lineJoin='round';
  publicInductionSignatureCtx.lineWidth=4;
  publicInductionSignatureCtx.strokeStyle='#17263c';

  const point=ev=>{
    const rect=publicInductionSignatureCanvas.getBoundingClientRect();
    const touch=ev.touches?.[0] || ev.changedTouches?.[0];
    const clientX=touch ? touch.clientX : ev.clientX;
    const clientY=touch ? touch.clientY : ev.clientY;
    return {
      x:(clientX-rect.left)*(publicInductionSignatureCanvas.width/rect.width),
      y:(clientY-rect.top)*(publicInductionSignatureCanvas.height/rect.height)
    };
  };
  const start=ev=>{ev.preventDefault();publicInductionSignatureDrawing=true;publicInductionLastPoint=point(ev);};
  const move=ev=>{
    if (!publicInductionSignatureDrawing) return;
    ev.preventDefault();
    const p=point(ev);
    publicInductionSignatureCtx.beginPath();
    publicInductionSignatureCtx.moveTo(publicInductionLastPoint.x,publicInductionLastPoint.y);
    publicInductionSignatureCtx.lineTo(p.x,p.y);
    publicInductionSignatureCtx.stroke();
    publicInductionLastPoint=p;
    publicInductionSignatureHasStroke=true;
  };
  const end=ev=>{if(publicInductionSignatureDrawing)ev.preventDefault();publicInductionSignatureDrawing=false;publicInductionLastPoint=null;};

  publicInductionSignatureCanvas.onpointerdown=start;
  publicInductionSignatureCanvas.onpointermove=move;
  publicInductionSignatureCanvas.onpointerup=end;
  publicInductionSignatureCanvas.onpointercancel=end;
  publicInductionSignatureCanvas.onpointerleave=end;
}

function clearPublicInductionSignature() {
  if (!publicInductionSignatureCanvas || !publicInductionSignatureCtx) initPublicInductionSignature();
  if (!publicInductionSignatureCanvas || !publicInductionSignatureCtx) return;
  publicInductionSignatureCtx.clearRect(0,0,publicInductionSignatureCanvas.width,publicInductionSignatureCanvas.height);
  publicInductionSignatureHasStroke=false;
}

async function registerPublicInductionParticipant() {
  const msg=document.getElementById('publicInductionRegistrationMessage');
  const show=(text,type='error')=>{
    msg.textContent=text;
    msg.className=`form-message ${text?'visible':''} ${type}`;
  };
  show('');

  const dni=document.getElementById('publicInductionDni').value.replace(/\D/g,'').slice(0,8);
  const nombre=document.getElementById('publicInductionName').value.trim();
  const fecha=document.getElementById('publicInductionEntryDate').value;
  const puesto=document.getElementById('publicInductionPosition').value.trim();
  const area=document.getElementById('publicInductionArea').value.trim();

  if (!/^\d{8}$/.test(dni)) {show('Ingresa un DNI válido de 8 dígitos.');return;}
  if (!nombre || !fecha || !puesto || !area) {show('Completa todos los campos obligatorios.');return;}
  if (!publicInductionSignatureHasStroke) {show('Registra tu firma para continuar.');return;}

  const button=document.getElementById('publicInductionRegisterButton');
  button.disabled=true;
  button.textContent='Registrando…';

  const firma=publicInductionSignatureCanvas.toDataURL('image/png');
  const {data,error}=await client.rpc('registrar_participante_induccion',{
    p_token:publicInductionToken,
    p_dni:dni,
    p_nombre:nombre,
    p_fecha_ingreso:fecha,
    p_puesto:puesto,
    p_area:area,
    p_firma:firma
  });

  button.disabled=false;
  button.textContent='Registrarme y continuar al examen';

  if (error || !data?.ok) {
    console.error(error,data);
    show(data?.error || error?.message || 'No fue posible completar el registro.');
    return;
  }

  publicInductionParticipantId=data.participante_id;
  startPublicInductionExam(nombre);
}

function startPublicInductionExam(nombre) {
  const questions=publicInductionData?.preguntas || [];
  const i=publicInductionData?.induccion || {};

  document.getElementById('publicInductionRegistrationStep')?.classList.add('hidden');
  document.getElementById('publicInductionResultStep')?.classList.add('hidden');
  document.getElementById('publicInductionExamStep')?.classList.remove('hidden');

  document.getElementById('publicInductionExamParticipant').textContent=nombre || 'Participante';
  document.getElementById('publicInductionExamTopic').textContent=
    i.tipo==='PROYECTO'
      ? `Evaluación final - ${i.unidad_produccion || i.proyecto_nombre || 'Proyecto'}`
      : (i.tema || '—');
  document.getElementById('publicInductionPassGrade').textContent=String(i.nota_minima ?? '—');
  document.getElementById('publicInductionQuestionCount').textContent=String(questions.length);

  renderPublicInductionQuestions(questions);
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderPublicInductionQuestions(questions) {
  const list=document.getElementById('publicInductionQuestionList');
  if (!list) return;

  if (!questions.length) {
    list.innerHTML='<div class="training-library-empty">Esta inducción todavía no tiene preguntas disponibles.</div>';
    return;
  }

  list.innerHTML=questions.map((q,index)=>`
    <article class="public-induction-question" data-induction-public-question="${q.id}" data-question-type="${q.tipo}">
      <div class="public-induction-question-head"><span>Pregunta ${index+1}</span><b>${Number(q.peso)} pt${Number(q.peso)===1?'':'s'}</b></div>
      <h3>${escapeHtml(q.enunciado)}</h3>
      ${renderPublicInductionAnswer(q)}
    </article>
  `).join('');
}

function renderPublicInductionAnswer(q) {
  if (q.tipo==='RESPUESTA_LIBRE') {
    return `<textarea class="public-induction-free-text" rows="4" placeholder="Escribe tu respuesta"></textarea>`;
  }
  const multi=q.tipo==='VARIAS_RESPUESTAS';
  return `<div class="public-induction-options">
    ${(q.opciones||[]).map((o,i)=>`
      <label>
        <input type="${multi?'checkbox':'radio'}" ${multi?'':`name="piq_${q.id}"`} value="${o.id}" />
        <b>${String.fromCharCode(65+i)}</b>
        <span>${escapeHtml(o.texto)}</span>
      </label>
    `).join('')}
  </div>`;
}

async function submitPublicInductionExam(event) {
  event.preventDefault();
  if (!publicInductionParticipantId) return;

  const questions=publicInductionData?.preguntas || [];
  const respuestas=[];
  let missing=false;

  for (const q of questions) {
    const card=document.querySelector(`[data-induction-public-question="${q.id}"]`);
    if (!card) continue;

    if (q.tipo==='RESPUESTA_LIBRE') {
      const text=card.querySelector('textarea')?.value.trim() || '';
      if (!text) missing=true;
      respuestas.push({pregunta_id:q.id,texto:text});
    } else {
      const selected=[...card.querySelectorAll('input:checked')].map(x=>x.value);
      if (!selected.length) missing=true;
      respuestas.push({pregunta_id:q.id,seleccionadas:selected});
    }
  }

  const msg=document.getElementById('publicInductionExamMessage');
  if (missing) {
    msg.textContent='Responde todas las preguntas antes de enviar el examen.';
    msg.className='form-message visible error';
    return;
  }

  msg.textContent='';
  const submit=document.querySelector('#publicInductionExamForm button[type="submit"]');
  submit.disabled=true;
  submit.textContent='Enviando…';

  const {data,error}=await client.rpc('finalizar_examen_induccion',{
    p_token:publicInductionToken,
    p_participante_id:publicInductionParticipantId,
    p_respuestas:respuestas
  });

  submit.disabled=false;
  submit.textContent='Finalizar y enviar examen';

  if (error || !data?.ok) {
    console.error(error,data);
    msg.textContent=data?.error || error?.message || 'No fue posible registrar la evaluación.';
    msg.className='form-message visible error';
    return;
  }

  document.getElementById('publicInductionExamStep')?.classList.add('hidden');
  document.getElementById('publicInductionResultStep')?.classList.remove('hidden');

  const icon=document.getElementById('publicInductionResultIcon');
  icon.textContent=data.aprobado?'✓':'!';
  icon.classList.toggle('fail',!data.aprobado);
  document.getElementById('publicInductionResultTitle').textContent=data.aprobado?'¡Inducción aprobada!':'Inducción completada';
  document.getElementById('publicInductionGrade').innerHTML=`${Number(data.nota).toFixed(1)} <small>/ 20</small>`;
  document.getElementById('publicInductionResultText').textContent=
    `${data.correctas} de ${data.total} respuestas correctas · Nota mínima: ${data.nota_minima}`;
  publicInductionLastAttemptId=data.intento_id || null;
  publicInductionApprovedDetail=null;
  document.getElementById('publicInductionApprovedDocuments')?.classList.toggle('hidden',!data.aprobado);

  const publicType=publicInductionData?.induccion?.tipo;
  const certButton=document.getElementById('publicDownloadInductionCertificate');
  const printStrong=document.querySelector('#publicInductionApprovedDocuments .public-induction-print-message strong');
  const printText=document.querySelector('#publicInductionApprovedDocuments .public-induction-print-message p');
  if (publicType==='PROYECTO') {
    if (certButton) certButton.textContent='Descargar Anexo N° 5';
    if (printStrong) printStrong.textContent='Documentos finales de la inducción de proyecto';
    if (printText) printText.textContent='Descarga e imprime el Anexo N° 5. Los espacios de NOMBRE Y APELLIDOS, FIRMA DEL INGENIERO SUPERVISOR y FIRMA DEL TRABAJADOR se dejan en blanco intencionalmente para que sean completados y firmados físicamente después de imprimir.';
  } else {
    if (certButton) certButton.textContent='Descargar certificado / registro';
  }

  window.scrollTo({top:0,behavior:'smooth'});
}


async function getPublicInductionApprovedDetail() {
  if (publicInductionApprovedDetail) return publicInductionApprovedDetail;
  if (!publicInductionParticipantId || !publicInductionLastAttemptId) {
    throw new Error('No se pudo identificar el resultado aprobado.');
  }

  const {data,error}=await client.rpc('obtener_documentos_induccion_publicos',{
    p_token:publicInductionToken,
    p_participante_id:publicInductionParticipantId,
    p_intento_id:publicInductionLastAttemptId
  });

  if (error || !data?.ok) {
    console.error(error,data);
    throw new Error(data?.error || error?.message || 'No fue posible preparar los documentos.');
  }

  publicInductionApprovedDetail=data.detalle;
  return publicInductionApprovedDetail;
}

async function downloadPublicInductionCertificate(button) {
  try {
    const detail=await getPublicInductionApprovedDetail();
    if (detail?.induccion?.tipo==='PROYECTO') {
      await generateProjectAnexo5Pdf(detail,button);
    } else {
      await generateInductionLimaCertificatePdf(detail,button);
    }
  } catch(err) {
    console.error(err);
    alert(err?.message || 'No fue posible generar el documento.');
  }
}

async function downloadPublicInductionExam(button) {
  try {
    const detail=await getPublicInductionApprovedDetail();
    await generateInductionExamPdf(detail,button);
  } catch(err) {
    console.error(err);
    alert(err?.message || 'No fue posible generar el examen desarrollado.');
  }
}

document.getElementById('publicInductionDni')?.addEventListener('input',e=>{
  e.target.value=e.target.value.replace(/\D/g,'').slice(0,8);
});
document.getElementById('clearPublicInductionSignature')?.addEventListener('click',clearPublicInductionSignature);
document.getElementById('publicInductionRegisterButton')?.addEventListener('click',registerPublicInductionParticipant);
document.getElementById('publicInductionExamForm')?.addEventListener('submit',submitPublicInductionExam);

document.getElementById('publicDownloadInductionCertificate')?.addEventListener('click',e=>downloadPublicInductionCertificate(e.currentTarget));
document.getElementById('publicDownloadInductionExam')?.addEventListener('click',e=>downloadPublicInductionExam(e.currentTarget));


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
  const { data, error } = await client.rpc('listar_preguntas_practica_admin', {
    p_practica_id: practiceId
  });

  if (error || !data?.ok) {
    console.error('listar_preguntas_practica_admin', error, data);
    throw new Error(data?.error || error?.message || 'No fue posible cargar las preguntas del quiz.');
  }

  return data.preguntas || [];
}

async function renderPracticeEditorQuestions() {
  if (!activePracticeId) return;

  const list = document.getElementById('practiceQuestionList');
  if (!list) return;

  list.innerHTML = '<div class="training-library-empty">Cargando preguntas…</div>';

  try {
    const questions = await loadPracticeQuestionsFull(activePracticeId);

    if (!questions.length) {
      list.innerHTML = '<div class="training-library-empty">Aún no hay preguntas. Agrega la primera.</div>';
      return;
    }

    const rec = practiceRecords.find(x => x.id === activePracticeId);
    const canManage = practiceCanManageRecord(rec);

    list.innerHTML = questions.map((q,i) => `<article class="practice-admin-question">
      <div>
        <span class="practice-question-number">${i+1}</span>
        <div>
          <strong>${escapeHtml(q.enunciado)}</strong>
          <div class="practice-admin-options">
            ${(q.opciones || []).map((o,oi)=>`<span class="${o.es_correcta?'correct':''}">${String.fromCharCode(65+oi)}) ${escapeHtml(o.texto)}</span>`).join('')}
          </div>
        </div>
      </div>
      ${canManage ? `<div class="practice-admin-question-actions">
        <button class="table-link" type="button" data-pq-edit="${q.id}">Editar</button>
        <button class="table-action danger" type="button" data-pq-delete="${q.id}">Eliminar</button>
      </div>` : ''}
    </article>`).join('');

    list.querySelectorAll('[data-pq-edit]').forEach(b => b.addEventListener('click', () => {
      const q = questions.find(x => x.id === b.dataset.pqEdit);
      openPracticeQuestionModal(q);
    }));

    list.querySelectorAll('[data-pq-delete]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta pregunta?')) return;

      const { data, error } = await client.rpc('eliminar_pregunta_practica', {
        p_pregunta_id: b.dataset.pqDelete
      });

      if (error || !data?.ok) {
        alert(data?.error || error?.message || 'No fue posible eliminar la pregunta.');
        return;
      }

      await renderPracticeEditorQuestions();
    }));
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div class="training-library-empty error">Error al cargar preguntas: ${escapeHtml(err?.message || 'Error desconocido')}</div>`;
  }
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

async function savePracticeQuestion() {
  if (!client || !activePracticeId) {
    alert('Primero guarda el quiz antes de agregar preguntas.');
    return;
  }

  const questionText = document.getElementById('practiceQuestionText')?.value.trim() || '';
  const optionInputs = [...document.querySelectorAll('.practice-option-input')];
  const options = optionInputs.map(x => x.value.trim());
  const correctIndex = Number(document.querySelector('input[name="practiceCorrectOption"]:checked')?.value ?? -1);
  const msg = document.getElementById('practiceQuestionMessage');
  const submit = document.getElementById('savePracticeQuestionButton');

  const showQuestionMessage = (message, type = 'error') => {
    if (!msg) return;
    msg.textContent = message || '';
    msg.className = `form-message ${message ? 'visible' : ''} ${type}`;
  };

  showQuestionMessage('');

  if (!questionText) {
    showQuestionMessage('Ingresa el enunciado de la pregunta.');
    document.getElementById('practiceQuestionText')?.focus();
    return;
  }

  const missingIndex = options.findIndex(x => !x);
  if (missingIndex >= 0) {
    showQuestionMessage(`Completa la alternativa ${String.fromCharCode(65 + missingIndex)}.`);
    optionInputs[missingIndex]?.focus();
    return;
  }

  if (correctIndex < 0 || correctIndex > 3) {
    showQuestionMessage('Selecciona cuál alternativa es la correcta.');
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
      moduleMessage.textContent = 'Pregunta guardada correctamente.';
      moduleMessage.className = 'module-message visible success';
      setTimeout(() => {
        if (moduleMessage.textContent === 'Pregunta guardada correctamente.') {
          moduleMessage.textContent = '';
          moduleMessage.className = 'module-message';
        }
      }, 2500);
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
document.getElementById('savePracticeQuestionButton')?.addEventListener('click', savePracticeQuestion);
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


// ============================================================
// ETAPA 13 · EVALUACIONES DE PRÁCTICA
// ============================================================

let practiceEvaluationRecords = [];
let practiceEvaluationAttempts = [];
let practiceEvaluationTrainings = [];
let practiceEvaluationSites = [];
let practiceEvaluationProjects = [];
let activePracticeEvaluationId = null;
let practiceEvaluationQuestionEditId = null;
let practiceEvaluationQuestionCache = [];
let practiceEvaluationMode = 'quiz';
let practiceEvaluationResultData = null;

function switchPracticeMode(mode = 'quiz') {
  practiceEvaluationMode = mode;
  const isQuiz = mode === 'quiz';
  document.getElementById('practiceQuizModeButton')?.classList.toggle('active', isQuiz);
  document.getElementById('practiceEvaluationModeButton')?.classList.toggle('active', !isQuiz);
  document.getElementById('practiceListView')?.classList.toggle('hidden', !isQuiz);
  document.getElementById('practiceEditorView')?.classList.add('hidden');
  document.getElementById('evaluationListView')?.classList.toggle('hidden', isQuiz);
  document.getElementById('evaluationEditorView')?.classList.add('hidden');
  document.getElementById('evaluationResultsView')?.classList.add('hidden');
  if (isQuiz) loadPracticeModule();
  else loadPracticeEvaluations();
}

function canManagePracticeEvaluation(record = null) {
  if (currentProfile?.rol_codigo === 'ADMIN') return true;
  return currentProfile?.rol_codigo === 'PROYECTO' && !!record?.proyecto_id;
}

function practiceEvaluationUnitLabel(e) {
  if (e?.proyecto_id) return `Proyecto · ${practiceEvaluationProjects.find(x => x.id === e.proyecto_id)?.nombre || 'Proyecto'}`;
  if (e?.sede_id) return `Sede · ${practiceEvaluationSites.find(x => x.id === e.sede_id)?.nombre || 'Sede'}`;
  return 'Corporativo · Todos';
}

function practiceEvaluationPublicUrl(e) {
  if (!e?.codigo || e.estado !== 'ACTIVA') return '';
  return `${window.location.origin}${window.location.pathname}?evaluation=${encodeURIComponent(e.codigo)}`;
}

function showPracticeEvaluationMessage(message = '', type = 'error') {
  const el = document.getElementById('practiceEvaluationModuleMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `module-message ${message ? 'visible' : ''} ${type}`;
}

async function loadPracticeEvaluations(force = false) {
  if (!client) return;
  if (practiceEvaluationRecords.length && !force) {
    renderPracticeEvaluations();
    return;
  }
  showPracticeEvaluationMessage('');
  const cards = document.getElementById('practiceEvaluationCards');
  if (cards) cards.innerHTML = '<div class="training-library-empty">Cargando evaluaciones…</div>';

  const [evals, attempts, trainings, sites, projects] = await Promise.all([
    client.from('evaluaciones_practica').select('*').order('created_at', { ascending: false }),
    client.from('evaluacion_practica_intentos').select('*').order('finalizado_at', { ascending: false }),
    client.from('capacitaciones').select('id,codigo,tema,fecha').order('fecha', { ascending: false }).limit(300),
    client.from('sedes').select('id,nombre,activo').order('nombre'),
    client.from('proyectos').select('id,nombre,activo').order('nombre')
  ]);

  if (evals.error) {
    console.error(evals.error);
    showPracticeEvaluationMessage('No fue posible cargar Evaluaciones. Ejecuta el SQL de la Etapa 13.');
    return;
  }

  practiceEvaluationRecords = evals.data || [];
  practiceEvaluationAttempts = attempts.error ? [] : (attempts.data || []);
  practiceEvaluationTrainings = trainings.error ? [] : (trainings.data || []);
  practiceEvaluationSites = sites.error ? [] : (sites.data || []);
  practiceEvaluationProjects = projects.error ? [] : (projects.data || []);
  renderPracticeEvaluations();
}

function renderPracticeEvaluations() {
  document.getElementById('newPracticeEvaluationButton')?.classList.toggle('hidden', !['ADMIN','PROYECTO'].includes(currentProfile?.rol_codigo));
  const search = (document.getElementById('practiceEvaluationSearch')?.value || '').trim().toLowerCase();
  const status = document.getElementById('practiceEvaluationStatusFilter')?.value || '';
  const rows = practiceEvaluationRecords.filter(e => {
    if (status && e.estado !== status) return false;
    if (search && !`${e.titulo || ''} ${e.codigo || ''} ${e.tema || ''}`.toLowerCase().includes(search)) return false;
    return true;
  });
  const box = document.getElementById('practiceEvaluationCards');
  if (!box) return;
  if (!rows.length) {
    box.innerHTML = '<div class="training-library-empty">No hay evaluaciones con los filtros seleccionados.</div>';
    return;
  }

  box.innerHTML = rows.map(e => {
    const attempts = practiceEvaluationAttempts.filter(a => a.evaluacion_id === e.id && a.finalizado_at);
    const approved = attempts.filter(a => a.aprobado).length;
    const approval = attempts.length ? Math.round(approved / attempts.length * 100) : 0;
    const avg = attempts.length ? (attempts.reduce((s,a)=>s+Number(a.nota || 0),0) / attempts.length).toFixed(1) : '—';
    const link = practiceEvaluationPublicUrl(e);
    return `<article class="practice-evaluation-card">
      <div class="practice-evaluation-card-main">
        <div class="practice-evaluation-card-title"><div><h3>${escapeHtml(e.titulo)}</h3><p>${escapeHtml(e.tema || '—')} · ${escapeHtml(practiceEvaluationUnitLabel(e))}</p></div><span class="evaluation-state ${e.estado.toLowerCase()}">${escapeHtml(e.estado)}</span></div>
        <div class="practice-evaluation-card-meta"><span>${formatDatePE(e.fecha)}</span><span>Nota mínima ${Number(e.nota_minima).toFixed(1).replace('.0','')}</span><span>${attempts.length} intentos</span><span>${approval}% aprobación</span><span>Promedio ${avg}</span></div>
      </div>
      <div class="practice-evaluation-card-actions">
        ${link ? `<button type="button" class="eval-icon-btn green" data-eval-share="${e.id}" title="Compartir">↗</button><button type="button" class="eval-icon-btn" data-eval-copy="${e.id}" title="Copiar enlace">⧉</button>` : ''}
        <button type="button" class="eval-icon-btn blue" data-eval-results="${e.id}" title="Resultados">▥</button>
        ${canManagePracticeEvaluation(e) ? `<button type="button" class="eval-icon-btn amber" data-eval-edit="${e.id}" title="Editar">✎</button><button type="button" class="eval-icon-btn red" data-eval-delete="${e.id}" title="Eliminar">⌫</button>` : ''}
      </div>
    </article>`;
  }).join('');

  box.querySelectorAll('[data-eval-edit]').forEach(b => b.addEventListener('click', () => openPracticeEvaluationEditor(b.dataset.evalEdit)));
  box.querySelectorAll('[data-eval-results]').forEach(b => b.addEventListener('click', () => openPracticeEvaluationResults(b.dataset.evalResults)));
  box.querySelectorAll('[data-eval-copy]').forEach(b => b.addEventListener('click', async () => {
    const e = practiceEvaluationRecords.find(x => x.id === b.dataset.evalCopy); const link = practiceEvaluationPublicUrl(e); if (!link) return;
    try { await navigator.clipboard.writeText(link); showPracticeEvaluationMessage('Enlace copiado.','success'); } catch { window.prompt('Copia el enlace:', link); }
  }));
  box.querySelectorAll('[data-eval-share]').forEach(b => b.addEventListener('click', () => {
    const e = practiceEvaluationRecords.find(x => x.id === b.dataset.evalShare); const link = practiceEvaluationPublicUrl(e); if (!link) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(`Evaluación: ${e.titulo}\n${link}`)}`,'_blank','noopener');
  }));
  box.querySelectorAll('[data-eval-delete]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('¿Eliminar esta evaluación y todos sus resultados?')) return;
    const { error } = await client.from('evaluaciones_practica').delete().eq('id', b.dataset.evalDelete);
    if (error) alert(error.message); else { practiceEvaluationRecords = []; await loadPracticeEvaluations(true); }
  }));
}

function renderPracticeEvaluationTrainingOptions(selected = '') {
  const sel = document.getElementById('practiceEvaluationTraining');
  if (!sel) return;
  sel.innerHTML = '<option value="">Sin capacitación relacionada</option>' + practiceEvaluationTrainings.map(t => `<option value="${t.id}">${escapeHtml(t.codigo || '')} · ${escapeHtml(t.tema || '')}</option>`).join('');
  sel.value = selected || '';
}

function renderPracticeEvaluationUnitOptions(selected = '') {
  const sel = document.getElementById('practiceEvaluationUnit'); if (!sel) return;
  const options = [];
  if (currentProfile?.rol_codigo === 'ADMIN') {
    options.push('<option value="global">Corporativo · Todos</option>');
    practiceEvaluationSites.filter(s=>s.activo).forEach(s=>options.push(`<option value="sede:${s.id}">Sede · ${escapeHtml(s.nombre)}</option>`));
  }
  practiceEvaluationProjects.filter(p=>p.activo).forEach(p=>options.push(`<option value="proyecto:${p.id}">Proyecto · ${escapeHtml(p.nombre)}</option>`));
  sel.innerHTML = options.join('') || '<option value="">Sin unidades disponibles</option>';
  if (selected && [...sel.options].some(o=>o.value===selected)) sel.value = selected;
}

async function openPracticeEvaluationEditor(id = null) {
  if (!practiceEvaluationRecords.length) await loadPracticeEvaluations();
  const record = id ? practiceEvaluationRecords.find(x => x.id === id) : null;
  if (record && !canManagePracticeEvaluation(record) && currentProfile?.rol_codigo !== 'GERENCIA') return;
  activePracticeEvaluationId = record?.id || null;
  document.getElementById('evaluationListView')?.classList.add('hidden');
  document.getElementById('evaluationResultsView')?.classList.add('hidden');
  document.getElementById('evaluationEditorView')?.classList.remove('hidden');
  document.getElementById('practiceListView')?.classList.add('hidden');
  document.getElementById('practiceEditorView')?.classList.add('hidden');

  document.getElementById('practiceEvaluationId').value = record?.id || '';
  document.getElementById('practiceEvaluationEditorTitle').textContent = record ? 'Editar evaluación' : 'Nueva evaluación';
  document.getElementById('practiceEvaluationEditorCode').textContent = record?.codigo || 'NUEVO';
  document.getElementById('practiceEvaluationTitle').value = record?.titulo || '';
  document.getElementById('practiceEvaluationResponsible').value = record?.responsable || [currentProfile?.nombres,currentProfile?.apellidos].filter(Boolean).join(' ');
  renderPracticeEvaluationTrainingOptions(record?.capacitacion_id || '');
  document.getElementById('practiceEvaluationTopic').value = record?.tema || '';
  const unit = record?.proyecto_id ? `proyecto:${record.proyecto_id}` : (record?.sede_id ? `sede:${record.sede_id}` : 'global');
  renderPracticeEvaluationUnitOptions(unit);
  document.getElementById('practiceEvaluationDate').value = record?.fecha || new Date().toISOString().slice(0,10);
  document.getElementById('practiceEvaluationTime').value = record?.tiempo_max_min || '';
  document.getElementById('practiceEvaluationPassing').value = record?.nota_minima ?? 16;
  document.getElementById('practiceEvaluationAttempts').value = String(record?.max_intentos ?? 0);
  document.getElementById('practiceEvaluationStatus').value = record?.estado || 'BORRADOR';
  document.getElementById('practiceEvaluationDescription').value = record?.descripcion || '';
  document.getElementById('practiceEvaluationRetryFailed').checked = !!record?.reintento_solo_desaprobado;
  document.getElementById('practiceEvaluationShowCorrect').checked = record?.mostrar_correctas_final ?? true;
  document.getElementById('practiceEvaluationShuffleQuestions').checked = record?.mezclar_preguntas ?? true;
  document.getElementById('practiceEvaluationShuffleOptions').checked = record?.mezclar_opciones ?? true;
  document.getElementById('practiceEvaluationShowExplanation').checked = record?.mostrar_explicacion ?? true;
  document.getElementById('practiceEvaluationFormMessage').textContent = '';
  const link = record ? practiceEvaluationPublicUrl(record) : '';
  document.getElementById('copyPracticeEvaluationLinkButton')?.classList.toggle('hidden', !link);
  document.getElementById('whatsappPracticeEvaluationButton')?.classList.toggle('hidden', !link);
  document.getElementById('practiceEvaluationQuestionsPanel')?.classList.toggle('hidden', !record);
  document.getElementById('saveAndReturnPracticeEvaluation')?.classList.toggle('hidden', !record);
  if (record) await renderPracticeEvaluationQuestions();
  window.scrollTo({top:0,behavior:'smooth'});
}

async function savePracticeEvaluation(event) {
  event?.preventDefault();
  const id = document.getElementById('practiceEvaluationId').value || null;
  const title = document.getElementById('practiceEvaluationTitle').value.trim();
  const responsible = document.getElementById('practiceEvaluationResponsible').value.trim();
  const topic = document.getElementById('practiceEvaluationTopic').value.trim();
  const unit = document.getElementById('practiceEvaluationUnit').value;
  const msg = document.getElementById('practiceEvaluationFormMessage');
  if (!title || !responsible || !topic || !unit) { msg.textContent = 'Completa título, responsable, tema y proyecto/sede.'; msg.className='form-message visible error'; return null; }
  let sede_id=null,proyecto_id=null; if(unit.startsWith('sede:'))sede_id=unit.split(':')[1]; if(unit.startsWith('proyecto:'))proyecto_id=unit.split(':')[1];
  const payload = {
    titulo:title,responsable:responsible,capacitacion_id:document.getElementById('practiceEvaluationTraining').value||null,tema:topic,
    sede_id,proyecto_id,fecha:document.getElementById('practiceEvaluationDate').value,
    tiempo_max_min:Number(document.getElementById('practiceEvaluationTime').value)||null,
    nota_minima:Number(document.getElementById('practiceEvaluationPassing').value||16),max_intentos:Number(document.getElementById('practiceEvaluationAttempts').value||0),
    reintento_solo_desaprobado:document.getElementById('practiceEvaluationRetryFailed').checked,
    mostrar_correcta_inmediata:false,
    mostrar_correctas_final:document.getElementById('practiceEvaluationShowCorrect').checked,
    mezclar_preguntas:document.getElementById('practiceEvaluationShuffleQuestions').checked,
    mezclar_opciones:document.getElementById('practiceEvaluationShuffleOptions').checked,
    mostrar_explicacion:document.getElementById('practiceEvaluationShowExplanation').checked,
    descripcion:document.getElementById('practiceEvaluationDescription').value.trim()||null,
    estado:document.getElementById('practiceEvaluationStatus').value,created_by:currentProfile?.id||null
  };
  let res; if(id){delete payload.created_by;res=await client.from('evaluaciones_practica').update(payload).eq('id',id).select().single();}else res=await client.from('evaluaciones_practica').insert(payload).select().single();
  if(res.error){msg.textContent=res.error.message;msg.className='form-message visible error';return null;}
  practiceEvaluationRecords=[]; await loadPracticeEvaluations(true); activePracticeEvaluationId=res.data.id;
  msg.textContent='Evaluación guardada correctamente.';msg.className='form-message visible success';
  await openPracticeEvaluationEditor(res.data.id);
  return res.data;
}

async function loadPracticeEvaluationQuestions() {
  if (!activePracticeEvaluationId) return [];
  const {data,error}=await client.rpc('listar_preguntas_evaluacion_practica',{p_evaluacion_id:activePracticeEvaluationId});
  if(error||!data?.ok) throw new Error(data?.error||error?.message||'No fue posible cargar las preguntas.');
  practiceEvaluationQuestionCache=data.preguntas||[]; return practiceEvaluationQuestionCache;
}

async function renderPracticeEvaluationQuestions() {
  const list=document.getElementById('practiceEvaluationQuestionList'); if(!list)return;
  list.innerHTML='<div class="training-library-empty">Cargando preguntas…</div>';
  try{
    const questions=await loadPracticeEvaluationQuestions(); document.getElementById('practiceEvaluationQuestionCount').textContent=String(questions.length);
    if(!questions.length){list.innerHTML='<div class="training-library-empty">Aún no hay preguntas. Agrega la primera.</div>';return;}
    list.innerHTML=questions.map((q,i)=>`<article class="evaluation-admin-question"><div class="evaluation-admin-question-head"><div><span class="practice-question-number">${i+1}</span><strong>${escapeHtml(q.enunciado)}</strong></div><div class="evaluation-question-tags"><span>${escapeHtml(evaluationQuestionTypeLabel(q.tipo))}</span><span>${escapeHtml(q.nivel_tema)}</span><span>${Number(q.peso)} pts</span></div></div>${q.imagen_url?`<img src="${escapeHtml(q.imagen_url)}" alt="Imagen de pregunta" class="evaluation-question-thumb" />`:''}<div class="evaluation-admin-options">${q.tipo==='FREE_TEXT'?`<span><b>Respuestas aceptadas:</b> ${(q.respuestas_aceptadas||[]).map(escapeHtml).join(' · ')}</span>`:(q.opciones||[]).map((o,oi)=>`<span class="${o.es_correcta?'correct':''}">${String.fromCharCode(65+oi)}) ${escapeHtml(o.texto)}</span>`).join('')}</div>${q.explicacion?`<p class="evaluation-explanation-preview"><b>Explicación:</b> ${escapeHtml(q.explicacion)}</p>`:''}<div class="evaluation-admin-actions"><button type="button" class="table-link" data-epq-edit="${q.id}">Editar</button><button type="button" class="table-action danger" data-epq-delete="${q.id}">Eliminar</button></div></article>`).join('');
    list.querySelectorAll('[data-epq-edit]').forEach(b=>b.addEventListener('click',()=>openPracticeEvaluationQuestionModal(questions.find(q=>q.id===b.dataset.epqEdit))));
    list.querySelectorAll('[data-epq-delete]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('¿Eliminar esta pregunta?'))return;const{data,error}=await client.rpc('eliminar_pregunta_evaluacion_practica',{p_pregunta_id:b.dataset.epqDelete});if(error||!data?.ok)alert(data?.error||error?.message);else await renderPracticeEvaluationQuestions();}));
  }catch(err){list.innerHTML=`<div class="training-library-empty">${escapeHtml(err.message)}</div>`;}
}

function evaluationQuestionTypeLabel(type){return {SINGLE:'Opción múltiple',TRUE_FALSE:'Verdadero / Falso',MULTIPLE:'Varias respuestas',FREE_TEXT:'Respuesta libre'}[type]||type;}

function renderPracticeEvaluationOptionEditor(type='SINGLE',question=null){
  const box=document.getElementById('practiceEvaluationOptionEditor');const free=document.getElementById('practiceEvaluationFreeEditor'); if(!box||!free)return;
  const options=question?.opciones||[];
  free.classList.toggle('hidden',type!=='FREE_TEXT');box.classList.toggle('hidden',type==='FREE_TEXT');
  if(type==='FREE_TEXT'){document.getElementById('practiceEvaluationAcceptedAnswers').value=(question?.respuestas_aceptadas||[]).join('\n');box.innerHTML='';return;}
  const count=type==='TRUE_FALSE'?2:4;const labels=type==='TRUE_FALSE'?['Verdadero','Falso']:['Alternativa A','Alternativa B','Alternativa C','Alternativa D'];
  box.innerHTML=Array.from({length:count},(_,i)=>{const o=options[i]||{};const inputType=type==='MULTIPLE'?'checkbox':'radio';return `<label class="evaluation-option-row"><input type="${inputType}" name="evaluationCorrectOption" value="${i}" ${o.es_correcta?'checked':''} /><span>${type==='TRUE_FALSE'?'':String.fromCharCode(65+i)}</span><input class="evaluation-option-text" data-index="${i}" value="${escapeHtml(o.texto||labels[i])}" ${type==='TRUE_FALSE'?'readonly':''} /></label>`;}).join('');
  if(type!=='MULTIPLE'&&!box.querySelector('input[name="evaluationCorrectOption"]:checked')) box.querySelector('input[name="evaluationCorrectOption"]')?.setAttribute('checked','checked');
}

function openPracticeEvaluationQuestionModal(question=null){
  practiceEvaluationQuestionEditId=question?.id||null;
  document.getElementById('practiceEvaluationQuestionModalTitle').textContent=question?'Editar pregunta':'Nueva pregunta';
  document.getElementById('practiceEvaluationQuestionId').value=question?.id||'';
  document.getElementById('practiceEvaluationQuestionText').value=question?.enunciado||'';
  document.getElementById('practiceEvaluationQuestionType').value=question?.tipo||'SINGLE';
  document.getElementById('practiceEvaluationQuestionLevel').value=question?.nivel_tema||'';
  document.getElementById('practiceEvaluationQuestionWeight').value=question?.peso||1;
  document.getElementById('practiceEvaluationQuestionExplanation').value=question?.explicacion||'';
  document.getElementById('practiceEvaluationQuestionImage').value='';
  const preview=document.getElementById('practiceEvaluationImagePreview');preview.dataset.url=question?.imagen_url||'';preview.innerHTML=question?.imagen_url?`<img src="${escapeHtml(question.imagen_url)}" alt="Vista previa" /><button id="removeEvaluationQuestionImage" type="button">Quitar imagen</button>`:'';
  document.getElementById('removeEvaluationQuestionImage')?.addEventListener('click',()=>{preview.dataset.url='';preview.innerHTML='';});
  renderPracticeEvaluationOptionEditor(question?.tipo||'SINGLE',question);
  document.getElementById('practiceEvaluationQuestionMessage').textContent='';
  const modal=document.getElementById('practiceEvaluationQuestionModal');modal?.classList.remove('hidden');modal?.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');setTimeout(()=>document.getElementById('practiceEvaluationQuestionText')?.focus(),50);
}

function closePracticeEvaluationQuestionModal(){const modal=document.getElementById('practiceEvaluationQuestionModal');modal?.classList.add('hidden');modal?.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');practiceEvaluationQuestionEditId=null;}

async function uploadPracticeEvaluationQuestionImage(file){
  if(!file)return null;if(file.size>5*1024*1024)throw new Error('La imagen no puede superar 5 MB.');
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase();const path=`${activePracticeEvaluationId}/${crypto.randomUUID()}.${ext}`;
  const{error}=await client.storage.from('evaluacion-imagenes').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(error)throw error;
  return client.storage.from('evaluacion-imagenes').getPublicUrl(path).data.publicUrl;
}

async function savePracticeEvaluationQuestion(){
  if(!activePracticeEvaluationId)return;
  const type=document.getElementById('practiceEvaluationQuestionType').value;const msg=document.getElementById('practiceEvaluationQuestionMessage');const button=document.getElementById('savePracticeEvaluationQuestionButton');
  const enunciado=document.getElementById('practiceEvaluationQuestionText').value.trim();const nivel=document.getElementById('practiceEvaluationQuestionLevel').value.trim();const peso=Number(document.getElementById('practiceEvaluationQuestionWeight').value||0);
  if(!enunciado||!nivel||peso<=0){msg.textContent='Completa pregunta, nivel/tema y peso.';msg.className='form-message visible error';return;}
  button.disabled=true;button.textContent='Guardando…';
  try{
    let imageUrl=document.getElementById('practiceEvaluationImagePreview').dataset.url||null;const file=document.getElementById('practiceEvaluationQuestionImage').files?.[0];if(file)imageUrl=await uploadPracticeEvaluationQuestionImage(file);
    let opciones=[];let accepted=[];
    if(type==='FREE_TEXT'){accepted=document.getElementById('practiceEvaluationAcceptedAnswers').value.split('\n').map(x=>x.trim()).filter(Boolean);if(!accepted.length)throw new Error('Agrega al menos una respuesta aceptada.');}
    else{const rows=[...document.querySelectorAll('#practiceEvaluationOptionEditor .evaluation-option-row')];opciones=rows.map((r,i)=>({texto:r.querySelector('.evaluation-option-text').value.trim(),es_correcta:r.querySelector('input[name="evaluationCorrectOption"]').checked}));if(opciones.some(o=>!o.texto))throw new Error('Completa todas las alternativas.');}
    const payload={enunciado,tipo:type,nivel_tema:nivel,explicacion:document.getElementById('practiceEvaluationQuestionExplanation').value.trim(),peso,imagen_url:imageUrl,opciones,respuestas_aceptadas:accepted};
    const{data,error}=await client.rpc('guardar_pregunta_evaluacion_practica',{p_evaluacion_id:activePracticeEvaluationId,p_pregunta_id:practiceEvaluationQuestionEditId||null,p_data:payload});if(error||!data?.ok)throw new Error(data?.error||error?.message||'No se pudo guardar.');
    closePracticeEvaluationQuestionModal();await renderPracticeEvaluationQuestions();
  }catch(err){msg.textContent=err.message;msg.className='form-message visible error';}finally{button.disabled=false;button.textContent='Guardar pregunta';}
}

async function openPracticeEvaluationResults(id){
  if(!practiceEvaluationRecords.length)await loadPracticeEvaluations();const record=practiceEvaluationRecords.find(x=>x.id===id);if(!record)return;activePracticeEvaluationId=id;
  document.getElementById('evaluationListView')?.classList.add('hidden');document.getElementById('evaluationEditorView')?.classList.add('hidden');document.getElementById('evaluationResultsView')?.classList.remove('hidden');
  document.getElementById('evaluationResultsTitle').textContent=record.titulo;
  const attempts=practiceEvaluationAttempts.filter(a=>a.evaluacion_id===id&&a.finalizado_at);const approved=attempts.filter(a=>a.aprobado).length;const avg=attempts.length?attempts.reduce((s,a)=>s+Number(a.nota||0),0)/attempts.length:0;
  document.getElementById('evaluationResultsAttempts').textContent=String(attempts.length);document.getElementById('evaluationResultsApproval').textContent=`${attempts.length?Math.round(approved/attempts.length*100):0}%`;document.getElementById('evaluationResultsAverage').textContent=avg.toFixed(1);document.getElementById('evaluationResultsApproved').textContent=String(approved);
  const body=document.getElementById('evaluationResultsBody');body.innerHTML=attempts.length?attempts.map(a=>`<tr><td>${escapeHtml(a.dni)}</td><td>${escapeHtml(a.apellidos_nombres)}</td><td><strong>${Number(a.nota).toFixed(1)}</strong></td><td><span class="result-status ${a.aprobado?'approved':'failed'}">${a.aprobado?'APROBADO':'DESAPROBADO'}</span></td><td>${a.firma?`<img src="${a.firma}" class="evaluation-signature-thumb" />`:'—'}</td><td><div class="evaluation-action-row"><button type="button" class="eval-row-btn" data-attempt-expand="${a.id}">⌄</button><button type="button" class="eval-row-btn green" data-attempt-pdf="${a.id}">⇩</button></div></td></tr>`).join(''):'<tr><td colspan="6" class="table-empty">Todavía no hay resultados.</td></tr>';
  body.querySelectorAll('[data-attempt-expand]').forEach(b=>b.addEventListener('click',()=>toggleEvaluationAttemptDetail(b.dataset.attemptExpand)));
  body.querySelectorAll('[data-attempt-pdf]').forEach(b=>b.addEventListener('click',()=>downloadPracticeEvaluationAttemptPdf(b.dataset.attemptPdf)));
  await renderPracticeEvaluationGapAnalysis(id);
}

async function loadEvaluationAttemptDetail(attemptId){
  const attempt=practiceEvaluationAttempts.find(a=>a.id===attemptId);if(!attempt)throw new Error('Intento no encontrado.');
  const [questions,responses]=await Promise.all([client.rpc('listar_preguntas_evaluacion_practica',{p_evaluacion_id:attempt.evaluacion_id}),client.from('evaluacion_practica_respuestas').select('*').eq('intento_id',attemptId)]);
  if(questions.error||!questions.data?.ok)throw new Error(questions.data?.error||questions.error?.message||'No se pudo cargar preguntas.');
  if(responses.error)throw responses.error;return{attempt,questions:questions.data.preguntas||[],responses:responses.data||[]};
}

async function toggleEvaluationAttemptDetail(attemptId){
  const box=document.getElementById('evaluationAttemptDetail');if(!box)return;if(box.dataset.attemptId===attemptId&&!box.classList.contains('hidden')){box.classList.add('hidden');box.dataset.attemptId='';return;}
  box.classList.remove('hidden');box.dataset.attemptId=attemptId;box.innerHTML='<div class="training-library-empty">Cargando respuestas…</div>';
  try{const data=await loadEvaluationAttemptDetail(attemptId);box.innerHTML=`<h3>Respuestas · DNI ${escapeHtml(data.attempt.dni)}</h3><div class="evaluation-answer-review-admin">${data.questions.map((q,i)=>{const r=data.responses.find(x=>x.pregunta_id===q.id);const selected=q.tipo==='FREE_TEXT'?(r?.respuesta_texto||'Sin respuesta'):(q.opciones||[]).filter(o=>(r?.opcion_ids||[]).includes(o.id)).map(o=>o.texto).join(', ')||'Sin respuesta';const correct=q.tipo==='FREE_TEXT'?(q.respuestas_aceptadas||[]).join(' / '):(q.opciones||[]).filter(o=>o.es_correcta).map(o=>o.texto).join(', ');return `<article class="${r?.es_correcta?'correct':'wrong'}"><strong>${i+1}. ${escapeHtml(q.enunciado)}</strong><p>Respuesta: ${escapeHtml(selected)}</p><p>Correcta: ${escapeHtml(correct)}</p>${q.explicacion?`<small>${escapeHtml(q.explicacion)}</small>`:''}</article>`;}).join('')}</div>`;}catch(err){box.innerHTML=`<div class="training-library-empty">${escapeHtml(err.message)}</div>`;}
}

async function renderPracticeEvaluationGapAnalysis(evalId){
  const box=document.getElementById('evaluationGapAnalysis');if(!box)return;const attempts=practiceEvaluationAttempts.filter(a=>a.evaluacion_id===evalId&&a.finalizado_at);if(!attempts.length){box.innerHTML='<div class="training-library-empty">Sin datos todavía.</div>';return;}
  const ids=attempts.map(a=>a.id);const [qres,rres]=await Promise.all([client.rpc('listar_preguntas_evaluacion_practica',{p_evaluacion_id:evalId}),client.from('evaluacion_practica_respuestas').select('intento_id,pregunta_id,es_correcta').in('intento_id',ids)]);if(qres.error||!qres.data?.ok||rres.error){box.innerHTML='<div class="training-library-empty">No se pudo calcular brechas.</div>';return;}
  const qmap=new Map((qres.data.preguntas||[]).map(q=>[q.id,q]));const stats=new Map();(rres.data||[]).forEach(r=>{const q=qmap.get(r.pregunta_id);if(!q)return;const key=q.nivel_tema||'General';if(!stats.has(key))stats.set(key,{total:0,errors:0});const s=stats.get(key);s.total++;if(!r.es_correcta)s.errors++;});const rows=[...stats.entries()].map(([tema,s])=>({tema,pct:s.total?Math.round(s.errors/s.total*100):0})).sort((a,b)=>b.pct-a.pct||a.tema.localeCompare(b.tema));box.innerHTML=rows.map(x=>`<div class="evaluation-gap-row"><div><span>${escapeHtml(x.tema)}</span><strong>${x.pct}% error</strong></div><div><i style="width:${x.pct}%"></i></div></div>`).join('');
}

async function downloadPracticeEvaluationAttemptPdf(attemptId){
  if(!window.jspdf?.jsPDF)return alert('No se cargó el generador PDF.');
  try{const data=await loadEvaluationAttemptDetail(attemptId);const record=practiceEvaluationRecords.find(x=>x.id===data.attempt.evaluacion_id);const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});let logo=null;try{logo=await imageToDataUrl('assets/logo-explo.jpg');}catch{}
    if(logo)doc.addImage(logo,'JPEG',14,10,28,16);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('SIG - SSOMAC',105,16,{align:'center'});doc.setFontSize(16);doc.text('EVALUACIÓN DE PRÁCTICA',105,25,{align:'center'});doc.setFontSize(8);doc.text(`Código: ${record?.codigo||'—'}`,150,15);doc.line(14,32,196,32);doc.setFontSize(13);doc.text('RESOLUCIÓN DE LA EVALUACIÓN',105,41,{align:'center'});doc.setFontSize(9);doc.setFont('helvetica','normal');let y=52;[['Participante',data.attempt.apellidos_nombres],['DNI',data.attempt.dni],['Tema',record?.tema||'—'],['Fecha',formatDatePE(record?.fecha)],['Nota',Number(data.attempt.nota).toFixed(1)],['Estado',data.attempt.aprobado?'APROBADO':'DESAPROBADO']].forEach(([k,v])=>{doc.setFont('helvetica','bold');doc.text(`${k}:`,18,y);doc.setFont('helvetica','normal');doc.text(String(v),48,y);y+=6;});y+=4;
    for(let i=0;i<data.questions.length;i++){const q=data.questions[i];const r=data.responses.find(x=>x.pregunta_id===q.id);if(y>270){doc.addPage();y=18;}doc.setFont('helvetica','bold');doc.setFontSize(9);const qLines=doc.splitTextToSize(`${i+1}. ${q.enunciado}`,170);doc.text(qLines,18,y);y+=qLines.length*4+2;const selected=q.tipo==='FREE_TEXT'?(r?.respuesta_texto||'Sin respuesta'):(q.opciones||[]).filter(o=>(r?.opcion_ids||[]).includes(o.id)).map(o=>o.texto).join(', ')||'Sin respuesta';const correct=q.tipo==='FREE_TEXT'?(q.respuestas_aceptadas||[]).join(' / '):(q.opciones||[]).filter(o=>o.es_correcta).map(o=>o.texto).join(', ');doc.setFont('helvetica','normal');doc.setFontSize(8);const a=doc.splitTextToSize(`Tu respuesta: ${selected}`,166);doc.text(a,22,y);y+=a.length*3.6;doc.setTextColor(r?.es_correcta?0:180,r?.es_correcta?130:0,30);const c=doc.splitTextToSize(`Respuesta correcta: ${correct}`,166);doc.text(c,22,y);y+=c.length*3.6+2;doc.setTextColor(0,0,0);if(q.explicacion){const ex=doc.splitTextToSize(`Explicación: ${q.explicacion}`,166);doc.text(ex,22,y);y+=ex.length*3.6+4;}else y+=3;}
    if(data.attempt.firma){if(y>255){doc.addPage();y=25;}doc.setFont('helvetica','bold');doc.text('Firma del participante:',18,y);try{doc.addImage(data.attempt.firma,'PNG',55,y-7,42,16);}catch{}}
    doc.save(`${record?.codigo||'EVALUACION'}_Resultado_${data.attempt.dni}.pdf`);
  }catch(err){alert(err.message);}
}

async function downloadPracticeEvaluationRegisterPdf(){
  const record=practiceEvaluationRecords.find(x=>x.id===activePracticeEvaluationId);if(!record||!window.jspdf?.jsPDF)return;const attempts=practiceEvaluationAttempts.filter(a=>a.evaluacion_id===record.id&&a.finalizado_at);const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4',orientation:'landscape'});let logo=null;try{logo=await imageToDataUrl('assets/logo-explo.jpg');}catch{}
  if(logo)doc.addImage(logo,'JPEG',12,8,28,16);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('SIG - SSOMAC',148,14,{align:'center'});doc.setFillColor(192,0,0);doc.rect(45,18,205,8,'F');doc.setTextColor(255,255,255);doc.setFontSize(8);doc.text('REGISTRO DE EVALUACIÓN DE PRÁCTICA',147,23,{align:'center'});doc.setTextColor(0,0,0);doc.setFontSize(7);doc.text(`Código: ${record.codigo}`,252,12);doc.text(`Fecha: ${formatDatePE(record.fecha)}`,252,18);doc.setFontSize(9);doc.text(`TEMA: ${record.tema}`,12,36);doc.text(`RESPONSABLE: ${record.responsable}`,12,43);doc.text(`UNIDAD: ${practiceEvaluationUnitLabel(record)}`,150,43);doc.autoTable({startY:50,head:[['N°','APELLIDOS Y NOMBRES','DNI','PUESTO','ÁREA','FIRMA','NOTA']],body:attempts.map((a,i)=>[i+1,a.apellidos_nombres,a.dni,a.puesto||'',a.area||'','',Number(a.nota).toFixed(1)]),styles:{fontSize:7,cellPadding:2},headStyles:{fillColor:[70,70,70]},columnStyles:{0:{cellWidth:12},1:{cellWidth:70},2:{cellWidth:28},3:{cellWidth:55},4:{cellWidth:40},5:{cellWidth:45},6:{cellWidth:18}}});
  let finalY=doc.lastAutoTable.finalY;attempts.forEach((a,i)=>{if(!a.firma)return;try{const rowY=50+8+(i*7);doc.addImage(a.firma,'PNG',213,rowY,25,6);}catch{}});doc.save(`${record.codigo}_Registro_Evaluacion.pdf`);
}

function backToPracticeEvaluationList(){document.getElementById('evaluationEditorView')?.classList.add('hidden');document.getElementById('evaluationResultsView')?.classList.add('hidden');document.getElementById('evaluationListView')?.classList.remove('hidden');activePracticeEvaluationId=null;renderPracticeEvaluations();}

// ---------------- PUBLIC EVALUATION ----------------
let publicEvaluationCode='';let publicEvaluationParticipant=null;let publicEvaluationRun=null;let publicEvaluationTimerInterval=null;let publicEvaluationDeadline=null;let publicEvaluationLastResult=null;let publicEvaluationLastAttemptId=null;let publicEvaluationCanvasDrawing=false;let publicEvaluationCanvasCtx=null;

function showPublicEvaluationOnly(){publicExamScreen?.classList.add('hidden');publicPracticeScreen?.classList.add('hidden');appShell?.classList.add('hidden');authScreen?.classList.add('hidden');authLoading?.classList.add('hidden');publicEvaluationScreen?.classList.remove('hidden');}
function publicEvaluationMessage(message='',type='error',id='publicEvaluationMessage'){const el=document.getElementById(id);if(!el)return;el.textContent=message;el.className=`form-message ${message?'visible':''} ${type}`;}
async function initializePublicEvaluationMode(code){publicEvaluationCode=(code||'').trim();showPublicEvaluationOnly();document.getElementById('publicEvaluationHeaderCode').textContent=publicEvaluationCode;document.getElementById('publicEvaluationIdentity')?.classList.remove('hidden');document.getElementById('publicEvaluationFormView')?.classList.add('hidden');document.getElementById('publicEvaluationResultView')?.classList.add('hidden');document.getElementById('publicEvaluationReviewView')?.classList.add('hidden');setTimeout(()=>document.getElementById('publicEvaluationDni')?.focus(),50);}
async function lookupPublicEvaluation(){const dni=(document.getElementById('publicEvaluationDni').value||'').replace(/\D/g,'').slice(0,8);document.getElementById('publicEvaluationDni').value=dni;publicEvaluationMessage('');document.getElementById('publicEvaluationParticipantPreview')?.classList.add('hidden');document.getElementById('publicEvaluationRegistration')?.classList.add('hidden');if(!/^\d{8}$/.test(dni)){publicEvaluationMessage('Ingresa un DNI válido de 8 dígitos.');return;}const btn=document.getElementById('publicEvaluationLookupButton');btn.disabled=true;btn.textContent='Buscando…';const{data,error}=await client.rpc('obtener_evaluacion_practica_participante',{p_codigo:publicEvaluationCode,p_dni:dni});btn.disabled=false;btn.textContent='Continuar';if(error||!data?.ok){publicEvaluationMessage(data?.error||error?.message||'No fue posible consultar.');return;}document.getElementById('publicEvaluationHeaderTitle').textContent=data.titulo||'Evaluación';if(!data.registrado){publicEvaluationParticipant=data;document.getElementById('publicEvaluationRegDni').value=dni;const{data:sites}=await client.rpc('listar_sedes_registro_evaluacion_practica',{p_codigo:publicEvaluationCode});const sel=document.getElementById('publicEvaluationRegSite');sel.innerHTML='<option value="">Seleccione una sede</option>'+(sites||[]).map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('');document.getElementById('publicEvaluationSiteField').classList.toggle('hidden',!!data.sede_id||!!data.proyecto_id);document.getElementById('publicEvaluationRegistration')?.classList.remove('hidden');publicEvaluationMessage('No estás registrado. Regístrate para continuar.');return;}publicEvaluationParticipant=data;document.getElementById('publicEvaluationParticipantName').textContent=data.nombre;document.getElementById('publicEvaluationParticipantDetails').textContent=`DNI ${data.dni} · ${data.puesto||'—'} · ${data.area||'—'} · ${data.proyecto||data.sede||'—'}`;document.getElementById('publicEvaluationAttempts').textContent=data.max_intentos>0?`Intentos: ${data.intentos_realizados} de ${data.max_intentos}`:`Intentos realizados: ${data.intentos_realizados} · Sin límite`;document.getElementById('publicEvaluationParticipantPreview')?.classList.remove('hidden');}
async function registerPublicEvaluationWorker(event){event.preventDefault();const payload={p_codigo:publicEvaluationCode,p_dni:document.getElementById('publicEvaluationRegDni').value,p_nombres:document.getElementById('publicEvaluationRegFirstName').value.trim(),p_apellidos:document.getElementById('publicEvaluationRegLastName').value.trim(),p_cargo:document.getElementById('publicEvaluationRegPosition').value.trim(),p_area:document.getElementById('publicEvaluationRegArea').value.trim(),p_sede_id:document.getElementById('publicEvaluationRegSite').value||null};const{data,error}=await client.rpc('registrar_trabajador_evaluacion_practica',payload);if(error||!data?.ok){publicEvaluationMessage(data?.error||error?.message||'No se pudo registrar.','error','publicEvaluationRegistrationMessage');return;}document.getElementById('publicEvaluationRegistration')?.classList.add('hidden');await lookupPublicEvaluation();}
async function startPublicEvaluation(){const dni=document.getElementById('publicEvaluationDni').value;const btn=document.getElementById('publicEvaluationStartButton');btn.disabled=true;btn.textContent='Preparando…';const{data,error}=await client.rpc('iniciar_evaluacion_practica',{p_codigo:publicEvaluationCode,p_dni:dni});btn.disabled=false;btn.textContent='Comenzar evaluación';if(error||!data?.ok){publicEvaluationMessage(data?.error||error?.message||'No se pudo iniciar.');return;}publicEvaluationRun=data;publicEvaluationLastAttemptId=data.intento_id;document.getElementById('publicEvaluationIdentity')?.classList.add('hidden');document.getElementById('publicEvaluationFormView')?.classList.remove('hidden');document.getElementById('publicEvaluationPlayer').textContent=data.participante;document.getElementById('publicEvaluationPassing').textContent=Number(data.nota_minima).toFixed(1).replace('.0','');document.getElementById('publicEvaluationDescription').textContent=data.descripcion||'';renderPublicEvaluationQuestions(data.preguntas||[]);setupPublicEvaluationSignatureCanvas();startPublicEvaluationTimer(data.tiempo_max_min);}
function renderPublicEvaluationQuestions(questions){
  const box=document.getElementById('publicEvaluationQuestionList');
  box.innerHTML=questions.map((q,i)=>`<article class="public-evaluation-question" data-question-id="${q.id}" data-question-type="${q.tipo}">
    <div class="public-evaluation-question-head">
      <span>Pregunta ${i+1}</span>
      <b>${Number(q.peso)} pts · ${escapeHtml(q.nivel_tema)}</b>
    </div>
    <h3>${escapeHtml(q.enunciado)}</h3>
    ${q.imagen_url?`<img src="${escapeHtml(q.imagen_url)}" alt="Imagen de la pregunta" />`:''}
    ${renderPublicEvaluationAnswerControls(q)}
  </article>`).join('');
}
function renderPublicEvaluationAnswerControls(q){if(q.tipo==='FREE_TEXT')return `<textarea class="public-eval-free" rows="3" placeholder="Escribe tu respuesta"></textarea>`;const input=q.tipo==='MULTIPLE'?'checkbox':'radio';return `<div class="public-evaluation-options">${(q.opciones||[]).map((o,i)=>`<label><input type="${input}" name="q-${q.id}" value="${o.id}" /><span>${String.fromCharCode(65+i)}) ${escapeHtml(o.texto)}</span></label>`).join('')}</div>`;}
function collectPublicEvaluationAnswer(q){const article=document.querySelector(`.public-evaluation-question[data-question-id="${q.id}"]`);if(!article)return{pregunta_id:q.id,opcion_ids:[],texto:''};if(q.tipo==='FREE_TEXT')return{pregunta_id:q.id,opcion_ids:[],texto:article.querySelector('.public-eval-free')?.value.trim()||''};return{pregunta_id:q.id,opcion_ids:[...article.querySelectorAll('input:checked')].map(x=>x.value),texto:''};}
async function checkPublicEvaluationAnswer(questionId){const q=(publicEvaluationRun?.preguntas||[]).find(x=>x.id===questionId);if(!q)return;const a=collectPublicEvaluationAnswer(q);const{data,error}=await client.rpc('verificar_respuesta_evaluacion_practica',{p_codigo:publicEvaluationCode,p_pregunta_id:q.id,p_opcion_ids:a.opcion_ids,p_respuesta_texto:a.texto||null});const box=document.getElementById(`feedback-${q.id}`);if(error||!data?.ok){box.textContent=data?.error||error?.message;box.className='public-immediate-feedback wrong';return;}box.innerHTML=`<strong>${data.es_correcta?'✓ Correcto':'✕ Incorrecto'}</strong>${!data.es_correcta?`<span>Respuesta correcta: ${(data.correctas||[]).map(escapeHtml).join(' / ')}</span>`:''}${data.explicacion?`<p>${escapeHtml(data.explicacion)}</p>`:''}`;box.className=`public-immediate-feedback ${data.es_correcta?'correct':'wrong'}`;}
function startPublicEvaluationTimer(minutes){clearInterval(publicEvaluationTimerInterval);const box=document.getElementById('publicEvaluationTimerBox');const txt=document.getElementById('publicEvaluationTimer');if(!minutes){box.classList.add('hidden');txt.textContent='Sin límite';return;}box.classList.remove('hidden');publicEvaluationDeadline=Date.now()+Number(minutes)*60000;const tick=()=>{const ms=Math.max(0,publicEvaluationDeadline-Date.now());const min=Math.floor(ms/60000);const sec=Math.floor(ms%60000/1000);txt.textContent=`${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;if(ms<=0){clearInterval(publicEvaluationTimerInterval);submitPublicEvaluation(true);}};tick();publicEvaluationTimerInterval=setInterval(tick,1000);}
function setupPublicEvaluationSignatureCanvas(){const c=document.getElementById('publicEvaluationSignatureCanvas');if(!c)return;publicEvaluationCanvasCtx=c.getContext('2d');publicEvaluationCanvasCtx.lineWidth=2;publicEvaluationCanvasCtx.lineCap='round';publicEvaluationCanvasCtx.strokeStyle='#17263c';publicEvaluationCanvasCtx.clearRect(0,0,c.width,c.height);const point=e=>{const r=c.getBoundingClientRect();const p=e.touches?.[0]||e;return{x:(p.clientX-r.left)*(c.width/r.width),y:(p.clientY-r.top)*(c.height/r.height)}};c.onpointerdown=e=>{publicEvaluationCanvasDrawing=true;const p=point(e);publicEvaluationCanvasCtx.beginPath();publicEvaluationCanvasCtx.moveTo(p.x,p.y);c.setPointerCapture?.(e.pointerId);};c.onpointermove=e=>{if(!publicEvaluationCanvasDrawing)return;const p=point(e);publicEvaluationCanvasCtx.lineTo(p.x,p.y);publicEvaluationCanvasCtx.stroke();};c.onpointerup=()=>{publicEvaluationCanvasDrawing=false;};c.onpointerleave=()=>{publicEvaluationCanvasDrawing=false;};}
function publicEvaluationSignatureIsBlank(){const c=document.getElementById('publicEvaluationSignatureCanvas');const ctx=c.getContext('2d');const data=ctx.getImageData(0,0,c.width,c.height).data;for(let i=3;i<data.length;i+=4)if(data[i]!==0)return false;return true;}
async function submitPublicEvaluation(auto=false){if(!publicEvaluationRun)return;const msg=document.getElementById('publicEvaluationSubmitMessage');if(!auto&&publicEvaluationSignatureIsBlank()){msg.textContent='Registra tu firma antes de finalizar.';msg.className='form-message visible error';return;}const c=document.getElementById('publicEvaluationSignatureCanvas');const firma=publicEvaluationSignatureIsBlank()?'data:image/png;base64,':c.toDataURL('image/png');if(auto&&publicEvaluationSignatureIsBlank()){msg.textContent='El tiempo terminó. Firma y pulsa Finalizar evaluación.';msg.className='form-message visible error';return;}const answers=(publicEvaluationRun.preguntas||[]).map(collectPublicEvaluationAnswer);const dni=document.getElementById('publicEvaluationDni').value;const btn=document.getElementById('publicEvaluationSubmitButton');btn.disabled=true;btn.textContent='Calificando…';const{data,error}=await client.rpc('finalizar_evaluacion_practica',{p_intento_id:publicEvaluationRun.intento_id,p_dni:dni,p_respuestas:answers,p_firma:firma});btn.disabled=false;btn.textContent='Finalizar evaluación';if(error||!data?.ok){msg.textContent=data?.error||error?.message||'No se pudo finalizar.';msg.className='form-message visible error';return;}clearInterval(publicEvaluationTimerInterval);publicEvaluationLastResult=data;showPublicEvaluationResult(data);}
function showPublicEvaluationResult(data){
  document.getElementById('publicEvaluationFormView')?.classList.add('hidden');
  document.getElementById('publicEvaluationResultView')?.classList.remove('hidden');
  const icon=document.getElementById('publicEvaluationResultIcon');
  icon.textContent=data.aprobado?'✓':'!';
  icon.classList.toggle('fail',!data.aprobado);
  document.getElementById('publicEvaluationResultTitle').textContent=data.aprobado?'¡Genial, estás aprobado!':'Debes reforzar algunos temas';
  document.getElementById('publicEvaluationGrade').innerHTML=`${Number(data.nota).toFixed(1)} <small>/ 20</small>`;
  document.getElementById('publicEvaluationCorrectText').textContent=`${data.correctas} de ${data.total} respuestas correctas`;
  const card=document.getElementById('publicEvaluationReinforceCard');
  const list=document.getElementById('publicEvaluationReinforceList');
  const topics=data.temas_reforzar||[];
  card.classList.toggle('hidden',!topics.length);
  list.innerHTML=topics.map(x=>`<div>⚠ ${escapeHtml(x.tema)}</div>`).join('');
  const reviewButton=document.getElementById('publicEvaluationReviewButton');
  if(reviewButton){
    reviewButton.textContent=topics.length?'Revisar mis respuestas y reforzar temas':'Revisar mis respuestas';
  }
}
async function reviewPublicEvaluation(){const dni=document.getElementById('publicEvaluationDni').value;const{data,error}=await client.rpc('revisar_evaluacion_practica',{p_intento_id:publicEvaluationLastAttemptId,p_dni:dni});if(error||!data?.ok){alert(data?.error||error?.message);return;}document.getElementById('publicEvaluationResultView')?.classList.add('hidden');document.getElementById('publicEvaluationReviewView')?.classList.remove('hidden');document.getElementById('publicEvaluationReviewQuestions').innerHTML=(data.preguntas||[]).map((q,i)=>`<article class="public-review-question ${q.es_correcta?'correct':'wrong'}"><h3>${i+1}. ${escapeHtml(q.enunciado)}</h3><p><b>Tu respuesta:</b> ${escapeHtml(q.respuesta_texto||((q.respuesta_seleccionada||[]).join(', '))||'Sin respuesta')}</p>${(q.respuestas_correctas||[]).length?`<p><b>Respuesta correcta:</b> ${escapeHtml(q.respuestas_correctas.join(' / '))}</p>`:''}${q.explicacion?`<p class="public-review-explanation">${escapeHtml(q.explicacion)}</p>`:''}<small>Tema: ${escapeHtml(q.nivel_tema)}</small></article>`).join('');document.getElementById('publicEvaluationMasteredList').innerHTML=(data.temas_dominados||[]).map(x=>`<div>✓ ${escapeHtml(x)}</div>`).join('')||'<div>—</div>';document.getElementById('publicEvaluationReviewReinforceList').innerHTML=(data.temas_reforzar||[]).map(x=>`<div>⚠ ${escapeHtml(x.tema)}</div>`).join('')||'<div>✓ Sin temas pendientes</div>';}

// EVENTS ETAPA 13
document.getElementById('practiceQuizModeButton')?.addEventListener('click',()=>switchPracticeMode('quiz'));
document.getElementById('practiceEvaluationModeButton')?.addEventListener('click',()=>switchPracticeMode('evaluation'));
document.getElementById('newPracticeEvaluationButton')?.addEventListener('click',()=>openPracticeEvaluationEditor());
document.getElementById('refreshPracticeEvaluationsButton')?.addEventListener('click',()=>{practiceEvaluationRecords=[];loadPracticeEvaluations(true);});
document.getElementById('practiceEvaluationSearch')?.addEventListener('input',renderPracticeEvaluations);
document.getElementById('practiceEvaluationStatusFilter')?.addEventListener('change',renderPracticeEvaluations);
document.getElementById('backPracticeEvaluationsButton')?.addEventListener('click',backToPracticeEvaluationList);
document.getElementById('backEvaluationResultsButton')?.addEventListener('click',backToPracticeEvaluationList);
document.getElementById('practiceEvaluationForm')?.addEventListener('submit',savePracticeEvaluation);
document.getElementById('practiceEvaluationTraining')?.addEventListener('change',e=>{const t=practiceEvaluationTrainings.find(x=>x.id===e.target.value);if(t&&!document.getElementById('practiceEvaluationTopic').value.trim())document.getElementById('practiceEvaluationTopic').value=t.tema||'';});
document.getElementById('newPracticeEvaluationQuestionButton')?.addEventListener('click',()=>openPracticeEvaluationQuestionModal());
document.getElementById('practiceEvaluationQuestionType')?.addEventListener('change',e=>renderPracticeEvaluationOptionEditor(e.target.value));
document.getElementById('savePracticeEvaluationQuestionButton')?.addEventListener('click',savePracticeEvaluationQuestion);
document.getElementById('closePracticeEvaluationQuestionModal')?.addEventListener('click',closePracticeEvaluationQuestionModal);
document.getElementById('cancelPracticeEvaluationQuestionModal')?.addEventListener('click',closePracticeEvaluationQuestionModal);
document.getElementById('practiceEvaluationQuestionModal')?.querySelector('.modal-backdrop')?.addEventListener('click',closePracticeEvaluationQuestionModal);
document.getElementById('saveAndReturnPracticeEvaluation')?.addEventListener('click',async()=>{await savePracticeEvaluation();backToPracticeEvaluationList();});
document.getElementById('copyPracticeEvaluationLinkButton')?.addEventListener('click',async()=>{const e=practiceEvaluationRecords.find(x=>x.id===activePracticeEvaluationId);const link=practiceEvaluationPublicUrl(e);if(!link)return;try{await navigator.clipboard.writeText(link);alert('Enlace copiado.');}catch{window.prompt('Copia el enlace:',link);}});
document.getElementById('whatsappPracticeEvaluationButton')?.addEventListener('click',()=>{const e=practiceEvaluationRecords.find(x=>x.id===activePracticeEvaluationId);const link=practiceEvaluationPublicUrl(e);if(link)window.open(`https://wa.me/?text=${encodeURIComponent(`Evaluación: ${e.titulo}\n${link}`)}`,'_blank','noopener');});
document.getElementById('downloadEvaluationRegisterButton')?.addEventListener('click',downloadPracticeEvaluationRegisterPdf);

document.getElementById('publicEvaluationDni')?.addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,8));
document.getElementById('publicEvaluationDni')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupPublicEvaluation();}});
document.getElementById('publicEvaluationLookupButton')?.addEventListener('click',lookupPublicEvaluation);
document.getElementById('publicEvaluationRegistrationForm')?.addEventListener('submit',registerPublicEvaluationWorker);
document.getElementById('publicEvaluationRegistrationCancelButton')?.addEventListener('click',()=>document.getElementById('publicEvaluationRegistration')?.classList.add('hidden'));
document.getElementById('publicEvaluationStartButton')?.addEventListener('click',startPublicEvaluation);
document.getElementById('clearPublicEvaluationSignature')?.addEventListener('click',()=>setupPublicEvaluationSignatureCanvas());
document.getElementById('publicEvaluationSubmitButton')?.addEventListener('click',()=>submitPublicEvaluation(false));
document.getElementById('publicEvaluationReviewButton')?.addEventListener('click',reviewPublicEvaluation);
document.getElementById('publicEvaluationReviewBack')?.addEventListener('click',()=>{document.getElementById('publicEvaluationReviewView')?.classList.add('hidden');document.getElementById('publicEvaluationResultView')?.classList.remove('hidden');});


document.getElementById('publicMeetingSignatureDni')?.addEventListener('input',event=>{
  event.target.value=event.target.value.replace(/\D/g,'').slice(0,8);
});
document.getElementById('publicMeetingSignatureDni')?.addEventListener('keydown',event=>{
  if (event.key==='Enter') {
    event.preventDefault();
    lookupPublicCommitteeMeetingSignature();
  }
});
document.getElementById('publicMeetingSignatureLookupButton')?.addEventListener('click',lookupPublicCommitteeMeetingSignature);
document.getElementById('clearPublicMeetingSignatureButton')?.addEventListener('click',setupPublicCommitteeMeetingSignatureCanvas);
document.getElementById('savePublicMeetingSignatureButton')?.addEventListener('click',submitPublicCommitteeMeetingSignature);


document.getElementById('publicCommitteeTrainingDni')?.addEventListener('input',event=>{
  event.target.value=event.target.value.replace(/\D/g,'').slice(0,8);
});
document.getElementById('publicCommitteeTrainingDni')?.addEventListener('keydown',event=>{
  if (event.key==='Enter') {
    event.preventDefault();
    lookupPublicCommitteeTraining();
  }
});
document.getElementById('publicCommitteeTrainingLookupButton')?.addEventListener('click',lookupPublicCommitteeTraining);
document.getElementById('clearPublicCommitteeTrainingSignatureButton')?.addEventListener('click',setupPublicCommitteeTrainingSignatureCanvas);
document.getElementById('savePublicCommitteeTrainingSignatureButton')?.addEventListener('click',savePublicCommitteeTrainingSignature);
document.getElementById('publicCommitteeTrainingExamButton')?.addEventListener('click',()=>{
  const mode=document.getElementById('publicCommitteeTrainingExamButton')?.dataset.mode;
  if (mode==='result') openExistingPublicCommitteeTrainingResult();
  else if (mode==='start') startPublicCommitteeTrainingExam();
});
document.getElementById('publicCommitteeTrainingExamSubmitButton')?.addEventListener('click',()=>submitPublicCommitteeTrainingExam(false));
document.getElementById('publicCommitteeTrainingReviewButton')?.addEventListener('click',reviewPublicCommitteeTrainingExam);
document.getElementById('publicCommitteeTrainingDownloadExamButton')?.addEventListener('click',downloadPublicCommitteeTrainingExamPdf);
document.getElementById('publicCommitteeTrainingRetryButton')?.addEventListener('click',startPublicCommitteeTrainingExam);
document.getElementById('publicCommitteeTrainingReturnContentButton')?.addEventListener('click',showPublicCommitteeTrainingContent);
document.getElementById('publicCommitteeTrainingReviewBackButton')?.addEventListener('click',()=>{
  document.getElementById('publicCommitteeTrainingReviewView')?.classList.add('hidden');
  document.getElementById('publicCommitteeTrainingResultView')?.classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
});


initializeAuth();
