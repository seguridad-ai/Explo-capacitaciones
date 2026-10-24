-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 17A - PLANIFICACIÓN · PROYECTOS Y DIAGRAMA DE GANTT
-- ============================================================

create sequence if not exists public.planificacion_proyecto_codigo_seq start 1;

create table if not exists public.planificacion_proyectos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nombre text not null,
  descripcion text,
  objetivo text,
  categoria text not null default 'SIG'
    check (categoria in ('SIG','SST','AMBIENTAL','CALIDAD','AUDITORIA','CLIENTE','OPERACIONES','OTRO')),
  proyecto_id uuid references public.proyectos(id) on delete set null,
  responsable_nombre text not null,
  responsable_profile_id uuid references public.profiles(id) on delete set null,
  fecha_inicio date not null,
  fecha_fin date not null,
  prioridad text not null default 'MEDIA'
    check (prioridad in ('BAJA','MEDIA','ALTA','CRITICA')),
  estado text not null default 'ACTIVO'
    check (estado in ('BORRADOR','ACTIVO','PAUSADO','CERRADO','CANCELADO')),
  observaciones text,
  created_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planificacion_proyecto_fechas check (fecha_fin >= fecha_inicio)
);

create index if not exists idx_planificacion_proyectos_estado on public.planificacion_proyectos(estado);
create index if not exists idx_planificacion_proyectos_fechas on public.planificacion_proyectos(fecha_inicio,fecha_fin);
create index if not exists idx_planificacion_proyectos_proyecto on public.planificacion_proyectos(proyecto_id);
create index if not exists idx_planificacion_proyectos_created_by on public.planificacion_proyectos(created_by);

create table if not exists public.planificacion_actividades (
  id uuid primary key default gen_random_uuid(),
  planificacion_proyecto_id uuid not null references public.planificacion_proyectos(id) on delete cascade,
  orden integer not null default 1 check (orden >= 1),
  tipo text not null default 'TAREA' check (tipo in ('TAREA','HITO')),
  nombre text not null,
  descripcion text,
  responsable_nombre text,
  responsable_profile_id uuid references public.profiles(id) on delete set null,
  fecha_inicio date not null,
  fecha_fin date not null,
  progreso integer not null default 0 check (progreso between 0 and 100),
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE','EN_PROCESO','BLOQUEADO','COMPLETADO','CANCELADO')),
  prioridad text not null default 'MEDIA'
    check (prioridad in ('BAJA','MEDIA','ALTA','CRITICA')),
  observaciones text,
  created_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planificacion_actividad_fechas check (fecha_fin >= fecha_inicio),
  constraint planificacion_hito_un_dia check (tipo <> 'HITO' or fecha_fin = fecha_inicio)
);

create index if not exists idx_planificacion_actividades_proyecto on public.planificacion_actividades(planificacion_proyecto_id,orden);
create index if not exists idx_planificacion_actividades_fechas on public.planificacion_actividades(fecha_inicio,fecha_fin);
create index if not exists idx_planificacion_actividades_estado on public.planificacion_actividades(estado);

create table if not exists public.planificacion_dependencias (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.planificacion_actividades(id) on delete cascade,
  depende_de_actividad_id uuid not null references public.planificacion_actividades(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (actividad_id,depende_de_actividad_id),
  constraint planificacion_dependencia_distinta check (actividad_id <> depende_de_actividad_id)
);

create index if not exists idx_planificacion_dependencias_actividad on public.planificacion_dependencias(actividad_id);
create index if not exists idx_planificacion_dependencias_predecesora on public.planificacion_dependencias(depende_de_actividad_id);

-- Código automático: PLN-2026-0001
create or replace function public.set_planificacion_proyecto_codigo()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.codigo is null or btrim(new.codigo)='' then
    new.codigo := 'PLN-' || extract(year from new.fecha_inicio)::int::text || '-' ||
      lpad(nextval('public.planificacion_proyecto_codigo_seq')::text,4,'0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_planificacion_proyecto_codigo on public.planificacion_proyectos;
create trigger trg_set_planificacion_proyecto_codigo
before insert on public.planificacion_proyectos
for each row execute function public.set_planificacion_proyecto_codigo();

create or replace function public.touch_planificacion_updated_at()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_touch_planificacion_proyectos on public.planificacion_proyectos;
create trigger trg_touch_planificacion_proyectos
before update on public.planificacion_proyectos
for each row execute function public.touch_planificacion_updated_at();

drop trigger if exists trg_touch_planificacion_actividades on public.planificacion_actividades;
create trigger trg_touch_planificacion_actividades
before update on public.planificacion_actividades
for each row execute function public.touch_planificacion_updated_at();

-- ------------------------------------------------------------
-- Seguridad / visibilidad
-- ADMIN y GERENCIA: todos.
-- Otros usuarios: proyectos creados por ellos, donde son responsable,
-- o asociados a un proyecto operativo al que tienen acceso.
-- ------------------------------------------------------------
create or replace function public.can_view_planificacion_project(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.planificacion_proyectos p
    where p.id=p_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or p.created_by=auth.uid()
        or p.responsable_profile_id=auth.uid()
        or (p.proyecto_id is not null and public.has_project_access(p.proyecto_id))
      )
  );
$$;

create or replace function public.can_manage_planificacion_project(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.planificacion_proyectos p
    where p.id=p_id
      and (
        public.is_admin()
        or p.created_by=auth.uid()
        or p.responsable_profile_id=auth.uid()
        or (p.proyecto_id is not null and public.can_manage_project(p.proyecto_id))
      )
  );
$$;

grant execute on function public.can_view_planificacion_project(uuid) to authenticated;
grant execute on function public.can_manage_planificacion_project(uuid) to authenticated;

alter table public.planificacion_proyectos enable row level security;
alter table public.planificacion_actividades enable row level security;
alter table public.planificacion_dependencias enable row level security;

drop policy if exists planificacion_proyectos_select on public.planificacion_proyectos;
create policy planificacion_proyectos_select
on public.planificacion_proyectos
for select to authenticated
using (
  public.is_admin()
  or public.can_view_all_projects()
  or created_by=auth.uid()
  or responsable_profile_id=auth.uid()
  or (proyecto_id is not null and public.has_project_access(proyecto_id))
);

drop policy if exists planificacion_proyectos_insert on public.planificacion_proyectos;
create policy planificacion_proyectos_insert
on public.planificacion_proyectos
for insert to authenticated
with check (
  public.is_admin()
  or created_by=auth.uid()
  or (proyecto_id is not null and public.can_manage_project(proyecto_id))
);

drop policy if exists planificacion_proyectos_update on public.planificacion_proyectos;
create policy planificacion_proyectos_update
on public.planificacion_proyectos
for update to authenticated
using (
  public.is_admin()
  or created_by=auth.uid()
  or responsable_profile_id=auth.uid()
  or (proyecto_id is not null and public.can_manage_project(proyecto_id))
)
with check (
  public.is_admin()
  or created_by=auth.uid()
  or responsable_profile_id=auth.uid()
  or (proyecto_id is not null and public.can_manage_project(proyecto_id))
);

drop policy if exists planificacion_proyectos_delete on public.planificacion_proyectos;
create policy planificacion_proyectos_delete
on public.planificacion_proyectos
for delete to authenticated
using (
  public.is_admin()
  or created_by=auth.uid()
  or (proyecto_id is not null and public.can_manage_project(proyecto_id))
);

drop policy if exists planificacion_actividades_select on public.planificacion_actividades;
create policy planificacion_actividades_select
on public.planificacion_actividades
for select to authenticated
using (public.can_view_planificacion_project(planificacion_proyecto_id));

drop policy if exists planificacion_actividades_insert on public.planificacion_actividades;
create policy planificacion_actividades_insert
on public.planificacion_actividades
for insert to authenticated
with check (public.can_manage_planificacion_project(planificacion_proyecto_id));

drop policy if exists planificacion_actividades_update on public.planificacion_actividades;
create policy planificacion_actividades_update
on public.planificacion_actividades
for update to authenticated
using (public.can_manage_planificacion_project(planificacion_proyecto_id))
with check (public.can_manage_planificacion_project(planificacion_proyecto_id));

drop policy if exists planificacion_actividades_delete on public.planificacion_actividades;
create policy planificacion_actividades_delete
on public.planificacion_actividades
for delete to authenticated
using (public.can_manage_planificacion_project(planificacion_proyecto_id));

drop policy if exists planificacion_dependencias_select on public.planificacion_dependencias;
create policy planificacion_dependencias_select
on public.planificacion_dependencias
for select to authenticated
using (
  exists (
    select 1 from public.planificacion_actividades a
    where a.id=actividad_id
      and public.can_view_planificacion_project(a.planificacion_proyecto_id)
  )
);

drop policy if exists planificacion_dependencias_manage on public.planificacion_dependencias;
create policy planificacion_dependencias_manage
on public.planificacion_dependencias
for all to authenticated
using (
  exists (
    select 1 from public.planificacion_actividades a
    where a.id=actividad_id
      and public.can_manage_planificacion_project(a.planificacion_proyecto_id)
  )
)
with check (
  exists (
    select 1 from public.planificacion_actividades a
    where a.id=actividad_id
      and public.can_manage_planificacion_project(a.planificacion_proyecto_id)
  )
);

grant select,insert,update,delete on public.planificacion_proyectos to authenticated;
grant select,insert,update,delete on public.planificacion_actividades to authenticated;
grant select,insert,update,delete on public.planificacion_dependencias to authenticated;
grant usage,select on sequence public.planificacion_proyecto_codigo_seq to authenticated;

select 'Etapa 17A aplicada correctamente' as resultado;
