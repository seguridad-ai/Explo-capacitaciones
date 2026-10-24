-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 16C - SEGUIMIENTO DE ACUERDOS DEL COMITÉ / SUBCOMITÉ SST
-- ============================================================

-- 1. Ampliar acuerdos existentes.
alter table public.comite_sst_acuerdos
  add column if not exists fecha_cierre date,
  add column if not exists cierre_observacion text,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

update public.comite_sst_acuerdos
set fecha_cierre=coalesce(fecha_cierre,updated_at::date)
where estado='CERRADO'
  and fecha_cierre is null;

-- 2. Evidencias de seguimiento/cierre.
create table if not exists public.comite_sst_acuerdo_evidencias (
  id uuid primary key default gen_random_uuid(),
  acuerdo_id uuid not null references public.comite_sst_acuerdos(id) on delete cascade,
  storage_path text not null,
  url text not null,
  nombre_archivo text,
  tipo_archivo text,
  descripcion text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_comite_acuerdo_evidencias_acuerdo
on public.comite_sst_acuerdo_evidencias(acuerdo_id);

-- 3. Historial de cambios.
create table if not exists public.comite_sst_acuerdo_historial (
  id uuid primary key default gen_random_uuid(),
  acuerdo_id uuid not null references public.comite_sst_acuerdos(id) on delete cascade,
  estado_anterior text,
  estado_nuevo text,
  responsable_anterior text,
  responsable_nuevo text,
  fecha_anterior date,
  fecha_nueva date,
  observacion text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_comite_acuerdo_historial_acuerdo
on public.comite_sst_acuerdo_historial(acuerdo_id,changed_at desc);

-- 4. Mantener fecha de cierre.
create or replace function public.prepare_comite_sst_acuerdo_update()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.estado='CERRADO' and old.estado is distinct from 'CERRADO' then
    new.fecha_cierre := coalesce(new.fecha_cierre,current_date);
  elsif new.estado<>'CERRADO' and old.estado='CERRADO' then
    new.fecha_cierre := null;
  end if;

  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prepare_comite_sst_acuerdo_update on public.comite_sst_acuerdos;
create trigger trg_prepare_comite_sst_acuerdo_update
before update on public.comite_sst_acuerdos
for each row execute function public.prepare_comite_sst_acuerdo_update();

-- 5. Historial automático.
create or replace function public.log_comite_sst_acuerdo_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if
    old.estado is distinct from new.estado
    or old.responsable is distinct from new.responsable
    or old.fecha_cumplimiento is distinct from new.fecha_cumplimiento
    or old.accion is distinct from new.accion
  then
    insert into public.comite_sst_acuerdo_historial(
      acuerdo_id,
      estado_anterior,
      estado_nuevo,
      responsable_anterior,
      responsable_nuevo,
      fecha_anterior,
      fecha_nueva,
      observacion,
      changed_by
    )
    values(
      new.id,
      old.estado,
      new.estado,
      old.responsable,
      new.responsable,
      old.fecha_cumplimiento,
      new.fecha_cumplimiento,
      new.observacion,
      auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_comite_sst_acuerdo_change on public.comite_sst_acuerdos;
create trigger trg_log_comite_sst_acuerdo_change
after update on public.comite_sst_acuerdos
for each row execute function public.log_comite_sst_acuerdo_change();

-- 6. RLS - evidencias.
alter table public.comite_sst_acuerdo_evidencias enable row level security;
alter table public.comite_sst_acuerdo_historial enable row level security;

drop policy if exists comite_acuerdo_evidencias_select on public.comite_sst_acuerdo_evidencias;
create policy comite_acuerdo_evidencias_select
on public.comite_sst_acuerdo_evidencias
for select to authenticated
using (
  exists (
    select 1
    from public.comite_sst_acuerdos a
    join public.comites_sst c on c.id=a.comite_id
    where a.id=acuerdo_id
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

drop policy if exists comite_acuerdo_evidencias_manage on public.comite_sst_acuerdo_evidencias;
create policy comite_acuerdo_evidencias_manage
on public.comite_sst_acuerdo_evidencias
for all to authenticated
using (
  exists (
    select 1
    from public.comite_sst_acuerdos a
    join public.comites_sst c on c.id=a.comite_id
    where a.id=acuerdo_id
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
    select 1
    from public.comite_sst_acuerdos a
    join public.comites_sst c on c.id=a.comite_id
    where a.id=acuerdo_id
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

drop policy if exists comite_acuerdo_historial_select on public.comite_sst_acuerdo_historial;
create policy comite_acuerdo_historial_select
on public.comite_sst_acuerdo_historial
for select to authenticated
using (
  exists (
    select 1
    from public.comite_sst_acuerdos a
    join public.comites_sst c on c.id=a.comite_id
    where a.id=acuerdo_id
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

grant select,insert,update,delete on public.comite_sst_acuerdo_evidencias to authenticated;
grant select on public.comite_sst_acuerdo_historial to authenticated;

-- 7. Storage para evidencias.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'comite-sst-acuerdos',
  'comite-sst-acuerdos',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
set public=true,
    file_size_limit=8388608,
    allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists comite_sst_acuerdos_storage_select on storage.objects;
create policy comite_sst_acuerdos_storage_select
on storage.objects
for select to public
using (bucket_id='comite-sst-acuerdos');

drop policy if exists comite_sst_acuerdos_storage_insert on storage.objects;
create policy comite_sst_acuerdos_storage_insert
on storage.objects
for insert to authenticated
with check (bucket_id='comite-sst-acuerdos');

drop policy if exists comite_sst_acuerdos_storage_update on storage.objects;
create policy comite_sst_acuerdos_storage_update
on storage.objects
for update to authenticated
using (bucket_id='comite-sst-acuerdos')
with check (bucket_id='comite-sst-acuerdos');

drop policy if exists comite_sst_acuerdos_storage_delete on storage.objects;
create policy comite_sst_acuerdos_storage_delete
on storage.objects
for delete to authenticated
using (bucket_id='comite-sst-acuerdos');

select 'Etapa 16C aplicada correctamente' as resultado;
