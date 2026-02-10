# Notificaciones por correo (Trigger Email)

Este documento lista las notificaciones que el sistema envía o puede enviar por correo a jugadores y responsables, usando la extensión **Trigger Email** (colección `mail`).

## Implementadas

| Novedad | Cuándo | Destinatario | Ubicación |
|--------|--------|--------------|-----------|
| **Nueva evaluación** | El entrenador guarda una evaluación para un jugador | Jugador (si tiene email) | `AddEvaluationSheet` |
| **Novedades (broadcast)** | El admin de la escuela escribe un mensaje y envía a todos | Todos los jugadores con email | Admin escuela → pestaña Novedades |
| **Prueba Trigger Email** | El usuario hace clic en "Enviar email de prueba" en Ajustes | Email indicado | Ajustes |

## Sugeridas para implementar

| Novedad | Descripción | Destinatario |
|--------|-------------|--------------|
| **Evaluación física nueva** | Se carga una nueva evaluación física (tests) para el jugador | Jugador (si tiene email) |
| **Comentario en evaluación** | El entrenador edita/comenta una evaluación ya existente | Jugador (si tiene email) |
| **Nuevo video en videoteca** | Se sube o graba un video para el jugador | Jugador (si tiene email) |
| **Bienvenida / acceso aprobado** | Se aprueba una solicitud de acceso o se vincula el email al jugador | Jugador (email que solicitó) |
| **Resumen de asistencia** | Período cerrado o resumen semanal/mensual de asistencia | Jugador o tutor (si hay email) |
| **Recordatorio de entrenamiento** | Próximo entrenamiento (opcional, si se implementa calendario) | Jugadores de la categoría |
| **Cambio de horario o sede** | El admin comunica cambio (también vía Novedades) | Todos los jugadores con email |
| **Cumpleaños / felicitación** | Opcional: saludo automático (si se quiere tono más cercano) | Jugador (si tiene email) |

## Tipografía y plantilla

Todos los correos salen con la plantilla definida en `src/lib/email.ts`:

- **buildEmailHtml(contentHtml, options?)**: envuelve el contenido en HTML con estilo Escuelas River (cabecera roja, cuerpo legible, fuente system-ui).
- **sendMailDoc(firestore, payload)**: encola un correo en la colección `mail` (to, subject, html, text).

Para cualquier nueva notificación:

1. Construir el contenido HTML (o texto) del cuerpo.
2. Llamar a `buildEmailHtml(contentHtml, { title?, greeting? })` si querés la plantilla.
3. Llamar a `sendMailDoc(firestore, { to, subject, html, text })` después de la acción (crear evaluación, aprobar acceso, etc.).

## Reglas Firestore

La colección `mail` permite solo **create** para usuarios autenticados; read/update/delete están deshabilitados para el cliente (la extensión actualiza el estado en el backend).
