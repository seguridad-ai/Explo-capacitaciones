-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 15 - INDUCCIÓN POR PROYECTOS (4 DÍAS)
-- Programación 4 días -> examen -> link público -> documentos
-- ============================================================

alter table public.inducciones
  add column if not exists titular_minero text,
  add column if not exists unidad_produccion text,
  add column if not exists tema_dia1 text,
  add column if not exists tema_dia2 text,
  add column if not exists tema_dia3 text,
  add column if not exists tema_dia4 text,
  add column if not exists fecha_dia1 date,
  add column if not exists fecha_dia2 date,
  add column if not exists fecha_dia3 date,
  add column if not exists fecha_dia4 date,
  add column if not exists tiempo_dia1 numeric(5,2) default 8,
  add column if not exists tiempo_dia2 numeric(5,2) default 8,
  add column if not exists tiempo_dia3 numeric(5,2) default 8,
  add column if not exists tiempo_dia4 numeric(5,2) default 8;

-- ============================================================
-- 1. INDUCCIÓN PÚBLICA: LIMA + PROYECTO
-- ============================================================
create or replace function public.obtener_induccion_publica(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ind public.inducciones%rowtype;
  v_questions jsonb;
  v_project_name text;
  v_site_name text;
begin
  select *
  into v_ind
  from public.inducciones
  where public_token=btrim(p_token)
    and tipo in ('LIMA','PROYECTO')
    and estado='ACTIVA'
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok',false,
      'error','La inducción no está disponible o el enlace no es válido.'
    );
  end if;

  if v_ind.proyecto_id is not null then
    select nombre into v_project_name
    from public.proyectos
    where id=v_ind.proyecto_id
    limit 1;
  end if;

  if v_ind.sede_id is not null then
    select nombre into v_site_name
    from public.sedes
    where id=v_ind.sede_id
    limit 1;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',q.id,
        'orden',q.orden,
        'enunciado',q.enunciado,
        'tipo',q.tipo,
        'peso',q.peso,
        'opciones',
          case when q.tipo='RESPUESTA_LIBRE' then '[]'::jsonb
          else (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'id',o.id,
                  'orden',o.orden,
                  'texto',o.texto
                )
                order by o.orden
              ),
              '[]'::jsonb
            )
            from public.induccion_opciones o
            where o.pregunta_id=q.id
          )
          end
      )
      order by q.orden
    ),
    '[]'::jsonb
  )
  into v_questions
  from public.induccion_preguntas q
  where q.induccion_id=v_ind.id
    and q.activo=true;

  return jsonb_build_object(
    'ok',true,
    'induccion',jsonb_build_object(
      'id',v_ind.id,
      'codigo',v_ind.codigo,
      'tipo',v_ind.tipo,
      'empresa',coalesce(v_ind.empresa,'EXPLO DRILLING PERU S.R.L.'),
      'contratista',coalesce(nullif(btrim(v_ind.contratista),''),'N.A.'),
      'sede_nombre',v_site_name,
      'proyecto_nombre',v_project_name,
      'titular_minero',v_ind.titular_minero,
      'unidad_produccion',coalesce(v_ind.unidad_produccion,v_project_name),
      'distrito',v_ind.distrito,
      'provincia',v_ind.provincia,
      'tema',coalesce(v_ind.tema,v_ind.titulo),
      'tema_dia1',v_ind.tema_dia1,
      'tema_dia2',v_ind.tema_dia2,
      'tema_dia3',v_ind.tema_dia3,
      'tema_dia4',v_ind.tema_dia4,
      'fecha',v_ind.fecha,
      'fecha_dia1',v_ind.fecha_dia1,
      'fecha_dia2',v_ind.fecha_dia2,
      'fecha_dia3',v_ind.fecha_dia3,
      'fecha_dia4',v_ind.fecha_dia4,
      'tiempo_horas',v_ind.tiempo_horas,
      'tiempo_dia1',coalesce(v_ind.tiempo_dia1,8),
      'tiempo_dia2',coalesce(v_ind.tiempo_dia2,8),
      'tiempo_dia3',coalesce(v_ind.tiempo_dia3,8),
      'tiempo_dia4',coalesce(v_ind.tiempo_dia4,8),
      'nota_minima',v_ind.nota_minima,
      'area',v_ind.area,
      'expositor',v_ind.expositor,
      'expositor_cargo',v_ind.expositor_cargo,
      'expositor_dni',v_ind.expositor_dni
    ),
    'preguntas',v_questions
  );
end;
$$;

-- ============================================================
-- 2. REGISTRO PÚBLICO DEL TRABAJADOR
-- Sirve para Lima y Proyecto.
-- ============================================================
create or replace function public.registrar_participante_induccion(
  p_token text,
  p_dni text,
  p_nombre text,
  p_fecha_ingreso date,
  p_puesto text,
  p_area text,
  p_firma text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ind public.inducciones%rowtype;
  v_part public.induccion_participantes%rowtype;
  v_worker_id uuid;
begin
  select *
  into v_ind
  from public.inducciones
  where public_token=btrim(p_token)
    and tipo in ('LIMA','PROYECTO')
    and estado='ACTIVA'
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','La inducción no está disponible.');
  end if;

  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok',false,'error','El Registro o DNI debe tener 8 dígitos.');
  end if;
  if btrim(coalesce(p_nombre,''))='' then
    return jsonb_build_object('ok',false,'error','Ingresa los apellidos y nombres del trabajador.');
  end if;
  if p_fecha_ingreso is null then
    return jsonb_build_object('ok',false,'error','Ingresa la fecha de ingreso.');
  end if;
  if btrim(coalesce(p_puesto,''))='' then
    return jsonb_build_object('ok',false,'error','Ingresa el cargo o puesto.');
  end if;
  if btrim(coalesce(p_area,''))='' then
    return jsonb_build_object('ok',false,'error','Ingresa el área de trabajo.');
  end if;
  if p_firma is null or length(p_firma)<100 or p_firma not like 'data:image/%' then
    return jsonb_build_object('ok',false,'error','Registra la firma del trabajador.');
  end if;

  select id into v_worker_id
  from public.trabajadores
  where dni=p_dni
  limit 1;

  select *
  into v_part
  from public.induccion_participantes
  where induccion_id=v_ind.id
    and dni=p_dni
  limit 1;

  if found then
    update public.induccion_participantes
    set trabajador_id=coalesce(v_worker_id,trabajador_id),
        nombre=btrim(p_nombre),
        fecha_ingreso=p_fecha_ingreso,
        puesto=btrim(p_puesto),
        area=btrim(p_area),
        firma=p_firma,
        estado='EN_PROCESO',
        registered_at=now()
    where id=v_part.id
    returning * into v_part;
  else
    insert into public.induccion_participantes(
      induccion_id,trabajador_id,dni,nombre,fecha_ingreso,puesto,area,firma,estado,registered_at
    )
    values(
      v_ind.id,v_worker_id,p_dni,btrim(p_nombre),p_fecha_ingreso,
      btrim(p_puesto),btrim(p_area),p_firma,'EN_PROCESO',now()
    )
    returning * into v_part;
  end if;

  return jsonb_build_object(
    'ok',true,
    'participante_id',v_part.id,
    'nombre',v_part.nombre,
    'message','Registro realizado correctamente.'
  );
exception
  when others then
    return jsonb_build_object('ok',false,'error',SQLERRM);
end;
$$;

-- ============================================================
-- 3. CALIFICACIÓN DEL EXAMEN: LIMA + PROYECTO
-- ============================================================
create or replace function public.finalizar_examen_induccion(
  p_token text,
  p_participante_id uuid,
  p_respuestas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ind public.inducciones%rowtype;
  v_part public.induccion_participantes%rowtype;
  v_attempt_id uuid;
  v_q record;
  v_resp jsonb;
  v_selected text[];
  v_correct text[];
  v_text text;
  v_correcta boolean;
  v_total_weight numeric := 0;
  v_earned numeric := 0;
  v_correct_count integer := 0;
  v_total_count integer := 0;
  v_nota numeric(5,2);
  v_aprobado boolean;
begin
  select *
  into v_ind
  from public.inducciones
  where public_token=btrim(p_token)
    and tipo in ('LIMA','PROYECTO')
    and estado='ACTIVA'
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','La inducción no está disponible.');
  end if;

  select *
  into v_part
  from public.induccion_participantes
  where id=p_participante_id
    and induccion_id=v_ind.id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','No se encontró el participante.');
  end if;

  if p_respuestas is null or jsonb_typeof(p_respuestas)<>'array' then
    return jsonb_build_object('ok',false,'error','Las respuestas no tienen un formato válido.');
  end if;

  insert into public.induccion_intentos(induccion_id,participante_id,total_preguntas)
  select v_ind.id,v_part.id,count(*)
  from public.induccion_preguntas
  where induccion_id=v_ind.id and activo=true
  returning id into v_attempt_id;

  for v_q in
    select *
    from public.induccion_preguntas
    where induccion_id=v_ind.id
      and activo=true
    order by orden
  loop
    v_total_count := v_total_count+1;
    v_total_weight := v_total_weight+v_q.peso;
    v_correcta := false;
    v_selected := array[]::text[];
    v_correct := array[]::text[];
    v_text := '';

    select r.obj
    into v_resp
    from jsonb_array_elements(p_respuestas) r(obj)
    where r.obj->>'pregunta_id'=v_q.id::text
    limit 1;

    if v_q.tipo='RESPUESTA_LIBRE' then
      v_text := lower(regexp_replace(btrim(coalesce(v_resp->>'texto','')),'\s+',' ','g'));

      select exists(
        select 1
        from jsonb_array_elements_text(coalesce(v_q.respuestas_aceptadas,'[]'::jsonb)) a(valor)
        where lower(regexp_replace(btrim(a.valor),'\s+',' ','g'))=v_text
      )
      into v_correcta;
    else
      select coalesce(array_agg(t.valor order by t.valor),array[]::text[])
      into v_selected
      from jsonb_array_elements_text(coalesce(v_resp->'seleccionadas','[]'::jsonb)) t(valor);

      select coalesce(array_agg(o.id::text order by o.id::text),array[]::text[])
      into v_correct
      from public.induccion_opciones o
      where o.pregunta_id=v_q.id
        and o.es_correcta=true;

      v_correcta := v_selected=v_correct;
    end if;

    if v_correcta then
      v_correct_count := v_correct_count+1;
      v_earned := v_earned+v_q.peso;
    end if;

    insert into public.induccion_respuestas(
      intento_id,pregunta_id,respuesta,es_correcta,puntos_obtenidos
    )
    values(
      v_attempt_id,v_q.id,coalesce(v_resp,'{}'::jsonb),v_correcta,
      case when v_correcta then v_q.peso else 0 end
    );
  end loop;

  if v_total_weight<=0 then
    return jsonb_build_object('ok',false,'error','El examen no tiene preguntas válidas.');
  end if;

  v_nota := round((v_earned/v_total_weight)*20,2);
  v_aprobado := v_nota>=v_ind.nota_minima;

  update public.induccion_intentos
  set finalizado_at=now(),
      nota=v_nota,
      correctas=v_correct_count,
      total_preguntas=v_total_count,
      aprobado=v_aprobado
  where id=v_attempt_id;

  update public.induccion_participantes
  set estado='COMPLETADO',
      nota=v_nota,
      completado_at=now()
  where id=v_part.id;

  return jsonb_build_object(
    'ok',true,
    'intento_id',v_attempt_id,
    'nota',v_nota,
    'aprobado',v_aprobado,
    'correctas',v_correct_count,
    'total',v_total_count,
    'nota_minima',v_ind.nota_minima,
    'tipo',v_ind.tipo
  );
exception
  when others then
    return jsonb_build_object('ok',false,'error',SQLERRM);
end;
$$;

-- ============================================================
-- 4. HELPER COMPLETO DEL RESULTADO
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
    'intento',jsonb_build_object(
      'id',it.id,
      'nota',it.nota,
      'correctas',it.correctas,
      'total_preguntas',it.total_preguntas,
      'aprobado',it.aprobado,
      'iniciado_at',it.iniciado_at,
      'finalizado_at',it.finalizado_at
    ),
    'participante',jsonb_build_object(
      'id',p.id,
      'dni',p.dni,
      'nombre',p.nombre,
      'fecha_ingreso',p.fecha_ingreso,
      'puesto',p.puesto,
      'area',p.area,
      'firma',p.firma
    ),
    'induccion',jsonb_build_object(
      'id',i.id,
      'codigo',i.codigo,
      'tipo',i.tipo,
      'empresa',coalesce(i.empresa,'EXPLO DRILLING PERU S.R.L.'),
      'contratista',coalesce(nullif(btrim(i.contratista),''),'N.A.'),
      'sede_id',i.sede_id,
      'sede_nombre',s.nombre,
      'proyecto_id',i.proyecto_id,
      'proyecto_nombre',pr.nombre,
      'titular_minero',i.titular_minero,
      'unidad_produccion',coalesce(i.unidad_produccion,pr.nombre),
      'distrito',i.distrito,
      'provincia',i.provincia,
      'tema',coalesce(i.tema,i.titulo),
      'tema_dia1',i.tema_dia1,
      'tema_dia2',i.tema_dia2,
      'tema_dia3',i.tema_dia3,
      'tema_dia4',i.tema_dia4,
      'fecha',i.fecha,
      'fecha_dia1',i.fecha_dia1,
      'fecha_dia2',i.fecha_dia2,
      'fecha_dia3',i.fecha_dia3,
      'fecha_dia4',i.fecha_dia4,
      'tiempo_horas',i.tiempo_horas,
      'tiempo_dia1',coalesce(i.tiempo_dia1,8),
      'tiempo_dia2',coalesce(i.tiempo_dia2,8),
      'tiempo_dia3',coalesce(i.tiempo_dia3,8),
      'tiempo_dia4',coalesce(i.tiempo_dia4,8),
      'nota_minima',i.nota_minima,
      'area',i.area,
      'expositor',i.expositor,
      'expositor_cargo',i.expositor_cargo,
      'expositor_dni',i.expositor_dni,
      'firma_expositor',i.firma_expositor
    ),
    'preguntas',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',q.id,
          'orden',q.orden,
          'enunciado',q.enunciado,
          'tipo',q.tipo,
          'peso',q.peso,
          'explicacion',q.explicacion,
          'respuestas_aceptadas',q.respuestas_aceptadas,
          'opciones',case
            when q.tipo='RESPUESTA_LIBRE' then '[]'::jsonb
            else coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id',o.id,
                  'orden',o.orden,
                  'texto',o.texto,
                  'es_correcta',o.es_correcta
                )
                order by o.orden
              )
              from public.induccion_opciones o
              where o.pregunta_id=q.id
            ),'[]'::jsonb)
          end,
          'respuesta',coalesce(r.respuesta,'{}'::jsonb),
          'es_correcta',coalesce(r.es_correcta,false),
          'puntos_obtenidos',coalesce(r.puntos_obtenidos,0)
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
  left join public.proyectos pr on pr.id=i.proyecto_id
  where it.id=p_intento_id
  limit 1;
$$;

-- ============================================================
-- 5. RESULTADOS ADMINISTRATIVOS
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
  v_project text;
  v_rows jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  select * into v_ind
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

  if v_ind.sede_id is not null then
    select nombre into v_sede from public.sedes where id=v_ind.sede_id limit 1;
  end if;

  if v_ind.proyecto_id is not null then
    select nombre into v_project from public.proyectos where id=v_ind.proyecto_id limit 1;
  end if;

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
      p.nombre,p.dni,p.fecha_ingreso,p.puesto,p.area,
      it.nota,it.aprobado,it.correctas,it.total_preguntas,it.finalizado_at
    from public.induccion_participantes p
    join public.induccion_intentos it on it.participante_id=p.id
    where p.induccion_id=p_induccion_id
      and it.finalizado_at is not null
    order by p.id,it.finalizado_at desc
  ) x;

  return jsonb_build_object(
    'ok',true,
    'induccion',jsonb_build_object(
      'id',v_ind.id,
      'codigo',v_ind.codigo,
      'tipo',v_ind.tipo,
      'tema',coalesce(v_ind.tema,v_ind.titulo),
      'estado',v_ind.estado,
      'sede_nombre',v_sede,
      'proyecto_nombre',v_project,
      'unidad_produccion',coalesce(v_ind.unidad_produccion,v_project),
      'fecha_dia1',v_ind.fecha_dia1,
      'fecha_dia2',v_ind.fecha_dia2,
      'fecha_dia3',v_ind.fecha_dia3,
      'fecha_dia4',v_ind.fecha_dia4
    ),
    'resultados',v_rows
  );
exception
  when others then
    return jsonb_build_object('ok',false,'error',SQLERRM);
end;
$$;

-- ============================================================
-- 6. REGISTRO CONSOLIDADO / DIARIO
-- ============================================================
create or replace function public.obtener_registro_induccion(
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
  v_project text;
  v_participantes jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  select * into v_ind
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
    return jsonb_build_object('ok',false,'error','No tienes permiso para descargar este registro.');
  end if;

  if v_ind.sede_id is not null then
    select nombre into v_sede from public.sedes where id=v_ind.sede_id limit 1;
  end if;

  if v_ind.proyecto_id is not null then
    select nombre into v_project from public.proyectos where id=v_ind.proyecto_id limit 1;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',p.id,
        'dni',p.dni,
        'nombre',p.nombre,
        'fecha_ingreso',p.fecha_ingreso,
        'puesto',p.puesto,
        'area',p.area,
        'firma',p.firma,
        'estado',p.estado,
        'nota',p.nota,
        'registered_at',p.registered_at,
        'completado_at',p.completado_at
      )
      order by p.registered_at asc,p.nombre asc
    ),
    '[]'::jsonb
  )
  into v_participantes
  from public.induccion_participantes p
  where p.induccion_id=v_ind.id
    and p.dni is not null;

  return jsonb_build_object(
    'ok',true,
    'induccion',jsonb_build_object(
      'id',v_ind.id,
      'codigo',v_ind.codigo,
      'tipo',v_ind.tipo,
      'empresa',coalesce(nullif(btrim(v_ind.empresa),''),'EXPLO DRILLING PERU S.R.L.'),
      'contratista',coalesce(nullif(btrim(v_ind.contratista),''),'N.A.'),
      'sede_nombre',v_sede,
      'proyecto_nombre',v_project,
      'titular_minero',v_ind.titular_minero,
      'unidad_produccion',coalesce(v_ind.unidad_produccion,v_project),
      'distrito',v_ind.distrito,
      'provincia',v_ind.provincia,
      'tema',coalesce(v_ind.tema,v_ind.titulo),
      'tema_dia1',v_ind.tema_dia1,
      'tema_dia2',v_ind.tema_dia2,
      'tema_dia3',v_ind.tema_dia3,
      'tema_dia4',v_ind.tema_dia4,
      'expositor',v_ind.expositor,
      'expositor_cargo',v_ind.expositor_cargo,
      'expositor_dni',v_ind.expositor_dni,
      'firma_expositor',v_ind.firma_expositor,
      'fecha',v_ind.fecha,
      'fecha_dia1',v_ind.fecha_dia1,
      'fecha_dia2',v_ind.fecha_dia2,
      'fecha_dia3',v_ind.fecha_dia3,
      'fecha_dia4',v_ind.fecha_dia4,
      'area',v_ind.area,
      'tiempo_horas',v_ind.tiempo_horas,
      'tiempo_dia1',coalesce(v_ind.tiempo_dia1,8),
      'tiempo_dia2',coalesce(v_ind.tiempo_dia2,8),
      'tiempo_dia3',coalesce(v_ind.tiempo_dia3,8),
      'tiempo_dia4',coalesce(v_ind.tiempo_dia4,8),
      'estado',v_ind.estado
    ),
    'participantes',v_participantes
  );
exception
  when others then
    return jsonb_build_object('ok',false,'error',SQLERRM);
end;
$$;

-- ============================================================
-- 7. DOCUMENTOS PÚBLICOS PARA APROBADOS
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
      and i.tipo in ('LIMA','PROYECTO')
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

revoke all on function public.obtener_induccion_publica(text) from public;
revoke all on function public.registrar_participante_induccion(text,text,text,date,text,text,text) from public;
revoke all on function public.finalizar_examen_induccion(text,uuid,jsonb) from public;
revoke all on function public._detalle_resultado_induccion_json(uuid) from public;
revoke all on function public.obtener_resultados_induccion(uuid) from public;
revoke all on function public.obtener_registro_induccion(uuid) from public;
revoke all on function public.obtener_documentos_induccion_publicos(text,uuid,uuid) from public;

grant execute on function public.obtener_induccion_publica(text) to anon,authenticated;
grant execute on function public.registrar_participante_induccion(text,text,text,date,text,text,text) to anon,authenticated;
grant execute on function public.finalizar_examen_induccion(text,uuid,jsonb) to anon,authenticated;
grant execute on function public.obtener_resultados_induccion(uuid) to authenticated;
grant execute on function public.obtener_registro_induccion(uuid) to authenticated;
grant execute on function public.obtener_documentos_induccion_publicos(text,uuid,uuid) to anon,authenticated;

select 'Etapa 15 aplicada correctamente' as resultado;
