/**
 * Stub de integración con proveedores de pago (MercadoPago, DLocal).
 * TODO: Reemplazar por integración real con credenciales.
 *
 * MercadoPago: https://www.mercadopago.com.ar/developers
 * DLocal: https://docs.dlocal.com/
 */

import type { PaymentProvider } from '@/lib/types/payments';

export interface CreateIntentResult {
  checkoutUrl: string;
  providerPreferenceId: string;
}

/**
 * Crea intención de pago con el proveedor.
 * STUB: retorna URL de ejemplo. Integrar con SDK real de MercadoPago/DLocal.
 */
export async function createPaymentIntentWithProvider(
  provider: PaymentProvider,
  _params: {
    playerId: string;
    schoolId: string;
    period: string;
    amount: number;
    currency: string;
  }
): Promise<CreateIntentResult> {
  // TODO: MercadoPago SDK - crear preferencia y obtener init_point
  // TODO: DLocal - crear orden y obtener checkout_url
  // Credenciales: process.env.MERCADOPAGO_ACCESS_TOKEN, process.env.DLOCAL_*
  const prefId = `stub_${provider}_${Date.now()}`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:9002';
  return {
    checkoutUrl: `${baseUrl}/dashboard/payments/checkout?preference=${prefId}`,
    providerPreferenceId: prefId,
  };
}
