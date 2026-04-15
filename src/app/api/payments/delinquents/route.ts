/**
 * GET /api/payments/delinquents?schoolId=...
 * Lista morosos de la escuela (admin).
 */

import { NextResponse } from 'next/server';
import { listDelinquentsSchema } from '@/lib/payments/schemas';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { computeDelinquents, listPlayersCurrentOnMonthlyQuota } from '@/lib/payments/db';
import { getReminderCountsForDelinquents } from '@/lib/payments/email-events';
import { verifyIdToken } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const concept = searchParams.get('concept') ?? undefined;
    const period = searchParams.get('period') ?? undefined;
    const parsed = listDelinquentsSchema.safeParse({ schoolId: schoolId ?? '', concept, period });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'schoolId requerido', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    let delinquents = await computeDelinquents(db, parsed.data.schoolId);
    const currentOnMonthlyQuota = await listPlayersCurrentOnMonthlyQuota(
      db,
      parsed.data.schoolId,
      delinquents
    );

    // Filtrar por concepto
    const conceptFilter = parsed.data.concept;
    const periodFilter = parsed.data.period;
    if (conceptFilter === 'inscripcion') {
      delinquents = delinquents.filter((d) => d.period === 'inscripcion');
    } else if (conceptFilter === 'monthly') {
      delinquents = delinquents.filter((d) => /^\d{4}-(0[1-9]|1[0-2])$/.test(d.period));
      if (periodFilter && /^\d{4}-(0[1-9]|1[0-2])$/.test(periodFilter)) {
        delinquents = delinquents.filter((d) => d.period === periodFilter);
      }
    } else if (conceptFilter === 'clothing') {
      delinquents = delinquents.filter((d) => /^ropa-\d+$/.test(d.period));
      if (periodFilter && /^ropa-\d+$/.test(periodFilter)) {
        delinquents = delinquents.filter((d) => d.period === periodFilter);
      }
    }

    const reminderMap = await getReminderCountsForDelinquents(db, parsed.data.schoolId, delinquents);

    return NextResponse.json({
      delinquents: delinquents.map((d) => {
        const key = `${d.playerId}:${d.period}`;
        const reminder = reminderMap.get(key);
        return {
          ...d,
          dueDate: d.dueDate.toISOString(),
          reminderCount: reminder?.count ?? 0,
          ...(reminder?.lastSentAt && { lastReminderSentAt: reminder.lastSentAt.toISOString() }),
        };
      }),
      currentOnMonthlyQuota,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[payments/delinquents]', e);
    const isIndexBuilding =
      message.includes('index is currently building') ||
      (e as { details?: string })?.details?.includes?.('index is currently building');
    if (isIndexBuilding) {
      return NextResponse.json(
        {
          error: 'Los índices de Firestore se están creando. Volvé a intentar en unos minutos.',
          code: 'INDEX_BUILDING',
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Error al listar morosos', detail: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 }
    );
  }
}
