/**
 * Acceso a Firestore para pagos - SOLO servidor (usa firebase-admin).
 * Usa API namespaced de firebase-admin (db.collection, ref.add, etc.)
 */

import type admin from 'firebase-admin';
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase-admin';
import { COLLECTIONS, REGISTRATION_PERIOD, MERCADOPAGO_CONNECTION_DOC } from './constants';
import { getDueDate, isRegistrationPeriod } from './schemas';
import type { Payment, PaymentIntent, PaymentConfig, DelinquentInfo, MercadoPagoConnection } from '@/lib/types/payments';
import type { Player } from '@/lib/types';

type Firestore = admin.firestore.Firestore;
type DocumentSnapshot = admin.firestore.DocumentSnapshot;
type Timestamp = admin.firestore.Timestamp;

function toDate(val: unknown): Date {
  if (val instanceof Date) return val;
  const t = val as { toDate?: () => Date };
  if (typeof t?.toDate === 'function') return t.toDate();
  if (typeof val === 'string') return new Date(val);
  return new Date();
}

/** Convierte doc Firestore a Payment */
function toPayment(docSnap: DocumentSnapshot): Payment {
  const d = docSnap.data()!;
  const period = d.period as string;
  return {
    id: docSnap.id,
    playerId: d.playerId,
    schoolId: d.schoolId,
    period,
    amount: d.amount,
    currency: d.currency ?? 'ARS',
    provider: d.provider,
    providerPaymentId: d.providerPaymentId,
    status: d.status,
    paidAt: d.paidAt ? toDate(d.paidAt) : undefined,
    createdAt: toDate(d.createdAt),
    metadata: d.metadata,
    paymentType: d.paymentType ?? (isRegistrationPeriod(period) ? 'registration' : 'monthly'),
  };
}

/** Obtiene o crea configuración de pagos por escuela */
export async function getOrCreatePaymentConfig(
  db: Firestore,
  schoolId: string
): Promise<PaymentConfig> {
  const configRef = db.collection('schools').doc(schoolId).collection('paymentConfig').doc('default');
  const snap = await configRef.get();
  if (snap.exists) {
    const d = snap.data()!;
    return {
      id: snap.id,
      amount: d.amount ?? 0,
      currency: d.currency ?? 'ARS',
      dueDayOfMonth: d.dueDayOfMonth ?? 10,
      moraFromActivationMonth: d.moraFromActivationMonth ?? true,
      prorateDayOfMonth: d.prorateDayOfMonth ?? 15,
      proratePercent: d.proratePercent ?? 50,
      delinquencyDaysEmail: d.delinquencyDaysEmail ?? 10,
      delinquencyDaysSuspension: d.delinquencyDaysSuspension ?? 30,
      registrationAmount: d.registrationAmount ?? 0,
      registrationCancelsMonthFee: d.registrationCancelsMonthFee !== false,
      emailTemplates: d.emailTemplates,
      updatedAt: toDate(d.updatedAt),
      updatedBy: d.updatedBy ?? '',
    };
  }
  return {
    id: 'default',
    amount: 0,
    currency: 'ARS',
    dueDayOfMonth: 10,
    moraFromActivationMonth: true,
    prorateDayOfMonth: 15,
    proratePercent: 50,
    delinquencyDaysEmail: 10,
    delinquencyDaysSuspension: 30,
    registrationAmount: 0,
    registrationCancelsMonthFee: true,
    updatedAt: new Date(),
    updatedBy: '',
  };
}

/** Obtiene la conexión Mercado Pago de la escuela, si existe. */
export async function getMercadoPagoConnection(
  db: Firestore,
  schoolId: string
): Promise<MercadoPagoConnection | null> {
  const ref = db.collection('schools').doc(schoolId).collection('mercadopagoConnection').doc(MERCADOPAGO_CONNECTION_DOC);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at,
    mp_user_id: d.mp_user_id,
    connected_at: toDate(d.connected_at),
  };
}

/** Guarda la conexión OAuth de Mercado Pago para la escuela. */
export async function setMercadoPagoConnection(
  db: Firestore,
  schoolId: string,
  data: Omit<MercadoPagoConnection, 'connected_at'> & { connected_at: Date }
): Promise<void> {
  const admin = await import('firebase-admin');
  const ref = db.collection('schools').doc(schoolId).collection('mercadopagoConnection').doc(MERCADOPAGO_CONNECTION_DOC);
  const connectedAt = data.connected_at instanceof Date ? data.connected_at : new Date(data.connected_at);
  await ref.set({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at ?? null,
    mp_user_id: data.mp_user_id ?? null,
    connected_at: admin.firestore.Timestamp.fromDate(connectedAt),
  });
}

/** Obtiene el access_token de Mercado Pago para la escuela (para cobrar a nombre de esa escuela). Retorna null si no está conectada. */
export async function getMercadoPagoAccessToken(db: Firestore, schoolId: string): Promise<string | null> {
  const conn = await getMercadoPagoConnection(db, schoolId);
  return conn?.access_token ?? null;
}

/** Verifica que el jugador exista en esa escuela y no esté archivado. Regla: solo crear pagos con jugadores no archivados. */
export async function playerExistsInSchool(
  db: Firestore,
  schoolId: string,
  playerId: string
): Promise<boolean> {
  const ref = db.collection('schools').doc(schoolId).collection('players').doc(playerId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const archived = snap.data()?.archived === true;
  return !archived;
}

/** Busca pago aprobado por playerId + period (evitar duplicados) */
export async function findApprovedPayment(
  db: Firestore,
  playerId: string,
  period: string
): Promise<Payment | null> {
  const snap = await db
    .collection(COLLECTIONS.payments)
    .where('playerId', '==', playerId)
    .where('period', '==', period)
    .where('status', '==', 'approved')
    .get();
  if (snap.empty) return null;
  return toPayment(snap.docs[0]);
}

/** Busca pago aprobado de inscripción para un jugador (una sola vez por jugador). */
export async function findApprovedRegistrationPayment(
  db: Firestore,
  playerId: string
): Promise<Payment | null> {
  return findApprovedPayment(db, playerId, REGISTRATION_PERIOD);
}

/** Busca pago por provider + providerPaymentId (evitar duplicados) */
export async function findPaymentByProviderId(
  db: Firestore,
  provider: string,
  providerPaymentId: string
): Promise<Payment | null> {
  const snap = await db
    .collection(COLLECTIONS.payments)
    .where('provider', '==', provider)
    .where('providerPaymentId', '==', providerPaymentId)
    .get();
  if (snap.empty) return null;
  return toPayment(snap.docs[0]);
}

/**
 * Crea Payment document.
 * Si se pasa idempotencyKey (ej. "mercadopago_12345"), se usa como ID de documento:
 * si ya existe, se devuelve ese pago (evita duplicados por doble notificación de MP).
 */
export async function createPayment(
  db: Firestore,
  data: Omit<Payment, 'id' | 'createdAt'>,
  idempotencyKey?: string
): Promise<Payment> {
  const paymentType = data.paymentType ?? (isRegistrationPeriod(data.period) ? 'registration' : 'monthly');
  const admin = await import('firebase-admin');
  const now = admin.firestore.Timestamp.now();
  const col = db.collection(COLLECTIONS.payments);

  if (idempotencyKey) {
    const ref = col.doc(idempotencyKey);
    const existing = await ref.get();
    if (existing.exists) return toPayment(existing);
    await ref.set({
      ...data,
      paymentType,
      paidAt: data.paidAt ?? null,
      createdAt: now,
    });
    const snap = await ref.get();
    return toPayment(snap);
  }

  const ref = await col.add({
    ...data,
    paymentType,
    paidAt: data.paidAt ?? null,
    createdAt: now,
  });
  const snap = await ref.get();
  return toPayment(snap);
}

/** Crea PaymentIntent (status se setea a 'pending' internamente) */
export async function createPaymentIntent(
  db: Firestore,
  data: Omit<PaymentIntent, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<PaymentIntent> {
  const admin = await import('firebase-admin');
  const now = admin.firestore.Timestamp.now();
  const ref = await db.collection(COLLECTIONS.paymentIntents).add({
    ...data,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
  const snap = await ref.get();
  const d = snap.data()!;
  return {
    id: snap.id,
    ...data,
    status: d.status ?? 'pending',
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

/** Obtiene nombres de jugadores por IDs (schools/{schoolId}/players). Si el ID no es un doc, intenta resolverlo como UID de Firebase Auth (email → playerLogins → jugador). */
export async function getPlayerNames(
  db: Firestore,
  schoolId: string,
  playerIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(playerIds)];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const playersRef = db.collection('schools').doc(schoolId).collection('players');
  const batchSize = 10;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const snaps = await Promise.all(batch.map((id) => playersRef.doc(id).get()));
    snaps.forEach((snap, idx) => {
      const id = batch[idx];
      if (snap.exists) {
        const d = snap.data()!;
        const first = d.firstName ?? (d as Record<string, unknown>).first_name ?? '';
        const last = d.lastName ?? (d as Record<string, unknown>).last_name ?? '';
        const name = `${first} ${last}`.trim();
        map.set(id, name || id);
      } else {
        map.set(id, id);
      }
    });
  }
  // Fallback 1: el ID puede ser el doc id del jugador pero en OTRA escuela (p. ej. Gregorio: doc id Xt2r6Fx2yT0IG0QCd7Ai en otra escuela)
  const missingIds = unique.filter((id) => map.get(id) === id);
  if (missingIds.length === 0) return map;
  const schoolsSnap = await db.collection('schools').get();
  for (const id of missingIds) {
    for (const schoolDoc of schoolsSnap.docs) {
      const ref = db.collection('schools').doc(schoolDoc.id).collection('players').doc(id);
      const snap = await ref.get();
      if (snap.exists) {
        const d = snap.data()!;
        const first = d.firstName ?? (d as Record<string, unknown>).first_name ?? '';
        const last = d.lastName ?? (d as Record<string, unknown>).last_name ?? '';
        const name = `${first} ${last}`.trim();
        if (name) map.set(id, name);
        break;
      }
    }
  }
  // Fallback 2: ids que siguen faltando pueden ser UID de Firebase Auth (pago guardó UID en vez del doc id)
  const stillMissing = missingIds.filter((id) => map.get(id) === id);
  if (stillMissing.length === 0) return map;
  let auth: ReturnType<typeof getAdminAuth>;
  try {
    auth = getAdminAuth();
  } catch {
    return map;
  }
  for (const id of stillMissing) {
    try {
      const user = await auth.getUser(id);
      const emailNorm = (user.email ?? '').trim().toLowerCase();
      if (!emailNorm) continue;
      let playerSnap: admin.firestore.DocumentSnapshot | null = null;
      // 1) Intentar por playerLogins (email → schoolId, playerId) si tiene escuela asignada para login
      const loginSnap = await db.collection('playerLogins').doc(emailNorm).get();
      if (loginSnap.exists) {
        const { schoolId: loginSchoolId, playerId: docId } = loginSnap.data() as { schoolId: string; playerId: string };
        if (loginSchoolId === schoolId) {
          playerSnap = await playersRef.doc(docId).get();
        }
      }
      // 2) Si no tiene playerLogins o la escuela no coincide, buscar por email en esta escuela
      if (!playerSnap?.exists) {
        const byEmail = await playersRef.where('email', '==', emailNorm).limit(1).get();
        playerSnap = byEmail.empty ? null : byEmail.docs[0];
      }
      // 3) Si sigue sin aparecer (jugador en otra escuela o creado sin escuela), buscar en todas las escuelas
      if (!playerSnap?.exists) {
        const schoolsSnap = await db.collection('schools').get();
        for (const schoolDoc of schoolsSnap.docs) {
          const ref = db.collection('schools').doc(schoolDoc.id).collection('players');
          const byEmail = await ref.where('email', '==', emailNorm).limit(1).get();
          if (!byEmail.empty) {
            playerSnap = byEmail.docs[0];
            break;
          }
        }
      }
      if (playerSnap?.exists) {
        const d = playerSnap.data()!;
        const first = d.firstName ?? (d as Record<string, unknown>).first_name ?? '';
        const last = d.lastName ?? (d as Record<string, unknown>).last_name ?? '';
        const name = `${first} ${last}`.trim();
        if (name) map.set(id, name);
      } else {
        // 4) Último recurso: usar displayName del usuario de Auth si existe (p. ej. "Gregorio Bengolea")
        const displayName = (user.displayName ?? '').trim();
        if (displayName) map.set(id, displayName);
      }
    } catch {
      // id no es un UID de Auth o no hay jugador vinculado; dejar el id como está
    }
  }
  return map;
}

/** Obtiene los IDs de jugadores archivados de una escuela (para excluir sus pagos de totales). */
export async function getArchivedPlayerIds(
  db: Firestore,
  schoolId: string
): Promise<Set<string>> {
  const snap = await db
    .collection('schools')
    .doc(schoolId)
    .collection('players')
    .get();
  const ids = new Set<string>();
  snap.docs.forEach((d) => {
    if (d.data()?.archived === true) ids.add(d.id);
  });
  return ids;
}

/** Lista pagos con filtros */
export async function listPayments(
  db: Firestore,
  schoolId: string,
  opts: {
    dateFrom?: string;
    dateTo?: string;
    playerId?: string;
    status?: string;
    period?: string;
    provider?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ payments: Payment[]; total: number }> {
  let q = db
    .collection(COLLECTIONS.payments)
    .where('schoolId', '==', schoolId)
    .orderBy('createdAt', 'desc') as admin.firestore.Query;

  if (opts.playerId) q = q.where('playerId', '==', opts.playerId);
  if (opts.status) q = q.where('status', '==', opts.status);
  if (opts.period) q = q.where('period', '==', opts.period);
  if (opts.provider) q = q.where('provider', '==', opts.provider);

  const limitVal = opts.limit ?? 50;
  const offsetVal = opts.offset ?? 0;

  const snap = await q.get();
  let docs = snap.docs;

  // Filtros post-query (dateFrom/dateTo) para no requerir índices compuestos
  if (opts.dateFrom || opts.dateTo) {
    const from = opts.dateFrom ? new Date(opts.dateFrom).getTime() : 0;
    const to = opts.dateTo ? new Date(opts.dateTo).getTime() : Infinity;
    docs = docs.filter((docSnap) => {
      const created = docSnap.data().createdAt?.toMillis?.() ?? new Date(docSnap.data().createdAt).getTime();
      return created >= from && created <= to;
    });
  }

  const total = docs.length;
  const paginated = docs.slice(offsetVal, offsetVal + limitVal);
  const payments = paginated.map((d) => toPayment(d));
  return { payments, total };
}

/** Obtiene jugadores activos de una escuela (no archivados) con su configuración de pago */
export async function getActivePlayersWithConfig(
  db: Firestore,
  schoolId: string
): Promise<{ player: Player; config: PaymentConfig }[]> {
  const playersSnap = await db
    .collection('schools')
    .doc(schoolId)
    .collection('players')
    .where('status', 'in', ['active', 'suspended'])
    .get();

  const nonArchived = playersSnap.docs.filter((d) => d.data()?.archived !== true);

  const configSnap = await db
    .collection('schools')
    .doc(schoolId)
    .collection('paymentConfig')
    .doc('default')
    .get();

  const d = configSnap.data();
  const config: PaymentConfig = configSnap.exists
    ? {
        id: configSnap.id,
        amount: d!.amount ?? 0,
        currency: d!.currency ?? 'ARS',
        dueDayOfMonth: d!.dueDayOfMonth ?? 10,
        moraFromActivationMonth: d!.moraFromActivationMonth ?? true,
        prorateDayOfMonth: d!.prorateDayOfMonth ?? 15,
        proratePercent: d!.proratePercent ?? 50,
        delinquencyDaysEmail: d!.delinquencyDaysEmail ?? 10,
        delinquencyDaysSuspension: d!.delinquencyDaysSuspension ?? 30,
        registrationAmount: d!.registrationAmount ?? 0,
        registrationCancelsMonthFee: d!.registrationCancelsMonthFee !== false,
        updatedAt: toDate(d!.updatedAt),
        updatedBy: d!.updatedBy ?? '',
      }
    : {
        id: 'default',
        amount: 0,
        currency: 'ARS',
        dueDayOfMonth: 10,
        moraFromActivationMonth: true,
        prorateDayOfMonth: 15,
        proratePercent: 50,
        delinquencyDaysEmail: 10,
        delinquencyDaysSuspension: 30,
        registrationAmount: 0,
        registrationCancelsMonthFee: true,
        updatedAt: new Date(),
        updatedBy: '',
      };

  const players: { player: Player; config: PaymentConfig }[] = nonArchived.map((d) => {
    const data = d.data();
    const birthDate = data.birthDate?.toDate?.() ?? new Date(data.birthDate);
    return {
      player: {
        id: d.id,
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        birthDate,
        tutorContact: data.tutorContact ?? { name: '', phone: '' },
        status: data.status ?? 'active',
        email: data.email,
        createdAt: toDate(data.createdAt),
        createdBy: data.createdBy ?? '',
      } as Player,
      config,
    };
  });
  return players;
}

/**
 * Período YYYY-MM a partir de una fecha.
 */
function periodFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Genera lista de períodos desde activación hasta el mes actual.
 */
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

/**
 * Calcula morosos: jugadores que deben desde su mes de activación.
 * - Inscripción: si la escuela tiene registrationAmount > 0 y el jugador no tiene pago aprobado de inscripción, se agrega un ítem con period "inscripcion".
 * - Cuota mensual: solo períodos >= mes de activación. Si registrationCancelsMonthFee y ya pagó inscripción, el mes de alta no se exige como cuota (inscripción la cubre).
 * - Si el jugador se activó después del día 15, la cuota del primer mes es 50%.
 */
export async function computeDelinquents(
  db: Firestore,
  schoolId: string
): Promise<DelinquentInfo[]> {
  const playersWithConfig = await getActivePlayersWithConfig(db, schoolId);
  const delinquents: DelinquentInfo[] = [];
  const now = new Date();

  for (const { player, config } of playersWithConfig) {
    const activatedAt = player.createdAt instanceof Date ? player.createdAt : new Date(player.createdAt);
    const activationPeriod = periodFromDate(activatedAt);
    const hasPaidRegistration = await findApprovedRegistrationPayment(db, player.id);

    // Inscripción pendiente
    const registrationAmount = config.registrationAmount ?? 0;
    if (registrationAmount > 0 && !hasPaidRegistration) {
      const dueDate = getDueDate(activationPeriod, config.dueDayOfMonth);
      const daysOverdue = dueDate <= now ? Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)) : 0;
      delinquents.push({
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`.trim(),
        playerEmail: player.email,
        tutorContact: player.tutorContact,
        schoolId,
        period: REGISTRATION_PERIOD,
        dueDate,
        daysOverdue,
        amount: registrationAmount,
        currency: config.currency,
        status: player.status as 'active' | 'suspended',
        isRegistration: true,
      });
    }

    // Cuota mensual: solo si hay monto configurado
    if (config.amount <= 0) continue;

    const activationDay = activatedAt.getDate();
    const prorateDay = config.prorateDayOfMonth ?? 15;
    const proratePct = (config.proratePercent ?? 50) / 100;
    const registrationCancelsMonthFee = config.registrationCancelsMonthFee !== false;

    const periodsToCheck = config.moraFromActivationMonth !== false
      ? periodsFromActivationToNow(activatedAt)
      : (() => {
          const now2 = new Date();
          const curr = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}`;
          const prev = new Date(now2.getFullYear(), now2.getMonth() - 1);
          return [curr, `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`];
        })();

    for (const period of periodsToCheck) {
      const dueDate = getDueDate(period, config.dueDayOfMonth);
      if (dueDate > now) continue;

      const hasApproved = await findApprovedPayment(db, player.id, period);
      if (hasApproved) continue;

      const isActivationMonth = period === activationPeriod;
      if (isActivationMonth && registrationCancelsMonthFee && hasPaidRegistration) continue;

      const prorated = prorateDay > 0 && isActivationMonth && activationDay > prorateDay;
      const amount = prorated ? Math.round(config.amount * proratePct) : config.amount;

      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
      delinquents.push({
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`.trim(),
        playerEmail: player.email,
        tutorContact: player.tutorContact,
        schoolId,
        period,
        dueDate,
        daysOverdue,
        amount,
        currency: config.currency,
        status: player.status as 'active' | 'suspended',
        isProrated: prorated,
      });
    }
  }

  return delinquents.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/** Actualiza status del jugador (ej. a suspended). Si el documento no existe, no hace nada (evita 500 en webhook). */
export async function updatePlayerStatus(
  db: Firestore,
  schoolId: string,
  playerId: string,
  status: 'active' | 'inactive' | 'suspended'
): Promise<void> {
  const ref = db.collection('schools').doc(schoolId).collection('players').doc(playerId);
  const snap = await ref.get();
  if (!snap.exists) return;
  await ref.update({ status });
}
