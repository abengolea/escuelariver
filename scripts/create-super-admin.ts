/**
 * Crea o actualiza el super administrador en Firebase Auth y Firestore (platformUsers).
 * En la app, super_admin tiene permisos elevados en API y el perfil se trata como school_admin
 * a nivel de permisos (ver useUserProfile).
 *
 * Requisitos:
 *   - Cuenta de servicio: service-account.json en la raíz del proyecto o GOOGLE_APPLICATION_CREDENTIALS.
 *   - Contraseña: NUNCA la commitees en el repo. Usá .env.local o argumentos al ejecutar.
 *
 * Uso (importante: el cwd debe ser la carpeta escuelariver/ que contiene package.json y scripts/):
 *   cd escuelariver
 *
 *   Opción A — variables en .env.local:
 *     SUPER_ADMIN_EMAIL=abengolea1@gmail.com
 *     SUPER_ADMIN_PASSWORD=tu_contraseña_segura
 *     npm run seed:super-admin
 *
 *   Opción B — una sola vez por consola (no queda en archivos del proyecto):
 *     npx tsx scripts/create-super-admin.ts abengolea1@gmail.com "tu_contraseña"
 *
 *   Desde el repo padre (carpeta que contiene escuelariver/):
 *     npm run seed:super-admin
 *     (usa SUPER_ADMIN_EMAIL y SUPER_ADMIN_PASSWORD en escuelariver/.env.local)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import * as fs from 'fs';
import * as admin from 'firebase-admin';

const DEFAULT_SUPER_ADMIN_EMAIL = 'abengolea1@gmail.com';

function parseArgs(): { email: string; password: string | undefined } {
  const argv = process.argv.slice(2).filter((a) => a !== '--');
  const emailFromArgv = argv[0]?.trim();
  const passwordFromArgv = argv[1];
  const email =
    (process.env.SUPER_ADMIN_EMAIL || emailFromArgv || DEFAULT_SUPER_ADMIN_EMAIL).trim();
  const password = process.env.SUPER_ADMIN_PASSWORD || passwordFromArgv;
  return { email, password };
}

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
  const candidates = [
    path.join(cwd, 'service-account.json'),
    path.join(cwd, 'service-account.json.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return '';
}

function initFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const credentialsPath = resolveCredentialsPath();
  if (!credentialsPath) {
    console.error(
      'No se encontró el archivo de la cuenta de servicio.\n' +
        'Poné service-account.json en la carpeta del proyecto o definí GOOGLE_APPLICATION_CREDENTIALS.'
    );
    process.exit(1);
  }
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  return admin.initializeApp({
    projectId: projectId || undefined,
    credential: admin.credential.applicationDefault(),
  });
}

async function main() {
  const { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD } = parseArgs();

  if (!SUPER_ADMIN_EMAIL) {
    console.error('Falta el email (SUPER_ADMIN_EMAIL o primer argumento).');
    process.exit(1);
  }
  if (!SUPER_ADMIN_PASSWORD) {
    console.error(
      'Falta la contraseña.\n' +
        'Definí SUPER_ADMIN_PASSWORD en .env.local o ejecutá:\n' +
        '  npx tsx scripts/create-super-admin.ts "email" "contraseña"'
    );
    process.exit(1);
  }

  const app = initFirebaseAdmin();
  const auth = admin.auth(app);
  const db = admin.firestore(app);

  try {
    let userRecord: admin.auth.UserRecord;

    try {
      userRecord = await auth.getUserByEmail(SUPER_ADMIN_EMAIL);
      console.log(`✓ Usuario ya existe en Auth: ${SUPER_ADMIN_EMAIL} (uid: ${userRecord.uid})`);
      await auth.updateUser(userRecord.uid, { password: SUPER_ADMIN_PASSWORD });
      console.log('✓ Contraseña actualizada en Firebase Auth.');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email: SUPER_ADMIN_EMAIL,
          password: SUPER_ADMIN_PASSWORD,
          emailVerified: true,
          displayName: 'Super Admin',
        });
        console.log(`✓ Usuario creado en Auth: ${SUPER_ADMIN_EMAIL} (uid: ${userRecord.uid})`);
      } else {
        throw err;
      }
    }

    const platformUserRef = db.collection('platformUsers').doc(userRecord.uid);
    await platformUserRef.set(
      {
        email: SUPER_ADMIN_EMAIL,
        super_admin: true,
        createdAt: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    );
    console.log('✓ Firestore platformUsers/{uid} con super_admin: true');

    console.log('\n--- Super admin listo ---');
    console.log(`Email: ${SUPER_ADMIN_EMAIL}`);
    console.log('Iniciá sesión en /auth/login con esa cuenta.');
    console.log('(La contraseña no se muestra por consola por seguridad.)');
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
