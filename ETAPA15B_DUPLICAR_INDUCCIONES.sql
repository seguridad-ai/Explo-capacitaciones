-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 15B
-- DUPLICAR INDUCCIONES CON TODO EL EXAMEN
-- ============================================================
-- Copia:
--   * Programación de la inducción
--   * Temas / proyecto / sede / nota mínima
--   * Todas las preguntas activas
--   * Alternativas y respuestas correctas
--   * Pesos y explicaciones educativas
--
-- NO copia:
--   * Participantes
--   * Intentos
--   * Resultados
--   * Respuestas desarrolladas
--
-- La nueva inducción:
--   * recibe nuevo código
--   * recibe nuevo public_token
--   * queda en BORRADOR
--   * conserva fechas y expositor para que puedan editarse
--   * NO copia la firma del expositor, para evitar reutilizar
--     una firma que podría corresponder a otra programación
-- ============================================================

create or replace function public.duplicar_induccion(
  p_induccion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_src public.inducciones%rowtype;
  v_new public.inducciones%rowtype;
  v_q record;
  v_new_q_id uuid;
  v_question_count integer := 0;
  v_option_count integer := 0;
  v_inserted_options integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object(
      'ok',false,
      'error','Sesión no válida.'
    );
  end if;

  select *
  into v_src
  from public.inducciones
  where id=p_induccion_id
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok',false,
      'error','La inducción original no existe.'
    );
  end if;

  if not (
    public.is_admin()
    or (
      v_src.tipo='PROYECTO'
      and v_src.proyecto_id is not null
      and public.can_manage_project(v_src.proyecto_id)
    )
  ) then
    return jsonb_build_object(
      'ok',false,
      'error','No tienes permiso para duplicar esta inducción.'
    );
  end if;

  insert into public.inducciones(
    tipo,
    titulo,
    descripcion,
    sede_id,
    proyecto_id,
    fecha,
    nota_minima,
    estado,
    created_by,
    empresa,
    contratista,
    distrito,
    provincia,
    tema,
    expositor,
    expositor_cargo,
    expositor_dni,
    area,
    tiempo_horas,
    firma_expositor,
    titular_minero,
    unidad_produccion,
    tema_dia1,
    tema_dia2,
    tema_dia3,
    tema_dia4,
    fecha_dia1,
    fecha_dia2,
    fecha_dia3,
    fecha_dia4,
    tiempo_dia1,
    tiempo_dia2,
    tiempo_dia3,
    tiempo_dia4
  )
  values(
    v_src.tipo,
    v_src.titulo,
    v_src.descripcion,
    v_src.sede_id,
    v_src.proyecto_id,
    v_src.fecha,
    v_src.nota_minima,
    'BORRADOR',
    auth.uid(),
    v_src.empresa,
    v_src.contratista,
    v_src.distrito,
    v_src.provincia,
    v_src.tema,
    v_src.expositor,
    v_src.expositor_cargo,
    v_src.expositor_dni,
    v_src.area,
    v_src.tiempo_horas,
    null,
    v_src.titular_minero,
    v_src.unidad_produccion,
    v_src.tema_dia1,
    v_src.tema_dia2,
    v_src.tema_dia3,
    v_src.tema_dia4,
    v_src.fecha_dia1,
    v_src.fecha_dia2,
    v_src.fecha_dia3,
    v_src.fecha_dia4,
    v_src.tiempo_dia1,
    v_src.tiempo_dia2,
    v_src.tiempo_dia3,
    v_src.tiempo_dia4
  )
  returning *
  into v_new;

  for v_q in
    select
      q.id,
      q.orden,
      q.enunciado,
      q.tipo,
      q.peso,
      q.explicacion,
      q.respuestas_aceptadas
    from public.induccion_preguntas q
    where q.induccion_id=v_src.id
      and q.activo=true
    order by q.orden
  loop
    insert into public.induccion_preguntas(
      induccion_id,
      orden,
      enunciado,
      tipo,
      peso,
      explicacion,
      respuestas_aceptadas,
      activo
    )
    values(
      v_new.id,
      v_q.orden,
      v_q.enunciado,
      v_q.tipo,
      v_q.peso,
      v_q.explicacion,
      coalesce(v_q.respuestas_aceptadas,'[]'::jsonb),
      true
    )
    returning id
    into v_new_q_id;

    v_question_count := v_question_count + 1;

    insert into public.induccion_opciones(
      pregunta_id,
      orden,
      texto,
      es_correcta
    )
    select
      v_new_q_id,
      o.orden,
      o.texto,
      o.es_correcta
    from public.induccion_opciones o
    where o.pregunta_id=v_q.id
    order by o.orden;

    get diagnostics v_inserted_options = row_count;
    v_option_count := v_option_count + v_inserted_options;
  end loop;

  return jsonb_build_object(
    'ok',true,
    'id',v_new.id,
    'codigo',v_new.codigo,
    'tipo',v_new.tipo,
    'estado',v_new.estado,
    'preguntas_copiadas',v_question_count,
    'message','Inducción duplicada correctamente.'
  );

exception
  when others then
    return jsonb_build_object(
      'ok',false,
      'error',SQLERRM
    );
end;
$$;

revoke all on function public.duplicar_induccion(uuid) from public;
grant execute on function public.duplicar_induccion(uuid) to authenticated;

select 'Etapa 15B aplicada correctamente' as resultado;
