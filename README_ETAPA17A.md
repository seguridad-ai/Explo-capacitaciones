# Etapa 17A – Planificación: Proyectos y Diagrama de Gantt

Se incorpora una nueva opción **Planificación** en el menú lateral, ubicada inmediatamente después de Inicio.

## Estructura del módulo

Dentro de Planificación se muestran dos pestañas:

- **Proyectos y Gantt** – implementada en 17A.
- **Pendientes** – reservada para 17B.

## Proyectos

Permite crear proyectos de planificación con:

- Código automático `PLN-AAAA-0001`.
- Nombre.
- Categoría: SIG, SST, Ambiental, Calidad, Auditoría, Cliente, Operaciones u Otro.
- Prioridad: Baja, Media, Alta o Crítica.
- Fecha de inicio y fin.
- Responsable general.
- Proyecto operativo vinculado opcional.
- Estado: Borrador, Activo, Pausado, Cerrado o Cancelado.
- Objetivo.
- Descripción / alcance.
- Observaciones.

## Portafolio

El panel muestra:

- Proyectos activos.
- Total de actividades.
- Actividades atrasadas.
- Hitos próximos en 30 días.
- Avance promedio.

Incluye búsqueda y filtros por estado, categoría y año.

## Actividades y Gantt

Cada proyecto admite tareas e hitos con:

- Orden.
- Nombre y descripción.
- Responsable.
- Fecha de inicio y fin.
- Avance de 0 a 100%.
- Estado.
- Prioridad.
- Dependencias con una o varias actividades anteriores.
- Observaciones.

Los hitos se representan como rombos y se registran en una sola fecha.

## Diagrama de Gantt

Incluye:

- Vista Día.
- Vista Semana.
- Vista Mes.
- Línea de HOY.
- Barras por actividad.
- Avance visual dentro de cada barra.
- Hitos.
- Situación de atraso.
- Responsable y dependencias visibles.
- Botón Hoy para centrar el cronograma.
- Clic sobre barra/hito para editar la actividad.

También existe una vista **Lista de actividades** con edición, eliminación y reordenamiento ↑ / ↓.

## Cálculo de avance

El avance del proyecto se calcula utilizando el promedio del porcentaje de sus tareas activas. Los hitos se usan como base solo cuando el proyecto no tiene tareas.

## Seguridad

- Administrador: visualización y gestión global.
- Gerencia: visualización global.
- Creador o responsable: acceso al proyecto de planificación.
- Usuario de proyecto: acceso según los permisos del proyecto operativo vinculado.
- Las políticas RLS de Supabase son la autorización definitiva.

## Instalación

### 1. Supabase
Ejecutar:

`ETAPA17A_PLANIFICACION_PROYECTOS_GANTT.sql`

Debe devolver:

`Etapa 17A aplicada correctamente`

### 2. GitHub
Reemplazar/subir:

- `index.html`
- `styles.css`
- `app.js`

No se modifica `config.js`.

### 3. Actualizar
Esperar GitHub Pages y ejecutar `Ctrl + F5`.

## Siguiente etapa

**17B – Pendientes:** bandeja del día/semana/mes, tickets, prioridad, vencimiento, en espera de tercero, reprogramación y seguimiento.
