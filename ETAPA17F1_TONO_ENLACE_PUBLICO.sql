-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 17F.1 - TONO PERSONALIZADO + PLANIFICACIÓN PÚBLICA
-- ============================================================

create extension if not exists pgcrypto;

create sequence if not exists public.planificacion_sugerencia_codigo_seq start 1;

-- ------------------------------------------------------------
-- 1. Un enlace público por usuario propietario
-- ------------------------------------------------------------
create table if not exists public.planificacion_enlaces_publicos (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  propietario_id uuid not null references public.profiles(id) on delete cascade,
  nombre text not null default 'Planificación compartida',
  descripcion text,

  alcance text not null default 'MINE'
    check (alcance in ('MINE','CREATED','BOTH')),

  mostrar_descripcion boolean not null default false,
  mostrar_responsable boolean not null default true,
  mostrar_completados boolean not null default false,
  permitir_sugerencias boolean not null default true,

  activo boolean not null default true,
  fecha_expiracion timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(propietario_id)
);

create index if not exists idx_planificacion_enlaces_publicos_token
on public.planificacion_enlaces_publicos(token);

alter table public.planificacion_enlaces_publicos enable row level security;

drop policy if exists planificacion_enlaces_publicos_select
on public.planificacion_enlaces_publicos;

create policy planificacion_enlaces_publicos_select
on public.planificacion_enlaces_publicos
for select to authenticated
using (
  propietario_id=auth.uid()
  or public.is_admin()
);

drop policy if exists planificacion_enlaces_publicos_insert
on public.planificacion_enlaces_publicos;

create policy planificacion_enlaces_publicos_insert
on public.planificacion_enlaces_publicos
for insert to authenticated
with check (propietario_id=auth.uid());

drop policy if exists planificacion_enlaces_publicos_update
on public.planificacion_enlaces_publicos;

create policy planificacion_enlaces_publicos_update
on public.planificacion_enlaces_publicos
for update to authenticated
using (
  propietario_id=auth.uid()
  or public.is_admin()
)
with check (
  propietario_id=auth.uid()
  or public.is_admin()
);

drop policy if exists planificacion_enlaces_publicos_delete
on public.planificacion_enlaces_publicos;

create policy planificacion_enlaces_publicos_delete
on public.planificacion_enlaces_publicos
for delete to authenticated
using (
  propietario_id=auth.uid()
  or public.is_admin()
);

grant select,insert,update,delete
on public.planificacion_enlaces_publicos
to authenticated;

create or replace function public.touch_planificacion_enlace_publico()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_touch_planificacion_enlace_publico
on public.planificacion_enlaces_publicos;

create trigger trg_touch_planificacion_enlace_publico
before update on public.planificacion_enlaces_publicos
for each row execute function public.touch_planificacion_enlace_publico();

-- ------------------------------------------------------------
-- 2. Sugerencias recibidas desde el enlace público
-- ------------------------------------------------------------
create table if not exists public.planificacion_sugerencias_publicas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  enlace_id uuid not null references public.planificacion_enlaces_publicos(id) on delete cascade,

  solicitante_nombre text not null,
  solicitante_contacto text,

  titulo text not null,
  descripcion text,
  categoria text not null default 'SIG'
    check (categoria in (
      'PERSONAL','SIG','SST','AMBIENTAL','CALIDAD',
      'AUDITORIA','CLIENTE','OPERACIONES','COMITE_SST',
      'CAPACITACION','INDICADORES','OTRO'
    )),
  prioridad text not null default 'MEDIA'
    check (prioridad in ('BAJA','MEDIA','ALTA','CRITICA')),
  fecha_objetivo date not null,
  hora_objetivo time,
  comentario text,

  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE','APROBADA','RECHAZADA')),

  respuesta_usuario text,
  ticket_id uuid references public.planificacion_pendientes(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists idx_planificacion_sugerencias_enlace
on public.planificacion_sugerencias_publicas(enlace_id,estado,created_at desc);

create index if not exists idx_planificacion_sugerencias_estado
on public.planificacion_sugerencias_publicas(estado,created_at desc);

alter table public.planificacion_sugerencias_publicas enable row level security;

drop policy if exists planificacion_sugerencias_select
on public.planificacion_sugerencias_publicas;

create policy planificacion_sugerencias_select
on public.planificacion_sugerencias_publicas
for select to authenticated
using (
  exists(
    select 1
    from public.planificacion_enlaces_publicos e
    where e.id=enlace_id
      and (
        e.propietario_id=auth.uid()
        or public.is_admin()
      )
  )
);

grant select
on public.planificacion_sugerencias_publicas
to authenticated;

-- Trazabilidad opcional desde el ticket aprobado.
alter table public.planificacion_pendientes
  add column if not exists sugerencia_publica_id uuid
  references public.planificacion_sugerencias_publicas(id) on delete set null;

create unique index if not exists uq_planificacion_pendiente_sugerencia_publica
on public.planificacion_pendientes(sugerencia_publica_id)
where sugerencia_publica_id is not null;

-- ------------------------------------------------------------
-- 3. Código SOL-2026-0001
-- ------------------------------------------------------------
create or replace function public.set_planificacion_sugerencia_codigo()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.codigo is null or btrim(new.codigo)='' then
    new.codigo :=
      'SOL-'
      || extract(year from current_date)::int::text
      || '-'
      || lpad(nextval('public.planificacion_sugerencia_codigo_seq')::text,4,'0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_planificacion_sugerencia_codigo
on public.planificacion_sugerencias_publicas;

create trigger trg_set_planificacion_sugerencia_codigo
before insert on public.planificacion_sugerencias_publicas
for each row execute function public.set_planificacion_sugerencia_codigo();

grant usage,select
on sequence public.planificacion_sugerencia_codigo_seq
to authenticated;

-- ------------------------------------------------------------
-- 4. RPC pública: obtener tablero compartido
-- NO expone filas directamente a anon.
-- ------------------------------------------------------------
create or replace function public.obtener_planificacion_publica(
  p_token uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_link public.planificacion_enlaces_publicos%rowtype;
  v_tasks jsonb;
begin
  select *
  into v_link
  from public.planificacion_enlaces_publicos
  where token=p_token
  limit 1;

  if not found
     or v_link.activo=false
     or (v_link.fecha_expiracion is not null and v_link.fecha_expiracion<now())
  then
    return jsonb_build_object(
      'ok',false,
      'error','El enlace no existe, está desactivado o ha vencido.'
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'codigo',p.codigo,
        'titulo',p.titulo,
        'descripcion',case when v_link.mostrar_descripcion then p.descripcion else null end,
        'categoria',p.categoria,
        'prioridad',p.prioridad,
        'estado',p.estado,
        'responsable',case when v_link.mostrar_responsable then p.responsable_nombre else null end,
        'fecha_objetivo',p.fecha_objetivo,
        'hora_objetivo',p.hora_objetivo,
        'recurrente',(p.recurrencia_id is not null),
        'integrado',(p.origen_modulo is not null),
        'actualizado_at',p.updated_at
      )
      order by
        case when p.estado='COMPLETADO' then 2 else 1 end,
        p.fecha_objetivo asc,
        p.hora_objetivo asc nulls last,
        p.prioridad asc
    ),
    '[]'::jsonb
  )
  into v_tasks
  from public.planificacion_pendientes p
  where p.estado<>'CANCELADO'
    and (v_link.mostrar_completados or p.estado<>'COMPLETADO')
    and (
      (v_link.alcance='MINE' and (
        p.asignado_a_profile_id=v_link.propietario_id
        or (p.asignado_a_profile_id is null and p.created_by=v_link.propietario_id)
      ))
      or
      (v_link.alcance='CREATED' and p.created_by=v_link.propietario_id)
      or
      (v_link.alcance='BOTH' and (
        p.created_by=v_link.propietario_id
        or p.asignado_a_profile_id=v_link.propietario_id
      ))
    );

  return jsonb_build_object(
    'ok',true,
    'tablero',jsonb_build_object(
      'nombre',v_link.nombre,
      'descripcion',v_link.descripcion,
      'permitir_sugerencias',v_link.permitir_sugerencias,
      'mostrar_descripcion',v_link.mostrar_descripcion,
      'mostrar_responsable',v_link.mostrar_responsable
    ),
    'tareas',v_tasks,
    'actualizado_at',now()
  );
end;
$$;

revoke all on function public.obtener_planificacion_publica(uuid) from public;
grant execute on function public.obtener_planificacion_publica(uuid) to anon,authenticated;

-- ------------------------------------------------------------
-- 5. RPC pública: proponer una tarea
-- La propuesta NO entra a planificacion_pendientes.
-- ------------------------------------------------------------
create or replace function public.enviar_sugerencia_planificacion_publica(
  p_token uuid,
  p_solicitante_nombre text,
  p_solicitante_contacto text,
  p_titulo text,
  p_descripcion text,
  p_categoria text,
  p_prioridad text,
  p_fecha_objetivo date,
  p_hora_objetivo time,
  p_comentario text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_link public.planificacion_enlaces_publicos%rowtype;
  v_id uuid;
  v_codigo text;
  v_categoria text:=upper(btrim(coalesce(p_categoria,'SIG')));
  v_prioridad text:=upper(btrim(coalesce(p_prioridad,'MEDIA')));
  v_name text:=btrim(coalesce(p_solicitante_nombre,''));
  v_title text:=btrim(coalesce(p_titulo,''));
  v_recent integer;
begin
  select *
  into v_link
  from public.planificacion_enlaces_publicos
  where token=p_token
  limit 1;

  if not found
     or v_link.activo=false
     or (v_link.fecha_expiracion is not null and v_link.fecha_expiracion<now())
  then
    return jsonb_build_object('ok',false,'error','El enlace público no está disponible.');
  end if;

  if v_link.permitir_sugerencias=false then
    return jsonb_build_object('ok',false,'error','Este tablero no acepta nuevas propuestas.');
  end if;

  if length(v_name)<2 or length(v_name)>160 then
    return jsonb_build_object('ok',false,'error','Ingresa tu nombre o identificación.');
  end if;

  if length(v_title)<3 or length(v_title)>260 then
    return jsonb_build_object('ok',false,'error','El título debe tener entre 3 y 260 caracteres.');
  end if;

  if p_fecha_objetivo is null or p_fecha_objetivo<current_date then
    return jsonb_build_object('ok',false,'error','La fecha propuesta debe ser hoy o una fecha futura.');
  end if;

  if v_categoria not in (
    'PERSONAL','SIG','SST','AMBIENTAL','CALIDAD',
    'AUDITORIA','CLIENTE','OPERACIONES','COMITE_SST',
    'CAPACITACION','INDICADORES','OTRO'
  ) then
    v_categoria:='OTRO';
  end if;

  if v_prioridad not in ('BAJA','MEDIA','ALTA','CRITICA') then
    v_prioridad:='MEDIA';
  end if;

  -- Control básico de abuso: mismo nombre en el mismo tablero.
  select count(*)
  into v_recent
  from public.planificacion_sugerencias_publicas s
  where s.enlace_id=v_link.id
    and lower(s.solicitante_nombre)=lower(v_name)
    and s.created_at>now()-interval '10 minutes';

  if v_recent>=5 then
    return jsonb_build_object(
      'ok',false,
      'error','Se alcanzó el límite temporal de propuestas. Intenta nuevamente en unos minutos.'
    );
  end if;

  insert into public.planificacion_sugerencias_publicas(
    enlace_id,
    solicitante_nombre,
    solicitante_contacto,
    titulo,
    descripcion,
    categoria,
    prioridad,
    fecha_objetivo,
    hora_objetivo,
    comentario
  )
  values(
    v_link.id,
    v_name,
    nullif(btrim(coalesce(p_solicitante_contacto,'')),''),
    v_title,
    nullif(btrim(coalesce(p_descripcion,'')),''),
    v_categoria,
    v_prioridad,
    p_fecha_objetivo,
    p_hora_objetivo,
    nullif(btrim(coalesce(p_comentario,'')),'')
  )
  returning id,codigo into v_id,v_codigo;

  return jsonb_build_object(
    'ok',true,
    'id',v_id,
    'codigo',v_codigo,
    'message','La tarea fue enviada para aprobación. Aún no forma parte de la planificación oficial.'
  );
end;
$$;

revoke all on function public.enviar_sugerencia_planificacion_publica(
  uuid,text,text,text,text,text,text,date,time,text
) from public;

grant execute on function public.enviar_sugerencia_planificacion_publica(
  uuid,text,text,text,text,text,text,date,time,text
) to anon,authenticated;

-- ------------------------------------------------------------
-- 6. RPC: aprobar propuesta y convertirla en ticket oficial
-- ------------------------------------------------------------
create or replace function public.aprobar_sugerencia_planificacion(
  p_sugerencia_id uuid,
  p_titulo text,
  p_descripcion text,
  p_categoria text,
  p_prioridad text,
  p_fecha_objetivo date,
  p_hora_objetivo time,
  p_asignado_a_profile_id uuid,
  p_responsable_nombre text,
  p_respuesta text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_s public.planificacion_sugerencias_publicas%rowtype;
  v_link public.planificacion_enlaces_publicos%rowtype;
  v_ticket_id uuid;
  v_ticket_codigo text;
  v_categoria text:=upper(btrim(coalesce(p_categoria,'SIG')));
  v_prioridad text:=upper(btrim(coalesce(p_prioridad,'MEDIA')));
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  select * into v_s
  from public.planificacion_sugerencias_publicas
  where id=p_sugerencia_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','No se encontró la solicitud.');
  end if;

  select * into v_link
  from public.planificacion_enlaces_publicos
  where id=v_s.enlace_id
  limit 1;

  if v_link.propietario_id<>auth.uid() and not public.is_admin() then
    return jsonb_build_object('ok',false,'error','No tienes permiso para aprobar esta solicitud.');
  end if;

  if v_s.estado<>'PENDIENTE' then
    return jsonb_build_object('ok',false,'error','Esta solicitud ya fue revisada.');
  end if;

  if coalesce(btrim(p_titulo),'')='' then
    return jsonb_build_object('ok',false,'error','El título es obligatorio.');
  end if;

  if p_fecha_objetivo is null then
    return jsonb_build_object('ok',false,'error','La fecha objetivo es obligatoria.');
  end if;

  if coalesce(btrim(p_responsable_nombre),'')='' then
    return jsonb_build_object('ok',false,'error','El responsable es obligatorio.');
  end if;

  if v_categoria not in (
    'PERSONAL','SIG','SST','AMBIENTAL','CALIDAD',
    'AUDITORIA','CLIENTE','OPERACIONES','COMITE_SST',
    'CAPACITACION','INDICADORES','OTRO'
  ) then
    v_categoria:='OTRO';
  end if;

  if v_prioridad not in ('BAJA','MEDIA','ALTA','CRITICA') then
    v_prioridad:='MEDIA';
  end if;

  if p_asignado_a_profile_id is not null and not exists(
    select 1 from public.profiles p
    where p.id=p_asignado_a_profile_id
      and coalesce(p.activo,true)=true
  ) then
    return jsonb_build_object('ok',false,'error','El usuario asignado no está disponible.');
  end if;

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
    observaciones,
    recordatorios_habilitados,
    recordatorios_minutos,
    sugerencia_publica_id,
    ultimo_motivo_cambio,
    created_by,
    updated_by
  )
  values(
    btrim(p_titulo),
    nullif(btrim(coalesce(p_descripcion,'')),''),
    v_categoria,
    'OTRO',
    v_prioridad,
    'PENDIENTE',
    p_asignado_a_profile_id,
    btrim(p_responsable_nombre),
    p_fecha_objetivo,
    p_hora_objetivo,
    case
      when v_s.comentario is not null
      then 'Propuesta pública '||coalesce(v_s.codigo,'')||' · '||v_s.comentario
      else 'Propuesta pública '||coalesce(v_s.codigo,'')
    end,
    true,
    array[60,30,10,0]::integer[],
    v_s.id,
    'Ticket aprobado desde sugerencia pública '||coalesce(v_s.codigo,'')||'.',
    auth.uid(),
    auth.uid()
  )
  returning id,codigo into v_ticket_id,v_ticket_codigo;

  update public.planificacion_sugerencias_publicas
  set
    estado='APROBADA',
    respuesta_usuario=nullif(btrim(coalesce(p_respuesta,'')),''),
    ticket_id=v_ticket_id,
    reviewed_by=auth.uid(),
    reviewed_at=now()
  where id=v_s.id;

  return jsonb_build_object(
    'ok',true,
    'ticket_id',v_ticket_id,
    'ticket_codigo',v_ticket_codigo,
    'message','Solicitud aprobada y convertida en ticket.'
  );
end;
$$;

revoke all on function public.aprobar_sugerencia_planificacion(
  uuid,text,text,text,text,date,time,uuid,text,text
) from public;

grant execute on function public.aprobar_sugerencia_planificacion(
  uuid,text,text,text,text,date,time,uuid,text,text
) to authenticated;

-- ------------------------------------------------------------
-- 7. RPC: rechazar propuesta
-- ------------------------------------------------------------
create or replace function public.rechazar_sugerencia_planificacion(
  p_sugerencia_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_s public.planificacion_sugerencias_publicas%rowtype;
  v_owner uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  select *
  into v_s
  from public.planificacion_sugerencias_publicas
  where id=p_sugerencia_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','No se encontró la solicitud.');
  end if;

  select propietario_id
  into v_owner
  from public.planificacion_enlaces_publicos
  where id=v_s.enlace_id
  limit 1;

  if v_owner<>auth.uid() and not public.is_admin() then
    return jsonb_build_object('ok',false,'error','No tienes permiso para rechazar esta solicitud.');
  end if;

  if v_s.estado<>'PENDIENTE' then
    return jsonb_build_object('ok',false,'error','Esta solicitud ya fue revisada.');
  end if;

  update public.planificacion_sugerencias_publicas
  set
    estado='RECHAZADA',
    respuesta_usuario=nullif(btrim(coalesce(p_motivo,'')),''),
    reviewed_by=auth.uid(),
    reviewed_at=now()
  where id=p_sugerencia_id;

  return jsonb_build_object('ok',true,'message','Solicitud rechazada.');
end;
$$;

revoke all on function public.rechazar_sugerencia_planificacion(uuid,text) from public;
grant execute on function public.rechazar_sugerencia_planificacion(uuid,text) to authenticated;

-- ------------------------------------------------------------
-- 8. RPC: regenerar enlace público
-- ------------------------------------------------------------
create or replace function public.regenerar_token_planificacion_publica()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  update public.planificacion_enlaces_publicos
  set token=gen_random_uuid(),updated_at=now()
  where propietario_id=auth.uid()
  returning token into v_token;

  if v_token is null then
    return jsonb_build_object('ok',false,'error','Primero crea el enlace público.');
  end if;

  return jsonb_build_object(
    'ok',true,
    'token',v_token,
    'message','Se generó un nuevo enlace. El enlace anterior dejó de funcionar.'
  );
end;
$$;

revoke all on function public.regenerar_token_planificacion_publica() from public;
grant execute on function public.regenerar_token_planificacion_publica() to authenticated;

-- Recargar esquema para PostgREST.
notify pgrst, 'reload schema';

select 'Etapa 17F.1 aplicada correctamente' as resultado;
