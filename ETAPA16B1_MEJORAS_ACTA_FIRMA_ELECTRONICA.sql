-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 16B.1
-- MEJORAS DE ACTAS + FIRMA ELECTRÓNICA DE CONFORMIDAD
-- ============================================================

-- 1. Reunión: texto manual para 2.7 y token público para firmas.
alter table public.comite_sst_reuniones
  add column if not exists pendientes_adicionales jsonb not null default '[]'::jsonb,
  add column if not exists public_token uuid not null default gen_random_uuid(),
  add column if not exists firma_solicitada_at timestamptz;

create unique index if not exists ux_comite_sst_reuniones_public_token
on public.comite_sst_reuniones(public_token);

-- 2. Estado EN_FIRMA.
alter table public.comite_sst_reuniones
  drop constraint if exists comite_sst_reuniones_estado_check;

alter table public.comite_sst_reuniones
  add constraint comite_sst_reuniones_estado_check
  check (estado in ('BORRADOR','PROGRAMADA','EN_FIRMA','CERRADA'));

-- 3. Evidencia de conformidad electrónica por participante.
alter table public.comite_sst_reunion_asistentes
  add column if not exists firma_electronica text,
  add column if not exists consentimiento_firma boolean not null default false,
  add column if not exists consentimiento_texto text,
  add column if not exists firmado_at timestamptz,
  add column if not exists user_agent text;

create index if not exists idx_comite_reunion_asistentes_firmado
on public.comite_sst_reunion_asistentes(reunion_id,firmado_at);

-- 4. Habilitar etapa de firma.
create or replace function public.habilitar_firmas_reunion(
  p_reunion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.comite_sst_reuniones%rowtype;
  v_c public.comites_sst%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  select * into v_r
  from public.comite_sst_reuniones
  where id=p_reunion_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','No se encontró la reunión.');
  end if;

  select * into v_c
  from public.comites_sst
  where id=v_r.comite_id
  limit 1;

  if not (
    public.is_admin()
    or (
      v_c.tipo='SUBCOMITE'
      and v_c.proyecto_id is not null
      and public.can_manage_project(v_c.proyecto_id)
    )
  ) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para habilitar firmas.');
  end if;

  if v_r.estado='CERRADA' then
    return jsonb_build_object('ok',false,'error','La reunión ya se encuentra cerrada.');
  end if;

  if v_r.hora_fin is null then
    return jsonb_build_object(
      'ok',false,
      'error','Registra la hora real de culminación antes de solicitar las firmas.'
    );
  end if;

  update public.comite_sst_reuniones
  set estado='EN_FIRMA',
      firma_solicitada_at=coalesce(firma_solicitada_at,now())
  where id=p_reunion_id;

  return jsonb_build_object(
    'ok',true,
    'token',v_r.public_token,
    'message','La reunión quedó habilitada para firma electrónica.'
  );
end;
$$;

revoke all on function public.habilitar_firmas_reunion(uuid) from public;
grant execute on function public.habilitar_firmas_reunion(uuid) to authenticated;

-- 5. Obtener reunión pública para firma.
-- El DNI solo puede acceder si pertenece a la conformación y fue cargado como asistente.
create or replace function public.obtener_reunion_publica_firma(
  p_token uuid,
  p_dni text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.comite_sst_reuniones%rowtype;
  v_c public.comites_sst%rowtype;
  v_a record;
begin
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok',false,'error','Ingresa un DNI válido de 8 dígitos.');
  end if;

  select * into v_r
  from public.comite_sst_reuniones
  where public_token=p_token
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','El enlace no corresponde a una reunión válida.');
  end if;

  if v_r.estado not in ('EN_FIRMA','CERRADA') then
    return jsonb_build_object('ok',false,'error','La reunión todavía no se encuentra habilitada para firmas.');
  end if;

  select * into v_c
  from public.comites_sst
  where id=v_r.comite_id
  limit 1;

  select
    a.id as asistente_id,
    a.presente,
    a.consentimiento_firma,
    a.firmado_at,
    m.cargo_comite,
    m.representacion,
    w.id as trabajador_id,
    w.dni,
    w.nombres,
    w.apellidos,
    w.cargo,
    w.area
  into v_a
  from public.comite_sst_reunion_asistentes a
  join public.comite_sst_integrantes m on m.id=a.integrante_id
  join public.trabajadores w on w.id=m.trabajador_id
  where a.reunion_id=v_r.id
    and w.dni=p_dni
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok',false,
      'error','Tu DNI no figura entre los integrantes convocados a esta reunión.'
    );
  end if;

  if v_r.estado='CERRADA' and v_a.firmado_at is null then
    return jsonb_build_object(
      'ok',false,
      'error','La reunión ya fue cerrada y no admite nuevas firmas.'
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'reunion',jsonb_build_object(
      'id',v_r.id,
      'numero_acta',v_r.numero_acta,
      'fecha',v_r.fecha,
      'hora_inicio',v_r.hora_inicio,
      'hora_fin',v_r.hora_fin,
      'lugar',v_r.lugar,
      'tipo_reunion',v_r.tipo_reunion,
      'estado',v_r.estado,
      'agenda',v_r.agenda,
      'agenda_adicional',v_r.agenda_adicional
    ),
    'comite',jsonb_build_object(
      'tipo',v_c.tipo,
      'nombre',v_c.nombre,
      'codigo',v_c.codigo
    ),
    'participante',jsonb_build_object(
      'asistente_id',v_a.asistente_id,
      'dni',v_a.dni,
      'nombres',v_a.nombres,
      'apellidos',v_a.apellidos,
      'cargo',v_a.cargo,
      'area',v_a.area,
      'cargo_comite',v_a.cargo_comite,
      'representacion',v_a.representacion,
      'presente',v_a.presente,
      'firmado',v_a.firmado_at is not null,
      'firmado_at',v_a.firmado_at,
      'consentimiento',v_a.consentimiento_firma
    )
  );
end;
$$;

revoke all on function public.obtener_reunion_publica_firma(uuid,text) from public;
grant execute on function public.obtener_reunion_publica_firma(uuid,text) to anon,authenticated;

-- 6. Registrar firma electrónica manuscrita + consentimiento expreso.
create or replace function public.registrar_firma_reunion(
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
set search_path = ''
as $$
declare
  v_r public.comite_sst_reuniones%rowtype;
  v_a_id uuid;
  v_nombre text;
begin
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok',false,'error','Ingresa un DNI válido.');
  end if;

  if coalesce(p_consentimiento,false)=false then
    return jsonb_build_object(
      'ok',false,
      'error','Debes manifestar expresamente tu conformidad antes de firmar.'
    );
  end if;

  if p_firma is null
     or length(p_firma)<100
     or p_firma not like 'data:image/png;base64,%' then
    return jsonb_build_object('ok',false,'error','Registra tu firma en el recuadro.');
  end if;

  select * into v_r
  from public.comite_sst_reuniones
  where public_token=p_token
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','El enlace no es válido.');
  end if;

  if v_r.estado<>'EN_FIRMA' then
    return jsonb_build_object('ok',false,'error','La reunión ya no se encuentra disponible para firma.');
  end if;

  select a.id,
         concat_ws(' ',w.apellidos,w.nombres)
  into v_a_id,v_nombre
  from public.comite_sst_reunion_asistentes a
  join public.comite_sst_integrantes m on m.id=a.integrante_id
  join public.trabajadores w on w.id=m.trabajador_id
  where a.reunion_id=v_r.id
    and w.dni=p_dni
  limit 1;

  if v_a_id is null then
    return jsonb_build_object('ok',false,'error','No figuras como integrante convocado a esta reunión.');
  end if;

  if exists (
    select 1
    from public.comite_sst_reunion_asistentes
    where id=v_a_id
      and firmado_at is not null
  ) then
    return jsonb_build_object(
      'ok',false,
      'error','Tu firma ya fue registrada y no puede ser reemplazada desde el enlace público.'
    );
  end if;

  update public.comite_sst_reunion_asistentes
  set firma_electronica=p_firma,
      consentimiento_firma=true,
      consentimiento_texto=left(coalesce(p_consentimiento_texto,''),1000),
      firmado_at=now(),
      presente=true,
      user_agent=left(coalesce(p_user_agent,''),800)
  where id=v_a_id;

  return jsonb_build_object(
    'ok',true,
    'nombre',v_nombre,
    'numero_acta',v_r.numero_acta,
    'firmado_at',now(),
    'message','Tu conformidad y firma electrónica fueron registradas correctamente.'
  );
end;
$$;

revoke all on function public.registrar_firma_reunion(uuid,text,text,boolean,text,text) from public;
grant execute on function public.registrar_firma_reunion(uuid,text,text,boolean,text,text) to anon,authenticated;

select 'Etapa 16B.1 aplicada correctamente' as resultado;
