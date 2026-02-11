import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/** Edad que cumple (o cumplió) en el año en curso. Usada para categorías SUB-X. */
export function getCategoryAge(birthDate: Date): number {
  const bd = birthDate instanceof Date ? birthDate : new Date(birthDate);
  return new Date().getFullYear() - bd.getFullYear();
}

/** Etiqueta de categoría SUB-9, SUB-10, SUB-11... según edad que cumple en el año en curso. */
export function getCategoryLabel(birthDate: Date): string {
  const age = getCategoryAge(birthDate);
  return `SUB-${Math.max(5, Math.min(18, age))}`;
}

/** Orden de categorías para ordenar listas (SUB-5, SUB-6, ... SUB-18). */
export const CATEGORY_ORDER = ["SUB-5", "SUB-6", "SUB-7", "SUB-8", "SUB-9", "SUB-10", "SUB-11", "SUB-12", "SUB-13", "SUB-14", "SUB-15", "SUB-16", "SUB-17", "SUB-18"] as const;

/** Compara dos etiquetas de categoría para ordenar (SUB-5 < SUB-6 < ... < SUB-18). */
export function compareCategory(a: string, b: string): number {
  const i = CATEGORY_ORDER.indexOf(a as (typeof CATEGORY_ORDER)[number]);
  const j = CATEGORY_ORDER.indexOf(b as (typeof CATEGORY_ORDER)[number]);
  if (i === -1 && j === -1) return 0;
  if (i === -1) return 1;
  if (j === -1) return -1;
  return i - j;
}

/** Indica si la fecha de nacimiento corresponde al día de hoy (mes y día). */
export function isBirthdayToday(birthDate: Date | undefined | null): boolean {
  if (!birthDate) return false;
  const bd = birthDate instanceof Date ? birthDate : new Date(birthDate);
  const today = new Date();
  return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
}

/** Edad en meses desde la fecha de nacimiento hasta una fecha de referencia. */
export function getAgeInMonths(birthDate: Date, referenceDate?: Date): number {
  const bd = birthDate instanceof Date ? birthDate : new Date(birthDate);
  const ref = referenceDate ? (referenceDate instanceof Date ? referenceDate : new Date(referenceDate)) : new Date();
  let months = (ref.getFullYear() - bd.getFullYear()) * 12;
  months += ref.getMonth() - bd.getMonth();
  if (ref.getDate() < bd.getDate()) months--;
  return Math.max(0, months);
}

/** Calcula el IMC (peso kg / (altura m)²). */
export function calculateIMC(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/** Indica si el jugador tiene perfil completo (datos mínimos + foto + email) para poder ver evaluaciones, videos, etc. */
export function isPlayerProfileComplete(player: { firstName?: string; lastName?: string; birthDate?: unknown; tutorContact?: { name?: string; phone?: string } | null; email?: string | null; photoUrl?: string | null }): boolean {
  const hasName = Boolean(player.firstName?.trim() && player.lastName?.trim());
  const hasBirthDate = Boolean(player.birthDate != null && player.birthDate !== "");
  const tutor = player.tutorContact;
  const hasTutor = Boolean(tutor && typeof tutor === "object" && (tutor.name?.trim() ?? "") !== "" && (tutor.phone?.trim() ?? "") !== "");
  const email = (player.email ?? "").trim();
  const hasEmail = email.length > 0 && email.includes("@");
  const photo = (player.photoUrl ?? "").trim();
  const hasPhoto = photo.length > 0 && (photo.startsWith("http://") || photo.startsWith("https://"));
  return Boolean(hasName && hasBirthDate && hasTutor && hasEmail && hasPhoto);
}

/** Indica si la ficha médica del jugador está cargada y aprobada por admin/entrenador. */
export function isMedicalRecordApproved(player: { medicalRecord?: { approvedAt?: unknown } | null }): boolean {
  const mr = player.medicalRecord;
  return Boolean(mr && mr.approvedAt != null);
}

/** Indica si la ficha médica fue rechazada (incumplida) por admin/entrenador. */
export function isMedicalRecordRejected(player: { medicalRecord?: { rejectedAt?: unknown } | null }): boolean {
  const mr = player.medicalRecord;
  return Boolean(mr && mr.rejectedAt != null);
}

const PROFILE_FIELD_LABELS: Record<string, string> = {
  firstName: "Nombre",
  lastName: "Apellido",
  birthDate: "Fecha de nacimiento",
  tutorName: "Nombre del tutor",
  tutorPhone: "Teléfono del tutor",
  email: "Email",
  photoUrl: "Foto",
};

/** Devuelve la lista de nombres de campos que faltan para considerar el perfil completo (para mostrar al jugador). */
export function getMissingProfileFieldLabels(values: {
  firstName?: string;
  lastName?: string;
  birthDate?: unknown;
  tutorName?: string;
  tutorPhone?: string;
  email?: string;
  photoUrl?: string;
}): string[] {
  const missing: string[] = [];
  if (!(values.firstName?.trim() && values.lastName?.trim())) {
    if (!values.firstName?.trim()) missing.push(PROFILE_FIELD_LABELS.firstName);
    if (!values.lastName?.trim()) missing.push(PROFILE_FIELD_LABELS.lastName);
  }
  if (values.birthDate == null || values.birthDate === "") missing.push(PROFILE_FIELD_LABELS.birthDate);
  if (!values.tutorName?.trim()) missing.push(PROFILE_FIELD_LABELS.tutorName);
  if (!values.tutorPhone?.trim()) missing.push(PROFILE_FIELD_LABELS.tutorPhone);
  const email = (values.email ?? "").trim();
  if (email.length === 0 || !email.includes("@")) missing.push(PROFILE_FIELD_LABELS.email);
  const photo = (values.photoUrl ?? "").trim();
  if (photo.length === 0 || (!photo.startsWith("http://") && !photo.startsWith("https://"))) missing.push(PROFILE_FIELD_LABELS.photoUrl);
  return missing;
}
