-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 16D.3
-- EXAMEN FINAL + RESULTADOS + TEMAS A REFORZAR
-- CAPACITACIONES DEL COMITÉ / SUBCOMITÉ SST
-- ============================================================

-- ------------------------------------------------------------
-- 1. Configuración adicional del examen en la capacitación
-- ------------------------------------------------------------
alter table public.comite_sst_capacitaciones
  add column if not exists tiempo_examen_min integer
    check (tiempo_examen_min is null or tiempo_examen_min between 1 and 600),
  add column if not exists mezclar_preguntas boolean not null default true,
  add column if not exists mezclar_opciones boolean not null default true,
  add column if not exists mostrar_correctas_final boolean not null default true,
  add column if not exists mostrar_explicacion boolean not null default true,
  add column if not exists reintento_solo_desaprobado boolean not null default true;

-- ------------------------------------------------------------
-- 2. Preguntas y alternativas
-- ------------------------------------------------------------
create table if not exists public.comite_sst_capacitacion_preguntas (
  id uuid primary key default gen_random_uuid(),
  capacitacion_id uuid not null
    references public.comite_sst_capacitaciones(id) on delete cascade,
  orden integer not null default 1,
  enunciado text not null,
  tipo text not null default 'SINGLE'
    check (tipo in ('SINGLE','TRUE_FALSE','MULTIPLE','FREE_TEXT')),
  nivel_tema text not null default 'General',
  explicacion text,
  peso numeric(8,2) not null default 1 check (peso > 0),
  imagen_url text,
  imagen_path text,
  respuestas_aceptadas jsonb not null default '[]'::jsonb,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(capacitacion_id,orden)
);

create table if not exists public.comite_sst_capacitacion_opciones (
  id uuid primary key default gen_random_uuid(),
  pregunta_id uuid not null
    references public.comite_sst_capacitacion_preguntas(id) on delete cascade,
  orden integer not null,
  texto text not null,
  es_correcta boolean not null default false,
  unique(pregunta_id,orden)
);

create index if not exists idx_comite_cap_preguntas_capacitacion
on public.comite_sst_capacitacion_preguntas(capacitacion_id,orden);

create index if not exists idx_comite_cap_opciones_pregunta
on public.comite_sst_capacitacion_opciones(pregunta_id,orden);

-- ------------------------------------------------------------
-- 3. Intentos y respuestas
-- ------------------------------------------------------------
create table if not exists public.comite_sst_capacitacion_intentos (
  id uuid primary key default gen_random_uuid(),
  capacitacion_id uuid not null
    references public.comite_sst_capacitaciones(id) on delete cascade,
  participante_id uuid not null
    references public.comite_sst_capacitacion_participantes(id) on delete cascade,
  numero_intento integer not null,
  puntaje_obtenido numeric(10,2) not null default 0,
  puntaje_total numeric(10,2) not null default 0,
  nota numeric(5,2) not null default 0,
  aprobado boolean not null default false,
  correctas integer not null default 0,
  total_preguntas integer not null default 0,
  iniciado_at timestamptz not null default now(),
  finalizado_at timestamptz,
  unique(participante_id,numero_intento)
);

create table if not exists public.comite_sst_capacitacion_respuestas (
  id uuid primary key default gen_random_uuid(),
  intento_id uuid not null
    references public.comite_sst_capacitacion_intentos(id) on delete cascade,
  pregunta_id uuid not null
    references public.comite_sst_capacitacion_preguntas(id) on delete cascade,
  opcion_ids uuid[] not null default '{}',
  respuesta_texto text,
  es_correcta boolean not null default false,
  puntaje numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(intento_id,pregunta_id)
);

create index if not exists idx_comite_cap_intentos_capacitacion
on public.comite_sst_capacitacion_intentos(capacitacion_id,finalizado_at);

create index if not exists idx_comite_cap_intentos_participante
on public.comite_sst_capacitacion_intentos(participante_id,numero_intento);

create index if not exists idx_comite_cap_respuestas_intento
on public.comite_sst_capacitacion_respuestas(intento_id);

-- ------------------------------------------------------------
-- 4. updated_at para preguntas
-- ------------------------------------------------------------
create or replace function public.touch_comite_sst_capacitacion_pregunta_updated_at()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_touch_comite_sst_cap_preguntas
on public.comite_sst_capacitacion_preguntas;

create trigger trg_touch_comite_sst_cap_preguntas
before update on public.comite_sst_capacitacion_preguntas
for each row execute function public.touch_comite_sst_capacitacion_pregunta_updated_at();

-- ============================================================
-- 5. PERMISOS / RLS ADMINISTRACIÓN
-- ============================================================
create or replace function public.can_view_committee_training(p_capacitacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id=p_capacitacion_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.has_project_access(c.proyecto_id)
        )
      )
  );
$$;

create or replace function public.can_manage_committee_training(p_capacitacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id=p_capacitacion_id
      and (
        public.is_admin()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.can_manage_project(c.proyecto_id)
        )
      )
  );
$$;

alter table public.comite_sst_capacitacion_preguntas enable row level security;
alter table public.comite_sst_capacitacion_opciones enable row level security;
alter table public.comite_sst_capacitacion_intentos enable row level security;
alter table public.comite_sst_capacitacion_respuestas enable row level security;

-- Preguntas
 drop policy if exists comite_cap_preguntas_select on public.comite_sst_capacitacion_preguntas;
 drop policy if exists comite_cap_preguntas_manage on public.comite_sst_capacitacion_preguntas;

create policy comite_cap_preguntas_select
on public.comite_sst_capacitacion_preguntas
for select to authenticated
using (public.can_view_committee_training(capacitacion_id));

create policy comite_cap_preguntas_manage
on public.comite_sst_capacitacion_preguntas
for all to authenticated
using (public.can_manage_committee_training(capacitacion_id))
with check (public.can_manage_committee_training(capacitacion_id));

-- Opciones
 drop policy if exists comite_cap_opciones_select on public.comite_sst_capacitacion_opciones;
 drop policy if exists comite_cap_opciones_manage on public.comite_sst_capacitacion_opciones;

create policy comite_cap_opciones_select
on public.comite_sst_capacitacion_opciones
for select to authenticated
using (
  exists (
    select 1
    from public.comite_sst_capacitacion_preguntas q
    where q.id=pregunta_id
      and public.can_view_committee_training(q.capacitacion_id)
  )
);

create policy comite_cap_opciones_manage
on public.comite_sst_capacitacion_opciones
for all to authenticated
using (
  exists (
    select 1
    from public.comite_sst_capacitacion_preguntas q
    where q.id=pregunta_id
      and public.can_manage_committee_training(q.capacitacion_id)
  )
)
with check (
  exists (
    select 1
    from public.comite_sst_capacitacion_preguntas q
    where q.id=pregunta_id
      and public.can_manage_committee_training(q.capacitacion_id)
  )
);

-- Intentos
 drop policy if exists comite_cap_intentos_select on public.comite_sst_capacitacion_intentos;
create policy comite_cap_intentos_select
on public.comite_sst_capacitacion_intentos
for select to authenticated
using (public.can_view_committee_training(capacitacion_id));

-- Respuestas
 drop policy if exists comite_cap_respuestas_select on public.comite_sst_capacitacion_respuestas;
create policy comite_cap_respuestas_select
on public.comite_sst_capacitacion_respuestas
for select to authenticated
using (
  exists (
    select 1
    from public.comite_sst_capacitacion_intentos i
    where i.id=intento_id
      and public.can_view_committee_training(i.capacitacion_id)
  )
);

revoke all on table public.comite_sst_capacitacion_preguntas,
  public.comite_sst_capacitacion_opciones,
  public.comite_sst_capacitacion_intentos,
  public.comite_sst_capacitacion_respuestas from anon;

grant select,insert,update,delete on public.comite_sst_capacitacion_preguntas,
  public.comite_sst_capacitacion_opciones to authenticated;

grant select on public.comite_sst_capacitacion_intentos,
  public.comite_sst_capacitacion_respuestas to authenticated;

-- ============================================================
-- 6. STORAGE PÚBLICO PARA IMÁGENES DE PREGUNTAS
-- ============================================================
insert into storage.buckets(
  id,name,public,file_size_limit,allowed_mime_types
)
values(
  'comite-sst-preguntas',
  'comite-sst-preguntas',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
set public=true,
    file_size_limit=5242880,
    allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

 drop policy if exists comite_sst_preguntas_storage_read on storage.objects;
 drop policy if exists comite_sst_preguntas_storage_insert on storage.objects;
 drop policy if exists comite_sst_preguntas_storage_update on storage.objects;
 drop policy if exists comite_sst_preguntas_storage_delete on storage.objects;

create policy comite_sst_preguntas_storage_read
on storage.objects
for select to public
using (bucket_id='comite-sst-preguntas');

create policy comite_sst_preguntas_storage_insert
on storage.objects
for insert to authenticated
with check (bucket_id='comite-sst-preguntas');

create policy comite_sst_preguntas_storage_update
on storage.objects
for update to authenticated
using (bucket_id='comite-sst-preguntas')
with check (bucket_id='comite-sst-preguntas');

create policy comite_sst_preguntas_storage_delete
on storage.objects
for delete to authenticated
using (bucket_id='comite-sst-preguntas');

-- ============================================================
-- 7. ADMIN: GUARDAR / LISTAR / ELIMINAR PREGUNTAS
-- ============================================================
create or replace function public.guardar_pregunta_capacitacion_comite(
  p_capacitacion_id uuid,
  p_pregunta_id uuid,
  p_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_order integer;
  v_type text := upper(coalesce(p_data->>'tipo','SINGLE'));
  v_options jsonb := coalesce(p_data->'opciones','[]'::jsonb);
  v_accepted jsonb := coalesce(p_data->'respuestas_aceptadas','[]'::jsonb);
  v_correct_count integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  if not public.can_manage_committee_training(p_capacitacion_id) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para modificar esta capacitación.');
  end if;

  if exists (
    select 1 from public.comite_sst_capacitacion_intentos
    where capacitacion_id=p_capacitacion_id
  ) then
    return jsonb_build_object('ok',false,'error','El examen ya tiene resultados. Para preservar la trazabilidad no se pueden modificar sus preguntas.');
  end if;

  if btrim(coalesce(p_data->>'enunciado',''))='' then
    return jsonb_build_object('ok',false,'error','Ingresa el enunciado de la pregunta.');
  end if;

  if v_type not in ('SINGLE','TRUE_FALSE','MULTIPLE','FREE_TEXT') then
    return jsonb_build_object('ok',false,'error','Tipo de pregunta no válido.');
  end if;

  if coalesce((p_data->>'peso')::numeric,0)<=0 then
    return jsonb_build_object('ok',false,'error','El peso debe ser mayor que cero.');
  end if;

  if v_type<>'FREE_TEXT' then
    if jsonb_array_length(v_options)<2 then
      return jsonb_build_object('ok',false,'error','Agrega al menos dos alternativas.');
    end if;

    select count(*) into v_correct_count
    from jsonb_array_elements(v_options) x
    where coalesce((x->>'es_correcta')::boolean,false)=true;

    if v_type in ('SINGLE','TRUE_FALSE') and v_correct_count<>1 then
      return jsonb_build_object('ok',false,'error','Marca una sola respuesta correcta.');
    end if;

    if v_type='MULTIPLE' and v_correct_count<1 then
      return jsonb_build_object('ok',false,'error','Marca al menos una respuesta correcta.');
    end if;
  else
    if jsonb_array_length(v_accepted)<1 then
      return jsonb_build_object('ok',false,'error','Agrega al menos una respuesta aceptada.');
    end if;
  end if;

  if p_pregunta_id is null then
    select coalesce(max(orden),0)+1 into v_order
    from public.comite_sst_capacitacion_preguntas
    where capacitacion_id=p_capacitacion_id;

    insert into public.comite_sst_capacitacion_preguntas(
      capacitacion_id,orden,enunciado,tipo,nivel_tema,explicacion,peso,
      imagen_url,imagen_path,respuestas_aceptadas,activo
    ) values (
      p_capacitacion_id,
      v_order,
      btrim(p_data->>'enunciado'),
      v_type,
      coalesce(nullif(btrim(p_data->>'nivel_tema'),''),'General'),
      nullif(btrim(p_data->>'explicacion'),''),
      (p_data->>'peso')::numeric,
      nullif(btrim(p_data->>'imagen_url'),''),
      nullif(btrim(p_data->>'imagen_path'),''),
      v_accepted,
      true
    ) returning id into v_id;
  else
    v_id:=p_pregunta_id;

    update public.comite_sst_capacitacion_preguntas
    set enunciado=btrim(p_data->>'enunciado'),
        tipo=v_type,
        nivel_tema=coalesce(nullif(btrim(p_data->>'nivel_tema'),''),'General'),
        explicacion=nullif(btrim(p_data->>'explicacion'),''),
        peso=(p_data->>'peso')::numeric,
        imagen_url=nullif(btrim(p_data->>'imagen_url'),''),
        imagen_path=nullif(btrim(p_data->>'imagen_path'),''),
        respuestas_aceptadas=v_accepted,
        activo=true
    where id=v_id
      and capacitacion_id=p_capacitacion_id;

    if not found then
      return jsonb_build_object('ok',false,'error','Pregunta no encontrada.');
    end if;

    delete from public.comite_sst_capacitacion_opciones
    where pregunta_id=v_id;
  end if;

  if v_type<>'FREE_TEXT' then
    insert into public.comite_sst_capacitacion_opciones(
      pregunta_id,orden,texto,es_correcta
    )
    select
      v_id,
      ord::integer,
      btrim(x->>'texto'),
      coalesce((x->>'es_correcta')::boolean,false)
    from jsonb_array_elements(v_options) with ordinality as t(x,ord)
    where btrim(coalesce(x->>'texto',''))<>'';
  end if;

  return jsonb_build_object('ok',true,'pregunta_id',v_id);
exception when others then
  return jsonb_build_object('ok',false,'error',SQLERRM);
end;
$$;

create or replace function public.listar_preguntas_capacitacion_comite(
  p_capacitacion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.can_view_committee_training(p_capacitacion_id) then
    return jsonb_build_object('ok',false,'error','No tienes acceso a esta capacitación.');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',q.id,
      'orden',q.orden,
      'enunciado',q.enunciado,
      'tipo',q.tipo,
      'nivel_tema',q.nivel_tema,
      'explicacion',q.explicacion,
      'peso',q.peso,
      'imagen_url',q.imagen_url,
      'imagen_path',q.imagen_path,
      'respuestas_aceptadas',q.respuestas_aceptadas,
      'opciones',(
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id',o.id,
            'orden',o.orden,
            'texto',o.texto,
            'es_correcta',o.es_correcta
          ) order by o.orden
        ),'[]'::jsonb)
        from public.comite_sst_capacitacion_opciones o
        where o.pregunta_id=q.id
      )
    ) order by q.orden
  ),'[]'::jsonb)
  into v_result
  from public.comite_sst_capacitacion_preguntas q
  where q.capacitacion_id=p_capacitacion_id
    and q.activo=true;

  return jsonb_build_object('ok',true,'preguntas',v_result);
end;
$$;

create or replace function public.eliminar_pregunta_capacitacion_comite(
  p_pregunta_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_cap uuid;
begin
  select capacitacion_id into v_cap
  from public.comite_sst_capacitacion_preguntas
  where id=p_pregunta_id
  limit 1;

  if v_cap is null then
    return jsonb_build_object('ok',false,'error','Pregunta no encontrada.');
  end if;

  if not public.can_manage_committee_training(v_cap) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para eliminar esta pregunta.');
  end if;

  if exists (
    select 1 from public.comite_sst_capacitacion_intentos
    where capacitacion_id=v_cap
  ) then
    return jsonb_build_object('ok',false,'error','El examen ya tiene resultados. No se puede eliminar preguntas sin afectar la trazabilidad.');
  end if;

  delete from public.comite_sst_capacitacion_preguntas
  where id=p_pregunta_id;

  -- Se conservan los números de orden restantes para evitar alterar referencias
  -- históricas de preguntas ya respondidas. Las nuevas preguntas usan max(orden)+1.
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.guardar_pregunta_capacitacion_comite(uuid,uuid,jsonb) from public;
revoke all on function public.listar_preguntas_capacitacion_comite(uuid) from public;
revoke all on function public.eliminar_pregunta_capacitacion_comite(uuid) from public;

grant execute on function public.guardar_pregunta_capacitacion_comite(uuid,uuid,jsonb) to authenticated;
grant execute on function public.listar_preguntas_capacitacion_comite(uuid) to authenticated;
grant execute on function public.eliminar_pregunta_capacitacion_comite(uuid) to authenticated;

-- ============================================================
-- 8. PÚBLICO: ESTADO DEL EXAMEN
-- ============================================================
create or replace function public.obtener_estado_examen_capacitacion_comite(
  p_token uuid,
  p_dni text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_cap public.comite_sst_capacitaciones%rowtype;
  v_part public.comite_sst_capacitacion_participantes%rowtype;
  v_worker_id uuid;
  v_total_questions integer:=0;
  v_attempts integer:=0;
  v_approved boolean:=false;
  v_last record;
  v_content_done boolean:=false;
begin
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok',false,'error','DNI no válido.');
  end if;

  select * into v_cap
  from public.comite_sst_capacitaciones
  where public_token=p_token
  limit 1;

  if not found or v_cap.estado<>'LISTA' then
    return jsonb_build_object('ok',false,'error','La capacitación no se encuentra disponible.');
  end if;

  select w.id into v_worker_id
  from public.comite_sst_integrantes i
  join public.trabajadores w on w.id=i.trabajador_id
  where i.comite_id=v_cap.comite_id
    and i.activo=true
    and (i.fecha_fin is null or i.fecha_fin>=current_date)
    and w.activo=true
    and w.dni=p_dni
  limit 1;

  if v_worker_id is null then
    return jsonb_build_object('ok',false,'error','No figuras como integrante activo de esta capacitación.');
  end if;

  select * into v_part
  from public.comite_sst_capacitacion_participantes
  where capacitacion_id=v_cap.id
    and trabajador_id=v_worker_id
  limit 1;

  if v_part.id is null or v_part.firma_at is null or v_part.consentimiento_firma=false then
    return jsonb_build_object('ok',false,'error','Debes registrar tu firma antes de acceder al examen.');
  end if;

  -- Se considera contenido completado si el participante ya quedó marcado
  -- o si todos los videos obligatorios están completados.
  v_content_done := v_part.contenido_completado_at is not null;

  if not v_content_done then
    select not exists (
      select 1
      from public.comite_sst_capacitacion_videos v
      left join public.comite_sst_capacitacion_video_progreso pr
        on pr.video_id=v.id
       and pr.participante_id=v_part.id
      where v.capacitacion_id=v_cap.id
        and v.obligatorio=true
        and coalesce(pr.completado,false)=false
    ) into v_content_done;
  end if;

  select count(*) into v_total_questions
  from public.comite_sst_capacitacion_preguntas
  where capacitacion_id=v_cap.id
    and activo=true;

  select count(*),coalesce(bool_or(aprobado),false)
  into v_attempts,v_approved
  from public.comite_sst_capacitacion_intentos
  where capacitacion_id=v_cap.id
    and participante_id=v_part.id
    and finalizado_at is not null;

  select id,numero_intento,nota,aprobado,correctas,total_preguntas,finalizado_at
  into v_last
  from public.comite_sst_capacitacion_intentos
  where capacitacion_id=v_cap.id
    and participante_id=v_part.id
    and finalizado_at is not null
  order by numero_intento desc
  limit 1;

  return jsonb_build_object(
    'ok',true,
    'contenido_completado',v_content_done,
    'preguntas',v_total_questions,
    'nota_minima',v_cap.nota_minima,
    'max_intentos',v_cap.max_intentos,
    'reintento_solo_desaprobado',v_cap.reintento_solo_desaprobado,
    'intentos_realizados',v_attempts,
    'intentos_disponibles',greatest(v_cap.max_intentos-v_attempts,0),
    'aprobado',v_approved,
    'puede_iniciar',(
      v_content_done
      and v_total_questions>0
      and (
        not (v_cap.reintento_solo_desaprobado and v_approved)
      )
      and v_attempts<v_cap.max_intentos
    ),
    'ultimo_resultado',case when v_last.id is null then null else jsonb_build_object(
      'intento_id',v_last.id,
      'numero_intento',v_last.numero_intento,
      'nota',v_last.nota,
      'aprobado',v_last.aprobado,
      'correctas',v_last.correctas,
      'total',v_last.total_preguntas,
      'finalizado_at',v_last.finalizado_at
    ) end
  );
end;
$$;

revoke all on function public.obtener_estado_examen_capacitacion_comite(uuid,text) from public;
grant execute on function public.obtener_estado_examen_capacitacion_comite(uuid,text) to anon,authenticated;

-- ============================================================
-- 9. PÚBLICO: INICIAR EXAMEN
-- ============================================================
create or replace function public.iniciar_examen_capacitacion_comite(
  p_token uuid,
  p_dni text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_cap public.comite_sst_capacitaciones%rowtype;
  v_part public.comite_sst_capacitacion_participantes%rowtype;
  v_worker record;
  v_total integer:=0;
  v_attempts integer:=0;
  v_approved boolean:=false;
  v_attempt_number integer:=1;
  v_intento uuid;
  v_questions jsonb;
  v_content_done boolean:=false;
begin
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok',false,'error','DNI no válido.');
  end if;

  select * into v_cap
  from public.comite_sst_capacitaciones
  where public_token=p_token
  limit 1;

  if not found or v_cap.estado<>'LISTA' then
    return jsonb_build_object('ok',false,'error','La capacitación no se encuentra disponible.');
  end if;

  select
    w.id as trabajador_id,
    w.dni,
    w.nombres,
    w.apellidos,
    w.cargo,
    w.area
  into v_worker
  from public.comite_sst_integrantes i
  join public.trabajadores w on w.id=i.trabajador_id
  where i.comite_id=v_cap.comite_id
    and i.activo=true
    and (i.fecha_fin is null or i.fecha_fin>=current_date)
    and w.activo=true
    and w.dni=p_dni
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','No figuras como integrante activo de esta capacitación.');
  end if;

  select * into v_part
  from public.comite_sst_capacitacion_participantes
  where capacitacion_id=v_cap.id
    and trabajador_id=v_worker.trabajador_id
  limit 1;

  if v_part.id is null or v_part.firma_at is null or v_part.consentimiento_firma=false then
    return jsonb_build_object('ok',false,'error','Debes registrar tu firma antes de iniciar el examen.');
  end if;

  v_content_done := v_part.contenido_completado_at is not null;

  if not v_content_done then
    select not exists (
      select 1
      from public.comite_sst_capacitacion_videos v
      left join public.comite_sst_capacitacion_video_progreso pr
        on pr.video_id=v.id
       and pr.participante_id=v_part.id
      where v.capacitacion_id=v_cap.id
        and v.obligatorio=true
        and coalesce(pr.completado,false)=false
    ) into v_content_done;
  end if;

  if not v_content_done then
    return jsonb_build_object('ok',false,'error','Completa primero todos los videos obligatorios.');
  end if;

  select count(*) into v_total
  from public.comite_sst_capacitacion_preguntas
  where capacitacion_id=v_cap.id
    and activo=true;

  if v_total=0 then
    return jsonb_build_object('ok',false,'error','El examen todavía no tiene preguntas configuradas.');
  end if;

  select count(*),coalesce(bool_or(aprobado),false),coalesce(max(numero_intento),0)+1
  into v_attempts,v_approved,v_attempt_number
  from public.comite_sst_capacitacion_intentos
  where capacitacion_id=v_cap.id
    and participante_id=v_part.id
    and finalizado_at is not null;

  if v_cap.reintento_solo_desaprobado and v_approved then
    return jsonb_build_object('ok',false,'already_approved',true,'error','Ya aprobaste esta capacitación.');
  end if;

  if v_attempts>=v_cap.max_intentos then
    return jsonb_build_object('ok',false,'attempts_exhausted',true,'error','Alcanzaste el máximo de intentos permitidos.');
  end if;

  -- Elimina intentos incompletos previos de este participante para evitar acumulación.
  delete from public.comite_sst_capacitacion_intentos
  where capacitacion_id=v_cap.id
    and participante_id=v_part.id
    and finalizado_at is null;

  insert into public.comite_sst_capacitacion_intentos(
    capacitacion_id,
    participante_id,
    numero_intento,
    total_preguntas
  ) values (
    v_cap.id,
    v_part.id,
    v_attempt_number,
    v_total
  ) returning id into v_intento;

  select jsonb_agg(qobj order by sort_key) into v_questions
  from (
    select
      case when v_cap.mezclar_preguntas then random() else q.orden::double precision end as sort_key,
      jsonb_build_object(
        'id',q.id,
        'orden',q.orden,
        'enunciado',q.enunciado,
        'tipo',q.tipo,
        'nivel_tema',q.nivel_tema,
        'peso',q.peso,
        'imagen_url',q.imagen_url,
        'opciones',case when q.tipo='FREE_TEXT' then '[]'::jsonb else (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'id',oo.id,
              'orden',oo.orden,
              'texto',oo.texto
            ) order by oo.sort_key
          ),'[]'::jsonb)
          from (
            select
              o.*,
              case when v_cap.mezclar_opciones then random() else o.orden::double precision end as sort_key
            from public.comite_sst_capacitacion_opciones o
            where o.pregunta_id=q.id
          ) oo
        ) end
      ) as qobj
    from public.comite_sst_capacitacion_preguntas q
    where q.capacitacion_id=v_cap.id
      and q.activo=true
  ) z;

  return jsonb_build_object(
    'ok',true,
    'intento_id',v_intento,
    'numero_intento',v_attempt_number,
    'titulo',v_cap.titulo,
    'codigo',v_cap.codigo,
    'participante',trim(v_worker.apellidos||' '||v_worker.nombres),
    'tiempo_max_min',v_cap.tiempo_examen_min,
    'nota_minima',v_cap.nota_minima,
    'max_intentos',v_cap.max_intentos,
    'preguntas',coalesce(v_questions,'[]'::jsonb)
  );
end;
$$;

revoke all on function public.iniciar_examen_capacitacion_comite(uuid,text) from public;
grant execute on function public.iniciar_examen_capacitacion_comite(uuid,text) to anon,authenticated;

-- ============================================================
-- 10. PÚBLICO: FINALIZAR Y CALIFICAR
-- ============================================================
create or replace function public.finalizar_examen_capacitacion_comite(
  p_token uuid,
  p_dni text,
  p_intento_id uuid,
  p_respuestas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_cap public.comite_sst_capacitaciones%rowtype;
  v_part public.comite_sst_capacitacion_participantes%rowtype;
  v_attempt public.comite_sst_capacitacion_intentos%rowtype;
  v_worker_id uuid;
  v_q public.comite_sst_capacitacion_preguntas%rowtype;
  v_item jsonb;
  v_ids uuid[];
  v_correct_ids uuid[];
  v_text text;
  v_ok boolean;
  v_pts numeric;
  v_score numeric:=0;
  v_total numeric:=0;
  v_correct integer:=0;
  v_count integer:=0;
  v_note numeric:=0;
  v_reinforce jsonb;
  v_mastered jsonb;
  v_remaining integer:=0;
  v_now timestamptz:=now();
begin
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok',false,'error','DNI no válido.');
  end if;

  select * into v_cap
  from public.comite_sst_capacitaciones
  where public_token=p_token
  limit 1;

  if not found or v_cap.estado<>'LISTA' then
    return jsonb_build_object('ok',false,'error','La capacitación no se encuentra disponible.');
  end if;

  select w.id into v_worker_id
  from public.comite_sst_integrantes i
  join public.trabajadores w on w.id=i.trabajador_id
  where i.comite_id=v_cap.comite_id
    and i.activo=true
    and (i.fecha_fin is null or i.fecha_fin>=current_date)
    and w.activo=true
    and w.dni=p_dni
  limit 1;

  if v_worker_id is null then
    return jsonb_build_object('ok',false,'error','No figuras como integrante activo de esta capacitación.');
  end if;

  select * into v_part
  from public.comite_sst_capacitacion_participantes
  where capacitacion_id=v_cap.id
    and trabajador_id=v_worker_id
  limit 1;

  if v_part.id is null then
    return jsonb_build_object('ok',false,'error','Participación no encontrada.');
  end if;

  select * into v_attempt
  from public.comite_sst_capacitacion_intentos
  where id=p_intento_id
    and capacitacion_id=v_cap.id
    and participante_id=v_part.id
    and finalizado_at is null
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','Intento no válido o ya finalizado.');
  end if;

  delete from public.comite_sst_capacitacion_respuestas
  where intento_id=p_intento_id;

  for v_q in
    select *
    from public.comite_sst_capacitacion_preguntas
    where capacitacion_id=v_cap.id
      and activo=true
    order by orden
  loop
    v_count:=v_count+1;
    v_total:=v_total+v_q.peso;
    v_ok:=false;
    v_pts:=0;
    v_ids:='{}';
    v_text:=null;
    v_item:=null;

    select x into v_item
    from jsonb_array_elements(coalesce(p_respuestas,'[]'::jsonb)) x
    where (x->>'pregunta_id')::uuid=v_q.id
    limit 1;

    if v_item is not null then
      if v_q.tipo='FREE_TEXT' then
        v_text:=coalesce(v_item->>'texto','');
        v_ok:=exists(
          select 1
          from jsonb_array_elements_text(v_q.respuestas_aceptadas) a
          where lower(btrim(a))=lower(btrim(v_text))
        );
      else
        select coalesce(array_agg(value::uuid order by value::uuid),'{}')
        into v_ids
        from jsonb_array_elements_text(coalesce(v_item->'opcion_ids','[]'::jsonb));

        select coalesce(array_agg(id order by id),'{}')
        into v_correct_ids
        from public.comite_sst_capacitacion_opciones
        where pregunta_id=v_q.id
          and es_correcta=true;

        v_ok:=v_ids=v_correct_ids;
      end if;
    end if;

    if v_ok then
      v_pts:=v_q.peso;
      v_score:=v_score+v_q.peso;
      v_correct:=v_correct+1;
    end if;

    insert into public.comite_sst_capacitacion_respuestas(
      intento_id,pregunta_id,opcion_ids,respuesta_texto,es_correcta,puntaje
    ) values (
      p_intento_id,
      v_q.id,
      coalesce(v_ids,'{}'),
      v_text,
      v_ok,
      v_pts
    );
  end loop;

  if v_total>0 then
    v_note:=round((v_score/v_total)*20,2);
  end if;

  update public.comite_sst_capacitacion_intentos
  set puntaje_obtenido=v_score,
      puntaje_total=v_total,
      nota=v_note,
      aprobado=(v_note>=v_cap.nota_minima),
      correctas=v_correct,
      total_preguntas=v_count,
      finalizado_at=v_now
  where id=p_intento_id;

  select coalesce(jsonb_agg(
    jsonb_build_object('tema',nivel_tema,'errores',errores)
    order by errores desc,nivel_tema
  ),'[]'::jsonb)
  into v_reinforce
  from (
    select q.nivel_tema,count(*) as errores
    from public.comite_sst_capacitacion_respuestas r
    join public.comite_sst_capacitacion_preguntas q on q.id=r.pregunta_id
    where r.intento_id=p_intento_id
      and not r.es_correcta
    group by q.nivel_tema
  ) s;

  select coalesce(jsonb_agg(nivel_tema order by nivel_tema),'[]'::jsonb)
  into v_mastered
  from (
    select q.nivel_tema
    from public.comite_sst_capacitacion_preguntas q
    where q.capacitacion_id=v_cap.id
      and q.activo=true
    group by q.nivel_tema
    having count(*) filter(
      where q.id in (
        select r.pregunta_id
        from public.comite_sst_capacitacion_respuestas r
        where r.intento_id=p_intento_id
          and not r.es_correcta
      )
    )=0
  ) m;

  v_remaining:=greatest(v_cap.max_intentos-v_attempt.numero_intento,0);

  update public.comite_sst_capacitacion_participantes
  set estado=case
        when v_note>=v_cap.nota_minima then 'FINALIZADO'
        when v_remaining<=0 then 'FINALIZADO'
        else 'CONTENIDO_COMPLETADO'
      end,
      ultimo_acceso_at=v_now
  where id=v_part.id;

  return jsonb_build_object(
    'ok',true,
    'intento_id',p_intento_id,
    'numero_intento',v_attempt.numero_intento,
    'nota',v_note,
    'aprobado',(v_note>=v_cap.nota_minima),
    'correctas',v_correct,
    'total',v_count,
    'puntaje_obtenido',v_score,
    'puntaje_total',v_total,
    'nota_minima',v_cap.nota_minima,
    'intentos_restantes',v_remaining,
    'temas_reforzar',v_reinforce,
    'temas_dominados',v_mastered,
    'mostrar_correctas_final',v_cap.mostrar_correctas_final,
    'mostrar_explicacion',v_cap.mostrar_explicacion
  );
end;
$$;

revoke all on function public.finalizar_examen_capacitacion_comite(uuid,text,uuid,jsonb) from public;
grant execute on function public.finalizar_examen_capacitacion_comite(uuid,text,uuid,jsonb) to anon,authenticated;

-- ============================================================
-- 11. PÚBLICO: REVISAR RESPUESTAS
-- ============================================================
create or replace function public.revisar_examen_capacitacion_comite(
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
  v_attempt public.comite_sst_capacitacion_intentos%rowtype;
  v_part public.comite_sst_capacitacion_participantes%rowtype;
  v_worker_id uuid;
  v_items jsonb;
  v_reinforce jsonb;
  v_mastered jsonb;
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

  select w.id into v_worker_id
  from public.comite_sst_integrantes i
  join public.trabajadores w on w.id=i.trabajador_id
  where i.comite_id=v_cap.comite_id
    and i.activo=true
    and (i.fecha_fin is null or i.fecha_fin>=current_date)
    and w.activo=true
    and w.dni=p_dni
  limit 1;

  if v_worker_id is null then
    return jsonb_build_object('ok',false,'error','No tienes acceso a este resultado.');
  end if;

  select * into v_part
  from public.comite_sst_capacitacion_participantes
  where capacitacion_id=v_cap.id
    and trabajador_id=v_worker_id
  limit 1;

  select * into v_attempt
  from public.comite_sst_capacitacion_intentos
  where id=p_intento_id
    and capacitacion_id=v_cap.id
    and participante_id=v_part.id
    and finalizado_at is not null
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','Resultado no encontrado.');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'pregunta_id',q.id,
      'orden',q.orden,
      'enunciado',q.enunciado,
      'tipo',q.tipo,
      'nivel_tema',q.nivel_tema,
      'explicacion',case when v_cap.mostrar_explicacion then q.explicacion else null end,
      'imagen_url',q.imagen_url,
      'es_correcta',r.es_correcta,
      'respuesta_texto',r.respuesta_texto,
      'respuesta_seleccionada',(
        select coalesce(jsonb_agg(o.texto order by o.orden),'[]'::jsonb)
        from public.comite_sst_capacitacion_opciones o
        where o.id=any(r.opcion_ids)
      ),
      'respuestas_correctas',case when v_cap.mostrar_correctas_final then (
        case when q.tipo='FREE_TEXT' then q.respuestas_aceptadas else (
          select coalesce(jsonb_agg(o.texto order by o.orden),'[]'::jsonb)
          from public.comite_sst_capacitacion_opciones o
          where o.pregunta_id=q.id
            and o.es_correcta=true
        ) end
      ) else '[]'::jsonb end
    ) order by q.orden
  ),'[]'::jsonb)
  into v_items
  from public.comite_sst_capacitacion_respuestas r
  join public.comite_sst_capacitacion_preguntas q on q.id=r.pregunta_id
  where r.intento_id=p_intento_id;

  select coalesce(jsonb_agg(
    jsonb_build_object('tema',nivel_tema,'errores',errores)
    order by errores desc,nivel_tema
  ),'[]'::jsonb)
  into v_reinforce
  from (
    select q.nivel_tema,count(*) as errores
    from public.comite_sst_capacitacion_respuestas r
    join public.comite_sst_capacitacion_preguntas q on q.id=r.pregunta_id
    where r.intento_id=p_intento_id
      and not r.es_correcta
    group by q.nivel_tema
  ) s;

  select coalesce(jsonb_agg(nivel_tema order by nivel_tema),'[]'::jsonb)
  into v_mastered
  from (
    select q.nivel_tema
    from public.comite_sst_capacitacion_preguntas q
    where q.capacitacion_id=v_cap.id
      and q.activo=true
    group by q.nivel_tema
    having count(*) filter(
      where q.id in (
        select r.pregunta_id
        from public.comite_sst_capacitacion_respuestas r
        where r.intento_id=p_intento_id
          and not r.es_correcta
      )
    )=0
  ) m;

  return jsonb_build_object(
    'ok',true,
    'intento',jsonb_build_object(
      'id',v_attempt.id,
      'numero_intento',v_attempt.numero_intento,
      'nota',v_attempt.nota,
      'aprobado',v_attempt.aprobado,
      'correctas',v_attempt.correctas,
      'total',v_attempt.total_preguntas
    ),
    'preguntas',v_items,
    'temas_reforzar',v_reinforce,
    'temas_dominados',v_mastered
  );
end;
$$;

revoke all on function public.revisar_examen_capacitacion_comite(uuid,text,uuid) from public;
grant execute on function public.revisar_examen_capacitacion_comite(uuid,text,uuid) to anon,authenticated;

-- ============================================================
-- 12. ADMIN: DETALLE DE RESULTADO PARA REVISIÓN INTERNA
-- ============================================================
create or replace function public.obtener_resultado_capacitacion_comite_admin(
  p_intento_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_attempt public.comite_sst_capacitacion_intentos%rowtype;
  v_cap public.comite_sst_capacitaciones%rowtype;
  v_part public.comite_sst_capacitacion_participantes%rowtype;
  v_worker public.trabajadores%rowtype;
  v_items jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  select * into v_attempt
  from public.comite_sst_capacitacion_intentos
  where id=p_intento_id
    and finalizado_at is not null
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','Resultado no encontrado.');
  end if;

  if not public.can_view_committee_training(v_attempt.capacitacion_id) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para ver este resultado.');
  end if;

  select * into v_cap
  from public.comite_sst_capacitaciones
  where id=v_attempt.capacitacion_id;

  select * into v_part
  from public.comite_sst_capacitacion_participantes
  where id=v_attempt.participante_id;

  select * into v_worker
  from public.trabajadores
  where id=v_part.trabajador_id;

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
      'respuestas_correctas',case when q.tipo='FREE_TEXT' then q.respuestas_aceptadas else (
        select coalesce(jsonb_agg(o.texto order by o.orden),'[]'::jsonb)
        from public.comite_sst_capacitacion_opciones o
        where o.pregunta_id=q.id
          and o.es_correcta=true
      ) end
    ) order by q.orden
  ),'[]'::jsonb)
  into v_items
  from public.comite_sst_capacitacion_respuestas r
  join public.comite_sst_capacitacion_preguntas q on q.id=r.pregunta_id
  where r.intento_id=p_intento_id;

  return jsonb_build_object(
    'ok',true,
    'participante',jsonb_build_object(
      'dni',v_worker.dni,
      'nombre',trim(v_worker.apellidos||' '||v_worker.nombres),
      'cargo',v_worker.cargo,
      'area',v_worker.area,
      'firma',v_part.firma_electronica
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

revoke all on function public.obtener_resultado_capacitacion_comite_admin(uuid) from public;
grant execute on function public.obtener_resultado_capacitacion_comite_admin(uuid) to authenticated;

select 'Etapa 16D.3 aplicada correctamente' as resultado;
