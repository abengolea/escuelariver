/** Colecciones Firestore para pagos. */

export const COLLECTIONS = {
  payments: 'payments',
  paymentIntents: 'paymentIntents',
  emailEvents: 'emailEvents',
  schoolFeePayments: 'schoolFeePayments',
} as const;

/** Documento de config global de mensualidades: platformConfig/platformFeeConfig */
export const PLATFORM_FEE_CONFIG_DOC = 'platformFeeConfig';

/** Documento de config de mensualidad por escuela: schools/{schoolId}/schoolFeeConfig/default */
export const SCHOOL_FEE_CONFIG_DOC = 'default';

/** Documento de conexión MP por escuela: schools/{schoolId}/mercadopagoConnection/default */
export const MERCADOPAGO_CONNECTION_DOC = 'default';

export const DEFAULT_CURRENCY = 'ARS';

/** Período usado para el pago único de derecho de inscripción. */
export const REGISTRATION_PERIOD = 'inscripcion';

/** Primer mes cobrado en la app. Febrero 2026 no se exige ni figura como cuota impaga. */
export const FIRST_BILLABLE_PERIOD = '2026-03';

export function isBillableMonthlyPeriod(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period) && period >= FIRST_BILLABLE_PERIOD;
}

/** Prefijo para períodos de pago de ropa: ropa-1, ropa-2, etc. */
export const CLOTHING_PERIOD_PREFIX = 'ropa-';
