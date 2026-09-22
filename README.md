# Etapa 9 · Programación de capacitaciones

## 1. Ejecutar primero en Supabase

Abrir **SQL Editor → New query** y ejecutar todo el contenido de:

`ETAPA9_PROGRAMACION.sql`

Resultado esperado:

`Etapa 9 aplicada correctamente`

## 2. Actualizar GitHub

Subir y reemplazar:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`

No reemplazar la carpeta `assets/`.

Commit sugerido:

`Etapa 9 - Programación y calendario de capacitaciones`

Luego esperar la publicación de GitHub Pages y usar `Ctrl + F5`.

## Funciones incluidas

- calendario mensual de capacitaciones;
- navegación mes anterior / siguiente / hoy;
- filtros por sede/proyecto, clasificación y estado;
- búsqueda por código, tema o expositor;
- estados: BORRADOR, PROGRAMADA, REPROGRAMADA, EN CURSO, FINALIZADA y CANCELADA;
- identificación automática de actividades PENDIENTES cuando la fecha ya venció y no fueron cerradas;
- reprogramación de fecha con registro de la fecha anterior;
- horario de inicio y fin;
- observaciones de programación;
- edición de la ficha completa desde el calendario;
- vista de solo lectura para rol GERENCIA;
- nueva capacitación directamente desde Programación.

## Nota

La Etapa 9 utiliza la tabla `capacitaciones` ya creada. No elimina ni modifica los registros existentes; solo agrega campos y amplía el catálogo de estados.
