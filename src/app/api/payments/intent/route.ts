/**
 * POST /api/payments/intent
 * Crea una intención de pago (payment intent) para jugador + período.
 * Retorna checkoutUrl y providerPreferenceId.
 */

import { NextResponse } from 'next/server';
import { createPaymentIntentSchema } from '@/lib/payments/schemas';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { createPaymentIntent } from '@/lib/payments/db';
import { createPaymentIntentWithProvider } from '@/lib/payments/provider-stub';
import { getOrCreatePaymentConfig, getMercadoPagoAccessToken, getExpectedAmountForPeriod, findApprovedPayment } from '@/lib/payments/db';
import { verifyIdToken } from '@/lib/auth-server';
import { REGISTRATION_PERIOD } from '@/lib/payments/constants';

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createPaymentIntentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { provider, playerId, schoolId, period, currency } = parsed.data;
    const db = getAdminFirestore();

    const config = await getOrCreatePaymentConfig(db, schoolId);

    // Verificar que lo que quiere pagar no esté ya pagado
    const existingPayment = await findApprovedPayment(db, playerId, period);
    if (existingPayment) {
      return NextResponse.json(
        {
          error: isRegistration
            ? 'Ya tenés la inscripción pagada'
            : 'Ya tenés esa cuota pagada',
        },
        { status: 409 }
      );
    }

    // Usar siempre el monto de la config del servidor (seguridad: no confiar en el cliente)
    const isRegistration = period === REGISTRATION_PERIOD;
    const amount = await getExpectedAmountForPeriod(db, schoolId, playerId, period, config);
    if (amount <= 0) {
      return NextResponse.json(
        {
          error: isRegistration
            ? 'La escuela no tiene configuración de cuota de inscripción para esta categoría'
            : 'La escuela no tiene configuración de cuotas mensuales para esta categoría',
        },
        { status: 400 }
      );
    }

    const mercadopagoAccessToken = provider === 'mercadopago'
      ? await getMercadoPagoAccessToken(db, schoolId)
      : null;

    if (provider === 'mercadopago' && !mercadopagoAccessToken) {
      return NextResponse.json(
        { error: 'Tu escuela no tiene Mercado Pago conectado. Andá a Administración → Pagos → Configuración y tocá "Conectar Mercado Pago".' },
        { status: 400 }
      );
    }

    const { checkoutUrl, providerPreferenceId } = await createPaymentIntentWithProvider(
      provider,
      { playerId, schoolId, period, amount, currency, mercadopagoAccessToken }
    );

    const intent = await createPaymentIntent(db, {
      playerId,
      schoolId,
      period,
      amount,
      currency,
      provider,
      providerPreferenceId,
      checkoutUrl,
    });

    return NextResponse.json({
      intentId: intent.id,
      checkoutUrl,
      providerPreferenceId,
      status: intent.status,
    });
  } catch (e) {
    console.error('[payments/intent]', e);
    return NextResponse.json(
      { error: 'Error al crear intención de pago' },
      { status: 500 }
    );
  }
}
