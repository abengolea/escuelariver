/**
 * Validadores Zod para el módulo de Pagos.
 */

import { z } from 'zod';

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const CLOTHING_PERIOD_REGEX = /^ropa-\d+$/;
export const REGISTRATION_PERIOD = 'inscripcion';

const periodSchema = z.string().refine(
  (v) => v === REGISTRATION_PERIOD || PERIOD_REGEX.test(v) || CLOTHING_PERIOD_REGEX.test(v),
  { message: 'Período: YYYY-MM, inscripcion o ropa-N' }
);

export const createPaymentIntentSchema = z.object({
  provider: z.enum(['mercadopago', 'dlocal']),
  playerId: z.string().min(1, 'playerId requerido'),
  schoolId: z.string().min(1, 'schoolId requerido'),
  period: periodSchema,
  /** Monto opcional: el servidor lo calcula desde la config (seguridad). */
  amount: z.number().positive('Monto debe ser positivo').optional(),
  currency: z.string().min(1, 'Moneda requerida').default('ARS'),
});

export const markManualPaymentSchema = z.object({
  playerId: z.string().min(1),
  schoolId: z.string().min(1),
  period: periodSchema,
  amount: z.number().positive(),
  currency: z.string().min(1).default('ARS'),
});

/** Editar período de un pago (inscripción ↔ cuota YYYY-MM, admin escuela). */
export const updatePaymentPeriodSchema = z.object({
  paymentId: z.string().min(1, 'paymentId requerido'),
  schoolId: z.string().min(1, 'schoolId requerido'),
  newPeriod: z.string().refine(
    (v) => v === REGISTRATION_PERIOD || PERIOD_REGEX.test(v),
    { message: 'newPeriod: inscripcion o YYYY-MM' }
  ),
});

/** Filtro por concepto: inscripción, cuota mensual, ropa */
export const conceptFilterSchema = z.enum(['inscripcion', 'monthly', 'clothing']).optional();

export const listPaymentsSchema = z.object({
  schoolId: z.string().min(1),
  filters: z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    playerId: z.string().optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'refunded']).optional(),
    period: periodSchema.optional(),
    provider: z.enum(['mercadopago', 'dlocal', 'manual']).optional(),
    /** Filtro por concepto: inscripción, cuota mensual (usa period YYYY-MM), ropa */
    concept: conceptFilterSchema,
  }).optional(),
  limit: z.number().int().min(1).max(10000).default(50),
  offset: z.number().int().min(0).default(0),
});

/** Lista global de pagos jugador→escuela (solo superadmin en API). */
export const listPaymentsGlobalSchema = z.object({
  schoolId: z.string().min(1).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'refunded']).optional(),
  provider: z.enum(['mercadopago', 'dlocal', 'manual']).optional(),
  /** Texto para filtrar por nombre de jugador (post-consulta, insensible a mayúsculas) */
  playerSearch: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(80),
  offset: z.number().int().min(0).default(0),
  /** Incluir últimas intenciones de pago (checkout Mercado Pago, etc.) */
  includeIntents: z.coerce.boolean().default(false),
  intentsLimit: z.number().int().min(1).max(100).default(40),
});

export const listDelinquentsSchema = z.object({
  schoolId: z.string().min(1),
  /** Filtro por concepto: inscripción, cuota mensual, ropa */
  concept: conceptFilterSchema,
  /** Subfiltro: YYYY-MM para cuota mensual, ropa-N para ropa (ej. ropa-1, ropa-2) */
  period: z.string().optional(),
});

/** Item para envío masivo de recordatorios */
const sendReminderItemSchema = z.object({
  playerId: z.string().min(1),
  period: periodSchema,
  playerEmail: z.string().email().optional().nullable(),
  playerName: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(1).default('ARS'),
});

export const sendRemindersSchema = z.object({
  schoolId: z.string().min(1),
  items: z.array(sendReminderItemSchema).min(1).max(50, 'Máximo 50 envíos por lote'),
});

export const paymentConfigSchema = z.object({
  amount: z.number().positive('Monto debe ser positivo'),
  currency: z.string().min(1).default('ARS'),
  dueDayOfMonth: z.number().int().min(1).max(31),
});

/** Valida formato YYYY-MM, inscripción o ropa-N. */
export function isValidPeriod(period: string): boolean {
  return period === REGISTRATION_PERIOD || PERIOD_REGEX.test(period) || CLOTHING_PERIOD_REGEX.test(period);
}

/** Indica si el período es el de inscripción. */
export function isRegistrationPeriod(period: string): boolean {
  return period === REGISTRATION_PERIOD;
}

/** Indica si el período es de pago de ropa (ropa-1, ropa-2, etc.). */
export function isClothingPeriod(period: string): boolean {
  return CLOTHING_PERIOD_REGEX.test(period);
}

/** Obtiene la fecha de vencimiento para un período dado y día del mes. Para ropa-N usa el mes actual. */
export function getDueDate(period: string, dueDayOfMonth: number): Date {
  if (isClothingPeriod(period)) {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const day = Math.min(dueDayOfMonth, lastDay);
    return new Date(now.getFullYear(), now.getMonth(), day);
  }
  const [y, m] = period.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(dueDayOfMonth, lastDay);
  return new Date(y, m - 1, day);
}
