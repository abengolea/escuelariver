import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import type { Attendance, Training, TrainingSlot } from "./types";
import { format } from "date-fns";
import { getSlotKey } from "./training-slot-utils";

/** Obtiene el entrenamiento del día para una escuela (legacy: sin slotKey, uno solo por fecha) */
export async function getTrainingByDate(
  firestore: Firestore,
  schoolId: string,
  dateStr: string
): Promise<(Training & { id: string }) | null> {
  const trainingsRef = collection(firestore, `schools/${schoolId}/trainings`);
  const q = query(trainingsRef, where("dateStr", "==", dateStr), limit(20));
  const snapshot = await getDocs(q);
  const legacy = snapshot.docs.find((d) => d.data().slotKey == null);
  if (!legacy) return null;
  const data = legacy.data();
  return {
    id: legacy.id,
    date: data.date?.toDate?.() ?? new Date(data.date),
    dateStr: data.dateStr,
    slotKey: data.slotKey,
    createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
    createdBy: data.createdBy,
  };
}

/** Obtiene o crea un entrenamiento para fecha + slot */
export async function getOrCreateTrainingForSlot(
  firestore: Firestore,
  schoolId: string,
  dateStr: string,
  slot: TrainingSlot,
  createdBy: string
): Promise<Training & { id: string }> {
  const slotKey = getSlotKey(slot);
  const trainingsRef = collection(firestore, `schools/${schoolId}/trainings`);

  const q = query(
    trainingsRef,
    where("dateStr", "==", dateStr),
    where("slotKey", "==", slotKey),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    return {
      id: docSnap.id,
      date: data.date?.toDate?.() ?? new Date(data.date),
      dateStr: data.dateStr,
      slotKey: data.slotKey,
      createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
      createdBy: data.createdBy,
    };
  }

  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  const newDoc = await addDoc(trainingsRef, {
    date: Timestamp.fromDate(date),
    dateStr,
    slotKey,
    createdAt: Timestamp.now(),
    createdBy,
  });
  return {
    id: newDoc.id,
    date,
    dateStr,
    slotKey,
    createdAt: new Date(),
    createdBy,
  };
}

/** Obtiene todos los entrenamientos (por slot) para una fecha, dado los slots del día */
export async function getTrainingsForDate(
  firestore: Firestore,
  schoolId: string,
  dateStr: string,
  slotsForDay: TrainingSlot[],
  createdBy: string
): Promise<Array<{ training: Training & { id: string }; slot: TrainingSlot }>> {
  const result: Array<{ training: Training & { id: string }; slot: TrainingSlot }> = [];
  for (const slot of slotsForDay) {
    const training = await getOrCreateTrainingForSlot(
      firestore,
      schoolId,
      dateStr,
      slot,
      createdBy
    );
    result.push({ training, slot });
  }
  return result;
}

/** Obtiene la asistencia de todos los jugadores para un entrenamiento */
export async function getAttendanceForTraining(
  firestore: Firestore,
  schoolId: string,
  trainingId: string
): Promise<Record<string, Attendance["status"]>> {
  const attendanceRef = collection(
    firestore,
    `schools/${schoolId}/trainings/${trainingId}/attendance`
  );
  const snapshot = await getDocs(attendanceRef);
  const result: Record<string, Attendance["status"]> = {};
  snapshot.docs.forEach((d) => {
    const data = d.data();
    result[d.id] = data.status || "presente";
  });
  return result;
}

/** Guarda asistencia para un entrenamiento existente (por turno) */
async function saveAttendanceForTrainingId(
  firestore: Firestore,
  schoolId: string,
  trainingId: string,
  date: Date,
  attendanceMap: Record<string, Attendance["status"]>,
  createdBy: string
): Promise<void> {
  const batch = writeBatch(firestore);
  const trainingDate = new Date(date);
  trainingDate.setHours(0, 0, 0, 0);

  for (const [playerId, status] of Object.entries(attendanceMap)) {
    const attRef = doc(
      firestore,
      `schools/${schoolId}/trainings/${trainingId}/attendance/${playerId}`
    );
    batch.set(attRef, {
      status,
      playerId,
      trainingId,
      trainingDate: Timestamp.fromDate(trainingDate),
    });
  }
  await batch.commit();
}

/** Guarda asistencia para un slot en una fecha (asistencia por turno) */
export async function saveAttendanceForSlot(
  firestore: Firestore,
  schoolId: string,
  date: Date,
  slot: TrainingSlot,
  attendanceMap: Record<string, Attendance["status"]>,
  createdBy: string
): Promise<string> {
  const dateStr = format(date, "yyyy-MM-dd");
  const training = await getOrCreateTrainingForSlot(
    firestore,
    schoolId,
    dateStr,
    slot,
    createdBy
  );
  await saveAttendanceForTrainingId(
    firestore,
    schoolId,
    training.id,
    date,
    attendanceMap,
    createdBy
  );
  return training.id;
}

/** Crea un entrenamiento y guarda la asistencia (legacy: un solo entrenamiento por fecha) */
export async function saveAttendance(
  firestore: Firestore,
  schoolId: string,
  date: Date,
  attendanceMap: Record<string, Attendance["status"]>,
  createdBy: string
): Promise<string> {
  const dateStr = format(date, "yyyy-MM-dd");
  const trainingsRef = collection(firestore, `schools/${schoolId}/trainings`);

  const existing = await getTrainingByDate(firestore, schoolId, dateStr);
  let trainingId: string;

  if (existing) {
    trainingId = existing.id;
  } else {
    const newTraining = await addDoc(trainingsRef, {
      date: Timestamp.fromDate(date),
      dateStr,
      createdAt: Timestamp.now(),
      createdBy,
    });
    trainingId = newTraining.id;
  }

  await saveAttendanceForTrainingId(
    firestore,
    schoolId,
    trainingId,
    date,
    attendanceMap,
    createdBy
  );
  return trainingId;
}

/** Historial de asistencia de un jugador (sin collectionGroup, evita índices compuestos) */
export async function getAttendanceHistoryForPlayer(
  firestore: Firestore,
  schoolId: string,
  playerId: string,
  limitCount = 50
): Promise<Array<{ date: Date; status: Attendance["status"] }>> {
  const trainingsRef = collection(firestore, `schools/${schoolId}/trainings`);
  const q = query(
    trainingsRef,
    orderBy("date", "desc"),
    limit(limitCount)
  );
  const trainingsSnap = await getDocs(q);
  const result: Array<{ date: Date; status: Attendance["status"] }> = [];

  for (const tDoc of trainingsSnap.docs) {
    const attRef = doc(
      firestore,
      `schools/${schoolId}/trainings/${tDoc.id}/attendance/${playerId}`
    );
    const attSnap = await getDoc(attRef);
    if (attSnap.exists()) {
      const data = attSnap.data();
      const trainingData = tDoc.data();
      const date =
        data?.trainingDate?.toDate?.() ??
        trainingData?.date?.toDate?.() ??
        new Date(trainingData?.date ?? 0);
      result.push({
        date,
        status: (data?.status || "presente") as Attendance["status"],
      });
    }
  }

  return result.sort((a, b) => b.date.getTime() - a.date.getTime());
}
