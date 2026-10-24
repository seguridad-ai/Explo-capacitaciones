-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 12 - MÓDULO PRACTICAR (QUIZZES DIDÁCTICOS)
-- ============================================================

create sequence if not exists public.practica_codigo_seq start 1;

create table if not exists public.practicas (
    id uuid primary key default gen_random_uuid(),
    codigo text not null unique,
    titulo text not null,
    descripcion text,
    sede_id uuid references public.sedes(id) on delete set null,
    proyecto_id uuid references public.proyectos(id) on delete set null,
    tiempo_pregunta_seg integer not null default 20 check (tiempo_pregunta_seg between 5 and 120),
    max_intentos integer not null default 0 check (max_intentos between 0 and 20),
    mezclar_preguntas boolean not null default true,
    mezclar_opciones boolean not null default true,
    publicado boolean not null default false,
    activo boolean not null default true,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint practicas_unidad_check check (not (sede_id is not null and proyecto_id is not null))
);

create table if not exists public.practica_preguntas (
    id uuid primary key default gen_random_uuid(),
    practica_id uuid not null references public.practicas(id) on delete cascade,
    orden integer not null default 1,
    enunciado text not null,
    activo boolean not null default true,
    created_at timestamptz not null default now(),
    unique (practica_id, orden)
);

create table if not exists public.practica_opciones (
    id uuid primary key default gen_random_uuid(),
    pregunta_id uuid not null references public.practica_preguntas(id) on delete cascade,
    orden integer not null,
    texto text not null,
    es_correcta boolean not null default false,
    unique (pregunta_id, orden)
);

create table if not exists public.practica_intentos (
    id uuid primary key default gen_random_uuid(),
    practica_id uuid not null references public.practicas(id) on delete cascade,
    trabajador_id uuid not null references public.trabajadores(id) on delete cascade,
    dni varchar(8) not null,
    apellidos_nombres text not null,
    puesto text,
    area text,
    puntaje_total integer not null default 0,
    correctas integer not null default 0,
    total_preguntas integer not null default 0,
    iniciado_at timestamptz not null default now(),
    finalizado_at timestamptz
);

create table if not exists public.practica_respuestas (
    id uuid primary key default gen_random_uuid(),
    intento_id uuid not null references public.practica_intentos(id) on delete cascade,
    pregunta_id uuid not null references public.practica_preguntas(id) on delete cascade,
    opcion_id uuid references public.practica_opciones(id) on delete set null,
    es_correcta boolean not null default false,
    tiempo_ms integer not null default 0,
    puntaje integer not null default 0,
    created_at timestamptz not null default now(),
    unique (intento_id, pregunta_id)
);

create index if not exists idx_practicas_proyecto on public.practicas(proyecto_id);
create index if not exists idx_practicas_sede on public.practicas(sede_id);
create index if not exists idx_practica_preguntas_practica on public.practica_preguntas(practica_id);
create index if not exists idx_practica_intentos_practica on public.practica_intentos(practica_id);
create index if not exists idx_practica_intentos_trabajador on public.practica_intentos(trabajador_id);

create or replace function public.asignar_codigo_practica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.codigo is null or btrim(new.codigo) = '' then
    new.codigo := 'PRA-' || to_char(current_date, 'YYYY') || '-' ||
                  lpad(nextval('public.practica_codigo_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_practica_codigo on public.practicas;
create trigger trg_practica_codigo
before insert on public.practicas
for each row execute function public.asignar_codigo_practica();

drop trigger if exists trg_practicas_updated_at on public.practicas;
create trigger trg_practicas_updated_at
before update on public.practicas
for each row execute function public.actualizar_updated_at();

create or replace function public.can_view_practice(p_practica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.practicas p
    where p.id = p_practica_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or p.proyecto_id is null
        or public.has_project_access(p.proyecto_id)
      )
  );
$$;

create or replace function public.can_manage_practice(p_practica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.practicas p
    where p.id = p_practica_id
      and (
        public.is_admin()
        or (p.proyecto_id is not null and public.can_manage_project(p.proyecto_id))
      )
  );
$$;

alter table public.practicas enable row level security;
alter table public.practica_preguntas enable row level security;
alter table public.practica_opciones enable row level security;
alter table public.practica_intentos enable row level security;
alter table public.practica_respuestas enable row level security;

drop policy if exists practicas_select on public.practicas;
drop policy if exists practicas_insert on public.practicas;
drop policy if exists practicas_update on public.practicas;
drop policy if exists practicas_delete on public.practicas;

create policy practicas_select on public.practicas
for select to authenticated
using (
  public.is_admin()
  or public.can_view_all_projects()
  or proyecto_id is null
  or public.has_project_access(proyecto_id)
);

create policy practicas_insert on public.practicas
for insert to authenticated
with check (
  public.is_admin()
  or (proyecto_id is not null and public.can_manage_project(proyecto_id))
);

create policy practicas_update on public.practicas
for update to authenticated
using (
  public.is_admin()
  or (proyecto_id is not null and public.can_manage_project(proyecto_id))
)
with check (
  public.is_admin()
  or (proyecto_id is not null and public.can_manage_project(proyecto_id))
);

create policy practicas_delete on public.practicas
for delete to authenticated
using (
  public.is_admin()
  or (proyecto_id is not null and public.can_manage_project(proyecto_id))
);

drop policy if exists practica_preguntas_select on public.practica_preguntas;
drop policy if exists practica_preguntas_manage on public.practica_preguntas;

create policy practica_preguntas_select on public.practica_preguntas
for select to authenticated using (public.can_view_practice(practica_id));

create policy practica_preguntas_manage on public.practica_preguntas
for all to authenticated
using (public.can_manage_practice(practica_id))
with check (public.can_manage_practice(practica_id));

drop policy if exists practica_opciones_select on public.practica_opciones;
drop policy if exists practica_opciones_manage on public.practica_opciones;

create policy practica_opciones_select on public.practica_opciones
for select to authenticated
using (
  exists (
    select 1 from public.practica_preguntas q
    where q.id = pregunta_id
      and public.can_view_practice(q.practica_id)
  )
);

create policy practica_opciones_manage on public.practica_opciones
for all to authenticated
using (
  exists (
    select 1 from public.practica_preguntas q
    where q.id = pregunta_id
      and public.can_manage_practice(q.practica_id)
  )
)
with check (
  exists (
    select 1 from public.practica_preguntas q
    where q.id = pregunta_id
      and public.can_manage_practice(q.practica_id)
  )
);

drop policy if exists practica_intentos_select on public.practica_intentos;
create policy practica_intentos_select on public.practica_intentos
for select to authenticated
using (public.can_view_practice(practica_id));

drop policy if exists practica_respuestas_select on public.practica_respuestas;
create policy practica_respuestas_select on public.practica_respuestas
for select to authenticated
using (
  exists (
    select 1 from public.practica_intentos i
    where i.id = intento_id
      and public.can_view_practice(i.practica_id)
  )
);

revoke all on table public.practicas, public.practica_preguntas, public.practica_opciones,
  public.practica_intentos, public.practica_respuestas from anon;

grant select, insert, update, delete on table public.practicas, public.practica_preguntas,
  public.practica_opciones to authenticated;
grant select on table public.practica_intentos, public.practica_respuestas to authenticated;
grant usage, select on sequence public.practica_codigo_seq to authenticated;

-- ============================================================
-- RPC PÚBLICA: IDENTIFICAR PARTICIPANTE
-- ============================================================
create or replace function public.obtener_practica_participante(
  p_codigo text,
  p_dni text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pr public.practicas%rowtype;
  v_worker public.trabajadores%rowtype;
  v_sede text;
  v_proyecto text;
  v_intentos integer := 0;
begin
  select * into v_pr
  from public.practicas
  where upper(codigo) = upper(btrim(p_codigo))
    and activo = true
    and publicado = true
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La práctica no está disponible.');
  end if;

  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok', false, 'error', 'Ingresa un DNI válido de 8 dígitos.');
  end if;

  select * into v_worker
  from public.trabajadores
  where dni = p_dni
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'registrado', false,
      'codigo', v_pr.codigo,
      'titulo', v_pr.titulo,
      'descripcion', v_pr.descripcion,
      'proyecto_id', v_pr.proyecto_id,
      'sede_id', v_pr.sede_id
    );
  end if;

  if not v_worker.activo then
    return jsonb_build_object('ok', false, 'error', 'Tu registro se encuentra inactivo. Comunícate con el responsable.');
  end if;

  if v_pr.proyecto_id is not null and v_worker.proyecto_id is distinct from v_pr.proyecto_id then
    return jsonb_build_object('ok', false, 'error', 'Esta práctica corresponde a otro proyecto.');
  end if;

  if v_pr.sede_id is not null and v_worker.sede_id is distinct from v_pr.sede_id then
    return jsonb_build_object('ok', false, 'error', 'Esta práctica corresponde a otra sede.');
  end if;

  select nombre into v_sede from public.sedes where id = v_worker.sede_id;
  select nombre into v_proyecto from public.proyectos where id = v_worker.proyecto_id;

  select count(*) into v_intentos
  from public.practica_intentos
  where practica_id = v_pr.id
    and trabajador_id = v_worker.id
    and finalizado_at is not null;

  if v_pr.max_intentos > 0 and v_intentos >= v_pr.max_intentos then
    return jsonb_build_object('ok', false, 'error', 'Ya alcanzaste el número máximo de intentos.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'registrado', true,
    'codigo', v_pr.codigo,
    'titulo', v_pr.titulo,
    'descripcion', v_pr.descripcion,
    'dni', v_worker.dni,
    'nombre', trim(v_worker.apellidos || ' ' || v_worker.nombres),
    'puesto', v_worker.cargo,
    'area', v_worker.area,
    'sede', v_sede,
    'proyecto', v_proyecto,
    'intentos_realizados', v_intentos,
    'max_intentos', v_pr.max_intentos,
    'tiempo_pregunta_seg', v_pr.tiempo_pregunta_seg
  );
end;
$$;

create or replace function public.listar_sedes_registro_practica(p_codigo text)
returns table(id uuid, nombre text)
language sql
security definer
set search_path = ''
as $$
  select s.id, s.nombre
  from public.sedes s
  where s.activo = true
  order by s.nombre;
$$;

create or replace function public.registrar_trabajador_practica(
  p_codigo text,
  p_dni text,
  p_nombres text,
  p_apellidos text,
  p_cargo text,
  p_area text,
  p_sede_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pr public.practicas%rowtype;
  v_existing public.trabajadores%rowtype;
  v_sede_id uuid;
begin
  select * into v_pr
  from public.practicas
  where upper(codigo) = upper(btrim(p_codigo))
    and activo = true
    and publicado = true
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La práctica no está disponible.');
  end if;

  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok', false, 'error', 'DNI no válido.');
  end if;

  select * into v_existing from public.trabajadores where dni = p_dni limit 1;
  if found then
    if not v_existing.activo then
      return jsonb_build_object('ok', false, 'error', 'El DNI ya existe pero está inactivo.');
    end if;
    return public.obtener_practica_participante(p_codigo, p_dni);
  end if;

  if btrim(coalesce(p_nombres,'')) = '' or btrim(coalesce(p_apellidos,'')) = ''
     or btrim(coalesce(p_cargo,'')) = '' or btrim(coalesce(p_area,'')) = '' then
    return jsonb_build_object('ok', false, 'error', 'Completa nombres, apellidos, puesto y área.');
  end if;

  v_sede_id := coalesce(v_pr.sede_id, p_sede_id);

  if v_pr.proyecto_id is null and v_sede_id is null then
    return jsonb_build_object('ok', false, 'error', 'Selecciona tu sede.');
  end if;

  insert into public.trabajadores(
    dni,nombres,apellidos,cargo,area,empresa,sede_id,proyecto_id,activo
  ) values (
    p_dni,btrim(p_nombres),btrim(p_apellidos),btrim(p_cargo),btrim(p_area),
    'EXPLO DRILLING PERU S.R.L.',v_sede_id,v_pr.proyecto_id,true
  );

  return public.obtener_practica_participante(p_codigo, p_dni);
end;
$$;

-- ============================================================
-- RPC PÚBLICA: INICIAR QUIZ
-- ============================================================
create or replace function public.iniciar_practica(
  p_codigo text,
  p_dni text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pr public.practicas%rowtype;
  v_worker public.trabajadores%rowtype;
  v_intento_id uuid;
  v_intentos integer := 0;
  v_preguntas jsonb;
  v_total integer := 0;
begin
  select * into v_pr
  from public.practicas
  where upper(codigo) = upper(btrim(p_codigo))
    and activo = true and publicado = true
  limit 1;
  if not found then return jsonb_build_object('ok',false,'error','La práctica no está disponible.'); end if;

  select * into v_worker from public.trabajadores where dni = p_dni and activo = true limit 1;
  if not found then return jsonb_build_object('ok',false,'error','Trabajador no encontrado o inactivo.'); end if;

  if v_pr.proyecto_id is not null and v_worker.proyecto_id is distinct from v_pr.proyecto_id then
    return jsonb_build_object('ok',false,'error','Esta práctica corresponde a otro proyecto.');
  end if;
  if v_pr.sede_id is not null and v_worker.sede_id is distinct from v_pr.sede_id then
    return jsonb_build_object('ok',false,'error','Esta práctica corresponde a otra sede.');
  end if;

  select count(*) into v_intentos
  from public.practica_intentos
  where practica_id=v_pr.id and trabajador_id=v_worker.id and finalizado_at is not null;
  if v_pr.max_intentos > 0 and v_intentos >= v_pr.max_intentos then
    return jsonb_build_object('ok',false,'error','Ya alcanzaste el número máximo de intentos.');
  end if;

  select count(*) into v_total
  from public.practica_preguntas
  where practica_id=v_pr.id and activo=true;
  if v_total = 0 then
    return jsonb_build_object('ok',false,'error','El quiz todavía no tiene preguntas.');
  end if;

  insert into public.practica_intentos(
    practica_id,trabajador_id,dni,apellidos_nombres,puesto,area,total_preguntas
  ) values (
    v_pr.id,v_worker.id,v_worker.dni,trim(v_worker.apellidos || ' ' || v_worker.nombres),
    v_worker.cargo,v_worker.area,v_total
  ) returning id into v_intento_id;

  select jsonb_agg(qobj order by sort_key) into v_preguntas
  from (
    select
      case when v_pr.mezclar_preguntas then random() else q.orden::double precision end as sort_key,
      jsonb_build_object(
        'id',q.id,
        'orden',q.orden,
        'enunciado',q.enunciado,
        'opciones',(
          select jsonb_agg(
            jsonb_build_object('id',oo.id,'orden',oo.orden,'texto',oo.texto)
            order by oo.sort_key
          )
          from (
            select o.*,
              case when v_pr.mezclar_opciones then random() else o.orden::double precision end as sort_key
            from public.practica_opciones o
            where o.pregunta_id=q.id
          ) oo
        )
      ) as qobj
    from public.practica_preguntas q
    where q.practica_id=v_pr.id and q.activo=true
  ) qq;

  return jsonb_build_object(
    'ok',true,
    'intento_id',v_intento_id,
    'codigo',v_pr.codigo,
    'titulo',v_pr.titulo,
    'descripcion',v_pr.descripcion,
    'participante',trim(v_worker.apellidos || ' ' || v_worker.nombres),
    'tiempo_pregunta_seg',v_pr.tiempo_pregunta_seg,
    'preguntas',coalesce(v_preguntas,'[]'::jsonb)
  );
end;
$$;

-- ============================================================
-- RPC PÚBLICA: RESPONDER PREGUNTA
-- ============================================================
create or replace function public.responder_practica(
  p_intento_id uuid,
  p_dni text,
  p_pregunta_id uuid,
  p_opcion_id uuid,
  p_tiempo_ms integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intento public.practica_intentos%rowtype;
  v_pr public.practicas%rowtype;
  v_correcta uuid;
  v_es_correcta boolean := false;
  v_tiempo integer := 0;
  v_max_ms integer := 20000;
  v_puntaje integer := 0;
begin
  select * into v_intento
  from public.practica_intentos
  where id=p_intento_id and dni=p_dni and finalizado_at is null
  limit 1;
  if not found then return jsonb_build_object('ok',false,'error','Intento no válido o ya finalizado.'); end if;

  select * into v_pr from public.practicas where id=v_intento.practica_id limit 1;
  if not found or not v_pr.activo or not v_pr.publicado then
    return jsonb_build_object('ok',false,'error','La práctica ya no está disponible.');
  end if;

  if not exists (
    select 1 from public.practica_preguntas
    where id=p_pregunta_id and practica_id=v_pr.id and activo=true
  ) then
    return jsonb_build_object('ok',false,'error','Pregunta no válida.');
  end if;

  select id into v_correcta
  from public.practica_opciones
  where pregunta_id=p_pregunta_id and es_correcta=true
  order by orden limit 1;

  v_es_correcta := p_opcion_id is not null and p_opcion_id = v_correcta;
  v_max_ms := v_pr.tiempo_pregunta_seg * 1000;
  v_tiempo := greatest(0, least(coalesce(p_tiempo_ms, v_max_ms), v_max_ms));

  if v_es_correcta then
    v_puntaje := 600 + floor(400 * greatest(0.0, 1.0 - (v_tiempo::numeric / v_max_ms::numeric)))::integer;
  else
    v_puntaje := 0;
  end if;

  insert into public.practica_respuestas(
    intento_id,pregunta_id,opcion_id,es_correcta,tiempo_ms,puntaje
  ) values (
    p_intento_id,p_pregunta_id,p_opcion_id,v_es_correcta,v_tiempo,v_puntaje
  )
  on conflict (intento_id,pregunta_id) do update set
    opcion_id=excluded.opcion_id,
    es_correcta=excluded.es_correcta,
    tiempo_ms=excluded.tiempo_ms,
    puntaje=excluded.puntaje;

  return jsonb_build_object(
    'ok',true,
    'es_correcta',v_es_correcta,
    'opcion_correcta_id',v_correcta,
    'puntaje',v_puntaje
  );
end;
$$;

-- ============================================================
-- RPC PÚBLICA: FINALIZAR QUIZ Y RANKING
-- ============================================================
create or replace function public.finalizar_practica(
  p_intento_id uuid,
  p_dni text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intento public.practica_intentos%rowtype;
  v_score integer := 0;
  v_correct integer := 0;
  v_total integer := 0;
  v_rank integer := 1;
  v_board jsonb;
begin
  select * into v_intento
  from public.practica_intentos
  where id=p_intento_id and dni=p_dni
  limit 1;
  if not found then return jsonb_build_object('ok',false,'error','Intento no válido.'); end if;

  select coalesce(sum(puntaje),0), count(*) filter(where es_correcta), v_intento.total_preguntas
    into v_score,v_correct,v_total
  from public.practica_respuestas
  where intento_id=p_intento_id;

  update public.practica_intentos
  set puntaje_total=v_score,
      correctas=v_correct,
      finalizado_at=coalesce(finalizado_at,now())
  where id=p_intento_id;

  select 1 + count(*) into v_rank
  from (
    select trabajador_id, max(puntaje_total) best
    from public.practica_intentos
    where practica_id=v_intento.practica_id
      and finalizado_at is not null
    group by trabajador_id
  ) r
  where r.best > v_score;

  select jsonb_agg(
    jsonb_build_object(
      'posicion',rn,
      'nombre',apellidos_nombres,
      'puntaje',best
    ) order by rn
  ) into v_board
  from (
    select row_number() over(order by best desc, apellidos_nombres) rn,
           apellidos_nombres,best
    from (
      select distinct on (trabajador_id)
        trabajador_id,apellidos_nombres,puntaje_total best
      from public.practica_intentos
      where practica_id=v_intento.practica_id
        and finalizado_at is not null
      order by trabajador_id,puntaje_total desc,finalizado_at asc
    ) b
    order by best desc,apellidos_nombres
    limit 10
  ) top10;

  return jsonb_build_object(
    'ok',true,
    'puntaje',v_score,
    'correctas',v_correct,
    'total',v_total,
    'posicion',v_rank,
    'ranking',coalesce(v_board,'[]'::jsonb)
  );
end;
$$;

revoke all on function public.can_view_practice(uuid) from public;
revoke all on function public.can_manage_practice(uuid) from public;
grant execute on function public.can_view_practice(uuid), public.can_manage_practice(uuid) to authenticated;

revoke all on function public.obtener_practica_participante(text,text) from public;
revoke all on function public.listar_sedes_registro_practica(text) from public;
revoke all on function public.registrar_trabajador_practica(text,text,text,text,text,text,uuid) from public;
revoke all on function public.iniciar_practica(text,text) from public;
revoke all on function public.responder_practica(uuid,text,uuid,uuid,integer) from public;
revoke all on function public.finalizar_practica(uuid,text) from public;

grant execute on function public.obtener_practica_participante(text,text) to anon,authenticated;
grant execute on function public.listar_sedes_registro_practica(text) to anon,authenticated;
grant execute on function public.registrar_trabajador_practica(text,text,text,text,text,text,uuid) to anon,authenticated;
grant execute on function public.iniciar_practica(text,text) to anon,authenticated;
grant execute on function public.responder_practica(uuid,text,uuid,uuid,integer) to anon,authenticated;
grant execute on function public.finalizar_practica(uuid,text) to anon,authenticated;

select 'Etapa 12 - Practicar aplicada correctamente' as resultado;
