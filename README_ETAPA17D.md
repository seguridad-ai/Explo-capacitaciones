# Etapa 17D – Integraciones automáticas con Planificación

## Objetivo
Conectar los módulos operativos que ya existen en la plataforma con **Planificación → Pendientes**, evitando volver a registrar manualmente la misma actividad.

La integración funciona en dos pasos:

1. **Vinculación inicial**: el usuario pulsa `＋ Planificar` o usa `Integraciones → Sincronizar visibles`.
2. **Sincronización automática**: desde ese momento, los cambios realizados en el registro origen actualizan el ticket vinculado mediante triggers de Supabase.

## Nueva pestaña
Dentro de **Planificación** se incorpora:

- Proyectos y Gantt
- Pendientes
- **Integraciones**

## Módulos conectados en 17D

### 1. Acuerdos del Comité / Subcomité SST
Origen: `comite_sst_acuerdos`

El ticket hereda:
- acción/acuerdo;
- responsable;
- fecha de cumplimiento;
- proyecto del Subcomité, cuando corresponda;
- estado.

Estados sincronizados:
- `PENDIENTE` → ticket pendiente;
- `EN_PROCESO` → ticket en proceso;
- `CERRADO` → ticket completado.

Si el acuerdo no tiene fecha de cumplimiento, no se puede vincular hasta registrar la fecha.

### 2. Reuniones del Comité / Subcomité SST
Origen: `comite_sst_reuniones`

El ticket hereda:
- N.° de acta;
- Comité/Subcomité;
- fecha;
- hora de inicio;
- proyecto, cuando corresponda;
- cierre de reunión.

Cuando la reunión pasa a `CERRADA`, el ticket queda `COMPLETADO`.

### 3. Capacitaciones del Comité SST
Origen: `comite_sst_capacitaciones`

El ticket hereda:
- código;
- tema/título;
- fecha;
- expositor;
- proyecto del Subcomité;
- estado.

Si la capacitación queda `INACTIVA`, el ticket se cancela.

### 4. Capacitaciones generales
Origen: `capacitaciones`

El ticket hereda:
- código;
- tema;
- fecha;
- responsable o expositor;
- proyecto;
- estado.

Estados terminales:
- `FINALIZADA` → `COMPLETADO`;
- `CANCELADA` → `CANCELADO`.

### 5. Inducciones
Origen: `inducciones`

Incluye:
- Sede Lima;
- Inducciones de proyecto.

El ticket hereda:
- código;
- tema;
- fecha de inicio;
- expositor;
- proyecto;
- estado.

Una inducción `CERRADA` completa el ticket.

## Botón Planificar en los módulos
En cada módulo integrado aparece:

`＋ Planificar`

Cuando ya existe vínculo cambia a:

`✓ Planificado`

Al pulsar `✓ Planificado`, se abre directamente el ticket relacionado dentro de Planificación.

## Panel Integraciones
La nueva vista muestra por módulo:

- registros visibles;
- vinculados;
- sin vincular.

Además incluye:

**Sincronizar visibles**

Esto crea en lote los tickets de los registros abiertos que todavía no están vinculados.

## No se generan duplicados
Cada origen solo puede tener un ticket integrado mediante la combinación:

`origen_modulo + origen_registro_id`

Se crea un índice único en Supabase para impedir duplicados incluso si el usuario intenta sincronizar más de una vez.

## Trazabilidad del ticket
Se agregan los campos:

- `origen_modulo`
- `origen_registro_id`
- `origen_registro_codigo`
- `origen_sincronizado_at`

Los tickets integrados muestran la insignia:

`⇄ Integrado`

Y dentro de la bandeja indican de qué módulo provienen.

## Sincronización automática
Después de vincular un registro, los triggers de la Etapa 17D mantienen actualizado el ticket cuando cambia el origen.

Se sincronizan principalmente:

- título;
- fecha;
- hora cuando el origen dispone de hora;
- responsable manual, si el ticket no fue reasignado a un usuario;
- proyecto;
- estado terminal;
- código del origen;
- fecha/hora de última sincronización.

### Respeto de cambios hechos en Planificación
Si un ticket fue asignado a un usuario del sistema, la sincronización no reemplaza manualmente esa asignación.

Si el ticket está `EN_PROCESO` o `EN_ESPERA` y el origen sigue abierto, se conserva el estado operativo de Planificación.

Los estados terminales del origen sí prevalecen:

- completado/cerrado;
- cancelado/inactivo.

## Eliminación del origen
Si se elimina un registro ya vinculado, su ticket no se borra.

Se conserva la trazabilidad y el ticket pasa a `CANCELADO`, salvo que ya estuviera `COMPLETADO`.

## Instalación

### 1. Supabase
Ejecutar:

`ETAPA17D_INTEGRACIONES_AUTOMATICAS.sql`

Resultado esperado:

`Etapa 17D aplicada correctamente`

### 2. GitHub
Reemplazar:

- `index.html`
- `styles.css`
- `app.js`

No modificar:

- `config.js`
- Edge Functions existentes.

### 3. Publicación
Esperar GitHub Pages y ejecutar:

`Ctrl + F5`

## Prueba recomendada

1. Abrir un acuerdo del Comité SST con fecha de cumplimiento.
2. Pulsar `＋ Planificar`.
3. Verificar que aparezca `✓ Planificado`.
4. Abrir el ticket desde ese botón.
5. Regresar al acuerdo y cambiar su fecha de cumplimiento.
6. Guardar.
7. Abrir nuevamente el ticket.
8. La nueva fecha debe aparecer automáticamente.
9. Cerrar el acuerdo.
10. El ticket debe pasar automáticamente a `COMPLETADO`.

Repetir después con una capacitación o inducción.

## Alcance de esta etapa
17D conecta los módulos que actualmente existen en la aplicación y tienen una fecha/estado claramente utilizable para Planificación.

Auditorías, indicadores y requisitos legales pueden incorporarse con la misma arquitectura cuando tengan su propio módulo estructurado dentro de la plataforma.
