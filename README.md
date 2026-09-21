# Etapa 6 · Participantes

Actualización del aplicativo **Programación de Capacitaciones – Explo Drilling Perú**.

## Antes de subir los archivos web
En Supabase > SQL Editor > New query, ejecutar completo:

`ETAPA6_SUPABASE.sql`

Resultado esperado: **Etapa 6 creada correctamente**.

## Luego actualizar GitHub Pages
Reemplazar en la raíz del repositorio:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`

No reemplazar la carpeta `assets`.

## Funcionalidad incorporada
- Registro de participantes desde la base maestra de trabajadores mediante DNI.
- Autocompletado de apellidos y nombres, puesto y área.
- Prevención de participantes duplicados en una misma capacitación.
- Firma individual del participante.
- Retiro de participantes.
- Búsqueda dentro de la lista de asistencia.
- Columna **Nota** preparada para el módulo de examen (Etapa 7).
- Datos históricos del trabajador guardados en la capacitación para que el registro no cambie si luego se modifica su puesto, área o nombre en la base maestra.
- Clasificaciones ampliadas para alinearse con el formato corporativo.
