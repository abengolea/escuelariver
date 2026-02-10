/**
 * Firebase Admin SDK - SOLO para uso en servidor (API routes, server actions, Cloud Functions).
 * NO importar en código cliente.
 */

import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0] as App;
  }
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is required for firebase-admin');
  }
  // En local: GOOGLE_APPLICATION_CREDENTIALS o default credentials
  // En producción (App Hosting / Cloud Functions): Application Default Credentials
  adminApp = initializeApp({ projectId });
  return adminApp;
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
