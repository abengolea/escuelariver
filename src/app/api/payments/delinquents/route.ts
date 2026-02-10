/**
 * GET /api/payments/delinquents?schoolId=...
 * Lista morosos de la escuela (admin).
 */

import { NextResponse } from 'next/server';
import { listDelinquentsSchema } from '@/lib/payments/schemas';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { computeDelinquents } from '@/lib/payments/db';
import { verifyIdToken } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const parsed = listDelinquentsSchema.safeParse({ schoolId: schoolId ?? '' });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'schoolId requerido', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const delinquents = await computeDelinquents(db, parsed.data.schoolId);

    return NextResponse.json({
      delinquents: delinquents.map((d) => ({
        ...d,
        dueDate: d.dueDate.toISOString(),
      })),
    });
  } catch (e) {
    console.error('[payments/delinquents]', e);
    return NextResponse.json(
      { error: 'Error al listar morosos' },
      { status: 500 }
    );
  }
}
