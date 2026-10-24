# Etapa 16B – Reuniones y Actas del Comité / Subcomité SST

Esta etapa toma como referencia directa el formato entregado:
`EDP-SIG-SSOMAC-RE-EA-131-12 Acta de reunión del Comité SST.doc`

También se incluye una conversión PDF del formato original dentro de `assets/` únicamente como referencia visual.

## 1. Módulo Comité SST
Ahora existen dos pestañas:

- **Conformaciones e integrantes**
- **Reuniones y actas**

El botón superior cambia automáticamente:
- Nueva conformación
- Programar reunión

## 2. Programar reunión
Se registra:

- Comité / Subcomité.
- Tipo: Ordinaria / Extraordinaria.
- Fecha.
- Hora de inicio.
- Hora de término estimada.
- Lugar.
- Mes cuyos resultados se revisarán.
- Estado.
- Observaciones de programación.

El sistema genera automáticamente la numeración del acta:

- `01-2026-CSST`
- `01-2026-SCSST`

La numeración es independiente para cada conformación y cada año.

Al crear la reunión se cargan automáticamente los integrantes activos de la conformación como participantes.

## 3. Desarrollo de la reunión
El editor sigue la estructura del formato oficial:

### 1. Agenda
La agenda base se carga automáticamente:
- Revisión de incidentes / accidentes.
- Revisión de estadísticas de SST.
- Revisión de estadísticas de SO.
- Revisión de objetivos y asuntos relevantes de SST.
- Revisión de inspecciones realizadas.
- Revisión de actas del Subcomité SST.
- Revisión de acuerdos pendientes.
- Acuerdos de la reunión.

También permite agregar temas adicionales.

### 2.1 Incidentes / accidentes
Filas dinámicas:
- Incidente / accidente.
- Comentarios / plan de acción.

### 2.2 Estadísticas SST
- IF.
- IS.
- IA.
- Comentarios / repercusión.

### 2.3 Estadísticas de Salud Ocupacional
- Enfermedades ocupacionales.
- Trabajadores expuestos al agente.
- Tasa de incidencia.
- Trabajadores con enfermedades ocupacionales.
- Comentarios / repercusión.

### 2.4 Objetivos y asuntos relevantes
Filas dinámicas:
- Tema.
- Comentarios / repercusión.

### 2.5 Inspecciones realizadas
Permite cargar hasta **4 imágenes**.

Cada imagen puede tener una descripción:
- hallazgo;
- inspección;
- levantamiento;
- evidencia.

Las imágenes se almacenan en Supabase Storage y se insertan dentro del PDF en la sección 2.5 del acta.

### 2.6 Acuerdos de Subcomités
Filas dinámicas:
- Proyecto.
- Acuerdo.
- Acciones.
- Estado.

### 2.7 Pendientes anteriores
El sistema muestra automáticamente acuerdos de reuniones anteriores de la misma conformación cuyo estado no sea CERRADO.

### 2.8 Acuerdos de la reunión
- Acción requerida.
- Persona responsable.
- Fecha de cumplimiento.

Estos acuerdos se guardan en una tabla propia para que la Etapa 16C pueda realizar el seguimiento.

## 4. Participantes
Los integrantes activos se cargan automáticamente.

El usuario marca quiénes estuvieron presentes.

En el PDF:
- aparece el nombre;
- cargo dentro del Comité;
- la columna **FIRMA queda en blanco** para firma física.

Existe un botón **Sincronizar integrantes** para incorporar miembros agregados después de haber programado la reunión.

## 5. Próxima reunión
Se registra:
- Fecha.
- Hora.
- Tema específico / agenda adicional.

## 6. Acta PDF
El PDF mantiene la estructura del formato entregado:

- Código: `EDP-SIG-SSOMAC-RE-EA-131`
- N°: `12`
- Versión: `6`
- Fecha Act: `Jul-25`
- Título rojo corporativo.
- Acta N°.
- Texto de apertura.
- Agenda.
- Secciones 2.1 a 2.8.
- Evidencias fotográficas en la sección 2.5.
- Participantes.
- Próxima reunión.

Para Subcomités, el encabezado se adapta a:
`ACTA DE REUNIÓN DEL SUBCOMITÉ SST`

Si el contenido no entra en dos páginas, el PDF agrega páginas manteniendo el encabezado; esto evita recortes o texto superpuesto.

## 7. Estados
- BORRADOR
- PROGRAMADA
- CERRADA

Para cerrar una reunión se exige la hora real de culminación.

## Instalación

### Supabase
Ejecutar:

`ETAPA16B_REUNIONES_ACTAS_COMITE_SST.sql`

Debe devolver:

`Etapa 16B aplicada correctamente`

### GitHub
Reemplazar/subir:

- `index.html`
- `styles.css`
- `app.js`

No se requiere modificar `config.js`.

Los archivos de referencia del formato se incluyen en:

- `assets/EDP-SIG-SSOMAC-RE-EA-131-12 Acta de reunión del Comité SST.doc`
- `assets/EDP-SIG-SSOMAC-RE-EA-131-12 Acta de reunión del Comité SST - referencia.pdf`

Después esperar GitHub Pages y realizar `Ctrl + F5`.
