/**
 * GET /api/payments/me
 * Devuelve los pagos y estado de morosidad del jugador autenticado.
 * Solo disponible para usuarios con rol player (vinculados vía playerLogins).
 */

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { verifyIdToken } from '@/lib/auth-server';
import { listPayments, computeDelinquents, getOrCreatePaymentConfig, getExpectedAmountForPeriod, getClothingPendingForPlayer } from '@/lib/payments/db';
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

    const myDelinquent: DelinquentInfo | null =
      delinquents.find((d) => d.playerId === playerId) ?? null;
    const hasOverdue = myDelinquent != null;

    const config = await getOrCreatePaymentConfig(db, schoolId);
    const clothingPending = await getClothingPendingForPlayer(db, schoolId, playerId, config);
    const now = new Date();
    const suggestedPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const suggestedAmount =
      myDelinquent != null
        ? myDelinquent.amount
        : await getExpectedAmountForPeriod(db, schoolId, playerId, suggestedPeriod, config);

    return NextResponse.json({
      schoolId,
      playerId,
      payments: paymentsResult.payments.map((p) => ({
        ...p,
        paidAt: p.paidAt?.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
      delinquent: myDelinquent
        ? {
            ...myDelinquent,
            dueDate: myDelinquent.dueDate.toISOString(),
          }
        : null,
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
