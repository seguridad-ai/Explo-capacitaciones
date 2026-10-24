-- Verificación rápida de dependencias de Planificación.
select
  to_regclass('public.planificacion_proyectos') as planificacion_proyectos,
  to_regclass('public.planificacion_pendientes') as planificacion_pendientes,
  to_regclass('public.planificacion_pendiente_seguimientos') as planificacion_pendiente_seguimientos,
  to_regclass('public.planificacion_recurrencias') as planificacion_recurrencias,
  to_regclass('public.planificacion_enlaces_publicos') as planificacion_enlaces_publicos,
  to_regclass('public.planificacion_sugerencias_publicas') as planificacion_sugerencias_publicas;
