/**
 * GET /api/payments/mercadopago/callback?code=...&state=...
 * Callback OAuth de Mercado Pago: intercambia el code por tokens y los guarda por schoolId.
 * Redirige al usuario a Pagos → Configuración con mensaje de éxito o error.
 */

import { NextResponse } from 'next/server';
import { verifyOAuthState, exchangeCodeForTokens } from '@/lib/payments/mercadopago-oauth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { setMercadoPagoConnection } from '@/lib/payments/db';

const PAYMENTS_CONFIG_URL = '/dashboard/payments?tab=config';

function redirectResult(success: boolean, message?: string): NextResponse {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:9002';
  const url = new URL(PAYMENTS_CONFIG_URL, baseUrl);
  url.searchParams.set('mercadopago', success ? 'connected' : 'error');
  if (message) url.searchParams.set('message', message);
  return NextResponse.redirect(url.toString());
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return redirectResult(false, 'Faltan parámetros de Mercado Pago');
    }

    const schoolId = verifyOAuthState(state);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get('origin') ?? 'http://localhost:9002';
    const redirectUri = `${baseUrl}/api/payments/mercadopago/callback`;

    const tokens = await exchangeCodeForTokens(code, redirectUri, {
      testToken: process.env.MERCADOPAGO_USE_TEST_TOKENS === 'true',
    });

    const expiresAt = tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : undefined;

    const db = getAdminFirestore();
    await setMercadoPagoConnection(db, schoolId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      connected_at: new Date(),
    });

    return redirectResult(true);
  } catch (e) {
    console.error('[payments/mercadopago/callback]', e);
    const message = e instanceof Error ? e.message : 'Error al conectar con Mercado Pago';
    return redirectResult(false, message);
  }
}
