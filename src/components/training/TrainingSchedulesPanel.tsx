"use client";

import { useState, useEffect, useCallback } from "react";
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
  CATEGORY_ORDER,
  getCategoryLabel,
  isCategoryInRange,
  compareCategory,
} from "@/lib/utils";
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
            const newSlots = (config?.slots ?? []).filter(
              (s) =>
                !(
                  s.dayOfWeek === deleteSlot.dayOfWeek &&
                  s.time === deleteSlot.time &&
                  s.categoryFrom === deleteSlot.categoryFrom &&
                  s.categoryTo === deleteSlot.categoryTo
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

  const getPlayersInSlot = (slot: TrainingSlot) => {
    if (slot.tipoCategoria === "arquero") {
      return activePlayers.filter((p) => p.genero === "arquero");
    }
    if (slot.tipoCategoria === "masculino" || slot.tipoCategoria === "femenino") {
      return activePlayers.filter((p) => {
        if (p.genero !== slot.tipoCategoria) return false;
        if (!p.birthDate) return false;
        const cat = getCategoryLabel(
          p.birthDate instanceof Date ? p.birthDate : new Date(p.birthDate)
        );
        return isCategoryInRange(cat, slot.categoryFrom, slot.categoryTo);
      });
    }
    // Retrocompatibilidad: slot sin tipoCategoria incluye todos los géneros
    return activePlayers.filter((p) => {
      if (!p.birthDate) return false;
      const cat = getCategoryLabel(
        p.birthDate instanceof Date ? p.birthDate : new Date(p.birthDate)
      );
      return isCategoryInRange(cat, slot.categoryFrom, slot.categoryTo);
    });
  };

  const slotsByDay = slots.reduce<Record<number, TrainingSlot[]>>((acc, s) => {
    if (!acc[s.dayOfWeek]) acc[s.dayOfWeek] = [];
    acc[s.dayOfWeek].push(s);
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
                          {slot.tipoCategoria === "arquero"
                            ? "Arquero"
                            : `${slot.categoryFrom} a ${slot.categoryTo}`}
                          {slot.tipoCategoria === "masculino" && " (M)"}
                          {slot.tipoCategoria === "femenino" && " (F)"}
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
                        {getCoachName(slot.coachId)}
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
  const coachList = coaches?.filter((u) => u.role === "coach" || u.role === "school_admin") ?? [];

  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [time, setTime] = useState("17:00");
  const [tipoCategoria, setTipoCategoria] = useState<"masculino" | "femenino" | "arquero" | "">("");
  const [categoryFrom, setCategoryFrom] = useState("SUB-5");
  const [categoryTo, setCategoryTo] = useState("SUB-10");
  const [maxQuota, setMaxQuota] = useState("25");
  const [coachId, setCoachId] = useState("");

  useEffect(() => {
    if (editingSlot) {
      setDayOfWeek(editingSlot.dayOfWeek);
      setTime(editingSlot.time ?? "17:00");
      setTipoCategoria(editingSlot.tipoCategoria ?? "");
      setCategoryFrom(editingSlot.categoryFrom);
      setCategoryTo(editingSlot.categoryTo);
      setMaxQuota(String(editingSlot.maxQuota));
      setCoachId(editingSlot.coachId);
    } else {
      setDayOfWeek(1);
      setTime("17:00");
      setTipoCategoria("");
      setCategoryFrom("SUB-5");
      setCategoryTo("SUB-10");
      setMaxQuota("25");
      setCoachId(coachList[0]?.id ?? "");
    }
  }, [editingSlot, coachList]);

  const categoryFromIdx = CATEGORY_ORDER.indexOf(categoryFrom as (typeof CATEGORY_ORDER)[number]);
  const categoryToIdx = CATEGORY_ORDER.indexOf(categoryTo as (typeof CATEGORY_ORDER)[number]);
  const validCategoryTo = categoryFromIdx >= 0 ? CATEGORY_ORDER.slice(categoryFromIdx) : CATEGORY_ORDER;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const quota = parseInt(maxQuota, 10);
    if (isNaN(quota) || quota < 1) return;
    if (!coachId) return;
    const isArquero = tipoCategoria === "arquero";
    if (!isArquero && compareCategory(categoryFrom, categoryTo) > 0) return;

    const newSlot: TrainingSlot = {
      dayOfWeek,
      time: time || undefined,
      categoryFrom: isArquero ? "ARQUERO" : categoryFrom,
      categoryTo: isArquero ? "ARQUERO" : categoryTo,
      tipoCategoria: tipoCategoria || undefined,
      maxQuota: quota,
      coachId,
    };

    const matchSlot = (s: TrainingSlot) =>
      s.dayOfWeek === editingSlot!.dayOfWeek &&
      s.time === editingSlot!.time &&
      s.categoryFrom === editingSlot!.categoryFrom &&
      s.categoryTo === editingSlot!.categoryTo;

    let slots: TrainingSlot[];
    if (editingSlot) {
      slots = currentSlots.map((s) => (matchSlot(s) ? newSlot : s));
    } else {
      slots = [...currentSlots, newSlot];
    }

    await onSave(slots);
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Día</Label>
          <Select value={String(dayOfWeek)} onValueChange={(v) => setDayOfWeek(parseInt(v, 10))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_NAMES.map((name, i) => (
                <SelectItem key={i} value={String(i)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>

      <div className="space-y-2">
        <Label>Tipo de categoría</Label>
        <Select
          value={tipoCategoria || "all"}
          onValueChange={(v) => setTipoCategoria(v === "all" ? "" : (v as "masculino" | "femenino" | "arquero"))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos (sin filtro)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos (sin filtro)</SelectItem>
            <SelectItem value="masculino">Masculino</SelectItem>
            <SelectItem value="femenino">Femenino</SelectItem>
            <SelectItem value="arquero">Arquero</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Arquero: entrenamiento una vez por semana, sin distinción de género.
        </p>
      </div>

      {tipoCategoria !== "arquero" && (
        <div className="space-y-2">
          <Label>Rango de categorías</Label>
          <p className="text-xs text-muted-foreground">
            De una categoría a otra: todos los jugadores en ese rango practican en este horario.
          </p>
          <div className="flex gap-2 items-center">
            <Select value={categoryFrom} onValueChange={setCategoryFrom}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">a</span>
            <Select value={categoryTo} onValueChange={setCategoryTo}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {validCategoryTo.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Cupo máximo</Label>
        <Input
          type="number"
          min={1}
          max={500}
          value={maxQuota}
          onChange={(e) => setMaxQuota(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Entrenador asignado</Label>
        <Select value={coachId} onValueChange={setCoachId}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar entrenador" />
          </SelectTrigger>
          <SelectContent>
            {coachList.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.displayName} ({c.role === "school_admin" ? "Admin" : "Entrenador"})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            {DAY_NAMES[slot.dayOfWeek]} {slot.time && `a las ${slot.time}`} -{" "}
            {slot.tipoCategoria === "arquero"
              ? "Arquero"
              : `${slot.categoryFrom} a ${slot.categoryTo}`}
            . Esta acción no se puede deshacer.
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
