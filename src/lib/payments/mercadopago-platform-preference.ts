/**
 * Creación de preferencia en Mercado Pago para cobro de mensualidad de escuela a la plataforma.
 * Usa MERCADOPAGO_PLATFORM_ACCESS_TOKEN (cuenta Notificassrl - titular de la plataforma).
 */

import { MercadoPagoConfig, Preference } from 'mercadopago';

export interface CreatePlatformPreferenceParams {
  schoolId: string;
  schoolName: string;
  period: string;
  amount: number;
  currency: string;
}

export interface CreatePlatformPreferenceResult {
  init_point: string;
  preference_id: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:9002';

/** external_reference para webhook: platform_fee|schoolId|period */
export function buildPlatformFeeExternalRef(schoolId: string, period: string): string {
  return `platform_fee|${schoolId}|${period}`;
}

export function parsePlatformFeeExternalRef(ref: string): { schoolId: string; period: string } | null {
  const parts = ref.split('|');
  if (parts.length !== 3 || parts[0] !== 'platform_fee') return null;
  const [_, schoolId, period] = parts;
  if (!schoolId || !period) return null;
  return { schoolId, period };
}

/**
 * Crea una preferencia en Mercado Pago para pagar la mensualidad de la escuela a la plataforma.
 * Requiere MERCADOPAGO_PLATFORM_ACCESS_TOKEN en variables de entorno.
 */
export async function createPlatformFeePreference(
  accessToken: string,
  params: CreatePlatformPreferenceParams
): Promise<CreatePlatformPreferenceResult> {
  const client = new MercadoPagoConfig({
    accessToken,
    options: { timeout: 5000 },
  });
  const preferenceClient = new Preference(client);

  const notificationUrl = `${BASE_URL}/api/payments/webhook/mercadopago-platform`;
  const externalReference = buildPlatformFeeExternalRef(params.schoolId, params.period);

  const paymentsUrl = `${BASE_URL}/dashboard/payments`;
  const body = {
    items: [
      {
        id: `school-fee-${params.period}-${params.schoolId}`,
        title: `Mensualidad ${params.period} - ${params.schoolName}`,
        quantity: 1,
        unit_price: params.amount,
        currency_id: params.currency,
      },
    ],
    back_urls: {
      success: `${paymentsUrl}?tab=mensualidad&schoolFee=success`,
      failure: `${paymentsUrl}?tab=mensualidad&schoolFee=failure`,
      pending: `${paymentsUrl}?tab=mensualidad&schoolFee=pending`,
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
