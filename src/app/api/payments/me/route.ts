/**
 * GET /api/payments/me
 * Devuelve los pagos y estado de morosidad del jugador autenticado.
 * Solo disponible para usuarios con rol player (vinculados vía playerLogins).
 */

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { verifyIdToken } from '@/lib/auth-server';
import { listPayments, computeDelinquents, getOrCreatePaymentConfig, getExpectedAmountForPeriod, getClothingPendingForPlayer } from '@/lib/payments/db';
import { REGISTRATION_PERIOD } from '@/lib/payments/constants';
import type { DelinquentInfo } from '@/lib/types/payments';

export async function GET(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { uid } = auth;
    const adminAuth = getAdminAuth();
    const user = await adminAuth.getUser(uid).catch(() => null);
    if (!user?.email) {
      return NextResponse.json({ error: 'Usuario sin email' }, { status: 403 });
    }

    const emailNorm = user.email.trim().toLowerCase();
    const db = getAdminFirestore();
    const loginSnap = await db.collection('playerLogins').doc(emailNorm).get();
    if (!loginSnap.exists) {
      return NextResponse.json({ error: 'No eres un jugador registrado' }, { status: 403 });
    }

    const { schoolId, playerId } = loginSnap.data() as { schoolId: string; playerId: string };
    if (!schoolId || !playerId) {
      return NextResponse.json({ error: 'Datos de jugador incompletos' }, { status: 403 });
    }

    const [paymentsResult, delinquents] = await Promise.all([
      listPayments(db, schoolId, { playerId, limit: 100 }),
      computeDelinquents(db, schoolId),
    ]);

    const myDelinquents = delinquents.filter((d) => d.playerId === playerId);
    const toJson = (d: DelinquentInfo) => ({ ...d, dueDate: d.dueDate.toISOString() });

    const config = await getOrCreatePaymentConfig(db, schoolId);
    const clothingPending = await getClothingPendingForPlayer(db, schoolId, playerId, config);
    const now = new Date();
    const suggestedPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const registrationPending = myDelinquents.find((d) => d.period === REGISTRATION_PERIOD) ?? null;
    const currentMonthUnpaid = myDelinquents.some((d) => d.period === suggestedPeriod);
    // El badge del jugador es por el mes actual o inscripción; las cuotas viejas las gestiona el admin.
    const hasOverdue = currentMonthUnpaid || registrationPending != null;

    const suggestedAmount = await getExpectedAmountForPeriod(
      db,
      schoolId,
      playerId,
      suggestedPeriod,
      config
    );

    const myDelinquent = registrationPending ?? myDelinquents[0] ?? null;

    return NextResponse.json({
      schoolId,
      playerId,
      payments: paymentsResult.payments.map((p) => ({
        ...p,
        paidAt: p.paidAt?.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
      delinquent: myDelinquent ? toJson(myDelinquent) : null,
      delinquents: myDelinquents.map(toJson),
      hasOverdue,
      suggestedPeriod,
      suggestedAmount,
      suggestedCurrency: config.currency,
      clothingPending,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const details = (e as { details?: string })?.details ?? '';
    const isIndexBuilding =
      message.includes('index is currently building') ||
      details.includes('index is currently building');

    if (isIndexBuilding) {
      return NextResponse.json(
        {
          error: 'Tu historial de pagos se está preparando. Volvé a intentar en unos minutos.',
          code: 'INDEX_BUILDING',
        },
        { status: 503 }
      );
    }

    console.error('[payments/me GET]', e);
    return NextResponse.json(
      {
        error: 'Error al cargar tus pagos',
        ...(process.env.NODE_ENV === 'development' && { detail: message }),
      },
      { status: 500 }
    );
  }
}
