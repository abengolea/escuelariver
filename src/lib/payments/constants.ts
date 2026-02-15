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

/** Prefijo para períodos de pago de ropa: ropa-1, ropa-2, etc. */
export const CLOTHING_PERIOD_PREFIX = 'ropa-';
