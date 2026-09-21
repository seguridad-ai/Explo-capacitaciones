# Explo Drilling Perú · Etapa 7 — Examen

Esta actualización incorpora la evaluación vinculada a cada capacitación.

## Funciones incluidas

- Definir si una capacitación tendrá o no examen.
- Configurar título, nota aprobatoria, número de intentos y visualización del resultado.
- Crear preguntas de opción múltiple con cuatro alternativas y una respuesta correcta.
- Publicar/despublicar la evaluación.
- Generar un enlace público específico por capacitación.
- El trabajador abre el enlace, ingresa únicamente su DNI y accede si previamente fue agregado como participante.
- Calificación automática sobre 20 puntos.
- Registro de cada intento y sus respuestas.
- Conservación de la mejor nota en `capacitacion_participantes.nota`.
- La nota se visualiza automáticamente en la lista de participantes.
- Una vez que existen intentos, las preguntas quedan bloqueadas en la interfaz para conservar la trazabilidad.

## 1. Supabase

Antes de actualizar GitHub:

1. Abrir **Supabase → SQL Editor → New query**.
2. Copiar todo el contenido de `ETAPA7_SUPABASE.sql`.
3. Pulsar **Run**.
4. Debe mostrarse `Etapa 7 creada correctamente`.

## 2. GitHub

Subir y reemplazar en la raíz del repositorio:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`

No reemplazar la carpeta `assets`.

Commit sugerido:

`Etapa 7 - Examen y calificación automática`

Después de que GitHub Pages publique el cambio, actualizar con **Ctrl + F5**.

## Flujo

1. Nueva capacitación → completar datos y firmas.
2. **Guardar y continuar al examen**.
3. Elegir si requiere evaluación.
4. Si requiere examen, crear preguntas y guardar.
5. Continuar a participantes y agregar trabajadores.
6. Copiar el enlace del examen.
7. El trabajador abre el enlace, ingresa su DNI y responde.
8. La plataforma calcula la nota y la guarda automáticamente.

## Seguridad

El enlace público no expone las respuestas correctas. El acceso a la evaluación se realiza mediante funciones RPC controladas en Supabase y exige la combinación de código de capacitación + DNI de un participante previamente registrado.
