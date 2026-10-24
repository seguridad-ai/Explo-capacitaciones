-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 14D
-- REGISTRO CONSOLIDADO DE INDUCCIÓN EN PDF
-- ============================================================
-- Devuelve:
--  * datos de la inducción
--  * firma digital del expositor
--  * TODOS los participantes registrados mediante el link
--  * firma digital de cada participante
-- No exige que el participante haya aprobado o terminado el examen.
-- ============================================================

create or replace function public.obtener_registro_induccion(
  p_induccion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ind public.inducciones%rowtype;
  v_sede text;
  v_participantes jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  select *
  into v_ind
  from public.inducciones
  where id=p_induccion_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','La inducción no existe.');
  end if;

  if not (
    public.is_admin()
    or public.can_view_all_projects()
    or (v_ind.proyecto_id is not null and public.has_project_access(v_ind.proyecto_id))
  ) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para descargar este registro.');
  end if;

  select nombre
  into v_sede
  from public.sedes
  where id=v_ind.sede_id
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',p.id,
        'dni',p.dni,
        'nombre',p.nombre,
        'fecha_ingreso',p.fecha_ingreso,
        'puesto',p.puesto,
        'area',p.area,
        'firma',p.firma,
        'estado',p.estado,
        'nota',p.nota,
        'registered_at',p.registered_at,
        'completado_at',p.completado_at
      )
      order by p.registered_at asc, p.nombre asc
    ),
    '[]'::jsonb
  )
  into v_participantes
  from public.induccion_participantes p
  where p.induccion_id=v_ind.id
    and p.dni is not null;

  return jsonb_build_object(
    'ok',true,
    'induccion',jsonb_build_object(
      'id',v_ind.id,
      'codigo',v_ind.codigo,
      'tipo',v_ind.tipo,
      'empresa',coalesce(nullif(btrim(v_ind.empresa),''),'EXPLO DRILLING PERU S.R.L.'),
      'contratista',coalesce(nullif(btrim(v_ind.contratista),''),'N.A.'),
      'sede_nombre',coalesce(v_sede,'Lima'),
      'distrito',v_ind.distrito,
      'provincia',v_ind.provincia,
      'tema',coalesce(v_ind.tema,v_ind.titulo),
      'expositor',v_ind.expositor,
      'expositor_cargo',v_ind.expositor_cargo,
      'expositor_dni',v_ind.expositor_dni,
      'firma_expositor',v_ind.firma_expositor,
      'fecha',v_ind.fecha,
      'area',v_ind.area,
      'tiempo_horas',v_ind.tiempo_horas,
      'estado',v_ind.estado
    ),
    'participantes',v_participantes
  );
exception
  when others then
    return jsonb_build_object('ok',false,'error',SQLERRM);
end;
$$;

revoke all on function public.obtener_registro_induccion(uuid) from public;
grant execute on function public.obtener_registro_induccion(uuid) to authenticated;

select 'Etapa 14D aplicada correctamente' as resultado;
