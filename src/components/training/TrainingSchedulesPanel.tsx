"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  Clock,
  Users,
  UserPlus,
  Loader2,
  Pencil,
  Trash2,
  Dumbbell,
} from "lucide-react";
import {
  BIRTH_YEAR_LABELS,
  parseBirthYearLabel,
  getCategoryLabelFromBirthYear,
} from "@/lib/utils";
import { getPlayersInSlot as getPlayersInSlotUtil } from "@/lib/training-slot-utils";
import type { TrainingSlot, TrainingConfig } from "@/lib/types";
import type { Player } from "@/lib/types";
import type { SchoolUser } from "@/lib/types";
import { useCollection } from "@/firebase";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface TrainingSchedulesPanelProps {
  schoolId: string;
  getToken: () => Promise<string | null>;
}

export function TrainingSchedulesPanel({
  schoolId,
  getToken,
}: TrainingSchedulesPanelProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<TrainingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TrainingSlot | null>(null);
  const [deleteSlot, setDeleteSlot] = useState<TrainingSlot | null>(null);

  const fetchConfig = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/training-config?schoolId=${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConfig({
          id: data.id ?? "default",
          slots: data.slots ?? [],
          updatedAt: new Date(data.updatedAt ?? 0),
          updatedBy: data.updatedBy ?? "",
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "No se pudo cargar la configuración.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [schoolId, getToken, toast]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async (slots: TrainingSlot[]) => {
    const token = await getToken();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch("/api/training-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ schoolId, slots }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al guardar");
      }
      toast({ title: "Guardado", description: "Los horarios se actualizaron correctamente." });
      setDialogOpen(false);
      setEditingSlot(null);
      fetchConfig();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo guardar.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SlotList
        schoolId={schoolId}
        slots={config?.slots ?? []}
        onEdit={(slot) => {
          setEditingSlot(slot);
          setDialogOpen(true);
        }}
        onDelete={(slot) => setDeleteSlot(slot)}
        onAdd={() => {
          setEditingSlot(null);
          setDialogOpen(true);
        }}
      />

      <SlotFormDialog
        schoolId={schoolId}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingSlot(null);
        }}
        editingSlot={editingSlot}
        currentSlots={config?.slots ?? []}
        onSave={handleSave}
        saving={saving}
      />

      {deleteSlot && (
        <DeleteSlotDialog
          slot={deleteSlot}
          onConfirm={async () => {
            const delDays = [...(deleteSlot.daysOfWeek ?? [deleteSlot.dayOfWeek])].sort().join(",");
            const slotDays = (s: TrainingSlot) =>
              [...(s.daysOfWeek ?? [s.dayOfWeek])].sort().join(",");
            const yearsMatch = (s: TrainingSlot) =>
              s.yearFrom != null && s.yearTo != null && deleteSlot.yearFrom != null && deleteSlot.yearTo != null
                ? s.yearFrom === deleteSlot.yearFrom && s.yearTo === deleteSlot.yearTo
                : s.categoryFrom === deleteSlot.categoryFrom && s.categoryTo === deleteSlot.categoryTo;
            const newSlots = (config?.slots ?? []).filter(
              (s) =>
                !(
                  slotDays(s) === delDays &&
                  s.time === deleteSlot.time &&
                  yearsMatch(s) &&
                  (s.name ?? "") === (deleteSlot.name ?? "")
                )
            );
            await handleSave(newSlots);
            setDeleteSlot(null);
          }}
          onCancel={() => setDeleteSlot(null)}
        />
      )}
    </div>
  );
}

interface SlotListProps {
  schoolId: string;
  slots: TrainingSlot[];
  onEdit: (slot: TrainingSlot) => void;
  onDelete: (slot: TrainingSlot) => void;
  onAdd: () => void;
}

function SlotList({ schoolId, slots, onEdit, onDelete, onAdd }: SlotListProps) {
  const { data: players } = useCollection<Player>(
    schoolId ? `schools/${schoolId}/players` : "",
    {}
  );
  const { data: coaches } = useCollection<SchoolUser>(
    schoolId ? `schools/${schoolId}/users` : "",
    {}
  );

  const activePlayers = players?.filter((p) => !p.archived && p.status === "active") ?? [];
  const coachList = coaches?.filter((u) => u.role === "coach" || u.role === "school_admin") ?? [];

  const getCoachName = (coachId: string) =>
    coachList.find((c) => c.id === coachId)?.displayName ?? coachId;

  const getCoachNames = (slot: TrainingSlot) => {
    const ids = slot.coachIds?.length ? slot.coachIds : [slot.coachId];
    return ids.map((id) => getCoachName(id)).filter(Boolean);
  };

  const getPlayersInSlot = (slot: TrainingSlot) =>
    getPlayersInSlotUtil(slot, activePlayers);

  const slotsByDay = slots.reduce<Record<number, TrainingSlot[]>>((acc, s) => {
    const days = s.daysOfWeek?.length ? s.daysOfWeek : [s.dayOfWeek];
    for (const d of days) {
      if (!acc[d]) acc[d] = [];
      acc[d].push(s);
    }
    return acc;
  }, {});

  const daysWithSlots = Object.keys(slotsByDay)
    .map(Number)
    .sort((a, b) => a - b);

  if (slots.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Dumbbell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            No hay horarios de entrenamiento configurados. Agregá el primero para definir categorías,
            cupos y entrenador asignado.
          </p>
          <Button onClick={onAdd}>Agregar horario</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAdd}>
          <UserPlus className="h-4 w-4 mr-2" />
          Agregar horario
        </Button>
      </div>
      {daysWithSlots.map((day) => (
        <Card key={day}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {DAY_NAMES[day]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {slotsByDay[day]
              .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
              .map((slot, idx) => {
                const playersInSlot = getPlayersInSlot(slot);
                const overQuota = playersInSlot.length > slot.maxQuota;
                return (
                  <div
                    key={idx}
                    className="flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {slot.time && (
                          <span className="flex items-center gap-1 text-sm">
                            <Clock className="h-4 w-4" />
                            {slot.time}
                          </span>
                        )}
                        <span className="font-medium">
                          {slot.name ||
                            (slot.yearFrom != null && slot.yearTo != null
                              ? `Año ${String(slot.yearFrom).slice(-2)} a ${String(slot.yearTo).slice(-2)}`
                              : `${slot.categoryFrom} a ${slot.categoryTo}`)}
                          {slot.tipoCategoria === "masculino" && " (M)"}
                          {slot.tipoCategoria === "femenino" && " (F)"}
                          {slot.tipoCategoria === "arqueros" && " (Arqueros)"}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          Cupo: {slot.maxQuota}
                        </span>
                        {overQuota && (
                          <span className="text-destructive text-sm font-medium">
                            (superado: {playersInSlot.length})
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <UserPlus className="h-4 w-4" />
                        {getCoachNames(slot).join(", ")}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {playersInSlot.length} jugador{playersInSlot.length !== 1 ? "es" : ""}{" "}
                          en rango
                        </span>
                      </div>
                      {playersInSlot.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {playersInSlot
                            .slice(0, 5)
                            .map((p) => `${p.firstName} ${p.lastName}`)
                            .join(", ")}
                          {playersInSlot.length > 5 && ` +${playersInSlot.length - 5} más`}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => onEdit(slot)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(slot)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface SlotFormDialogProps {
  schoolId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSlot: TrainingSlot | null;
  currentSlots: TrainingSlot[];
  onSave: (slots: TrainingSlot[]) => Promise<void>;
  saving: boolean;
}

function SlotFormDialog({
  schoolId,
  open,
  onOpenChange,
  editingSlot,
  currentSlots,
  onSave,
  saving,
}: SlotFormDialogProps) {
  const { data: coaches } = useCollection<SchoolUser>(
    schoolId ? `schools/${schoolId}/users` : "",
    {}
  );
  const coachList = useMemo(
    () => coaches?.filter((u) => u.role === "coach" || u.role === "school_admin") ?? [],
    [coaches]
  );

  const [name, setName] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1]);
  const [time, setTime] = useState("17:00");
  const [tipoCategoria, setTipoCategoria] = useState<"masculino" | "femenino" | "arqueros" | "">("");
  const [yearFromLabel, setYearFromLabel] = useState("15");
  const [yearToLabel, setYearToLabel] = useState("10");
  const [maxQuota, setMaxQuota] = useState("25");
  const [coachIds, setCoachIds] = useState<string[]>([]);

  const firstCoachId = coachList[0]?.id ?? "";

  useEffect(() => {
    if (!open) return;
    if (editingSlot) {
      setName(editingSlot.name ?? "");
      setDaysOfWeek(
        editingSlot.daysOfWeek?.length
          ? [...editingSlot.daysOfWeek]
          : [editingSlot.dayOfWeek]
      );
      setTime(editingSlot.time ?? "17:00");
      setTipoCategoria((editingSlot.tipoCategoria as "masculino" | "femenino" | "arqueros") ?? "");
      if (editingSlot.yearFrom != null && editingSlot.yearTo != null) {
        setYearFromLabel(String(editingSlot.yearFrom).slice(-2));
        setYearToLabel(String(editingSlot.yearTo).slice(-2));
      } else {
        const curYear = new Date().getFullYear();
        const ageFrom = parseInt(editingSlot.categoryFrom.replace("SUB-", ""), 10) || 5;
        const ageTo = parseInt(editingSlot.categoryTo.replace("SUB-", ""), 10) || 18;
        setYearFromLabel(String(curYear - ageFrom).slice(-2));
        setYearToLabel(String(curYear - ageTo).slice(-2));
      }
      setMaxQuota(String(editingSlot.maxQuota));
      setCoachIds(
        editingSlot.coachIds?.length
          ? [...editingSlot.coachIds]
          : [editingSlot.coachId].filter(Boolean)
      );
    } else {
      setName("");
      setDaysOfWeek([1]);
      setTime("17:00");
      setTipoCategoria("");
      setYearFromLabel("15");
      setYearToLabel("10");
      setMaxQuota("25");
      setCoachIds(firstCoachId ? [firstCoachId] : []);
    }
  }, [open, editingSlot, firstCoachId]);

  const toggleCoach = (id: string) => {
    setCoachIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const yearFromIdx = BIRTH_YEAR_LABELS.indexOf(yearFromLabel);
  const validYearToLabels =
    yearFromIdx >= 0 ? BIRTH_YEAR_LABELS.slice(yearFromIdx) : BIRTH_YEAR_LABELS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const quota = parseInt(maxQuota, 10);
    if (isNaN(quota) || quota < 1) return;
    if (coachIds.length === 0) return;
    if (daysOfWeek.length === 0) return;

    const yFrom = parseBirthYearLabel(yearFromLabel);
    const yTo = parseBirthYearLabel(yearToLabel);
    const yearMin = Math.min(yFrom, yTo);
    const yearMax = Math.max(yFrom, yTo);

    const newSlot: TrainingSlot = {
      name: name.trim() || undefined,
      dayOfWeek: daysOfWeek[0],
      daysOfWeek: daysOfWeek.length > 1 ? daysOfWeek : undefined,
      time: time || undefined,
      yearFrom: yearMin,
      yearTo: yearMax,
      categoryFrom: getCategoryLabelFromBirthYear(yearMin),
      categoryTo: getCategoryLabelFromBirthYear(yearMax),
      tipoCategoria: tipoCategoria || undefined,
      maxQuota: quota,
      coachId: coachIds[0],
      coachIds: coachIds.length > 0 ? coachIds : undefined,
      manualPlayerIds: editingSlot?.manualPlayerIds,
    };

    let slots: TrainingSlot[];
    if (!editingSlot) {
      slots = [...currentSlots, newSlot];
    } else {
      const slotDays = (s: TrainingSlot) =>
        s.daysOfWeek?.length ? [...s.daysOfWeek].sort().join(",") : String(s.dayOfWeek);
      const editDays = [...(editingSlot.daysOfWeek ?? [editingSlot.dayOfWeek])].sort().join(",");
      const slotMatch = (s: TrainingSlot) => {
        const daysMatch = slotDays(s) === editDays;
        const timeMatch = s.time === editingSlot.time;
        const yearsMatch =
          (s.yearFrom != null && s.yearTo != null && editingSlot.yearFrom != null && editingSlot.yearTo != null
            ? s.yearFrom === editingSlot.yearFrom && s.yearTo === editingSlot.yearTo
            : s.categoryFrom === editingSlot.categoryFrom && s.categoryTo === editingSlot.categoryTo);
        const nameMatch = (s.name ?? "") === (editingSlot.name ?? "");
        return daysMatch && timeMatch && yearsMatch && nameMatch;
      };
      slots = currentSlots.map((s) => (slotMatch(s) ? newSlot : s));
    }

    await onSave(slots);
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nombre del grupo</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Ej: "Lunes 16:00", "Arqueros", "Femenino"'
        />
        <p className="text-xs text-muted-foreground">
          Nombre que define la escuela para identificar este turno.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Días de la semana</Label>
        <p className="text-xs text-muted-foreground">
          Marcá los días en que se realiza este entrenamiento.
        </p>
        <div className="flex flex-wrap gap-4 pt-2">
          {DAY_NAMES.map((dayName, i) => (
            <label
              key={i}
              className="flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <Checkbox
                checked={daysOfWeek.includes(i)}
                onCheckedChange={() => toggleDay(i)}
              />
              <span className="text-sm font-medium">{dayName}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Hora (opcional)</Label>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="17:00"
          />
      </div>

      <div className="space-y-2">
        <Label>Tipo de categoría</Label>
        <Select
          value={tipoCategoria || "all"}
          onValueChange={(v) =>
            setTipoCategoria(v === "all" ? "" : (v as "masculino" | "femenino" | "arqueros"))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos (sin filtro)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos (sin filtro)</SelectItem>
            <SelectItem value="masculino">Masculino</SelectItem>
            <SelectItem value="femenino">Femenino</SelectItem>
            <SelectItem value="arqueros">Arqueros</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Masculino, femenino, arqueros (solo pos. arquero) o sin filtro.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Rango de años de nacimiento</Label>
        <p className="text-xs text-muted-foreground">
          Desde un año hasta otro: todos los jugadores nacidos en ese rango practican en este horario.
        </p>
        <div className="flex gap-2 items-center">
          <Select value={yearFromLabel} onValueChange={setYearFromLabel}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BIRTH_YEAR_LABELS.map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">a</span>
          <Select value={yearToLabel} onValueChange={setYearToLabel}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {validYearToLabels.map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Cupo máximo</Label>
        <Input
          type="number"
          min={1}
          max={500}
          value={maxQuota}
          onChange={(e) => setMaxQuota(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Cantidad máxima de jugadores en este turno.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Entrenadores asignados</Label>
        <p className="text-xs text-muted-foreground">
          Marcá uno o más entrenadores para este turno.
        </p>
        <div className="flex flex-col gap-2 pt-2 max-h-48 overflow-y-auto rounded-md border p-2">
          {coachList.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2 cursor-pointer rounded-md px-3 py-2 hover:bg-muted/50 has-[:checked]:bg-primary/5 has-[:checked]:border-primary has-[:checked]:border"
            >
              <Checkbox
                checked={coachIds.includes(c.id)}
                onCheckedChange={() => toggleCoach(c.id)}
              />
              <span className="text-sm">
                {c.displayName} ({c.role === "school_admin" ? "Admin" : "Entrenador"})
              </span>
            </label>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando…
            </>
          ) : editingSlot ? (
            "Guardar cambios"
          ) : (
            "Agregar horario"
          )}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingSlot ? "Editar horario" : "Agregar horario de entrenamiento"}</DialogTitle>
          <DialogDescription>
            Definí el día, rango de categorías, cupo y entrenador para este bloque.
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

function DeleteSlotDialog({
  slot,
  onConfirm,
  onCancel,
}: {
  slot: TrainingSlot;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={!!slot} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este horario?</AlertDialogTitle>
          <AlertDialogDescription>
            {slot.name || `${slot.categoryFrom} a ${slot.categoryTo}`} —{" "}
            {(slot.daysOfWeek ?? [slot.dayOfWeek])
              .map((d) => DAY_NAMES[d])
              .join(", ")}
            {slot.time && ` ${slot.time}`}. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
