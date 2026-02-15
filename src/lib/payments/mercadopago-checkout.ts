/**
 * Creación de preferencia de Checkout Pro en Mercado Pago.
 * Usa el access_token de la escuela (OAuth por escuela).
 */

import { MercadoPagoConfig, Preference } from 'mercadopago';

export interface CreatePreferenceParams {
  playerId: string;
  schoolId: string;
  period: string;
  amount: number;
  currency: string;
}

export interface CreatePreferenceResult {
  init_point: string;
  preference_id: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:9002';

/**
 * Crea una preferencia en Mercado Pago y devuelve init_point y id.
 * external_reference = schoolId|playerId|period para el webhook.
 * notification_url incluye schoolId para poder usar el token correcto al consultar el pago.
 */
export async function createMercadoPagoPreference(
  accessToken: string,
  params: CreatePreferenceParams
): Promise<CreatePreferenceResult> {
  const client = new MercadoPagoConfig({
    accessToken,
    options: { timeout: 5000 },
  });
  const preferenceClient = new Preference(client);

  const title =
    params.period === 'inscripcion'
      ? 'Derecho de inscripción - Escuela River'
      : params.period.startsWith('ropa-')
        ? `Pago de ropa (${params.period.replace('ropa-', '')}) - Escuela River`
        : `Cuota ${params.period} - Escuela River`;

  const notificationUrl = `${BASE_URL}/api/payments/webhook/mercadopago?schoolId=${encodeURIComponent(params.schoolId)}`;
  const externalReference = `${params.schoolId}|${params.playerId}|${params.period}`;

  const paymentsUrl = `${BASE_URL}/dashboard/payments`;
  const body = {
    items: [
      {
        id: `cuota-${params.period}-${params.playerId}`,
        title,
        quantity: 1,
        unit_price: params.amount,
        currency_id: params.currency,
      },
    ],
    back_urls: {
      success: `${paymentsUrl}?payment=success`,
      failure: `${paymentsUrl}?payment=failure`,
      pending: `${paymentsUrl}?payment=pending`,
    },
    auto_return: 'approved' as const,
    notification_url: notificationUrl,
    external_reference: externalReference,
  };

  const response = await preferenceClient.create({ body });

  const initPoint = response.init_point ?? response.sandbox_init_point;
  const preferenceId = response.id;

  if (!initPoint || !preferenceId) {
    throw new Error('Mercado Pago no devolvió init_point o id de preferencia');
  }

  return { init_point: initPoint, preference_id: preferenceId };
}
