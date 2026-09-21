# Programación de Capacitaciones — Etapa 2

Versión con autenticación real mediante Supabase Auth.

## Qué incluye

- Pantalla de inicio de sesión con correo y contraseña.
- Sesión persistente al recargar la página.
- Validación del perfil en `public.profiles`.
- Bloqueo de usuarios inactivos.
- Visualización del nombre, rol, cargo y correo del usuario autenticado.
- Botón de cierre de sesión.
- Ocultamiento del módulo Usuarios para roles distintos de ADMIN.
- Conteos reales de trabajadores, proyectos y sedes según RLS.

## Archivos a reemplazar en GitHub

Sube todos los archivos de esta carpeta al repositorio, reemplazando los existentes.
Mantén `assets/logo-explo.jpg` dentro de la carpeta `assets`.

## Seguridad

`config.js` contiene únicamente la URL pública y la publishable key de Supabase. No debe contener nunca `service_role`, secret key ni la contraseña de la base de datos.

## Prueba

1. Espera a que GitHub Pages publique el nuevo commit.
2. Abre la URL del aplicativo.
3. Debe aparecer la pantalla de login.
4. Inicia sesión con el usuario creado en Supabase Authentication.
5. Debe aparecer el dashboard con el perfil ADMIN y opción `Cerrar sesión`.
