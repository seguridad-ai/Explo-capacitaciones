# Etapa 17C.3 – Recurrencias de pendientes

## Objetivo
Automatizar los trabajos que se repiten con una frecuencia definida, evitando crear manualmente el mismo ticket cada día, semana, mes, trimestre o año.

La Etapa 17C.3 se integra con:
- 17B – Pendientes tipo ticket.
- 17C.1 – Avisos sonoros de vencimiento.
- 17C.2 – Seguimientos de tareas EN ESPERA.

Cada ocurrencia genera un ticket normal `TK-AAAA-####`, por lo que conserva prioridad, responsable, recordatorios, trazabilidad y todas las funciones de la bandeja de trabajo.

## Nueva vista
Dentro de:

`Planificación → Pendientes`

se incorporan dos subpestañas:

- **☑ Bandeja**
- **↻ Recurrencias**

## Tipos de recurrencia
Se pueden crear reglas:

- Diarias.
- Semanales.
- Mensuales.
- Trimestrales.
- Anuales.
- Personalizadas.

### Personalizadas
Permiten definir:
- cada N días;
- cada N semanas;
- cada N meses.

## Recurrencias semanales
Se pueden seleccionar uno o varios días:

`Lun · Mar · Mié · Jue · Vie · Sáb · Dom`

Ejemplo:

`Todos los lunes y viernes`

## Recurrencias mensuales
Se define el día del mes.

Ejemplo:

`Día 23 de cada mes`

Si se selecciona un día que no existe en un mes determinado, por ejemplo día 31 en febrero, el sistema utiliza el último día disponible de ese mes.

## Recurrencias trimestrales
Ejemplo:

`Día 10 cada trimestre`

La secuencia parte del mes de la fecha de inicio.

## Recurrencias anuales
La fecha de inicio determina el día y mes de repetición.

Ejemplo:

Fecha inicio: `15/12/2026`

Resultado:

`15 de diciembre de cada año`

## Anticipación para crear tickets
Cada recurrencia permite seleccionar cuándo deben aparecer sus tickets en la bandeja:

- El mismo día.
- 1 día antes.
- 7 días antes.
- 14 días antes.
- 30 días antes.
- 60 días antes.

Ejemplo:

Una tarea mensual vence el día 23 y tiene anticipación de 7 días.

El ticket se genera desde aproximadamente el día 16 y queda visible para planificar el trabajo con anticipación.

## Recordatorios
Cada ticket creado automáticamente puede heredar:

- 1 hora antes.
- 30 minutos antes.
- 10 minutos antes.
- Al vencimiento.

Por lo tanto, las tareas recurrentes funcionan con el sonido tipo banco implementado en 17C.1.

## Responsable
Una recurrencia puede asignarse a:

- un usuario activo de la plataforma;
- el propio usuario;
- un responsable manual sin usuario del sistema.

## Integración con proyectos
Una recurrencia puede vincularse a:

- Proyecto operativo.
- Proyecto Gantt.
- Actividad del Gantt.

## Panel de recurrencias
La vista muestra:

- Recurrencias activas.
- Recurrencias pausadas.
- Tickets recurrentes de los próximos 7 días.
- Total de tickets recurrentes generados.

Cada tarjeta muestra:

- código `REC-AAAA-####`;
- título;
- patrón de repetición;
- responsable;
- prioridad;
- fecha de inicio y término;
- próxima ocurrencia generada;
- cantidad de tickets generados;
- anticipación configurada.

## Acciones
Cada recurrencia permite:

- **Editar**.
- **Actualizar próximos**.
- **Pausar**.
- **Reactivar**.
- **Eliminar**.

### Actualizar próximos
Si se modifica una regla, la aplicación elimina únicamente los tickets futuros que todavía están `PENDIENTE` y los vuelve a generar con la nueva configuración.

No modifica tickets:

- EN PROCESO;
- EN ESPERA;
- COMPLETADOS;
- históricos.

## Pausar
Al pausar una recurrencia:

- se conserva la regla;
- se conserva el historial;
- se retiran los tickets futuros que todavía están PENDIENTE;
- no se generan nuevas ocurrencias.

Al reactivarla, se vuelven a generar las próximas ocurrencias.

## Eliminar
Al eliminar una recurrencia:

- se retiran los futuros tickets que todavía están PENDIENTE;
- los tickets históricos o ya gestionados se conservan;
- se elimina la regla recurrente.

## Generación automática
La plataforma procesa recurrencias:

1. Al iniciar sesión.
2. Al ingresar/actualizar Planificación.
3. Aproximadamente cada 5 minutos mientras la plataforma permanece abierta.
4. Manualmente mediante **↻ Generar ahora**.

La función es idempotente: el mismo ticket recurrente no se duplica aunque el proceso se ejecute varias veces.

La base de datos conserva una combinación única de:

`Recurrencia + fecha de ocurrencia`

## Recuperación después de varios días sin abrir la plataforma
Cuando la aplicación vuelve a abrirse, procesa las recurrencias pendientes. Para evitar una generación masiva accidental de años anteriores, la recuperación automática de atrasos se limita a los últimos 31 días.

## Ejemplos SIG

### Indicadores mensuales
**Título:** Solicitar indicadores a las áreas  
**Frecuencia:** Mensual  
**Día:** 23  
**Hora:** 09:00  
**Anticipación:** 7 días

### Consolidación semanal
**Título:** Consolidar reportes semanales de proyectos  
**Frecuencia:** Semanal  
**Día:** Domingo  
**Hora:** 16:00

### Reunión mensual SSOMAC
**Título:** Preparar reunión mensual SSOMAC  
**Frecuencia:** Mensual  
**Día:** 10  
**Hora:** 15:00

### Revisión trimestral
**Título:** Revisión trimestral de objetivos SIG  
**Frecuencia:** Trimestral  
**Hora:** 09:00

## Instalación

### 1. Supabase
Ejecuta:

`ETAPA17C3_RECURRENCIAS.sql`

Debe devolver:

`Etapa 17C.3 aplicada correctamente`

### 2. GitHub
Reemplaza:

- `index.html`
- `styles.css`
- `app.js`

No se modifica `config.js`.

### 3. Publicación
Espera GitHub Pages y realiza:

`Ctrl + F5`

## Prueba recomendada
Crea una recurrencia:

- Frecuencia: Diaria.
- Fecha inicio: hoy.
- Hora: unos minutos después de la hora actual.
- Anticipación: El mismo día.
- Recordatorio: 10 min y al vencimiento.

Guarda la recurrencia y verifica que aparezca un ticket `TK-...` en **Bandeja** con la insignia **↻ Recurrente**.

## Siguiente subetapa sugerida
**17C.4 – Centro de llamados y alertas**

Para centralizar:

- vencimientos;
- seguimientos EN ESPERA;
- recordatorios recurrentes;
- tickets críticos;
- avisos pospuestos;
- cola priorizada de atención.
