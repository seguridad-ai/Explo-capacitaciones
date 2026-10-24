-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 16A
-- COMITÉ SST / SUBCOMITÉ SST - CONFORMACIÓN E INTEGRANTES
-- ============================================================

create sequence if not exists public.comite_sst_codigo_seq start 1;

create table if not exists public.comites_sst (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  tipo text not null check (tipo in ('COMITE','SUBCOMITE')),
  nombre text not null,
  sede_id uuid references public.sedes(id) on delete restrict,
  proyecto_id uuid references public.proyectos(id) on delete restrict,
  fecha_constitucion date not null,
  vigencia_desde date not null,
  vigencia_hasta date not null,
  numero_acta text,
  estado text not null default 'ACTIVO' check (estado in ('BORRADOR','ACTIVO','CERRADO')),
  observaciones text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_comites_sst_vigencia check (vigencia_hasta >= vigencia_desde),
  constraint ck_comites_sst_unidad check (
    (tipo='COMITE' and sede_id is not null and proyecto_id is null)
    or
    (tipo='SUBCOMITE' and proyecto_id is not null and sede_id is null)
  )
);

create table if not exists public.comite_sst_integrantes (
  id uuid primary key default gen_random_uuid(),
  comite_id uuid not null references public.comites_sst(id) on delete cascade,
  trabajador_id uuid not null references public.trabajadores(id) on delete restrict,
  representacion text not null check (representacion in ('EMPLEADOR','TRABAJADORES')),
  condicion text not null check (condicion in ('TITULAR','SUPLENTE')),
  cargo_comite text not null,
  fecha_inicio date not null,
  fecha_fin date,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ux_comite_sst_integrante unique(comite_id,trabajador_id),
  constraint ck_comite_sst_integrante_fechas check (
    fecha_fin is null or fecha_fin >= fecha_inicio
  )
);

create index if not exists idx_comites_sst_tipo on public.comites_sst(tipo);
create index if not exists idx_comites_sst_sede on public.comites_sst(sede_id);
create index if not exists idx_comites_sst_proyecto on public.comites_sst(proyecto_id);
create index if not exists idx_comites_sst_estado on public.comites_sst(estado);
create index if not exists idx_comite_integrantes_comite on public.comite_sst_integrantes(comite_id);
create index if not exists idx_comite_integrantes_trabajador on public.comite_sst_integrantes(trabajador_id);
create index if not exists idx_comite_integrantes_activo on public.comite_sst_integrantes(activo);

-- ------------------------------------------------------------
-- Código automático
-- ------------------------------------------------------------
create or replace function public.set_comite_sst_codigo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.codigo is null or btrim(new.codigo)='' then
    new.codigo :=
      case when new.tipo='COMITE' then 'CSST' else 'SCSST' end
      || '-' || extract(year from new.vigencia_desde)::int::text
      || '-' || lpad(nextval('public.comite_sst_codigo_seq')::text,4,'0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_comite_sst_codigo on public.comites_sst;
create trigger trg_set_comite_sst_codigo
before insert on public.comites_sst
for each row execute function public.set_comite_sst_codigo();

-- ------------------------------------------------------------
-- Updated at
-- ------------------------------------------------------------
create or replace function public.touch_comite_sst_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_touch_comites_sst on public.comites_sst;
create trigger trg_touch_comites_sst
before update on public.comites_sst
for each row execute function public.touch_comite_sst_updated_at();

drop trigger if exists trg_touch_comite_integrantes on public.comite_sst_integrantes;
create trigger trg_touch_comite_integrantes
before update on public.comite_sst_integrantes
for each row execute function public.touch_comite_sst_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.comites_sst enable row level security;
alter table public.comite_sst_integrantes enable row level security;

drop policy if exists comites_sst_select on public.comites_sst;
create policy comites_sst_select
on public.comites_sst
for select to authenticated
using (
  public.is_admin()
  or public.can_view_all_projects()
  or (
    tipo='SUBCOMITE'
    and proyecto_id is not null
    and public.has_project_access(proyecto_id)
  )
);

drop policy if exists comites_sst_insert on public.comites_sst;
create policy comites_sst_insert
on public.comites_sst
for insert to authenticated
with check (
  public.is_admin()
  or (
    tipo='SUBCOMITE'
    and proyecto_id is not null
    and public.can_manage_project(proyecto_id)
  )
);

drop policy if exists comites_sst_update on public.comites_sst;
create policy comites_sst_update
on public.comites_sst
for update to authenticated
using (
  public.is_admin()
  or (
    tipo='SUBCOMITE'
    and proyecto_id is not null
    and public.can_manage_project(proyecto_id)
  )
)
with check (
  public.is_admin()
  or (
    tipo='SUBCOMITE'
    and proyecto_id is not null
    and public.can_manage_project(proyecto_id)
  )
);

drop policy if exists comites_sst_delete on public.comites_sst;
create policy comites_sst_delete
on public.comites_sst
for delete to authenticated
using (
  public.is_admin()
  or (
    tipo='SUBCOMITE'
    and proyecto_id is not null
    and public.can_manage_project(proyecto_id)
  )
);

drop policy if exists comite_integrantes_select on public.comite_sst_integrantes;
create policy comite_integrantes_select
on public.comite_sst_integrantes
for select to authenticated
using (
  exists (
    select 1
    from public.comites_sst c
    where c.id=comite_id
      and (
        public.is_admin()
        or public.can_view_all_projects()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.has_project_access(c.proyecto_id)
        )
      )
  )
);

drop policy if exists comite_integrantes_insert on public.comite_sst_integrantes;
create policy comite_integrantes_insert
on public.comite_sst_integrantes
for insert to authenticated
with check (
  exists (
    select 1
    from public.comites_sst c
    where c.id=comite_id
      and (
        public.is_admin()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.can_manage_project(c.proyecto_id)
        )
      )
  )
);

drop policy if exists comite_integrantes_update on public.comite_sst_integrantes;
create policy comite_integrantes_update
on public.comite_sst_integrantes
for update to authenticated
using (
  exists (
    select 1
    from public.comites_sst c
    where c.id=comite_id
      and (
        public.is_admin()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.can_manage_project(c.proyecto_id)
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.comites_sst c
    where c.id=comite_id
      and (
        public.is_admin()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.can_manage_project(c.proyecto_id)
        )
      )
  )
);

drop policy if exists comite_integrantes_delete on public.comite_sst_integrantes;
create policy comite_integrantes_delete
on public.comite_sst_integrantes
for delete to authenticated
using (
  exists (
    select 1
    from public.comites_sst c
    where c.id=comite_id
      and (
        public.is_admin()
        or (
          c.tipo='SUBCOMITE'
          and c.proyecto_id is not null
          and public.can_manage_project(c.proyecto_id)
        )
      )
  )
);

grant select,insert,update,delete on public.comites_sst to authenticated;
grant select,insert,update,delete on public.comite_sst_integrantes to authenticated;
grant usage,select on sequence public.comite_sst_codigo_seq to authenticated;

-- ============================================================
-- BUSCAR TRABAJADOR PARA UN COMITÉ / SUBCOMITÉ
-- Valida que esté activo y pertenezca a la misma unidad.
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
    return jsonb_build_object(
      'ok',false,
      'error','El DNI no está registrado en la Base de Trabajadores.'
    );
  end if;

  if not v_w.activo then
    return jsonb_build_object(
      'ok',false,
      'error','El trabajador se encuentra inactivo.'
    );
  end if;

  if v_c.tipo='COMITE' and v_w.sede_id is distinct from v_c.sede_id then
    return jsonb_build_object(
      'ok',false,
      'error','El trabajador no pertenece a la sede de este Comité SST.'
    );
  end if;

  if v_c.tipo='SUBCOMITE' and v_w.proyecto_id is distinct from v_c.proyecto_id then
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

-- ============================================================
-- GUARDAR / EDITAR INTEGRANTE
-- ============================================================
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
    return jsonb_build_object('ok',false,'error','El trabajador no está disponible o se encuentra inactivo.');
  end if;

  if v_c.tipo='COMITE' and v_w.sede_id is distinct from v_c.sede_id then
    return jsonb_build_object('ok',false,'error','El trabajador no pertenece a la sede del Comité SST.');
  end if;

  if v_c.tipo='SUBCOMITE' and v_w.proyecto_id is distinct from v_c.proyecto_id then
    return jsonb_build_object('ok',false,'error','El trabajador no pertenece al proyecto del Subcomité SST.');
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
      return jsonb_build_object('ok',false,'error','El trabajador ya se encuentra registrado en este Comité/Subcomité.');
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
    return jsonb_build_object('ok',false,'error','El trabajador ya se encuentra registrado en este Comité/Subcomité.');
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

-- ============================================================
-- ACTIVAR / DESACTIVAR INTEGRANTE
-- ============================================================
create or replace function public.cambiar_estado_integrante_comite(
  p_integrante_id uuid,
  p_activo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.comite_sst_integrantes%rowtype;
  v_c public.comites_sst%rowtype;
begin
  select * into v_m
  from public.comite_sst_integrantes
  where id=p_integrante_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','No se encontró el integrante.');
  end if;

  select * into v_c
  from public.comites_sst
  where id=v_m.comite_id
  limit 1;

  if not (
    public.is_admin()
    or (
      v_c.tipo='SUBCOMITE'
      and v_c.proyecto_id is not null
      and public.can_manage_project(v_c.proyecto_id)
    )
  ) then
    return jsonb_build_object('ok',false,'error','No tienes permiso para modificar este integrante.');
  end if;

  update public.comite_sst_integrantes
  set activo=coalesce(p_activo,false),
      fecha_fin=case
        when coalesce(p_activo,false)=false and fecha_fin is null then current_date
        when coalesce(p_activo,false)=true then null
        else fecha_fin
      end
  where id=p_integrante_id;

  return jsonb_build_object(
    'ok',true,
    'message',case when coalesce(p_activo,false)
      then 'Integrante activado correctamente.'
      else 'Integrante desactivado correctamente.'
    end
  );
end;
$$;

revoke all on function public.cambiar_estado_integrante_comite(uuid,boolean) from public;
grant execute on function public.cambiar_estado_integrante_comite(uuid,boolean) to authenticated;

select 'Etapa 16A aplicada correctamente' as resultado;
