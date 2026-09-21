-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 7B · ACCESO AL EXAMEN DESDE LA BASE DE TRABAJADORES
-- ============================================================
-- Objetivo:
--   * El enlace del examen puede compartirse por WhatsApp.
--   * El trabajador ingresa únicamente su DNI.
--   * Se valida directamente contra public.trabajadores.
--   * Solo trabajadores con activo = true pueden continuar.
--   * Si todavía no estaba agregado como participante, el sistema
--     lo registra automáticamente en capacitacion_participantes.
--   * Se conservan DNI, nombres, puesto y área como fotografía histórica.
-- ============================================================

-- 1) OBTENER EXAMEN PARA UN TRABAJADOR ACTIVO
create or replace function public.obtener_examen_participante(
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
  v_sede text;
  v_usados integer := 0;
  v_mejor numeric(5,2);
  v_aprobado boolean := false;
  v_preguntas jsonb;
begin
  if p_codigo is null or btrim(p_codigo) = '' then
    return jsonb_build_object('ok', false, 'error', 'Código de capacitación no válido.');
  end if;

  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok', false, 'error', 'Ingresa un DNI válido de 8 dígitos.');
  end if;

  -- Primero se valida que el enlace corresponda a una capacitación real.
  select * into v_cap
  from public.capacitaciones
  where upper(codigo) = upper(btrim(p_codigo))
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'No se encontró la capacitación indicada.');
  end if;

  -- Luego se valida que el examen exista y se encuentre publicado.
  select * into v_exam
  from public.examenes
  where capacitacion_id = v_cap.id
    and activo = true
  limit 1;

  if not found or not v_exam.requiere_evaluacion then
    return jsonb_build_object('ok', false, 'error', 'Esta capacitación no tiene una evaluación habilitada.');
  end if;

  if not v_exam.publicado then
    return jsonb_build_object('ok', false, 'error', 'El examen todavía no ha sido habilitado por el responsable.');
  end if;

  -- El DNI se consulta directamente en el maestro de trabajadores.
  -- Solamente se permite continuar si el trabajador está ACTIVO.
  select * into v_worker
  from public.trabajadores
  where dni = p_dni
    and activo = true
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'No se encontró un trabajador activo con el DNI ingresado.'
    );
  end if;

  if v_worker.sede_id is not null then
    select s.nombre into v_sede
    from public.sedes s
    where s.id = v_worker.sede_id;
  end if;

  -- Registro automático como participante de esta capacitación.
  -- Si ya estaba registrado, no se duplica.
  insert into public.capacitacion_participantes (
    capacitacion_id,
    trabajador_id,
    dni,
    apellidos_nombres,
    puesto,
    area
  ) values (
    v_cap.id,
    v_worker.id,
    v_worker.dni,
    btrim(concat_ws(' ', v_worker.apellidos, v_worker.nombres)),
    coalesce(nullif(btrim(v_worker.cargo), ''), 'SIN PUESTO'),
    coalesce(nullif(btrim(v_worker.area), ''), 'SIN ÁREA')
  )
  on conflict (capacitacion_id, trabajador_id) do nothing;

  select * into v_part
  from public.capacitacion_participantes
  where capacitacion_id = v_cap.id
    and trabajador_id = v_worker.id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'No fue posible registrar al trabajador en la capacitación.');
  end if;

  select count(*), max(nota), bool_or(aprobado)
    into v_usados, v_mejor, v_aprobado
  from public.examen_intentos
  where examen_id = v_exam.id
    and participante_id = v_part.id;

  if coalesce(v_aprobado, false) then
    return jsonb_build_object(
      'ok', false,
      'status', 'APROBADO',
      'error', 'La evaluación ya fue aprobada.',
      'nombre', v_part.apellidos_nombres,
      'tema', v_cap.tema,
      'mejor_nota', v_mejor,
      'intentos_usados', v_usados,
      'max_intentos', v_exam.max_intentos
    );
  end if;

  if v_usados >= v_exam.max_intentos then
    return jsonb_build_object(
      'ok', false,
      'status', 'SIN_INTENTOS',
      'error', 'Ya se utilizaron todos los intentos disponibles.',
      'nombre', v_part.apellidos_nombres,
      'tema', v_cap.tema,
      'mejor_nota', v_mejor,
      'intentos_usados', v_usados,
      'max_intentos', v_exam.max_intentos
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'orden', p.orden,
        'enunciado', p.enunciado,
        'opciones', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', o.id,
                'orden', o.orden,
                'texto', o.texto
              ) order by o.orden
            ),
            '[]'::jsonb
          )
          from public.examen_opciones o
          where o.pregunta_id = p.id
        )
      ) order by p.orden
    ),
    '[]'::jsonb
  ) into v_preguntas
  from public.examen_preguntas p
  where p.examen_id = v_exam.id
    and p.activo = true;

  return jsonb_build_object(
    'ok', true,
    'codigo', v_cap.codigo,
    'tema', v_cap.tema,
    'fecha', v_cap.fecha,
    'participante_id', v_part.id,
    'trabajador_id', v_worker.id,
    'nombre', btrim(concat_ws(' ', v_worker.apellidos, v_worker.nombres)),
    'dni', v_worker.dni,
    'puesto', coalesce(nullif(btrim(v_worker.cargo), ''), 'SIN PUESTO'),
    'area', coalesce(nullif(btrim(v_worker.area), ''), 'SIN ÁREA'),
    'sede', coalesce(v_sede, 'SIN SEDE'),
    'examen_id', v_exam.id,
    'titulo', v_exam.titulo,
    'nota_aprobatoria', v_exam.nota_aprobatoria,
    'max_intentos', v_exam.max_intentos,
    'intentos_usados', v_usados,
    'intentos_disponibles', v_exam.max_intentos - v_usados,
    'mostrar_resultado', v_exam.mostrar_resultado,
    'preguntas', v_preguntas
  );
end;
$$;

-- 2) ENVIAR Y CALIFICAR EXAMEN
-- Se vuelve a validar que el trabajador continúe ACTIVO al momento de enviar.
create or replace function public.enviar_examen_participante(
  p_codigo text,
  p_dni text,
  p_respuestas jsonb
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
  v_total integer := 0;
  v_usados integer := 0;
  v_correctas integer := 0;
  v_nota numeric(5,2) := 0;
  v_numero integer := 0;
  v_aprobado boolean := false;
  v_intento_id uuid;
  v_item jsonb;
  v_pregunta_id uuid;
  v_opcion_id uuid;
  v_opcion_correcta boolean;
  v_validas integer := 0;
  v_distintas integer := 0;
  v_mejor numeric(5,2);
begin
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok', false, 'error', 'DNI no válido.');
  end if;

  if p_respuestas is null or jsonb_typeof(p_respuestas) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'Las respuestas no tienen un formato válido.');
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

  if not found or not v_exam.requiere_evaluacion or not v_exam.publicado then
    return jsonb_build_object('ok', false, 'error', 'La evaluación no se encuentra habilitada.');
  end if;

  select * into v_worker
  from public.trabajadores
  where dni = p_dni
    and activo = true
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'El trabajador no está activo en la base de Trabajadores.');
  end if;

  insert into public.capacitacion_participantes (
    capacitacion_id,
    trabajador_id,
    dni,
    apellidos_nombres,
    puesto,
    area
  ) values (
    v_cap.id,
    v_worker.id,
    v_worker.dni,
    btrim(concat_ws(' ', v_worker.apellidos, v_worker.nombres)),
    coalesce(nullif(btrim(v_worker.cargo), ''), 'SIN PUESTO'),
    coalesce(nullif(btrim(v_worker.area), ''), 'SIN ÁREA')
  )
  on conflict (capacitacion_id, trabajador_id) do nothing;

  select * into v_part
  from public.capacitacion_participantes
  where capacitacion_id = v_cap.id
    and trabajador_id = v_worker.id
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'No fue posible identificar al participante.');
  end if;

  select count(*) into v_total
  from public.examen_preguntas
  where examen_id = v_exam.id
    and activo = true;

  if v_total = 0 then
    return jsonb_build_object('ok', false, 'error', 'El examen no tiene preguntas disponibles.');
  end if;

  select count(*), max(nota), bool_or(aprobado)
    into v_usados, v_mejor, v_aprobado
  from public.examen_intentos
  where examen_id = v_exam.id
    and participante_id = v_part.id;

  if coalesce(v_aprobado, false) then
    return jsonb_build_object('ok', false, 'error', 'La evaluación ya fue aprobada.', 'mejor_nota', v_mejor);
  end if;

  if v_usados >= v_exam.max_intentos then
    return jsonb_build_object('ok', false, 'error', 'No quedan intentos disponibles.', 'mejor_nota', v_mejor);
  end if;

  for v_item in select * from jsonb_array_elements(p_respuestas)
  loop
    begin
      v_pregunta_id := (v_item ->> 'pregunta_id')::uuid;
      v_opcion_id := (v_item ->> 'opcion_id')::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'Una de las respuestas contiene identificadores inválidos.');
    end;

    if exists (
      select 1
      from public.examen_preguntas p
      join public.examen_opciones o on o.pregunta_id = p.id
      where p.id = v_pregunta_id
        and p.examen_id = v_exam.id
        and p.activo = true
        and o.id = v_opcion_id
    ) then
      v_validas := v_validas + 1;
    end if;
  end loop;

  select count(distinct (x ->> 'pregunta_id'))
    into v_distintas
  from jsonb_array_elements(p_respuestas) as t(x);

  if v_validas <> v_total
     or jsonb_array_length(p_respuestas) <> v_total
     or v_distintas <> v_total then
    return jsonb_build_object('ok', false, 'error', 'Debes responder todas las preguntas una sola vez.');
  end if;

  v_numero := v_usados + 1;

  insert into public.examen_intentos (
    examen_id,
    participante_id,
    numero_intento,
    nota,
    aprobado
  ) values (
    v_exam.id,
    v_part.id,
    v_numero,
    0,
    false
  ) returning id into v_intento_id;

  for v_item in select * from jsonb_array_elements(p_respuestas)
  loop
    v_pregunta_id := (v_item ->> 'pregunta_id')::uuid;
    v_opcion_id := (v_item ->> 'opcion_id')::uuid;

    select o.es_correcta into v_opcion_correcta
    from public.examen_opciones o
    join public.examen_preguntas p on p.id = o.pregunta_id
    where o.id = v_opcion_id
      and p.id = v_pregunta_id
      and p.examen_id = v_exam.id
      and p.activo = true;

    if coalesce(v_opcion_correcta, false) then
      v_correctas := v_correctas + 1;
    end if;

    insert into public.examen_respuestas (
      intento_id,
      pregunta_id,
      opcion_id,
      es_correcta
    ) values (
      v_intento_id,
      v_pregunta_id,
      v_opcion_id,
      coalesce(v_opcion_correcta, false)
    );
  end loop;

  v_nota := round((v_correctas::numeric * 20.0) / v_total::numeric, 2);
  v_aprobado := v_nota >= v_exam.nota_aprobatoria;

  update public.examen_intentos
  set nota = v_nota,
      aprobado = v_aprobado,
      finalizado_at = now()
  where id = v_intento_id;

  update public.capacitacion_participantes
  set nota = case
      when nota is null then v_nota
      else greatest(nota, v_nota)
    end
  where id = v_part.id;

  select max(nota) into v_mejor
  from public.examen_intentos
  where examen_id = v_exam.id
    and participante_id = v_part.id;

  return jsonb_build_object(
    'ok', true,
    'nota', v_nota,
    'mejor_nota', v_mejor,
    'aprobado', v_aprobado,
    'nota_aprobatoria', v_exam.nota_aprobatoria,
    'intento', v_numero,
    'intentos_restantes', greatest(v_exam.max_intentos - v_numero, 0),
    'correctas', v_correctas,
    'total_preguntas', v_total,
    'mostrar_resultado', v_exam.mostrar_resultado
  );
end;
$$;

-- Reaplicar permisos de ejecución para el enlace público.
revoke all on function public.obtener_examen_participante(text,text) from public;
revoke all on function public.enviar_examen_participante(text,text,jsonb) from public;

grant execute on function public.obtener_examen_participante(text,text) to anon, authenticated;
grant execute on function public.enviar_examen_participante(text,text,jsonb) to anon, authenticated;

select
  'Etapa 7B aplicada correctamente' as resultado,
  (select count(*) from public.trabajadores where activo = true) as trabajadores_activos;
