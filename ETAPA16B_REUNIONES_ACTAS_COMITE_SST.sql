-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 16B - REUNIONES Y ACTAS DEL COMITÉ / SUBCOMITÉ SST
-- ============================================================

create table if not exists public.comite_sst_reuniones (
  id uuid primary key default gen_random_uuid(),
  comite_id uuid not null references public.comites_sst(id) on delete cascade,
  numero_acta text,
  tipo_reunion text not null default 'ORDINARIA'
    check (tipo_reunion in ('ORDINARIA','EXTRAORDINARIA')),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time,
  lugar text not null,
  mes_resultados date not null,

  agenda jsonb not null default '[
    "Revisión de incidentes/ accidentes",
    "Revisión de estadísticas de SST",
    "Revisión de estadísticas de SO",
    "Revisión de Objetivos y asuntos relevantes de Seguridad y Salud en el Trabajo.",
    "Revisión de las inspecciones realizadas.",
    "Revisión de las actas del subcomité de SST.",
    "Revisión de acuerdos pendientes",
    "Acuerdos de la reunión"
  ]'::jsonb,
  agenda_adicional jsonb not null default '[]'::jsonb,

  incidentes jsonb not null default '[]'::jsonb,
  estadisticas_sst jsonb not null default '{}'::jsonb,
  estadisticas_so jsonb not null default '{}'::jsonb,
  objetivos_sst jsonb not null default '[]'::jsonb,
  acuerdos_subcomites jsonb not null default '[]'::jsonb,

  proxima_fecha date,
  proxima_hora time,
  proxima_agenda text,

  observaciones text,
  estado text not null default 'PROGRAMADA'
    check (estado in ('BORRADOR','PROGRAMADA','CERRADA')),

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comite_sst_reunion_asistentes (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid not null references public.comite_sst_reuniones(id) on delete cascade,
  integrante_id uuid not null references public.comite_sst_integrantes(id) on delete restrict,
  presente boolean not null default true,
  observacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(reunion_id,integrante_id)
);

create table if not exists public.comite_sst_reunion_evidencias (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid not null references public.comite_sst_reuniones(id) on delete cascade,
  storage_path text not null,
  url text not null,
  descripcion text,
  orden integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.comite_sst_acuerdos (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid not null references public.comite_sst_reuniones(id) on delete cascade,
  comite_id uuid not null references public.comites_sst(id) on delete cascade,
  accion text not null,
  responsable text not null,
  fecha_cumplimiento date,
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE','EN_PROCESO','CERRADO')),
  observacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_comite_reuniones_comite on public.comite_sst_reuniones(comite_id);
create index if not exists idx_comite_reuniones_fecha on public.comite_sst_reuniones(fecha);
create index if not exists idx_comite_reuniones_estado on public.comite_sst_reuniones(estado);
create index if not exists idx_comite_asistentes_reunion on public.comite_sst_reunion_asistentes(reunion_id);
create index if not exists idx_comite_evidencias_reunion on public.comite_sst_reunion_evidencias(reunion_id);
create index if not exists idx_comite_acuerdos_reunion on public.comite_sst_acuerdos(reunion_id);
create index if not exists idx_comite_acuerdos_comite on public.comite_sst_acuerdos(comite_id);
create index if not exists idx_comite_acuerdos_estado on public.comite_sst_acuerdos(estado);

-- ------------------------------------------------------------
-- updated_at
-- ------------------------------------------------------------
drop trigger if exists trg_touch_comite_reuniones on public.comite_sst_reuniones;
create trigger trg_touch_comite_reuniones
before update on public.comite_sst_reuniones
for each row execute function public.touch_comite_sst_updated_at();

drop trigger if exists trg_touch_comite_reunion_asistentes on public.comite_sst_reunion_asistentes;
create trigger trg_touch_comite_reunion_asistentes
before update on public.comite_sst_reunion_asistentes
for each row execute function public.touch_comite_sst_updated_at();

drop trigger if exists trg_touch_comite_acuerdos on public.comite_sst_acuerdos;
create trigger trg_touch_comite_acuerdos
before update on public.comite_sst_acuerdos
for each row execute function public.touch_comite_sst_updated_at();

-- ------------------------------------------------------------
-- Numeración automática por Comité/Subcomité y año.
-- Ej.: 01-2026-CSST / 01-2026-SCSST
-- ------------------------------------------------------------
create or replace function public.set_comite_reunion_numero_acta()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo text;
  v_year integer;
  v_next integer;
begin
  if new.numero_acta is not null and btrim(new.numero_acta)<>'' then
    return new;
  end if;

  select tipo into v_tipo
  from public.comites_sst
  where id=new.comite_id;

  v_year := extract(year from new.fecha)::integer;

  perform pg_advisory_xact_lock(
    hashtext(new.comite_id::text || '-' || v_year::text)
  );

  select coalesce(max(
    nullif(split_part(numero_acta,'-',1),'')::integer
  ),0)+1
  into v_next
  from public.comite_sst_reuniones
  where comite_id=new.comite_id
    and extract(year from fecha)::integer=v_year
    and numero_acta ~ '^[0-9]+-';

  new.numero_acta :=
    lpad(v_next::text,2,'0')
    || '-' || v_year::text
    || '-' || case when v_tipo='SUBCOMITE' then 'SCSST' else 'CSST' end;

  return new;
end;
$$;

drop trigger if exists trg_set_comite_reunion_numero_acta on public.comite_sst_reuniones;
create trigger trg_set_comite_reunion_numero_acta
before insert on public.comite_sst_reuniones
for each row execute function public.set_comite_reunion_numero_acta();

-- ------------------------------------------------------------
-- Al programar una reunión se cargan automáticamente los
-- integrantes activos de la conformación.
-- ------------------------------------------------------------
create or replace function public.seed_comite_reunion_asistentes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.comite_sst_reunion_asistentes(
    reunion_id,integrante_id,presente
  )
  select new.id,m.id,true
  from public.comite_sst_integrantes m
  where m.comite_id=new.comite_id
    and m.activo=true
  on conflict (reunion_id,integrante_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_seed_comite_reunion_asistentes on public.comite_sst_reuniones;
create trigger trg_seed_comite_reunion_asistentes
after insert on public.comite_sst_reuniones
for each row execute function public.seed_comite_reunion_asistentes();

-- ============================================================
-- RLS
-- ============================================================
alter table public.comite_sst_reuniones enable row level security;
alter table public.comite_sst_reunion_asistentes enable row level security;
alter table public.comite_sst_reunion_evidencias enable row level security;
alter table public.comite_sst_acuerdos enable row level security;

drop policy if exists comite_reuniones_select on public.comite_sst_reuniones;
create policy comite_reuniones_select
on public.comite_sst_reuniones
for select to authenticated
using (
  exists (
    select 1 from public.comites_sst c
    where c.id=comite_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.has_project_access(c.proyecto_id)
        )
      )
  )
);

drop policy if exists comite_reuniones_insert on public.comite_sst_reuniones;
create policy comite_reuniones_insert
on public.comite_sst_reuniones
for insert to authenticated
with check (
  exists (
    select 1 from public.comites_sst c
    where c.id=comite_id
      and (
        public.is_admin()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.can_manage_project(c.proyecto_id)
        )
      )
  )
);

drop policy if exists comite_reuniones_update on public.comite_sst_reuniones;
create policy comite_reuniones_update
on public.comite_sst_reuniones
for update to authenticated
using (
  exists (
    select 1 from public.comites_sst c
    where c.id=comite_id
      and (
        public.is_admin()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.can_manage_project(c.proyecto_id)
        )
      )
  )
)
with check (
  exists (
    select 1 from public.comites_sst c
    where c.id=comite_id
      and (
        public.is_admin()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.can_manage_project(c.proyecto_id)
        )
      )
  )
);

drop policy if exists comite_reuniones_delete on public.comite_sst_reuniones;
create policy comite_reuniones_delete
on public.comite_sst_reuniones
for delete to authenticated
using (
  exists (
    select 1 from public.comites_sst c
    where c.id=comite_id
      and (
        public.is_admin()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.can_manage_project(c.proyecto_id)
        )
      )
  )
);

-- Tablas hijas: lectura si puede ver el Comité; escritura si puede gestionarlo.
drop policy if exists comite_reunion_asistentes_select on public.comite_sst_reunion_asistentes;
create policy comite_reunion_asistentes_select
on public.comite_sst_reunion_asistentes
for select to authenticated
using (
  exists (
    select 1
    from public.comite_sst_reuniones r
    join public.comites_sst c on c.id=r.comite_id
    where r.id=reunion_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or (c.tipo='SUBCOMITE' and c.proyecto_id is not null and public.has_project_access(c.proyecto_id))
      )
  )
);

drop policy if exists comite_reunion_asistentes_manage on public.comite_sst_reunion_asistentes;
create policy comite_reunion_asistentes_manage
on public.comite_sst_reunion_asistentes
for all to authenticated
using (
  exists (
    select 1
    from public.comite_sst_reuniones r
    join public.comites_sst c on c.id=r.comite_id
    where r.id=reunion_id
      and (
        public.is_admin()
        or (c.tipo='SUBCOMITE' and c.proyecto_id is not null and public.can_manage_project(c.proyecto_id))
      )
  )
)
with check (
  exists (
    select 1
    from public.comite_sst_reuniones r
    join public.comites_sst c on c.id=r.comite_id
    where r.id=reunion_id
      and (
        public.is_admin()
        or (c.tipo='SUBCOMITE' and c.proyecto_id is not null and public.can_manage_project(c.proyecto_id))
      )
  )
);

drop policy if exists comite_reunion_evidencias_select on public.comite_sst_reunion_evidencias;
create policy comite_reunion_evidencias_select
on public.comite_sst_reunion_evidencias
for select to authenticated
using (
  exists (
    select 1
    from public.comite_sst_reuniones r
    join public.comites_sst c on c.id=r.comite_id
    where r.id=reunion_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or (c.tipo='SUBCOMITE' and c.proyecto_id is not null and public.has_project_access(c.proyecto_id))
      )
  )
);

drop policy if exists comite_reunion_evidencias_manage on public.comite_sst_reunion_evidencias;
create policy comite_reunion_evidencias_manage
on public.comite_sst_reunion_evidencias
for all to authenticated
using (
  exists (
    select 1
    from public.comite_sst_reuniones r
    join public.comites_sst c on c.id=r.comite_id
    where r.id=reunion_id
      and (
        public.is_admin()
        or (c.tipo='SUBCOMITE' and c.proyecto_id is not null and public.can_manage_project(c.proyecto_id))
      )
  )
)
with check (
  exists (
    select 1
    from public.comite_sst_reuniones r
    join public.comites_sst c on c.id=r.comite_id
    where r.id=reunion_id
      and (
        public.is_admin()
        or (c.tipo='SUBCOMITE' and c.proyecto_id is not null and public.can_manage_project(c.proyecto_id))
      )
  )
);

drop policy if exists comite_acuerdos_select on public.comite_sst_acuerdos;
create policy comite_acuerdos_select
on public.comite_sst_acuerdos
for select to authenticated
using (
  exists (
    select 1 from public.comites_sst c
    where c.id=comite_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or (c.tipo='SUBCOMITE' and c.proyecto_id is not null and public.has_project_access(c.proyecto_id))
      )
  )
);

drop policy if exists comite_acuerdos_manage on public.comite_sst_acuerdos;
create policy comite_acuerdos_manage
on public.comite_sst_acuerdos
for all to authenticated
using (
  exists (
    select 1 from public.comites_sst c
    where c.id=comite_id
      and (
        public.is_admin()
        or (c.tipo='SUBCOMITE' and c.proyecto_id is not null and public.can_manage_project(c.proyecto_id))
      )
  )
)
with check (
  exists (
    select 1 from public.comites_sst c
    where c.id=comite_id
      and (
        public.is_admin()
        or (c.tipo='SUBCOMITE' and c.proyecto_id is not null and public.can_manage_project(c.proyecto_id))
      )
  )
);

grant select,insert,update,delete on public.comite_sst_reuniones to authenticated;
grant select,insert,update,delete on public.comite_sst_reunion_asistentes to authenticated;
grant select,insert,update,delete on public.comite_sst_reunion_evidencias to authenticated;
grant select,insert,update,delete on public.comite_sst_acuerdos to authenticated;

-- ============================================================
-- STORAGE PARA EVIDENCIAS DE INSPECCIÓN
-- ============================================================
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'comite-sst-evidencias',
  'comite-sst-evidencias',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public=true,
    file_size_limit=5242880,
    allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists comite_sst_evidencias_storage_select on storage.objects;
create policy comite_sst_evidencias_storage_select
on storage.objects
for select to public
using (bucket_id='comite-sst-evidencias');

drop policy if exists comite_sst_evidencias_storage_insert on storage.objects;
create policy comite_sst_evidencias_storage_insert
on storage.objects
for insert to authenticated
with check (bucket_id='comite-sst-evidencias');

drop policy if exists comite_sst_evidencias_storage_update on storage.objects;
create policy comite_sst_evidencias_storage_update
on storage.objects
for update to authenticated
using (bucket_id='comite-sst-evidencias')
with check (bucket_id='comite-sst-evidencias');

drop policy if exists comite_sst_evidencias_storage_delete on storage.objects;
create policy comite_sst_evidencias_storage_delete
on storage.objects
for delete to authenticated
using (bucket_id='comite-sst-evidencias');

-- ============================================================
-- SINCRONIZAR PARTICIPANTES CON LA CONFORMACIÓN ACTUAL
-- ============================================================
create or replace function public.sincronizar_asistentes_reunion(
  p_reunion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.comite_sst_reuniones%rowtype;
  v_c public.comites_sst%rowtype;
  v_count integer;
begin
  select * into v_r
  from public.comite_sst_reuniones
  where id=p_reunion_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','No se encontró la reunión.');
  end if;

  select * into v_c
  from public.comites_sst
  where id=v_r.comite_id
  limit 1;

  if not (
    public.is_admin()
    or (
      v_c.tipo='SUBCOMITE'
      and v_c.proyecto_id is not null
      and public.can_manage_project(v_c.proyecto_id)
    )
  ) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para modificar la reunión.');
  end if;

  insert into public.comite_sst_reunion_asistentes(
    reunion_id,integrante_id,presente
  )
  select v_r.id,m.id,true
  from public.comite_sst_integrantes m
  where m.comite_id=v_r.comite_id
    and m.activo=true
  on conflict (reunion_id,integrante_id) do nothing;

  select count(*) into v_count
  from public.comite_sst_reunion_asistentes
  where reunion_id=v_r.id;

  return jsonb_build_object(
    'ok',true,
    'total',v_count,
    'message','Participantes sincronizados correctamente.'
  );
end;
$$;

revoke all on function public.sincronizar_asistentes_reunion(uuid) from public;
grant execute on function public.sincronizar_asistentes_reunion(uuid) to authenticated;

select 'Etapa 16B aplicada correctamente' as resultado;
