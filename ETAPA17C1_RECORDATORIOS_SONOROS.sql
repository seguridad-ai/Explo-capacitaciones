-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 17C.1 - RECORDATORIOS SONOROS DE PENDIENTES
-- ============================================================

-- 1. Configuración individual por pendiente.
alter table public.planificacion_pendientes
  add column if not exists recordatorios_habilitados boolean not null default true,
  add column if not exists recordatorios_minutos integer[] not null default array[60,30,10,0]::integer[],
  add column if not exists pospuesto_hasta timestamptz;

-- 2. Preferencias personales de aviso.
create table if not exists public.planificacion_preferencias_usuario (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  sonido_habilitado boolean not null default true,
  sonido_codigo text not null default 'BANCO'
    check (sonido_codigo in ('BANCO','CAMPANA','SUAVE','SIN_SONIDO')),
  volumen numeric(4,3) not null default 0.55
    check (volumen >= 0 and volumen <= 1),
  notificacion_navegador boolean not null default false,
  minutos_default integer[] not null default array[60,30,10,0]::integer[],
  updated_at timestamptz not null default now()
);

alter table public.planificacion_preferencias_usuario enable row level security;

drop policy if exists planificacion_preferencias_select
on public.planificacion_preferencias_usuario;

create policy planificacion_preferencias_select
on public.planificacion_preferencias_usuario
for select to authenticated
using (profile_id=auth.uid());

drop policy if exists planificacion_preferencias_insert
on public.planificacion_preferencias_usuario;

create policy planificacion_preferencias_insert
on public.planificacion_preferencias_usuario
for insert to authenticated
with check (profile_id=auth.uid());

drop policy if exists planificacion_preferencias_update
on public.planificacion_preferencias_usuario;

create policy planificacion_preferencias_update
on public.planificacion_preferencias_usuario
for update to authenticated
using (profile_id=auth.uid())
with check (profile_id=auth.uid());

grant select,insert,update
on public.planificacion_preferencias_usuario
to authenticated;

-- 3. Updated_at automático de preferencias.
create or replace function public.touch_planificacion_preferencias_usuario()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_touch_planificacion_preferencias_usuario
on public.planificacion_preferencias_usuario;

create trigger trg_touch_planificacion_preferencias_usuario
before update on public.planificacion_preferencias_usuario
for each row execute function public.touch_planificacion_preferencias_usuario();

select 'Etapa 17C.1 aplicada correctamente' as resultado;
