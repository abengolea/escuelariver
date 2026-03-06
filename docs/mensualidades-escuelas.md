# Mensualidades de Escuelas a la Plataforma

Sistema de control de pagos mensuales que las escuelas adheridas realizan a Escuelas River.

## Resumen

- **Super admin** define tarifas por escuela, configuración global (días de mora, % adicional, suspensión) y ve escuelas en mora.
- **Escuelas** que deben ven un aviso en el dashboard y pueden pagar con link a Mercado Pago.
- **Escuela San Nicolás** y otras pueden marcarse como **bonificadas** (sin cargo).
- Si una escuela supera los días configurados sin pagar, se **suspende** automáticamente (job diario).

## Configuración

### 1. Mercado Pago - Cuenta de la plataforma

Para que las escuelas paguen a la plataforma, necesitás un **access token** de la cuenta de **Notificassrl** (titular de la app) en Mercado Pago (no el OAuth por escuela).

1. Entrar con la cuenta de **Notificassrl** en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel/app).
2. Crear o usar una aplicación.
3. Obtener las credenciales de **producción** (Access Token).
4. Configurar el secret en Firebase App Hosting:
   ```bash
   firebase apphosting:secrets:set mercadopago-platform-access-token
   ```
5. Pegar el Access Token cuando lo solicite. Responder **Yes** al grant access para el backend.
6. En la app de Mercado Pago, configurar la **notification_url** para webhooks:
   - Producción: `https://escuelariver--lexflow-consultas.us-east4.hosted.app/api/payments/webhook/mercadopago-platform`

### 2. Configuración global (Super Admin)

En **Panel → Mensualidades → Configuración global**:

- **Día de vencimiento** (1-31): día del mes en que vence la cuota.
- **Días para aviso**: después de cuántos días de mora se muestra el aviso a la escuela.
- **Días para suspensión**: después de cuántos días se suspende la escuela automáticamente.
- **% adicional por mora**: porcentaje que se suma por cada mes de atraso.
- **Tarifa mensual por defecto**: monto para escuelas sin tarifa específica.

### 3. Tarifa por escuela

En **Panel → Mensualidades → Tarifas por escuela**:

- Para cada escuela: **Editar** → definir tarifa mensual ($) o marcar **Bonificada**.
- Escuelas bonificadas (ej. San Nicolás) no pagan ni ven avisos.

## Flujo de pago

1. La escuela tiene cuotas pendientes → ve un banner en el dashboard.
2. Clic en **Pagar ahora** → se genera un link de Mercado Pago (Checkout Pro).
3. La escuela paga con tarjeta, etc.
4. Mercado Pago envía webhook a `/api/payments/webhook/mercadopago-platform`.
5. El pago se registra en `schoolFeePayments` y el aviso desaparece.

## Webhook y URLs

En la app de Mercado Pago (misma o distinta a la de OAuth), la **notification_url** para pagos de plataforma es:

- Producción: `https://escuelariver--lexflow-consultas.us-east4.hosted.app/api/payments/webhook/mercadopago-platform`

No requiere `schoolId` en query porque el `external_reference` es `platform_fee|schoolId|period`.

## Colecciones Firestore

- `platformConfig/platformFeeConfig`: configuración global.
- `schools/{schoolId}/schoolFeeConfig/default`: tarifa y bonificación por escuela.
- `schoolFeePayments`: pagos de mensualidades (creados por API/webhook).

## Cloud Functions

- `enforceSchoolFeeSuspensions`: job diario (7:00 Argentina) que suspende escuelas en mora según `delinquencyDaysSuspension`.

## Bonificar San Nicolás

1. Ir a **Mensualidades → Tarifas por escuela**.
2. Buscar "San Nicolás" (o el nombre de la escuela).
3. Clic en **Editar**.
4. Activar **Bonificada (sin cargo)**.
5. Guardar.
