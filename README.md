# Etapa 9C - Formato oficial de registro PDF

Esta actualización corrige la vista Documento y la descarga PDF para reproducir el formato oficial EDP-SIG-SSOMAC-RE-EA-121 suministrado en Excel.

## Cambios
- Encabezado y estructura fieles al Excel original.
- Código de formato EDP-SIG-SSOMAC-RE-EA-121, N° 2, versión 7 y fecha Jul-25.
- RUC corregido a 20527775851 según la plantilla.
- Firma del expositor en el campo FIRMA del bloque del capacitador.
- Firma del responsable en RESPONSABLE DEL REGISTRO.
- Tabla original de 25 participantes por hoja.
- Columna NOTA añadida al lado de FIRMA.
- Si existen más de 25 participantes, el PDF crea hojas adicionales de 25 participantes cada una.
- No requiere ejecutar SQL.

## Instalación
En GitHub, reemplaza: index.html, styles.css, app.js y config.js. No reemplaces assets/.
Después espera GitHub Pages y usa Ctrl+F5.
