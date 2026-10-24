-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 16D.1
-- CAPACITACIONES DEL COMITÉ / SUBCOMITÉ SST + VIDEOS
-- ============================================================

create sequence if not exists public.comite_sst_capacitacion_codigo_seq start 1;

-- ------------------------------------------------------------
-- 1. Cabecera de la capacitación
-- ------------------------------------------------------------
create table if not exists public.comite_sst_capacitaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  comite_id uuid not null references public.comites_sst(id) on delete cascade,
  titulo text not null,
  descripcion text,
  objetivo text,
  expositor text not null,
  cargo_expositor text,
  fecha date not null,
  duracion_horas numeric(5,2) not null default 1
    check (duracion_horas > 0 and duracion_horas <= 100),
  nota_minima numeric(4,2) not null default 16
    check (nota_minima >= 0 and nota_minima <= 20),
  max_intentos integer not null default 2
    check (max_intentos >= 1 and max_intentos <= 10),
  estado text not null default 'BORRADOR'
    check (estado in ('BORRADOR','LISTA','INACTIVA')),
  public_token uuid not null default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_comite_sst_capacitaciones_public_token
on public.comite_sst_capacitaciones(public_token);

create index if not exists idx_comite_sst_capacitaciones_comite
on public.comite_sst_capacitaciones(comite_id);

create index if not exists idx_comite_sst_capacitaciones_fecha
on public.comite_sst_capacitaciones(fecha desc);

create index if not exists idx_comite_sst_capacitaciones_estado
on public.comite_sst_capacitaciones(estado);

-- ------------------------------------------------------------
-- 2. Videos / contenidos audiovisuales
-- ------------------------------------------------------------
create table if not exists public.comite_sst_capacitacion_videos (
  id uuid primary key default gen_random_uuid(),
  capacitacion_id uuid not null
    references public.comite_sst_capacitaciones(id) on delete cascade,
  orden integer not null default 1 check (orden >= 1),
  titulo text not null,
  descripcion text,
  tipo_fuente text not null
    check (tipo_fuente in ('YOUTUBE','MP4_UPLOAD','ENLACE')),
  url text,
  storage_path text,
  duracion_minutos numeric(7,2)
    check (duracion_minutos is null or duracion_minutos > 0),
  obligatorio boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_comite_sst_video_fuente check (
    (tipo_fuente='MP4_UPLOAD' and storage_path is not null)
    or
    (tipo_fuente in ('YOUTUBE','ENLACE') and url is not null)
  )
);

create index if not exists idx_comite_sst_capacitacion_videos_capacitacion
on public.comite_sst_capacitacion_videos(capacitacion_id,orden);

-- ------------------------------------------------------------
-- 3. Código automático
-- Ejemplos:
-- CAP-CSST-2026-0001
-- CAP-SCSST-2026-0002
-- ------------------------------------------------------------
create or replace function public.set_comite_sst_capacitacion_codigo()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_tipo text;
begin
  if new.codigo is null or btrim(new.codigo)='' then
    select tipo into v_tipo
    from public.comites_sst
    where id=new.comite_id
    limit 1;

    new.codigo :=
      'CAP-'
      || case when v_tipo='SUBCOMITE' then 'SCSST' else 'CSST' end
      || '-'
      || extract(year from new.fecha)::int::text
      || '-'
      || lpad(nextval('public.comite_sst_capacitacion_codigo_seq')::text,4,'0');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_comite_sst_capacitacion_codigo
on public.comite_sst_capacitaciones;

create trigger trg_set_comite_sst_capacitacion_codigo
before insert on public.comite_sst_capacitaciones
for each row execute function public.set_comite_sst_capacitacion_codigo();

-- ------------------------------------------------------------
-- 4. Updated at
-- ------------------------------------------------------------
create or replace function public.touch_comite_sst_capacitacion_updated_at()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_touch_comite_sst_capacitaciones
on public.comite_sst_capacitaciones;

create trigger trg_touch_comite_sst_capacitaciones
before update on public.comite_sst_capacitaciones
for each row execute function public.touch_comite_sst_capacitacion_updated_at();

drop trigger if exists trg_touch_comite_sst_capacitacion_videos
on public.comite_sst_capacitacion_videos;

create trigger trg_touch_comite_sst_capacitacion_videos
before update on public.comite_sst_capacitacion_videos
for each row execute function public.touch_comite_sst_capacitacion_updated_at();

-- ============================================================
-- 5. RLS - CAPACITACIONES
-- ============================================================
alter table public.comite_sst_capacitaciones enable row level security;
alter table public.comite_sst_capacitacion_videos enable row level security;

drop policy if exists comite_sst_capacitaciones_select
on public.comite_sst_capacitaciones;

create policy comite_sst_capacitaciones_select
on public.comite_sst_capacitaciones
for select to authenticated
using (
  exists (
    select 1
    from public.comites_sst c
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

drop policy if exists comite_sst_capacitaciones_insert
on public.comite_sst_capacitaciones;

create policy comite_sst_capacitaciones_insert
on public.comite_sst_capacitaciones
for insert to authenticated
with check (
  exists (
    select 1
    from public.comites_sst c
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

drop policy if exists comite_sst_capacitaciones_update
on public.comite_sst_capacitaciones;

create policy comite_sst_capacitaciones_update
on public.comite_sst_capacitaciones
for update to authenticated
using (
  exists (
    select 1
    from public.comites_sst c
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
    select 1
    from public.comites_sst c
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

drop policy if exists comite_sst_capacitaciones_delete
on public.comite_sst_capacitaciones;

create policy comite_sst_capacitaciones_delete
on public.comite_sst_capacitaciones
for delete to authenticated
using (
  exists (
    select 1
    from public.comites_sst c
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

-- ============================================================
-- 6. RLS - VIDEOS
-- ============================================================
drop policy if exists comite_sst_capacitacion_videos_select
on public.comite_sst_capacitacion_videos;

create policy comite_sst_capacitacion_videos_select
on public.comite_sst_capacitacion_videos
for select to authenticated
using (
  exists (
    select 1
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id=capacitacion_id
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

drop policy if exists comite_sst_capacitacion_videos_insert
on public.comite_sst_capacitacion_videos;

create policy comite_sst_capacitacion_videos_insert
on public.comite_sst_capacitacion_videos
for insert to authenticated
with check (
  exists (
    select 1
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id=capacitacion_id
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

drop policy if exists comite_sst_capacitacion_videos_update
on public.comite_sst_capacitacion_videos;

create policy comite_sst_capacitacion_videos_update
on public.comite_sst_capacitacion_videos
for update to authenticated
using (
  exists (
    select 1
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id=capacitacion_id
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
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id=capacitacion_id
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

drop policy if exists comite_sst_capacitacion_videos_delete
on public.comite_sst_capacitacion_videos;

create policy comite_sst_capacitacion_videos_delete
on public.comite_sst_capacitacion_videos
for delete to authenticated
using (
  exists (
    select 1
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id=capacitacion_id
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

grant select,insert,update,delete
on public.comite_sst_capacitaciones
to authenticated;

grant select,insert,update,delete
on public.comite_sst_capacitacion_videos
to authenticated;

grant usage,select
on sequence public.comite_sst_capacitacion_codigo_seq
to authenticated;

-- ============================================================
-- 7. STORAGE PRIVADO PARA VIDEOS MP4
-- Para archivos grandes se recomienda usar YouTube no listado
-- o enlace externo. El upload directo se limitará en la UI.
-- ============================================================
insert into storage.buckets(
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values(
  'comite-sst-capacitaciones',
  'comite-sst-capacitaciones',
  false,
  52428800,
  array['video/mp4']
)
on conflict (id) do update
set public=false,
    file_size_limit=52428800,
    allowed_mime_types=array['video/mp4'];

drop policy if exists comite_sst_capacitaciones_storage_select
on storage.objects;

create policy comite_sst_capacitaciones_storage_select
on storage.objects
for select to authenticated
using (
  bucket_id='comite-sst-capacitaciones'
  and exists (
    select 1
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id::text=(storage.foldername(name))[1]
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

drop policy if exists comite_sst_capacitaciones_storage_insert
on storage.objects;

create policy comite_sst_capacitaciones_storage_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id='comite-sst-capacitaciones'
  and exists (
    select 1
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id::text=(storage.foldername(name))[1]
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

drop policy if exists comite_sst_capacitaciones_storage_update
on storage.objects;

create policy comite_sst_capacitaciones_storage_update
on storage.objects
for update to authenticated
using (
  bucket_id='comite-sst-capacitaciones'
  and exists (
    select 1
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id::text=(storage.foldername(name))[1]
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
  bucket_id='comite-sst-capacitaciones'
);

drop policy if exists comite_sst_capacitaciones_storage_delete
on storage.objects;

create policy comite_sst_capacitaciones_storage_delete
on storage.objects
for delete to authenticated
using (
  bucket_id='comite-sst-capacitaciones'
  and exists (
    select 1
    from public.comite_sst_capacitaciones cap
    join public.comites_sst c on c.id=cap.comite_id
    where cap.id::text=(storage.foldername(name))[1]
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

select 'Etapa 16D.1 aplicada correctamente' as resultado;
