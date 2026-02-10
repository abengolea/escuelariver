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

export interface CreateIntentParams {
  playerId: string;
  schoolId: string;
  period: string;
  amount: number;
  currency: string;
  /** Access token de Mercado Pago de la escuela (OAuth por escuela). Obligatorio si provider === 'mercadopago'. */
  mercadopagoAccessToken?: string | null;
}

/**
 * Crea intención de pago con el proveedor.
 * Para Mercado Pago se usa el access_token de la escuela (OAuth). Stub: retorna URL de ejemplo hasta integrar SDK real.
 */
export async function createPaymentIntentWithProvider(
  provider: PaymentProvider,
  params: CreateIntentParams
): Promise<CreateIntentResult> {
  if (provider === 'mercadopago' && !params.mercadopagoAccessToken) {
    throw new Error('La escuela no tiene Mercado Pago conectado. Conectá tu cuenta en Administración → Pagos → Configuración.');
  }
  // TODO: MercadoPago SDK - usar params.mercadopagoAccessToken para crear preferencia y obtener init_point
  // TODO: DLocal - crear orden y obtener checkout_url
  const prefId = `stub_${provider}_${Date.now()}`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:9002';
  return {
    checkoutUrl: `${baseUrl}/dashboard/payments/checkout?preference=${prefId}`,
    providerPreferenceId: prefId,
  };
}
