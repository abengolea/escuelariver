/** Habilidad/categoría para etiquetar videos de la videoteca. */
export interface VideoSkillOption {
  id: string;
  label: string;
  group: "general";
}

/** Habilidades de fútbol para la videoteca. */
export const VIDEO_SKILLS_GENERAL: VideoSkillOption[] = [
  { id: "dribbling", label: "Dribbling", group: "general" },
  { id: "pase", label: "Pase", group: "general" },
  { id: "tiro", label: "Tiro", group: "general" },
  { id: "tiro_libre", label: "Tiro libre", group: "general" },
  { id: "triple", label: "Triple", group: "general" },
  { id: "entrada", label: "Entrada", group: "general" },
  { id: "rebote", label: "Rebote", group: "general" },
  { id: "defensa", label: "Defensa", group: "general" },
  { id: "bloqueo", label: "Bloqueo", group: "general" },
  { id: "asistencia", label: "Asistencia", group: "general" },
  { id: "vision", label: "Visión de juego", group: "general" },
  { id: "marca", label: "Marca", group: "general" },
  { id: "contraataque", label: "Contraataque", group: "general" },
  { id: "poste", label: "Juego de poste", group: "general" },
  { id: "pick_roll", label: "Pick and Roll", group: "general" },
];

export const VIDEO_SKILLS_ALL: VideoSkillOption[] = [...VIDEO_SKILLS_GENERAL];

const labelById = new Map(VIDEO_SKILLS_ALL.map((s) => [s.id, s.label]));

/** Devuelve el label de una habilidad por su id. */
export function getVideoSkillLabel(id: string): string {
  return labelById.get(id) ?? id;
}
