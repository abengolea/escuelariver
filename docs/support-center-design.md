# Centro de Soporte: Bot Guiado + Ticketing

## 1. Reconocimiento del repositorio (relevante para soporte)

| Área | Ruta / Detalle |
|------|----------------|
| **Auth y roles** | `src/firebase/auth/use-user-profile.tsx`: `UserProfile`, `isSuperAdmin`, `activeSchoolId`, `role` (school_admin \| coach \| player) |
| **Tipos** | `src/lib/types/index.ts`: `PlatformUser`, `School`, `SchoolUser`, `Player`, `UserProfile`, `SchoolMembership` |
| **Firebase** | `src/firebase/config.ts`, `src/firebase/index.ts`: Auth, Firestore, Storage (client). No hay Firebase Admin en uso; Genkit con `'use server'` |
| **Admin panels** | `src/components/admin/SuperAdminDashboard.tsx`, `SchoolAdminDashboard.tsx`; `src/app/dashboard/schools/[schoolId]/page.tsx` (gestión escuela) |
| **UI** | `src/components/ui/*` (shadcn), `SidebarNav.tsx`, `Header.tsx` |
| **AI** | `src/ai/genkit.ts` (Gemini), `src/ai/flows/*` — Server Actions con `improveCoachCommentsWithAI` etc. |
| **API** | No existen Route Handlers en `app/api/`; lógica server en Server Actions (`'use server'`) |

**Decisiones de arquitectura para soporte:**
- **Flujo guiado:** motor config-driven en cliente; flujos en Firestore `supportFlows`.
- **Tickets:** escritura directa a Firestore desde cliente (reglas por escuela y rol).
- **IA:** nueva Server Action (Genkit) para resumir texto libre y extraer campos; sin llamadas pesadas en cada paso.
- **Operadores:** solo `school_admin` (su escuela) y `super_admin` (todas); dashboard con filtros y actualización de estado en Firestore.

---

## 2. Modelo de datos Firestore

### 2.1 `supportFlows` (colección raíz)

Configuración de flujos; lectura para usuarios autenticados (solo lectura).

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | string | sí (doc id) | Identificador del flujo (ej. `login_access`, `video_upload`) |
| `name` | string | sí | Nombre para operadores |
| `category` | string | sí | Categoría (ej. login_access, permissions, player_edit, video_upload, reports, payments_ui, performance, bug_report) |
| `enabled` | boolean | sí | Si está activo |
| `steps` | map<string, SupportFlowStep> | sí | Paso id → definición del paso |
| `startStepId` | string | sí | Id del primer paso |
| `updatedAt` | timestamp | sí | Última actualización |
| `updatedBy` | string | no | uid quien actualizó |

**Partición multi-tenant:** no; es global (misma config para todas las escuelas). Opcional: `schoolIds` (array) o vacío = todas.

### 2.2 `supportConversations` (subcolección por escuela)

Ruta: `schools/{schoolId}/supportConversations/{conversationId}`

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | string | sí (doc id) | Id de conversación |
| `userId` | string | sí | uid del usuario |
| `userEmail` | string | no | Email (mínimo PII) |
| `userRole` | string | no | school_admin \| coach \| player |
| `flowId` | string | no | Flujo usado |
| `state` | map | no | Estado actual del flujo (stepId, respuestas, etc.) |
| `messages` | array | no | Mensajes chat (opcional; puede vivir solo en cliente hasta crear ticket) |
| `createdAt` | timestamp | sí | |
| `updatedAt` | timestamp | sí | |
| `resolvedAt` | timestamp | no | Si se cerró sin ticket |
| `ticketId` | string | no | Si se creó ticket, referencia |

### 2.3 `supportTickets` (subcolección por escuela)

Ruta: `schools/{schoolId}/supportTickets/{ticketId}`

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `ticketNumber` | number | sí | Número secuencial por escuela (para mostrar #123) |
| `userId` | string | sí | uid quien abrió |
| `userEmail` | string | no | |
| `userDisplayName` | string | no | |
| `userRole` | string | no | |
| `category` | string | sí | Categoría del flujo o AI |
| `severity` | string | sí | low \| medium \| high \| critical |
| `summary` | string | sí | Resumen (usuario o AI) |
| `description` | string | no | Descripción extendida |
| `conversationId` | string | no | Referencia a supportConversations |
| `flowId` | string | no | Flujo que generó el ticket |
| `tags` | array<string> | no | Etiquetas (ej. login, video, report) |
| **Contexto** | | | |
| `deviceInfo` | string | no | UA o "mobile" / "desktop" |
| `route` | string | no | Ruta de la app |
| `affectedPlayerId` | string | no | Jugador afectado (si aplica) |
| **Estado** | | | |
| `status` | string | sí | open \| in_progress \| waiting_user \| resolved \| closed |
| `assignedToUid` | string | no | Operador asignado |
| `internalNotes` | string | no | Notas internas (solo operador) |
| **SLA** | | | |
| `createdAt` | timestamp | sí | |
| `updatedAt` | timestamp | sí | |
| `firstResponseAt` | timestamp | no | Primera respuesta operador |
| `resolvedAt` | timestamp | no | |
| **Feature flag** | | | |
| `schoolId` | string | sí | Redundante para queries (mismo que path) |

### 2.4 `supportTicketEvents` (subcolección del ticket)

Ruta: `schools/{schoolId}/supportTickets/{ticketId}/supportTicketEvents/{eventId}`

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `type` | string | sí | status_change \| assignment \| note_added \| created |
| `fromStatus` | string | no | |
| `toStatus` | string | no | |
| `assignedToUid` | string | no | |
| `createdByUid` | string | sí | |
| `createdAt` | timestamp | sí | |
| `payload` | map | no | Nota, motivo, etc. |

### 2.5 `supportKnowledgeBase` (opcional, colección raíz o por escuela)

Ruta: `supportKnowledgeBase/{articleId}` o `schools/{schoolId}/supportKnowledgeBase/{articleId}`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `title` | string | |
| `slug` | string | Para URL |
| `category` | string | Alineado a categorías de flujo |
| `body` | string | Markdown o texto |
| `updatedAt` | timestamp | |

### Índices Firestore necesarios

- `supportTickets`: (schoolId en path) `status` ASC, `createdAt` DESC; `status` ASC, `assignedToUid` ASC, `createdAt` DESC; `schoolId` (si se usa field), `createdAt` DESC.
- `supportConversations`: (schoolId en path) `userId` ASC, `createdAt` DESC.

---

## 3. Reglas de seguridad Firestore (snippets)

- **supportFlows:** `allow read: if isSignedIn(); allow write: if isSuperAdmin();`
- **supportConversations:** bajo `schools/{schoolId}`:
  - `allow read, create: if isMemberOfSchool(schoolId) && request.auth.uid == request.resource.data.userId;`
  - `allow update: if isMemberOfSchool(schoolId) && (resource.data.userId == request.auth.uid || isSchoolAdmin(schoolId) || isSuperAdmin());`
- **supportTickets:** bajo `schools/{schoolId}`:
  - `allow read: if isMemberOfSchool(schoolId) && (resource.data.userId == request.auth.uid || isSchoolAdmin(schoolId) || isSuperAdmin());`
  - `allow create: if isMemberOfSchool(schoolId) && request.resource.data.userId == request.auth.uid;`
  - `allow update: if isMemberOfSchool(schoolId) && (resource.data.userId == request.auth.uid || isSchoolAdmin(schoolId) || isSuperAdmin());` — restringir en update que solo school_admin/super_admin puedan cambiar `status`, `assignedToUid`, `internalNotes` (ver reglas completas en archivo).
- **supportTicketEvents:** mismo scope que tickets; crear solo desde cliente cuando se hace update de ticket (o desde Cloud Function si se migra). Lectura: mismo que ticket.

---

## 4. Endpoints / Server Actions

| Acción | Método | Descripción |
|--------|--------|-------------|
| **Flow step** | Cliente (lectura Firestore + lógica) o GET/POST `/api/support/flow/step` | Entrada: flowId, stepId, state, userInput. Salida: nextStep, updatedState. |
| **Ticket create** | Cliente → Firestore (create) | Validación con zod en cliente; contexto (device, route) añadido en cliente. |
| **Ticket update** | Cliente → Firestore (update) | Solo operador/superadmin; reglas impiden cambiar status por usuario final. |
| **AI summarize** | Server Action `supportSummarizeAndExtract` | Entrada: freeText. Salida: { summary, category, severity, suggestedTags, missingFields }. |

Request/response con zod y manejo de errores en cada capa.

---

## 5. Componentes cliente

- **SupportCenter:** contenedor de la página Centro de Soporte; incluye SupportBot y enlace a “Mis tickets”.
- **SupportBot:** máquina de estados del flujo; muestra pasos (choice/form/info/ai_free_text/confirm/create_ticket); llama Server Action solo en paso ai_free_text o antes de create_ticket.
- **TicketStatus:** lista de tickets del usuario con estado y enlace al detalle.
- **OperatorDashboard:** filtros por escuela (si superadmin), estado, asignado, fechas; tabla de tickets; actualización de estado/asignación/notas; indicadores SLA.

Sin importar módulos server-only en componentes cliente.

---

## 6. Flujos guiados (decision trees)

Categorías y puntos de entrada:

1. **Login / Acceso** — No puedo iniciar sesión / Olvidé contraseña / Cuenta bloqueada → pasos autoservicio + crear ticket si no se resuelve.
2. **Roles / Permisos** — No veo opciones / Me falta permiso → verificar rol y escuela; ticket con rol actual.
3. **Jugadores** — Crear / Editar / Duplicados → guía + campos jugador afectado.
4. **Videos** — Tamaño/formato/límite + reproducción → límites conocidos (ej. 20s, formatos) + ticket con device/URL.
5. **Informes / Gemini** — Timeouts, salida incorrecta, datos faltantes → severidad + repro steps.
6. **Pagos (solo UI)** — “Pagué y no se refleja” → aclarar que el cobro es con la escuela; ticket para UX de integración.
7. **Rendimiento** — App lenta → device, ruta, último paso.
8. **Bug** — Pasos de reproducción, dispositivo, URL, screenshot opcional (Storage signed URL).

Cada flujo: opciones rápidas → preguntas mínimas → autoservicio → si no resuelve: severidad, rol, dispositivo, repro, playerId → payload de ticket.

---

## 7. Uso de IA

- **Cuándo:** solo con texto libre del usuario o antes de crear ticket (resumir + extraer categoría, severidad, tags, campos faltantes).
- **Plantilla:** prompt con instrucciones en español; salida JSON estricta (schema con zod).
- **Rate limiting:** por uid (ej. 10 req/min) y cache por hash de texto si se repite.

---

## 8. Routing y SLA

- **Prioridad:** payment_ui + critical → high; login bloqueante → high; resto por severidad y volumen.
- **Asignación:** round-robin por escuela o manual; superadmin puede ver todos.
- **SLA:** primer respuesta < 24h; resolución según severidad (ej. critical 24h, high 48h). Estados: open → in_progress → waiting_user | resolved → closed.

---

## 9. Testing

- Unit: motor de flujo (dado state + selection → next step).
- Integración: Server Action summarize (mock Gemini); creación de ticket vía Firestore emulator.
- Reglas: tests en emulador (usuario escuela A no ve tickets escuela B; solo operador cambia status).

---

## 10. Migración y rollout

- Feature flag por escuela en Firestore (ej. `schools/{id}.features.supportCenter: true`) o global.
- Pilotar con una escuela; medir: tasa de deflexión, tiempo medio de resolución, volumen.
- Iterar árboles de decisión según datos.

---

## 11. Checklist de implementación (orden sugerido)

- [x] 1. Tipos TypeScript (flows, tickets, events) — `src/lib/types/support.ts`, re-export en `src/lib/types/index.ts`.
- [x] 2. Reglas Firestore + índices — `firestore.rules`, `firestore.indexes.json` (supportFlows, supportConversations, supportTickets, supportTicketEvents, supportTicketCounter).
- [x] 3. Seed de flujos — `src/lib/support/flows-seed.ts`. Cargar en Firestore en `supportFlows` (manual desde consola o script con Firebase Admin / botón “Cargar flujos” para superadmin).
- [x] 4. Server Action AI summarize + extract — `src/ai/flows/support-summarize.ts` (Gemini, salida JSON estricta).
- [x] 5. Motor de flujo en cliente — `src/lib/support/flow-engine.ts`; API opcional `POST /api/support/flow/step` en `src/app/api/support/flow/step/route.ts`.
- [x] 6. SupportBot + SupportCenter + página `/dashboard/support` — `src/components/support/SupportBot.tsx`, `SupportCenter.tsx`, `src/app/dashboard/support/page.tsx`.
- [x] 7. Creación de ticket (transacción Firestore: contador + ticket + evento) + TicketStatus — en SupportCenter y `TicketStatus.tsx`.
- [x] 8. OperatorDashboard + página `/dashboard/support/operator` — filtros, cambio de estado, notas internas; solo school_admin y superadmin.
- [x] 9. Eventos de auditoría — creación en transacción; status_change y note_added al actualizar desde OperatorDashboard.
- [ ] 10. Telemetría cliente (ruta, timestamp, UA) — ya se envían en `clientContext`; métricas/eventos para deflection/SLA: pendiente de implementar (analytics o eventos custom).
- [ ] 11. Tests unitarios (flow-engine), integración (API/Server Action), reglas (emulador).
- [ ] 12. Feature flag por escuela y rollout piloto — documentar en README o config; opcional campo `schools/{id}.features.supportCenter`.
