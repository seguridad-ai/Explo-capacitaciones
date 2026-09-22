-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 9B · HISTORIAL DE CAPACITACIONES Y ESTADO ACTIVO
-- ============================================================
-- Objetivo:
--  1) La fecha queda como dato del registro, NO como vencimiento.
--  2) Se eliminan las reglas de hora de inicio / fin.
--  3) La capacitación permanece ACTIVA hasta que un responsable la finalice.
--  4) Se simplifican los estados para el seguimiento documental.
-- ============================================================

-- Normalizar los estados creados en la etapa anterior.
alter table public.capacitaciones
  drop constraint if exists capacitaciones_estado_check;

update public.capacitaciones
set estado = 'ACTIVA'
where upper(coalesce(estado,'')) in ('PROGRAMADA','REPROGRAMADA','EN CURSO','EN_CURSO');

alter table public.capacitaciones
  add constraint capacitaciones_estado_check
  check (estado in ('BORRADOR','ACTIVA','FINALIZADA','CANCELADA'));

-- La aplicación ya no utiliza horarios. Se conservan las columnas solamente
-- por compatibilidad histórica, pero se limpian y se quita su validación.
alter table public.capacitaciones
  drop constraint if exists capacitaciones_horario_check;

drop index if exists public.idx_capacitaciones_horario;

update public.capacitaciones
set hora_inicio = null,
    hora_fin = null
where hora_inicio is not null or hora_fin is not null;

-- Índices orientados al historial / filtros.
create index if not exists idx_capacitaciones_estado_fecha
  on public.capacitaciones(estado, fecha desc);

create index if not exists idx_capacitaciones_tema_lower
  on public.capacitaciones(lower(tema));

select
  'Etapa 9B aplicada correctamente' as resultado,
  count(*) filter (where estado = 'ACTIVA') as activas,
  count(*) filter (where estado = 'FINALIZADA') as finalizadas,
  count(*) as total_capacitaciones
from public.capacitaciones;
