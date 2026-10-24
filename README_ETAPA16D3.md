# Etapa 16D.3 – Examen final, resultados y temas a reforzar

## Objetivo
Completar el flujo de las capacitaciones del Comité / Subcomité SST después de los videos implementados en las Etapas 16D.1 y 16D.2.

Flujo completo:

1. Administrador crea la capacitación.
2. Agrega y ordena videos.
3. Configura el examen final.
4. Cambia la capacitación a `LISTA`.
5. Comparte el link por WhatsApp.
6. El integrante ingresa con DNI.
7. Firma antes de iniciar.
8. Completa los videos obligatorios.
9. Rinde el examen.
10. Recibe nota, estado y temas a reforzar.
11. Puede revisar sus respuestas.
12. El administrador revisa los resultados por participante.

---

## 1. Configuración del examen
Dentro de **Administrar capacitación** se agregan estas opciones:

- Nota mínima aprobatoria.
- Máximo de intentos.
- Tiempo máximo del examen en minutos (opcional).
- Ordenar preguntas aleatoriamente.
- Ordenar alternativas aleatoriamente.
- Mostrar respuestas correctas al finalizar.
- Mostrar explicación educativa al revisar.
- Permitir reintento solo mientras el participante no haya aprobado.

Una capacitación no puede publicarse/compartirse correctamente como `LISTA` si no tiene:

- al menos un video;
- al menos una pregunta de examen.

---

## 2. Preguntas del examen
Se incorpora la sección **Examen final** debajo de los videos.

Cada pregunta contiene:

- Enunciado.
- Tipo de pregunta.
- Nivel / tema.
- Peso / puntos.
- Imagen opcional.
- Explicación educativa.
- Respuesta correcta.

Tipos disponibles:

- `SINGLE` – Opción múltiple con una respuesta correcta.
- `TRUE_FALSE` – Verdadero / Falso.
- `MULTIPLE` – Varias respuestas correctas.
- `FREE_TEXT` – Respuesta libre.

Para respuesta libre se pueden colocar varias respuestas aceptadas, una por línea.

Las imágenes de las preguntas se almacenan en el bucket público:

`comite-sst-preguntas`

Máximo por imagen: **5 MB**.

---

## 3. Protección de resultados históricos
Cuando una capacitación ya tiene al menos un examen finalizado:

- las preguntas quedan bloqueadas para edición/eliminación;
- no se permite agregar nuevas preguntas;
- se conservan las respuestas y resultados históricos.

Esto evita que un resultado previo termine asociado a una versión diferente del examen.

Los datos generales de la capacitación siguen disponibles para administración, pero los parámetros del examen quedan bloqueados en la interfaz cuando ya existen resultados.

---

## 4. Examen público
Cuando el integrante completa los videos obligatorios aparece:

**CONTENIDO COMPLETADO – Examen habilitado**

El botón cambia dinámicamente según el estado:

- `Iniciar examen`.
- `Reintentar examen`.
- `Ver mi resultado`.
- `Ver último resultado`.
- `Examen pendiente de configuración`.

Durante el examen **no aparece “Comprobar respuesta”**.

La calificación ocurre únicamente al finalizar.

---

## 5. Calificación ponderada
Cada pregunta tiene un peso.

La nota sobre 20 se calcula como:

`(Puntaje obtenido / Puntaje total) × 20`

Una respuesta correcta obtiene el peso completo de la pregunta.

Una respuesta incorrecta obtiene 0 puntos.

---

## 6. Resultado del participante
Al finalizar aparece:

- APROBADO / DESAPROBADO.
- Nota sobre 20.
- Preguntas correctas.
- Número de intento.
- Temas a reforzar.
- Botón **Revisar mis respuestas**.
- Botón de reintento cuando corresponda.

---

## 7. Revisión y retroalimentación
Al pulsar **Revisar mis respuestas** se muestra cada pregunta con:

- Tu respuesta.
- Respuesta correcta, si está habilitada.
- Estado correcto / incorrecto.
- Imagen de la pregunta, si existe.
- Explicación educativa, si está habilitada.
- Nivel / tema.

Al final aparecen dos bloques:

- **Temas dominados**.
- **Temas a reforzar**.

La explicación educativa es el mensaje configurado por el evaluador al crear la pregunta.

---

## 8. Reintentos
El número máximo se controla desde la capacitación.

Ejemplo:

`Máximo de intentos: 2`

Si desaprueba el primer intento, puede realizar el segundo.

Si aprueba y está marcada la opción **Permitir reintento solo mientras no haya aprobado**, ya no podrá volver a rendir.

Si agota los intentos, podrá revisar su último resultado pero no crear uno nuevo.

---

## 9. Resultados administrativos
Cada capacitación tiene el botón **Resultados**.

El panel muestra:

- Total de intentos.
- Participantes que rindieron.
- Porcentaje de aprobación.
- Promedio de la mejor nota de cada participante.

La tabla muestra:

- Participante.
- DNI.
- Número de intento.
- Nota.
- APROBADO / DESAPROBADO.
- Fecha y hora.
- Opción para desplegar las respuestas.

El detalle incluye también la firma registrada antes de los videos.

---

## 10. Análisis de brechas
El panel administrativo calcula **Temas a reforzar** usando el último intento finalizado de cada participante.

Ejemplo:

- Funciones del CSST – 50 % error.
- Investigación de accidentes – 25 % error.
- Inspecciones SST – 0 % error.

Esto evita sobreponderar a una persona por haber realizado varios intentos.

---

# Instalación

## PASO 1 – Supabase SQL
Ejecutar:

`ETAPA16D3_EXAMEN_RESULTADOS_COMITE_SST.sql`

Debe devolver:

`Etapa 16D.3 aplicada correctamente`

## PASO 2 – GitHub
Reemplazar/subir:

- `index.html`
- `styles.css`
- `app.js`

No se modifica `config.js`.

## PASO 3 – Edge Function
La Etapa 16D.3 **no necesita una Edge Function nueva**.

Debes conservar desplegada la función de la Etapa 16D.2:

`committee-training-video`

## PASO 4 – Actualizar
Esperar GitHub Pages y ejecutar:

`Ctrl + F5`

---

## Prueba recomendada

1. Abre una capacitación existente.
2. Déjala en `BORRADOR`.
3. Agrega al menos un video.
4. Agrega 3 o 4 preguntas con diferentes tipos y pesos.
5. Guarda la capacitación como `LISTA`.
6. Comparte el link.
7. Ingresa como integrante.
8. Completa los videos.
9. Inicia el examen.
10. Envía respuestas correctas e incorrectas.
11. Verifica nota y temas a reforzar.
12. Pulsa **Revisar mis respuestas**.
13. Desde el administrador abre **Resultados** y despliega el intento.

---

## Siguiente etapa
La **Etapa 16D.4** puede cerrar el módulo documental con:

- registro PDF de capacitación del Comité/Subcomité;
- examen desarrollado descargable en PDF;
- registro general de participantes con firma y nota;
- reportes consolidados de capacitaciones del Comité SST.
