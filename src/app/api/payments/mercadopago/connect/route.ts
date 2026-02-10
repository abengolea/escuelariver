/**
 * GET /api/payments/mercadopago/connect?schoolId=...
 * Devuelve la URL de autorización de Mercado Pago para que el cliente redirija (OAuth).
 * Solo debe ser llamado por un usuario autenticado que sea admin de esa escuela.
 */

import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth-server';
import { getMercadoPagoAuthorizeUrl, signOAuthState } from '@/lib/payments/mercadopago-oauth';

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

    // TODO: verificar que auth.uid sea admin de schoolId (isSchoolAdminOrSuperAdmin)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get('origin') ?? 'http://localhost:9002';
    const redirectUri = `${baseUrl}/api/payments/mercadopago/callback`;
    const state = signOAuthState(schoolId);
    const url = getMercadoPagoAuthorizeUrl(redirectUri, state);

    return NextResponse.json({ redirectUrl: url });
  } catch (e) {
    console.error('[payments/mercadopago/connect]', e);
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('no configurado') || msg.includes('no configuradas')) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado. Agregá MERCADOPAGO_CLIENT_ID y MERCADOPAGO_CLIENT_SECRET en .env.local y reiniciá el servidor (npm run dev).' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'No se pudo iniciar la conexión con Mercado Pago' },
      { status: 500 }
    );
  }
}
