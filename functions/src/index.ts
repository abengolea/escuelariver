/**
 * Cloud Functions para Escuela River.
 *
 * - enforceDelinquencyAndSuspensions: Job diario que:
 *   - Recorre jugadores activos por escuela
 *   - Detecta mora >= 10 días → envía email aviso
 *   - Detecta mora >= 30 días → suspende jugador y envía email
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';

// Inicializar Admin si no está inicializado (en emulador puede estar)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/** Día de vencimiento por defecto */
const DEFAULT_DUE_DAY = 10;

/** Fecha de vencimiento para un período YYYY-MM */
function getDueDate(period: string, dueDayOfMonth: number): Date {
  const [y, m] = period.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(dueDayOfMonth, lastDay);
  return new Date(y, m - 1, day);
}

/** Período YYYY-MM a partir de una fecha */
function periodFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Períodos desde activación hasta ahora */
function periodsFromActivationToNow(activatedAt: Date): string[] {
  const periods: string[] = [];
  const now = new Date();
  let d = new Date(activatedAt.getFullYear(), activatedAt.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  while (d <= end) {
    periods.push(periodFromDate(d));
    d.setMonth(d.getMonth() + 1);
  }
  return periods;
}

/** Busca pago aprobado para playerId + period */
async function findApprovedPayment(
  playerId: string,
  period: string
): Promise<boolean> {
  const snap = await db
    .collection('payments')
    .where('playerId', '==', playerId)
    .where('period', '==', period)
    .where('status', '==', 'approved')
    .limit(1)
    .get();
  return !snap.empty;
}

/** Registra y envía email (idempotente) */
async function ensureEmailSent(
  type: string,
  playerId: string,
  schoolId: string,
  period: string
): Promise<boolean> {
  const key = `${type}:${playerId}:${period}`;
  const existing = await db
    .collection('emailEvents')
    .where('idempotencyKey', '==', key)
    .limit(1)
    .get();
  if (!existing.empty) return false;

  // Solo registramos el evento; el envío real lo hace la extensión Trigger Email
  // o un Cloud Function que escuche emailEvents. Por ahora, creamos el doc
  // en emailEvents para idempotencia y el contenido del mail en la colección mail.
  const adminFs = await import('firebase-admin');
  await db.collection('emailEvents').add({
    type,
    playerId,
    schoolId,
    period,
    idempotencyKey: key,
    sentAt: adminFs.firestore.Timestamp.now(),
  });
  return true;
}

/** Encola correo en colección mail (Trigger Email) */
async function enqueueMail(
  to: string,
  subject: string,
  contentHtml: string
): Promise<void> {
  await db.collection('mail').add({
    to,
    message: {
      subject,
      html: contentHtml,
      text: contentHtml.replace(/<[^>]+>/g, ''),
    },
  });
}

/**
 * Job diario: aplicar mora y suspensión.
 * Se ejecuta 1 vez por día (ej. 06:00 AM Argentina).
 */
export const enforceDelinquencyAndSuspensions = onSchedule(
  {
    schedule: '0 9 * * *', // 9:00 UTC = 6:00 Argentina (BRT-3)
    timeZone: 'America/Argentina/Buenos_Aires',
  },
  async () => {
    logger.info('Starting enforceDelinquencyAndSuspensions');
    const now = new Date();

    const schoolsSnap = await db.collection('schools').get();
    let processed = 0;
    let suspended = 0;
    let emailsSent = 0;

    for (const schoolDoc of schoolsSnap.docs) {
      const schoolId = schoolDoc.id;
      const configSnap = await db
        .collection('schools')
        .doc(schoolId)
        .collection('paymentConfig')
        .doc('default')
        .get();
      const config = configSnap.data();
      const amount = config?.amount ?? 0;
      const dueDay = config?.dueDayOfMonth ?? DEFAULT_DUE_DAY;
      const currency = config?.currency ?? 'ARS';
      const moraFromActivation = config?.moraFromActivationMonth !== false;
      const prorateDay = config?.prorateDayOfMonth ?? 15;
      const proratePct = (config?.proratePercent ?? 50) / 100;
      const daysEmail = config?.delinquencyDaysEmail ?? 10;
      const daysSusp = config?.delinquencyDaysSuspension ?? 30;
      if (amount <= 0) continue;

      const playersSnap = await db
        .collection('schools')
        .doc(schoolId)
        .collection('players')
        .where('status', 'in', ['active', 'suspended'])
        .get();

      for (const playerDoc of playersSnap.docs) {
        const playerId = playerDoc.id;
        const playerData = playerDoc.data();
        const playerName = `${playerData.firstName ?? ''} ${playerData.lastName ?? ''}`.trim();
        const toEmail = playerData.email;
        const createdAt = playerData.createdAt?.toDate?.() ?? new Date(playerData.createdAt);
        const activationPeriod = periodFromDate(createdAt);
        const activationDay = createdAt.getDate();
        const periodsToCheck = moraFromActivation
          ? periodsFromActivationToNow(createdAt)
          : (() => {
              const curr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              const prev = new Date(now.getFullYear(), now.getMonth() - 1);
              return [curr, `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`];
            })();

        for (const period of periodsToCheck) {
          const dueDate = getDueDate(period, dueDay);
          if (dueDate > now) continue;

          const hasApproved = await findApprovedPayment(playerId, period);
          if (hasApproved) continue;

          const isActivationMonth = period === activationPeriod;
          const prorated = prorateDay > 0 && isActivationMonth && activationDay > prorateDay;
          const periodAmount = prorated ? Math.round(amount * proratePct) : amount;

          processed++;
          const daysOverdue = Math.floor(
            (now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)
          );

          if (daysOverdue >= daysSusp) {
            await db
              .collection('schools')
              .doc(schoolId)
              .collection('players')
              .doc(playerId)
              .update({ status: 'suspended' });
            suspended++;
            if (toEmail && (await ensureEmailSent('suspension_30_days', playerId, schoolId, period))) {
              const subject = `Suspensión por mora - Cuota ${period} - Escuelas River SN`;
              const content = `
                <p>Hola ${playerName},</p>
                <p>Informamos que por haber superado los 30 días de mora en la cuota del período <strong>${period}</strong> (${currency} ${periodAmount}), tu situación ha sido marcada como <strong>suspendido</strong>.</p>
                <p>Para regularizar: realizá el pago de la cuota adeudada.</p>
              `;
              await enqueueMail(toEmail, subject, content);
              emailsSent++;
            }
          } else if (daysOverdue >= daysEmail) {
            if (toEmail && (await ensureEmailSent('delinquency_10_days', playerId, schoolId, period))) {
              const subject = `Aviso de mora - Cuota ${period} - Escuelas River SN`;
              const content = `
                <p>Hola ${playerName},</p>
                <p>Te recordamos que la cuota correspondiente al período <strong>${period}</strong> (${currency} ${periodAmount}) se encuentra en mora.</p>
                <p>Por favor regularizá tu situación de pago lo antes posible.</p>
              `;
              await enqueueMail(toEmail, subject, content);
              emailsSent++;
            }
          }
        }
      }
    }

    logger.info(`enforceDelinquencyAndSuspensions done: processed=${processed}, suspended=${suspended}, emailsSent=${emailsSent}`);
  }
);
