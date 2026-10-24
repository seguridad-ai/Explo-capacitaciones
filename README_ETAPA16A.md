# Etapa 16A – Comité SST / Subcomité SST: conformación e integrantes

Esta etapa reemplaza el módulo “Próximamente” de **Comité SST** por la base operativa para las siguientes etapas.

## Qué permite

### 1. Crear una conformación
Dos modalidades:

- **Comité SST**: para una sede.
- **Subcomité SST**: para un proyecto.

Campos:
- Sede o Proyecto.
- Fecha de constitución.
- Vigencia desde.
- Vigencia hasta.
- N.° / Código de acta de constitución.
- Estado: ACTIVO / BORRADOR / CERRADO.
- Observaciones.

El sistema genera automáticamente:
- `CSST-AAAA-0001` para Comité SST.
- `SCSST-AAAA-0002` para Subcomité SST.

### 2. Gestionar integrantes
Los integrantes se vinculan directamente con la **Base de Trabajadores** mediante DNI.

El sistema valida:
- que el trabajador exista;
- que esté activo;
- que pertenezca a la misma sede del Comité SST; o
- que pertenezca al mismo proyecto del Subcomité SST.

Por integrante se registra:
- Representación:
  - Empleador.
  - Trabajadores.
- Condición:
  - Titular.
  - Suplente.
- Cargo dentro del Comité:
  - Presidente.
  - Secretario.
  - Vocal.
  - Miembro.
- Fecha de inicio.
- Fecha de fin opcional.
- Estado activo/inactivo.

### 3. Panel de control
Muestra:
- conformaciones visibles;
- Comité SST;
- Subcomités SST;
- integrantes activos.

Incluye buscador y filtros por tipo y estado.

### 4. Permisos
- **Administrador**: puede gestionar Comité SST de sede y Subcomités.
- **Gerencia**: visualización.
- **Usuario de proyecto**: puede gestionar únicamente Subcomités de proyectos a los que tiene acceso.

## Qué NO incluye todavía
Esta Etapa 16A no genera todavía:
- Actas de reunión.
- Acuerdos.
- Capacitaciones del Comité.
- Videos.
- Exámenes del Comité.
- PDF de actas.

Esos módulos usarán directamente las conformaciones e integrantes registrados aquí.

## Instalación

### 1. Supabase
Ejecuta:

`ETAPA16A_COMITE_SST_CONFORMACION_INTEGRANTES.sql`

Debe mostrar:

`Etapa 16A aplicada correctamente`

### 2. GitHub
Reemplaza:
- `index.html`
- `styles.css`
- `app.js`

No necesitas volver a subir los PDF, Excel ni `config.js` de las etapas anteriores.

Después espera GitHub Pages y presiona `Ctrl + F5`.
