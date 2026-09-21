-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 6 · PARTICIPANTES DE LA CAPACITACIÓN
-- ============================================================

-- 1) Ampliar las clasificaciones para alinearlas con el formato corporativo.
alter table public.capacitaciones
  drop constraint if exists capacitaciones_clasificacion_check;

alter table public.capacitaciones
  add constraint capacitaciones_clasificacion_check
  check (clasificacion in (
    'INDUCCIÓN',
    'CAPACITACIÓN',
    'ENTRENAMIENTO',
    'SIMULACRO DE EMERGENCIA',
    'VISITANTES',
    'RE-INDUCCIÓN',
    'CAMBIO DE PUESTO',
    'REUNIÓN',
    'OTROS',
    'CHARLA',
    'TALLER'
  ));

-- 2) Participantes. Se guarda una fotografía histórica de los datos del trabajador
-- para que el registro no cambie si posteriormente se modifica su puesto o área.
create table if not exists public.capacitacion_participantes (
    id uuid primary key default gen_random_uuid(),

    capacitacion_id uuid not null
      references public.capacitaciones(id)
      on delete cascade,

    trabajador_id uuid not null
      references public.trabajadores(id)
      on delete restrict,

    dni varchar(8) not null,
    apellidos_nombres text not null,
    puesto text not null,
    area text not null,

    -- La firma se captura en la plataforma. En una etapa posterior puede migrarse a Storage.
    firma text,
    fecha_firma timestamptz,

    -- Se deja preparada para la etapa de examen.
    nota numeric(5,2),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint capacitacion_participantes_dni_chk
      check (dni ~ '^[0-9]{8}$'),

    constraint capacitacion_participantes_nota_chk
      check (nota is null or (nota >= 0 and nota <= 20)),

    constraint capacitacion_participantes_unico
      unique (capacitacion_id, trabajador_id)
);

create index if not exists idx_cap_part_capacitacion
  on public.capacitacion_participantes(capacitacion_id);

create index if not exists idx_cap_part_trabajador
  on public.capacitacion_participantes(trabajador_id);

create index if not exists idx_cap_part_dni
  on public.capacitacion_participantes(dni);

-- Actualizar updated_at automáticamente.
drop trigger if exists trg_capacitacion_participantes_updated_at
  on public.capacitacion_participantes;

create trigger trg_capacitacion_participantes_updated_at
before update on public.capacitacion_participantes
for each row
execute function public.actualizar_updated_at();

-- 3) Funciones auxiliares de acceso a una capacitación concreta.
create or replace function public.can_view_training(p_capacitacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.capacitaciones c
    where c.id = p_capacitacion_id
      and (
        public.can_view_all_projects()
        or (
          c.proyecto_id is not null
          and public.has_project_access(c.proyecto_id)
        )
      )
  );
$$;

create or replace function public.can_manage_training(p_capacitacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.capacitaciones c
    where c.id = p_capacitacion_id
      and (
        public.is_admin()
        or (
          c.proyecto_id is not null
          and public.can_manage_project(c.proyecto_id)
        )
      )
  );
$$;

revoke all on function public.can_view_training(uuid) from public;
revoke all on function public.can_manage_training(uuid) from public;
grant execute on function public.can_view_training(uuid) to authenticated;
grant execute on function public.can_manage_training(uuid) to authenticated;

-- 4) Row Level Security.
alter table public.capacitacion_participantes enable row level security;

drop policy if exists capacitacion_participantes_select
  on public.capacitacion_participantes;
drop policy if exists capacitacion_participantes_insert
  on public.capacitacion_participantes;
drop policy if exists capacitacion_participantes_update
  on public.capacitacion_participantes;
drop policy if exists capacitacion_participantes_delete
  on public.capacitacion_participantes;

create policy capacitacion_participantes_select
on public.capacitacion_participantes
for select
to authenticated
using (public.can_view_training(capacitacion_id));

create policy capacitacion_participantes_insert
on public.capacitacion_participantes
for insert
to authenticated
with check (public.can_manage_training(capacitacion_id));

create policy capacitacion_participantes_update
on public.capacitacion_participantes
for update
to authenticated
using (public.can_manage_training(capacitacion_id))
with check (public.can_manage_training(capacitacion_id));

create policy capacitacion_participantes_delete
on public.capacitacion_participantes
for delete
to authenticated
using (public.can_manage_training(capacitacion_id));

revoke all on table public.capacitacion_participantes from anon;
grant select, insert, update, delete
  on table public.capacitacion_participantes
  to authenticated;

select
  'Etapa 6 creada correctamente' as resultado,
  count(*) as participantes_registrados
from public.capacitacion_participantes;
