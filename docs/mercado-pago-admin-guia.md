# Mercado Pago: mensaje para el representante de la escuela

Texto que podés dar al admin/representante de la escuela para que conecte su cuenta (vinculación por OAuth).

---

## Mensaje para el representante

Para que **tu escuela cobre directamente en su cuenta de Mercado Pago** desde la app, tenés que “conectar” tu cuenta (autorización). **No tenés que enviarnos claves ni contraseñas.**

1. Ingresá a la app con tu usuario de **representante/administrador**.
2. Andá a **Administración → Pagos → Configuración** (o **Pagos → pestaña Configuración**).
3. En la sección **Mercado Pago**, tocá **“Conectar Mercado Pago”**.
4. La app te va a llevar a Mercado Pago: **iniciá sesión** y presioná **“Autorizar”** (esto permite que la app genere cobros para tu escuela y se acrediten en tu cuenta).
5. Al finalizar, volvés a la app y te tiene que aparecer el estado **“Cuenta conectada”**.

**Importante:**

- No nos mandes tokens, claves ni capturas: la conexión se hace con **autorización oficial** de Mercado Pago.
- Si Mercado Pago pide verificación de identidad/datos, completalo para evitar bloqueos.

---

## Nota técnica (para vos / tu equipo)

Para que **cada escuela cobre directo** en su propia cuenta:

1. **Una sola app en Mercado Pago Developers** (la de la plataforma Escuela River): crear aplicación, tipo “Pagos online” / OAuth.
2. **OAuth (authorization code)** para que cada escuela autorice la app: el admin va a Administración → Pagos → Configuración → “Conectar Mercado Pago”, se redirige a `auth.mercadopago.com`, autoriza, y el callback intercambia el `code` por `access_token` y `refresh_token` y los guarda por `schoolId` en Firestore (`schools/{schoolId}/mercadopagoConnection/default`).
3. **Cobrar con el token de la escuela**: al crear una intención de pago para esa escuela, se usa el `access_token` guardado para esa escuela (no un token global).
4. **Webhooks** para conciliar pagos (ver `docs/payments-module.md` y `src/app/api/payments/webhook/route.ts`).

### Variables de entorno (servidor)

| Variable | Descripción |
|----------|-------------|
| `MERCADOPAGO_CLIENT_ID` | ID de la aplicación (Mercado Pago Developers → Tu app → Credenciales). |
| `MERCADOPAGO_CLIENT_SECRET` | Secret de la aplicación (mismo lugar). |
| `NEXT_PUBLIC_APP_URL` | URL base de la app (ej. `https://escuelariver--lexflow-consultas.us-east4.hosted.app`) para armar `redirect_uri`. |
| `MERCADOPAGO_USE_TEST_TOKENS` | Opcional. Si es `true`, al intercambiar el code se pide token de prueba (`test_token: true`). |

**Firebase App Hosting (producción):** `MERCADOPAGO_CLIENT_SECRET` se configura como secret. Ejecutá una sola vez: `firebase apphosting:secrets:set mercadopago-client-secret` y pegá el valor del secret de la app de Mercado Pago. El `apphosting.yaml` ya referencia este secret y la URL de producción.

### URLs de redirección en la app de Mercado Pago

**Dónde configurarlas (paso a paso):**

1. Entrá al **Panel del desarrollador**: [https://www.mercadopago.com.ar/developers/panel/app](https://www.mercadopago.com.ar/developers/panel/app) (iniciá sesión si hace falta).
2. En la lista de aplicaciones, **hacé clic en la tarjeta de tu aplicación** (la que tiene el Client ID que usás en la app).
3. En la pantalla **Detalles de la aplicación**, hacé clic en el botón **"Editar datos"**.
4. Bajá hasta la sección **"Configuraciones avanzadas"**.
5. Ahí vas a ver el campo **"URLs de redireccionamiento"**. Agregá cada URL en una línea (o el formato que permita el panel):
   - Desarrollo: `http://localhost:9002/api/payments/mercadopago/callback`
   - Staging: `https://tu-staging.com/api/payments/mercadopago/callback`
   - Producción: `https://escuelariver--lexflow-consultas.us-east4.hosted.app/api/payments/mercadopago/callback`
6. Guardá los cambios.

El `redirect_uri` que usa la app es exactamente: `{NEXT_PUBLIC_APP_URL}/api/payments/mercadopago/callback`.

### Archivos relevantes

- `src/lib/payments/mercadopago-oauth.ts` – URL de autorización, state firmado, intercambio code → tokens.
- `src/app/api/payments/mercadopago/connect/route.ts` – Devuelve la URL para que el cliente redirija a MP.
- `src/app/api/payments/mercadopago/callback/route.ts` – Recibe `code` y `state`, intercambia tokens, guarda por schoolId, redirige a `/dashboard/payments?tab=config`.
- `src/app/api/payments/mercadopago/status/route.ts` – GET estado “conectado” por escuela.
- `src/lib/payments/db.ts` – `getMercadoPagoConnection`, `setMercadoPagoConnection`, `getMercadoPagoAccessToken`.
- `src/lib/payments/provider-stub.ts` – Recibe `mercadopagoAccessToken` por escuela; reemplazar por SDK real para crear preferencia y obtener `init_point`.

### Renovación del access token

Mercado Pago expira el access token (ej. 180 días). Usar el **refresh token** para renovar sin que el admin vuelva a autorizar. Ver documentación: [Renovar Access Token](https://www.mercadopago.com.ar/developers/es/docs/security/oauth/renewal). Pendiente implementar la renovación automática (cron o al usar el token).
