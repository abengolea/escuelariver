/** Colecciones Firestore para pagos. */

export const COLLECTIONS = {
  payments: 'payments',
  paymentIntents: 'paymentIntents',
  emailEvents: 'emailEvents',
} as const;

export const DEFAULT_CURRENCY = 'ARS';

/** Período usado para el pago único de derecho de inscripción. */
export const REGISTRATION_PERIOD = 'inscripcion';
