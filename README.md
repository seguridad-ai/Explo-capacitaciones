# Etapa 7B · Acceso al examen por trabajador activo

Este ajuste cambia el flujo público del examen:

1. El responsable comparte por WhatsApp el enlace específico del examen.
2. El trabajador abre el enlace e ingresa solo su DNI.
3. Supabase consulta directamente el maestro `trabajadores`.
4. Solo puede continuar si `activo = true`.
5. La pantalla muestra automáticamente apellidos y nombres, DNI, puesto, área y sede.
6. Si el trabajador todavía no estaba en `capacitacion_participantes`, se registra automáticamente sin duplicarlo.
7. El trabajador rinde el examen y la nota queda vinculada al registro de participantes.

## Supabase

Si ya ejecutaste la Etapa 7 anterior, ejecuta solamente:

`ETAPA7_AJUSTE_TRABAJADOR_ACTIVO.sql`

Ruta: **Supabase → SQL Editor → New query → pegar todo → Run**.

Resultado esperado: `Etapa 7B aplicada correctamente`.

> Si todavía no ejecutaste la Etapa 7 original, primero ejecuta `ETAPA7_SUPABASE.sql` del paquete de la Etapa 7 y después este ajuste.

## GitHub

Reemplaza:

- `index.html`
- `app.js`
- `styles.css`
- `config.js`

No reemplaces `assets/`.

Commit sugerido:

`Etapa 7B - Acceso examen por trabajador activo`

Después espera la publicación de GitHub Pages y actualiza con **Ctrl + F5**.
