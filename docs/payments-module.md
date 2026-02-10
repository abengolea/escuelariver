# Módulo de Pagos y Morosidad

## Resumen

Módulo implementado para que el administrador de cada escuela controle cuotas de jugadores, vea pagos entrantes, morosos, y el sistema automatice recordatorios y suspensión.

## Archivos creados

### Tipos y validadores
- `src/lib/types/payments.ts` - Interfaces: Payment, PaymentIntent, EmailEvent, PaymentConfig, DelinquentInfo, PlayerStatus
- `src/lib/payments/schemas.ts` - Validadores Zod: createPaymentIntent, markManualPayment, listPayments, listDelinquents
- `src/lib/payments/constants.ts` - Colecciones Firestore

### Acceso a datos (server-only)
- `src/lib/firebase-admin.ts` - Inicialización de Firebase Admin SDK
- `src/lib/auth-server.ts` - Verificación de token Bearer (verifyIdToken)
- `src/lib/payments/db.ts` - Operaciones Firestore: createPayment, findApprovedPayment, listPayments, computeDelinquents, updatePlayerStatus
- `src/lib/payments/email-events.ts` - sendEmailEvent idempotente y enqueue a colección `mail`
- `src/lib/payments/provider-stub.ts` - Stub createPaymentIntentWithProvider (MercadoPago/DLocal)

### API Routes
- `src/app/api/payments/route.ts` - GET: listar pagos con filtros
- `src/app/api/payments/intent/route.ts` - POST: crear intención de pago
- `src/app/api/payments/manual/route.ts` - POST: marcar pago manual (admin)
- `src/app/api/payments/delinquents/route.ts` - GET: listar morosos
- `src/app/api/payments/config/route.ts` - GET/PUT: configuración de cuotas
- `src/app/api/payments/webhook/route.ts` - POST: webhook de proveedores (stub)

### UI
- `src/app/dashboard/payments/page.tsx` - Página principal con tabs
- `src/components/payments/PaymentsTab.tsx` - Tab "Pagos ingresados" + resumen mes
- `src/components/payments/DelinquentsTab.tsx` - Tab "Morosos" + CTA link pago / pago manual
- `src/components/payments/PaymentConfigTab.tsx` - Tab "Configuración"

### Cloud Functions
- `functions/src/index.ts` - enforceDelinquencyAndSuspensions: job diario (9:00 Argentina)

### Archivos modificados
- `src/lib/types/index.ts` - Player.status incluye 'suspended', re-export payments
- `src/components/players/EditPlayerDialog.tsx` - status 'suspended' en schema y select
- `src/components/players/PlayerTable.tsx` - Badge "Suspendido por mora"
- `src/components/layout/SidebarNav.tsx` - Link "Pagos" para school_admin
- `firestore.rules` - Reglas para payments, paymentIntents, emailEvents, paymentConfig
- `firestore.indexes.json` - Índices para consultas de pagos
- `firebase.json` - Configuración de functions

## Cómo testear

### 1. Simular pago aprobado (webhook)

```bash
curl -X POST http://localhost:9002/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "mercadopago",
    "providerPaymentId": "test-123",
    "status": "approved",
    "playerId": "<playerId>",
    "schoolId": "<schoolId>",
    "period": "2025-02",
    "amount": 5000,
    "currency": "ARS"
  }'
```

### 2. Ejecutar job de mora/suspensión localmente

```bash
cd functions
npm install
npm run build
# Ejecutar manualmente (o desplegar y Cloud Scheduler lo ejecutará)
npx ts-node -e "
const { enforceDelinquencyAndSuspensions } = require('./lib/index.js');
enforceDelinquencyAndSuspensions.run();
"
```

O con emulador:
```bash
firebase emulators:start --only functions
# El job se ejecuta según el cron (9:00 Argentina)
```

### 3. Ver emailEvents generados

- En Firestore: colección `emailEvents` (idempotencyKey, type, playerId, period, sentAt)
- En colección `mail`: documentos encolados para Trigger Email

### 4. Configurar cuota por escuela

1. Ir a Dashboard → Pagos → tab "Configuración"
2. Ingresar monto y día de vencimiento
3. Guardar

### 5. Marcar pago manual

1. Ir a Dashboard → Pagos → tab "Morosos"
2. Clic en "Pago manual" para un moroso
3. Ingresar monto y confirmar

## Reglas de mora

- **Desde activación**: El jugador solo debe cuotas desde el mes en que fue activado (createdAt). No puede deber meses anteriores a su alta.
- **Prorrata mes de ingreso**: Si se activa **después del día 15**, la cuota de ese mes es **50%** de la tarifa configurada.

## TODOs pendientes

- **MercadoPago/DLocal**: Integrar SDK real con credenciales (MERCADOPAGO_ACCESS_TOKEN, etc.)
- **Webhook**: Validar firma del payload según documentación de cada proveedor
- **Auth en API**: Verificar que el uid sea admin de la escuela (isSchoolAdmin) en rutas que lo requieren
