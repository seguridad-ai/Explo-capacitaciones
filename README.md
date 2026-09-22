# Etapa 8 · Firma del participante + registro final PDF

## 1. Supabase
Ejecutar en SQL Editor el archivo:

`ETAPA8_FIRMA_Y_REGISTRO_PDF.sql`

Resultado esperado: **Etapa 8 aplicada correctamente**.

## 2. GitHub
Reemplazar en el repositorio:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`

No reemplazar la carpeta `assets/`.

## 3. Qué agrega esta etapa
- Después de enviar el examen, el trabajador firma desde el celular.
- Si cierra el enlace antes de firmar, puede volver a ingresar con el mismo DNI y completar la firma.
- Vista previa con Firma, Nota y Estado: EVALUADO / COMPLETADO.
- Solo participantes COMPLETADOS (evaluación + firma) ingresan al PDF final.
- Botón **Descargar registro PDF** con el formato corporativo solicitado.
- El PDF incluye firma del expositor, firma del participante, nota y firma del responsable del registro.

## 4. Nota
El PDF utiliza jsPDF y AutoTable desde CDN. Se requiere conexión a Internet al momento de cargar la página para obtener esas librerías.
