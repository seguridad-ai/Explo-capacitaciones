-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 16D.4
-- DOCUMENTOS Y REPORTES DE CAPACITACIONES DEL COMITÉ SST
-- ============================================================

-- No se crean tablas nuevas.
-- Se agrega únicamente un RPC público controlado para que cada
-- integrante pueda descargar SU examen desarrollado en PDF desde
-- el enlace público de la capacitación.

create or replace function public.obtener_documento_examen_capacitacion_comite_publico(
  p_token uuid,
  p_dni text,
  p_intento_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_cap public.comite_sst_capacitaciones%rowtype;
  v_comite public.comites_sst%rowtype;
  v_part public.comite_sst_capacitacion_participantes%rowtype;
  v_attempt public.comite_sst_capacitacion_intentos%rowtype;
  v_worker public.trabajadores%rowtype;
  v_member public.comite_sst_integrantes%rowtype;
  v_items jsonb;
begin
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok',false,'error','DNI no válido.');
  end if;

  select * into v_cap
  from public.comite_sst_capacitaciones
  where public_token=p_token
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','Capacitación no encontrada.');
  end if;

  select * into v_comite
  from public.comites_sst
  where id=v_cap.comite_id
  limit 1;

  select p.* into v_part
  from public.comite_sst_capacitacion_participantes p
  join public.trabajadores w on w.id=p.trabajador_id
  where p.capacitacion_id=v_cap.id
    and w.dni=p_dni
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','No existe participación registrada para este DNI.');
  end if;

  select * into v_worker
  from public.trabajadores
  where id=v_part.trabajador_id
  limit 1;

  select * into v_member
  from public.comite_sst_integrantes
  where id=v_part.integrante_id
  limit 1;

  select * into v_attempt
  from public.comite_sst_capacitacion_intentos
  where id=p_intento_id
    and capacitacion_id=v_cap.id
    and participante_id=v_part.id
    and finalizado_at is not null
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','Resultado no encontrado o no pertenece al participante.');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'pregunta_id',q.id,
      'orden',q.orden,
      'enunciado',q.enunciado,
      'tipo',q.tipo,
      'nivel_tema',q.nivel_tema,
      'explicacion',q.explicacion,
      'imagen_url',q.imagen_url,
      'es_correcta',r.es_correcta,
      'puntaje',r.puntaje,
      'peso',q.peso,
      'respuesta_texto',r.respuesta_texto,
      'respuesta_seleccionada',(
        select coalesce(jsonb_agg(o.texto order by o.orden),'[]'::jsonb)
        from public.comite_sst_capacitacion_opciones o
        where o.id=any(r.opcion_ids)
      ),
      'respuestas_correctas',case
        when q.tipo='FREE_TEXT' then q.respuestas_aceptadas
        else (
          select coalesce(jsonb_agg(o.texto order by o.orden),'[]'::jsonb)
          from public.comite_sst_capacitacion_opciones o
          where o.pregunta_id=q.id
            and o.es_correcta=true
        )
      end
    ) order by q.orden
  ),'[]'::jsonb)
  into v_items
  from public.comite_sst_capacitacion_respuestas r
  join public.comite_sst_capacitacion_preguntas q on q.id=r.pregunta_id
  where r.intento_id=v_attempt.id;

  return jsonb_build_object(
    'ok',true,
    'capacitacion',jsonb_build_object(
      'id',v_cap.id,
      'codigo',v_cap.codigo,
      'titulo',v_cap.titulo,
      'expositor',v_cap.expositor,
      'cargo_expositor',v_cap.cargo_expositor,
      'fecha',v_cap.fecha,
      'duracion_horas',v_cap.duracion_horas,
      'nota_minima',v_cap.nota_minima
    ),
    'comite',jsonb_build_object(
      'id',v_comite.id,
      'codigo',v_comite.codigo,
      'tipo',v_comite.tipo,
      'nombre',v_comite.nombre,
      'sede_id',v_comite.sede_id,
      'proyecto_id',v_comite.proyecto_id
    ),
    'participante',jsonb_build_object(
      'dni',v_worker.dni,
      'nombre',trim(v_worker.apellidos||' '||v_worker.nombres),
      'cargo',v_worker.cargo,
      'area',v_worker.area,
      'cargo_comite',v_member.cargo_comite,
      'representacion',v_member.representacion,
      'firma',v_part.firma_electronica,
      'firma_at',v_part.firma_at,
      'contenido_completado_at',v_part.contenido_completado_at
    ),
    'intento',jsonb_build_object(
      'id',v_attempt.id,
      'numero_intento',v_attempt.numero_intento,
      'nota',v_attempt.nota,
      'aprobado',v_attempt.aprobado,
      'correctas',v_attempt.correctas,
      'total',v_attempt.total_preguntas,
      'puntaje_obtenido',v_attempt.puntaje_obtenido,
      'puntaje_total',v_attempt.puntaje_total,
      'iniciado_at',v_attempt.iniciado_at,
      'finalizado_at',v_attempt.finalizado_at
    ),
    'preguntas',v_items
  );
end;
$$;

revoke all on function public.obtener_documento_examen_capacitacion_comite_publico(uuid,text,uuid) from public;
grant execute on function public.obtener_documento_examen_capacitacion_comite_publico(uuid,text,uuid) to anon,authenticated;

select 'Etapa 16D.4 aplicada correctamente' as resultado;
