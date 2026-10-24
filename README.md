# Etapa 14D – Registro consolidado de inducción en PDF

Se tomó como referencia directa el Excel entregado:
`Registro de inducción.xlsx`

## Nuevo botón
Dentro de **Inducciones → Ver resultados** aparece:

**Descargar registro PDF**

## Datos que completa automáticamente

### Clasificación
- Marca con X: **INDUCCIÓN**
- Las demás clasificaciones quedan sin marcar.

### Datos de la actividad
- Tema
- Expositor
- Cargo
- Empresa
- Área
- Firma digital del expositor
- DNI del expositor
- Fecha
- Tiempo

### Participantes
Se cargan TODOS los trabajadores que se registraron mediante el enlace de esa inducción, aunque todavía no hayan aprobado el examen:
- N°
- Apellidos y nombres
- DNI
- Puesto de trabajo
- Área
- Firma digital

El formato muestra 20 participantes por página. Si existen más de 20 registrados, el sistema genera automáticamente páginas adicionales conservando el mismo formato y numeración correlativa.

### Responsable del registro
Se completa:
- Nombre del usuario que genera el PDF
- Cargo
- Fecha de generación

La firma del Responsable del Registro queda en blanco porque actualmente el sistema no almacena una firma digital del usuario administrativo.

## Instalación

### 1. Supabase
Ejecutar:
`ETAPA14D_REGISTRO_INDUCCION_PDF.sql`

Debe mostrar:
`Etapa 14D aplicada correctamente`

### 2. GitHub
Reemplazar:
- index.html
- styles.css
- app.js
- config.js

No es obligatorio subir el Excel para que funcione el PDF; se incluye en `assets/registro-induccion-formato.xlsx` únicamente como referencia del formato corporativo.

Después esperar GitHub Pages y presionar Ctrl + F5.
