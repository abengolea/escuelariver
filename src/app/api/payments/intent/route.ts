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
import { getOrCreatePaymentConfig } from '@/lib/payments/db';
import { verifyIdToken } from '@/lib/auth-server';

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

    const { provider, playerId, schoolId, period, amount, currency } = parsed.data;
    const db = getAdminFirestore();

    // Verificar que la escuela tenga configuración y el monto coincida (opcional: permitir override)
    const config = await getOrCreatePaymentConfig(db, schoolId);
    if (config.amount <= 0) {
      return NextResponse.json(
        { error: 'La escuela no tiene configuración de cuotas' },
        { status: 400 }
      );
    }

    const { checkoutUrl, providerPreferenceId } = await createPaymentIntentWithProvider(
      provider,
      { playerId, schoolId, period, amount, currency }
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
