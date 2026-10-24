# Etapa 16B.2 – Edición, número y eliminación de actas

## 1. Actas editables después de la firma
El Administrador puede editar el acta aunque esté:
- PROGRAMADA
- BORRADOR
- EN FIRMA
- CERRADA

Las firmas ya registradas se conservan.

## 2. Número de acta manual y editable
En **Editar datos** aparece el campo:

`Número de acta *`

Ejemplo:
`10-2026-CSST`

Puedes corregir cualquier acta existente y colocar el número real que corresponde.

## 3. Eliminar actas
El botón **Eliminar** aparece también en actas:
- EN FIRMA
- CERRADAS
- de prueba

Si existen firmas, el sistema muestra una advertencia reforzada antes de eliminar.

## 4. SQL
No se requiere ejecutar SQL nuevo.

La columna `numero_acta` ya existe y puede actualizarse. La Etapa 16B ya dejó las relaciones necesarias para eliminar los registros dependientes.

## Instalación
Reemplaza en GitHub:
- `index.html`
- `styles.css`
- `app.js`

Después espera GitHub Pages y realiza `Ctrl + F5`.

## Nota de trazabilidad
Por requerimiento operativo, la edición posterior conserva las firmas existentes. Si más adelante quieres reforzar la trazabilidad documental, se puede agregar un historial de versiones para saber exactamente qué versión firmó cada integrante.
