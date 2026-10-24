# Etapa 17B – Planificación · Pendientes tipo ticket

## Objetivo
Convertir la pestaña **Pendientes** del módulo Planificación en una bandeja operativa para organizar y hacer seguimiento a los trabajos del día, semana y mes.

La lógica se diseñó como una cola de atención tipo ticket:

`TK-2026-0001`

Cada pendiente conserva responsable, fecha, hora, prioridad, estado y trazabilidad.

## Vista principal

### Indicadores
- Vencidos.
- Para hoy.
- En proceso.
- En espera.
- Completados esta semana.
- Cumplimiento semanal.

### Siguiente pendiente
La aplicación identifica automáticamente el siguiente pendiente del usuario considerando:
1. Vencimiento.
2. Prioridad.
3. Fecha y hora.

El botón **Atender siguiente** cambia un pendiente a `EN_PROCESO` y abre su ficha.

## Vistas por periodo
- **Hoy**: pendientes vencidos acumulados + pendientes de hoy.
- **Semana**: arrastre vencido + semana actual.
- **Mes**: arrastre vencido + mes actual.
- **Todos**: bandeja completa.

## Bandejas
- **Mis pendientes**: asignados al usuario actual.
- **Asignados por mí**: creados por el usuario y asignados a otra persona.
- **Todos visibles**: según permisos/RLS.

## Estados
- `PENDIENTE`
- `EN_PROCESO`
- `EN_ESPERA`
- `COMPLETADO`
- `CANCELADO`

El sistema calcula visualmente `VENCIDO` sin cambiar el estado almacenado.

## Prioridades
- Crítica.
- Alta.
- Media.
- Baja.

## Acciones rápidas
Desde cada ticket:
- Iniciar.
- En espera.
- Reprogramar.
- Completar.
- Editar.
- Eliminar, cuando corresponde.

## Reprogramación
La reprogramación exige:
- Nueva fecha.
- Nueva hora opcional.
- Motivo obligatorio.

El cambio queda registrado en la trazabilidad.

## En espera
Cuando el estado es `EN_ESPERA`, se habilitan:
- Esperando de.
- Motivo de espera.
- Próximo seguimiento.

La automatización de recordatorios y recurrencias se desarrollará en la Etapa 17C.

## Integración con Gantt
Un pendiente puede vincularse a:
- Proyecto operativo.
- Proyecto del Gantt.
- Actividad específica del Gantt.

Al seleccionar una actividad del Gantt, la aplicación puede tomar como referencia:
- nombre de la actividad;
- fecha fin;
- responsable;
- origen Gantt.

## Asignación
Se añadió un RPC que devuelve los usuarios activos del sistema para poder asignarles pendientes.

También existe:
**Responsable sin usuario del sistema**

para pendientes que dependan de personas, áreas, clientes o terceros sin acceso a la aplicación.

## Trazabilidad
Se registra automáticamente:
- Creación.
- Edición.
- Cambio de estado.
- Reprogramación.
- Asignación.
- En espera.
- Completado.
- Cancelado.

## Instalación

### 1. Supabase
Ejecuta:

`ETAPA17B_PLANIFICACION_PENDIENTES_TICKETS.sql`

Debe devolver:

`Etapa 17B aplicada correctamente`

### 2. GitHub
Reemplaza:
- `index.html`
- `styles.css`
- `app.js`

No se modifica `config.js`.

### 3. Publicación
Espera GitHub Pages y ejecuta:

`Ctrl + F5`

## Siguiente etapa sugerida
**17C – Seguimientos, recurrencias y recordatorios**

Ahí se puede incorporar:
- pendientes diarios/semanales/mensuales recurrentes;
- recordatorios;
- próxima llamada/seguimiento;
- reapertura automática;
- cola de seguimientos;
- notificación por correo o avisos en el sistema.
