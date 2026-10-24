-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 13C - RETIRAR COMPROBACIÓN INMEDIATA
-- ============================================================

-- Desde esta versión, las evaluaciones no muestran corrección
-- durante el desarrollo del cuestionario. La retroalimentación se
-- entrega únicamente después de finalizar la evaluación.

update public.evaluaciones_practica
set mostrar_correcta_inmediata = false
where mostrar_correcta_inmediata = true;

select 'Etapa 13C aplicada correctamente' as resultado;
