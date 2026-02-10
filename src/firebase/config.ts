import { FirebaseOptions, initializeApp, getApps } from 'firebase/app';

// Configuración desde variables de entorno (nunca commitear valores reales).
// Ver .env.example y documentación de despliegue.
function getFirebaseConfig(): FirebaseOptions {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  };
}

function initializeFirebase() {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  const firebaseConfig = getFirebaseConfig();
  if (!firebaseConfig.apiKey?.trim()) {
    throw new Error(
      'Firebase config is not initialized. Set NEXT_PUBLIC_FIREBASE_API_KEY (and the rest of NEXT_PUBLIC_FIREBASE_*) in .env.local from Firebase Console → Project settings → Your apps, then restart the dev server (npm run dev).'
    );
  }
  return initializeApp(firebaseConfig);
}

export { initializeFirebase, getFirebaseConfig };
