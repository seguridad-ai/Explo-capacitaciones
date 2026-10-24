-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 16D.2
-- LINK PÚBLICO + IDENTIFICACIÓN + FIRMA + PROGRESO DE VIDEOS
-- ============================================================

-- ------------------------------------------------------------
-- 1. Participantes de las capacitaciones del Comité/Subcomité
-- ------------------------------------------------------------
create table if not exists public.comite_sst_capacitacion_participantes (
  id uuid primary key default gen_random_uuid(),
  capacitacion_id uuid not null
    references public.comite_sst_capacitaciones(id) on delete cascade,
  integrante_id uuid not null
    references public.comite_sst_integrantes(id) on delete cascade,
  trabajador_id uuid not null
    references public.trabajadores(id) on delete restrict,
  firma_electronica text,
  consentimiento_firma boolean not null default false,
  consentimiento_texto text,
  firma_at timestamptz,
  inicio_at timestamptz,
  ultimo_acceso_at timestamptz,
  contenido_completado_at timestamptz,
  estado text not null default 'REGISTRADO'
    check (estado in ('REGISTRADO','EN_CURSO','CONTENIDO_COMPLETADO','FINALIZADO')),
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ux_comite_capacitacion_participante unique(capacitacion_id,trabajador_id)
);

create index if not exists idx_comite_cap_part_capacitacion
on public.comite_sst_capacitacion_participantes(capacitacion_id);

create index if not exists idx_comite_cap_part_trabajador
on public.comite_sst_capacitacion_participantes(trabajador_id);

-- ------------------------------------------------------------
-- 2. Progreso por video
-- ------------------------------------------------------------
create table if not exists public.comite_sst_capacitacion_video_progreso (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null
    references public.comite_sst_capacitacion_participantes(id) on delete cascade,
  video_id uuid not null
    references public.comite_sst_capacitacion_videos(id) on delete cascade,
  ultimo_segundo numeric(12,2) not null default 0,
  max_segundo numeric(12,2) not null default 0,
  porcentaje numeric(6,2) not null default 0
    check (porcentaje >= 0 and porcentaje <= 100),
  iniciado_at timestamptz,
  completado boolean not null default false,
  completado_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint ux_comite_cap_video_progreso unique(participante_id,video_id)
);

create index if not exists idx_comite_cap_video_progreso_participante
on public.comite_sst_capacitacion_video_progreso(participante_id);

create index if not exists idx_comite_cap_video_progreso_video
on public.comite_sst_capacitacion_video_progreso(video_id);

-- ------------------------------------------------------------
-- 3. updated_at
-- ------------------------------------------------------------
create or replace function public.touch_comite_sst_capacitacion_participante_updated_at()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_touch_comite_sst_cap_participantes
on public.comite_sst_capacitacion_participantes;

create trigger trg_touch_comite_sst_cap_participantes
before update on public.comite_sst_capacitacion_participantes
for each row execute function public.touch_comite_sst_capacitacion_participante_updated_at();

create or replace function public.touch_comite_sst_cap_video_progreso_updated_at()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_touch_comite_sst_cap_video_progreso
on public.comite_sst_capacitacion_video_progreso;

create trigger trg_touch_comite_sst_cap_video_progreso
before update on public.comite_sst_capacitacion_video_progreso
for each row execute function public.touch_comite_sst_cap_video_progreso_updated_at();

-- ============================================================
-- 4. RLS - ADMINISTRACIÓN INTERNA
-- Los participantes públicos trabajan únicamente por RPC.
-- ============================================================
alter table public.comite_sst_capacitacion_participantes enable row level security;
alter table public.comite_sst_capacitacion_video_progreso enable row level security;

drop policy if exists comite_cap_participantes_select
on public.comite_sst_capacitacion_participantes;

create policy comite_cap_participantes_select
on public.comite_sst_capacitacion_participantes
for select to authenticated
using (
  exists (
    select 1
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id=capacitacion_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.has_project_access(c.proyecto_id)
        )
      )
  )
);

drop policy if exists comite_cap_participantes_manage
on public.comite_sst_capacitacion_participantes;

create policy comite_cap_participantes_manage
on public.comite_sst_capacitacion_participantes
for all to authenticated
using (
  exists (
    select 1
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id=capacitacion_id
      and (
        public.is_admin()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.can_manage_project(c.proyecto_id)
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id=capacitacion_id
      and (
        public.is_admin()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.can_manage_project(c.proyecto_id)
        )
      )
  )
);

drop policy if exists comite_cap_video_progreso_select
on public.comite_sst_capacitacion_video_progreso;

create policy comite_cap_video_progreso_select
on public.comite_sst_capacitacion_video_progreso
for select to authenticated
using (
  exists (
    select 1
    from public.comite_sst_capacitacion_participantes p
    join public.comite_sst_capacitaciones cap on cap.id=p.capacitacion_id
    join public.comites_sst c on c.id=cap.comite_id
    where p.id=participante_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.has_project_access(c.proyecto_id)
        )
      )
  )
);

drop policy if exists comite_cap_video_progreso_manage
on public.comite_sst_capacitacion_video_progreso;

create policy comite_cap_video_progreso_manage
on public.comite_sst_capacitacion_video_progreso
for all to authenticated
using (
  exists (
    select 1
    from public.comite_sst_capacitacion_participantes p
    join public.comite_sst_capacitaciones cap on cap.id=p.capacitacion_id
    join public.comites_sst c on c.id=cap.comite_id
    where p.id=participante_id
      and (
        public.is_admin()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.can_manage_project(c.proyecto_id)
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.comite_sst_capacitacion_participantes p
    join public.comite_sst_capacitaciones cap on cap.id=p.capacitacion_id
    join public.comites_sst c on c.id=cap.comite_id
    where p.id=participante_id
      and (
        public.is_admin()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.can_manage_project(c.proyecto_id)
        )
      )
  )
);

grant select,insert,update,delete
on public.comite_sst_capacitacion_participantes
 to authenticated;

grant select,insert,update,delete
on public.comite_sst_capacitacion_video_progreso
 to authenticated;

-- ============================================================
-- 5. RPC PÚBLICO: IDENTIFICACIÓN + DATOS + PROGRESO
-- ============================================================
create or replace function public.obtener_capacitacion_comite_publica(
  p_token uuid,
  p_dni text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_cap public.comite_sst_capacitaciones%rowtype;
  v_comite public.comites_sst%rowtype;
  v_member record;
  v_part public.comite_sst_capacitacion_participantes%rowtype;
  v_videos jsonb;
  v_total_obligatorios integer := 0;
  v_completados_obligatorios integer := 0;
  v_total_videos integer := 0;
  v_completados_videos integer := 0;
begin
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok',false,'error','Ingresa un DNI válido de 8 dígitos.');
  end if;

  select * into v_cap
  from public.comite_sst_capacitaciones
  where public_token=p_token
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','El enlace no corresponde a una capacitación válida.');
  end if;

  if v_cap.estado<>'LISTA' then
    return jsonb_build_object('ok',false,'error','Esta capacitación todavía no se encuentra disponible para los integrantes.');
  end if;

  select * into v_comite
  from public.comites_sst
  where id=v_cap.comite_id
  limit 1;

  select
    i.id as integrante_id,
    i.cargo_comite,
    i.representacion,
    i.condicion,
    w.id as trabajador_id,
    w.dni,
    w.nombres,
    w.apellidos,
    w.cargo,
    w.area,
    w.activo as trabajador_activo
  into v_member
  from public.comite_sst_integrantes i
  join public.trabajadores w on w.id=i.trabajador_id
  where i.comite_id=v_cap.comite_id
    and w.dni=p_dni
    and i.activo=true
    and (i.fecha_fin is null or i.fecha_fin>=current_date)
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok',false,
      'error','Tu DNI no figura entre los integrantes activos del Comité/Subcomité asignado a esta capacitación.'
    );
  end if;

  if coalesce(v_member.trabajador_activo,false)=false then
    return jsonb_build_object('ok',false,'error','El trabajador se encuentra inactivo en la base maestra.');
  end if;

  select * into v_part
  from public.comite_sst_capacitacion_participantes
  where capacitacion_id=v_cap.id
    and trabajador_id=v_member.trabajador_id
  limit 1;

  if v_part.id is not null then
    update public.comite_sst_capacitacion_participantes
    set ultimo_acceso_at=now()
    where id=v_part.id;
  end if;

  select count(*) into v_total_videos
  from public.comite_sst_capacitacion_videos
  where capacitacion_id=v_cap.id;

  if v_total_videos=0 then
    return jsonb_build_object('ok',false,'error','La capacitación no tiene contenido audiovisual configurado.');
  end if;

  select count(*) into v_total_obligatorios
  from public.comite_sst_capacitacion_videos
  where capacitacion_id=v_cap.id
    and obligatorio=true;

  if v_part.id is not null then
    select count(*) into v_completados_videos
    from public.comite_sst_capacitacion_video_progreso pr
    join public.comite_sst_capacitacion_videos v on v.id=pr.video_id
    where pr.participante_id=v_part.id
      and v.capacitacion_id=v_cap.id
      and pr.completado=true;

    select count(*) into v_completados_obligatorios
    from public.comite_sst_capacitacion_video_progreso pr
    join public.comite_sst_capacitacion_videos v on v.id=pr.video_id
    where pr.participante_id=v_part.id
      and v.capacitacion_id=v_cap.id
      and v.obligatorio=true
      and pr.completado=true;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',v.id,
      'orden',v.orden,
      'titulo',v.titulo,
      'descripcion',v.descripcion,
      'tipo_fuente',v.tipo_fuente,
      'bloqueado',(
        v_part.id is null
        or v_part.firma_at is null
        or v_part.consentimiento_firma=false
        or exists (
          select 1
          from public.comite_sst_capacitacion_videos prev
          left join public.comite_sst_capacitacion_video_progreso prev_pr
            on prev_pr.video_id=prev.id
           and prev_pr.participante_id=v_part.id
          where prev.capacitacion_id=v_cap.id
            and prev.orden<v.orden
            and prev.obligatorio=true
            and coalesce(prev_pr.completado,false)=false
        )
      ),
      'url',case
        when v.tipo_fuente='MP4_UPLOAD' then null
        when v_part.id is null or v_part.firma_at is null or v_part.consentimiento_firma=false then null
        when exists (
          select 1
          from public.comite_sst_capacitacion_videos prev
          left join public.comite_sst_capacitacion_video_progreso prev_pr
            on prev_pr.video_id=prev.id
           and prev_pr.participante_id=v_part.id
          where prev.capacitacion_id=v_cap.id
            and prev.orden<v.orden
            and prev.obligatorio=true
            and coalesce(prev_pr.completado,false)=false
        ) then null
        else v.url
      end,
      'duracion_minutos',v.duracion_minutos,
      'obligatorio',v.obligatorio,
      'ultimo_segundo',coalesce(pr.ultimo_segundo,0),
      'max_segundo',coalesce(pr.max_segundo,0),
      'porcentaje',coalesce(pr.porcentaje,0),
      'iniciado_at',pr.iniciado_at,
      'completado',coalesce(pr.completado,false),
      'completado_at',pr.completado_at
    ) order by v.orden
  ),'[]'::jsonb)
  into v_videos
  from public.comite_sst_capacitacion_videos v
  left join public.comite_sst_capacitacion_video_progreso pr
    on pr.video_id=v.id
   and v_part.id is not null
   and pr.participante_id=v_part.id
  where v.capacitacion_id=v_cap.id;

  return jsonb_build_object(
    'ok',true,
    'capacitacion',jsonb_build_object(
      'id',v_cap.id,
      'codigo',v_cap.codigo,
      'titulo',v_cap.titulo,
      'descripcion',v_cap.descripcion,
      'objetivo',v_cap.objetivo,
      'expositor',v_cap.expositor,
      'cargo_expositor',v_cap.cargo_expositor,
      'fecha',v_cap.fecha,
      'duracion_horas',v_cap.duracion_horas,
      'nota_minima',v_cap.nota_minima,
      'max_intentos',v_cap.max_intentos,
      'estado',v_cap.estado
    ),
    'comite',jsonb_build_object(
      'id',v_comite.id,
      'codigo',v_comite.codigo,
      'tipo',v_comite.tipo,
      'nombre',v_comite.nombre,
      'sede_id',v_comite.sede_id,
      'proyecto_id',v_comite.proyecto_id
    ),
    'integrante',jsonb_build_object(
      'integrante_id',v_member.integrante_id,
      'trabajador_id',v_member.trabajador_id,
      'dni',v_member.dni,
      'nombres',v_member.nombres,
      'apellidos',v_member.apellidos,
      'cargo',v_member.cargo,
      'area',v_member.area,
      'cargo_comite',v_member.cargo_comite,
      'representacion',v_member.representacion,
      'condicion',v_member.condicion
    ),
    'participacion',case when v_part.id is null then null else jsonb_build_object(
      'id',v_part.id,
      'firmado',v_part.firma_at is not null and v_part.consentimiento_firma=true,
      'firma_at',v_part.firma_at,
      'estado',v_part.estado,
      'inicio_at',v_part.inicio_at,
      'contenido_completado_at',v_part.contenido_completado_at
    ) end,
    'videos',v_videos,
    'resumen',jsonb_build_object(
      'total_videos',v_total_videos,
      'completados_videos',v_completados_videos,
      'total_obligatorios',v_total_obligatorios,
      'completados_obligatorios',v_completados_obligatorios,
      'contenido_completado',(
        case
          when v_total_obligatorios>0 then v_completados_obligatorios>=v_total_obligatorios
          else v_total_videos>0 and v_completados_videos>=v_total_videos
        end
      )
    )
  );
end;
$$;

revoke all on function public.obtener_capacitacion_comite_publica(uuid,text) from public;
grant execute on function public.obtener_capacitacion_comite_publica(uuid,text) to anon,authenticated;

-- ============================================================
-- 6. RPC PÚBLICO: FIRMA ANTES DEL CONTENIDO
-- ============================================================
create or replace function public.registrar_firma_capacitacion_comite(
  p_token uuid,
  p_dni text,
  p_firma text,
  p_consentimiento boolean,
  p_consentimiento_texto text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_cap public.comite_sst_capacitaciones%rowtype;
  v_member record;
  v_part public.comite_sst_capacitacion_participantes%rowtype;
begin
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok',false,'error','Ingresa un DNI válido.');
  end if;

  if coalesce(p_consentimiento,false)=false then
    return jsonb_build_object('ok',false,'error','Debes marcar la casilla de conformidad antes de registrar tu firma.');
  end if;

  if p_firma is null
     or length(p_firma)<100
     or p_firma not like 'data:image/png;base64,%' then
    return jsonb_build_object('ok',false,'error','Registra tu firma dentro del recuadro.');
  end if;

  select * into v_cap
  from public.comite_sst_capacitaciones
  where public_token=p_token
  limit 1;

  if not found or v_cap.estado<>'LISTA' then
    return jsonb_build_object('ok',false,'error','La capacitación no se encuentra disponible.');
  end if;

  select
    i.id as integrante_id,
    w.id as trabajador_id,
    w.activo as trabajador_activo
  into v_member
  from public.comite_sst_integrantes i
  join public.trabajadores w on w.id=i.trabajador_id
  where i.comite_id=v_cap.comite_id
    and w.dni=p_dni
    and i.activo=true
    and (i.fecha_fin is null or i.fecha_fin>=current_date)
  limit 1;

  if not found or coalesce(v_member.trabajador_activo,false)=false then
    return jsonb_build_object('ok',false,'error','No figuras como integrante activo de esta conformación.');
  end if;

  select * into v_part
  from public.comite_sst_capacitacion_participantes
  where capacitacion_id=v_cap.id
    and trabajador_id=v_member.trabajador_id
  limit 1;

  if v_part.id is not null and v_part.firma_at is not null and v_part.consentimiento_firma=true then
    return jsonb_build_object(
      'ok',true,
      'already_signed',true,
      'participante_id',v_part.id,
      'message','Tu firma ya se encontraba registrada. Puedes continuar con los videos.'
    );
  end if;

  if v_part.id is null then
    insert into public.comite_sst_capacitacion_participantes(
      capacitacion_id,
      integrante_id,
      trabajador_id,
      firma_electronica,
      consentimiento_firma,
      consentimiento_texto,
      firma_at,
      inicio_at,
      ultimo_acceso_at,
      estado,
      user_agent
    ) values (
      v_cap.id,
      v_member.integrante_id,
      v_member.trabajador_id,
      p_firma,
      true,
      left(coalesce(p_consentimiento_texto,''),1500),
      now(),
      now(),
      now(),
      'EN_CURSO',
      left(coalesce(p_user_agent,''),800)
    )
    returning * into v_part;
  else
    update public.comite_sst_capacitacion_participantes
    set integrante_id=v_member.integrante_id,
        firma_electronica=p_firma,
        consentimiento_firma=true,
        consentimiento_texto=left(coalesce(p_consentimiento_texto,''),1500),
        firma_at=now(),
        inicio_at=coalesce(inicio_at,now()),
        ultimo_acceso_at=now(),
        estado=case when estado='FINALIZADO' then estado else 'EN_CURSO' end,
        user_agent=left(coalesce(p_user_agent,''),800)
    where id=v_part.id
    returning * into v_part;
  end if;

  insert into public.comite_sst_capacitacion_video_progreso(
    participante_id,video_id
  )
  select v_part.id,v.id
  from public.comite_sst_capacitacion_videos v
  where v.capacitacion_id=v_cap.id
  on conflict(participante_id,video_id) do nothing;

  return jsonb_build_object(
    'ok',true,
    'already_signed',false,
    'participante_id',v_part.id,
    'message','Firma registrada correctamente. Ya puedes iniciar el contenido.'
  );
end;
$$;

revoke all on function public.registrar_firma_capacitacion_comite(uuid,text,text,boolean,text,text) from public;
grant execute on function public.registrar_firma_capacitacion_comite(uuid,text,text,boolean,text,text) to anon,authenticated;

-- ============================================================
-- 7. RPC PÚBLICO: GUARDAR PROGRESO Y CONTROL SECUENCIAL
-- ============================================================
create or replace function public.actualizar_progreso_video_comite(
  p_token uuid,
  p_dni text,
  p_video_id uuid,
  p_ultimo_segundo numeric,
  p_max_segundo numeric,
  p_porcentaje numeric,
  p_completado boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_cap public.comite_sst_capacitaciones%rowtype;
  v_video public.comite_sst_capacitacion_videos%rowtype;
  v_part public.comite_sst_capacitacion_participantes%rowtype;
  v_worker_id uuid;
  v_progress public.comite_sst_capacitacion_video_progreso%rowtype;
  v_locked boolean := false;
  v_can_complete boolean := false;
  v_total_obligatorios integer := 0;
  v_completados_obligatorios integer := 0;
  v_total_videos integer := 0;
  v_completados_videos integer := 0;
  v_content_done boolean := false;
begin
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok',false,'error','DNI no válido.');
  end if;

  select * into v_cap
  from public.comite_sst_capacitaciones
  where public_token=p_token
  limit 1;

  if not found or v_cap.estado<>'LISTA' then
    return jsonb_build_object('ok',false,'error','La capacitación no se encuentra disponible.');
  end if;

  select w.id into v_worker_id
  from public.comite_sst_integrantes i
  join public.trabajadores w on w.id=i.trabajador_id
  where i.comite_id=v_cap.comite_id
    and i.activo=true
    and (i.fecha_fin is null or i.fecha_fin>=current_date)
    and w.activo=true
    and w.dni=p_dni
  limit 1;

  if v_worker_id is null then
    return jsonb_build_object('ok',false,'error','No figuras como integrante activo de esta capacitación.');
  end if;

  select * into v_part
  from public.comite_sst_capacitacion_participantes
  where capacitacion_id=v_cap.id
    and trabajador_id=v_worker_id
  limit 1;

  if v_part.id is null or v_part.firma_at is null or v_part.consentimiento_firma=false then
    return jsonb_build_object('ok',false,'error','Debes registrar tu firma antes de iniciar los videos.');
  end if;

  select * into v_video
  from public.comite_sst_capacitacion_videos
  where id=p_video_id
    and capacitacion_id=v_cap.id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','El video no pertenece a esta capacitación.');
  end if;

  -- Un video queda bloqueado si existe un video obligatorio anterior no completado.
  select exists (
    select 1
    from public.comite_sst_capacitacion_videos prev
    left join public.comite_sst_capacitacion_video_progreso pr
      on pr.video_id=prev.id
     and pr.participante_id=v_part.id
    where prev.capacitacion_id=v_cap.id
      and prev.orden<v_video.orden
      and prev.obligatorio=true
      and coalesce(pr.completado,false)=false
  ) into v_locked;

  if v_locked then
    return jsonb_build_object('ok',false,'locked',true,'error','Completa primero los videos obligatorios anteriores.');
  end if;

  insert into public.comite_sst_capacitacion_video_progreso(
    participante_id,
    video_id,
    ultimo_segundo,
    max_segundo,
    porcentaje,
    iniciado_at,
    completado
  ) values (
    v_part.id,
    v_video.id,
    greatest(coalesce(p_ultimo_segundo,0),0),
    greatest(coalesce(p_max_segundo,0),coalesce(p_ultimo_segundo,0),0),
    least(greatest(coalesce(p_porcentaje,0),0),100),
    now(),
    false
  )
  on conflict(participante_id,video_id) do update
  set ultimo_segundo=greatest(coalesce(excluded.ultimo_segundo,0),0),
      max_segundo=greatest(
        public.comite_sst_capacitacion_video_progreso.max_segundo,
        coalesce(excluded.max_segundo,0),
        coalesce(excluded.ultimo_segundo,0)
      ),
      porcentaje=greatest(
        public.comite_sst_capacitacion_video_progreso.porcentaje,
        least(greatest(coalesce(excluded.porcentaje,0),0),100)
      ),
      iniciado_at=coalesce(public.comite_sst_capacitacion_video_progreso.iniciado_at,now())
  returning * into v_progress;

  -- La finalización pública se acepta a partir de 97% reportado.
  v_can_complete := coalesce(p_completado,false)=true
                    and greatest(v_progress.porcentaje,coalesce(p_porcentaje,0))>=97;

  if v_can_complete and v_progress.completado=false then
    update public.comite_sst_capacitacion_video_progreso
    set completado=true,
        porcentaje=100,
        completado_at=now(),
        max_segundo=greatest(max_segundo,coalesce(p_max_segundo,0),coalesce(p_ultimo_segundo,0))
    where id=v_progress.id
    returning * into v_progress;
  end if;

  update public.comite_sst_capacitacion_participantes
  set ultimo_acceso_at=now(),
      estado=case when estado='REGISTRADO' then 'EN_CURSO' else estado end
  where id=v_part.id;

  select count(*) into v_total_obligatorios
  from public.comite_sst_capacitacion_videos
  where capacitacion_id=v_cap.id
    and obligatorio=true;

  select count(*) into v_completados_obligatorios
  from public.comite_sst_capacitacion_video_progreso pr
  join public.comite_sst_capacitacion_videos v on v.id=pr.video_id
  where pr.participante_id=v_part.id
    and v.capacitacion_id=v_cap.id
    and v.obligatorio=true
    and pr.completado=true;

  select count(*) into v_total_videos
  from public.comite_sst_capacitacion_videos
  where capacitacion_id=v_cap.id;

  select count(*) into v_completados_videos
  from public.comite_sst_capacitacion_video_progreso pr
  join public.comite_sst_capacitacion_videos v on v.id=pr.video_id
  where pr.participante_id=v_part.id
    and v.capacitacion_id=v_cap.id
    and pr.completado=true;

  v_content_done := case
    when v_total_obligatorios>0 then v_completados_obligatorios>=v_total_obligatorios
    else v_total_videos>0 and v_completados_videos>=v_total_videos
  end;

  if v_content_done then
    update public.comite_sst_capacitacion_participantes
    set estado=case when estado='FINALIZADO' then estado else 'CONTENIDO_COMPLETADO' end,
        contenido_completado_at=coalesce(contenido_completado_at,now()),
        ultimo_acceso_at=now()
    where id=v_part.id;
  end if;

  return jsonb_build_object(
    'ok',true,
    'video_id',v_video.id,
    'ultimo_segundo',v_progress.ultimo_segundo,
    'max_segundo',v_progress.max_segundo,
    'porcentaje',v_progress.porcentaje,
    'completado',v_progress.completado,
    'completado_at',v_progress.completado_at,
    'contenido_completado',v_content_done,
    'total_obligatorios',v_total_obligatorios,
    'completados_obligatorios',v_completados_obligatorios
  );
end;
$$;

revoke all on function public.actualizar_progreso_video_comite(uuid,text,uuid,numeric,numeric,numeric,boolean) from public;
grant execute on function public.actualizar_progreso_video_comite(uuid,text,uuid,numeric,numeric,numeric,boolean) to anon,authenticated;

select 'Etapa 16D.2 aplicada correctamente' as resultado;
