-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 17D - INTEGRACIONES AUTOMÁTICAS CON PLANIFICACIÓN
-- ============================================================

-- 1. Trazabilidad del origen del ticket.
alter table public.planificacion_pendientes
  add column if not exists origen_modulo text,
  add column if not exists origen_registro_id uuid,
  add column if not exists origen_registro_codigo text,
  add column if not exists origen_sincronizado_at timestamptz;

alter table public.planificacion_pendientes
  drop constraint if exists planificacion_pendientes_origen_modulo_check;

alter table public.planificacion_pendientes
  add constraint planificacion_pendientes_origen_modulo_check
  check (
    origen_modulo is null
    or origen_modulo in (
      'CAPACITACION',
      'INDUCCION',
      'COMITE_REUNION',
      'COMITE_ACUERDO',
      'COMITE_CAPACITACION'
    )
  );

create index if not exists idx_planificacion_pendientes_origen_modulo
on public.planificacion_pendientes(origen_modulo,origen_registro_id);

create unique index if not exists uq_planificacion_pendiente_origen
on public.planificacion_pendientes(origen_modulo,origen_registro_id)
where origen_modulo is not null and origen_registro_id is not null;

-- ------------------------------------------------------------
-- 2. RPC: crear o sincronizar un ticket desde un módulo origen.
-- SECURITY INVOKER: respeta RLS del usuario que ejecuta la acción.
-- ------------------------------------------------------------
create or replace function public.planificar_desde_origen(
  p_modulo text,
  p_origen_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_modulo text := upper(btrim(coalesce(p_modulo,'')));
  v_ticket_id uuid;
  v_ticket_codigo text;

  v_title text;
  v_desc text;
  v_responsible text;
  v_code text;
  v_category text := 'SIG';
  v_origin text := 'OTRO';
  v_priority text := 'MEDIA';
  v_status text := 'PENDIENTE';
  v_date date;
  v_time time;
  v_project uuid;

  v_state text;
  v_act text;
  v_meeting_number text;
  v_committee_name text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  if v_modulo not in ('CAPACITACION','INDUCCION','COMITE_REUNION','COMITE_ACUERDO','COMITE_CAPACITACION') then
    return jsonb_build_object('ok',false,'error','Módulo de integración no válido.');
  end if;

  if v_modulo='CAPACITACION' then
    select
      c.tema,
      c.codigo,
      c.fecha,
      c.estado,
      coalesce(nullif(btrim(c.responsable_nombre),''),nullif(btrim(c.expositor_nombre),''),'Responsable de capacitación'),
      c.proyecto_id
    into v_title,v_code,v_date,v_state,v_responsible,v_project
    from public.capacitaciones c
    where c.id=p_origen_id
    limit 1;

    if not found then
      return jsonb_build_object('ok',false,'error','No se encontró la capacitación o no tienes acceso.');
    end if;

    v_title := 'Capacitación · ' || coalesce(v_title,'Sin tema');
    v_desc := 'Actividad generada desde el módulo Capacitaciones. Código: ' || coalesce(v_code,'—') || '.';
    v_category := 'CAPACITACION';
    v_origin := 'CAPACITACION';
    v_time := time '09:00';

    if upper(coalesce(v_state,''))='FINALIZADA' then v_status:='COMPLETADO';
    elsif upper(coalesce(v_state,''))='CANCELADA' then v_status:='CANCELADO';
    else v_status:='PENDIENTE';
    end if;

  elsif v_modulo='INDUCCION' then
    select
      coalesce(i.tema,i.titulo),
      i.codigo,
      coalesce(i.fecha_dia1,i.fecha),
      i.estado,
      coalesce(nullif(btrim(i.expositor),''),'Responsable de inducción'),
      i.proyecto_id,
      i.tipo
    into v_title,v_code,v_date,v_state,v_responsible,v_project,v_act
    from public.inducciones i
    where i.id=p_origen_id
    limit 1;

    if not found then
      return jsonb_build_object('ok',false,'error','No se encontró la inducción o no tienes acceso.');
    end if;

    v_title := 'Inducción ' || case when v_act='PROYECTO' then 'de proyecto' else 'Sede Lima' end || ' · ' || coalesce(v_title,'Sin tema');
    v_desc := 'Actividad generada desde el módulo Inducciones. Código: ' || coalesce(v_code,'—') || '.';
    v_category := 'CAPACITACION';
    v_origin := 'CAPACITACION';
    v_time := time '09:00';
    v_status := case when upper(coalesce(v_state,''))='CERRADA' then 'COMPLETADO' else 'PENDIENTE' end;

  elsif v_modulo='COMITE_REUNION' then
    select
      r.numero_acta,
      r.fecha,
      r.hora_inicio,
      r.estado,
      r.tipo_reunion,
      c.nombre,
      c.proyecto_id
    into v_meeting_number,v_date,v_time,v_state,v_act,v_committee_name,v_project
    from public.comite_sst_reuniones r
    join public.comites_sst c on c.id=r.comite_id
    where r.id=p_origen_id
    limit 1;

    if not found then
      return jsonb_build_object('ok',false,'error','No se encontró la reunión o no tienes acceso.');
    end if;

    v_code := 'Acta ' || coalesce(v_meeting_number,'S/N');
    v_title := 'Reunión ' || lower(coalesce(v_act,'ORDINARIA')) || ' · ' || coalesce(v_committee_name,'Comité SST');
    v_responsible := coalesce(v_committee_name,'Comité SST');
    v_desc := 'Reunión programada del Comité/Subcomité SST. ' || v_code || '.';
    v_category := 'COMITE_SST';
    v_origin := 'COMITE_SST';
    v_priority := case when v_date<=current_date+3 then 'ALTA' else 'MEDIA' end;
    v_status := case when upper(coalesce(v_state,''))='CERRADA' then 'COMPLETADO' else 'PENDIENTE' end;

  elsif v_modulo='COMITE_ACUERDO' then
    select
      a.accion,
      a.responsable,
      a.fecha_cumplimiento,
      a.estado,
      r.numero_acta,
      c.nombre,
      c.proyecto_id
    into v_act,v_responsible,v_date,v_state,v_meeting_number,v_committee_name,v_project
    from public.comite_sst_acuerdos a
    left join public.comite_sst_reuniones r on r.id=a.reunion_id
    join public.comites_sst c on c.id=a.comite_id
    where a.id=p_origen_id
    limit 1;

    if not found then
      return jsonb_build_object('ok',false,'error','No se encontró el acuerdo o no tienes acceso.');
    end if;

    if v_date is null then
      return jsonb_build_object('ok',false,'error','El acuerdo no tiene fecha de cumplimiento. Registra la fecha antes de planificarlo.');
    end if;

    v_code := 'Acta ' || coalesce(v_meeting_number,'S/N');
    v_title := 'Acuerdo Comité SST · ' || coalesce(v_act,'Acción pendiente');
    v_desc := 'Acuerdo de ' || v_code || ' · ' || coalesce(v_committee_name,'Comité/Subcomité SST') || '.';
    v_category := 'COMITE_SST';
    v_origin := 'COMITE_SST';
    v_time := time '17:00';
    v_priority := case when v_date<=current_date+7 then 'ALTA' else 'MEDIA' end;
    v_status := case
      when upper(coalesce(v_state,''))='CERRADO' then 'COMPLETADO'
      when upper(coalesce(v_state,''))='EN_PROCESO' then 'EN_PROCESO'
      else 'PENDIENTE'
    end;

  elsif v_modulo='COMITE_CAPACITACION' then
    select
      cap.titulo,
      cap.codigo,
      cap.fecha,
      cap.estado,
      cap.expositor,
      c.nombre,
      c.proyecto_id
    into v_title,v_code,v_date,v_state,v_responsible,v_committee_name,v_project
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id=p_origen_id
    limit 1;

    if not found then
      return jsonb_build_object('ok',false,'error','No se encontró la capacitación del Comité o no tienes acceso.');
    end if;

    v_title := 'Capacitación Comité SST · ' || coalesce(v_title,'Capacitación');
    v_desc := 'Capacitación programada para ' || coalesce(v_committee_name,'Comité/Subcomité SST') || '. Código: ' || coalesce(v_code,'—') || '.';
    v_category := 'CAPACITACION';
    v_origin := 'COMITE_SST';
    v_time := time '09:00';
    v_status := case when upper(coalesce(v_state,''))='INACTIVA' then 'CANCELADO' else 'PENDIENTE' end;
  end if;

  if v_date is null then
    return jsonb_build_object('ok',false,'error','El registro origen no tiene una fecha válida para planificación.');
  end if;

  select p.id,p.codigo
  into v_ticket_id,v_ticket_codigo
  from public.planificacion_pendientes p
  where p.origen_modulo=v_modulo
    and p.origen_registro_id=p_origen_id
  limit 1;

  if v_ticket_id is null then
    insert into public.planificacion_pendientes(
      titulo,descripcion,categoria,origen,prioridad,estado,
      asignado_a_profile_id,responsable_nombre,
      fecha_objetivo,hora_objetivo,proyecto_id,
      recordatorios_habilitados,recordatorios_minutos,
      origen_modulo,origen_registro_id,origen_registro_codigo,origen_sincronizado_at,
      ultimo_motivo_cambio,created_by,updated_by
    )
    values(
      v_title,v_desc,v_category,v_origin,v_priority,v_status,
      null,coalesce(v_responsible,'Responsable'),
      v_date,v_time,v_project,
      true,array[60,30,10,0]::integer[],
      v_modulo,p_origen_id,v_code,now(),
      'Ticket creado desde integración automática con ' || v_modulo || '.',
      auth.uid(),auth.uid()
    )
    returning id,codigo into v_ticket_id,v_ticket_codigo;
  else
    update public.planificacion_pendientes p
    set
      titulo=v_title,
      descripcion=v_desc,
      categoria=v_category,
      origen=v_origin,
      responsable_nombre=case when p.asignado_a_profile_id is null then coalesce(v_responsible,p.responsable_nombre) else p.responsable_nombre end,
      fecha_objetivo=v_date,
      hora_objetivo=case when v_modulo='COMITE_REUNION' then v_time else coalesce(p.hora_objetivo,v_time) end,
      proyecto_id=v_project,
      estado=case
        when v_status in ('COMPLETADO','CANCELADO') then v_status
        when v_status='EN_PROCESO' then 'EN_PROCESO'
        when p.estado in ('EN_PROCESO','EN_ESPERA') then p.estado
        else 'PENDIENTE'
      end,
      origen_registro_codigo=v_code,
      origen_sincronizado_at=now(),
      ultimo_motivo_cambio='Ticket sincronizado desde ' || v_modulo || '.',
      updated_by=auth.uid()
    where p.id=v_ticket_id
    returning p.codigo into v_ticket_codigo;
  end if;

  return jsonb_build_object(
    'ok',true,
    'ticket_id',v_ticket_id,
    'codigo',v_ticket_codigo,
    'modulo',v_modulo
  );
exception
  when unique_violation then
    select p.id,p.codigo
    into v_ticket_id,v_ticket_codigo
    from public.planificacion_pendientes p
    where p.origen_modulo=v_modulo
      and p.origen_registro_id=p_origen_id
    limit 1;

    return jsonb_build_object(
      'ok',true,
      'ticket_id',v_ticket_id,
      'codigo',v_ticket_codigo,
      'modulo',v_modulo,
      'message','El registro ya se encontraba vinculado.'
    );
end;
$$;

grant execute on function public.planificar_desde_origen(text,uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. Trigger genérico: mantener sincronizados los tickets YA vinculados.
-- No crea tickets nuevos por sí solo; la vinculación inicial se hace
-- desde el botón Planificar o desde Integraciones > Sincronizar visibles.
-- ------------------------------------------------------------
create or replace function public.sync_planificacion_origen_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_modulo text := TG_ARGV[0];
  v_row jsonb;
  v_id uuid;
  v_title text;
  v_desc text;
  v_responsible text;
  v_code text;
  v_state text;
  v_source_status text := 'PENDIENTE';
  v_date date;
  v_time time;
  v_project uuid;
  v_committee_name text;
  v_meeting_number text;
begin
  if TG_OP='DELETE' then
    v_row:=to_jsonb(OLD);
    v_id:=(v_row->>'id')::uuid;

    update public.planificacion_pendientes p
    set
      estado=case when p.estado='COMPLETADO' then 'COMPLETADO' else 'CANCELADO' end,
      origen_sincronizado_at=now(),
      ultimo_motivo_cambio='El registro origen fue eliminado en ' || v_modulo || '.',
      updated_by=auth.uid()
    where p.origen_modulo=v_modulo
      and p.origen_registro_id=v_id;

    return OLD;
  end if;

  v_row:=to_jsonb(NEW);
  v_id:=(v_row->>'id')::uuid;

  -- Si no existe ticket vinculado, no hacemos nada.
  if not exists(
    select 1 from public.planificacion_pendientes p
    where p.origen_modulo=v_modulo and p.origen_registro_id=v_id
  ) then
    return NEW;
  end if;

  if v_modulo='CAPACITACION' then
    v_title:='Capacitación · ' || coalesce(v_row->>'tema','Sin tema');
    v_code:=v_row->>'codigo';
    v_date:=nullif(v_row->>'fecha','')::date;
    v_state:=upper(coalesce(v_row->>'estado',''));
    v_responsible:=coalesce(nullif(btrim(v_row->>'responsable_nombre'),''),nullif(btrim(v_row->>'expositor_nombre'),''),'Responsable de capacitación');
    v_project:=nullif(v_row->>'proyecto_id','')::uuid;
    v_desc:='Actividad sincronizada desde el módulo Capacitaciones. Código: ' || coalesce(v_code,'—') || '.';
    v_source_status:=case when v_state='FINALIZADA' then 'COMPLETADO' when v_state='CANCELADA' then 'CANCELADO' else 'PENDIENTE' end;

  elsif v_modulo='INDUCCION' then
    v_title:='Inducción ' || case when v_row->>'tipo'='PROYECTO' then 'de proyecto' else 'Sede Lima' end || ' · ' || coalesce(v_row->>'tema',v_row->>'titulo','Sin tema');
    v_code:=v_row->>'codigo';
    v_date:=coalesce(nullif(v_row->>'fecha_dia1','')::date,nullif(v_row->>'fecha','')::date);
    v_state:=upper(coalesce(v_row->>'estado',''));
    v_responsible:=coalesce(nullif(btrim(v_row->>'expositor'),''),'Responsable de inducción');
    v_project:=nullif(v_row->>'proyecto_id','')::uuid;
    v_desc:='Actividad sincronizada desde el módulo Inducciones. Código: ' || coalesce(v_code,'—') || '.';
    v_source_status:=case when v_state='CERRADA' then 'COMPLETADO' else 'PENDIENTE' end;

  elsif v_modulo='COMITE_REUNION' then
    select c.nombre,c.proyecto_id into v_committee_name,v_project
    from public.comites_sst c where c.id=nullif(v_row->>'comite_id','')::uuid limit 1;
    v_meeting_number:=v_row->>'numero_acta';
    v_code:='Acta ' || coalesce(v_meeting_number,'S/N');
    v_title:='Reunión ' || lower(coalesce(v_row->>'tipo_reunion','ORDINARIA')) || ' · ' || coalesce(v_committee_name,'Comité SST');
    v_date:=nullif(v_row->>'fecha','')::date;
    v_time:=nullif(v_row->>'hora_inicio','')::time;
    v_state:=upper(coalesce(v_row->>'estado',''));
    v_responsible:=coalesce(v_committee_name,'Comité SST');
    v_desc:='Reunión sincronizada del Comité/Subcomité SST. ' || v_code || '.';
    v_source_status:=case when v_state='CERRADA' then 'COMPLETADO' else 'PENDIENTE' end;

  elsif v_modulo='COMITE_ACUERDO' then
    select c.nombre,c.proyecto_id into v_committee_name,v_project
    from public.comites_sst c where c.id=nullif(v_row->>'comite_id','')::uuid limit 1;
    select r.numero_acta into v_meeting_number
    from public.comite_sst_reuniones r where r.id=nullif(v_row->>'reunion_id','')::uuid limit 1;
    v_code:='Acta ' || coalesce(v_meeting_number,'S/N');
    v_title:='Acuerdo Comité SST · ' || coalesce(v_row->>'accion','Acción pendiente');
    v_date:=nullif(v_row->>'fecha_cumplimiento','')::date;
    v_state:=upper(coalesce(v_row->>'estado',''));
    v_responsible:=coalesce(nullif(btrim(v_row->>'responsable'),''),'Responsable del acuerdo');
    v_desc:='Acuerdo sincronizado de ' || v_code || ' · ' || coalesce(v_committee_name,'Comité/Subcomité SST') || '.';
    v_source_status:=case when v_state='CERRADO' then 'COMPLETADO' when v_state='EN_PROCESO' then 'EN_PROCESO' else 'PENDIENTE' end;

  elsif v_modulo='COMITE_CAPACITACION' then
    select c.nombre,c.proyecto_id into v_committee_name,v_project
    from public.comites_sst c where c.id=nullif(v_row->>'comite_id','')::uuid limit 1;
    v_code:=v_row->>'codigo';
    v_title:='Capacitación Comité SST · ' || coalesce(v_row->>'titulo','Capacitación');
    v_date:=nullif(v_row->>'fecha','')::date;
    v_state:=upper(coalesce(v_row->>'estado',''));
    v_responsible:=coalesce(nullif(btrim(v_row->>'expositor'),''),'Responsable de capacitación');
    v_desc:='Capacitación sincronizada para ' || coalesce(v_committee_name,'Comité/Subcomité SST') || '. Código: ' || coalesce(v_code,'—') || '.';
    v_source_status:=case when v_state='INACTIVA' then 'CANCELADO' else 'PENDIENTE' end;
  end if;

  update public.planificacion_pendientes p
  set
    titulo=coalesce(v_title,p.titulo),
    descripcion=coalesce(v_desc,p.descripcion),
    responsable_nombre=case when p.asignado_a_profile_id is null then coalesce(v_responsible,p.responsable_nombre) else p.responsable_nombre end,
    fecha_objetivo=coalesce(v_date,p.fecha_objetivo),
    hora_objetivo=case when v_modulo='COMITE_REUNION' and v_time is not null then v_time else p.hora_objetivo end,
    proyecto_id=v_project,
    estado=case
      when v_source_status in ('COMPLETADO','CANCELADO') then v_source_status
      when v_source_status='EN_PROCESO' then 'EN_PROCESO'
      when p.estado in ('EN_PROCESO','EN_ESPERA') then p.estado
      else 'PENDIENTE'
    end,
    origen_registro_codigo=coalesce(v_code,p.origen_registro_codigo),
    origen_sincronizado_at=now(),
    ultimo_motivo_cambio='Sincronización automática desde ' || v_modulo || '.',
    updated_by=auth.uid()
  where p.origen_modulo=v_modulo
    and p.origen_registro_id=v_id;

  return NEW;
end;
$$;

revoke all on function public.sync_planificacion_origen_trigger() from public;

-- ------------------------------------------------------------
-- 4. Triggers de sincronización.
-- ------------------------------------------------------------
drop trigger if exists trg_planificacion_sync_capacitacion on public.capacitaciones;
create trigger trg_planificacion_sync_capacitacion
after update or delete on public.capacitaciones
for each row execute function public.sync_planificacion_origen_trigger('CAPACITACION');

drop trigger if exists trg_planificacion_sync_induccion on public.inducciones;
create trigger trg_planificacion_sync_induccion
after update or delete on public.inducciones
for each row execute function public.sync_planificacion_origen_trigger('INDUCCION');

drop trigger if exists trg_planificacion_sync_comite_reunion on public.comite_sst_reuniones;
create trigger trg_planificacion_sync_comite_reunion
after update or delete on public.comite_sst_reuniones
for each row execute function public.sync_planificacion_origen_trigger('COMITE_REUNION');

drop trigger if exists trg_planificacion_sync_comite_acuerdo on public.comite_sst_acuerdos;
create trigger trg_planificacion_sync_comite_acuerdo
after update or delete on public.comite_sst_acuerdos
for each row execute function public.sync_planificacion_origen_trigger('COMITE_ACUERDO');

drop trigger if exists trg_planificacion_sync_comite_capacitacion on public.comite_sst_capacitaciones;
create trigger trg_planificacion_sync_comite_capacitacion
after update or delete on public.comite_sst_capacitaciones
for each row execute function public.sync_planificacion_origen_trigger('COMITE_CAPACITACION');

select 'Etapa 17D aplicada correctamente' as resultado;
