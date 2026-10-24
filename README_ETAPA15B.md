# Etapa 15B – Duplicar inducciones

Se agrega el botón **Duplicar** tanto para:

- Inducción Sede Lima
- Inducción por Proyecto

## ¿Qué se copia?
La duplicación conserva:

- tipo de inducción;
- sede o proyecto;
- titular minero / unidad de producción;
- temas;
- distrito y provincia;
- empresa;
- área;
- nota mínima;
- fechas actuales como referencia;
- expositor, cargo y DNI actuales como referencia;
- TODO el examen:
  - preguntas;
  - tipos de pregunta;
  - puntos/peso;
  - alternativas;
  - respuestas correctas;
  - explicaciones educativas;
  - respuestas aceptadas de preguntas libres.

## ¿Qué NO se copia?
No se copian:

- participantes;
- firmas de participantes;
- intentos;
- respuestas de exámenes;
- notas;
- resultados.

Tampoco se copia la **firma del expositor**. Esto evita que una nueva programación conserve por error una firma de una programación anterior.

## Comportamiento
Al pulsar **Duplicar**:

1. Se crea un nuevo código de inducción.
2. Se genera un nuevo enlace público.
3. La nueva inducción queda en estado **BORRADOR**.
4. Se abre automáticamente la edición de la copia.
5. Solo necesitas actualizar principalmente:
   - fecha;
   - expositor / cargo / DNI, si corresponde;
   - firma del expositor.

En Proyecto se conservan los cuatro temas y el examen; puedes cambiar las cuatro fechas y el expositor.

## Instalación

### 1. Supabase
Ejecuta:
`ETAPA15B_DUPLICAR_INDUCCIONES.sql`

Debe devolver:
`Etapa 15B aplicada correctamente`

### 2. GitHub
Reemplaza:
- `app.js`
- `styles.css`
- `index.html`

No necesitas volver a subir los PDF ni los Excel de la Etapa 15.

Después espera GitHub Pages y presiona `Ctrl + F5`.
