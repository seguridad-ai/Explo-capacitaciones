-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 14B - INDUCCIÓN LIMA: REGISTRO PÚBLICO + EXAMEN
-- ============================================================

alter table public.inducciones
  add column if not exists public_token text
  default replace(gen_random_uuid()::text,'-','');

update public.inducciones
set public_token = replace(gen_random_uuid()::text,'-','')
where public_token is null or btrim(public_token) = '';

create unique index if not exists ux_inducciones_public_token
  on public.inducciones(public_token);

-- El participante puede ser personal nuevo y no existir aún en Trabajadores.
alter table public.induccion_participantes
  alter column trabajador_id drop not null;

alter table public.induccion_participantes
  add column if not exists dni varchar(8),
  add column if not exists nombre text,
  add column if not exists fecha_ingreso date,
  add column if not exists puesto text,
  add column if not exists area text,
  add column if not exists registered_at timestamptz default now();

create unique index if not exists ux_induccion_participante_dni
  on public.induccion_participantes(induccion_id,dni)
  where dni is not null;

create table if not exists public.induccion_intentos (
  id uuid primary key default gen_random_uuid(),
  induccion_id uuid not null references public.inducciones(id) on delete cascade,
  participante_id uuid not null references public.induccion_participantes(id) on delete cascade,
  iniciado_at timestamptz not null default now(),
  finalizado_at timestamptz,
  nota numeric(5,2),
  correctas integer not null default 0,
  total_preguntas integer not null default 0,
  aprobado boolean
);

create table if not exists public.induccion_respuestas (
  id uuid primary key default gen_random_uuid(),
  intento_id uuid not null references public.induccion_intentos(id) on delete cascade,
  pregunta_id uuid not null references public.induccion_preguntas(id) on delete cascade,
  respuesta jsonb not null default '{}'::jsonb,
  es_correcta boolean not null default false,
  puntos_obtenidos numeric(7,2) not null default 0,
  unique(intento_id,pregunta_id)
);

create index if not exists idx_induccion_intentos_participante
  on public.induccion_intentos(participante_id);
create index if not exists idx_induccion_respuestas_intento
  on public.induccion_respuestas(intento_id);

alter table public.induccion_intentos enable row level security;
alter table public.induccion_respuestas enable row level security;

drop policy if exists induccion_intentos_select on public.induccion_intentos;
drop policy if exists induccion_respuestas_select on public.induccion_respuestas;

create policy induccion_intentos_select
on public.induccion_intentos
for select to authenticated
using (
  exists (
    select 1 from public.inducciones i
    where i.id = induccion_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or (i.proyecto_id is not null and public.has_project_access(i.proyecto_id))
      )
  )
);

create policy induccion_respuestas_select
on public.induccion_respuestas
for select to authenticated
using (
  exists (
    select 1
    from public.induccion_intentos it
    join public.inducciones i on i.id = it.induccion_id
    where it.id = intento_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or (i.proyecto_id is not null and public.has_project_access(i.proyecto_id))
      )
  )
);

grant select on public.induccion_intentos, public.induccion_respuestas to authenticated;

-- Devuelve la inducción y las preguntas SIN respuestas correctas.
create or replace function public.obtener_induccion_publica(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ind public.inducciones%rowtype;
  v_questions jsonb;
begin
  select * into v_ind
  from public.inducciones
  where public_token = btrim(p_token)
    and tipo = 'LIMA'
    and estado = 'ACTIVA'
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok',false,
      'error','La inducción no está disponible o el enlace no es válido.'
    );
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
                ) order by o.orden
              ),
              '[]'::jsonb
            )
            from public.induccion_opciones o
            where o.pregunta_id=q.id
          )
          end
      ) order by q.orden
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
      'empresa',coalesce(v_ind.empresa,'EXPLO DRILLING PERU S.R.L.'),
      'contratista',coalesce(v_ind.contratista,'N.A.'),
      'tema',coalesce(v_ind.tema,v_ind.titulo),
      'fecha',v_ind.fecha,
      'area',v_ind.area,
      'tiempo_horas',v_ind.tiempo_horas,
      'nota_minima',v_ind.nota_minima,
      'expositor',v_ind.expositor,
      'expositor_cargo',v_ind.expositor_cargo
    ),
    'preguntas',v_questions
  );
end;
$$;

-- Registro manual del trabajador nuevo.
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
  select * into v_ind
  from public.inducciones
  where public_token=btrim(p_token)
    and tipo='LIMA'
    and estado='ACTIVA'
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','La inducción no está disponible.');
  end if;

  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok',false,'error','El DNI debe tener 8 dígitos.');
  end if;
  if btrim(coalesce(p_nombre,''))='' then
    return jsonb_build_object('ok',false,'error','Ingresa tu nombre.');
  end if;
  if p_fecha_ingreso is null then
    return jsonb_build_object('ok',false,'error','Ingresa la fecha de ingreso.');
  end if;
  if btrim(coalesce(p_puesto,''))='' then
    return jsonb_build_object('ok',false,'error','Ingresa tu puesto de trabajo u ocupación.');
  end if;
  if btrim(coalesce(p_area,''))='' then
    return jsonb_build_object('ok',false,'error','Ingresa tu área de trabajo.');
  end if;
  if p_firma is null or length(p_firma)<100 or p_firma not like 'data:image/%' then
    return jsonb_build_object('ok',false,'error','Registra tu firma digital.');
  end if;

  select id into v_worker_id
  from public.trabajadores
  where dni=p_dni
  limit 1;

  select * into v_part
  from public.induccion_participantes
  where induccion_id=v_ind.id and dni=p_dni
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

-- Califica el examen ponderado sobre 20.
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
  select * into v_ind
  from public.inducciones
  where public_token=btrim(p_token)
    and tipo='LIMA'
    and estado='ACTIVA'
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','La inducción no está disponible.');
  end if;

  select * into v_part
  from public.induccion_participantes
  where id=p_participante_id and induccion_id=v_ind.id
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
    where induccion_id=v_ind.id and activo=true
    order by orden
  loop
    v_total_count := v_total_count + 1;
    v_total_weight := v_total_weight + v_q.peso;
    v_correcta := false;
    v_selected := array[]::text[];
    v_correct := array[]::text[];
    v_text := '';

    select r.obj into v_resp
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
      where o.pregunta_id=v_q.id and o.es_correcta=true;

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
    'nota_minima',v_ind.nota_minima
  );
exception
  when others then
    return jsonb_build_object('ok',false,'error',SQLERRM);
end;
$$;

revoke all on function public.obtener_induccion_publica(text) from public;
revoke all on function public.registrar_participante_induccion(text,text,text,date,text,text,text) from public;
revoke all on function public.finalizar_examen_induccion(text,uuid,jsonb) from public;

grant execute on function public.obtener_induccion_publica(text) to anon, authenticated;
grant execute on function public.registrar_participante_induccion(text,text,text,date,text,text,text) to anon, authenticated;
grant execute on function public.finalizar_examen_induccion(text,uuid,jsonb) to anon, authenticated;

select 'Etapa 14B aplicada correctamente' as resultado;
