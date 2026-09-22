-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 10B.1 · CERTIFICADO PÚBLICO PARA PARTICIPANTE APROBADO
-- ============================================================

create or replace function public.obtener_certificado_publico(
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
  v_aprobado boolean := false;
  v_unidad text := null;
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
    return jsonb_build_object('ok', false, 'error', 'No existe participación registrada para esta capacitación.');
  end if;

  select * into v_exam
  from public.examenes
  where capacitacion_id = v_cap.id
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La capacitación no tiene examen asociado.');
  end if;

  select coalesce(bool_or(aprobado), false)
    into v_aprobado
  from public.examen_intentos
  where examen_id = v_exam.id
    and participante_id = v_part.id
    and finalizado_at is not null;

  if not coalesce(v_aprobado, false) then
    return jsonb_build_object('ok', false, 'error', 'El certificado solo está disponible para participantes aprobados.');
  end if;

  if v_worker.proyecto_id is not null then
    select 'PROYECTO - ' || p.nombre
      into v_unidad
    from public.proyectos p
    where p.id = v_worker.proyecto_id;
  end if;

  if v_unidad is null and v_worker.sede_id is not null then
    select 'SEDE - ' || s.nombre
      into v_unidad
    from public.sedes s
    where s.id = v_worker.sede_id;
  end if;

  if v_unidad is null and v_cap.proyecto_id is not null then
    select 'PROYECTO - ' || p.nombre
      into v_unidad
    from public.proyectos p
    where p.id = v_cap.proyecto_id;
  end if;

  if v_unidad is null and v_cap.sede_id is not null then
    select 'SEDE - ' || s.nombre
      into v_unidad
    from public.sedes s
    where s.id = v_cap.sede_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'codigo', v_cap.codigo,
    'nombre', v_part.apellidos_nombres,
    'dni', v_part.dni,
    'puesto', coalesce(nullif(btrim(v_part.puesto), ''), nullif(btrim(v_worker.cargo), ''), '—'),
    'tema', v_cap.tema,
    'unidad', coalesce(v_unidad, '—'),
    'fecha', v_cap.fecha,
    'tiempo_texto', v_cap.tiempo_texto
  );
end;
$$;

revoke all on function public.obtener_certificado_publico(text,text) from public;
grant execute on function public.obtener_certificado_publico(text,text) to anon, authenticated;

select 'Etapa 10B.1 aplicada correctamente' as resultado;
