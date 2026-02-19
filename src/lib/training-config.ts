/**
 * Configuración de horarios de entrenamiento por escuela.
 * Almacenada en schools/{schoolId}/trainingConfig/default
 */

import type { Firestore } from "firebase-admin/firestore";
import type { TrainingConfig, TrainingSlot } from "./types";

const DEFAULT_CONFIG: Omit<TrainingConfig, "id"> = {
  slots: [],
  updatedAt: new Date(),
  updatedBy: "",
};

/** Obtiene la configuración de entrenamientos de una escuela. */
export async function getTrainingConfig(
  db: Firestore,
  schoolId: string
): Promise<TrainingConfig> {
  const docRef = db
    .collection("schools")
    .doc(schoolId)
    .collection("trainingConfig")
    .doc("default");

  const snap = await docRef.get();
  if (!snap.exists) {
    return {
      id: "default",
      ...DEFAULT_CONFIG,
    };
  }

  const data = snap.data()!;
  const slots = (data.slots ?? []) as TrainingSlot[];
  return {
    id: snap.id,
    slots,
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(data.updatedAt ?? 0),
    updatedBy: data.updatedBy ?? "",
  };
}

/** Guarda la configuración de entrenamientos. */
export async function saveTrainingConfig(
  db: Firestore,
  schoolId: string,
  slots: TrainingSlot[],
  updatedBy: string
): Promise<void> {
  const admin = await import("firebase-admin");
  const docRef = db
    .collection("schools")
    .doc(schoolId)
    .collection("trainingConfig")
    .doc("default");

  await docRef.set(
    {
      slots,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy,
    },
    { merge: true }
  );
}
