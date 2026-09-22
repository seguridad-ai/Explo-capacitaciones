-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 9 · PROGRAMACIÓN DE CAPACITACIONES
-- ============================================================
-- Agrega campos de horario y seguimiento a capacitaciones.
-- También amplía los estados para manejar reprogramaciones.
-- ============================================================

-- 1) Campos de programación.
alter table public.capacitaciones
  add column if not exists hora_inicio time,
  add column if not exists hora_fin time,
  add column if not exists observacion_programacion text,
  add column if not exists fecha_programacion_anterior date,
  add column if not exists ultima_reprogramacion timestamptz;

-- 2) Normalizar el estado EN_CURSO de etapas anteriores.
alter table public.capacitaciones
  drop constraint if exists capacitaciones_estado_check;

update public.capacitaciones
set estado = 'EN CURSO'
where estado = 'EN_CURSO';

alter table public.capacitaciones
  add constraint capacitaciones_estado_check
  check (estado in (
    'BORRADOR',
    'PROGRAMADA',
    'REPROGRAMADA',
    'EN CURSO',
    'FINALIZADA',
    'CANCELADA'
  ));

-- 3) Validación básica de horario.
alter table public.capacitaciones
  drop constraint if exists capacitaciones_horario_check;

alter table public.capacitaciones
  add constraint capacitaciones_horario_check
  check (
    hora_inicio is null
    or hora_fin is null
    or hora_fin > hora_inicio
  );

-- 4) Índices para calendario y filtros.
create index if not exists idx_capacitaciones_fecha_estado
  on public.capacitaciones(fecha, estado);

create index if not exists idx_capacitaciones_horario
  on public.capacitaciones(fecha, hora_inicio);

-- 5) Verificación.
select
  'Etapa 9 aplicada correctamente' as resultado,
  count(*) as capacitaciones_registradas
from public.capacitaciones;
