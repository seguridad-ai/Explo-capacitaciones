# Etapa 17F.1 – Tono personalizado + enlace público de Planificación

## 1. Tono de aviso reemplazado

El sonido predeterminado `BANCO` ahora reproduce el archivo compartido por el usuario:

`assets/planning-high-tone-ping.mp3`

El MP3 se encuentra dentro del paquete completo.

No se reemplazaron las opciones secundarias:
- Campana corta.
- Aviso suave.
- Sin sonido.

Por lo tanto, la opción predeterminada ahora aparece como:

**Tono personalizado · High Tone Ping**

El volumen continúa controlándose desde `Planificación → Pendientes → Configurar avisos`.

## 2. Compartir Planificación por enlace

Se agrega el botón:

`🌐 Compartir`

dentro de `Planificación → Pendientes`.

El usuario puede configurar:
- nombre del tablero público;
- descripción;
- alcance de tareas;
- fecha/hora de vencimiento del enlace;
- activar/desactivar el enlace;
- mostrar u ocultar responsable;
- mostrar u ocultar descripción;
- mostrar completados;
- permitir o no propuestas de nuevas tareas.

### Alcance

**Mis pendientes**
- asignados al propietario;
- o creados por él y sin otro usuario asignado.

**Creados por mí**
- tickets creados por el propietario, aunque estén asignados a otra persona.

**Ambos**
- combina los dos criterios.

## 3. Acceso público

La URL tiene la forma:

`?planningShare=<token>`

No requiere:
- usuario;
- contraseña;
- inicio de sesión.

La vista pública solo consume un RPC `SECURITY DEFINER`.
No se otorgan permisos directos anónimos sobre `planificacion_pendientes`.

La página pública permite:
- buscar tareas;
- filtrar por estado;
- filtrar por fecha;
- ver programados, hoy, vencidos y completados;
- consultar prioridad, fecha, hora y datos habilitados por el propietario.

## 4. Proponer tareas sin modificar la planificación oficial

Si el propietario habilita:

`Permitir proponer tareas`

aparece:

`＋ Proponer tarea`

El visitante puede registrar:
- nombre;
- contacto opcional;
- título;
- descripción;
- categoría;
- prioridad sugerida;
- fecha;
- hora;
- comentario.

La propuesta se almacena en:

`planificacion_sugerencias_publicas`

con estado:

`PENDIENTE`

**No se inserta directamente en `planificacion_pendientes`.**

Por lo tanto, una persona externa no puede crear un ticket oficial sin aprobación.

## 5. Aprobación del usuario

En:

`Planificación → Pendientes → 📥 Solicitudes`

el propietario puede revisar las propuestas.

Antes de aprobar puede modificar:
- tarea;
- categoría;
- prioridad;
- fecha;
- hora;
- responsable;
- descripción.

Al pulsar:

`Aprobar y crear ticket`

se crea un ticket oficial `TK-...` y la solicitud pasa a:

`APROBADA`

El ticket queda identificado en la bandeja con:

`🌐 Público`

También puede rechazarse una solicitud indicando el motivo.

## 6. Seguridad del enlace

Cada usuario tiene un único enlace público activo/configurable.

Puede:
- desactivarlo;
- establecer vencimiento;
- regenerarlo.

`Regenerar enlace` invalida inmediatamente la URL anterior.

La vista anónima nunca tiene permisos directos para:
- editar tickets;
- cerrar tickets;
- modificar responsables;
- eliminar tareas.

Solo puede leer los campos que el RPC expone y, si está habilitado, enviar una propuesta para aprobación.

## 7. Control básico de abuso

La función pública limita temporalmente el número de propuestas enviadas con el mismo nombre en el mismo tablero.

Este control no sustituye sistemas avanzados de CAPTCHA/rate limiting; está orientado a un tablero compartido con personas conocidas.

## 8. Instalación

### Paso 1 – Confirmar dependencia 17C.2

En la prueba anterior apareció:

`Could not find the table public.planificacion_pendiente_seguimientos`

Si todavía no lo corregiste, ejecuta primero:

`ETAPA17C2_SEGUIMIENTOS_EN_ESPERA.sql`

Debe mostrar:

`Etapa 17C.2 aplicada correctamente`

### Paso 2 – Ejecutar SQL de 17F.1

En Supabase → SQL Editor ejecuta:

`ETAPA17F1_TONO_ENLACE_PUBLICO.sql`

Resultado esperado:

`Etapa 17F.1 aplicada correctamente`

El SQL termina con:

`NOTIFY pgrst, 'reload schema';`

para recargar el schema cache de PostgREST.

### Paso 3 – GitHub

Reemplaza/sube:
- `index.html`
- `styles.css`
- `app.js`
- carpeta `assets`

Es importante subir:

`assets/planning-high-tone-ping.mp3`

No se modifica:
- `config.js`
- Edge Functions.

### Paso 4 – Publicación

Espera GitHub Pages y ejecuta:

`Ctrl + F5`

## 9. Prueba recomendada

1. Inicia sesión.
2. Abre `Planificación → Pendientes`.
3. Pulsa `▶ Probar sonido`.
4. Confirma que reproduce el High Tone Ping compartido.
5. Pulsa `🌐 Compartir`.
6. Guarda la configuración.
7. Copia el enlace.
8. Ábrelo en modo incógnito.
9. Confirma que la planificación se ve sin iniciar sesión.
10. Envía una tarea con `＋ Proponer tarea`.
11. Regresa a tu sesión.
12. Abre `📥 Solicitudes`.
13. Revisa la propuesta.
14. Apruébala.
15. Confirma que aparece un ticket `TK-...` con la etiqueta `🌐 Público`.

## 10. Verificación opcional

Se incluye:

`VERIFICAR_DEPENDENCIAS_PLANIFICACION.sql`

Si alguna etapa anterior no se ejecutó, este script ayuda a confirmar qué tablas existen.

## Archivos principales de esta actualización

- `ETAPA17F1_TONO_ENLACE_PUBLICO.sql`
- `VERIFICAR_DEPENDENCIAS_PLANIFICACION.sql`
- `index.html`
- `styles.css`
- `app.js`
- `assets/planning-high-tone-ping.mp3`
- `README_ETAPA17F1.md`
