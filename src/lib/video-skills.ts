/**
 * Fundamentos para etiquetar videos de la videoteca.
 * Mismos ids que la rúbrica de evaluaciones deportivas (AddEvaluationSheet).
 */

export interface VideoSkillOption {
  id: string;
  label: string;
  group: "campo" | "arquero";
}

/** Rúbrica de jugadores de campo (fútbol). */
export const VIDEO_SKILLS_OUTFIELD: VideoSkillOption[] = [
  { id: "controlPase", label: "Control y pase", group: "campo" },
  { id: "recepcionPecho", label: "Recepción de pecho", group: "campo" },
  { id: "cabezazo", label: "Cabezazo", group: "campo" },
  { id: "remateArco", label: "Remate al arco", group: "campo" },
  { id: "dribbling", label: "Dribbling", group: "campo" },
  { id: "defensa", label: "Defensa", group: "campo" },
  { id: "dominioBalon", label: "Dominio de balón (jueguitos)", group: "campo" },
];

/** Rúbrica de arqueros (fútbol). */
export const VIDEO_SKILLS_GOALKEEPER: VideoSkillOption[] = [
  { id: "posicionInicial", label: "Posición inicial", group: "arquero" },
  { id: "pasesManoPie", label: "Pases de mano y pie", group: "arquero" },
  { id: "tomaBaja", label: "Toma baja", group: "arquero" },
  { id: "tomaMedia", label: "Toma media", group: "arquero" },
  { id: "tomaAlta", label: "Toma alta", group: "arquero" },
  { id: "tomaBajaConCaida", label: "Toma baja con caída", group: "arquero" },
  { id: "caidaDerecha", label: "Caída derecha", group: "arquero" },
  { id: "caidaIzquierda", label: "Caída izquierda", group: "arquero" },
  { id: "saltos", label: "Saltos", group: "arquero" },
  { id: "salidaPunos", label: "Salidas de puños", group: "arquero" },
];

/** Todos los fundamentos (filtros, etiquetas). */
export const VIDEO_SKILLS_ALL: VideoSkillOption[] = [
  ...VIDEO_SKILLS_OUTFIELD,
  ...VIDEO_SKILLS_GOALKEEPER,
];

/** Encabezados para agrupar en selects y formularios. */
export const VIDEO_SKILL_GROUPS: { groupId: "campo" | "arquero"; heading: string; skills: VideoSkillOption[] }[] =
  [
    { groupId: "campo", heading: "Jugador de campo", skills: VIDEO_SKILLS_OUTFIELD },
    { groupId: "arquero", heading: "Arquero", skills: VIDEO_SKILLS_GOALKEEPER },
  ];

/** Etiquetas antiguas (listado mezclaba términos de básquet); los videos ya guardados siguen mostrando texto legible. */
const LEGACY_VIDEO_SKILL_LABELS: Record<string, string> = {
  pase: "Pase (etiqueta anterior)",
  tiro: "Tiro / finalización (etiqueta anterior)",
  tiro_libre: "Tiro libre (etiqueta anterior)",
  triple: "Triple (etiqueta anterior — básquet)",
  entrada: "Entrada (etiqueta anterior — básquet)",
  rebote: "Rebote (etiqueta anterior — básquet)",
  bloqueo: "Bloqueo (etiqueta anterior — básquet)",
  asistencia: "Asistencia (etiqueta anterior)",
  vision: "Visión de juego (etiqueta anterior)",
  marca: "Marca (etiqueta anterior)",
  contraataque: "Contraataque (etiqueta anterior)",
  poste: "Juego de poste (etiqueta anterior — básquet)",
  pick_roll: "Pick and roll (etiqueta anterior — básquet)",
};

const labelById = new Map<string, string>(VIDEO_SKILLS_ALL.map((s) => [s.id, s.label]));

/** Devuelve el label de un fundamento por su id (rúbrica actual o etiqueta legada). */
export function getVideoSkillLabel(id: string): string {
  return labelById.get(id) ?? LEGACY_VIDEO_SKILL_LABELS[id] ?? id;
}
