/**
 * Rúbrica única de calificaciones de jugador (evaluaciones).
 * Escala: 1–5 estrellas.
 */

export const MAX_STARS = 5;

/** Valor por defecto al abrir una evaluación nueva (punto medio). */
export const DEFAULT_STAR_VALUE = 3;

export const EVALUATION_RUBRIC_KEYS = [
  "tecnica",
  "coordinacion",
  "comprension",
  "comportamiento",
  "companerismo",
] as const;

export type EvaluationRubricKey = (typeof EVALUATION_RUBRIC_KEYS)[number];

export const EVALUATION_RUBRIC_SKILLS: { name: EvaluationRubricKey; label: string }[] = [
  { name: "tecnica", label: "Técnica" },
  { name: "coordinacion", label: "Coordinación" },
  { name: "comprension", label: "Comprensión" },
  { name: "comportamiento", label: "Comportamiento" },
  { name: "companerismo", label: "Compañerismo" },
];

/** Etiquetas para UI (rúbrica actual + claves legacy de evaluaciones viejas). */
export const EVALUATION_SKILL_LABELS: Record<string, string> = {
  tecnica: "Técnica",
  coordinacion: "Coordinación",
  comprension: "Comprensión",
  comportamiento: "Comportamiento",
  companerismo: "Compañerismo",
  // Legacy — rúbrica de campo / arquero / socio-emocional anterior
  controlPase: "Control y pase",
  recepcionPecho: "Recepción de pecho",
  cabezazo: "Cabezazo",
  remateArco: "Remate al arco",
  controlYRemate: "Control y remate",
  dribbling: "Dribbling",
  defensa: "Defensa",
  dominioBalon: "Dominio de balón (jueguitos)",
  posicionInicial: "Posición inicial",
  pasesManoPie: "Pases de mano y pie",
  tomaBaja: "Toma baja",
  tomaMedia: "Toma media",
  tomaAlta: "Toma alta",
  tomaBajaConCaida: "Toma baja con caída",
  caidaDerecha: "Caída derecha",
  caidaIzquierda: "Caída izquierda",
  saltos: "Saltos",
  salidaPunos: "Salidas de puños",
  manejo: "Manejo de balón",
  control: "Control de Balón",
  pase: "Pase",
  tiro: "Tiro / Finalización",
  definicion: "Definición",
  posicionamiento: "Posicionamiento",
  tomaDeDecision: "Toma de Decisión",
  presion: "Presión y Recuperación",
  respect: "Respeto",
  responsibility: "Responsabilidad",
  teamwork: "Compañerismo",
  resilience: "Resiliencia",
  learningAttitude: "Actitud de aprendizaje",
  empathy: "Empatía",
};

/** Limita un puntaje a 1..MAX_STARS (útil al editar evaluaciones con escala anterior). */
export function clampStar(value: number | undefined | null, fallback = DEFAULT_STAR_VALUE): number {
  if (value == null || Number.isNaN(Number(value))) return fallback;
  const n = Math.round(Number(value));
  // Escala anterior era 1–10: reescalar aproximadamente a 1–5
  const normalized = n > MAX_STARS ? Math.ceil(n / 2) : n;
  return Math.min(MAX_STARS, Math.max(1, normalized));
}

function averageOf(values: Array<number | undefined | null>): number | undefined {
  const nums = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (!nums.length) return undefined;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Obtiene el puntaje de un rubro nuevo desde `technical` / legacy.
 * Si ya existe la clave nueva, la usa; si no, intenta promediar claves viejas relacionadas.
 */
export function resolveRubricScore(
  key: EvaluationRubricKey,
  technical: Record<string, number> | undefined,
  tactical?: Record<string, number> | undefined,
  socioEmotional?: Record<string, number> | undefined
): number {
  const t = technical ?? {};
  if (typeof t[key] === "number") return clampStar(t[key]);

  switch (key) {
    case "tecnica":
      return clampStar(
        averageOf([
          t.controlPase,
          t.recepcionPecho,
          t.cabezazo,
          t.remateArco,
          t.controlYRemate,
          t.dribbling,
          t.defensa,
          t.dominioBalon,
          t.posicionInicial,
          t.pasesManoPie,
          t.tomaBaja,
          t.tomaMedia,
          t.tomaAlta,
          t.tomaBajaConCaida,
          t.caidaDerecha,
          t.caidaIzquierda,
          t.saltos,
          t.salidaPunos,
          t.manejo,
          t.control,
          t.pase,
          t.tiro,
          t.definicion,
        ])
      );
    case "coordinacion":
      return clampStar(averageOf([t.coordinacion, t.saltos]));
    case "comprension":
      return clampStar(
        averageOf([
          t.comprension,
          tactical?.tomaDeDecision,
          tactical?.posicionamiento,
          tactical?.presion,
        ])
      );
    case "comportamiento":
      return clampStar(
        averageOf([
          t.comportamiento,
          socioEmotional?.respect,
          socioEmotional?.responsibility,
          socioEmotional?.learningAttitude,
          socioEmotional?.resilience,
        ])
      );
    case "companerismo":
      return clampStar(
        averageOf([t.companerismo, socioEmotional?.teamwork, socioEmotional?.empathy])
      );
    default:
      return DEFAULT_STAR_VALUE;
  }
}
