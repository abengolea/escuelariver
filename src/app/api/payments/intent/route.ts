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
import {
  getOrCreatePaymentConfig,
  getMercadoPagoAccessToken,
  refreshMercadoPagoConnection,
  getExpectedAmountForPeriod,
  findApprovedPayment,
} from '@/lib/payments/db';
import { isMercadoPagoUnauthorizedError } from '@/lib/payments/mercadopago-oauth';
import { verifyIdToken } from '@/lib/auth-server';
import { REGISTRATION_PERIOD } from '@/lib/payments/constants';
import { isRegistrationPeriod, isClothingPeriod } from '@/lib/payments/schemas';

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
      const errMsg = isRegistrationPeriod(period)
        ? 'Ya tenés la inscripción pagada'
        : isClothingPeriod(period)
          ? 'Ya tenés esa cuota de ropa pagada'
          : 'Ya tenés esa cuota pagada';
      return NextResponse.json({ error: errMsg }, { status: 409 });
    }

    // Usar siempre el monto de la config del servidor (seguridad: no confiar en el cliente)
    const amount = await getExpectedAmountForPeriod(db, schoolId, playerId, period, config);
    if (amount <= 0) {
      const errMsg = isRegistrationPeriod(period)
        ? 'La escuela no tiene configuración de cuota de inscripción para esta categoría'
        : isClothingPeriod(period)
          ? 'La escuela no tiene configuración de pago de ropa'
          : 'La escuela no tiene configuración de cuotas mensuales para esta categoría';
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    let mercadopagoAccessToken = provider === 'mercadopago'
      ? await getMercadoPagoAccessToken(db, schoolId)
      : null;

    if (provider === 'mercadopago' && !mercadopagoAccessToken) {
      return NextResponse.json(
        {
          error:
            'La conexión con Mercado Pago de tu escuela expiró. Pedile al administrador que vaya a Administración → Pagos → Configuración y toque "Reconectar Mercado Pago".',
        },
        { status: 400 }
      );
    }

    let checkoutUrl: string;
    let providerPreferenceId: string;
    try {
      ({ checkoutUrl, providerPreferenceId } = await createPaymentIntentWithProvider(
        provider,
        { playerId, schoolId, period, amount, currency, mercadopagoAccessToken }
      ));
    } catch (firstError) {
      if (provider === 'mercadopago' && isMercadoPagoUnauthorizedError(firstError)) {
        try {
          mercadopagoAccessToken = await refreshMercadoPagoConnection(db, schoolId);
          ({ checkoutUrl, providerPreferenceId } = await createPaymentIntentWithProvider(
            provider,
            { playerId, schoolId, period, amount, currency, mercadopagoAccessToken }
          ));
        } catch (retryError) {
          console.error('[payments/intent] MP retry after refresh failed', retryError);
          return NextResponse.json(
            {
              error:
                'No se pudo conectar con Mercado Pago. Pedile al administrador que vaya a Administración → Pagos → Configuración y toque "Reconectar Mercado Pago".',
            },
            { status: 502 }
          );
        }
      } else {
        throw firstError;
      }
    }

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
