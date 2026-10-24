-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 14C
-- RESULTADOS DE INDUCCIÓN + DOCUMENTOS PDF
-- ============================================================

-- ============================================================
-- 1. HELPER INTERNO: DETALLE COMPLETO DE UN INTENTO
-- ============================================================
create or replace function public._detalle_resultado_induccion_json(
  p_intento_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'intento', jsonb_build_object(
      'id', it.id,
      'nota', it.nota,
      'correctas', it.correctas,
      'total_preguntas', it.total_preguntas,
      'aprobado', it.aprobado,
      'iniciado_at', it.iniciado_at,
      'finalizado_at', it.finalizado_at
    ),
    'participante', jsonb_build_object(
      'id', p.id,
      'dni', p.dni,
      'nombre', p.nombre,
      'fecha_ingreso', p.fecha_ingreso,
      'puesto', p.puesto,
      'area', p.area,
      'firma', p.firma
    ),
    'induccion', jsonb_build_object(
      'id', i.id,
      'codigo', i.codigo,
      'empresa', coalesce(i.empresa,'EXPLO DRILLING PERU S.R.L.'),
      'contratista', coalesce(nullif(btrim(i.contratista),''),'N.A.'),
      'tema', coalesce(i.tema,i.titulo),
      'sede_id', i.sede_id,
      'sede_nombre', s.nombre,
      'distrito', i.distrito,
      'provincia', i.provincia,
      'fecha', i.fecha,
      'area', i.area,
      'tiempo_horas', i.tiempo_horas,
      'nota_minima', i.nota_minima,
      'expositor', i.expositor,
      'expositor_cargo', i.expositor_cargo,
      'expositor_dni', i.expositor_dni
    ),
    'preguntas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'orden', q.orden,
          'enunciado', q.enunciado,
          'tipo', q.tipo,
          'peso', q.peso,
          'explicacion', q.explicacion,
          'respuestas_aceptadas', q.respuestas_aceptadas,
          'opciones', case
            when q.tipo='RESPUESTA_LIBRE' then '[]'::jsonb
            else coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', o.id,
                  'orden', o.orden,
                  'texto', o.texto,
                  'es_correcta', o.es_correcta
                )
                order by o.orden
              )
              from public.induccion_opciones o
              where o.pregunta_id=q.id
            ),'[]'::jsonb)
          end,
          'respuesta', coalesce(r.respuesta,'{}'::jsonb),
          'es_correcta', coalesce(r.es_correcta,false),
          'puntos_obtenidos', coalesce(r.puntos_obtenidos,0)
        )
        order by q.orden
      )
      from public.induccion_preguntas q
      left join public.induccion_respuestas r
        on r.pregunta_id=q.id
       and r.intento_id=it.id
      where q.induccion_id=i.id
        and q.activo=true
    ),'[]'::jsonb)
  )
  from public.induccion_intentos it
  join public.induccion_participantes p on p.id=it.participante_id
  join public.inducciones i on i.id=it.induccion_id
  left join public.sedes s on s.id=i.sede_id
  where it.id=p_intento_id
  limit 1;
$$;

revoke all on function public._detalle_resultado_induccion_json(uuid) from public;

-- ============================================================
-- 2. RESULTADOS PARA EL PANEL ADMINISTRATIVO
-- Devuelve el último intento finalizado por participante.
-- ============================================================
create or replace function public.obtener_resultados_induccion(
  p_induccion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ind public.inducciones%rowtype;
  v_sede text;
  v_rows jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  select *
  into v_ind
  from public.inducciones
  where id=p_induccion_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','La inducción no existe.');
  end if;

  if not (
    public.is_admin()
    or public.can_view_all_projects()
    or (v_ind.proyecto_id is not null and public.has_project_access(v_ind.proyecto_id))
  ) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para ver estos resultados.');
  end if;

  select nombre into v_sede
  from public.sedes
  where id=v_ind.sede_id
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'participante_id',x.participante_id,
        'intento_id',x.intento_id,
        'nombre',x.nombre,
        'dni',x.dni,
        'fecha_ingreso',x.fecha_ingreso,
        'puesto',x.puesto,
        'area',x.area,
        'nota',x.nota,
        'aprobado',x.aprobado,
        'correctas',x.correctas,
        'total_preguntas',x.total_preguntas,
        'finalizado_at',x.finalizado_at
      )
      order by x.finalizado_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select distinct on (p.id)
      p.id participante_id,
      it.id intento_id,
      p.nombre,
      p.dni,
      p.fecha_ingreso,
      p.puesto,
      p.area,
      it.nota,
      it.aprobado,
      it.correctas,
      it.total_preguntas,
      it.finalizado_at
    from public.induccion_participantes p
    join public.induccion_intentos it
      on it.participante_id=p.id
    where p.induccion_id=p_induccion_id
      and it.finalizado_at is not null
    order by p.id,it.finalizado_at desc
  ) x;

  return jsonb_build_object(
    'ok',true,
    'induccion',jsonb_build_object(
      'id',v_ind.id,
      'codigo',v_ind.codigo,
      'tema',coalesce(v_ind.tema,v_ind.titulo),
      'estado',v_ind.estado,
      'sede_nombre',coalesce(v_sede,'Lima')
    ),
    'resultados',v_rows
  );
exception
  when others then
    return jsonb_build_object('ok',false,'error',SQLERRM);
end;
$$;

revoke all on function public.obtener_resultados_induccion(uuid) from public;
grant execute on function public.obtener_resultados_induccion(uuid) to authenticated;

-- ============================================================
-- 3. DETALLE PARA DESCARGAS DESDE EL PANEL
-- ============================================================
create or replace function public.obtener_detalle_resultado_induccion(
  p_intento_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ind_id uuid;
  v_project_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  select it.induccion_id,i.proyecto_id
  into v_ind_id,v_project_id
  from public.induccion_intentos it
  join public.inducciones i on i.id=it.induccion_id
  where it.id=p_intento_id
  limit 1;

  if v_ind_id is null then
    return jsonb_build_object('ok',false,'error','No se encontró el intento.');
  end if;

  if not (
    public.is_admin()
    or public.can_view_all_projects()
    or (v_project_id is not null and public.has_project_access(v_project_id))
  ) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para ver este resultado.');
  end if;

  return jsonb_build_object(
    'ok',true,
    'detalle',public._detalle_resultado_induccion_json(p_intento_id)
  );
end;
$$;

revoke all on function public.obtener_detalle_resultado_induccion(uuid) from public;
grant execute on function public.obtener_detalle_resultado_induccion(uuid) to authenticated;

-- ============================================================
-- 4. DESCARGAS PÚBLICAS DESPUÉS DE APROBAR
-- ============================================================
create or replace function public.obtener_documentos_induccion_publicos(
  p_token text,
  p_participante_id uuid,
  p_intento_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  select exists(
    select 1
    from public.induccion_intentos it
    join public.induccion_participantes p on p.id=it.participante_id
    join public.inducciones i on i.id=it.induccion_id
    where it.id=p_intento_id
      and p.id=p_participante_id
      and i.public_token=btrim(p_token)
      and i.tipo='LIMA'
      and it.finalizado_at is not null
      and it.aprobado=true
  )
  into v_ok;

  if not v_ok then
    return jsonb_build_object(
      'ok',false,
      'error','Los documentos solo están disponibles para una evaluación aprobada.'
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'detalle',public._detalle_resultado_induccion_json(p_intento_id)
  );
end;
$$;

revoke all on function public.obtener_documentos_induccion_publicos(text,uuid,uuid) from public;
grant execute on function public.obtener_documentos_induccion_publicos(text,uuid,uuid) to anon, authenticated;

select 'Etapa 14C aplicada correctamente' as resultado;
