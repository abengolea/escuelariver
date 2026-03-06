"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useFirestore, useUserProfile } from "@/firebase";
import { useCollection } from "@/firebase";
import type { Player, TrainingSlot } from "@/lib/types";
import type { Attendance } from "@/lib/types";
import { getBirthYearLabel } from "@/lib/utils";
import { getPlayersInSlot, getSlotKey } from "@/lib/training-slot-utils";
import {
  getTrainingsForDate,
  getAttendanceForTraining,
  saveAttendanceForSlot,
  getTrainingByDate,
  saveAttendance,
} from "@/lib/attendance";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Clock, Loader2, UserX } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function groupPlayersByBirthYear(players: Player[]): Record<number, Player[]> {
  const byYear: Record<number, Player[]> = {};
  for (const p of players) {
    const year = p.birthDate
      ? (p.birthDate instanceof Date ? p.birthDate : new Date(p.birthDate)).getFullYear()
      : 0;
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(p);
  }
  for (const arr of Object.values(byYear)) {
    arr.sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
    );
  }
  return byYear;
}

type Props = {
  schoolId: string;
  getToken: () => Promise<string | null>;
};

export function AttendanceSheet({ schoolId, getToken }: Props) {
  const firestore = useFirestore();
  const { user, isReady, isPlayer } = useUserProfile();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [attendanceBySlot, setAttendanceBySlot] = useState<
    Record<string, Record<string, Attendance["status"]>>
  >({});
  const [slotsForDay, setSlotsForDay] = useState<
    Array<{ training: { id: string }; slot: TrainingSlot }>
  >([]);
  const [loadingTraining, setLoadingTraining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trainingConfig, setTrainingConfig] = useState<{ slots: TrainingSlot[] } | null>(null);

  const canListPlayers = isReady && schoolId && !isPlayer;
  const { data: players, loading: playersLoading } = useCollection<Player>(
    canListPlayers ? `schools/${schoolId}/players` : "",
    { orderBy: ["lastName", "asc"] }
  );

  const activePlayers = players?.filter((p) => !p.archived && p.status === "active") ?? [];

  const fetchTrainingConfig = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/training-config?schoolId=${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTrainingConfig({ slots: data.slots ?? [] });
      } else {
        setTrainingConfig({ slots: [] });
      }
    } catch {
      setTrainingConfig({ slots: [] });
    }
  }, [schoolId, getToken]);

  useEffect(() => {
    fetchTrainingConfig();
  }, [fetchTrainingConfig]);

  const loadTrainingAndAttendance = useCallback(async () => {
    if (!schoolId || !user) return;
    setLoadingTraining(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const dayOfWeek = selectedDate.getDay();
      const slots =
        trainingConfig?.slots?.filter((s) =>
          s.daysOfWeek?.length ? s.daysOfWeek.includes(dayOfWeek) : s.dayOfWeek === dayOfWeek
        ) ?? [];

      const hasGroupsConfigured = (trainingConfig?.slots?.length ?? 0) > 0;

      if (slots.length > 0) {
        const trainingsWithSlots = await getTrainingsForDate(
          firestore,
          schoolId,
          dateStr,
          slots,
          user.uid
        );
        setSlotsForDay(trainingsWithSlots);

        const attBySlot: Record<string, Record<string, Attendance["status"]>> = {};
        for (const { training, slot } of trainingsWithSlots) {
          const att = await getAttendanceForTraining(
            firestore,
            schoolId,
            training.id
          );
          const slotKey = getSlotKey(slot);
          attBySlot[slotKey] = att;
        }
        setAttendanceBySlot(attBySlot);
      } else if (hasGroupsConfigured) {
        setSlotsForDay([]);
        setAttendanceBySlot({});
      } else {
        setSlotsForDay([]);
        const training = await getTrainingByDate(firestore, schoolId, dateStr);
        if (training) {
          const att = await getAttendanceForTraining(
            firestore,
            schoolId,
            training.id
          );
          setAttendanceBySlot({ legacy: att });
        } else {
          setAttendanceBySlot({});
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo cargar la asistencia.",
        variant: "destructive",
      });
      setSlotsForDay([]);
      setAttendanceBySlot({});
    } finally {
      setLoadingTraining(false);
    }
  }, [firestore, schoolId, selectedDate, trainingConfig, user, toast]);

  useEffect(() => {
    if (trainingConfig !== null) {
      loadTrainingAndAttendance();
    }
  }, [loadTrainingAndAttendance, trainingConfig]);

  const toggleStatus = (
    slotKey: string,
    playerId: string
  ) => {
    setAttendanceBySlot((prev) => {
      const slotMap = prev[slotKey] ?? {};
      const current = slotMap[playerId] ?? "presente";
      return {
        ...prev,
        [slotKey]: {
          ...slotMap,
          [playerId]: current === "ausente" ? "presente" : "ausente",
        },
      };
    });
  };

  const getStatus = (
    slotKey: string,
    playerId: string
  ): Attendance["status"] => attendanceBySlot[slotKey]?.[playerId] ?? "presente";

  const handleSave = async () => {
    if (!user || !schoolId) return;
    setSaving(true);
    try {
      if (slotsForDay.length > 0) {
        for (const { training, slot } of slotsForDay) {
          const slotKey = getSlotKey(slot);
          const playersInSlot = getPlayersInSlot(slot, activePlayers);
          const attMap: Record<string, Attendance["status"]> = {};
          for (const p of playersInSlot) {
            attMap[p.id] = getStatus(slotKey, p.id);
          }
          await saveAttendanceForSlot(
            firestore,
            schoolId,
            selectedDate,
            slot,
            attMap,
            user.uid
          );
        }
        toast({
          title: "Guardado",
          description: "La asistencia se registró correctamente.",
        });
      } else if ((trainingConfig?.slots?.length ?? 0) === 0) {
        const legacyKey = "legacy";
        const legacyAtt = attendanceBySlot[legacyKey];
        if (legacyAtt) {
          const fullMap: Record<string, Attendance["status"]> = {};
          for (const p of activePlayers) {
            fullMap[p.id] = legacyAtt[p.id] ?? "presente";
          }
          await saveAttendance(
            firestore,
            schoolId,
            selectedDate,
            fullMap,
            user.uid
          );
          toast({
            title: "Guardado",
            description: "La asistencia se registró correctamente.",
          });
        }
      }
      loadTrainingAndAttendance();
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo guardar la asistencia.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const byYear = groupPlayersByBirthYear(activePlayers);
  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a);

  if (playersLoading) {
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              locale={es}
            />
          </PopoverContent>
        </Popover>
        <Button
          onClick={handleSave}
          disabled={
            saving ||
            ((trainingConfig?.slots?.length ?? 0) > 0 && slotsForDay.length === 0)
          }
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando…
            </>
          ) : (
            "Guardar asistencia"
          )}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Hacé clic en el jugador que faltó para marcarlo como ausente. Un segundo clic lo marca presente.
      </p>

      {loadingTraining ? (
        <Card>
          <CardContent className="p-8">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      ) : activePlayers.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No hay jugadores activos en esta escuela.
          </CardContent>
        </Card>
      ) : ((trainingConfig?.slots?.length ?? 0) > 0 && slotsForDay.length === 0) ? (
        <Card>
          <CardContent className="p-10 text-center">
            <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-medium mb-1">No hay entrenamientos este día</p>
            <p className="text-sm text-muted-foreground">
              {format(selectedDate, "EEEE", { locale: es })} no tiene turnos configurados. Cambiá la
              fecha o agregá horarios para ese día en Entrenamientos.
            </p>
          </CardContent>
        </Card>
      ) : slotsForDay.length > 0 ? (
        <div className="space-y-6">
          {slotsForDay.map(({ training, slot }) => {
            const slotKey = getSlotKey(slot);
            const playersInSlot = getPlayersInSlot(slot, activePlayers)
              .sort((a, b) =>
                `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
              );
            const slotLabel =
              slot.name ||
              (slot.daysOfWeek?.length
                ? `${slot.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ")} ${slot.time ?? ""} - ${slot.categoryFrom} a ${slot.categoryTo}`.trim()
                : `${DAY_NAMES[slot.dayOfWeek]} ${slot.time ?? ""} - ${slot.categoryFrom} a ${slot.categoryTo}`.trim());
            return (
              <Card key={slotKey}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {slot.time && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-5 w-5" />
                        {slot.time}
                      </span>
                    )}
                    {slotLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {playersInSlot.map((player) => {
                      const status = getStatus(slotKey, player.id);
                      const isAbsent = status === "ausente";
                      const yearLabel = player.birthDate
                        ? getBirthYearLabel(
                            player.birthDate instanceof Date
                              ? player.birthDate
                              : new Date(player.birthDate)
                          )
                        : "-";
                      return (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => toggleStatus(slotKey, player.id)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border-2 p-3 transition-colors",
                            isAbsent
                              ? "border-destructive bg-destructive/10"
                              : "border-transparent bg-muted/50 hover:bg-muted"
                          )}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={player.photoUrl} alt="" />
                            <AvatarFallback>
                              {(player.firstName?.[0] || "")}
                              {(player.lastName?.[0] || "")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-left">
                            <span className="font-medium block">
                              {player.firstName} {player.lastName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Cat. {yearLabel}
                            </span>
                          </div>
                          {isAbsent && <UserX className="h-5 w-5 text-destructive" />}
                        </button>
                      );
                    })}
                  </div>
                  {playersInSlot.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4">
                      No hay jugadores asignados a este turno.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {years.map((year) => (
            <Card key={year}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  Cat. año nac. {String(year).slice(-2)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {byYear[year].map((player) => {
                    const status = getStatus("legacy", player.id);
                    const isAbsent = status === "ausente";
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => toggleStatus("legacy", player.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border-2 p-3 transition-colors",
                          isAbsent
                            ? "border-destructive bg-destructive/10"
                            : "border-transparent bg-muted/50 hover:bg-muted"
                        )}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={player.photoUrl} alt="" />
                          <AvatarFallback>
                            {(player.firstName?.[0] || "")}
                            {(player.lastName?.[0] || "")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {player.firstName} {player.lastName}
                        </span>
                        {isAbsent && <UserX className="h-5 w-5 text-destructive" />}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
