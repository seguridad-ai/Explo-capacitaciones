-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 7 · EXAMEN DE CAPACITACIÓN
-- ============================================================
-- Esta etapa permite:
--   1) Configurar si una capacitación tendrá evaluación.
--   2) Crear preguntas de opción múltiple.
--   3) Publicar un examen para participantes.
--   4) Permitir que un trabajador ingrese con código + DNI.
--   5) Calificar automáticamente sobre 20 puntos.
--   6) Guardar la mejor nota en capacitacion_participantes.nota.
-- ============================================================

-- 1. CABECERA DEL EXAMEN
create table if not exists public.examenes (
    id uuid primary key default gen_random_uuid(),

    capacitacion_id uuid not null unique
      references public.capacitaciones(id)
      on delete cascade,

    titulo text not null,
    requiere_evaluacion boolean not null default true,
    nota_aprobatoria numeric(5,2) not null default 16.00,
    max_intentos integer not null default 2,
    mostrar_resultado boolean not null default true,
    publicado boolean not null default false,
    activo boolean not null default true,

    created_by uuid not null
      references public.profiles(id)
      on delete restrict,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint examenes_nota_aprobatoria_chk
      check (nota_aprobatoria >= 0 and nota_aprobatoria <= 20),

    constraint examenes_max_intentos_chk
      check (max_intentos between 1 and 10)
);

create index if not exists idx_examenes_capacitacion
  on public.examenes(capacitacion_id);

create index if not exists idx_examenes_publicado
  on public.examenes(publicado, activo);

-- 2. PREGUNTAS
create table if not exists public.examen_preguntas (
    id uuid primary key default gen_random_uuid(),

    examen_id uuid not null
      references public.examenes(id)
      on delete cascade,

    orden integer not null default 1,
    enunciado text not null,
    activo boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint examen_preguntas_orden_chk
      check (orden > 0)
);

create index if not exists idx_examen_preguntas_examen
  on public.examen_preguntas(examen_id, orden);

-- 3. ALTERNATIVAS
create table if not exists public.examen_opciones (
    id uuid primary key default gen_random_uuid(),

    pregunta_id uuid not null
      references public.examen_preguntas(id)
      on delete cascade,

    orden integer not null default 1,
    texto text not null,
    es_correcta boolean not null default false,

    created_at timestamptz not null default now(),

    constraint examen_opciones_orden_chk
      check (orden > 0),

    constraint examen_opciones_unica_orden
      unique (pregunta_id, orden)
);

create index if not exists idx_examen_opciones_pregunta
  on public.examen_opciones(pregunta_id, orden);

-- 4. INTENTOS
create table if not exists public.examen_intentos (
    id uuid primary key default gen_random_uuid(),

    examen_id uuid not null
      references public.examenes(id)
      on delete cascade,

    participante_id uuid not null
      references public.capacitacion_participantes(id)
      on delete cascade,

    numero_intento integer not null,
    nota numeric(5,2) not null,
    aprobado boolean not null,

    iniciado_at timestamptz not null default now(),
    finalizado_at timestamptz not null default now(),

    constraint examen_intentos_numero_chk
      check (numero_intento > 0),

    constraint examen_intentos_nota_chk
      check (nota >= 0 and nota <= 20),

    constraint examen_intentos_unico
      unique (examen_id, participante_id, numero_intento)
);

create index if not exists idx_examen_intentos_participante
  on public.examen_intentos(participante_id, examen_id);

-- 5. RESPUESTAS DEL INTENTO
create table if not exists public.examen_respuestas (
    id uuid primary key default gen_random_uuid(),

    intento_id uuid not null
      references public.examen_intentos(id)
      on delete cascade,

    pregunta_id uuid not null
      references public.examen_preguntas(id)
      on delete cascade,

    opcion_id uuid not null
      references public.examen_opciones(id)
      on delete cascade,

    es_correcta boolean not null,
    created_at timestamptz not null default now(),

    constraint examen_respuestas_unica
      unique (intento_id, pregunta_id)
);

create index if not exists idx_examen_respuestas_intento
  on public.examen_respuestas(intento_id);

-- 6. updated_at

drop trigger if exists trg_examenes_updated_at on public.examenes;
create trigger trg_examenes_updated_at
before update on public.examenes
for each row execute function public.actualizar_updated_at();

drop trigger if exists trg_examen_preguntas_updated_at on public.examen_preguntas;
create trigger trg_examen_preguntas_updated_at
before update on public.examen_preguntas
for each row execute function public.actualizar_updated_at();

-- 7. FUNCIONES AUXILIARES DE PERMISOS
create or replace function public.can_view_exam(p_examen_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.examenes e
    where e.id = p_examen_id
      and public.can_view_training(e.capacitacion_id)
  );
$$;

create or replace function public.can_manage_exam(p_examen_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.examenes e
    where e.id = p_examen_id
      and public.can_manage_training(e.capacitacion_id)
  );
$$;

create or replace function public.can_view_question(p_pregunta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.examen_preguntas p
    where p.id = p_pregunta_id
      and public.can_view_exam(p.examen_id)
  );
$$;

create or replace function public.can_manage_question(p_pregunta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.examen_preguntas p
    where p.id = p_pregunta_id
      and public.can_manage_exam(p.examen_id)
  );
$$;

-- 8. RLS
alter table public.examenes enable row level security;
alter table public.examen_preguntas enable row level security;
alter table public.examen_opciones enable row level security;
alter table public.examen_intentos enable row level security;
alter table public.examen_respuestas enable row level security;

-- EXÁMENES

drop policy if exists examenes_select on public.examenes;
drop policy if exists examenes_insert on public.examenes;
drop policy if exists examenes_update on public.examenes;
drop policy if exists examenes_delete on public.examenes;

create policy examenes_select
on public.examenes
for select
to authenticated
using (public.can_view_training(capacitacion_id));

create policy examenes_insert
on public.examenes
for insert
to authenticated
with check (public.can_manage_training(capacitacion_id));

create policy examenes_update
on public.examenes
for update
to authenticated
using (public.can_manage_training(capacitacion_id))
with check (public.can_manage_training(capacitacion_id));

create policy examenes_delete
on public.examenes
for delete
to authenticated
using (public.can_manage_training(capacitacion_id));

-- PREGUNTAS

drop policy if exists examen_preguntas_select on public.examen_preguntas;
drop policy if exists examen_preguntas_insert on public.examen_preguntas;
drop policy if exists examen_preguntas_update on public.examen_preguntas;
drop policy if exists examen_preguntas_delete on public.examen_preguntas;

create policy examen_preguntas_select
on public.examen_preguntas
for select
to authenticated
using (public.can_view_exam(examen_id));

create policy examen_preguntas_insert
on public.examen_preguntas
for insert
to authenticated
with check (public.can_manage_exam(examen_id));

create policy examen_preguntas_update
on public.examen_preguntas
for update
to authenticated
using (public.can_manage_exam(examen_id))
with check (public.can_manage_exam(examen_id));

create policy examen_preguntas_delete
on public.examen_preguntas
for delete
to authenticated
using (public.can_manage_exam(examen_id));

-- OPCIONES

drop policy if exists examen_opciones_select on public.examen_opciones;
drop policy if exists examen_opciones_insert on public.examen_opciones;
drop policy if exists examen_opciones_update on public.examen_opciones;
drop policy if exists examen_opciones_delete on public.examen_opciones;

create policy examen_opciones_select
on public.examen_opciones
for select
to authenticated
using (public.can_view_question(pregunta_id));

create policy examen_opciones_insert
on public.examen_opciones
for insert
to authenticated
with check (public.can_manage_question(pregunta_id));

create policy examen_opciones_update
on public.examen_opciones
for update
to authenticated
using (public.can_manage_question(pregunta_id))
with check (public.can_manage_question(pregunta_id));

create policy examen_opciones_delete
on public.examen_opciones
for delete
to authenticated
using (public.can_manage_question(pregunta_id));

-- INTENTOS / RESPUESTAS: el panel autenticado puede consultar según el examen.
-- La creación pública se realiza EXCLUSIVAMENTE mediante RPC security definer.

drop policy if exists examen_intentos_select on public.examen_intentos;
drop policy if exists examen_respuestas_select on public.examen_respuestas;

create policy examen_intentos_select
on public.examen_intentos
for select
to authenticated
using (public.can_view_exam(examen_id));

create policy examen_respuestas_select
on public.examen_respuestas
for select
to authenticated
using (
  exists (
    select 1
    from public.examen_intentos i
    where i.id = intento_id
      and public.can_view_exam(i.examen_id)
  )
);

-- 9. VALIDACIÓN DEL EXAMEN ANTES DE PUBLICAR
-- Evita publicar evaluaciones sin preguntas, sin opciones o sin una única respuesta correcta.
create or replace function public.validar_examen_publicable(p_examen_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_exam public.examenes%rowtype;
  v_total integer;
  v_invalidas integer;
begin
  select * into v_exam
  from public.examenes
  where id = p_examen_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Examen no encontrado.');
  end if;

  if not public.can_manage_training(v_exam.capacitacion_id) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para administrar este examen.');
  end if;

  if not v_exam.requiere_evaluacion then
    return jsonb_build_object('ok', true, 'total_preguntas', 0);
  end if;

  select count(*) into v_total
  from public.examen_preguntas p
  where p.examen_id = p_examen_id
    and p.activo = true;

  if v_total = 0 then
    return jsonb_build_object('ok', false, 'error', 'Agrega al menos una pregunta antes de publicar el examen.');
  end if;

  select count(*) into v_invalidas
  from public.examen_preguntas p
  where p.examen_id = p_examen_id
    and p.activo = true
    and (
      (select count(*) from public.examen_opciones o where o.pregunta_id = p.id) < 2
      or
      (select count(*) from public.examen_opciones o where o.pregunta_id = p.id and o.es_correcta = true) <> 1
    );

  if v_invalidas > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'Cada pregunta debe tener al menos dos alternativas y exactamente una respuesta correcta.'
    );
  end if;

  return jsonb_build_object('ok', true, 'total_preguntas', v_total);
end;
$$;

-- 10. RPC PÚBLICA: OBTENER EXAMEN PARA UN PARTICIPANTE
-- No devuelve las respuestas correctas.
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
  v_part public.capacitacion_participantes%rowtype;
  v_exam public.examenes%rowtype;
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

  select * into v_cap
  from public.capacitaciones
  where upper(codigo) = upper(btrim(p_codigo))
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'No se encontró la capacitación indicada.');
  end if;

  select * into v_part
  from public.capacitacion_participantes
  where capacitacion_id = v_cap.id
    and dni = p_dni
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'El DNI no está registrado como participante de esta capacitación.');
  end if;

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
    'nombre', v_part.apellidos_nombres,
    'dni', v_part.dni,
    'puesto', v_part.puesto,
    'area', v_part.area,
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

-- 11. RPC PÚBLICA: ENVIAR Y CALIFICAR EXAMEN
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

  select * into v_part
  from public.capacitacion_participantes
  where capacitacion_id = v_cap.id
    and dni = p_dni
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'El trabajador no pertenece a esta capacitación.');
  end if;

  select * into v_exam
  from public.examenes
  where capacitacion_id = v_cap.id
    and activo = true
  limit 1;

  if not found or not v_exam.requiere_evaluacion or not v_exam.publicado then
    return jsonb_build_object('ok', false, 'error', 'La evaluación no se encuentra habilitada.');
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

  -- Procesar una respuesta por pregunta. Solo se consideran opciones que pertenecen
  -- realmente a una pregunta activa del examen.
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

-- 12. PERMISOS
revoke all on table public.examenes from anon;
revoke all on table public.examen_preguntas from anon;
revoke all on table public.examen_opciones from anon;
revoke all on table public.examen_intentos from anon;
revoke all on table public.examen_respuestas from anon;

grant select, insert, update, delete on table public.examenes to authenticated;
grant select, insert, update, delete on table public.examen_preguntas to authenticated;
grant select, insert, update, delete on table public.examen_opciones to authenticated;
grant select on table public.examen_intentos to authenticated;
grant select on table public.examen_respuestas to authenticated;

revoke all on function public.can_view_exam(uuid) from public;
revoke all on function public.can_manage_exam(uuid) from public;
revoke all on function public.can_view_question(uuid) from public;
revoke all on function public.can_manage_question(uuid) from public;
revoke all on function public.validar_examen_publicable(uuid) from public;
revoke all on function public.obtener_examen_participante(text,text) from public;
revoke all on function public.enviar_examen_participante(text,text,jsonb) from public;

grant execute on function public.can_view_exam(uuid) to authenticated;
grant execute on function public.can_manage_exam(uuid) to authenticated;
grant execute on function public.can_view_question(uuid) to authenticated;
grant execute on function public.can_manage_question(uuid) to authenticated;
grant execute on function public.validar_examen_publicable(uuid) to authenticated;

-- Estas dos RPC se habilitan para trabajadores sin cuenta administrativa.
grant execute on function public.obtener_examen_participante(text,text) to anon, authenticated;
grant execute on function public.enviar_examen_participante(text,text,jsonb) to anon, authenticated;

select
  'Etapa 7 creada correctamente' as resultado,
  (select count(*) from public.examenes) as examenes_creados,
  (select count(*) from public.examen_preguntas) as preguntas_creadas;
