/**
 * Duplicado deliberado de src/lib/player-auth-sync.ts (Cloud Functions no comparte bundle con Next).
 * Si cambiás la lógica, actualizá ambos archivos.
 */

import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function getAuthUserByEmailSafe(auth: Auth, email: string) {
  try {
    return await auth.getUserByEmail(email);
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'auth/user-not-found') {
      return null;
    }
    throw e;
  }
}

export type AuthSyncResult = { ok: true } | { error: string; status: number };

export async function ensureAuthForPlayerEmail(
  adminAuth: Auth,
  db: Firestore,
  schoolId: string,
  playerId: string,
  oldEmailNorm: string | null,
  newEmailNorm: string
): Promise<AuthSyncResult> {
  const loginRef = db.doc(`playerLogins/${newEmailNorm}`);
  const loginSnap = await loginRef.get();
  if (loginSnap.exists) {
    const d = loginSnap.data()!;
    if (d.playerId !== playerId || d.schoolId !== schoolId) {
      return {
        error: 'Ese email ya está vinculado a otro jugador.',
        status: 409,
      };
    }
  }

  if (oldEmailNorm && oldEmailNorm !== newEmailNorm) {
    const oldUser = await getAuthUserByEmailSafe(adminAuth, oldEmailNorm);
    if (oldUser) {
      const taken = await getAuthUserByEmailSafe(adminAuth, newEmailNorm);
      if (taken && taken.uid !== oldUser.uid) {
        return {
          error: 'El nuevo email ya está en uso por otra cuenta.',
          status: 409,
        };
      }
      try {
        await adminAuth.updateUser(oldUser.uid, { email: newEmailNorm });
      } catch (e: unknown) {
        if (e && typeof e === 'object' && 'code' in e) {
          const code = (e as { code: string }).code;
          if (code === 'auth/email-already-exists') {
            return {
              error: 'El nuevo email ya está registrado en el sistema.',
              status: 409,
            };
          }
        }
        throw e;
      }
      return { ok: true };
    }
  }

  const existingNew = await getAuthUserByEmailSafe(adminAuth, newEmailNorm);
  if (existingNew) {
    if (!loginSnap.exists) {
      return {
        error:
          'Ese correo ya tiene una cuenta. Usá otro email o pedile al jugador que use «Olvidé mi contraseña» con ese correo.',
        status: 409,
      };
    }
    return { ok: true };
  }

  try {
    await adminAuth.createUser({
      email: newEmailNorm,
      password: generateTempPassword(),
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e) {
      const code = (e as { code: string }).code;
      if (code === 'auth/email-already-exists') {
        return {
          error: 'Ese correo ya está registrado en el sistema.',
          status: 409,
        };
      }
    }
    throw e;
  }
  return { ok: true };
}

export function normalizePlayerEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim().toLowerCase();
  return t.length > 0 ? t : null;
}
