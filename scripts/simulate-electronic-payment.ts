/**
 * Script para simular un pago electrónico (MercadoPago) a favor de un jugador
 * identificado por email. Crea el pago vía POST al webhook de pagos.
 *
 * Uso:
 *   1. Tener el servidor Next.js corriendo (npm run dev, p. ej. en puerto 9002).
 *   2. GOOGLE_APPLICATION_CREDENTIALS o service-account.json para buscar al jugador en Firestore.
 *   3. npx tsx scripts/simulate-electronic-payment.ts
 *   4. Opcional: PLAYER_EMAIL=otro@mail.com BASE_URL=http://localhost:9002 npx tsx scripts/simulate-electronic-payment.ts
 *   5. Por jugador directo (sin buscar por email): SCHOOL_ID=xxx PLAYER_ID=yyy npx tsx scripts/simulate-electronic-payment.ts
 *
 * Variables de entorno (o .env.local):
 *   - PLAYER_EMAIL: email del jugador (si no se usan SCHOOL_ID/PLAYER_ID)
 *   - SCHOOL_ID + PLAYER_ID: opcional; si están definidos, se usa este jugador y no se busca por email
 *   - BASE_URL: URL de la app (default: http://localhost:9002)
 *   - PERIOD: YYYY-MM (default: mes actual)
 *   - AMOUNT: monto en número (default: 15000)
 *   - GOOGLE_APPLICATION_CREDENTIALS o service-account.json en la raíz (solo si se busca por email)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import * as fs from 'fs';
import * as admin from 'firebase-admin';

const projectId =
  process.env.GCLOUD_PROJECT ??
  process.env.FIREBASE_PROJECT_ID ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const PLAYER_EMAIL = (process.env.PLAYER_EMAIL ?? 'noresponderescuelariversn@gmail.com').trim().toLowerCase();
const SCHOOL_ID = process.env.SCHOOL_ID?.trim();
const PLAYER_ID = process.env.PLAYER_ID?.trim();
const USE_DIRECT_IDS = Boolean(SCHOOL_ID && PLAYER_ID);
const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:9002').replace(/\/$/, '');
const PERIOD = process.env.PERIOD ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
const AMOUNT = parseInt(process.env.AMOUNT ?? '15000', 10) || 15000;

function resolveCredentialsPath(): string {
  const cwd = process.cwd();
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath) {
    const absolute = path.isAbsolute(envPath) ? envPath : path.join(cwd, envPath);
    if (fs.existsSync(absolute)) return absolute;
  }
  const candidates = [
    path.join(cwd, 'service-account.json'),
    path.join(cwd, 'service-account.json.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return '';
}

function initFirebaseAdmin(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }
  const credentialsPath = resolveCredentialsPath();
  if (!credentialsPath) {
    console.error(
      'No se encontró la cuenta de servicio. Poné service-account.json en la raíz o definí GOOGLE_APPLICATION_CREDENTIALS.'
    );
    process.exit(1);
  }
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  admin.initializeApp({
    projectId: projectId || undefined,
    credential: admin.credential.applicationDefault(),
  });
  return admin.firestore();
}

/** Busca jugador por email sin usar índice (trae jugadores de cada escuela y filtra en memoria). */
async function findPlayerByEmail(db: admin.firestore.Firestore, email: string): Promise<{ schoolId: string; playerId: string } | null> {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm) return null;

  const schoolsSnap = await db.collection('schools').get();
  for (const schoolDoc of schoolsSnap.docs) {
    const playersSnap = await db.collection('schools').doc(schoolDoc.id).collection('players').get();
    const found = playersSnap.docs.find(
      (d) => ((d.data().email as string) ?? '').trim().toLowerCase() === emailNorm
    );
    if (found) {
      return { schoolId: schoolDoc.id, playerId: found.id };
    }
  }
  return null;
}

async function main() {
  console.log('Simular pago electrónico');
  if (USE_DIRECT_IDS) {
    console.log('  Modo: SCHOOL_ID + PLAYER_ID (sin buscar por email)');
    console.log('  schoolId:', SCHOOL_ID);
    console.log('  playerId:', PLAYER_ID);
  } else {
    console.log('  Email jugador:', PLAYER_EMAIL);
  }
  console.log('  Período:', PERIOD);
  console.log('  Monto:', AMOUNT, 'ARS');
  console.log('  Base URL:', BASE_URL);

  let player: { schoolId: string; playerId: string };
  if (USE_DIRECT_IDS) {
    player = { schoolId: SCHOOL_ID!, playerId: PLAYER_ID! };
  } else {
    const db = initFirebaseAdmin();
    const found = await findPlayerByEmail(db, PLAYER_EMAIL);
    if (!found) {
      console.error('No se encontró ningún jugador con email:', PLAYER_EMAIL);
      process.exit(1);
    }
    player = found;
    console.log('  Jugador encontrado: schoolId =', player.schoolId, ', playerId =', player.playerId);
  }

  const providerPaymentId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const payload = {
    provider: 'mercadopago',
    providerPaymentId,
    status: 'approved',
    playerId: player.playerId,
    schoolId: player.schoolId,
    period: PERIOD,
    amount: AMOUNT,
    currency: 'ARS',
  };

  const url = `${BASE_URL}/api/payments/webhook`;
  console.log('  POST', url);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    console.error('Error:', res.status, data);
    process.exit(1);
  }

  console.log('  Respuesta:', data);
  console.log('Listo. Pago simulado correctamente.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
