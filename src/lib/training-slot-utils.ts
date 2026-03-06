/**
 * Utilidades compartidas para slots de entrenamiento.
 */

import type { Player, TrainingSlot } from "./types";
import {
  getCategoryLabel,
  getBirthYear,
  isCategoryInRange,
  isBirthYearInRange,
} from "./utils";

/** Genera una clave estable para identificar un slot (para Training por fecha+slot). */
export function getSlotKey(slot: TrainingSlot): string {
  const days = slot.daysOfWeek?.length
    ? [...slot.daysOfWeek].sort().join(",")
    : String(slot.dayOfWeek);
  const yearPart =
    slot.yearFrom != null && slot.yearTo != null
      ? `${slot.yearFrom}-${slot.yearTo}`
      : `${slot.categoryFrom}-${slot.categoryTo}`;
  const parts = [days, slot.time ?? "", slot.name ?? "", yearPart];
  return parts.join("___");
}

/** Obtiene los jugadores asignados a un slot según reglas + manualPlayerIds. */
export function getPlayersInSlot(slot: TrainingSlot, activePlayers: Player[]): Player[] {
  const byRules: Player[] = [];

  if (slot.tipoCategoria === "arqueros") {
    byRules.push(...activePlayers.filter((p) => p.posicion_preferida === "arquero"));
  } else if (slot.tipoCategoria === "masculino" || slot.tipoCategoria === "femenino") {
    byRules.push(
      ...activePlayers.filter((p) => {
        if (p.genero !== slot.tipoCategoria) return false;
        if (!p.birthDate) return false;
        const bd = p.birthDate instanceof Date ? p.birthDate : new Date(p.birthDate);
        if (slot.yearFrom != null && slot.yearTo != null) {
          return isBirthYearInRange(getBirthYear(bd), slot.yearFrom, slot.yearTo);
        }
        const cat = getCategoryLabel(bd);
        return isCategoryInRange(cat, slot.categoryFrom, slot.categoryTo);
      })
    );
  } else {
    byRules.push(
      ...activePlayers.filter((p) => {
        if (!p.birthDate) return false;
        const bd = p.birthDate instanceof Date ? p.birthDate : new Date(p.birthDate);
        if (slot.yearFrom != null && slot.yearTo != null) {
          return isBirthYearInRange(getBirthYear(bd), slot.yearFrom, slot.yearTo);
        }
        const cat = getCategoryLabel(bd);
        return isCategoryInRange(cat, slot.categoryFrom, slot.categoryTo);
      })
    );
  }

  const byRulesIds = new Set(byRules.map((p) => p.id));
  const manualOnly = (slot.manualPlayerIds ?? [])
    .map((id) => activePlayers.find((p) => p.id === id))
    .filter((p): p is Player => !!p && !byRulesIds.has(p.id));
  return [...byRules, ...manualOnly];
}
