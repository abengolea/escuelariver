/**
 * Script para cargar los flujos del Centro de Soporte en Firestore.
 * Ejecutar desde la raíz del proyecto (solo superadmin puede escribir en supportFlows;
 * este script usa Firebase Admin y bypassa reglas).
 *
 * Uso:
 *   1. Descargar clave de cuenta de servicio desde Firebase Console → Configuración del proyecto → Cuentas de servicio.
 *   2. Definir GOOGLE_APPLICATION_CREDENTIALS con la ruta al JSON (o usar gcloud auth application-default login).
 *   3. npm run seed:support   (o npx tsx scripts/seed-support-flows.ts)
 *
 * Variables de entorno (o en .env.local):
 *   - GOOGLE_APPLICATION_CREDENTIALS: ruta al JSON de la cuenta de servicio (recomendado).
 *   - GCLOUD_PROJECT o NEXT_PUBLIC_FIREBASE_PROJECT_ID: ID del proyecto (opcional si viene en la clave).
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar .env.local si existe (Next.js)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import * as fs from 'fs';
import * as admin from 'firebase-admin';
import { supportFlowsSeed } from '../src/lib/support/flows-seed';

const projectId =
  process.env.GCLOUD_PROJECT ??
  process.env.FIREBASE_PROJECT_ID ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

function resolveCredentialsPath(): string {
  const cwd = process.cwd();
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath) {
    const absolute = path.isAbsolute(envPath) ? envPath : path.join(cwd, envPath);
    if (fs.existsSync(absolute)) return absolute;
  }
  // Fallback: buscar en la raíz del proyecto (a veces el archivo se guarda como service-account.json.json)
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
      'No se encontró el archivo de la cuenta de servicio.\n' +
        'Poné service-account.json en la carpeta del proyecto o definí GOOGLE_APPLICATION_CREDENTIALS con la ruta al JSON.\n' +
        'Descargala desde Firebase Console → Configuración → Cuentas de servicio.'
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

async function main() {
  const db = initFirebaseAdmin();
  const col = db.collection('supportFlows');
  let loaded = 0;
  const errors: string[] = [];

  for (const flow of supportFlowsSeed) {
    try {
      await col.doc(flow.id).set({
        ...flow,
        updatedAt: admin.firestore.Timestamp.fromDate(flow.updatedAt),
      });
      loaded++;
      console.log(`  ✓ ${flow.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${flow.id}: ${msg}`);
      console.error(`  ✗ ${flow.id}: ${msg}`);
    }
  }

  console.log(`\nCargados: ${loaded}/${supportFlowsSeed.length}`);
  if (errors.length > 0) {
    console.error('Errores:', errors);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
