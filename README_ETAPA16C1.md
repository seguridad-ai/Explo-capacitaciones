# Etapa 16C.1 – Descarga en Excel oficial

Se reemplazó la descarga CSV del módulo **Seguimiento de acuerdos** por el formato oficial proporcionado:

`EDP-SIG-SSOMAC-RE-EA-131-17 Seguimiento a los acuerdos del Comité de SST 2026.xlsx`

## Botón
Ahora aparece:

**Descargar Excel oficial**

## Correspondencia de datos

| Columna del formato | Dato del sistema |
|---|---|
| N° | Correlativo de exportación |
| REUNION | Número de acta |
| FECHA | Fecha de la reunión |
| ACUERDOS | Acción requerida |
| Responsable de ejecución | Responsable del acuerdo |
| Fecha programada | Fecha de cumplimiento |
| Fecha ejecutada | Fecha de cierre |
| EVIDENCIA | Nombre y URL de las evidencias cargadas |
| Estado | ABIERTO / EN PROCESO / CERRADO |

### Conversión de estados
- PENDIENTE → ABIERTO
- EN_PROCESO → EN PROCESO
- CERRADO → CERRADO

## Conservación del formato
La descarga utiliza el Excel original como plantilla y conserva:
- Logo.
- Encabezado SIG - SSOMAC.
- Código `EDP-SIG-SSOMAC-RE-EA-131`.
- N° 17.
- Versión 1.
- Título rojo.
- Anchos de columnas.
- Bordes.
- Colores.
- Celdas combinadas de EVIDENCIA.
- Formato de fechas.
- Validación y formato de Estado.
- Hojas ocultas existentes.
- Área de impresión.

Si existen más acuerdos que las filas originalmente disponibles, el sistema crea nuevas filas con el mismo formato y amplía el área de impresión.

## Instalación
Esta mejora **no requiere SQL nuevo**.

Sube/reemplaza en GitHub:
- `index.html`
- `app.js`
- `styles.css`
- la carpeta `assets/`, incluyendo:
  - `seguimiento-acuerdos-comite-sst-2026.xlsx`

Luego espera GitHub Pages y realiza `Ctrl + F5`.
