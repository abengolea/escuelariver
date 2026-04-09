/**
 * Firebase Admin SDK - SOLO para uso en servidor (API routes, server actions, Cloud Functions).
 * NO importar en código cliente.
 *
 * Las rutas API leen Firestore con Admin (ignoran reglas de seguridad) pero necesitan una cuenta
 * de servicio con permisos en el proyecto. Sin eso, Firestore responde PERMISSION_DENIED (código 7).
 *
 * Configuración local (.env.local), una de:
 * - GOOGLE_APPLICATION_CREDENTIALS=ruta\completa\service-account.json
 * - FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}  (JSON en una línea; escapá las comillas del private_key)
 */

import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

let adminApp: App;

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0] as App;
  }
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is required for firebase-admin');
  }
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${projectId}.appspot.com`;

  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inlineJson) {
    let raw: Record<string, string | undefined>;
    try {
      raw = JSON.parse(inlineJson) as Record<string, string | undefined>;
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no es JSON válido');
    }
    const clientEmail = raw.client_email ?? raw.clientEmail;
    const privateKey = raw.private_key ?? raw.privateKey;
    if (!clientEmail || !privateKey) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON debe incluir client_email y private_key');
    }
    adminApp = initializeApp({
      credential: cert({
        projectId: raw.project_id ?? raw.projectId ?? projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
      storageBucket,
    });
    return adminApp;
  }

  // Usa GOOGLE_APPLICATION_CREDENTIALS (archivo JSON) o ADC del entorno (Cloud Run, etc.)
  adminApp = initializeApp({
    credential: applicationDefault(),
    projectId,
    storageBucket,
  });
  return adminApp;
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminStorage() {
  return getStorage(getAdminApp());
}
