/**
 * POST /api/payments/mercadopago/manual-token
 * Guarda un Access Token de Mercado Pago pegado a mano (credenciales de producción).
 * Valida el token contra /users/me antes de persistirlo.
 */

import { NextResponse } from 'next/server';
import { verifyIdToken, isSchoolAdminOrSuperAdmin } from '@/lib/auth-server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { setMercadoPagoConnection } from '@/lib/payments/db';
import { saveMercadoPagoManualTokenSchema } from '@/lib/payments/schemas';

async function validateMercadoPagoAccessToken(
  accessToken: string
): Promise<{ id: string | number; nickname?: string } | null> {
  const res = await fetch('https://api.mercadopago.com/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string | number; nickname?: string };
  if (data.id == null) return null;
  return { id: data.id, nickname: data.nickname };
}

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = saveMercadoPagoManualTokenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { schoolId, accessToken, refreshToken } = parsed.data;
    const allowed = await isSchoolAdminOrSuperAdmin(auth.uid, schoolId);
    if (!allowed) {
      return NextResponse.json({ error: 'Sin permisos para esta escuela' }, { status: 403 });
    }

    const token = accessToken.trim();
    const mpUser = await validateMercadoPagoAccessToken(token);
    if (!mpUser) {
      return NextResponse.json(
        {
          error:
            'El Access Token no es válido. Revisá que sea el de producción (APP_USR-…) de la cuenta correcta en Mercado Pago → Tus integraciones.',
        },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    await setMercadoPagoConnection(db, schoolId, {
      access_token: token,
      refresh_token: refreshToken?.trim() || undefined,
      mp_user_id: String(mpUser.id),
      connection_method: 'manual',
      connected_at: new Date(),
    });

    return NextResponse.json({
      ok: true,
      connected: true,
      mpUserId: String(mpUser.id),
      nickname: mpUser.nickname ?? null,
    });
  } catch (e) {
    console.error('[payments/mercadopago/manual-token]', e);
    return NextResponse.json(
      { error: 'No se pudo guardar el Access Token de Mercado Pago' },
      { status: 500 }
    );
  }
}
