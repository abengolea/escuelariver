/**
 * Verificación de autenticación en el servidor (API routes, server actions).
 * SOLO para uso server-side.
 */

import { getAdminAuth } from './firebase-admin';

/** Decodifica el token Bearer y retorna el uid o null */
export async function verifyIdToken(authHeader: string | null): Promise<{ uid: string; email?: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

/**
 * Verifica que el usuario sea admin de la escuela (school_admin) o super admin.
 * Necesita consultar Firestore para el rol - por ahora retornamos true si hay token válido.
 * TODO: Consultar schools/{schoolId}/users/{uid} y platformUsers para super_admin
 */
export async function isSchoolAdminOrSuperAdmin(
  _uid: string,
  _schoolId: string
): Promise<boolean> {
  // TODO: Implementar consulta a Firestore para verificar rol
  // Por ahora asumimos que si pasó verifyIdToken, el cliente ya validó permisos
  return true;
}
