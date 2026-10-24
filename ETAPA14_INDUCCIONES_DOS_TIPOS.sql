-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 14 - INDUCCIONES: SEDE LIMA Y PROYECTOS
-- ============================================================

create sequence if not exists public.induccion_codigo_seq start 1;

create table if not exists public.inducciones (
    id uuid primary key default gen_random_uuid(),
    codigo text not null unique,
    tipo text not null check (tipo in ('LIMA','PROYECTO')),
    titulo text not null,
    descripcion text,
    sede_id uuid references public.sedes(id) on delete set null,
    proyecto_id uuid references public.proyectos(id) on delete set null,
    fecha date not null default current_date,
    nota_minima numeric(4,2) not null default 14 check (nota_minima between 0 and 20),
    estado text not null default 'BORRADOR' check (estado in ('BORRADOR','ACTIVA','CERRADA')),
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint inducciones_tipo_unidad_check check (
      (tipo='LIMA' and sede_id is not null and proyecto_id is null)
      or
      (tipo='PROYECTO' and proyecto_id is not null and sede_id is null)
    )
);

create index if not exists idx_inducciones_tipo on public.inducciones(tipo);
create index if not exists idx_inducciones_proyecto on public.inducciones(proyecto_id);
create index if not exists idx_inducciones_sede on public.inducciones(sede_id);

create or replace function public.asignar_codigo_induccion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.codigo is null or btrim(new.codigo) = '' then
    new.codigo := 'IND-' || to_char(current_date,'YYYY') || '-' ||
                  lpad(nextval('public.induccion_codigo_seq')::text,5,'0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_induccion_codigo on public.inducciones;
create trigger trg_induccion_codigo
before insert on public.inducciones
for each row execute function public.asignar_codigo_induccion();

drop trigger if exists trg_inducciones_updated_at on public.inducciones;
create trigger trg_inducciones_updated_at
before update on public.inducciones
for each row execute function public.actualizar_updated_at();

alter table public.inducciones enable row level security;

drop policy if exists inducciones_select on public.inducciones;
drop policy if exists inducciones_insert on public.inducciones;
drop policy if exists inducciones_update on public.inducciones;
drop policy if exists inducciones_delete on public.inducciones;

create policy inducciones_select
on public.inducciones
for select to authenticated
using (
  public.is_admin()
  or public.can_view_all_projects()
  or (tipo='PROYECTO' and proyecto_id is not null and public.has_project_access(proyecto_id))
);

create policy inducciones_insert
on public.inducciones
for insert to authenticated
with check (
  public.is_admin()
  or (
    tipo='PROYECTO'
    and proyecto_id is not null
    and public.can_manage_project(proyecto_id)
  )
);

create policy inducciones_update
on public.inducciones
for update to authenticated
using (
  public.is_admin()
  or (
    tipo='PROYECTO'
    and proyecto_id is not null
    and public.can_manage_project(proyecto_id)
  )
)
with check (
  public.is_admin()
  or (
    tipo='PROYECTO'
    and proyecto_id is not null
    and public.can_manage_project(proyecto_id)
  )
);

create policy inducciones_delete
on public.inducciones
for delete to authenticated
using (
  public.is_admin()
  or (
    tipo='PROYECTO'
    and proyecto_id is not null
    and public.can_manage_project(proyecto_id)
  )
);

grant select, insert, update, delete on table public.inducciones to authenticated;
grant usage, select on sequence public.induccion_codigo_seq to authenticated;

select 'Etapa 14 - Inducciones aplicada correctamente' as resultado;
