-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 8 · FIRMA DEL PARTICIPANTE + REGISTRO FINAL PDF
-- ============================================================
-- Esta etapa NO abre acceso directo a las tablas para usuarios anónimos.
-- El enlace público solo utiliza las funciones controladas de abajo.

-- 1) Consultar el estado de una participación ya evaluada.
create or replace function public.consultar_participacion_examen(
  p_codigo text,
  p_dni text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap public.capacitaciones%rowtype;
  v_worker public.trabajadores%rowtype;
  v_part public.capacitacion_participantes%rowtype;
  v_exam public.examenes%rowtype;
  v_intentos integer := 0;
  v_nota numeric(5,2);
  v_aprobado boolean := false;
begin
  if p_codigo is null or btrim(p_codigo) = '' then
    return jsonb_build_object('ok', false, 'error', 'Código de capacitación no válido.');
  end if;

  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok', false, 'error', 'DNI no válido.');
  end if;

  select * into v_cap
  from public.capacitaciones
  where upper(codigo) = upper(btrim(p_codigo))
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Capacitación no encontrada.');
  end if;

  select * into v_exam
  from public.examenes
  where capacitacion_id = v_cap.id
    and activo = true
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La capacitación no tiene examen asociado.');
  end if;

  select * into v_worker
  from public.trabajadores
  where dni = p_dni
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Trabajador no encontrado.');
  end if;

  select * into v_part
  from public.capacitacion_participantes
  where capacitacion_id = v_cap.id
    and trabajador_id = v_worker.id
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'evaluado', false,
      'firma_registrada', false
    );
  end if;

  select count(*), max(nota), bool_or(aprobado)
    into v_intentos, v_nota, v_aprobado
  from public.examen_intentos
  where examen_id = v_exam.id
    and participante_id = v_part.id
    and finalizado_at is not null;

  return jsonb_build_object(
    'ok', true,
    'evaluado', v_intentos > 0,
    'nombre', v_part.apellidos_nombres,
    'nota', v_nota,
    'aprobado', coalesce(v_aprobado, false),
    'nota_aprobatoria', v_exam.nota_aprobatoria,
    'mostrar_resultado', v_exam.mostrar_resultado,
    'firma_registrada', v_part.firma is not null,
    'fecha_firma', v_part.fecha_firma
  );
end;
$$;


-- 2) Guardar la firma desde el enlace público SOLO cuando ya existe
-- por lo menos un intento de examen finalizado para ese participante.
create or replace function public.guardar_firma_participante_examen(
  p_codigo text,
  p_dni text,
  p_firma text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap public.capacitaciones%rowtype;
  v_worker public.trabajadores%rowtype;
  v_part public.capacitacion_participantes%rowtype;
  v_exam public.examenes%rowtype;
begin
  if p_codigo is null or btrim(p_codigo) = '' then
    return jsonb_build_object('ok', false, 'error', 'Código de capacitación no válido.');
  end if;

  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok', false, 'error', 'DNI no válido.');
  end if;

  if p_firma is null
     or char_length(p_firma) < 100
     or char_length(p_firma) > 1000000
     or p_firma not like 'data:image/png;base64,%' then
    return jsonb_build_object('ok', false, 'error', 'La firma no tiene un formato válido.');
  end if;

  select * into v_cap
  from public.capacitaciones
  where upper(codigo) = upper(btrim(p_codigo))
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Capacitación no encontrada.');
  end if;

  select * into v_exam
  from public.examenes
  where capacitacion_id = v_cap.id
    and activo = true
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'No se encontró el examen asociado.');
  end if;

  select * into v_worker
  from public.trabajadores
  where dni = p_dni
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Trabajador no encontrado.');
  end if;

  select * into v_part
  from public.capacitacion_participantes
  where capacitacion_id = v_cap.id
    and trabajador_id = v_worker.id
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Primero debes finalizar la evaluación.');
  end if;

  if not exists (
    select 1
    from public.examen_intentos ei
    where ei.examen_id = v_exam.id
      and ei.participante_id = v_part.id
      and ei.finalizado_at is not null
  ) then
    return jsonb_build_object('ok', false, 'error', 'Primero debes finalizar la evaluación.');
  end if;

  update public.capacitacion_participantes
  set firma = p_firma,
      fecha_firma = now()
  where id = v_part.id;

  return jsonb_build_object(
    'ok', true,
    'status', 'COMPLETADO',
    'fecha_firma', now()
  );
end;
$$;


-- 3) Permisos estrictamente para estas dos funciones.
revoke all on function public.consultar_participacion_examen(text,text) from public;
revoke all on function public.guardar_firma_participante_examen(text,text,text) from public;

grant execute on function public.consultar_participacion_examen(text,text) to anon, authenticated;
grant execute on function public.guardar_firma_participante_examen(text,text,text) to anon, authenticated;

select
  'Etapa 8 aplicada correctamente' as resultado,
  (select count(*) from public.capacitacion_participantes where firma is not null) as participantes_con_firma;
