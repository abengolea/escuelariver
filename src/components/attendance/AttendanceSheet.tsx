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
import type { Player } from "@/lib/types";
import type { Attendance } from "@/lib/types";
import { getCategoryAge } from "@/lib/utils";
import {
  getTrainingByDate,
  getAttendanceForTraining,
  saveAttendance,
} from "@/lib/attendance";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2, UserX } from "lucide-react";
import { cn } from "@/lib/utils";

function groupPlayersByAge(players: Player[]): Record<number, Player[]> {
  const byAge: Record<number, Player[]> = {};
  for (const p of players) {
    const age = p.birthDate ? getCategoryAge(p.birthDate) : 0;
    if (!byAge[age]) byAge[age] = [];
    byAge[age].push(p);
  }
  for (const arr of Object.values(byAge)) {
    arr.sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
    );
  }
  return byAge;
}

type Props = {
  schoolId: string;
};

export function AttendanceSheet({ schoolId }: Props) {
  const firestore = useFirestore();
  const { user, isReady, isPlayer } = useUserProfile();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, Attendance["status"]>
  >({});
  const [trainingId, setTrainingId] = useState<string | null>(null);
  const [loadingTraining, setLoadingTraining] = useState(false);
  const [saving, setSaving] = useState(false);

  // Solo staff (admin/coach) puede listar jugadores; un jugador no tiene permiso.
  const canListPlayers = isReady && schoolId && !isPlayer;
  const { data: players, loading: playersLoading } = useCollection<Player>(
    canListPlayers ? `schools/${schoolId}/players` : "",
    { orderBy: ["lastName", "asc"] }
  );

  const activePlayers = players?.filter((p) => p.status === "active") ?? [];

  const loadTrainingAndAttendance = useCallback(async () => {
    if (!schoolId) return;
    setLoadingTraining(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const training = await getTrainingByDate(firestore, schoolId, dateStr);
      if (training) {
        setTrainingId(training.id);
        const att = await getAttendanceForTraining(
          firestore,
          schoolId,
          training.id
        );
        setAttendanceMap(att);
      } else {
        setTrainingId(null);
        setAttendanceMap({});
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo cargar la asistencia.",
        variant: "destructive",
      });
      setTrainingId(null);
      setAttendanceMap({});
    } finally {
      setLoadingTraining(false);
    }
  }, [firestore, schoolId, selectedDate, toast]);

  useEffect(() => {
    loadTrainingAndAttendance();
  }, [loadTrainingAndAttendance]);

  const toggleStatus = (playerId: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [playerId]:
        prev[playerId] === "ausente" ? "presente" : "ausente",
    }));
  };

  const getStatus = (playerId: string): Attendance["status"] =>
    attendanceMap[playerId] ?? "presente";

  const handleSave = async () => {
    if (!user || !schoolId) return;
    setSaving(true);
    try {
      const fullMap: Record<string, Attendance["status"]> = {};
      for (const p of activePlayers) {
        fullMap[p.id] = getStatus(p.id);
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

  const byAge = groupPlayersByAge(activePlayers);
  const ages = Object.keys(byAge)
    .map(Number)
    .sort((a, b) => a - b);

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
        <Button onClick={handleSave} disabled={saving}>
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
      ) : (
        <div className="space-y-6">
          {ages.map((age) => (
            <Card key={age}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Sub-{age}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {byAge[age].map((player) => {
                    const status = getStatus(player.id);
                    const isAbsent = status === "ausente";
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => toggleStatus(player.id)}
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
