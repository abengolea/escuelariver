/**
 * Vincula un usuario ya existente en Firebase Auth a una escuela como staff
 * (school_admin o coach) creando/actualizando schools/{schoolId}/users/{uid}.
 *
 * El email en el doc debe coincidir (minúsculas) con el de Auth para que useUserProfile
 * encuentre la membresía por collectionGroup users.
 *
 * Uso (cwd: carpeta escuelariver/ con package.json):
 *   npx tsx scripts/add-school-staff.ts <schoolId> <email> [school_admin|coach] [displayName]
 *
 * Ejemplo:
 *   npx tsx scripts/add-school-staff.ts ABC123xyz abengolea1@gmail.com school_admin "Admin River"
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

function resolveCredentialsPath(): string {
  const cwd = process.cwd();
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath) {
    const absolute = path.isAbsolute(envPath) ? envPath : path.join(cwd, envPath);
    if (fs.existsSync(absolute)) return absolute;
  }
  for (const p of [path.join(cwd, 'service-account.json'), path.join(cwd, 'service-account.json.json')]) {
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
      'No se encontró service-account.json ni GOOGLE_APPLICATION_CREDENTIALS.'
    );
    process.exit(1);
  }
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  return admin.initializeApp({
    projectId: projectId || undefined,
    credential: admin.credential.applicationDefault(),
  });
}

type StaffRole = 'school_admin' | 'coach';

function parseArgs(): { schoolId: string; email: string; role: StaffRole; displayName: string } {
  const argv = process.argv.slice(2).filter((a) => a !== '--');
  const schoolId = argv[0]?.trim();
  const email = argv[1]?.trim().toLowerCase();
  const roleArg = (argv[2]?.trim().toLowerCase() as StaffRole) || 'school_admin';
  const displayName = argv[3]?.trim() || email?.split('@')[0] || 'Staff';

  if (!schoolId || !email) {
    console.error(
      'Uso: npx tsx scripts/add-school-staff.ts <schoolId> <email> [school_admin|coach] [displayName]'
    );
    process.exit(1);
  }
  if (roleArg !== 'school_admin' && roleArg !== 'coach') {
    console.error('El rol debe ser school_admin o coach.');
    process.exit(1);
  }
  return { schoolId, email, role: roleArg, displayName };
}

async function main() {
  const { schoolId, email, role, displayName } = parseArgs();
  const app = initFirebaseAdmin();
  const auth = admin.auth(app);
  const db = admin.firestore(app);

  const schoolSnap = await db.doc(`schools/${schoolId}`).get();
  if (!schoolSnap.exists) {
    console.error(`No existe schools/${schoolId}. Revisá el ID en Firestore o en la URL /dashboard/schools/<id>.`);
    process.exit(1);
  }

  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'auth/user-not-found') {
      console.error(`No hay usuario en Auth con email ${email}. Creá la cuenta primero o usá create-super-admin.`);
      process.exit(1);
    }
    throw e;
  }

  const emailNorm = email.trim().toLowerCase();
  const schoolUserRef = db.doc(`schools/${schoolId}/users/${userRecord.uid}`);
  await schoolUserRef.set(
    {
      email: emailNorm,
      displayName,
      role,
    },
    { merge: true }
  );

  console.log(`✓ schools/${schoolId}/users/${userRecord.uid}`);
  console.log(`  email: ${emailNorm}, role: ${role}, displayName: ${displayName}`);
  console.log('\nCerrá sesión y volvé a entrar (o recargá) para cargar el panel de escuela.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
