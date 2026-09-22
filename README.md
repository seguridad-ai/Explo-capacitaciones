# Etapa 10B - Certificado automático en PDF

Se incorpora el botón **Certificado** en la pestaña Resultados para cada participante aprobado.

El sistema usa como plantilla el PDF oficial `assets/certificado-ssomac.pdf` y rellena automáticamente:

1. Apellidos y nombres del trabajador aprobado.
2. DNI.
3. Cargo / puesto.
4. Tema de la capacitación.
5. Sede o proyecto asignado al trabajador.
6. Fecha de la capacitación en formato DD/MM/YYYY.
7. Número de horas (solo número).
8. Fecha de expedición en formato `LIMA, DD DE MES DEL YYYY`.

El certificado se genera a partir del PDF original, se aplana antes de descargarse y no queda editable como formulario.

## Instalación

En GitHub reemplaza:
- `index.html`
- `styles.css`
- `app.js`
- `config.js`

Y agrega dentro de la carpeta `assets`:
- `certificado-ssomac.pdf`

No se requiere SQL adicional.
