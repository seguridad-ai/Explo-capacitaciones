-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 13 - EVALUACIONES DE PRÁCTICA
-- ============================================================

create sequence if not exists public.evaluacion_practica_codigo_seq start 1;

create table if not exists public.evaluaciones_practica (
    id uuid primary key default gen_random_uuid(),
    codigo text not null unique,
    titulo text not null,
    responsable text not null,
    capacitacion_id uuid references public.capacitaciones(id) on delete set null,
    tema text not null,
    sede_id uuid references public.sedes(id) on delete set null,
    proyecto_id uuid references public.proyectos(id) on delete set null,
    fecha date not null default current_date,
    tiempo_max_min integer check (tiempo_max_min is null or tiempo_max_min between 1 and 600),
    nota_minima numeric(4,2) not null default 16 check (nota_minima between 0 and 20),
    max_intentos integer not null default 0 check (max_intentos between 0 and 20),
    reintento_solo_desaprobado boolean not null default false,
    mostrar_correcta_inmediata boolean not null default false,
    mostrar_correctas_final boolean not null default true,
    mezclar_preguntas boolean not null default true,
    mezclar_opciones boolean not null default true,
    mostrar_explicacion boolean not null default true,
    descripcion text,
    estado text not null default 'BORRADOR' check (estado in ('BORRADOR','ACTIVA','CERRADA')),
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint evaluacion_practica_unidad_check check (not (sede_id is not null and proyecto_id is not null))
);

create table if not exists public.evaluacion_practica_preguntas (
    id uuid primary key default gen_random_uuid(),
    evaluacion_id uuid not null references public.evaluaciones_practica(id) on delete cascade,
    orden integer not null default 1,
    enunciado text not null,
    tipo text not null default 'SINGLE' check (tipo in ('SINGLE','TRUE_FALSE','MULTIPLE','FREE_TEXT')),
    nivel_tema text not null default 'General',
    explicacion text,
    peso numeric(8,2) not null default 1 check (peso > 0),
    imagen_url text,
    respuestas_aceptadas jsonb not null default '[]'::jsonb,
    activo boolean not null default true,
    created_at timestamptz not null default now(),
    unique (evaluacion_id, orden)
);

create table if not exists public.evaluacion_practica_opciones (
    id uuid primary key default gen_random_uuid(),
    pregunta_id uuid not null references public.evaluacion_practica_preguntas(id) on delete cascade,
    orden integer not null,
    texto text not null,
    es_correcta boolean not null default false,
    unique (pregunta_id, orden)
);

create table if not exists public.evaluacion_practica_intentos (
    id uuid primary key default gen_random_uuid(),
    evaluacion_id uuid not null references public.evaluaciones_practica(id) on delete cascade,
    trabajador_id uuid not null references public.trabajadores(id) on delete cascade,
    dni varchar(8) not null,
    apellidos_nombres text not null,
    puesto text,
    area text,
    sede_nombre text,
    proyecto_nombre text,
    puntaje_obtenido numeric(10,2) not null default 0,
    puntaje_total numeric(10,2) not null default 0,
    nota numeric(5,2) not null default 0,
    aprobado boolean not null default false,
    correctas integer not null default 0,
    total_preguntas integer not null default 0,
    firma text,
    iniciado_at timestamptz not null default now(),
    finalizado_at timestamptz
);

create table if not exists public.evaluacion_practica_respuestas (
    id uuid primary key default gen_random_uuid(),
    intento_id uuid not null references public.evaluacion_practica_intentos(id) on delete cascade,
    pregunta_id uuid not null references public.evaluacion_practica_preguntas(id) on delete cascade,
    opcion_ids uuid[] not null default '{}',
    respuesta_texto text,
    es_correcta boolean not null default false,
    puntaje numeric(10,2) not null default 0,
    created_at timestamptz not null default now(),
    unique (intento_id, pregunta_id)
);

create index if not exists idx_eval_practica_proyecto on public.evaluaciones_practica(proyecto_id);
create index if not exists idx_eval_practica_sede on public.evaluaciones_practica(sede_id);
create index if not exists idx_eval_practica_preguntas on public.evaluacion_practica_preguntas(evaluacion_id);
create index if not exists idx_eval_practica_intentos on public.evaluacion_practica_intentos(evaluacion_id);
create index if not exists idx_eval_practica_intentos_trabajador on public.evaluacion_practica_intentos(trabajador_id);

create or replace function public.asignar_codigo_evaluacion_practica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.codigo is null or btrim(new.codigo) = '' then
    new.codigo := 'EVA-' || to_char(current_date, 'YYYY') || '-' ||
                  lpad(nextval('public.evaluacion_practica_codigo_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_eval_practica_codigo on public.evaluaciones_practica;
create trigger trg_eval_practica_codigo
before insert on public.evaluaciones_practica
for each row execute function public.asignar_codigo_evaluacion_practica();

drop trigger if exists trg_eval_practica_updated_at on public.evaluaciones_practica;
create trigger trg_eval_practica_updated_at
before update on public.evaluaciones_practica
for each row execute function public.actualizar_updated_at();

create or replace function public.can_view_practice_evaluation(p_evaluacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.evaluaciones_practica e
    where e.id = p_evaluacion_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or e.proyecto_id is null
        or public.has_project_access(e.proyecto_id)
      )
  );
$$;

create or replace function public.can_manage_practice_evaluation(p_evaluacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.evaluaciones_practica e
    where e.id = p_evaluacion_id
      and (
        public.is_admin()
        or (e.proyecto_id is not null and public.can_manage_project(e.proyecto_id))
      )
  );
$$;

alter table public.evaluaciones_practica enable row level security;
alter table public.evaluacion_practica_preguntas enable row level security;
alter table public.evaluacion_practica_opciones enable row level security;
alter table public.evaluacion_practica_intentos enable row level security;
alter table public.evaluacion_practica_respuestas enable row level security;

-- EVALUACIONES
 drop policy if exists eval_practica_select on public.evaluaciones_practica;
 drop policy if exists eval_practica_insert on public.evaluaciones_practica;
 drop policy if exists eval_practica_update on public.evaluaciones_practica;
 drop policy if exists eval_practica_delete on public.evaluaciones_practica;

create policy eval_practica_select on public.evaluaciones_practica
for select to authenticated
using (
  public.is_admin()
  or public.can_view_all_projects()
  or proyecto_id is null
  or public.has_project_access(proyecto_id)
);

create policy eval_practica_insert on public.evaluaciones_practica
for insert to authenticated
with check (
  public.is_admin()
  or (proyecto_id is not null and public.can_manage_project(proyecto_id))
);

create policy eval_practica_update on public.evaluaciones_practica
for update to authenticated
using (
  public.is_admin()
  or (proyecto_id is not null and public.can_manage_project(proyecto_id))
)
with check (
  public.is_admin()
  or (proyecto_id is not null and public.can_manage_project(proyecto_id))
);

create policy eval_practica_delete on public.evaluaciones_practica
for delete to authenticated
using (
  public.is_admin()
  or (proyecto_id is not null and public.can_manage_project(proyecto_id))
);

-- PREGUNTAS
 drop policy if exists eval_practica_preg_select on public.evaluacion_practica_preguntas;
 drop policy if exists eval_practica_preg_manage on public.evaluacion_practica_preguntas;
create policy eval_practica_preg_select on public.evaluacion_practica_preguntas
for select to authenticated using (public.can_view_practice_evaluation(evaluacion_id));
create policy eval_practica_preg_manage on public.evaluacion_practica_preguntas
for all to authenticated
using (public.can_manage_practice_evaluation(evaluacion_id))
with check (public.can_manage_practice_evaluation(evaluacion_id));

-- OPCIONES
 drop policy if exists eval_practica_op_select on public.evaluacion_practica_opciones;
 drop policy if exists eval_practica_op_manage on public.evaluacion_practica_opciones;
create policy eval_practica_op_select on public.evaluacion_practica_opciones
for select to authenticated
using (
  exists (
    select 1 from public.evaluacion_practica_preguntas q
    where q.id = pregunta_id
      and public.can_view_practice_evaluation(q.evaluacion_id)
  )
);
create policy eval_practica_op_manage on public.evaluacion_practica_opciones
for all to authenticated
using (
  exists (
    select 1 from public.evaluacion_practica_preguntas q
    where q.id = pregunta_id
      and public.can_manage_practice_evaluation(q.evaluacion_id)
  )
)
with check (
  exists (
    select 1 from public.evaluacion_practica_preguntas q
    where q.id = pregunta_id
      and public.can_manage_practice_evaluation(q.evaluacion_id)
  )
);

-- INTENTOS / RESPUESTAS
 drop policy if exists eval_practica_intentos_select on public.evaluacion_practica_intentos;
create policy eval_practica_intentos_select on public.evaluacion_practica_intentos
for select to authenticated
using (public.can_view_practice_evaluation(evaluacion_id));

 drop policy if exists eval_practica_resp_select on public.evaluacion_practica_respuestas;
create policy eval_practica_resp_select on public.evaluacion_practica_respuestas
for select to authenticated
using (
  exists (
    select 1 from public.evaluacion_practica_intentos i
    where i.id = intento_id
      and public.can_view_practice_evaluation(i.evaluacion_id)
  )
);

revoke all on table public.evaluaciones_practica, public.evaluacion_practica_preguntas,
  public.evaluacion_practica_opciones, public.evaluacion_practica_intentos,
  public.evaluacion_practica_respuestas from anon;

grant select,insert,update,delete on table public.evaluaciones_practica,
  public.evaluacion_practica_preguntas, public.evaluacion_practica_opciones to authenticated;
grant select on table public.evaluacion_practica_intentos,
  public.evaluacion_practica_respuestas to authenticated;
grant usage,select on sequence public.evaluacion_practica_codigo_seq to authenticated;

-- ============================================================
-- STORAGE PARA IMÁGENES DE PREGUNTAS
-- ============================================================
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'evaluacion-imagenes',
  'evaluacion-imagenes',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

 drop policy if exists eval_images_read on storage.objects;
 drop policy if exists eval_images_insert on storage.objects;
 drop policy if exists eval_images_update on storage.objects;
 drop policy if exists eval_images_delete on storage.objects;

create policy eval_images_read on storage.objects
for select to public using (bucket_id = 'evaluacion-imagenes');
create policy eval_images_insert on storage.objects
for insert to authenticated with check (bucket_id = 'evaluacion-imagenes');
create policy eval_images_update on storage.objects
for update to authenticated using (bucket_id = 'evaluacion-imagenes') with check (bucket_id = 'evaluacion-imagenes');
create policy eval_images_delete on storage.objects
for delete to authenticated using (bucket_id = 'evaluacion-imagenes');

-- ============================================================
-- ADMIN: GUARDAR / LISTAR / ELIMINAR PREGUNTAS
-- ============================================================
create or replace function public.guardar_pregunta_evaluacion_practica(
  p_evaluacion_id uuid,
  p_pregunta_id uuid,
  p_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_order integer;
  v_type text := upper(coalesce(p_data->>'tipo','SINGLE'));
  v_options jsonb := coalesce(p_data->'opciones','[]'::jsonb);
  v_accepted jsonb := coalesce(p_data->'respuestas_aceptadas','[]'::jsonb);
  v_correct_count integer := 0;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','Sesión no válida.'); end if;
  if not public.can_manage_practice_evaluation(p_evaluacion_id) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para modificar esta evaluación.');
  end if;
  if btrim(coalesce(p_data->>'enunciado','')) = '' then
    return jsonb_build_object('ok',false,'error','Ingresa el enunciado.');
  end if;
  if v_type not in ('SINGLE','TRUE_FALSE','MULTIPLE','FREE_TEXT') then
    return jsonb_build_object('ok',false,'error','Tipo de pregunta no válido.');
  end if;
  if coalesce((p_data->>'peso')::numeric,0) <= 0 then
    return jsonb_build_object('ok',false,'error','El peso debe ser mayor que cero.');
  end if;

  if v_type <> 'FREE_TEXT' then
    if jsonb_array_length(v_options) < 2 then
      return jsonb_build_object('ok',false,'error','Agrega al menos dos alternativas.');
    end if;
    select count(*) into v_correct_count
    from jsonb_array_elements(v_options) x
    where coalesce((x->>'es_correcta')::boolean,false) = true;
    if v_type in ('SINGLE','TRUE_FALSE') and v_correct_count <> 1 then
      return jsonb_build_object('ok',false,'error','Marca una sola respuesta correcta.');
    end if;
    if v_type = 'MULTIPLE' and v_correct_count < 1 then
      return jsonb_build_object('ok',false,'error','Marca al menos una respuesta correcta.');
    end if;
  else
    if jsonb_array_length(v_accepted) < 1 then
      return jsonb_build_object('ok',false,'error','Agrega al menos una respuesta aceptada.');
    end if;
  end if;

  if p_pregunta_id is null then
    select coalesce(max(orden),0)+1 into v_order
    from public.evaluacion_practica_preguntas
    where evaluacion_id=p_evaluacion_id;

    insert into public.evaluacion_practica_preguntas(
      evaluacion_id,orden,enunciado,tipo,nivel_tema,explicacion,peso,imagen_url,respuestas_aceptadas,activo
    ) values (
      p_evaluacion_id,v_order,btrim(p_data->>'enunciado'),v_type,
      coalesce(nullif(btrim(p_data->>'nivel_tema'),''),'General'),
      nullif(btrim(p_data->>'explicacion'),''),
      (p_data->>'peso')::numeric,
      nullif(btrim(p_data->>'imagen_url'),''),
      v_accepted,true
    ) returning id into v_id;
  else
    v_id := p_pregunta_id;
    update public.evaluacion_practica_preguntas set
      enunciado=btrim(p_data->>'enunciado'),
      tipo=v_type,
      nivel_tema=coalesce(nullif(btrim(p_data->>'nivel_tema'),''),'General'),
      explicacion=nullif(btrim(p_data->>'explicacion'),''),
      peso=(p_data->>'peso')::numeric,
      imagen_url=nullif(btrim(p_data->>'imagen_url'),''),
      respuestas_aceptadas=v_accepted,
      activo=true
    where id=v_id and evaluacion_id=p_evaluacion_id;
    delete from public.evaluacion_practica_opciones where pregunta_id=v_id;
  end if;

  if v_type <> 'FREE_TEXT' then
    insert into public.evaluacion_practica_opciones(pregunta_id,orden,texto,es_correcta)
    select v_id,
           ord::integer,
           btrim(x->>'texto'),
           coalesce((x->>'es_correcta')::boolean,false)
    from jsonb_array_elements(v_options) with ordinality as t(x,ord)
    where btrim(coalesce(x->>'texto','')) <> '';
  end if;

  return jsonb_build_object('ok',true,'pregunta_id',v_id);
exception when others then
  return jsonb_build_object('ok',false,'error',SQLERRM);
end;
$$;

create or replace function public.listar_preguntas_evaluacion_practica(p_evaluacion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.can_view_practice_evaluation(p_evaluacion_id) then
    return jsonb_build_object('ok',false,'error','No tienes acceso a esta evaluación.');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',q.id,'orden',q.orden,'enunciado',q.enunciado,'tipo',q.tipo,
      'nivel_tema',q.nivel_tema,'explicacion',q.explicacion,'peso',q.peso,
      'imagen_url',q.imagen_url,'respuestas_aceptadas',q.respuestas_aceptadas,
      'opciones',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'id',o.id,'orden',o.orden,'texto',o.texto,'es_correcta',o.es_correcta
        ) order by o.orden),'[]'::jsonb)
        from public.evaluacion_practica_opciones o where o.pregunta_id=q.id
      )
    ) order by q.orden
  ),'[]'::jsonb) into v_result
  from public.evaluacion_practica_preguntas q
  where q.evaluacion_id=p_evaluacion_id and q.activo=true;

  return jsonb_build_object('ok',true,'preguntas',v_result);
end;
$$;

create or replace function public.eliminar_pregunta_evaluacion_practica(p_pregunta_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_eval uuid;
begin
  select evaluacion_id into v_eval from public.evaluacion_practica_preguntas where id=p_pregunta_id limit 1;
  if v_eval is null then return jsonb_build_object('ok',false,'error','Pregunta no encontrada.'); end if;
  if not public.can_manage_practice_evaluation(v_eval) then return jsonb_build_object('ok',false,'error','Sin permiso.'); end if;
  delete from public.evaluacion_practica_preguntas where id=p_pregunta_id;
  return jsonb_build_object('ok',true);
end;
$$;

-- ============================================================
-- PÚBLICO: IDENTIFICAR / REGISTRAR TRABAJADOR
-- ============================================================
create or replace function public.obtener_evaluacion_practica_participante(p_codigo text,p_dni text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eval public.evaluaciones_practica%rowtype;
  v_worker public.trabajadores%rowtype;
  v_sede text; v_project text; v_attempts integer:=0; v_approved boolean:=false;
begin
  select * into v_eval from public.evaluaciones_practica
  where upper(codigo)=upper(btrim(p_codigo)) and estado='ACTIVA' limit 1;
  if not found then return jsonb_build_object('ok',false,'error','La evaluación no está disponible.'); end if;
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then return jsonb_build_object('ok',false,'error','Ingresa un DNI válido.'); end if;
  select * into v_worker from public.trabajadores where dni=p_dni limit 1;
  if not found then
    return jsonb_build_object('ok',true,'registrado',false,'codigo',v_eval.codigo,'titulo',v_eval.titulo,
      'tema',v_eval.tema,'proyecto_id',v_eval.proyecto_id,'sede_id',v_eval.sede_id);
  end if;
  if not v_worker.activo then return jsonb_build_object('ok',false,'error','Tu registro se encuentra inactivo.'); end if;
  if v_eval.proyecto_id is not null and v_worker.proyecto_id is distinct from v_eval.proyecto_id then
    return jsonb_build_object('ok',false,'error','Esta evaluación corresponde a otro proyecto.');
  end if;
  if v_eval.sede_id is not null and v_worker.sede_id is distinct from v_eval.sede_id then
    return jsonb_build_object('ok',false,'error','Esta evaluación corresponde a otra sede.');
  end if;
  select nombre into v_sede from public.sedes where id=v_worker.sede_id;
  select nombre into v_project from public.proyectos where id=v_worker.proyecto_id;
  select count(*),coalesce(bool_or(aprobado),false) into v_attempts,v_approved
  from public.evaluacion_practica_intentos
  where evaluacion_id=v_eval.id and trabajador_id=v_worker.id and finalizado_at is not null;

  if v_eval.reintento_solo_desaprobado and v_approved then
    return jsonb_build_object('ok',false,'error','Ya aprobaste esta evaluación.');
  end if;
  if v_eval.max_intentos>0 and v_attempts>=v_eval.max_intentos then
    return jsonb_build_object('ok',false,'error','Ya alcanzaste el máximo de intentos.');
  end if;

  return jsonb_build_object(
    'ok',true,'registrado',true,'codigo',v_eval.codigo,'titulo',v_eval.titulo,'tema',v_eval.tema,
    'dni',v_worker.dni,'nombre',trim(v_worker.apellidos||' '||v_worker.nombres),
    'puesto',v_worker.cargo,'area',v_worker.area,'sede',v_sede,'proyecto',v_project,
    'intentos_realizados',v_attempts,'max_intentos',v_eval.max_intentos
  );
end;
$$;

create or replace function public.listar_sedes_registro_evaluacion_practica(p_codigo text)
returns table(id uuid,nombre text)
language sql
security definer
set search_path = ''
as $$ select s.id,s.nombre from public.sedes s where s.activo=true order by s.nombre; $$;

create or replace function public.registrar_trabajador_evaluacion_practica(
  p_codigo text,p_dni text,p_nombres text,p_apellidos text,p_cargo text,p_area text,p_sede_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_eval public.evaluaciones_practica%rowtype; v_existing public.trabajadores%rowtype; v_sede uuid;
begin
  select * into v_eval from public.evaluaciones_practica where upper(codigo)=upper(btrim(p_codigo)) and estado='ACTIVA' limit 1;
  if not found then return jsonb_build_object('ok',false,'error','La evaluación no está disponible.'); end if;
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then return jsonb_build_object('ok',false,'error','DNI no válido.'); end if;
  select * into v_existing from public.trabajadores where dni=p_dni limit 1;
  if found then return public.obtener_evaluacion_practica_participante(p_codigo,p_dni); end if;
  if btrim(coalesce(p_nombres,''))='' or btrim(coalesce(p_apellidos,''))='' or btrim(coalesce(p_cargo,''))='' or btrim(coalesce(p_area,''))='' then
    return jsonb_build_object('ok',false,'error','Completa nombres, apellidos, puesto y área.');
  end if;
  v_sede:=coalesce(v_eval.sede_id,p_sede_id);
  if v_eval.proyecto_id is null and v_sede is null then return jsonb_build_object('ok',false,'error','Selecciona tu sede.'); end if;
  insert into public.trabajadores(dni,nombres,apellidos,cargo,area,empresa,sede_id,proyecto_id,activo)
  values(p_dni,btrim(p_nombres),btrim(p_apellidos),btrim(p_cargo),btrim(p_area),'EXPLO DRILLING PERU S.R.L.',v_sede,v_eval.proyecto_id,true);
  return public.obtener_evaluacion_practica_participante(p_codigo,p_dni);
end;
$$;

-- ============================================================
-- PÚBLICO: INICIAR EVALUACIÓN
-- ============================================================
create or replace function public.iniciar_evaluacion_practica(p_codigo text,p_dni text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eval public.evaluaciones_practica%rowtype;
  v_worker public.trabajadores%rowtype;
  v_intento uuid; v_total integer; v_attempts integer:=0; v_approved boolean:=false; v_questions jsonb;
begin
  select * into v_eval from public.evaluaciones_practica where upper(codigo)=upper(btrim(p_codigo)) and estado='ACTIVA' limit 1;
  if not found then return jsonb_build_object('ok',false,'error','La evaluación no está disponible.'); end if;
  select * into v_worker from public.trabajadores where dni=p_dni and activo=true limit 1;
  if not found then return jsonb_build_object('ok',false,'error','Trabajador no encontrado o inactivo.'); end if;
  if v_eval.proyecto_id is not null and v_worker.proyecto_id is distinct from v_eval.proyecto_id then return jsonb_build_object('ok',false,'error','Evaluación de otro proyecto.'); end if;
  if v_eval.sede_id is not null and v_worker.sede_id is distinct from v_eval.sede_id then return jsonb_build_object('ok',false,'error','Evaluación de otra sede.'); end if;

  select count(*),coalesce(bool_or(aprobado),false) into v_attempts,v_approved
  from public.evaluacion_practica_intentos where evaluacion_id=v_eval.id and trabajador_id=v_worker.id and finalizado_at is not null;
  if v_eval.reintento_solo_desaprobado and v_approved then return jsonb_build_object('ok',false,'error','Ya aprobaste esta evaluación.'); end if;
  if v_eval.max_intentos>0 and v_attempts>=v_eval.max_intentos then return jsonb_build_object('ok',false,'error','Máximo de intentos alcanzado.'); end if;

  select count(*) into v_total from public.evaluacion_practica_preguntas where evaluacion_id=v_eval.id and activo=true;
  if v_total=0 then return jsonb_build_object('ok',false,'error','La evaluación no tiene preguntas.'); end if;

  insert into public.evaluacion_practica_intentos(
    evaluacion_id,trabajador_id,dni,apellidos_nombres,puesto,area,sede_nombre,proyecto_nombre,total_preguntas
  ) values(
    v_eval.id,v_worker.id,v_worker.dni,trim(v_worker.apellidos||' '||v_worker.nombres),v_worker.cargo,v_worker.area,
    (select nombre from public.sedes where id=v_worker.sede_id),
    (select nombre from public.proyectos where id=v_worker.proyecto_id),v_total
  ) returning id into v_intento;

  select jsonb_agg(qobj order by sort_key) into v_questions
  from (
    select case when v_eval.mezclar_preguntas then random() else q.orden::double precision end sort_key,
      jsonb_build_object(
        'id',q.id,'orden',q.orden,'enunciado',q.enunciado,'tipo',q.tipo,'nivel_tema',q.nivel_tema,
        'peso',q.peso,'imagen_url',q.imagen_url,
        'opciones',case when q.tipo='FREE_TEXT' then '[]'::jsonb else (
          select coalesce(jsonb_agg(jsonb_build_object('id',oo.id,'orden',oo.orden,'texto',oo.texto) order by oo.sort_key),'[]'::jsonb)
          from (
            select o.*,case when v_eval.mezclar_opciones then random() else o.orden::double precision end sort_key
            from public.evaluacion_practica_opciones o where o.pregunta_id=q.id
          ) oo
        ) end
      ) qobj
    from public.evaluacion_practica_preguntas q
    where q.evaluacion_id=v_eval.id and q.activo=true
  ) z;

  return jsonb_build_object(
    'ok',true,'intento_id',v_intento,'titulo',v_eval.titulo,'tema',v_eval.tema,'descripcion',v_eval.descripcion,
    'participante',trim(v_worker.apellidos||' '||v_worker.nombres),'tiempo_max_min',v_eval.tiempo_max_min,
    'nota_minima',v_eval.nota_minima,'mostrar_correcta_inmediata',v_eval.mostrar_correcta_inmediata,
    'mostrar_correctas_final',v_eval.mostrar_correctas_final,'mostrar_explicacion',v_eval.mostrar_explicacion,
    'preguntas',coalesce(v_questions,'[]'::jsonb)
  );
end;
$$;

-- Verificación opcional inmediata
create or replace function public.verificar_respuesta_evaluacion_practica(
  p_codigo text,p_pregunta_id uuid,p_opcion_ids uuid[] default '{}',p_respuesta_texto text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_eval public.evaluaciones_practica%rowtype; v_q public.evaluacion_practica_preguntas%rowtype; v_correct uuid[]; v_ok boolean:=false; v_correct_text jsonb;
begin
  select * into v_eval from public.evaluaciones_practica where upper(codigo)=upper(btrim(p_codigo)) and estado='ACTIVA' limit 1;
  if not found or not v_eval.mostrar_correcta_inmediata then return jsonb_build_object('ok',false,'error','La verificación inmediata no está habilitada.'); end if;
  select * into v_q from public.evaluacion_practica_preguntas where id=p_pregunta_id and evaluacion_id=v_eval.id limit 1;
  if not found then return jsonb_build_object('ok',false,'error','Pregunta no válida.'); end if;
  if v_q.tipo='FREE_TEXT' then
    v_ok := exists(select 1 from jsonb_array_elements_text(v_q.respuestas_aceptadas) a where lower(btrim(a))=lower(btrim(coalesce(p_respuesta_texto,''))));
    v_correct_text := v_q.respuestas_aceptadas;
  else
    select coalesce(array_agg(id order by id),'{}') into v_correct from public.evaluacion_practica_opciones where pregunta_id=v_q.id and es_correcta=true;
    select coalesce(jsonb_agg(texto order by orden),'[]'::jsonb) into v_correct_text from public.evaluacion_practica_opciones where pregunta_id=v_q.id and es_correcta=true;
    v_ok := (select coalesce(array_agg(x order by x),'{}') from unnest(coalesce(p_opcion_ids,'{}')) x) = v_correct;
  end if;
  return jsonb_build_object('ok',true,'es_correcta',v_ok,'correctas',v_correct_text,'explicacion',v_q.explicacion);
end;
$$;

-- ============================================================
-- FINALIZAR Y CALIFICAR
-- ============================================================
create or replace function public.finalizar_evaluacion_practica(
  p_intento_id uuid,p_dni text,p_respuestas jsonb,p_firma text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.evaluacion_practica_intentos%rowtype;
  v_eval public.evaluaciones_practica%rowtype;
  v_q public.evaluacion_practica_preguntas%rowtype;
  v_item jsonb; v_ids uuid[]; v_correct_ids uuid[]; v_text text; v_ok boolean; v_pts numeric;
  v_score numeric:=0; v_total numeric:=0; v_correct integer:=0; v_count integer:=0; v_note numeric:=0;
  v_reinforce jsonb; v_mastered jsonb;
begin
  select * into v_attempt from public.evaluacion_practica_intentos where id=p_intento_id and dni=p_dni and finalizado_at is null limit 1;
  if not found then return jsonb_build_object('ok',false,'error','Intento no válido o ya finalizado.'); end if;
  select * into v_eval from public.evaluaciones_practica where id=v_attempt.evaluacion_id limit 1;
  if not found then return jsonb_build_object('ok',false,'error','Evaluación no encontrada.'); end if;
  if p_firma is null or length(p_firma)<30 then return jsonb_build_object('ok',false,'error','Registra tu firma antes de finalizar.'); end if;

  delete from public.evaluacion_practica_respuestas where intento_id=p_intento_id;

  for v_q in select * from public.evaluacion_practica_preguntas where evaluacion_id=v_eval.id and activo=true order by orden loop
    v_count:=v_count+1; v_total:=v_total+v_q.peso; v_ok:=false; v_pts:=0; v_ids:='{}'; v_text:=null;
    select x into v_item from jsonb_array_elements(coalesce(p_respuestas,'[]'::jsonb)) x where (x->>'pregunta_id')::uuid=v_q.id limit 1;
    if v_item is not null then
      if v_q.tipo='FREE_TEXT' then
        v_text:=coalesce(v_item->>'texto','');
        v_ok:=exists(select 1 from jsonb_array_elements_text(v_q.respuestas_aceptadas) a where lower(btrim(a))=lower(btrim(v_text)));
      else
        select coalesce(array_agg(value::uuid order by value::uuid),'{}') into v_ids from jsonb_array_elements_text(coalesce(v_item->'opcion_ids','[]'::jsonb));
        select coalesce(array_agg(id order by id),'{}') into v_correct_ids from public.evaluacion_practica_opciones where pregunta_id=v_q.id and es_correcta=true;
        v_ok:=v_ids=v_correct_ids;
      end if;
    end if;
    if v_ok then v_pts:=v_q.peso; v_score:=v_score+v_q.peso; v_correct:=v_correct+1; end if;
    insert into public.evaluacion_practica_respuestas(intento_id,pregunta_id,opcion_ids,respuesta_texto,es_correcta,puntaje)
    values(p_intento_id,v_q.id,coalesce(v_ids,'{}'),v_text,v_ok,v_pts);
  end loop;

  if v_total>0 then v_note:=round((v_score/v_total)*20,2); end if;

  update public.evaluacion_practica_intentos set
    puntaje_obtenido=v_score,puntaje_total=v_total,nota=v_note,aprobado=(v_note>=v_eval.nota_minima),
    correctas=v_correct,total_preguntas=v_count,firma=p_firma,finalizado_at=now()
  where id=p_intento_id;

  select coalesce(jsonb_agg(jsonb_build_object('tema',nivel_tema,'errores',errores) order by errores desc,nivel_tema),'[]'::jsonb)
  into v_reinforce
  from (
    select q.nivel_tema,count(*) errores
    from public.evaluacion_practica_respuestas r join public.evaluacion_practica_preguntas q on q.id=r.pregunta_id
    where r.intento_id=p_intento_id and not r.es_correcta group by q.nivel_tema
  ) s;

  select coalesce(jsonb_agg(nivel_tema order by nivel_tema),'[]'::jsonb) into v_mastered
  from (
    select q.nivel_tema
    from public.evaluacion_practica_preguntas q
    where q.evaluacion_id=v_eval.id and q.activo=true
    group by q.nivel_tema
    having count(*) filter(where q.id in (select r.pregunta_id from public.evaluacion_practica_respuestas r where r.intento_id=p_intento_id and not r.es_correcta))=0
  ) m;

  return jsonb_build_object(
    'ok',true,'nota',v_note,'aprobado',(v_note>=v_eval.nota_minima),'correctas',v_correct,'total',v_count,
    'nota_minima',v_eval.nota_minima,'temas_reforzar',v_reinforce,'temas_dominados',v_mastered,
    'mostrar_correctas_final',v_eval.mostrar_correctas_final,'mostrar_explicacion',v_eval.mostrar_explicacion
  );
end;
$$;

-- ============================================================
-- REVISIÓN PÚBLICA DEL INTENTO
-- ============================================================
create or replace function public.revisar_evaluacion_practica(p_intento_id uuid,p_dni text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempt public.evaluacion_practica_intentos%rowtype; v_eval public.evaluaciones_practica%rowtype; v_items jsonb; v_reinforce jsonb; v_mastered jsonb;
begin
  select * into v_attempt from public.evaluacion_practica_intentos where id=p_intento_id and dni=p_dni and finalizado_at is not null limit 1;
  if not found then return jsonb_build_object('ok',false,'error','Resultado no encontrado.'); end if;
  select * into v_eval from public.evaluaciones_practica where id=v_attempt.evaluacion_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'pregunta_id',q.id,'orden',q.orden,'enunciado',q.enunciado,'tipo',q.tipo,'nivel_tema',q.nivel_tema,
    'explicacion',case when v_eval.mostrar_explicacion then q.explicacion else null end,
    'imagen_url',q.imagen_url,'es_correcta',r.es_correcta,'respuesta_texto',r.respuesta_texto,
    'respuesta_seleccionada',(
      select coalesce(jsonb_agg(o.texto order by o.orden),'[]'::jsonb) from public.evaluacion_practica_opciones o where o.id=any(r.opcion_ids)
    ),
    'respuestas_correctas',case when v_eval.mostrar_correctas_final then (
      case when q.tipo='FREE_TEXT' then q.respuestas_aceptadas else (
        select coalesce(jsonb_agg(o.texto order by o.orden),'[]'::jsonb) from public.evaluacion_practica_opciones o where o.pregunta_id=q.id and o.es_correcta=true
      ) end
    ) else '[]'::jsonb end
  ) order by q.orden),'[]'::jsonb) into v_items
  from public.evaluacion_practica_respuestas r join public.evaluacion_practica_preguntas q on q.id=r.pregunta_id
  where r.intento_id=p_intento_id;

  select coalesce(jsonb_agg(jsonb_build_object('tema',nivel_tema,'errores',errores) order by errores desc,nivel_tema),'[]'::jsonb)
  into v_reinforce from (
    select q.nivel_tema,count(*) errores from public.evaluacion_practica_respuestas r join public.evaluacion_practica_preguntas q on q.id=r.pregunta_id
    where r.intento_id=p_intento_id and not r.es_correcta group by q.nivel_tema
  ) s;

  select coalesce(jsonb_agg(nivel_tema order by nivel_tema),'[]'::jsonb) into v_mastered from (
    select q.nivel_tema from public.evaluacion_practica_preguntas q where q.evaluacion_id=v_eval.id and q.activo=true
    group by q.nivel_tema
    having count(*) filter(where q.id in (select r.pregunta_id from public.evaluacion_practica_respuestas r where r.intento_id=p_intento_id and not r.es_correcta))=0
  ) m;

  return jsonb_build_object('ok',true,'intento',jsonb_build_object(
    'id',v_attempt.id,'nombre',v_attempt.apellidos_nombres,'dni',v_attempt.dni,'nota',v_attempt.nota,'aprobado',v_attempt.aprobado,
    'correctas',v_attempt.correctas,'total',v_attempt.total_preguntas
  ),'preguntas',v_items,'temas_reforzar',v_reinforce,'temas_dominados',v_mastered);
end;
$$;

-- ============================================================
-- PERMISOS DE FUNCIONES
-- ============================================================
revoke all on function public.can_view_practice_evaluation(uuid) from public;
revoke all on function public.can_manage_practice_evaluation(uuid) from public;
revoke all on function public.guardar_pregunta_evaluacion_practica(uuid,uuid,jsonb) from public;
revoke all on function public.listar_preguntas_evaluacion_practica(uuid) from public;
revoke all on function public.eliminar_pregunta_evaluacion_practica(uuid) from public;
revoke all on function public.obtener_evaluacion_practica_participante(text,text) from public;
revoke all on function public.listar_sedes_registro_evaluacion_practica(text) from public;
revoke all on function public.registrar_trabajador_evaluacion_practica(text,text,text,text,text,text,uuid) from public;
revoke all on function public.iniciar_evaluacion_practica(text,text) from public;
revoke all on function public.verificar_respuesta_evaluacion_practica(text,uuid,uuid[],text) from public;
revoke all on function public.finalizar_evaluacion_practica(uuid,text,jsonb,text) from public;
revoke all on function public.revisar_evaluacion_practica(uuid,text) from public;

grant execute on function public.can_view_practice_evaluation(uuid),public.can_manage_practice_evaluation(uuid),
  public.guardar_pregunta_evaluacion_practica(uuid,uuid,jsonb),public.listar_preguntas_evaluacion_practica(uuid),
  public.eliminar_pregunta_evaluacion_practica(uuid) to authenticated;

grant execute on function public.obtener_evaluacion_practica_participante(text,text),
  public.listar_sedes_registro_evaluacion_practica(text),
  public.registrar_trabajador_evaluacion_practica(text,text,text,text,text,text,uuid),
  public.iniciar_evaluacion_practica(text,text),
  public.verificar_respuesta_evaluacion_practica(text,uuid,uuid[],text),
  public.finalizar_evaluacion_practica(uuid,text,jsonb,text),
  public.revisar_evaluacion_practica(uuid,text)
  to anon,authenticated;

select 'Etapa 13 - Evaluaciones de práctica aplicada correctamente' as resultado;
