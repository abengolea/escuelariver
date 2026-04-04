/**
 * GET /api/admin/player-payments
 * Pagos jugador→escuela en todas las escuelas (Mercado Pago, manual, etc.). Solo super admin.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifySuperAdmin } from '@/lib/auth-server';
import { listPaymentsGlobalSchema } from '@/lib/payments/schemas';
import {
  getPlayerNames,
  getSchoolNamesByIds,
  listPaymentsGlobal,
  listPaymentIntentsForSuperAdmin,
} from '@/lib/payments/db';

const knownPlayerNames: Record<string, string> = {
  Xt2r6Fx2yT0IG0QCd7Ai: 'Gregorio Bengolea',
  Gl2CNNSndB1q3tXCOePq: 'PRUEBA PRUEBA',
};

export async function GET(request: Request) {
  try {
    const auth = await verifySuperAdmin(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'Solo super administrador' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = listPaymentsGlobalSchema.safeParse({
      schoolId: searchParams.get('schoolId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      status: searchParams.get('status') || undefined,
      provider: searchParams.get('provider') || undefined,
      playerSearch: searchParams.get('playerSearch') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
      includeIntents: searchParams.get('includeIntents') === '1' || searchParams.get('includeIntents') === 'true',
      intentsLimit: searchParams.get('intentsLimit')
        ? parseInt(searchParams.get('intentsLimit')!, 10)
        : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      schoolId,
      dateFrom,
      dateTo,
      status,
      provider,
      playerSearch,
      limit,
      offset,
      includeIntents,
      intentsLimit,
    } = parsed.data;

    const db = getAdminFirestore();
    const searchTrim = playerSearch?.trim() ?? '';

    const { payments: fetched, total: windowTotal } = await listPaymentsGlobal(db, {
      schoolId,
      provider,
      status,
      dateFrom,
      dateTo,
      limit: searchTrim ? 450 : limit,
      offset: searchTrim ? 0 : offset,
    });

    const playerIdsBySchool = new Map<string, Set<string>>();
    for (const p of fetched) {
      const sid = p.schoolId;
      const set = playerIdsBySchool.get(sid) ?? new Set<string>();
      set.add(p.playerId);
      playerIdsBySchool.set(sid, set);
    }
    const allNames = new Map<string, string>();
    for (const [sid, playerIds] of playerIdsBySchool) {
      const names = await getPlayerNames(db, sid, [...playerIds]);
      names.forEach((name, id) => allNames.set(`${sid}:${id}`, name));
    }

    const resolveName = (sid: string, playerId: string): string => {
      const key = `${sid}:${playerId}`;
      const fromDb = allNames.get(key);
      if (fromDb && fromDb !== playerId) return fromDb;
      if (knownPlayerNames[playerId]) return knownPlayerNames[playerId];
      return playerId;
    };

    let payments = fetched;
    let listTotal = windowTotal;

    if (searchTrim) {
      const q = searchTrim.toLowerCase();
      payments = payments.filter((p) => resolveName(p.schoolId, p.playerId).toLowerCase().includes(q));
      listTotal = payments.length;
      payments = payments.slice(offset, offset + limit);
    }

    const schoolIds = [...new Set(payments.map((p) => p.schoolId))];
    const schoolNames = await getSchoolNamesByIds(db, schoolIds);
    const schoolNamesRecord = Object.fromEntries(schoolNames);

    const intents = includeIntents
      ? await listPaymentIntentsForSuperAdmin(db, {
          schoolId,
          limit: intentsLimit,
          status: undefined,
        })
      : [];

    const intentPlayerIdsBySchool = new Map<string, Set<string>>();
    for (const it of intents) {
      const set = intentPlayerIdsBySchool.get(it.schoolId) ?? new Set<string>();
      set.add(it.playerId);
      intentPlayerIdsBySchool.set(it.schoolId, set);
    }
    const intentNames = new Map<string, string>();
    for (const [sid, playerIds] of intentPlayerIdsBySchool) {
      const names = await getPlayerNames(db, sid, [...playerIds]);
      names.forEach((name, id) => intentNames.set(`${sid}:${id}`, name));
    }
    const intentSchoolIds = [...new Set(intents.map((i) => i.schoolId))];
    const intentSchoolNames = await getSchoolNamesByIds(db, intentSchoolIds);

    return NextResponse.json({
      payments: payments.map((p) => ({
        ...p,
        playerName: resolveName(p.schoolId, p.playerId),
        schoolName: schoolNames.get(p.schoolId) ?? p.schoolId,
        paidAt: p.paidAt?.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
      total: listTotal,
      schoolNames: schoolNamesRecord,
      intents: includeIntents
        ? intents.map((it) => ({
            ...it,
            playerName:
              intentNames.get(`${it.schoolId}:${it.playerId}`) ??
              knownPlayerNames[it.playerId] ??
              it.playerId,
            schoolName: intentSchoolNames.get(it.schoolId) ?? it.schoolId,
            createdAt: it.createdAt.toISOString(),
            updatedAt: it.updatedAt.toISOString(),
          }))
        : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[admin/player-payments]', e);
    return NextResponse.json(
      {
        error: 'Error al listar pagos',
        ...(process.env.NODE_ENV === 'development' && { detail: message }),
      },
      { status: 500 }
    );
  }
}
