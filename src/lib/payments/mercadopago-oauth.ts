/**
 * Helpers para OAuth de Mercado Pago (authorization code).
 * State firmado: evita que un atacante use nuestro callback para asociar sus tokens a otra escuela.
 */

import { createHmac } from 'crypto';

const STATE_SEPARATOR = '.';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutos

function getSecret(): string {
  const secret = process.env.MERCADOPAGO_CLIENT_SECRET;
  if (!secret) throw new Error('MERCADOPAGO_CLIENT_SECRET no configurado');
  return secret;
}

/** Genera un state firmado con schoolId para el flujo OAuth. */
export function signOAuthState(schoolId: string): string {
  const secret = getSecret();
  const timestamp = String(Date.now());
  const payload = schoolId + STATE_SEPARATOR + timestamp;
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + STATE_SEPARATOR + signature;
}

/**
 * Verifica el state y devuelve el schoolId. Lanza si es inválido o expirado.
 */
export function verifyOAuthState(state: string): string {
  const secret = getSecret();
  const parts = state.split(STATE_SEPARATOR);
  if (parts.length !== 3) throw new Error('State inválido');
  const [schoolId, timestampStr, signature] = parts;
  const payload = schoolId + STATE_SEPARATOR + timestampStr;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (expected !== signature) throw new Error('State inválido');
  const timestamp = parseInt(timestampStr, 10);
  if (Date.now() - timestamp > STATE_TTL_MS) throw new Error('State expirado');
  return schoolId;
}

const MP_AUTH_BASE = 'https://auth.mercadopago.com';
const MP_OAUTH_TOKEN_URL = 'https://api.mercadopago.com/oauth/token';

/** Arma la URL de autorización de Mercado Pago (redirect del usuario). */
export function getMercadoPagoAuthorizeUrl(redirectUri: string, state: string): string {
  const clientId = process.env.MERCADOPAGO_CLIENT_ID;
  if (!clientId) throw new Error('MERCADOPAGO_CLIENT_ID no configurado');
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    platform_id: 'mp',
    state,
    redirect_uri: redirectUri,
  });
  return `${MP_AUTH_BASE}/authorization?${params.toString()}`;
}

/** Intercambia el code por access_token y refresh_token. */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  options?: { testToken?: boolean }
): Promise<{ access_token: string; refresh_token: string; expires_in?: number }> {
  const clientId = process.env.MERCADOPAGO_CLIENT_ID;
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Credenciales Mercado Pago no configuradas');

  const body: Record<string, string | boolean> = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  };
  if (options?.testToken === true) body.test_token = true;

  const res = await fetch(MP_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mercado Pago OAuth: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}
