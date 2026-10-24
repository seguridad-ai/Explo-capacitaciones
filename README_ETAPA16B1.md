# Etapa 16B.1 – Mejoras de Actas y firma electrónica de conformidad

## Cambios incluidos

### 1. Tablas centradas en el PDF
Las tablas del acta se centran tomando el ancho real de cada tabla y el ancho de la página A4.

Esto corrige el desplazamiento visual hacia la izquierda observado en:
- 2.1 Incidentes / accidentes.
- 2.2 Estadísticas SST.
- 2.3 Estadísticas SO.
- 2.4 Objetivos y asuntos relevantes.
- 2.6 Acuerdos de Subcomités.
- 2.7 Pendientes anteriores.
- 2.8 Acuerdos de la reunión.
- Participantes.
- Próxima reunión.

### 2. Sección 2.7 editable
Se mantiene el comportamiento automático:
- muestra acuerdos de reuniones anteriores que siguen pendientes.

Además se agrega:
- **+ Agregar texto**

Cada fila manual permite registrar:
- Tema / pendiente.
- Responsable.
- Estado.

Los registros manuales también se imprimen en la tabla 2.7 del PDF.

### 3. Firma electrónica de conformidad
En cada reunión se agrega un bloque:
- Firmas registradas.
- Estado de firma.
- Habilitar y compartir firmas.
- Enlace público.
- Copiar.
- WhatsApp.

Flujo:
1. Se termina de desarrollar el acta.
2. Se registra la hora real de culminación.
3. Se pulsa **Habilitar y compartir firmas**.
4. El acta pasa a `EN_FIRMA`.
5. El contenido del editor se bloquea en la interfaz.
6. Se comparte el enlace con los integrantes.
7. Cada integrante ingresa con DNI.
8. Revisa datos básicos y agenda.
9. Marca voluntariamente la casilla de conformidad.
10. Traza su firma electrónica manuscrita.
11. Se registra fecha/hora y navegador.
12. La firma no puede reemplazarse desde el enlace público.

### 4. Checkbox de consentimiento
La casilla **NO viene marcada automáticamente**.

Esto es intencional: obliga al integrante a realizar una acción afirmativa antes de registrar su firma.

Texto de conformidad:
> Declaro que he revisado la información mostrada del acta, manifiesto mi conformidad con mi participación y autorizo que la firma manuscrita trazada a continuación sea registrada como firma electrónica asociada a esta acta.

### 5. Participantes del PDF
El PDF final ya no imprime automáticamente a todos los convocados.

Solo aparecen:
- integrantes que registraron su consentimiento;
- integrantes que trazaron su firma;
- integrantes con fecha/hora de firma registrada.

La firma trazada aparece dentro de la columna **FIRMA**.

### 6. Integridad básica
Después de iniciar la etapa `EN_FIRMA`:
- la interfaz bloquea la edición del contenido;
- ya no aparece la opción de eliminar la reunión;
- una firma registrada no puede ser reemplazada mediante el enlace público.

Al cerrar:
- no se admiten nuevas firmas.

## Consideración jurídica
El mecanismo implementado es denominado en la aplicación:
**firma electrónica manuscrita / conformidad electrónica**.

No se denomina “firma digital certificada”, porque una firma dibujada en pantalla no equivale por sí sola a una firma digital basada en certificado dentro de la Infraestructura Oficial de Firma Electrónica (IOFE).

## Instalación

Si ya instalaste la Etapa 16B:

### Supabase
Ejecuta solamente:

`ETAPA16B1_MEJORAS_ACTA_FIRMA_ELECTRONICA.sql`

Debe devolver:

`Etapa 16B.1 aplicada correctamente`

### GitHub
Reemplaza:
- `index.html`
- `styles.css`
- `app.js`

No necesitas volver a ejecutar `ETAPA16B_REUNIONES_ACTAS_COMITE_SST.sql`.

Después espera la publicación de GitHub Pages y realiza `Ctrl + F5`.
