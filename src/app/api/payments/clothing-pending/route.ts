/**
 * GET /api/payments/clothing-pending?schoolId=...&playerId=...
 * Devuelve las cuotas de ropa pendientes para un jugador (admin de escuela).
 * Usa la config de la escuela: cuántas cuotas hay y cuáles ya pagó el jugador.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getOrCreatePaymentConfig, getClothingPendingForPlayer } from '@/lib/payments/db';
import { verifyIdToken } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const playerId = searchParams.get('playerId');

    if (!schoolId || !playerId) {
      return NextResponse.json(
        { error: 'schoolId y playerId son requeridos' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const config = await getOrCreatePaymentConfig(db, schoolId);
    const pending = await getClothingPendingForPlayer(db, schoolId, playerId, config);

    return NextResponse.json({
      clothingPending: pending,
      totalInstallments: config.clothingInstallments ?? 2,
      clothingAmount: config.clothingAmount ?? 0,
      clothingConfigured: (config.clothingAmount ?? 0) > 0,
    });
  } catch (e) {
    console.error('[payments/clothing-pending]', e);
    return NextResponse.json(
      { error: 'Error al obtener cuotas pendientes' },
      { status: 500 }
    );
  }
}
