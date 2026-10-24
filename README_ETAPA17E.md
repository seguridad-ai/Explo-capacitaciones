# Etapa 17E – Dashboard de productividad de Planificación

## Objetivo
Consolidar la información de Proyectos/Gantt, Pendientes, Recurrencias e Integraciones en un tablero ejecutivo para seguimiento de productividad y cumplimiento.

La nueva pestaña se encuentra en:

`Planificación → Dashboard`

## Filtros

El Dashboard permite seleccionar:

- Semana actual.
- Mes actual.
- Trimestre actual.
- Año actual.

Y el alcance:

- **Mis pendientes**.
- **Todos visibles** según los permisos/RLS del usuario.

## Indicadores principales

### Cumplimiento a la fecha
Calcula:

`Pendientes completados cuyo vencimiento ya correspondía / total de pendientes cuyo vencimiento ya correspondía`

No penaliza actividades futuras del mismo periodo.

### Vencidos actuales
Cuenta los pendientes activos cuya fecha/hora objetivo ya fue superada.

### Completados a tiempo
Calcula el porcentaje de pendientes completados cuya fecha de cierre fue igual o anterior a su fecha/hora objetivo.

### Carga activa
Incluye:

- PENDIENTE.
- EN_PROCESO.
- EN_ESPERA.

Excluye completados y cancelados.

### Tiempo medio de cierre
Promedio entre:

`created_at → completado_at`

para los tickets cerrados dentro del periodo seleccionado.

### Proyectos con atraso
Cuenta proyectos visibles con una o más actividades Gantt vencidas y no completadas.

## Tendencia de 6 meses

Muestra para cada uno de los últimos 6 meses:

- pendientes programados;
- pendientes completados;
- porcentaje de completados a tiempo.

La agrupación se realiza por la fecha de vencimiento del ticket.

## Distribución de pendientes

Clasifica los tickets del periodo en:

- Vencidos.
- Pendientes.
- En proceso.
- En espera.
- Completados.

Un ticket activo que ya venció se muestra como `VENCIDO` para fines del Dashboard aunque su estado almacenado siga siendo PENDIENTE, EN_PROCESO o EN_ESPERA.

## Carga de trabajo por responsable

Muestra los responsables con mayor cantidad de tickets activos e indica cuántos están vencidos.

## Vencidos por categoría

Agrupa la deuda actual por categorías como:

- SIG.
- SST.
- Ambiental.
- Calidad.
- Auditoría.
- Indicadores.
- Comité SST.
- Cliente.
- Operaciones.
- Otros.

## Origen de pendientes

El Dashboard diferencia:

### Manual
Ticket creado directamente desde Planificación.

### Recurrente
Ticket generado por las reglas de la Etapa 17C.3.

### Integrado
Ticket vinculado automáticamente con otro módulo mediante la Etapa 17D.

## Prioridades que requieren acción

Muestra primero:

1. Pendientes vencidos.
2. Pendientes críticos.
3. Los plazos más próximos.

Desde esta sección se puede abrir directamente el ticket.

Si el ticket está `EN_ESPERA`, abre el registro de seguimiento.

## Desempeño por responsable

Tabla con:

- Programados.
- Completados.
- Completados a tiempo.
- Vencidos.
- Cumplimiento a la fecha.
- Carga activa.

El porcentaje de cumplimiento usa únicamente los vencimientos que ya correspondían hasta la fecha/hora actual.

## Salud de proyectos Gantt

Por proyecto muestra:

- porcentaje de avance;
- número de actividades;
- actividades atrasadas;
- próximo hito;
- acceso directo a `Abrir Gantt`.

## Imprimir / PDF

El botón:

`🖨 Imprimir / PDF`

activa una vista de impresión limpia del Dashboard.

Desde el navegador se puede elegir:

`Guardar como PDF`

No requiere una librería PDF adicional.

## Base de datos

**La Etapa 17E no necesita SQL adicional.**

El Dashboard utiliza la información ya disponible en:

- `planificacion_proyectos`
- `planificacion_actividades`
- `planificacion_pendientes`
- `planificacion_recurrencias`
- integraciones de la Etapa 17D

y respeta las políticas RLS existentes.

## Instalación

Reemplaza en GitHub:

- `index.html`
- `styles.css`
- `app.js`

No se modifica:

- `config.js`
- Supabase
- Edge Functions

Luego espera la publicación de GitHub Pages y realiza:

`Ctrl + F5`

## Prueba recomendada

1. Crea un ticket vencido.
2. Crea un ticket crítico para hoy.
3. Completa un ticket antes de su plazo.
4. Completa otro después de su plazo.
5. Deja un ticket EN ESPERA.
6. Mantén al menos un ticket recurrente y uno integrado.
7. Abre `Planificación → Dashboard`.
8. Cambia entre Mes, Trimestre y Año.
9. Cambia entre Mis pendientes y Todos visibles.
10. Verifica el botón `Imprimir / PDF`.

## Siguiente etapa sugerida

**17F – Calendario y agenda operativa**

Puede integrar:

- vista calendario mensual/semanal;
- drag & drop de pendientes;
- agenda horaria;
- hitos Gantt;
- seguimientos;
- reuniones;
- recurrencias;
- tickets integrados.
