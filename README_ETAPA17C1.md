# Etapa 17C.1 – Recordatorios sonoros de pendientes

## Objetivo
Agregar avisos de vencimiento al módulo **Planificación → Pendientes**, con un comportamiento similar a un llamado de turno bancario.

El sistema revisa los pendientes mientras la aplicación se encuentra abierta y avisa al usuario responsable cuando se acerca el plazo.

## Sonido predeterminado
**Turno bancario · Tin–Ton**

El sonido se genera directamente con Web Audio, por lo que no es necesario guardar archivos MP3.

También se incluyen:
- Campana corta.
- Aviso suave.
- Sin sonido.

## Avisos por pendiente
Cada ticket puede activar/desactivar individualmente:
- 1 hora antes.
- 30 minutos antes.
- 10 minutos antes.
- Al vencimiento.

Si un pendiente no tiene hora objetivo, el sistema considera las **23:59** de la fecha seleccionada.

## Llamado visual
Cuando corresponde un aviso aparece una tarjeta flotante con:
- Código del ticket.
- Pendiente.
- Prioridad.
- Tiempo restante o condición de vencido.

Acciones:
- **Atender**
- **Posponer 10 min**
- **Cerrar aviso**

### Atender
Cambia el ticket a `EN_PROCESO`, abre Planificación → Pendientes y muestra la ficha del ticket.

### Posponer 10 min
No modifica la fecha ni hora real del pendiente.
Solo silencia temporalmente el llamado durante 10 minutos.

Al terminar el tiempo vuelve a sonar el mismo aviso si todavía corresponde.

## Configuración personal
En Planificación → Pendientes aparece:

**⚙ Configurar avisos**

Cada usuario puede definir:
- Sonido activado/desactivado.
- Tipo de sonido.
- Volumen.
- Momentos de aviso predeterminados.
- Notificaciones del navegador.

La configuración queda asociada al perfil del usuario.

## Notificaciones del navegador
El botón **Autorizar notificaciones** solicita permiso al navegador.

Si se concede, además del llamado interno aparece una notificación cuando el usuario se encuentra trabajando en otra pestaña.

GitHub Pages utiliza HTTPS, por lo que este mecanismo puede funcionar correctamente en navegadores compatibles.

## Restricción del navegador
Los navegadores modernos bloquean audio automático hasta que el usuario ha interactuado al menos una vez con la página.

La plataforma prepara el audio después del primer clic o pulsación de teclado de la sesión.

## Funcionamiento con la página cerrada
Esta etapa funciona mientras la aplicación/navegador se encuentre abierto.

Si Chrome está totalmente cerrado o la computadora está apagada, no puede emitirse el sonido desde una página web.

Las notificaciones Push/PWA, correo y otros canales pueden desarrollarse posteriormente.

## Motor de revisión
El sistema revisa los vencimientos aproximadamente cada:

`30 segundos`

Solo genera llamadas para pendientes del usuario actual que estén:
- `PENDIENTE`
- `EN_PROCESO`

No genera avisos de vencimiento para:
- `EN_ESPERA`
- `COMPLETADO`
- `CANCELADO`

Los seguimientos de tareas `EN_ESPERA` corresponden a la Etapa 17C.2.

## Evitar llamadas repetidas
Cada combinación:
- ticket;
- fecha/hora de vencimiento;
- nivel de recordatorio;

se marca localmente como atendida para no repetir permanentemente el mismo sonido.

Una reprogramación genera nuevas claves porque cambia la fecha/hora.

## Instalación

### 1. Supabase
Ejecuta:

`ETAPA17C1_RECORDATORIOS_SONOROS.sql`

Debe devolver:

`Etapa 17C.1 aplicada correctamente`

### 2. GitHub
Reemplaza:
- `index.html`
- `styles.css`
- `app.js`

No se modifica `config.js`.

### 3. Publicación
Espera GitHub Pages y realiza:

`Ctrl + F5`

### 4. Primera prueba recomendada
Crea un pendiente con:
- Hora objetivo dentro de 5 a 10 minutos.
- Aviso de 10 minutos activado.
- Estado `PENDIENTE`.

Luego pulsa **Probar sonido** para confirmar volumen y permisos.

## Próxima subetapa
**17C.2 – Seguimientos de tareas EN ESPERA**

Permitirá que la plataforma vuelva a llamar cuando llegue la fecha de:
- seguimiento a proyecto;
- seguimiento a cliente;
- información pendiente;
- respuesta de un tercero.
