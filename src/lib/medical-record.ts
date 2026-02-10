import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB para PDF
const ALLOWED_TYPE = "application/pdf";

/**
 * Sube la ficha médica (PDF) del jugador a Storage y devuelve { url, storagePath }.
 * Ruta: schools/{schoolId}/players/{playerId}/medical-record.pdf
 * Reemplaza el archivo anterior si existe.
 */
export async function uploadMedicalRecord(
  storage: FirebaseStorage,
  schoolId: string,
  playerId: string,
  file: File
): Promise<{ url: string; storagePath: string }> {
  if (file.type !== ALLOWED_TYPE) {
    throw new Error("Solo se permiten archivos PDF.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("El PDF debe pesar menos de 5MB.");
  }
  const storagePath = `schools/${schoolId}/players/${playerId}/medical-record.pdf`;
  const storageRef = ref(storage, storagePath);

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    task.on("state_changed", () => {}, reject, () => resolve());
  });

  const url = await getDownloadURL(storageRef);
  return { url, storagePath };
}
