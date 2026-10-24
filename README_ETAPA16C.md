# Etapa 16C – Seguimiento de acuerdos

## Qué agrega
Dentro de **Comité SST** aparece una tercera pestaña:

- Conformaciones e integrantes
- Reuniones y actas
- **Seguimiento de acuerdos**

Los acuerdos se alimentan automáticamente desde el punto **2.8 Acuerdos de la reunión** de cada acta.

## Panel de control
Muestra:
- Total de acuerdos.
- Pendientes.
- En proceso.
- Vencidos.
- Cerrados.
- Porcentaje de cumplimiento.

## Filtros
Permite buscar y filtrar por:
- Texto.
- Comité/Subcomité.
- Estado.
- Vencidos.
- Próximos a vencer en 7 días.
- Sin fecha de compromiso.

## Gestión de cada acuerdo
Desde **Gestionar** puedes modificar:
- Acción requerida.
- Responsable.
- Fecha de cumplimiento.
- Estado:
  - PENDIENTE
  - EN PROCESO
  - CERRADO
- Observación / seguimiento.
- Comentario de cierre.

Para cambiar a **CERRADO** se exige un comentario de cierre.

La fecha de cierre se registra automáticamente.

## Evidencias
Cada acuerdo puede contener hasta 6 evidencias:
- JPG
- PNG
- WEBP
- PDF

Máximo: 8 MB por archivo.

## Historial
El sistema registra automáticamente los cambios en:
- Estado.
- Responsable.
- Fecha comprometida.
- Acción requerida.

## Integración con las actas
La Etapa 16C también corrige el guardado de acuerdos del editor de actas.

Antes, al volver a guardar el acta, los acuerdos se eliminaban y se creaban nuevamente. Desde esta etapa se conservan los IDs de los acuerdos existentes para no perder:
- Estado.
- Evidencias.
- Historial.
- Fecha de cierre.

Los acuerdos cerrados dejan de aparecer automáticamente como pendientes en el punto 2.7 de reuniones posteriores.

## Exportación
Incluye **Exportar CSV** con:
- Acta.
- Fecha.
- Comité/Subcomité.
- Unidad.
- Acuerdo.
- Responsable.
- Fecha compromiso.
- Situación.
- Estado.
- Fecha de cierre.
- Observaciones.
- Cantidad de evidencias.

## Instalación

### 1. Supabase
Ejecuta:

`ETAPA16C_SEGUIMIENTO_ACUERDOS.sql`

Debe devolver:

`Etapa 16C aplicada correctamente`

### 2. GitHub
Reemplaza:
- `index.html`
- `styles.css`
- `app.js`

No necesitas reemplazar `config.js`.

### 3. Publicación
Espera GitHub Pages y ejecuta:

`Ctrl + F5`
