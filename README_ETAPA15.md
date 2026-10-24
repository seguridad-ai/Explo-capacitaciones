# Etapa 15 – Inducción por Proyectos (4 días)

Esta etapa desarrolla el flujo completo solicitado para **Inducciones por Proyecto**.

## A. Programación administrativa
Al seleccionar `+ Nueva inducción > Proyecto`, se registra:

- Titular minero
- E.C.M./Conexas: `EXPLO DRILLING PERU S.R.L.`
- Unidad de producción / Proyecto
- Distrito
- Provincia
- Expositor
- Cargo
- DNI
- Empresa: `EXPLO DRILLING PERU S.R.L.`
- Área
- Tema Día 1
- Tema Día 2
- Tema Día 3
- Tema Día 4
- Fecha Día 1
- Fecha Día 2
- Fecha Día 3
- Fecha Día 4
- Tiempo fijo: 8 horas por cada día
- Firma del expositor
- Nota mínima

Las fechas se validan en orden cronológico.

## B. Examen
Después de registrar los cuatro días se pasa al mismo constructor de preguntas ya implementado:
- opción múltiple
- verdadero/falso
- varias respuestas
- respuesta libre
- peso/puntos
- explicación educativa

Al guardar el examen se genera el enlace público.

## C. Registro del trabajador mediante el link
Para Proyecto se solicita exactamente:
- Trabajador (apellidos y nombres)
- Registro o DNI
- Cargo o Puesto
- Fecha de ingreso
- Área de trabajo
- Firma

Después pasa a desarrollar el examen final.

## D. Resultados
En `Ver resultados` de una inducción de Proyecto aparecen:
- resultados de los trabajadores;
- Anexo 5 para cada aprobado;
- examen desarrollado;
- Registro Día 1;
- Registro Día 2;
- Registro Día 3;
- Registro Día 4.

## E. Registros diarios
Se usa como referencia directa el archivo:
`assets/registro-induccion-proyecto.xlsx`

Cada día genera un PDF con:
- Clasificación: INDUCCIÓN;
- tema de ese día;
- fecha de ese día;
- 8 horas;
- expositor, cargo, DNI y firma;
- empresa y área;
- participantes registrados, con DNI, puesto, área y firma.

Si existen más de 20 participantes, se generan páginas adicionales.

## F. Documento final - Anexo N° 5
Se usa directamente el PDF formulario:
`assets/anexo5-proyecto.pdf`

Se completa:
- Titular Minero
- E.C.M./CONEXAS
- Unidad de Producción
- Distrito
- Provincia
- Trabajador
- Registro o DNI
- Cargo
- Fecha de Ingreso
- Área de Trabajo
- Expositor en el bloque Ingeniero Supervisor
- Firma del expositor
- Fecha Día 4
- Firma del trabajador

El Anexo N° 5 y el examen desarrollado están disponibles después de aprobar.

## Instalación

### 1. Supabase
Ejecuta:
`ETAPA15_INDUCCION_PROYECTOS_4_DIAS.sql`

Debe devolver:
`Etapa 15 aplicada correctamente`

### 2. GitHub
Reemplaza/sube:
- index.html
- styles.css
- app.js
- config.js
- assets/anexo5-proyecto.pdf
- assets/registro-induccion-proyecto.xlsx

Después espera la publicación de GitHub Pages y presiona `Ctrl + F5`.


## Ajuste 15A - Firmas físicas en Anexo N° 5

En el PDF `Anexo N° 5` se dejan **en blanco** los campos inferiores para firma física:

- Nombre y apellidos del Ingeniero Supervisor / Expositor.
- Firma del Ingeniero Supervisor / Expositor.
- Firma del Trabajador.

La fecha del registro sí se mantiene completada.

El trabajador debe descargar e imprimir el PDF y gestionar las firmas físicas correspondientes.
