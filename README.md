# Programación de Capacitaciones — Explo Drilling Perú

Etapa 1 del aplicativo corporativo para gestión de capacitaciones.

## No necesitas instalar programas

Este proyecto es HTML/CSS/JavaScript estático y puede publicarse directamente con GitHub Pages desde el navegador.

## Archivos principales

- `index.html`: interfaz principal.
- `styles.css`: diseño corporativo.
- `app.js`: navegación inicial.
- `config.js`: configuración pública de Supabase (se completará en Etapa 2).
- `assets/logo-explo.jpg`: logo corporativo.

## Publicar en GitHub Pages

1. Crea un repositorio privado o público en GitHub.
2. Sube todos estos archivos manteniendo las carpetas.
3. En GitHub abre **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Selecciona la rama `main` y la carpeta `/ (root)`.
6. Guarda.

> Nota: GitHub Pages de repositorios privados depende del plan/configuración de la cuenta. Si GitHub no permite Pages en un repositorio privado, podemos usar otra opción de despliegue manteniendo el código privado.

## Supabase

En Etapa 2 se creará la base de datos y se completará `config.js` con la URL del proyecto y la clave pública. Nunca se debe colocar una clave `service_role` o secreta en archivos públicos.
