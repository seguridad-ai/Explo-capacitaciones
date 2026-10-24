# Etapa 16D.1 – Capacitaciones y videos del Comité / Subcomité SST

## Objetivo
Incorporar dentro del módulo **Comité SST** la administración de capacitaciones dirigidas a los integrantes del Comité SST corporativo y de los Subcomités SST de proyectos.

Esta primera subetapa comprende:

- Creación de la capacitación.
- Asociación con un Comité o Subcomité.
- Datos generales.
- Uno o varios videos.
- Orden de reproducción.
- Fuentes de video.
- Vista previa.
- Edición y eliminación.

El enlace público, control de visualización, firma del integrante y progreso se desarrollarán en la **Etapa 16D.2**.

## Nueva pestaña
Dentro de Comité SST aparecen:

1. Conformaciones e integrantes.
2. Reuniones y actas.
3. Seguimiento de acuerdos.
4. **Capacitaciones**.

Al ingresar a Capacitaciones, el botón superior cambia a:

`+ Nueva capacitación`

## Datos de la capacitación
Se registra:

- Comité / Subcomité.
- Tema / título.
- Expositor / responsable.
- Cargo del expositor.
- Fecha.
- Duración total estimada en horas.
- Nota mínima aprobatoria.
- Máximo de intentos.
- Objetivo.
- Descripción / instrucciones.
- Estado.

Estados disponibles:

- `BORRADOR`
- `LISTA`
- `INACTIVA`

Para cambiar una capacitación a `LISTA` debe existir por lo menos un video.

## Código automático
El sistema genera códigos como:

- `CAP-CSST-2026-0001`
- `CAP-SCSST-2026-0002`

## Videos
Cada capacitación puede contener tantos videos como sean necesarios.

Por cada video se registra:

- Título.
- Descripción.
- Fuente.
- Duración aproximada.
- Obligatorio / opcional.
- Orden de reproducción.

## Fuentes disponibles

### YouTube
Permite enlaces:
- youtube.com/watch
- youtu.be
- youtube.com/shorts
- youtube.com/embed
- youtube.com/live

La administración muestra el video embebido en la vista previa.

### MP4 subido al sistema
El archivo se almacena en un bucket privado:

`comite-sst-capacitaciones`

Máximo configurado para esta etapa:

`50 MB por archivo`

La vista administrativa genera una URL temporal firmada para reproducirlo.

Para videos de mayor tamaño se recomienda utilizar YouTube no listado o un enlace externo.

### Enlace externo
Permite guardar una URL HTTPS/HTTP externa.

Si el enlace apunta directamente a un `.mp4`, la plataforma lo reproduce.

En otros casos abre el contenido en una nueva pestaña.

## Ordenamiento
Cada video dispone de:

- ↑ Subir.
- ↓ Bajar.
- Editar.
- Eliminar.
- Vista previa.

El orden guardado será utilizado posteriormente por la Etapa 16D.2 para obligar al integrante a avanzar secuencialmente.

## Permisos
Se conserva la lógica del módulo Comité SST:

- Administrador: gestión completa.
- Gerencia con acceso global: visualización.
- Usuario de proyecto: gestión de los Subcomités de los proyectos autorizados.
- Otros usuarios: según las políticas ya existentes.

## Instalación

### 1. Supabase
Ejecutar:

`ETAPA16D1_CAPACITACIONES_VIDEOS_COMITE_SST.sql`

Debe devolver:

`Etapa 16D.1 aplicada correctamente`

### 2. GitHub
Reemplazar/subir:

- `index.html`
- `styles.css`
- `app.js`

No se modifica `config.js`.

### 3. Actualizar
Esperar la publicación de GitHub Pages y ejecutar:

`Ctrl + F5`

## Siguiente etapa
La **16D.2** utilizará estas capacitaciones y videos para:

- generar el enlace de WhatsApp;
- identificar al integrante por DNI;
- registrar su firma antes del contenido;
- mostrar los videos en secuencia;
- controlar porcentaje visualizado;
- impedir adelantar un video en su primera visualización;
- guardar el último segundo visto;
- habilitar el examen solamente cuando complete el contenido obligatorio.
