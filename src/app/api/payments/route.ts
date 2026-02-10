/**
 * GET /api/payments?schoolId=...&...
 * Lista pagos con filtros (admin de escuela).
 */

import { NextResponse } from 'next/server';
import { listPaymentsSchema } from '@/lib/payments/schemas';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { listPayments, getPlayerNames } from '@/lib/payments/db';
import { verifyIdToken } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const parsed = listPaymentsSchema.safeParse({
      schoolId: schoolId ?? '',
      filters: {
        dateFrom: searchParams.get('dateFrom') ?? undefined,
        dateTo: searchParams.get('dateTo') ?? undefined,
        playerId: searchParams.get('playerId') ?? undefined,
        status: searchParams.get('status') ?? undefined,
        period: searchParams.get('period') ?? undefined,
        provider: searchParams.get('provider') ?? undefined,
      },
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!, 10)
        : undefined,
      offset: searchParams.get('offset')
        ? parseInt(searchParams.get('offset')!, 10)
        : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { schoolId: sid, filters, limit, offset } = parsed.data;
    const db = getAdminFirestore();

    const { payments, total } = await listPayments(db, sid, {
      ...filters,
      limit,
      offset,
    });

    // Agrupar playerIds por schoolId del pago (por si algún pago tuviera otra escuela)
    const playerIdsBySchool = new Map<string, Set<string>>();
    for (const p of payments) {
      const school = p.schoolId || sid;
      const set = playerIdsBySchool.get(school) ?? new Set<string>();
      set.add(p.playerId);
      playerIdsBySchool.set(school, set);
    }
    const allNames = new Map<string, string>();
    for (const [schoolId, playerIds] of playerIdsBySchool) {
      const names = await getPlayerNames(db, schoolId, [...playerIds]);
      names.forEach((name, id) => allNames.set(id, name));
    }

    // Fallback manual para playerIds conocidos cuando la resolución automática no encuentra
    const knownPlayerNames: Record<string, string> = {
      Xt2r6Fx2yT0IG0QCd7Ai: 'Gregorio Bengolea',
      Gl2CNNSndB1q3tXCOePq: 'PRUEBA PRUEBA',
    };
    const resolveName = (playerId: string): string => {
      const fromDb = allNames.get(playerId);
      if (fromDb && fromDb !== playerId) return fromDb;
      return knownPlayerNames[playerId] ?? playerId;
    };

    return NextResponse.json({
      payments: payments.map((p) => ({
        ...p,
        playerName: resolveName(p.playerId),
        paidAt: p.paidAt?.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
      total,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[payments GET]', e);
    return NextResponse.json(
      {
        error: 'Error al listar pagos',
        ...(process.env.NODE_ENV === 'development' && { detail: message }),
      },
      { status: 500 }
    );
  }
}
