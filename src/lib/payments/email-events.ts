/**
 * Registro de eventos de email para idempotencia y envío vía Trigger Email.
 * SOLO servidor - usa firebase-admin.
 */

import type admin from 'firebase-admin';
import { buildEmailHtml, escapeHtml } from '@/lib/email';
import type { EmailEventType } from '@/lib/types/payments';

const MAIL_COLLECTION = 'mail';
const EMAIL_EVENTS_COLLECTION = 'emailEvents';

/** Genera idempotency key para evitar duplicados */
export function idempotencyKey(type: EmailEventType, playerId: string, period: string): string {
  return `${type}:${playerId}:${period}`;
}

/** Verifica si ya se envió un email para esta combinación (idempotencia) */
export async function wasEmailSent(
  db: admin.firestore.Firestore,
  idempotencyKeyVal: string
): Promise<boolean> {
  const snap = await db
    .collection(EMAIL_EVENTS_COLLECTION)
    .where('idempotencyKey', '==', idempotencyKeyVal)
    .limit(1)
    .get();
  return !snap.empty;
}

/** Registra el evento de email enviado (para idempotencia) */
export async function recordEmailEvent(
  db: admin.firestore.Firestore,
  data: {
    type: EmailEventType;
    playerId: string;
    schoolId: string;
    period: string;
    idempotencyKey: string;
  }
): Promise<void> {
  const admin = await import('firebase-admin');
  await db.collection(EMAIL_EVENTS_COLLECTION).add({
    ...data,
    sentAt: admin.firestore.Timestamp.now(),
  });
}

/**
 * Encola un correo en la colección `mail` para Trigger Email.
 * Formato esperado por la extensión firestore-send-email.
 */
async function enqueueMail(
  db: admin.firestore.Firestore,
  payload: { to: string; subject: string; html: string; text?: string }
): Promise<void> {
  await db.collection(MAIL_COLLECTION).add({
    to: payload.to,
    message: {
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? payload.html.replace(/<[^>]+>/g, ''),
    },
  });
}

export interface SendEmailEventParams {
  db: admin.firestore.Firestore;
  type: EmailEventType;
  playerId: string;
  schoolId: string;
  period: string;
  to: string;
  playerName: string;
  amount: number;
  currency: string;
  /** Para payment_receipt: fecha del pago */
  paidAt?: Date;
}

/**
 * Envía evento de email de forma idempotente.
 * Solo envía si no existe registro previo con el mismo idempotencyKey.
 */
export async function sendEmailEvent(params: SendEmailEventParams): Promise<boolean> {
  const { db, type, playerId, schoolId, period, to, playerName, amount, currency, paidAt } = params;
  const key = idempotencyKey(type, playerId, period);

  if (await wasEmailSent(db, key)) {
    return false; // Ya enviado, skip
  }

  const amountStr = `${currency} ${amount.toLocaleString('es-AR')}`;

  let subject: string;
  let contentHtml: string;

  switch (type) {
    case 'payment_receipt':
      subject = `Recibo de pago - Cuota ${period} - Escuelas River SN`;
      contentHtml = `
        <p>Hola ${escapeHtml(playerName)},</p>
        <p>Confirmamos la recepción del pago correspondiente al período <strong>${period}</strong>.</p>
        <p><strong>Monto:</strong> ${amountStr}</p>
        <p><strong>Fecha de pago:</strong> ${paidAt ? paidAt.toLocaleDateString('es-AR') : '-'}</p>
        <p>Gracias por mantener tu cuota al día.</p>
      `;
      break;
    case 'delinquency_10_days':
      subject = `Aviso de mora - Cuota ${period} - Escuelas River SN`;
      contentHtml = `
        <p>Hola ${escapeHtml(playerName)},</p>
        <p>Te recordamos que la cuota correspondiente al período <strong>${period}</strong> (${amountStr}) se encuentra en mora.</p>
        <p>Por favor regularizá tu situación de pago lo antes posible para continuar participando en las actividades.</p>
        <p>Si ya realizaste el pago, ignora este mensaje.</p>
      `;
      break;
    case 'suspension_30_days':
      subject = `Suspensión por mora - Cuota ${period} - Escuelas River SN`;
      contentHtml = `
        <p>Hola ${escapeHtml(playerName)},</p>
        <p>Informamos que por haber superado los 30 días de mora en la cuota del período <strong>${period}</strong> (${amountStr}), tu situación ha sido marcada como <strong>suspendido</strong>.</p>
        <p>Para regularizar: realizá el pago de la cuota adeudada. Una vez acreditado, tu estado se reactivará automáticamente.</p>
        <p>Si tenés dudas, contactá a la administración de tu escuela.</p>
      `;
      break;
    default:
      throw new Error(`Unknown email event type: ${type}`);
  }

  const html = buildEmailHtml(contentHtml, {
    title: subject,
    greeting: `Estimado/a responsable de ${escapeHtml(playerName)}:`,
  });

  await enqueueMail(db, { to, subject, html });
  await recordEmailEvent(db, { type, playerId, schoolId, period, idempotencyKey: key });
  return true;
}
