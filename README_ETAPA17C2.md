# Etapa 17C.2 – Seguimientos de tareas EN ESPERA

## Objetivo
Completar el flujo de pendientes que dependen de otra persona, área, proyecto, cliente o tercero.

La lógica funciona como una **cola de llamadas de seguimiento**:

1. Un ticket pasa a `EN_ESPERA`.
2. Se define de quién se espera respuesta.
3. Se programa fecha y hora de seguimiento.
4. La plataforma avisa 30 min, 10 min y/o a la hora programada.
5. El usuario registra el resultado de la llamada o gestión.
6. Según el resultado, el ticket:
   - permanece `EN_ESPERA`;
   - vuelve a `EN_PROCESO`;
   - o queda `COMPLETADO`.

## Nuevos campos para EN ESPERA
- Esperando respuesta / acción de.
- Motivo de espera.
- Próximo seguimiento.
- Hora de seguimiento.
- Aviso 30 min antes.
- Aviso 10 min antes.
- Aviso a la hora del seguimiento.

Si no se registra hora, se usa **09:00**.

## Cola de seguimientos
En `Planificación → Pendientes` aparece:

**📞 COLA DE SEGUIMIENTOS**

Muestra tickets del usuario actual cuyo seguimiento:
- está vencido;
- corresponde hoy;
- o ya debe realizarse.

Incluye el botón:

**Registrar seguimiento**

## Seguimientos hoy
Se agrega un indicador superior:

**Seguimientos hoy**

Cuenta los tickets `EN_ESPERA` cuyo seguimiento corresponde hasta el final del día.

## Registrar seguimiento
El formulario permite seleccionar:

### Sin respuesta
El ticket continúa `EN_ESPERA`.
Es obligatorio programar el siguiente seguimiento.

### Contactado, continúa pendiente
El ticket continúa `EN_ESPERA`.
Es obligatorio programar el siguiente seguimiento.

### Información / respuesta recibida
El ticket cambia automáticamente a:

`EN_PROCESO`

y deja de estar en espera.

### Asunto resuelto
El ticket cambia automáticamente a:

`COMPLETADO`

### Otro
Continúa `EN_ESPERA` y exige un próximo seguimiento.

## Historial de seguimientos
Cada ticket conserva una sección independiente con:
- fecha y hora del seguimiento;
- resultado;
- contacto;
- observación;
- estado resultante;
- siguiente fecha/hora programada.

Este historial no reemplaza la trazabilidad general del ticket; la complementa.

## Integración con los sonidos de 17C.1
Los mismos sonidos configurados en 17C.1 se utilizan para los seguimientos.

El llamado visual cambia a:

**📞 SEGUIMIENTO PROGRAMADO**

o

**📞 PRÓXIMO SEGUIMIENTO**

y muestra:
- ticket;
- pendiente;
- persona/área de la que se espera respuesta;
- tiempo restante.

Acciones:
- `Registrar seguimiento`
- `Posponer 10 min`
- cerrar aviso

## Posponer 10 min
Posponer un llamado de seguimiento:
- NO cambia la fecha contractual del pendiente;
- NO cambia la fecha programada del seguimiento;
- solo silencia ese llamado durante 10 minutos.

Después vuelve a llamar si continúa pendiente.

## Siguiente pendiente
La tarjeta **Siguiente pendiente** ahora también considera seguimientos vencidos.

Si el siguiente trabajo es un ticket `EN_ESPERA`, el botón cambia a:

**Realizar seguimiento**

y abre directamente el registro de seguimiento.

## Instalación

### 1. Supabase
Ejecuta:

`ETAPA17C2_SEGUIMIENTOS_EN_ESPERA.sql`

Debe devolver:

`Etapa 17C.2 aplicada correctamente`

### 2. GitHub
Reemplaza:
- `index.html`
- `styles.css`
- `app.js`

No se modifica `config.js`.

### 3. Publicación
Espera GitHub Pages y realiza:

`Ctrl + F5`

## Prueba recomendada
Crea un ticket:
- Estado: `EN_ESPERA`
- Esperando de: `Proyecto Cerro Verde`
- Seguimiento: hoy
- Hora: 5–10 minutos después de la hora actual
- Avisos: `10 min` y `A la hora`

La plataforma deberá emitir el llamado tipo banco y mostrar `Registrar seguimiento`.

## Siguiente subetapa sugerida
**17C.3 – Recurrencias**

Para crear automáticamente pendientes:
- diarios;
- semanales;
- mensuales;
- trimestrales;
- anuales;
- personalizados.
