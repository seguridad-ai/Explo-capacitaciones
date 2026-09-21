# Etapa 4 - Trabajadores

Actualización funcional para el aplicativo **Programación de Capacitaciones** de Explo Drilling Perú.

## Incluye
- Registro individual de trabajadores.
- Campos: DNI, apellidos, nombres, puesto, área, sede y estado.
- Tabla con columna combinada **Apellidos y nombres**.
- Edición de DNI, nombre, puesto, área, sede y estado.
- Activar/desactivar trabajadores sin borrar el historial.
- Búsqueda por DNI, nombre, puesto, área o sede.
- Filtros por sede y estado.
- Contadores de total, activos e inactivos.
- Actualización automática del contador del dashboard.
- Respeta Supabase Auth y las políticas RLS existentes.

## Instalación
Subir a la raíz del repositorio GitHub y reemplazar:
- `index.html`
- `styles.css`
- `app.js`
- `config.js`

No se requiere ejecutar SQL adicional. Esta etapa utiliza las columnas ya creadas en `public.trabajadores` durante la Etapa 2.

## Nota de diseño
En el formulario los **apellidos** y **nombres** se capturan por separado para mantener una base de datos ordenada, pero en la tabla se muestran juntos como **Apellidos y nombres**.
