/**
 * GET /api/payments/mercadopago/status?schoolId=...
 * Devuelve si la escuela tiene Mercado Pago conectado (para mostrar estado en la UI).
 * No expone tokens.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getMercadoPagoConnection } from '@/lib/payments/db';
import { verifyIdToken } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId requerido' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const connection = await getMercadoPagoConnection(db, schoolId);

    return NextResponse.json({
      connected: !!connection,
      connectedAt: connection?.connected_at ? connection.connected_at.toISOString() : null,
    });
  } catch (e) {
    console.error('[payments/mercadopago/status]', e);
    return NextResponse.json(
      { error: 'Error al consultar estado' },
      { status: 500 }
    );
  }
}
