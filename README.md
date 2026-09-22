# Etapa 9B — Historial de capacitaciones

Esta actualización reemplaza la vista de calendario/horarios por una biblioteca de capacitaciones registradas.

## Cambios principales

- La capacitación ya no vence por hora ni por fecha.
- Se eliminaron de la interfaz **Hora de inicio** y **Hora de fin**.
- El campo **Tiempo** se mantiene porque forma parte del registro oficial.
- Una capacitación queda **ACTIVA** y permanece disponible hasta que un responsable la finalice manualmente.
- La sección **Capacitaciones** muestra tarjetas con:
  - tema, expositor, fecha, sede/proyecto y área;
  - cantidad de participantes y preguntas;
  - nota promedio y porcentaje de aprobación;
  - enlace para copiar o compartir por WhatsApp;
  - acceso a **Ver detalles**.
- El detalle contiene cuatro pestañas:
  1. Participantes
  2. Examen
  3. Resultados
  4. Documento
- Desde Documento se conserva la descarga del PDF oficial creada en la Etapa 8.

## Instalación

1. Ejecutar `ETAPA9B_HISTORIAL_CAPACITACIONES.sql` en Supabase → SQL Editor.
2. En GitHub reemplazar:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.js`
3. No reemplazar `assets/`.
4. Esperar GitHub Pages y actualizar con `Ctrl + F5`.

## Estado de las capacitaciones

- `BORRADOR`: todavía no se habilitó el flujo.
- `ACTIVA`: el registro/evaluación puede seguir recibiendo participantes mientras el examen esté publicado.
- `FINALIZADA`: cierre manual; el examen se despublica.
- `CANCELADA`: actividad anulada.

La fecha es informativa y no desactiva la capacitación automáticamente.
