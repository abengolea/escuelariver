import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convierte birthDate (o cualquier valor tipo timestamp) a Date válido.
 * Soporta: Date, Firestore Timestamp, { seconds, nanoseconds }, string ISO, number (ms).
 * Jugadores creados por migración/importación pueden tener birthDate como objeto plano.
 */
export function toDateSafe(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  const v = val as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  if (typeof v.toDate === "function") return v.toDate();
  if (typeof v === "object" && typeof v.seconds === "number") {
    const ms = v.seconds * 1000 + (v.nanoseconds ?? 0) / 1e6;
    return new Date(ms);
  }
  const parsed = new Date(val as string | number);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
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

/** Etiqueta de categoría SUB-9, SUB-10... (legacy). Usar getBirthYearLabel para UI. */
export function getCategoryLabel(birthDate: Date): string {
  const age = getCategoryAge(birthDate);
  return `SUB-${Math.max(5, Math.min(18, age))}`;
}

/** Etiqueta Cat. año nac.: "09", "15" (últimos 2 dígitos del año de nacimiento). */
export function getBirthYearLabel(birthDate: Date): string {
  const bd = birthDate instanceof Date ? birthDate : new Date(birthDate);
  return String(bd.getFullYear()).slice(-2);
}

/** Año de nacimiento (2008, 2009, ...). */
export function getBirthYear(birthDate: Date): number {
  const bd = birthDate instanceof Date ? birthDate : new Date(birthDate);
  return bd.getFullYear();
}

/** Orden de categorías para ordenar listas (SUB-5, SUB-6, ... SUB-18). Legacy. */
export const CATEGORY_ORDER = ["SUB-5", "SUB-6", "SUB-7", "SUB-8", "SUB-9", "SUB-10", "SUB-11", "SUB-12", "SUB-13", "SUB-14", "SUB-15", "SUB-16", "SUB-17", "SUB-18"] as const;

/** Años de nacimiento típicos para escuelas (2005–2022). Orden: más reciente primero. */
export const BIRTH_YEAR_ORDER = [2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009, 2008, 2007, 2006, 2005] as const;

/** Etiquetas "22", "21", ... "05" para filtros (Cat. año nac.). */
export const BIRTH_YEAR_LABELS = BIRTH_YEAR_ORDER.map((y) => String(y).slice(-2));

/** Convierte etiqueta "09" en año 2009. Asume 2000s para escuelas. */
export function parseBirthYearLabel(label: string): number {
  const n = parseInt(label, 10);
  if (isNaN(n) || n < 0 || n > 99) return 0;
  return 2000 + (n % 100);
}

/** Dado un año de nacimiento, devuelve SUB-X equivalente (para compatibilidad con pagos). */
export function getCategoryLabelFromBirthYear(year: number): string {
  return getCategoryLabel(new Date(year, 0, 1));
}

/** Compara dos etiquetas de categoría para ordenar (SUB-5 < SUB-6 < ...). Legacy. */
export function compareCategory(a: string, b: string): number {
  const i = CATEGORY_ORDER.indexOf(a as (typeof CATEGORY_ORDER)[number]);
  const j = CATEGORY_ORDER.indexOf(b as (typeof CATEGORY_ORDER)[number]);
  if (i === -1 && j === -1) return 0;
  if (i === -1) return 1;
  if (j === -1) return -1;
  return i - j;
}

/** Compara años de nacimiento: mayor año = más chico. 2021 < 2015. */
export function compareBirthYear(a: number, b: number): number {
  return b - a; // 2021 antes que 2015
}

/** Compara etiquetas "09", "15" (cat. año nac.). */
export function compareBirthYearLabel(a: string, b: string): number {
  const yearA = parseInt(a, 10);
  const yearB = parseInt(b, 10);
  if (isNaN(yearA) && isNaN(yearB)) return 0;
  if (isNaN(yearA)) return 1;
  if (isNaN(yearB)) return -1;
  return yearB - yearA; // más reciente primero
}

/** Indica si la categoría del jugador está dentro del rango [categoryFrom, categoryTo] (inclusive). Legacy. */
export function isCategoryInRange(
  playerCategory: string,
  categoryFrom: string,
  categoryTo: string
): boolean {
  const cmp = compareCategory(playerCategory, categoryFrom);
  if (cmp < 0) return false;
  const cmpTo = compareCategory(playerCategory, categoryTo);
  return cmpTo <= 0;
}

/** Indica si el año de nacimiento del jugador está en [yearFrom, yearTo] (inclusive). yearFrom/yearTo: 2008, 2015, etc. */
export function isBirthYearInRange(playerBirthYear: number, yearFrom: number, yearTo: number): boolean {
  return playerBirthYear >= Math.min(yearFrom, yearTo) && playerBirthYear <= Math.max(yearFrom, yearTo);
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
