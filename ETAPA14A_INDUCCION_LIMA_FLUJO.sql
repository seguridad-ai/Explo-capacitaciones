-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 14A - FLUJO DE INDUCCIÓN SEDE LIMA
-- Programación -> Examen -> Trabajadores
-- ============================================================

alter table public.inducciones
  add column if not exists empresa text default 'EXPLO DRILLING PERU S.R.L.',
  add column if not exists contratista text default 'N.A.',
  add column if not exists distrito text,
  add column if not exists provincia text,
  add column if not exists tema text,
  add column if not exists expositor text,
  add column if not exists expositor_cargo text,
  add column if not exists expositor_dni varchar(8),
  add column if not exists area text,
  add column if not exists tiempo_horas numeric(6,2),
  add column if not exists firma_expositor text;

create table if not exists public.induccion_preguntas (
  id uuid primary key default gen_random_uuid(),
  induccion_id uuid not null references public.inducciones(id) on delete cascade,
  orden integer not null default 1,
  enunciado text not null,
  tipo text not null default 'OPCION_MULTIPLE'
    check (tipo in ('OPCION_MULTIPLE','VERDADERO_FALSO','VARIAS_RESPUESTAS','RESPUESTA_LIBRE')),
  peso numeric(6,2) not null default 1 check (peso > 0),
  explicacion text,
  respuestas_aceptadas jsonb not null default '[]'::jsonb,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique(induccion_id, orden)
);

create table if not exists public.induccion_opciones (
  id uuid primary key default gen_random_uuid(),
  pregunta_id uuid not null references public.induccion_preguntas(id) on delete cascade,
  orden integer not null,
  texto text not null,
  es_correcta boolean not null default false,
  unique(pregunta_id, orden)
);

create table if not exists public.induccion_participantes (
  id uuid primary key default gen_random_uuid(),
  induccion_id uuid not null references public.inducciones(id) on delete cascade,
  trabajador_id uuid not null references public.trabajadores(id) on delete cascade,
  estado text not null default 'ASIGNADO'
    check (estado in ('ASIGNADO','EN_PROCESO','COMPLETADO')),
  nota numeric(5,2),
  firma text,
  asignado_at timestamptz not null default now(),
  completado_at timestamptz,
  unique(induccion_id, trabajador_id)
);

create index if not exists idx_induccion_preguntas_induccion
  on public.induccion_preguntas(induccion_id);

create index if not exists idx_induccion_participantes_induccion
  on public.induccion_participantes(induccion_id);

create index if not exists idx_induccion_participantes_trabajador
  on public.induccion_participantes(trabajador_id);

alter table public.induccion_preguntas enable row level security;
alter table public.induccion_opciones enable row level security;
alter table public.induccion_participantes enable row level security;

drop policy if exists induccion_preguntas_select on public.induccion_preguntas;
drop policy if exists induccion_preguntas_manage on public.induccion_preguntas;
drop policy if exists induccion_opciones_select on public.induccion_opciones;
drop policy if exists induccion_opciones_manage on public.induccion_opciones;
drop policy if exists induccion_participantes_select on public.induccion_participantes;
drop policy if exists induccion_participantes_manage on public.induccion_participantes;

create policy induccion_preguntas_select
on public.induccion_preguntas
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

create policy induccion_preguntas_manage
on public.induccion_preguntas
for all to authenticated
using (
  exists (
    select 1 from public.inducciones i
    where i.id = induccion_id
      and (
        public.is_admin()
        or (i.proyecto_id is not null and public.can_manage_project(i.proyecto_id))
      )
  )
)
with check (
  exists (
    select 1 from public.inducciones i
    where i.id = induccion_id
      and (
        public.is_admin()
        or (i.proyecto_id is not null and public.can_manage_project(i.proyecto_id))
      )
  )
);

create policy induccion_opciones_select
on public.induccion_opciones
for select to authenticated
using (
  exists (
    select 1
    from public.induccion_preguntas q
    join public.inducciones i on i.id = q.induccion_id
    where q.id = pregunta_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or (i.proyecto_id is not null and public.has_project_access(i.proyecto_id))
      )
  )
);

create policy induccion_opciones_manage
on public.induccion_opciones
for all to authenticated
using (
  exists (
    select 1
    from public.induccion_preguntas q
    join public.inducciones i on i.id = q.induccion_id
    where q.id = pregunta_id
      and (
        public.is_admin()
        or (i.proyecto_id is not null and public.can_manage_project(i.proyecto_id))
      )
  )
)
with check (
  exists (
    select 1
    from public.induccion_preguntas q
    join public.inducciones i on i.id = q.induccion_id
    where q.id = pregunta_id
      and (
        public.is_admin()
        or (i.proyecto_id is not null and public.can_manage_project(i.proyecto_id))
      )
  )
);

create policy induccion_participantes_select
on public.induccion_participantes
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

create policy induccion_participantes_manage
on public.induccion_participantes
for all to authenticated
using (
  exists (
    select 1 from public.inducciones i
    where i.id = induccion_id
      and (
        public.is_admin()
        or (i.proyecto_id is not null and public.can_manage_project(i.proyecto_id))
      )
  )
)
with check (
  exists (
    select 1 from public.inducciones i
    where i.id = induccion_id
      and (
        public.is_admin()
        or (i.proyecto_id is not null and public.can_manage_project(i.proyecto_id))
      )
  )
);

grant select, insert, update, delete on table
  public.induccion_preguntas,
  public.induccion_opciones,
  public.induccion_participantes
to authenticated;

-- Guarda pregunta + alternativas en una sola operación.
create or replace function public.guardar_pregunta_induccion(
  p_induccion_id uuid,
  p_pregunta_id uuid,
  p_enunciado text,
  p_tipo text,
  p_peso numeric,
  p_explicacion text,
  p_opciones jsonb,
  p_respuestas_aceptadas jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ind public.inducciones%rowtype;
  v_qid uuid;
  v_orden integer;
  v_option jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  select * into v_ind
  from public.inducciones
  where id = p_induccion_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','La inducción no existe.');
  end if;

  if not (
    public.is_admin()
    or (v_ind.proyecto_id is not null and public.can_manage_project(v_ind.proyecto_id))
  ) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para modificar esta inducción.');
  end if;

  if btrim(coalesce(p_enunciado,'')) = '' then
    return jsonb_build_object('ok',false,'error','Ingresa la pregunta.');
  end if;

  if p_tipo not in ('OPCION_MULTIPLE','VERDADERO_FALSO','VARIAS_RESPUESTAS','RESPUESTA_LIBRE') then
    return jsonb_build_object('ok',false,'error','Tipo de pregunta no válido.');
  end if;

  if p_pregunta_id is null then
    select coalesce(max(orden),0)+1 into v_orden
    from public.induccion_preguntas
    where induccion_id = p_induccion_id;

    insert into public.induccion_preguntas(
      induccion_id,orden,enunciado,tipo,peso,explicacion,respuestas_aceptadas,activo
    ) values (
      p_induccion_id,v_orden,btrim(p_enunciado),p_tipo,p_peso,
      nullif(btrim(coalesce(p_explicacion,'')),''),
      coalesce(p_respuestas_aceptadas,'[]'::jsonb),true
    )
    returning id into v_qid;
  else
    v_qid := p_pregunta_id;

    update public.induccion_preguntas
    set enunciado=btrim(p_enunciado),
        tipo=p_tipo,
        peso=p_peso,
        explicacion=nullif(btrim(coalesce(p_explicacion,'')),''),
        respuestas_aceptadas=coalesce(p_respuestas_aceptadas,'[]'::jsonb),
        activo=true
    where id=v_qid and induccion_id=p_induccion_id;

    delete from public.induccion_opciones where pregunta_id=v_qid;
  end if;

  if p_tipo <> 'RESPUESTA_LIBRE' then
    for v_option in
      select * from jsonb_array_elements(coalesce(p_opciones,'[]'::jsonb))
    loop
      insert into public.induccion_opciones(
        pregunta_id,orden,texto,es_correcta
      ) values (
        v_qid,
        (v_option->>'orden')::integer,
        v_option->>'texto',
        coalesce((v_option->>'es_correcta')::boolean,false)
      );
    end loop;
  end if;

  return jsonb_build_object('ok',true,'pregunta_id',v_qid);
exception
  when others then
    return jsonb_build_object('ok',false,'error',SQLERRM);
end;
$$;

revoke all on function public.guardar_pregunta_induccion(
  uuid,uuid,text,text,numeric,text,jsonb,jsonb
) from public;

grant execute on function public.guardar_pregunta_induccion(
  uuid,uuid,text,text,numeric,text,jsonb,jsonb
) to authenticated;

select 'Etapa 14A aplicada correctamente' as resultado;
