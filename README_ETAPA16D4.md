# Etapa 16D.4 – Documentos y reportes de capacitaciones del Comité SST

## Objetivo
Cerrar documentalmente el flujo iniciado en las Etapas 16D.1, 16D.2 y 16D.3.

La Etapa 16D.4 agrega:

- Registro PDF de capacitación del Comité/Subcomité SST.
- Examen desarrollado descargable en PDF por cada intento.
- Descarga del propio examen desde el enlace público del integrante.
- Reporte PDF de resultados por capacitación.
- Excel de resultados por capacitación.
- Reporte consolidado PDF de todas las capacitaciones visibles.
- Excel consolidado de capacitaciones, participantes, intentos y brechas.

---

## 1. Registro PDF de capacitación

Dentro de **Resultados** aparece:

`Registro PDF`

El documento usa el formato corporativo:

`EDP-SIG-SSOMAC-RE-EA-121`

y marca automáticamente:

`CAPACITACIÓN`

Incluye:

- Tema.
- Expositor.
- Cargo.
- Empresa.
- Área SSOMAC.
- Unidad / proyecto.
- Fecha.
- Tiempo en horas.
- Código de la capacitación.
- Comité/Subcomité.
- Lista de participantes.
- DNI.
- Puesto.
- Área.
- Firma electrónica del participante.
- Nota final.

Se utiliza **un solo resultado final por participante**: el intento de mayor número registrado.

El formato genera páginas de 20 participantes para mantener el orden del registro oficial.

> Nota: el DNI y la firma del expositor no se completan automáticamente porque esos campos no fueron capturados en la Etapa 16D.1. Permanecen disponibles para firma/control físico si se requiere.

---

## 2. Examen desarrollado PDF

En la tabla de resultados aparece el botón:

`Examen PDF`

El documento contiene:

- Participante.
- DNI.
- Cargo.
- Área.
- Tema de la capacitación.
- Fecha.
- Nota final.
- APROBADO / DESAPROBADO.
- Preguntas correctas.
- Número de intento.
- Cada pregunta.
- Imagen de la pregunta, cuando exista.
- Respuesta marcada por el participante.
- Respuesta correcta.
- Puntaje obtenido / peso.
- Explicación educativa.
- Firma electrónica del participante.
- Fecha y hora de finalización.

---

## 3. Descarga pública del examen

Después de finalizar el examen, el integrante ve:

`Descargar mi examen PDF`

El sistema valida:

- token de la capacitación;
- DNI;
- participación en esa capacitación;
- intento solicitado;
- que el intento esté finalizado.

Un trabajador no puede descargar el examen de otro participante.

Para esto se agrega el RPC:

`obtener_documento_examen_capacitacion_comite_publico`

---

## 4. Reporte PDF por capacitación

Dentro de **Resultados** aparece:

`Reporte PDF`

Muestra:

- Tema.
- Código.
- Comité / unidad.
- Expositor.
- Fecha.
- Duración.
- Participantes evaluados.
- Aprobados.
- Porcentaje de aprobación.
- Promedio.
- Resultado final por participante.
- Temas a reforzar y porcentaje de error.

Para evitar sobreponderar reintentos, el análisis de brechas utiliza el último intento de cada participante.

---

## 5. Excel de resultados por capacitación

Dentro de **Resultados** aparece:

`Resultados Excel`

Genera un archivo `.xlsx` con cuatro hojas:

### Resumen
Indicadores de la capacitación.

### Participantes
Último resultado por participante.

### Intentos
Todos los intentos realizados.

### Brechas
Tema/nivel, respuestas analizadas, errores y porcentaje de error.

---

## 6. Reportes consolidados

En la pantalla principal de **Capacitaciones** aparecen:

- `Excel consolidado`
- `Reporte consolidado PDF`

### Excel consolidado
Incluye todas las capacitaciones que el usuario tiene permiso para visualizar y genera:

1. Resumen.
2. Participantes.
3. Intentos.
4. Brechas.

### PDF consolidado
Presenta una tabla ejecutiva con:

- Código.
- Capacitación.
- Unidad.
- Fecha.
- Número de videos.
- Número de preguntas.
- Participantes evaluados.
- Porcentaje de aprobación.
- Promedio.
- Estado.

---

# Instalación

## PASO 1 – Supabase SQL

Ejecutar:

`ETAPA16D4_DOCUMENTOS_REPORTES_COMITE_SST.sql`

Debe devolver:

`Etapa 16D.4 aplicada correctamente`

Este SQL **no crea nuevas tablas**. Solo agrega el RPC público necesario para que cada integrante descargue su propio examen.

## PASO 2 – GitHub

Reemplazar/subir:

- `index.html`
- `styles.css`
- `app.js`
- carpeta `assets/`

No se modifica `config.js`.

## PASO 3 – Edge Function

No necesitas desplegar una Edge Function nueva.

Debes conservar activa:

`committee-training-video`

## PASO 4 – Actualizar

Esperar GitHub Pages y ejecutar:

`Ctrl + F5`

---

## Prueba recomendada

1. Ingresa a **Comité SST > Capacitaciones**.
2. Abre una capacitación que tenga resultados.
3. Pulsa **Resultados**.
4. Descarga **Registro PDF**.
5. Verifica firmas y notas.
6. Pulsa **Examen PDF** en un intento.
7. Descarga **Reporte PDF**.
8. Descarga **Resultados Excel**.
9. Regresa a la lista y genera **Excel consolidado**.
10. Genera **Reporte consolidado PDF**.
11. Entra mediante el enlace público como integrante.
12. Abre un resultado finalizado y pulsa **Descargar mi examen PDF**.
