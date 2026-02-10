/**
 * Tipos y esquemas para el módulo de Pagos y Morosidad.
 * Cada jugador tiene un plan mensual; el sistema registra pagos y aplica mora/suspensión.
 */

// --- Estados ---

export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded';

export type PaymentProvider = 'mercadopago' | 'dlocal' | 'manual';

/** Estado del jugador respecto a pagos: active, inactive, suspended (por mora >= 30 días). */
export type PlayerStatus = 'active' | 'inactive' | 'suspended';

// --- Modelos ---

/** Tipo de pago: cuota mensual o derecho de inscripción (una sola vez por jugador). */
export type PaymentType = 'monthly' | 'registration';

export interface Payment {
  id: string;
  playerId: string;
  schoolId: string;
  period: string; // YYYY-MM para cuota mensual; "inscripcion" para inscripción
  amount: number;
  currency: string;
  provider: PaymentProvider;
  providerPaymentId?: string;
  status: PaymentStatus;
  paidAt?: Date;
  createdAt: Date;
  metadata?: Record<string, unknown>;
  /** Si no viene, se infiere: period === "inscripcion" => registration, sino monthly */
  paymentType?: PaymentType;
}

export interface PaymentIntent {
  id: string;
  playerId: string;
  schoolId: string;
  period: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  providerPreferenceId?: string;
  checkoutUrl?: string;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export type EmailEventType =
  | 'payment_receipt'      // Pago aprobado → recibo
  | 'delinquency_10_days'  // Mora 10 días → aviso
  | 'suspension_30_days';  // Mora 30 días → aviso suspensión

export interface EmailEvent {
  id: string;
  type: EmailEventType;
  playerId: string;
  schoolId: string;
  period: string;
  sentAt: Date;
  idempotencyKey: string; // Para evitar duplicados: type-playerId-period
}

/** Configuración de cuotas y mora por escuela. Almacenada en schools/{schoolId}/paymentConfig/default */
export interface PaymentConfig {
  id: string;
  amount: number;
  currency: string;
  dueDayOfMonth: number; // 1-31: día de vencimiento
  /** Mora desde mes de activación (true) o desde siempre (false). Default true. */
  moraFromActivationMonth?: boolean;
  /** Día del mes: si el jugador se activa después, la cuota del primer mes es prorrateada. 0 = sin prorrata. Default 15. */
  prorateDayOfMonth?: number;
  /** Porcentaje de la cuota en mes de ingreso si activó después de prorateDayOfMonth (0-100). Default 50. */
  proratePercent?: number;
  /** Días de mora para enviar aviso por email. Default 10. */
  delinquencyDaysEmail?: number;
  /** Días de mora para suspender jugador. Default 30. */
  delinquencyDaysSuspension?: number;
  /** Monto del derecho de inscripción inicial (puede ser distinto a la cuota mensual). 0 = sin inscripción. */
  registrationAmount?: number;
  /** true: pagar inscripción cuenta como pagar la cuota del mes de alta. false: inscripción y cuota se pagan por separado (cuota a mes vencido). Default true. */
  registrationCancelsMonthFee?: boolean;
  /** Plantillas opcionales (por ahora placeholders). */
  emailTemplates?: {
    receiptSubject?: string;
    delinquencySubject?: string;
    suspensionSubject?: string;
  };
  updatedAt: Date;
  updatedBy: string;
}

/** Representación de un moroso para el panel admin. */
export interface DelinquentInfo {
  playerId: string;
  playerName: string;
  playerEmail?: string;
  tutorContact: { name: string; phone: string };
  schoolId: string;
  period: string; // YYYY-MM o "inscripcion"
  dueDate: Date;
  daysOverdue: number;
  amount: number;
  currency: string;
  status: PlayerStatus;
  /** true si la cuota es 50% por activación después del día 15 */
  isProrated?: boolean;
  /** true si el ítem pendiente es el derecho de inscripción */
  isRegistration?: boolean;
}
