-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 13D - ELIMINAR CAPACITACIONES ACTIVAS Y BORRADORES
-- ============================================================

create or replace function public.eliminar_capacitacion(
  p_capacitacion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap public.capacitaciones%rowtype;
  v_estado text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Sesión no válida.');
  end if;

  select *
    into v_cap
  from public.capacitaciones
  where id = p_capacitacion_id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La capacitación no existe.');
  end if;

  v_estado := upper(coalesce(v_cap.estado, 'BORRADOR'));

  -- Por solicitud del sistema, la eliminación directa queda limitada
  -- a capacitaciones ACTIVAS o BORRADORES.
  if v_estado not in ('ACTIVA', 'BORRADOR', 'PROGRAMADA', 'REPROGRAMADA', 'EN CURSO') then
    return jsonb_build_object(
      'ok', false,
      'error', 'Solo se pueden eliminar capacitaciones activas o en borrador.'
    );
  end if;

  -- Permisos:
  -- ADMIN: cualquier capacitación.
  -- PROYECTO: solo capacitaciones de un proyecto que administra.
  if not (
    public.is_admin()
    or (
      v_cap.proyecto_id is not null
      and public.can_manage_project(v_cap.proyecto_id)
    )
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'No tienes permiso para eliminar esta capacitación.'
    );
  end if;

  -- Evaluaciones de práctica que estén vinculadas a esta capacitación
  -- no se eliminan: su FK está configurada ON DELETE SET NULL.

  -- Respuestas de examen
  delete from public.examen_respuestas
  where intento_id in (
    select i.id
    from public.examen_intentos i
    join public.examenes e on e.id = i.examen_id
    where e.capacitacion_id = p_capacitacion_id
  );

  -- Intentos del examen
  delete from public.examen_intentos
  where examen_id in (
    select id
    from public.examenes
    where capacitacion_id = p_capacitacion_id
  );

  -- Opciones
  delete from public.examen_opciones
  where pregunta_id in (
    select q.id
    from public.examen_preguntas q
    join public.examenes e on e.id = q.examen_id
    where e.capacitacion_id = p_capacitacion_id
  );

  -- Preguntas
  delete from public.examen_preguntas
  where examen_id in (
    select id
    from public.examenes
    where capacitacion_id = p_capacitacion_id
  );

  -- Examen
  delete from public.examenes
  where capacitacion_id = p_capacitacion_id;

  -- Participantes, firmas y notas asociadas
  delete from public.capacitacion_participantes
  where capacitacion_id = p_capacitacion_id;

  -- Capacitación
  delete from public.capacitaciones
  where id = p_capacitacion_id;

  return jsonb_build_object(
    'ok', true,
    'codigo', v_cap.codigo,
    'tema', v_cap.tema,
    'message', 'Capacitación eliminada definitivamente.'
  );

exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', SQLERRM
    );
end;
$$;

revoke all on function public.eliminar_capacitacion(uuid) from public;
grant execute on function public.eliminar_capacitacion(uuid) to authenticated;

select 'Etapa 13D aplicada correctamente' as resultado;
