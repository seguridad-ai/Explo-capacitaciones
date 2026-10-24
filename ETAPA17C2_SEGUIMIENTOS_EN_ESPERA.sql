-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 17C.2 - SEGUIMIENTOS DE TAREAS EN ESPERA
-- ============================================================

-- 1. Ampliar tickets EN_ESPERA con hora y recordatorios de seguimiento.
alter table public.planificacion_pendientes
  add column if not exists hora_seguimiento time,
  add column if not exists seguimiento_recordatorios_minutos integer[] not null default array[30,10,0]::integer[],
  add column if not exists seguimiento_pospuesto_hasta timestamptz,
  add column if not exists ultimo_seguimiento_at timestamptz;

-- 2. Historial específico de seguimientos.
create table if not exists public.planificacion_pendiente_seguimientos (
  id uuid primary key default gen_random_uuid(),
  pendiente_id uuid not null references public.planificacion_pendientes(id) on delete cascade,

  resultado text not null
    check (resultado in (
      'SIN_RESPUESTA',
      'CONTACTADO',
      'INFORMACION_RECIBIDA',
      'RESUELTO',
      'OTRO'
    )),

  contacto text,
  observacion text not null,

  fecha_seguimiento_anterior date,
  hora_seguimiento_anterior time,

  proxima_fecha date,
  proxima_hora time,

  estado_resultante text not null
    check (estado_resultante in (
      'EN_ESPERA',
      'EN_PROCESO',
      'COMPLETADO'
    )),

  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_planificacion_pendiente_seguimientos
on public.planificacion_pendiente_seguimientos(pendiente_id,created_at desc);

alter table public.planificacion_pendiente_seguimientos enable row level security;

drop policy if exists planificacion_pendiente_seguimientos_select
on public.planificacion_pendiente_seguimientos;

create policy planificacion_pendiente_seguimientos_select
on public.planificacion_pendiente_seguimientos
for select to authenticated
using (public.can_view_planificacion_pending(pendiente_id));

drop policy if exists planificacion_pendiente_seguimientos_insert
on public.planificacion_pendiente_seguimientos;

create policy planificacion_pendiente_seguimientos_insert
on public.planificacion_pendiente_seguimientos
for insert to authenticated
with check (public.can_manage_planificacion_pending(pendiente_id));

grant select,insert
on public.planificacion_pendiente_seguimientos
to authenticated;

-- 3. Registrar seguimiento de forma transaccional.
create or replace function public.registrar_planificacion_seguimiento(
  p_pendiente_id uuid,
  p_resultado text,
  p_contacto text,
  p_observacion text,
  p_proxima_fecha date default null,
  p_proxima_hora time default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_p public.planificacion_pendientes%rowtype;
  v_estado text;
  v_detalle text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  if p_resultado not in ('SIN_RESPUESTA','CONTACTADO','INFORMACION_RECIBIDA','RESUELTO','OTRO') then
    return jsonb_build_object('ok',false,'error','Resultado de seguimiento no válido.');
  end if;

  if coalesce(btrim(p_observacion),'')='' then
    return jsonb_build_object('ok',false,'error','Registra una observación del seguimiento.');
  end if;

  select * into v_p
  from public.planificacion_pendientes
  where id=p_pendiente_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','No se encontró el pendiente.');
  end if;

  if not public.can_manage_planificacion_pending(p_pendiente_id) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para gestionar este pendiente.');
  end if;

  if v_p.estado<>'EN_ESPERA' then
    return jsonb_build_object('ok',false,'error','El ticket ya no se encuentra EN ESPERA.');
  end if;

  if p_resultado in ('SIN_RESPUESTA','CONTACTADO','OTRO') then
    if p_proxima_fecha is null then
      return jsonb_build_object(
        'ok',false,
        'error','Para mantener el ticket EN ESPERA debes programar el próximo seguimiento.'
      );
    end if;
    v_estado := 'EN_ESPERA';
  elsif p_resultado='INFORMACION_RECIBIDA' then
    v_estado := 'EN_PROCESO';
  else
    v_estado := 'COMPLETADO';
  end if;

  insert into public.planificacion_pendiente_seguimientos(
    pendiente_id,
    resultado,
    contacto,
    observacion,
    fecha_seguimiento_anterior,
    hora_seguimiento_anterior,
    proxima_fecha,
    proxima_hora,
    estado_resultante,
    created_by
  )
  values(
    p_pendiente_id,
    p_resultado,
    nullif(btrim(coalesce(p_contacto,'')),''),
    btrim(p_observacion),
    v_p.fecha_seguimiento,
    v_p.hora_seguimiento,
    case when v_estado='EN_ESPERA' then p_proxima_fecha else null end,
    case when v_estado='EN_ESPERA' then p_proxima_hora else null end,
    v_estado,
    auth.uid()
  );

  v_detalle :=
    case p_resultado
      when 'SIN_RESPUESTA' then 'Seguimiento realizado: sin respuesta.'
      when 'CONTACTADO' then 'Seguimiento realizado: contacto efectuado, continúa en espera.'
      when 'INFORMACION_RECIBIDA' then 'Seguimiento realizado: información recibida; ticket reactivado.'
      when 'RESUELTO' then 'Seguimiento realizado: asunto resuelto.'
      else 'Seguimiento realizado.'
    end
    || ' ' || btrim(p_observacion);

  update public.planificacion_pendientes
  set
    estado=v_estado,
    fecha_seguimiento=case when v_estado='EN_ESPERA' then p_proxima_fecha else null end,
    hora_seguimiento=case when v_estado='EN_ESPERA' then p_proxima_hora else null end,
    seguimiento_pospuesto_hasta=null,
    ultimo_seguimiento_at=now(),
    esperando_de=case when v_estado='EN_ESPERA' then esperando_de else null end,
    motivo_espera=case when v_estado='EN_ESPERA' then motivo_espera else null end,
    ultimo_motivo_cambio=v_detalle
  where id=p_pendiente_id;

  return jsonb_build_object(
    'ok',true,
    'estado',v_estado,
    'message',
      case v_estado
        when 'EN_ESPERA' then 'Seguimiento registrado y próxima llamada programada.'
        when 'EN_PROCESO' then 'Seguimiento registrado. El ticket volvió a EN PROCESO.'
        else 'Seguimiento registrado. El ticket quedó COMPLETADO.'
      end
  );
end;
$$;

revoke all on function public.registrar_planificacion_seguimiento(uuid,text,text,text,date,time) from public;
grant execute on function public.registrar_planificacion_seguimiento(uuid,text,text,text,date,time) to authenticated;

select 'Etapa 17C.2 aplicada correctamente' as resultado;
