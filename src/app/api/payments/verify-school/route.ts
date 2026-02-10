/**
 * GET /api/payments/verify-school?schoolId=xxx
 * Devuelve qué ve el backend para esa escuela (jugadores).
 * Sirve para comparar con lo que muestra la app y detectar inconsistencias.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
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
      return NextResponse.json(
        { error: 'Falta schoolId (query: ?schoolId=xxx)' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const playersRef = db.collection('schools').doc(schoolId).collection('players');
    const snap = await playersRef.get();

    const playerIds = snap.docs.map((d) => d.id);
    const playerNames = snap.docs.map((d) => {
      const d_ = d.data() as { firstName?: string; lastName?: string };
      return [d.id, `${(d_.lastName ?? '').trim()} ${(d_.firstName ?? '').trim()}`.trim() || d.id];
    });

    return NextResponse.json({
      schoolId,
      playerCount: snap.size,
      playerIds,
      players: Object.fromEntries(playerNames),
    });
  } catch (e) {
    console.error('verify-school', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al verificar escuela' },
      { status: 500 }
    );
  }
}
