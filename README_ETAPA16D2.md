# Etapa 16D.2 – Link público, firma y progreso de videos

## Objetivo
Esta etapa toma las capacitaciones creadas en la **16D.1** y habilita el flujo para los integrantes del Comité / Subcomité SST:

1. Compartir link por WhatsApp.
2. Identificación por DNI.
3. Validación contra los integrantes activos de la conformación.
4. Firma antes de iniciar.
5. Videos secuenciales.
6. Control de avance.
7. Guardado del último segundo visto.
8. Reanudación del contenido.
9. Bloqueo del adelanto durante la primera visualización.
10. Habilitación del examen cuando se termina el contenido obligatorio.

> El examen propiamente dicho se incorpora en la **Etapa 16D.3**.

---

## 1. Link para integrantes
Cuando una capacitación está en estado `LISTA`, en la tarjeta aparece:

- **Compartir**

Y dentro de **Administrar capacitación** aparece:

- Link público.
- Copiar.
- WhatsApp.

El link utiliza:

`?committeeTraining=<token>`

---

## 2. Identificación por DNI
Al abrir el link, el integrante debe ingresar su DNI.

El sistema valida que:

- el DNI exista en la Base de Trabajadores;
- el trabajador esté activo;
- forme parte del Comité/Subcomité correspondiente;
- el integrante se encuentre activo;
- la capacitación se encuentre en estado `LISTA`.

No se permite el ingreso a personas que no pertenezcan a la conformación asignada.

---

## 3. Firma antes del contenido
Después de validar el DNI aparece:

- Nombre.
- DNI.
- Cargo.
- Área.
- Comité/Subcomité.
- Cargo dentro de la conformación.

Antes de acceder a los videos debe:

1. Marcar una casilla de conformidad.
2. Registrar su firma manuscrita en pantalla.
3. Pulsar **Registrar firma y continuar**.

La firma y fecha/hora quedan asociadas a la participación.

---

## 4. Secuencia de videos
Los videos se presentan según el orden definido en la 16D.1.

Ejemplo:

- Video 1 – habilitado.
- Video 2 – bloqueado.
- Video 3 – bloqueado.
- Examen – bloqueado.

Al terminar el contenido obligatorio anterior se habilita el siguiente.

Los videos marcados como opcionales no bloquean los contenidos posteriores.

---

## 5. YouTube
Para videos de YouTube se utiliza la API del reproductor de YouTube.

Durante la primera visualización:

- puede pausar;
- puede retroceder;
- no puede adelantar por encima del punto máximo ya visualizado.

Si intenta mover el reproductor hacia adelante, el sistema regresa al último punto alcanzado.

Cuando alcanza aproximadamente el 98 % se registra como completado.

---

## 6. MP4 cargado en Supabase
Los MP4 permanecen en el bucket privado:

`comite-sst-capacitaciones`

La página pública **no recibe la ruta privada directamente**.

Se agregó una Edge Function:

`committee-training-video`

Esta función:

- valida token;
- valida DNI;
- valida pertenencia al Comité/Subcomité;
- valida que la firma ya exista;
- valida la secuencia de videos;
- genera un enlace temporal del MP4 por 2 horas.

El MP4 tiene el mismo control de avance:

- pausar: permitido;
- retroceder: permitido;
- adelantar a contenido no visto: bloqueado.

---

## 7. Enlaces externos
Si el enlace externo apunta directamente a un `.mp4`, se utiliza el mismo reproductor controlado.

Para otros sitios externos no es técnicamente posible verificar segundo a segundo la reproducción desde esta plataforma.

En ese caso:

1. El participante abre el contenido.
2. Se inicia un tiempo mínimo según la duración registrada.
3. Finalizado ese tiempo se habilita **Confirmar contenido revisado**.

Si necesitas control estricto, usa **YouTube** o **MP4 subido al sistema**.

---

## 8. Progreso y reanudación
Por cada participante/video se guarda:

- último segundo;
- máximo segundo visualizado;
- porcentaje;
- fecha/hora de inicio;
- completado;
- fecha/hora de finalización.

Si el integrante cierra la página y regresa después, el video se reanuda desde el último punto guardado.

El guardado durante la reproducción se realiza aproximadamente cada 9–10 segundos y también al pausar.

---

## 9. Finalización del contenido
La pantalla muestra:

- videos completados;
- porcentaje general;
- nota mínima;
- ruta de aprendizaje;
- examen bloqueado/habilitado.

Cuando todos los contenidos obligatorios están terminados aparece:

**CONTENIDO COMPLETADO – Examen habilitado**

El botón del examen queda reservado para la **Etapa 16D.3**.

---

# Instalación

## PASO 1 – Supabase SQL
Ejecuta:

`ETAPA16D2_LINK_FIRMA_PROGRESO_VIDEOS.sql`

Debe devolver:

`Etapa 16D.2 aplicada correctamente`

---

## PASO 2 – Edge Function
En Supabase:

**Edge Functions → Create new edge function**

Nombre exacto:

`committee-training-video`

Reemplaza el contenido de `index.ts` por el archivo:

`EDGE_FUNCTION_committee-training-video.ts`

También se incluye:

`committee-training-video.zip`

### Configuración importante
En **Settings** de la función:

**Verify JWT with legacy secret → OFF**

La función es pública porque el integrante entra desde WhatsApp sin iniciar sesión. La función realiza sus propias validaciones de token, DNI, membresía y secuencia.

No coloques la Service Role Key en `config.js` ni en GitHub. La Edge Function utiliza `SUPABASE_SERVICE_ROLE_KEY` únicamente del entorno seguro de Supabase.

---

## PASO 3 – GitHub
Reemplaza/sube:

- `index.html`
- `styles.css`
- `app.js`

No necesitas modificar `config.js`.

---

## PASO 4 – Actualizar
Espera la publicación de GitHub Pages y ejecuta:

`Ctrl + F5`

---

## Prueba recomendada
1. Crea una capacitación del Comité SST.
2. Agrega 2 videos.
3. Déjalos como obligatorios.
4. Cambia la capacitación a `LISTA`.
5. Pulsa **Compartir**.
6. Abre el link en modo incógnito o celular.
7. Ingresa el DNI de un integrante activo.
8. Firma.
9. Inicia Video 1.
10. Intenta adelantarlo: debe regresar al máximo segundo visto.
11. Cierra la página y vuelve a abrir: debe recuperar el progreso guardado.
12. Termina Video 1: debe desbloquear Video 2.
13. Termina todos los obligatorios: debe aparecer **Examen habilitado**.
