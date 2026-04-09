/**
 * GET /api/payments/expected-amount?schoolId=...&playerId=...&period=...
 * Monto esperado según configuración de la escuela y datos del jugador (cuota / inscripción / ropa),
 * alineado con getExpectedAmountForPeriod (checkout, recordatorios).
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  getOrCreatePaymentConfig,
  getExpectedAmountForPeriod,
  playerExistsInSchool,
} from '@/lib/payments/db';
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
    const period = searchParams.get('period');

    if (!schoolId || !playerId || !period) {
      return NextResponse.json(
        { error: 'schoolId, playerId y period son requeridos' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const ok = await playerExistsInSchool(db, schoolId, playerId);
    if (!ok) {
      return NextResponse.json(
        { error: 'El jugador no existe en esta escuela.' },
        { status: 400 }
      );
    }

    const config = await getOrCreatePaymentConfig(db, schoolId);
    const amount = await getExpectedAmountForPeriod(db, schoolId, playerId, period, config);

    return NextResponse.json({ amount, currency: config.currency ?? 'ARS' });
  } catch (e) {
    console.error('[payments/expected-amount]', e);
    return NextResponse.json(
      { error: 'Error al obtener el monto' },
      { status: 500 }
    );
  }
}
