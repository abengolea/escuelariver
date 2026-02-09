/**
 * Carga los flujos por defecto en la colección supportFlows.
 * Solo superadmin puede escribir en supportFlows (reglas Firestore).
 * Uso: desde el cliente (botón en OperatorDashboard) o desde un script con Firebase Admin.
 */

import type { Firestore } from 'firebase/firestore';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { supportFlowsSeed } from './flows-seed';

export async function seedSupportFlows(firestore: Firestore): Promise<{ loaded: number; errors: string[] }> {
  const errors: string[] = [];
  let loaded = 0;

  for (const flow of supportFlowsSeed) {
    try {
      const ref = doc(firestore, 'supportFlows', flow.id);
      await setDoc(ref, {
        ...flow,
        updatedAt: Timestamp.fromDate(flow.updatedAt),
      });
      loaded++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${flow.id}: ${msg}`);
    }
  }

  return { loaded, errors };
}
