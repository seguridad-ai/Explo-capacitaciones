# Etapa 7C – Registro público y participantes automáticos

Esta actualización modifica el flujo de la Etapa 7:

- Se elimina la etapa manual **Participantes** del registro de capacitación.
- El flujo administrativo queda en 3 pasos: **Capacitador → Examen → Vista previa**.
- El enlace del examen puede compartirse por WhatsApp.
- El trabajador ingresa su DNI.
- Si existe y está activo, se muestran automáticamente sus datos.
- Si no existe, aparece el mensaje **“Usted no está registrado. Regístrese, por favor”** y un formulario con DNI, apellidos, nombres, puesto, área y sede.
- El nuevo trabajador se incorpora a la base `trabajadores` con estado **Activo**.
- Un trabajador que ya existe pero está **Inactivo** no puede autorregistrarse de nuevo; debe ser actualizado por un responsable.
- Consultar el DNI ya no agrega a la persona como participante.
- El participante se incorpora a `capacitacion_participantes` recién cuando envía su evaluación.
- La Vista previa muestra automáticamente a quienes ya rindieron el examen y su nota.

## 1. Supabase

Ejecuta completo:

`ETAPA7C_REGISTRO_PUBLICO_Y_FLUJO.sql`

Resultado esperado:

`Etapa 7C aplicada correctamente`

> Esta actualización supone que las Etapas 5, 6, 7 y 7B ya fueron aplicadas.

## 2. GitHub

Reemplaza en el repositorio:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`

No reemplaces la carpeta `assets/`.

Commit sugerido:

`Etapa 7C - Registro público y participantes automáticos`

Después espera la publicación de GitHub Pages y usa `Ctrl + F5`.
