# Etapa 17F – Calendario y agenda operativa

## Objetivo

Incorporar una vista temporal de Planificación que permita visualizar y reprogramar en un solo lugar:

- pendientes;
- seguimientos `EN_ESPERA`;
- actividades Gantt;
- hitos;
- tickets recurrentes;
- tickets integrados mediante 17D.

La nueva pestaña se encuentra en:

`Planificación → Calendario`

## Vistas

### Mes

Calendario mensual de lunes a domingo.

Cada día muestra hasta cuatro eventos y un indicador `+ N más` cuando existen actividades adicionales.

Al seleccionar el número del día o `+ N más`, se abre directamente la agenda de ese día.

### Semana

Muestra siete columnas correspondientes a la semana actual seleccionada.

Cada columna contiene los eventos de ese día ordenados por hora y tipo.

### Agenda

Muestra un día específico con:

- sección de actividades sin hora / día completo;
- franjas horarias desde las 06:00 hasta las 23:00;
- pendientes y seguimientos según su hora programada;
- opción rápida `+ Agregar` en cada franja.

## Navegación

Controles disponibles:

- `←`
- `Hoy`
- `→`

El desplazamiento depende de la vista activa:

- Mes: mes anterior/siguiente.
- Semana: semana anterior/siguiente.
- Agenda: día anterior/siguiente.

## Filtros

### Alcance

- Mi agenda.
- Todo visible.

### Tipo

- Todos.
- Pendientes.
- Seguimientos.
- Actividades Gantt.
- Hitos.

### Estado

- Activos.
- Todos los estados.
- Completados.

### Proyecto

- Todos los proyectos.
- Corporativo / sin proyecto.
- Proyecto operativo específico.

## Resumen superior

El Calendario muestra:

- eventos de hoy;
- compromisos de esta semana;
- vencidos;
- seguimientos de los próximos 7 días;
- hitos de los próximos 30 días.

## Identificación visual

El calendario diferencia:

- `☑` Pendiente.
- `📞` Seguimiento.
- `▰` Actividad Gantt.
- `◆` Hito.
- `⇄ Integrado`.
- `↻ Recurrente`.

Los elementos vencidos se resaltan adicionalmente.

## Abrir un registro

Al hacer clic:

### Pendiente

Abre la ficha del ticket.

### Seguimiento

Abre directamente el formulario **Registrar seguimiento**.

### Actividad / Hito Gantt

Abre el proyecto correspondiente y posteriormente la actividad para su edición.

## Drag & drop

En PC se puede arrastrar y soltar.

### Pendiente

Al moverlo a otro día cambia:

`fecha_objetivo`

En la vista Agenda, si se mueve a una franja horaria, también cambia:

`hora_objetivo`

La trazabilidad de reprogramación existente se mantiene mediante los mecanismos de 17B.

### Seguimiento EN ESPERA

Al moverlo cambia:

- `fecha_seguimiento`;
- `hora_seguimiento`, cuando se usa Agenda.

Además se elimina un posible aplazamiento temporal del llamado para que los recordatorios se recalculen.

### Actividad Gantt

Se desplaza conservando su duración original.

Ejemplo:

Actividad original:

`10/11 → 14/11`

Si se arrastra dos días hacia adelante:

`12/11 → 16/11`

El sistema no permite desplazarla fuera de las fechas de inicio y fin del proyecto Gantt.

### Hito

Se mueve como una actividad de un solo día.

## Tickets integrados 17D

Los tickets marcados `⇄ Integrado` se muestran en el calendario, pero **no pueden reprogramarse mediante drag & drop**.

Su fecha debe modificarse en el módulo origen para no romper la sincronización automática.

Por ejemplo:

- acuerdo del Comité SST;
- reunión del Comité;
- capacitación;
- inducción.

## Tickets recurrentes 17C.3

Los tickets recurrentes aparecen normalmente en el calendario con la marca:

`↻ Recurrente`

Una ocurrencia individual puede reprogramarse sin alterar la regla de recurrencia que generará las siguientes ocurrencias.

## Crear pendiente desde el calendario

Se puede crear un pendiente directamente desde:

- el botón `+` de un día;
- una franja horaria de Agenda;
- el botón superior `+ Nuevo pendiente` cuando la pestaña Calendario está activa.

La fecha y, cuando corresponda, la hora se completan automáticamente.

## Dispositivos móviles

El calendario es responsive.

En teléfonos, las vistas Mes y Semana pueden desplazarse horizontalmente para conservar legibilidad.

El drag & drop está pensado principalmente para PC. En móvil se puede abrir el registro y modificar la fecha desde su formulario normal.

## Base de datos

**La Etapa 17F no requiere SQL adicional.**

Utiliza las estructuras existentes de:

- `planificacion_pendientes`;
- `planificacion_actividades`;
- `planificacion_proyectos`;
- recurrencias 17C.3;
- integraciones 17D.

## Instalación

Reemplaza en GitHub:

- `index.html`
- `styles.css`
- `app.js`

No se modifica:

- `config.js`;
- Supabase;
- Edge Functions.

Luego espera la publicación de GitHub Pages y realiza:

`Ctrl + F5`

## Prueba recomendada

1. Crea un pendiente para mañana con hora.
2. Crea otro ticket `EN_ESPERA` con seguimiento.
3. Mantén una actividad Gantt y un hito.
4. Abre `Planificación → Calendario`.
5. Revisa Mes, Semana y Agenda.
6. Arrastra el pendiente a otro día.
7. Desde Agenda arrástralo a otra hora.
8. Arrastra el seguimiento.
9. Mueve una actividad Gantt un día.
10. Comprueba que un ticket `⇄ Integrado` no permita drag & drop.

## Siguiente etapa sugerida

**17G – Carga de trabajo y capacidad por persona**

Podría agregar:

- horas estimadas por actividad;
- capacidad diaria/semanal;
- sobrecarga por responsable;
- redistribución de tareas;
- comparación planificado vs. ejecutado;
- semáforo de disponibilidad del equipo.
