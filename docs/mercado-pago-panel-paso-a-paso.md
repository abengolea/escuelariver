# Mercado Pago: Dónde configurar URLs y Webhooks (paso a paso)

Guía para encontrar en el panel de Mercado Pago las configuraciones de **URLs de redireccionamiento** (OAuth) y **Webhooks** (notificaciones de pagos).

---

## Entrada al panel

1. Abrí **[https://www.mercadopago.com.ar/developers/panel/app](https://www.mercadopago.com.ar/developers/panel/app)**
2. Iniciá sesión con la cuenta de **Notificassrl** (o la que use tu app)
3. En la lista de aplicaciones, hacé clic en la **tarjeta de tu aplicación** (Escuelas River, Client ID `3983794964230965`)

---

## 1. URLs de redireccionamiento (OAuth – jugador → escuela)

Para que cada escuela pueda conectarse con “Conectar Mercado Pago”.

1. En la pantalla **Detalles de la aplicación**, hacé clic en **"Editar datos"**
2. Bajá hasta **"Configuraciones avanzadas"**
3. Buscá el campo **"URLs de redireccionamiento"**
4. Agregá esta URL (producción):
   ```
   https://escuelariver--lexflow-consultas.us-east4.hosted.app/api/payments/mercadopago/callback
   ```
5. Opcional (desarrollo): `http://localhost:9002/api/payments/mercadopago/callback`
6. Guardá los cambios

---

## 2. Webhooks (notificaciones de pagos)

Para que Mercado Pago avise cuando un pago se aprueba.

1. En la pantalla de tu aplicación, en el **menú de la izquierda**, buscá **"Webhooks"**
2. Clic en **"Webhooks"** → **"Configurar notificaciones"**
3. En **URL modo producción**, pegá:
   ```
   https://escuelariver--lexflow-consultas.us-east4.hosted.app/api/payments/webhook/mercadopago-platform
   ```
   (Para pagos de escuelas a la plataforma – Notificassrl)
4. Para **jugador → escuela**, la URL se envía en cada pago (no se configura en el panel de Webhooks global). Si querés un webhook global para las escuelas, podés usar:
   ```
   https://escuelariver--lexflow-consultas.us-east4.hosted.app/api/payments/webhook/mercadopago
   ```
   ⚠️ Esta ruta espera `?schoolId=xxx` – normalmente se usa la `notification_url` por preferencia, no el webhook global.

5. En **Eventos**, marcá **"Pagos"** (o "payment")
6. Clic en **"Guardar"**
7. Opcional: usá **"Simular"** para probar que la URL recibe notificaciones

---

## Resumen de URLs para Escuelas River

| Uso | URL |
|-----|-----|
| Redirección OAuth (producción) | `https://escuelariver--lexflow-consultas.us-east4.hosted.app/api/payments/mercadopago/callback` |
| Webhook pagos plataforma (escuela → Notificassrl) | `https://escuelariver--lexflow-consultas.us-east4.hosted.app/api/payments/webhook/mercadopago-platform` |

---

## Si no ves "Webhooks" o "URLs de redireccionamiento"

- **Webhooks**: deberían estar en el menú izquierdo de la app. Si no aparece, puede ser por el tipo de app; revisá en [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app) que la app sea de tipo “Pagos online” / “Checkout Pro” o similar.
- **URLs de redireccionamiento**: están dentro de **Editar datos** → **Configuraciones avanzadas**. Puede que tengas que hacer scroll para llegar a esa sección.

---

## Apps separadas

Si tenés **dos apps** en Mercado Pago:

1. **OAuth (jugador → escuela)**: App Escuelas River (Client ID `3983794964230965`) – configurá URLs de redireccionamiento ahí.
2. **Plataforma (escuela → Notificassrl)**: app de Notificassrl – configurá el webhook `mercadopago-platform` ahí.

Si usás **una sola app** para ambos flujos, configurá todo en esa app.
