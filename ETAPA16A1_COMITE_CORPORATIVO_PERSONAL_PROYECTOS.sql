-- ============================================================
-- ETAPA 16A.1 - COMITÉ SST CORPORATIVO
-- ============================================================
-- COMITÉ SST:
--   admite cualquier trabajador ACTIVO de la Base de Trabajadores,
--   pertenezca a sede o a cualquier proyecto.
--
-- SUBCOMITÉ SST:
--   mantiene la validación por proyecto.
-- ============================================================

create or replace function public.buscar_trabajador_comite(
  p_comite_id uuid,
  p_dni text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.comites_sst%rowtype;
  v_w public.trabajadores%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  select * into v_c
  from public.comites_sst
  where id=p_comite_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','No se encontró el Comité/Subcomité.');
  end if;

  if not (
    public.is_admin()
    or (
      v_c.tipo='SUBCOMITE'
      and v_c.proyecto_id is not null
      and public.can_manage_project(v_c.proyecto_id)
    )
  ) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para gestionar integrantes.');
  end if;

  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok',false,'error','El DNI debe tener 8 dígitos.');
  end if;

  select * into v_w
  from public.trabajadores
  where dni=p_dni
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','El DNI no está registrado en la Base de Trabajadores.');
  end if;

  if not v_w.activo then
    return jsonb_build_object('ok',false,'error','El trabajador se encuentra inactivo.');
  end if;

  -- COMITÉ SST CORPORATIVO:
  -- NO se restringe por sede ni por proyecto.

  -- SUBCOMITÉ SST:
  -- el trabajador debe pertenecer al mismo proyecto.
  if v_c.tipo='SUBCOMITE'
     and v_w.proyecto_id is distinct from v_c.proyecto_id then
    return jsonb_build_object(
      'ok',false,
      'error','El trabajador no pertenece al proyecto de este Subcomité SST.'
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'trabajador',jsonb_build_object(
      'id',v_w.id,
      'dni',v_w.dni,
      'nombres',v_w.nombres,
      'apellidos',v_w.apellidos,
      'cargo',v_w.cargo,
      'area',v_w.area,
      'sede_id',v_w.sede_id,
      'proyecto_id',v_w.proyecto_id
    )
  );
end;
$$;

revoke all on function public.buscar_trabajador_comite(uuid,text) from public;
grant execute on function public.buscar_trabajador_comite(uuid,text) to authenticated;


create or replace function public.guardar_integrante_comite(
  p_integrante_id uuid,
  p_comite_id uuid,
  p_trabajador_id uuid,
  p_representacion text,
  p_condicion text,
  p_cargo_comite text,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_activo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.comites_sst%rowtype;
  v_w public.trabajadores%rowtype;
  v_m public.comite_sst_integrantes%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','Sesión no válida.');
  end if;

  select * into v_c
  from public.comites_sst
  where id=p_comite_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','No se encontró el Comité/Subcomité.');
  end if;

  if not (
    public.is_admin()
    or (
      v_c.tipo='SUBCOMITE'
      and v_c.proyecto_id is not null
      and public.can_manage_project(v_c.proyecto_id)
    )
  ) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para gestionar integrantes.');
  end if;

  select * into v_w
  from public.trabajadores
  where id=p_trabajador_id
  limit 1;

  if not found or not v_w.activo then
    return jsonb_build_object(
      'ok',false,
      'error','El trabajador no está disponible o se encuentra inactivo.'
    );
  end if;

  -- COMITÉ SST CORPORATIVO:
  -- se admite personal activo de sede y de todos los proyectos.

  -- SUBCOMITÉ SST:
  -- se mantiene la restricción por proyecto.
  if v_c.tipo='SUBCOMITE'
     and v_w.proyecto_id is distinct from v_c.proyecto_id then
    return jsonb_build_object(
      'ok',false,
      'error','El trabajador no pertenece al proyecto del Subcomité SST.'
    );
  end if;

  if p_representacion not in ('EMPLEADOR','TRABAJADORES') then
    return jsonb_build_object('ok',false,'error','Selecciona una representación válida.');
  end if;

  if p_condicion not in ('TITULAR','SUPLENTE') then
    return jsonb_build_object('ok',false,'error','Selecciona la condición Titular o Suplente.');
  end if;

  if btrim(coalesce(p_cargo_comite,''))='' then
    return jsonb_build_object('ok',false,'error','Selecciona o registra el cargo dentro del Comité.');
  end if;

  if p_fecha_inicio is null then
    return jsonb_build_object('ok',false,'error','Registra la fecha de inicio del integrante.');
  end if;

  if p_fecha_fin is not null and p_fecha_fin < p_fecha_inicio then
    return jsonb_build_object('ok',false,'error','La fecha de fin no puede ser anterior a la fecha de inicio.');
  end if;

  if p_integrante_id is null then
    if exists (
      select 1
      from public.comite_sst_integrantes
      where comite_id=p_comite_id
        and trabajador_id=p_trabajador_id
    ) then
      return jsonb_build_object(
        'ok',false,
        'error','El trabajador ya se encuentra registrado en este Comité/Subcomité.'
      );
    end if;

    insert into public.comite_sst_integrantes(
      comite_id,trabajador_id,representacion,condicion,cargo_comite,
      fecha_inicio,fecha_fin,activo
    )
    values(
      p_comite_id,p_trabajador_id,p_representacion,p_condicion,btrim(p_cargo_comite),
      p_fecha_inicio,p_fecha_fin,coalesce(p_activo,true)
    )
    returning * into v_m;
  else
    update public.comite_sst_integrantes
    set trabajador_id=p_trabajador_id,
        representacion=p_representacion,
        condicion=p_condicion,
        cargo_comite=btrim(p_cargo_comite),
        fecha_inicio=p_fecha_inicio,
        fecha_fin=p_fecha_fin,
        activo=coalesce(p_activo,true)
    where id=p_integrante_id
      and comite_id=p_comite_id
    returning * into v_m;

    if not found then
      return jsonb_build_object('ok',false,'error','No se encontró el integrante a editar.');
    end if;
  end if;

  return jsonb_build_object(
    'ok',true,
    'integrante_id',v_m.id,
    'message',case when p_integrante_id is null
      then 'Integrante agregado correctamente.'
      else 'Integrante actualizado correctamente.'
    end
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok',false,
      'error','El trabajador ya se encuentra registrado en este Comité/Subcomité.'
    );
  when others then
    return jsonb_build_object('ok',false,'error',SQLERRM);
end;
$$;

revoke all on function public.guardar_integrante_comite(
  uuid,uuid,uuid,text,text,text,date,date,boolean
) from public;

grant execute on function public.guardar_integrante_comite(
  uuid,uuid,uuid,text,text,text,date,date,boolean
) to authenticated;

select 'Etapa 16A.1 aplicada correctamente' as resultado;
