/**
 * Validadores Zod para el módulo de Pagos.
 */

import { z } from 'zod';

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
export const REGISTRATION_PERIOD = 'inscripcion';

const periodSchema = z.string().refine(
  (v) => v === REGISTRATION_PERIOD || PERIOD_REGEX.test(v),
  { message: 'Período: YYYY-MM o inscripcion' }
);

export const createPaymentIntentSchema = z.object({
  provider: z.enum(['mercadopago', 'dlocal']),
  playerId: z.string().min(1, 'playerId requerido'),
  schoolId: z.string().min(1, 'schoolId requerido'),
  period: periodSchema,
  amount: z.number().positive('Monto debe ser positivo'),
  currency: z.string().min(1, 'Moneda requerida').default('ARS'),
});

export const markManualPaymentSchema = z.object({
  playerId: z.string().min(1),
  schoolId: z.string().min(1),
  period: periodSchema,
  amount: z.number().positive(),
  currency: z.string().min(1).default('ARS'),
});

export const listPaymentsSchema = z.object({
  schoolId: z.string().min(1),
  filters: z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    playerId: z.string().optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'refunded']).optional(),
    period: periodSchema.optional(),
    provider: z.enum(['mercadopago', 'dlocal', 'manual']).optional(),
  }).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const listDelinquentsSchema = z.object({
  schoolId: z.string().min(1),
});

export const paymentConfigSchema = z.object({
  amount: z.number().positive('Monto debe ser positivo'),
  currency: z.string().min(1).default('ARS'),
  dueDayOfMonth: z.number().int().min(1).max(31),
});

/** Valida formato YYYY-MM o inscripción. */
export function isValidPeriod(period: string): boolean {
  return period === REGISTRATION_PERIOD || PERIOD_REGEX.test(period);
}

/** Indica si el período es el de inscripción. */
export function isRegistrationPeriod(period: string): boolean {
  return period === REGISTRATION_PERIOD;
}

/** Obtiene la fecha de vencimiento para un período dado y día del mes. */
export function getDueDate(period: string, dueDayOfMonth: number): Date {
  const [y, m] = period.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(dueDayOfMonth, lastDay);
  return new Date(y, m - 1, day);
}
