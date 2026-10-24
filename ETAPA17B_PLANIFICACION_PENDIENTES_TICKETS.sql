-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 17B - PLANIFICACIÓN · PENDIENTES TIPO TICKET
-- ============================================================

create sequence if not exists public.planificacion_pendiente_codigo_seq start 1;

-- ------------------------------------------------------------
-- 1. Pendientes
-- ------------------------------------------------------------
create table if not exists public.planificacion_pendientes (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  titulo text not null,
  descripcion text,

  categoria text not null default 'SIG'
    check (categoria in (
      'PERSONAL','SIG','SST','AMBIENTAL','CALIDAD',
      'AUDITORIA','CLIENTE','OPERACIONES','COMITE_SST',
      'CAPACITACION','INDICADORES','OTRO'
    )),

  origen text not null default 'PERSONAL'
    check (origen in (
      'PERSONAL','GANTT','COMITE_SST','CAPACITACION',
      'AUDITORIA','INDICADORES','CLIENTE','PROYECTO','OTRO'
    )),

  prioridad text not null default 'MEDIA'
    check (prioridad in ('BAJA','MEDIA','ALTA','CRITICA')),

  estado text not null default 'PENDIENTE'
    check (estado in (
      'PENDIENTE','EN_PROCESO','EN_ESPERA','COMPLETADO','CANCELADO'
    )),

  asignado_a_profile_id uuid references public.profiles(id) on delete set null,
  responsable_nombre text not null,

  fecha_objetivo date not null,
  hora_objetivo time,

  esperando_de text,
  motivo_espera text,
  fecha_seguimiento date,

  proyecto_id uuid references public.proyectos(id) on delete set null,
  planificacion_proyecto_id uuid references public.planificacion_proyectos(id) on delete set null,
  planificacion_actividad_id uuid references public.planificacion_actividades(id) on delete set null,

  observaciones text,
  ultimo_motivo_cambio text,

  completado_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_planificacion_pendientes_fecha
on public.planificacion_pendientes(fecha_objetivo,hora_objetivo);

create index if not exists idx_planificacion_pendientes_estado
on public.planificacion_pendientes(estado);

create index if not exists idx_planificacion_pendientes_prioridad
on public.planificacion_pendientes(prioridad);

create index if not exists idx_planificacion_pendientes_asignado
on public.planificacion_pendientes(asignado_a_profile_id);

create index if not exists idx_planificacion_pendientes_created_by
on public.planificacion_pendientes(created_by);

create index if not exists idx_planificacion_pendientes_proyecto
on public.planificacion_pendientes(proyecto_id);

create index if not exists idx_planificacion_pendientes_plan
on public.planificacion_pendientes(planificacion_proyecto_id);

-- ------------------------------------------------------------
-- 2. Historial / trazabilidad
-- ------------------------------------------------------------
create table if not exists public.planificacion_pendiente_historial (
  id uuid primary key default gen_random_uuid(),
  pendiente_id uuid not null references public.planificacion_pendientes(id) on delete cascade,
  evento text not null
    check (evento in (
      'CREADO','EDITADO','ESTADO','REPROGRAMADO',
      'ASIGNACION','ESPERA','COMPLETADO','CANCELADO'
    )),
  estado_anterior text,
  estado_nuevo text,
  fecha_anterior date,
  fecha_nueva date,
  hora_anterior time,
  hora_nueva time,
  responsable_anterior text,
  responsable_nuevo text,
  detalle text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_planificacion_pendiente_historial
on public.planificacion_pendiente_historial(pendiente_id,changed_at desc);

-- ------------------------------------------------------------
-- 3. Código automático: TK-2026-0001
-- ------------------------------------------------------------
create or replace function public.set_planificacion_pendiente_codigo()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.codigo is null or btrim(new.codigo)='' then
    new.codigo :=
      'TK-'
      || extract(year from new.fecha_objetivo)::int::text
      || '-'
      || lpad(nextval('public.planificacion_pendiente_codigo_seq')::text,4,'0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_planificacion_pendiente_codigo
on public.planificacion_pendientes;

create trigger trg_set_planificacion_pendiente_codigo
before insert on public.planificacion_pendientes
for each row execute function public.set_planificacion_pendiente_codigo();

-- ------------------------------------------------------------
-- 4. Preparar actualización: updated_at, cierre, updated_by
-- ------------------------------------------------------------
create or replace function public.prepare_planificacion_pendiente_update()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  new.updated_at := now();

  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;

  if new.estado='COMPLETADO' and old.estado is distinct from 'COMPLETADO' then
    new.completado_at := coalesce(new.completado_at,now());
  elsif new.estado<>'COMPLETADO' and old.estado='COMPLETADO' then
    new.completado_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prepare_planificacion_pendiente_update
on public.planificacion_pendientes;

create trigger trg_prepare_planificacion_pendiente_update
before update on public.planificacion_pendientes
for each row execute function public.prepare_planificacion_pendiente_update();

-- ------------------------------------------------------------
-- 5. Historial automático
-- ------------------------------------------------------------
create or replace function public.log_planificacion_pendiente_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.planificacion_pendiente_historial(
    pendiente_id,evento,estado_nuevo,fecha_nueva,hora_nueva,
    responsable_nuevo,detalle,changed_by
  )
  values(
    new.id,'CREADO',new.estado,new.fecha_objetivo,new.hora_objetivo,
    new.responsable_nombre,coalesce(new.ultimo_motivo_cambio,'Pendiente creado.'),auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists trg_log_planificacion_pendiente_insert
on public.planificacion_pendientes;

create trigger trg_log_planificacion_pendiente_insert
after insert on public.planificacion_pendientes
for each row execute function public.log_planificacion_pendiente_insert();

create or replace function public.log_planificacion_pendiente_update()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_evento text := 'EDITADO';
begin
  if old.estado is distinct from new.estado then
    if new.estado='COMPLETADO' then
      v_evento := 'COMPLETADO';
    elsif new.estado='CANCELADO' then
      v_evento := 'CANCELADO';
    elsif new.estado='EN_ESPERA' then
      v_evento := 'ESPERA';
    else
      v_evento := 'ESTADO';
    end if;
  elsif old.fecha_objetivo is distinct from new.fecha_objetivo
     or old.hora_objetivo is distinct from new.hora_objetivo then
    v_evento := 'REPROGRAMADO';
  elsif old.asignado_a_profile_id is distinct from new.asignado_a_profile_id
     or old.responsable_nombre is distinct from new.responsable_nombre then
    v_evento := 'ASIGNACION';
  end if;

  if
    old.titulo is distinct from new.titulo
    or old.descripcion is distinct from new.descripcion
    or old.categoria is distinct from new.categoria
    or old.origen is distinct from new.origen
    or old.prioridad is distinct from new.prioridad
    or old.estado is distinct from new.estado
    or old.asignado_a_profile_id is distinct from new.asignado_a_profile_id
    or old.responsable_nombre is distinct from new.responsable_nombre
    or old.fecha_objetivo is distinct from new.fecha_objetivo
    or old.hora_objetivo is distinct from new.hora_objetivo
    or old.esperando_de is distinct from new.esperando_de
    or old.motivo_espera is distinct from new.motivo_espera
    or old.fecha_seguimiento is distinct from new.fecha_seguimiento
    or old.proyecto_id is distinct from new.proyecto_id
    or old.planificacion_proyecto_id is distinct from new.planificacion_proyecto_id
    or old.planificacion_actividad_id is distinct from new.planificacion_actividad_id
    or old.observaciones is distinct from new.observaciones
  then
    insert into public.planificacion_pendiente_historial(
      pendiente_id,evento,
      estado_anterior,estado_nuevo,
      fecha_anterior,fecha_nueva,
      hora_anterior,hora_nueva,
      responsable_anterior,responsable_nuevo,
      detalle,changed_by
    )
    values(
      new.id,v_evento,
      old.estado,new.estado,
      old.fecha_objetivo,new.fecha_objetivo,
      old.hora_objetivo,new.hora_objetivo,
      old.responsable_nombre,new.responsable_nombre,
      new.ultimo_motivo_cambio,
      auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_planificacion_pendiente_update
on public.planificacion_pendientes;

create trigger trg_log_planificacion_pendiente_update
after update on public.planificacion_pendientes
for each row execute function public.log_planificacion_pendiente_update();

-- ------------------------------------------------------------
-- 6. Usuarios asignables
-- Devuelve solo información funcional, no credenciales.
-- ------------------------------------------------------------
create or replace function public.planificacion_usuarios_asignables()
returns table(
  id uuid,
  nombre text,
  cargo text,
  rol_codigo text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    p.id,
    btrim(concat_ws(' ',p.apellidos,p.nombres)) as nombre,
    p.cargo,
    p.rol_codigo
  from public.profiles p
  where coalesce(p.activo,true)=true
  order by p.apellidos nulls last,p.nombres nulls last;
$$;

revoke all on function public.planificacion_usuarios_asignables() from public;
grant execute on function public.planificacion_usuarios_asignables() to authenticated;

-- ------------------------------------------------------------
-- 7. Helpers de visibilidad
-- ------------------------------------------------------------
create or replace function public.can_view_planificacion_pending(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.planificacion_pendientes p
    where p.id=p_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or p.created_by=auth.uid()
        or p.asignado_a_profile_id=auth.uid()
        or (
          p.proyecto_id is not null
          and public.has_project_access(p.proyecto_id)
        )
        or (
          p.planificacion_proyecto_id is not null
          and public.can_view_planificacion_project(p.planificacion_proyecto_id)
        )
      )
  );
$$;

create or replace function public.can_manage_planificacion_pending(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.planificacion_pendientes p
    where p.id=p_id
      and (
        public.is_admin()
        or p.created_by=auth.uid()
        or p.asignado_a_profile_id=auth.uid()
        or (
          p.proyecto_id is not null
          and public.can_manage_project(p.proyecto_id)
        )
        or (
          p.planificacion_proyecto_id is not null
          and public.can_manage_planificacion_project(p.planificacion_proyecto_id)
        )
      )
  );
$$;

grant execute on function public.can_view_planificacion_pending(uuid) to authenticated;
grant execute on function public.can_manage_planificacion_pending(uuid) to authenticated;

-- ------------------------------------------------------------
-- 8. RLS
-- ------------------------------------------------------------
alter table public.planificacion_pendientes enable row level security;
alter table public.planificacion_pendiente_historial enable row level security;

drop policy if exists planificacion_pendientes_select
on public.planificacion_pendientes;

create policy planificacion_pendientes_select
on public.planificacion_pendientes
for select to authenticated
using (
  public.is_admin()
  or public.can_view_all_projects()
  or created_by=auth.uid()
  or asignado_a_profile_id=auth.uid()
  or (proyecto_id is not null and public.has_project_access(proyecto_id))
  or (
    planificacion_proyecto_id is not null
    and public.can_view_planificacion_project(planificacion_proyecto_id)
  )
);

drop policy if exists planificacion_pendientes_insert
on public.planificacion_pendientes;

create policy planificacion_pendientes_insert
on public.planificacion_pendientes
for insert to authenticated
with check (
  public.is_admin()
  or created_by=auth.uid()
  or (proyecto_id is not null and public.can_manage_project(proyecto_id))
  or (
    planificacion_proyecto_id is not null
    and public.can_manage_planificacion_project(planificacion_proyecto_id)
  )
);

drop policy if exists planificacion_pendientes_update
on public.planificacion_pendientes;

create policy planificacion_pendientes_update
on public.planificacion_pendientes
for update to authenticated
using (public.can_manage_planificacion_pending(id))
with check (public.can_manage_planificacion_pending(id));

drop policy if exists planificacion_pendientes_delete
on public.planificacion_pendientes;

create policy planificacion_pendientes_delete
on public.planificacion_pendientes
for delete to authenticated
using (
  public.is_admin()
  or created_by=auth.uid()
  or (proyecto_id is not null and public.can_manage_project(proyecto_id))
  or (
    planificacion_proyecto_id is not null
    and public.can_manage_planificacion_project(planificacion_proyecto_id)
  )
);

drop policy if exists planificacion_pendiente_historial_select
on public.planificacion_pendiente_historial;

create policy planificacion_pendiente_historial_select
on public.planificacion_pendiente_historial
for select to authenticated
using (public.can_view_planificacion_pending(pendiente_id));

grant select,insert,update,delete
on public.planificacion_pendientes
to authenticated;

grant select
on public.planificacion_pendiente_historial
to authenticated;

grant usage,select
on sequence public.planificacion_pendiente_codigo_seq
to authenticated;

select 'Etapa 17B aplicada correctamente' as resultado;
