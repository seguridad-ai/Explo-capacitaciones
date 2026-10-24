# Etapa 17C.4 – Centro de llamados y alertas

## Objetivo
Centralizar en una sola cola los avisos operativos de Planificación, tomando como base las Etapas 17B, 17C.1, 17C.2 y 17C.3.

La vista queda dentro de:

`Planificación → Pendientes → 🔔 Centro de llamados`

No crea un sistema paralelo de tareas. El Centro lee los tickets existentes y los prioriza según su urgencia.

## Qué reúne el Centro

- Pendientes vencidos.
- Pendientes que vencen próximamente.
- Seguimientos `EN_ESPERA`.
- Tickets con prioridad `CRITICA`.
- Tickets generados por recurrencias.
- Avisos pospuestos temporalmente.

## Contador en la pestaña

La pestaña **Centro de llamados** muestra una insignia roja cuando existen llamados que requieren atención inmediata.

El contador prioriza:
- vencidos;
- seguimientos que ya corresponden;
- avisos dentro de su ventana inmediata;
- críticos de las próximas 24 horas.

## Panel de indicadores

El Centro muestra:

- Atención inmediata.
- Críticos.
- Seguimientos.
- Recurrentes.
- Pospuestos.

## Siguiente llamado

La tarjeta superior **SIGUIENTE LLAMADO** toma automáticamente el elemento más urgente.

Prioridad general:

1. Vencido.
2. Seguimiento vencido.
3. Vence / seguimiento en pocos minutos.
4. Prioridad crítica.
5. Ticket recurrente próximo.
6. Otros avisos de las próximas 24 horas.
7. Pospuestos.

Acciones:
- **🔊 Sonar ahora**
- **Atender ahora** / **Registrar seguimiento**

## Cola priorizada

Cada llamada muestra:
- código del ticket;
- pendiente;
- responsable;
- vencimiento o seguimiento;
- prioridad;
- vínculo recurrente cuando corresponda;
- estado de aviso.

Puede mostrar varias insignias sobre el mismo ticket, por ejemplo:

`VENCIDO · CRÍTICO · ↻ RECURRENTE`

Esto evita duplicar el mismo pendiente varias veces en la cola.

## Filtros

- Todos.
- Ahora.
- Vencidos.
- Seguimientos.
- Críticos.
- Recurrentes.
- Pospuestos.

También se puede buscar por:
- ticket;
- título;
- responsable;
- proyecto;
- recurrencia.

## Posponer desde el Centro

Los llamados inmediatos pueden posponerse 10 minutos.

Para pendientes normales utiliza:

`pospuesto_hasta`

Para seguimientos `EN_ESPERA` utiliza:

`seguimiento_pospuesto_hasta`

Por lo tanto, posponer un seguimiento no altera el vencimiento contractual ni la fecha/hora programada de seguimiento.

## Reactivar aviso

Si un llamado está pospuesto, aparece:

**Reactivar aviso**

Esto elimina el aplazamiento y permite que el motor de avisos vuelva a evaluar el ticket.

## Integración con el sonido

El botón **Sonar** utiliza el mismo sonido configurado en 17C.1:

- Turno bancario.
- Campana corta.
- Aviso suave.
- Sin sonido.

Los llamados urgentes usan la variante reforzada del sonido.

## Integración con seguimientos

Si el ticket está `EN_ESPERA`, el botón de atención cambia automáticamente a:

**Seguimiento**

y abre el formulario de 17C.2.

## Integración con recurrencias

Los tickets generados mediante 17C.3 se identifican con:

`↻ RECURRENTE`

El Centro muestra los tickets recurrentes próximos dentro de una ventana de 7 días, además de cualquier recurrente vencido o crítico.

## Permisos

El Centro respeta la visibilidad existente de Supabase/RLS.

La opción predeterminada:

**Mis llamados**

muestra los pendientes asignados al usuario actual.

**Todos visibles** permite revisar los tickets que el rol ya tiene autorización para consultar.

## Base de datos

**17C.4 no requiere ejecutar un SQL nuevo.**

Utiliza los campos y tablas creados en:
- 17B.
- 17C.1.
- 17C.2.
- 17C.3.

## Instalación

Reemplaza en GitHub:

- `index.html`
- `styles.css`
- `app.js`

No se modifica:

- `config.js`
- las Edge Functions.

Después de publicar GitHub Pages:

`Ctrl + F5`

## Prueba recomendada

Crea varios casos:

1. Un ticket vencido.
2. Un ticket crítico para hoy.
3. Un `EN_ESPERA` con seguimiento dentro de 10 minutos.
4. Un ticket recurrente de los próximos días.
5. Un aviso pospuesto por 10 minutos.

Luego abre:

`Planificación → Pendientes → Centro de llamados`

La plataforma debe clasificarlos en una sola cola y priorizar el más urgente.

## Cierre de 17C

Con 17C.4 quedan integrados:

- recordatorios sonoros;
- seguimientos;
- recurrencias;
- cola central de llamados.

La siguiente etapa puede orientarse a **17D – Integraciones automáticas**, para crear pendientes desde Comité SST, capacitaciones, auditorías, indicadores y otros módulos.
