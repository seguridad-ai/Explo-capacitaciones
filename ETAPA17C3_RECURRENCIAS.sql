-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 17C.3 - RECURRENCIAS DE PENDIENTES
-- ============================================================

create sequence if not exists public.planificacion_recurrencia_codigo_seq start 1;

-- ------------------------------------------------------------
-- 1. Reglas recurrentes
-- ------------------------------------------------------------
create table if not exists public.planificacion_recurrencias (
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

  asignado_a_profile_id uuid references public.profiles(id) on delete set null,
  responsable_nombre text not null,

  proyecto_id uuid references public.proyectos(id) on delete set null,
  planificacion_proyecto_id uuid references public.planificacion_proyectos(id) on delete set null,
  planificacion_actividad_id uuid references public.planificacion_actividades(id) on delete set null,

  frecuencia text not null default 'MENSUAL'
    check (frecuencia in ('DIARIA','SEMANAL','MENSUAL','TRIMESTRAL','ANUAL','PERSONALIZADA')),

  intervalo integer not null default 1
    check (intervalo between 1 and 365),

  personalizada_unidad text
    check (personalizada_unidad is null or personalizada_unidad in ('DIAS','SEMANAS','MESES')),

  dias_semana integer[] not null default '{}'::integer[],

  dia_mes integer
    check (dia_mes is null or dia_mes between 1 and 31),

  fecha_inicio date not null,
  fecha_fin date,
  hora_objetivo time,

  anticipacion_dias integer not null default 7
    check (anticipacion_dias between 0 and 60),

  recordatorios_habilitados boolean not null default true,
  recordatorios_minutos integer[] not null default array[60,30,10,0]::integer[],

  activo boolean not null default true,
  ultima_generacion date,

  created_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (fecha_fin is null or fecha_fin >= fecha_inicio),
  check (
    frecuencia <> 'PERSONALIZADA'
    or personalizada_unidad is not null
  )
);

create index if not exists idx_planificacion_recurrencias_activo
on public.planificacion_recurrencias(activo,fecha_inicio,fecha_fin);

create index if not exists idx_planificacion_recurrencias_asignado
on public.planificacion_recurrencias(asignado_a_profile_id);

create index if not exists idx_planificacion_recurrencias_created_by
on public.planificacion_recurrencias(created_by);

-- ------------------------------------------------------------
-- 2. Vincular tickets generados a su recurrencia
-- ------------------------------------------------------------
alter table public.planificacion_pendientes
  add column if not exists recurrencia_id uuid references public.planificacion_recurrencias(id) on delete set null,
  add column if not exists fecha_recurrencia date;

create index if not exists idx_planificacion_pendientes_recurrencia
on public.planificacion_pendientes(recurrencia_id,fecha_recurrencia);

create unique index if not exists uq_planificacion_pendiente_recurrencia_fecha
on public.planificacion_pendientes(recurrencia_id,fecha_recurrencia)
where recurrencia_id is not null and fecha_recurrencia is not null;

-- ------------------------------------------------------------
-- 3. Código REC-2026-0001
-- ------------------------------------------------------------
create or replace function public.set_planificacion_recurrencia_codigo()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.codigo is null or btrim(new.codigo)='' then
    new.codigo :=
      'REC-'
      || extract(year from new.fecha_inicio)::int::text
      || '-'
      || lpad(nextval('public.planificacion_recurrencia_codigo_seq')::text,4,'0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_planificacion_recurrencia_codigo
on public.planificacion_recurrencias;

create trigger trg_set_planificacion_recurrencia_codigo
before insert on public.planificacion_recurrencias
for each row execute function public.set_planificacion_recurrencia_codigo();

-- ------------------------------------------------------------
-- 4. updated_at / updated_by
-- ------------------------------------------------------------
create or replace function public.prepare_planificacion_recurrencia_update()
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
  return new;
end;
$$;

drop trigger if exists trg_prepare_planificacion_recurrencia_update
on public.planificacion_recurrencias;

create trigger trg_prepare_planificacion_recurrencia_update
before update on public.planificacion_recurrencias
for each row execute function public.prepare_planificacion_recurrencia_update();

-- ------------------------------------------------------------
-- 5. Permisos
-- ------------------------------------------------------------
create or replace function public.can_view_planificacion_recurrence(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.planificacion_recurrencias r
    where r.id=p_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or r.created_by=auth.uid()
        or r.asignado_a_profile_id=auth.uid()
        or (r.proyecto_id is not null and public.has_project_access(r.proyecto_id))
        or (
          r.planificacion_proyecto_id is not null
          and public.can_view_planificacion_project(r.planificacion_proyecto_id)
        )
      )
  );
$$;

create or replace function public.can_manage_planificacion_recurrence(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.planificacion_recurrencias r
    where r.id=p_id
      and (
        public.is_admin()
        or r.created_by=auth.uid()
        or (r.proyecto_id is not null and public.can_manage_project(r.proyecto_id))
        or (
          r.planificacion_proyecto_id is not null
          and public.can_manage_planificacion_project(r.planificacion_proyecto_id)
        )
      )
  );
$$;

grant execute on function public.can_view_planificacion_recurrence(uuid) to authenticated;
grant execute on function public.can_manage_planificacion_recurrence(uuid) to authenticated;

alter table public.planificacion_recurrencias enable row level security;

drop policy if exists planificacion_recurrencias_select
on public.planificacion_recurrencias;

create policy planificacion_recurrencias_select
on public.planificacion_recurrencias
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

drop policy if exists planificacion_recurrencias_insert
on public.planificacion_recurrencias;

create policy planificacion_recurrencias_insert
on public.planificacion_recurrencias
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

drop policy if exists planificacion_recurrencias_update
on public.planificacion_recurrencias;

create policy planificacion_recurrencias_update
on public.planificacion_recurrencias
for update to authenticated
using (public.can_manage_planificacion_recurrence(id))
with check (public.can_manage_planificacion_recurrence(id));

drop policy if exists planificacion_recurrencias_delete
on public.planificacion_recurrencias;

create policy planificacion_recurrencias_delete
on public.planificacion_recurrencias
for delete to authenticated
using (public.can_manage_planificacion_recurrence(id));

grant select,insert,update,delete
on public.planificacion_recurrencias
to authenticated;

grant usage,select
on sequence public.planificacion_recurrencia_codigo_seq
to authenticated;

-- ------------------------------------------------------------
-- 6. Evaluar si una fecha corresponde a una recurrencia
-- ------------------------------------------------------------
create or replace function public.planificacion_recurrencia_corresponde(
  p_fecha_inicio date,
  p_fecha date,
  p_frecuencia text,
  p_intervalo integer,
  p_personalizada_unidad text,
  p_dias_semana integer[],
  p_dia_mes integer
)
returns boolean
language plpgsql
immutable
set search_path=''
as $$
declare
  v_interval integer := greatest(coalesce(p_intervalo,1),1);
  v_days integer[];
  v_day_diff integer;
  v_week_diff integer;
  v_month_diff integer;
  v_year_diff integer;
  v_last_day date;
  v_target_day integer;
  v_unit text;
begin
  if p_fecha_inicio is null or p_fecha is null or p_fecha<p_fecha_inicio then
    return false;
  end if;

  v_day_diff := p_fecha-p_fecha_inicio;
  v_week_diff := (
    date_trunc('week',p_fecha)::date
    - date_trunc('week',p_fecha_inicio)::date
  )/7;
  v_month_diff :=
    (extract(year from p_fecha)::int-extract(year from p_fecha_inicio)::int)*12
    +(extract(month from p_fecha)::int-extract(month from p_fecha_inicio)::int);
  v_year_diff := extract(year from p_fecha)::int-extract(year from p_fecha_inicio)::int;
  v_last_day := (date_trunc('month',p_fecha)::date + interval '1 month - 1 day')::date;
  v_target_day := least(
    coalesce(p_dia_mes,extract(day from p_fecha_inicio)::int),
    extract(day from v_last_day)::int
  );
  v_days := case
    when coalesce(array_length(p_dias_semana,1),0)>0 then p_dias_semana
    else array[extract(isodow from p_fecha_inicio)::int]
  end;

  if p_frecuencia='DIARIA' then
    return mod(v_day_diff,v_interval)=0;

  elsif p_frecuencia='SEMANAL' then
    return mod(v_week_diff,v_interval)=0
      and extract(isodow from p_fecha)::int=any(v_days);

  elsif p_frecuencia='MENSUAL' then
    return mod(v_month_diff,v_interval)=0
      and extract(day from p_fecha)::int=v_target_day;

  elsif p_frecuencia='TRIMESTRAL' then
    return mod(v_month_diff,3*v_interval)=0
      and extract(day from p_fecha)::int=v_target_day;

  elsif p_frecuencia='ANUAL' then
    return mod(v_year_diff,v_interval)=0
      and extract(month from p_fecha)::int=extract(month from p_fecha_inicio)::int
      and extract(day from p_fecha)::int=v_target_day;

  elsif p_frecuencia='PERSONALIZADA' then
    v_unit := coalesce(p_personalizada_unidad,'DIAS');

    if v_unit='DIAS' then
      return mod(v_day_diff,v_interval)=0;
    elsif v_unit='SEMANAS' then
      return mod(v_week_diff,v_interval)=0
        and extract(isodow from p_fecha)::int=any(v_days);
    elsif v_unit='MESES' then
      return mod(v_month_diff,v_interval)=0
        and extract(day from p_fecha)::int=v_target_day;
    end if;
  end if;

  return false;
end;
$$;

grant execute on function public.planificacion_recurrencia_corresponde(date,date,text,integer,text,integer[],integer)
to authenticated;


-- Fecha operativa local para Perú (Supabase suele operar en UTC).
create or replace function public.planificacion_fecha_local()
returns date
language sql
stable
set search_path=''
as $$
  select (now() at time zone 'America/Lima')::date;
$$;

grant execute on function public.planificacion_fecha_local() to authenticated;

-- ------------------------------------------------------------
-- 7. Generar tickets de una recurrencia
-- ------------------------------------------------------------
create or replace function public.generar_planificacion_recurrencia(
  p_recurrencia_id uuid,
  p_hasta date default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.planificacion_recurrencias%rowtype;
  v_desde date;
  v_hasta date;
  v_fecha date;
  v_insertados integer := 0;
  v_total integer := 0;
begin
  select * into r
  from public.planificacion_recurrencias
  where id=p_recurrencia_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','No se encontró la recurrencia.');
  end if;

  if not (
    public.is_admin()
    or public.can_view_all_projects()
    or r.created_by=auth.uid()
    or r.asignado_a_profile_id=auth.uid()
    or (r.proyecto_id is not null and public.has_project_access(r.proyecto_id))
    or (
      r.planificacion_proyecto_id is not null
      and public.can_view_planificacion_project(r.planificacion_proyecto_id)
    )
  ) then
    return jsonb_build_object('ok',false,'error','No tienes acceso a esta recurrencia.');
  end if;

  if not r.activo then
    return jsonb_build_object('ok',true,'insertados',0,'message','La recurrencia está pausada.');
  end if;

  v_desde := greatest(
    r.fecha_inicio,
    coalesce(r.ultima_generacion+1,public.planificacion_fecha_local()),
    public.planificacion_fecha_local()-31
  );

  v_hasta := coalesce(p_hasta,public.planificacion_fecha_local()+r.anticipacion_dias);
  if r.fecha_fin is not null then
    v_hasta := least(v_hasta,r.fecha_fin);
  end if;

  if v_hasta<v_desde then
    return jsonb_build_object('ok',true,'insertados',0,'message','No existen ocurrencias nuevas en el horizonte actual.');
  end if;

  for v_fecha in
    select v_desde+gs
    from generate_series(0,v_hasta-v_desde) gs
  loop
    if public.planificacion_recurrencia_corresponde(
      r.fecha_inicio,
      v_fecha,
      r.frecuencia,
      r.intervalo,
      r.personalizada_unidad,
      r.dias_semana,
      r.dia_mes
    ) then
      insert into public.planificacion_pendientes(
        titulo,
        descripcion,
        categoria,
        origen,
        prioridad,
        estado,
        asignado_a_profile_id,
        responsable_nombre,
        fecha_objetivo,
        hora_objetivo,
        proyecto_id,
        planificacion_proyecto_id,
        planificacion_actividad_id,
        observaciones,
        recordatorios_habilitados,
        recordatorios_minutos,
        recurrencia_id,
        fecha_recurrencia,
        ultimo_motivo_cambio,
        created_by,
        updated_by
      )
      values(
        r.titulo,
        r.descripcion,
        r.categoria,
        r.origen,
        r.prioridad,
        'PENDIENTE',
        r.asignado_a_profile_id,
        r.responsable_nombre,
        v_fecha,
        r.hora_objetivo,
        r.proyecto_id,
        r.planificacion_proyecto_id,
        r.planificacion_actividad_id,
        'Generado automáticamente desde '||coalesce(r.codigo,'recurrencia')||'.',
        r.recordatorios_habilitados,
        r.recordatorios_minutos,
        r.id,
        v_fecha,
        'Generado automáticamente desde '||coalesce(r.codigo,'recurrencia')||'.',
        r.created_by,
        auth.uid()
      )
      on conflict do nothing;

      get diagnostics v_insertados = row_count;
      v_total := v_total + v_insertados;
    end if;
  end loop;

  update public.planificacion_recurrencias
  set ultima_generacion=v_hasta,
      updated_at=now(),
      updated_by=auth.uid()
  where id=r.id;

  return jsonb_build_object(
    'ok',true,
    'insertados',v_total,
    'hasta',v_hasta,
    'message','Recurrencia procesada correctamente.'
  );
end;
$$;

revoke all on function public.generar_planificacion_recurrencia(uuid,date) from public;
grant execute on function public.generar_planificacion_recurrencia(uuid,date) to authenticated;

-- ------------------------------------------------------------
-- 8. Generar todas las recurrencias visibles del usuario
-- ------------------------------------------------------------
create or replace function public.generar_planificacion_pendientes_recurrentes()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  r record;
  v_result jsonb;
  v_insertados integer := 0;
  v_reglas integer := 0;
begin
  for r in
    select id
    from public.planificacion_recurrencias pr
    where pr.activo=true
      and pr.fecha_inicio<=public.planificacion_fecha_local()+pr.anticipacion_dias
      and (pr.fecha_fin is null or pr.fecha_fin>=public.planificacion_fecha_local()-31)
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or pr.created_by=auth.uid()
        or pr.asignado_a_profile_id=auth.uid()
        or (pr.proyecto_id is not null and public.has_project_access(pr.proyecto_id))
        or (
          pr.planificacion_proyecto_id is not null
          and public.can_view_planificacion_project(pr.planificacion_proyecto_id)
        )
      )
  loop
    v_result := public.generar_planificacion_recurrencia(r.id,null);
    v_reglas := v_reglas+1;
    v_insertados := v_insertados + coalesce((v_result->>'insertados')::integer,0);
  end loop;

  return jsonb_build_object(
    'ok',true,
    'reglas',v_reglas,
    'insertados',v_insertados
  );
end;
$$;

revoke all on function public.generar_planificacion_pendientes_recurrentes() from public;
grant execute on function public.generar_planificacion_pendientes_recurrentes() to authenticated;

-- ------------------------------------------------------------
-- 9. Regenerar próximos tickets al modificar una regla
--    Solo elimina tickets futuros que siguen PENDIENTE.
-- ------------------------------------------------------------
create or replace function public.regenerar_planificacion_recurrencia(
  p_recurrencia_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.planificacion_recurrencias%rowtype;
  v_borrados integer := 0;
  v_result jsonb;
begin
  select * into r
  from public.planificacion_recurrencias
  where id=p_recurrencia_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','No se encontró la recurrencia.');
  end if;

  if not public.can_manage_planificacion_recurrence(p_recurrencia_id) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para modificar esta recurrencia.');
  end if;

  delete from public.planificacion_pendientes
  where recurrencia_id=p_recurrencia_id
    and fecha_recurrencia>=public.planificacion_fecha_local()
    and estado='PENDIENTE';

  get diagnostics v_borrados = row_count;

  update public.planificacion_recurrencias
  set ultima_generacion=public.planificacion_fecha_local()-1,
      updated_at=now(),
      updated_by=auth.uid()
  where id=p_recurrencia_id;

  if r.activo then
    v_result := public.generar_planificacion_recurrencia(p_recurrencia_id,null);
  else
    v_result := jsonb_build_object('ok',true,'insertados',0,'message','La recurrencia está pausada.');
  end if;

  return jsonb_build_object(
    'ok',true,
    'borrados',v_borrados,
    'insertados',coalesce((v_result->>'insertados')::integer,0),
    'message','Próximos tickets actualizados.'
  );
end;
$$;

revoke all on function public.regenerar_planificacion_recurrencia(uuid) from public;
grant execute on function public.regenerar_planificacion_recurrencia(uuid) to authenticated;


-- ------------------------------------------------------------
-- 10. Eliminar recurrencia conservando histórico
--     Retira solo tickets futuros que todavía siguen PENDIENTE.
-- ------------------------------------------------------------
create or replace function public.eliminar_planificacion_recurrencia(
  p_recurrencia_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.planificacion_recurrencias%rowtype;
  v_borrados integer := 0;
begin
  select * into r
  from public.planificacion_recurrencias
  where id=p_recurrencia_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','No se encontró la recurrencia.');
  end if;

  if not public.can_manage_planificacion_recurrence(p_recurrencia_id) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para eliminar esta recurrencia.');
  end if;

  delete from public.planificacion_pendientes
  where recurrencia_id=p_recurrencia_id
    and fecha_recurrencia>=public.planificacion_fecha_local()
    and estado='PENDIENTE';

  get diagnostics v_borrados = row_count;

  delete from public.planificacion_recurrencias
  where id=p_recurrencia_id;

  return jsonb_build_object(
    'ok',true,
    'borrados_futuros',v_borrados,
    'message','Recurrencia eliminada; se conservaron los tickets históricos.'
  );
end;
$$;

revoke all on function public.eliminar_planificacion_recurrencia(uuid) from public;
grant execute on function public.eliminar_planificacion_recurrencia(uuid) to authenticated;

select 'Etapa 17C.3 aplicada correctamente' as resultado;
