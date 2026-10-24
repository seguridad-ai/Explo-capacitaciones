-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 11 · USUARIOS Y PERMISOS
-- ============================================================

insert into public.roles (codigo,nombre,descripcion,activo)
values
  ('ADMIN','Administrador','Acceso total al sistema, usuarios, sedes, proyectos y configuraciones.',true),
  ('GERENCIA','Gerencia','Acceso de consulta global a todas las sedes y proyectos.',true),
  ('PROYECTO','Usuario de proyecto','Acceso restringido a los proyectos asignados.',true)
on conflict (codigo) do update
set nombre=excluded.nombre, descripcion=excluded.descripcion, activo=true;

create index if not exists idx_profiles_rol on public.profiles(rol_codigo);
create index if not exists idx_profiles_activo on public.profiles(activo);
create index if not exists idx_profiles_email_lower on public.profiles(lower(email));

-- Las políticas base ya permiten al ADMIN gestionar profiles y usuarios_proyectos.
-- Reafirmamos permisos SQL para el rol authenticated; RLS sigue controlando las filas.
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.usuarios_proyectos to authenticated;
grant select on table public.roles to authenticated;

select 'Etapa 11 aplicada correctamente' as resultado;
