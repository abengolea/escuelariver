import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * Sube la foto del jugador a Storage y devuelve la URL pública.
 * Ruta: schools/{schoolId}/players/{playerId}/photo.{ext}
 */
export async function uploadPlayerPhoto(
  storage: FirebaseStorage,
  schoolId: string,
  playerId: string,
  file: File
): Promise<string> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("La imagen debe pesar menos de 2MB.");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
  const storagePath = `schools/${schoolId}/players/${playerId}/photo.${safeExt}`;
  const storageRef = ref(storage, storagePath);

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    task.on("state_changed", () => {}, reject, () => resolve());
  });

  return getDownloadURL(storageRef);
}
