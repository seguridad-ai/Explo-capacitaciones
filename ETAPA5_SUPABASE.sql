-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 5 · NUEVA CAPACITACIÓN
-- Crear la tabla de cabecera de capacitaciones y sus políticas
-- ============================================================

create sequence if not exists public.capacitaciones_codigo_seq;

create table if not exists public.capacitaciones (
    id uuid primary key default gen_random_uuid(),
    codigo text unique,

    clasificacion text not null
        check (clasificacion in ('CAPACITACIÓN','CHARLA','ENTRENAMIENTO','TALLER','INDUCCIÓN')),

    sede_id uuid references public.sedes(id) on delete restrict,
    proyecto_id uuid references public.proyectos(id) on delete restrict,

    tema text not null,

    expositor_nombre text not null,
    expositor_dni varchar(8) not null,
    expositor_cargo text not null,
    empresa text not null default 'EXPLO DRILLING PERU S.R.L.',
    area text not null,

    fecha date not null,
    tiempo_texto text not null,

    firma_expositor text not null,

    responsable_nombre text not null,
    responsable_cargo text not null,
    responsable_dni varchar(8) not null,
    firma_responsable text not null,

    estado text not null default 'BORRADOR'
        check (estado in ('BORRADOR','PROGRAMADA','EN_CURSO','FINALIZADA','CANCELADA')),

    created_by uuid not null references public.profiles(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint capacitaciones_ubicacion_chk
        check (num_nonnulls(sede_id, proyecto_id) = 1),

    constraint capacitaciones_expositor_dni_chk
        check (expositor_dni ~ '^[0-9]{8}$'),

    constraint capacitaciones_responsable_dni_chk
        check (responsable_dni ~ '^[0-9]{8}$')
);

create or replace function public.generar_codigo_capacitacion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if new.codigo is null or btrim(new.codigo) = '' then
        new.codigo := 'CAP-' || to_char(coalesce(new.fecha, current_date), 'YYYY') || '-' ||
                      lpad(nextval('public.capacitaciones_codigo_seq')::text, 5, '0');
    end if;
    return new;
end;
$$;

drop trigger if exists trg_capacitaciones_codigo on public.capacitaciones;
create trigger trg_capacitaciones_codigo
before insert on public.capacitaciones
for each row execute function public.generar_codigo_capacitacion();

drop trigger if exists trg_capacitaciones_updated_at on public.capacitaciones;
create trigger trg_capacitaciones_updated_at
before update on public.capacitaciones
for each row execute function public.actualizar_updated_at();

create index if not exists idx_capacitaciones_fecha on public.capacitaciones(fecha);
create index if not exists idx_capacitaciones_sede on public.capacitaciones(sede_id);
create index if not exists idx_capacitaciones_proyecto on public.capacitaciones(proyecto_id);
create index if not exists idx_capacitaciones_estado on public.capacitaciones(estado);
create index if not exists idx_capacitaciones_created_by on public.capacitaciones(created_by);

alter table public.capacitaciones enable row level security;

drop policy if exists capacitaciones_select on public.capacitaciones;
drop policy if exists capacitaciones_insert on public.capacitaciones;
drop policy if exists capacitaciones_update on public.capacitaciones;
drop policy if exists capacitaciones_delete on public.capacitaciones;

-- ADMIN y GERENCIA pueden visualizar todo.
-- Usuario PROYECTO solamente visualiza actividades de proyectos asignados.
create policy capacitaciones_select
on public.capacitaciones
for select
to authenticated
using (
    public.can_view_all_projects()
    or (
        proyecto_id is not null
        and public.has_project_access(proyecto_id)
    )
);

-- ADMIN puede registrar en sede o proyecto.
-- Usuario PROYECTO solamente registra en proyectos asignados.
create policy capacitaciones_insert
on public.capacitaciones
for insert
to authenticated
with check (
    public.is_admin()
    or (
        proyecto_id is not null
        and public.can_manage_project(proyecto_id)
    )
);

create policy capacitaciones_update
on public.capacitaciones
for update
to authenticated
using (
    public.is_admin()
    or (
        proyecto_id is not null
        and public.can_manage_project(proyecto_id)
    )
)
with check (
    public.is_admin()
    or (
        proyecto_id is not null
        and public.can_manage_project(proyecto_id)
    )
);

-- Para conservar trazabilidad, solo ADMIN puede eliminar físicamente.
create policy capacitaciones_delete
on public.capacitaciones
for delete
to authenticated
using (public.is_admin());

revoke all on table public.capacitaciones from anon;
grant select, insert, update, delete on table public.capacitaciones to authenticated;

grant usage, select on sequence public.capacitaciones_codigo_seq to authenticated;

select
  'Etapa 5 creada correctamente' as resultado,
  count(*) as capacitaciones_registradas
from public.capacitaciones;
