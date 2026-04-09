"use client";

import { useCollection } from "@/firebase";
import type { PlayerVideo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Video, Trash2, Film, Filter, ArrowUpDown, ArrowDown, ArrowUp, Upload } from "lucide-react";
import { getVideoSkillLabel, VIDEO_SKILL_GROUPS } from "@/lib/video-skills";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecordOrUploadVideoDialog } from "./RecordOrUploadVideoDialog";
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
import { deleteDoc, doc } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";

interface PlayerVideotecaProps {
  schoolId: string;
  playerId: string;
  playerName: string;
  /** Si viene desde la página del jugador, no mostrar selector de jugador en el diálogo */
  embedded?: boolean;
  /** Jugador viendo su perfil: no mostrar Grabar/Subir video ni eliminar. */
  isViewingAsPlayer?: boolean;
}

export function PlayerVideoteca({
  schoolId,
  playerId,
  playerName,
  embedded = true,
  isViewingAsPlayer = false,
}: PlayerVideotecaProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [videoDialogMode, setVideoDialogMode] = useState<"upload" | "record">("upload");
  const [videoToDelete, setVideoToDelete] = useState<PlayerVideo | null>(null);
  const [filterSkill, setFilterSkill] = useState<string | "all">("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const firestore = useFirestore();
  const { toast } = useToast();

  const { data: videos, loading, error } = useCollection<PlayerVideo>(
    schoolId ? `schools/${schoolId}/playerVideos` : "",
    {
      where: ["playerId", "==", playerId],
      orderBy: ["createdAt", "desc"],
      limit: 50,
    }
  );

  const filteredAndSortedVideos = useMemo(() => {
    if (!videos) return [];
    let list = [...videos];
    if (filterSkill !== "all") {
      list = list.filter((v) => v.skills?.includes(filterSkill));
    }
    list.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt as unknown as number | Date).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt as unknown as number | Date).getTime() : 0;
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });
    return list;
  }, [videos, filterSkill, sortOrder]);

  const videosByMonth = useMemo(() => {
    const groups = new Map<string, PlayerVideo[]>();
    for (const v of filteredAndSortedVideos) {
      let key: string;
      if (v.createdAt) {
        const d = new Date(v.createdAt as unknown as number | Date);
        key = format(startOfMonth(d), "yyyy-MM");
      } else {
        key = "_sin_fecha";
      }
      const bucket = groups.get(key) ?? [];
      bucket.push(v);
      groups.set(key, bucket);
    }
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === "_sin_fecha") return 1;
      if (b === "_sin_fecha") return -1;
      return b.localeCompare(a);
    });
  }, [filteredAndSortedVideos]);

  const monthSectionTitle = (key: string) => {
    if (key === "_sin_fecha") return "Sin fecha";
    const [y, m] = key.split("-").map(Number);
    return format(new Date(y, m - 1, 1), "MMMM yyyy", { locale: es });
  };

  const handleDelete = async () => {
    if (!videoToDelete || !schoolId) return;
    try {
      await deleteDoc(
        doc(firestore, `schools/${schoolId}/playerVideos/${videoToDelete.id}`)
      );
      toast({ title: "Video eliminado", description: "Se eliminó de la videoteca." });
      setVideoToDelete(null);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el video.",
      });
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-video rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Error al cargar la videoteca. Revisa permisos o índices de Firestore.
        </CardContent>
      </Card>
    );
  }

  const empty = !videos || videos.length === 0;
  const hasActiveFilter = filterSkill !== "all";

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-semibold font-headline">Videoteca</h3>
          {!isViewingAsPlayer && (
            <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
              <Button
                onClick={() => {
                  setVideoDialogMode("upload");
                  setDialogOpen(true);
                }}
              >
                <Upload className="mr-2 h-4 w-4" />
                Subir video
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setVideoDialogMode("record");
                  setDialogOpen(true);
                }}
              >
                <Video className="mr-2 h-4 w-4" />
                Grabar con cámara
              </Button>
            </div>
          )}
        </div>

        {!empty && (
          <Card className="p-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-muted-foreground shrink-0">Filtrar por fundamento:</span>
                <Select value={filterSkill} onValueChange={(v) => setFilterSkill(v)}>
                  <SelectTrigger className="w-[200px] h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {VIDEO_SKILL_GROUPS.map(({ heading, skills }) => (
                      <SelectGroup key={heading}>
                        <SelectLabel className="text-muted-foreground">{heading}</SelectLabel>
                        {skills.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setFilterSkill("all")}
                  >
                    Limpiar filtro
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-muted-foreground shrink-0">Ordenar:</span>
                <Select
                  value={sortOrder}
                  onValueChange={(v: "desc" | "asc") => setSortOrder(v)}
                >
                  <SelectTrigger className="w-[220px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">
                      <span className="flex items-center gap-2">
                        <ArrowDown className="h-3.5 w-3.5" />
                        Más recientes primero
                      </span>
                    </SelectItem>
                    <SelectItem value="asc">
                      <span className="flex items-center gap-2">
                        <ArrowUp className="h-3.5 w-3.5" />
                        Más antiguos primero
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredAndSortedVideos.length === 0
                  ? "Ningún video coincide con el filtro."
                  : hasActiveFilter
                    ? `${filteredAndSortedVideos.length} video${filteredAndSortedVideos.length !== 1 ? "s" : ""} (${getVideoSkillLabel(filterSkill)})`
                    : `${filteredAndSortedVideos.length} video${filteredAndSortedVideos.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </Card>
        )}

        {empty ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Film className="h-14 w-14 text-muted-foreground mb-4 opacity-60" />
              <p className="text-muted-foreground text-center max-w-sm mb-4">
                {isViewingAsPlayer
                  ? "Aún no hay videos en tu videoteca. Tu entrenador puede agregar videos para documentar tus habilidades."
                  : `Aún no hay videos de ${playerName}. Graba o sube un video para documentar habilidades y entrenamientos.`}
              </p>
              {!isViewingAsPlayer && (
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-center">
                  <Button
                    onClick={() => {
                      setVideoDialogMode("upload");
                      setDialogOpen(true);
                    }}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Subir primer video
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setVideoDialogMode("record");
                      setDialogOpen(true);
                    }}
                  >
                    <Video className="mr-2 h-4 w-4" />
                    Grabar con cámara
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {videosByMonth.map(([monthKey, monthVideos]) => (
              <section key={monthKey} className="space-y-3">
                <h4 className="text-sm font-semibold font-headline border-b border-border pb-2 capitalize">
                  {monthSectionTitle(monthKey)}
                </h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {monthVideos.map((video) => (
                    <Card key={video.id} className="overflow-hidden">
                      <div className="aspect-video bg-black relative group">
                        <video
                          src={video.url}
                          controls
                          className="w-full h-full object-contain"
                          preload="metadata"
                          playsInline
                        />
                        {!isViewingAsPlayer && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity h-8 w-8"
                            onClick={() => setVideoToDelete(video)}
                            aria-label="Eliminar video"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <CardHeader className="py-3 space-y-2">
                        <p className="font-medium truncate" title={video.title || undefined}>
                          {video.title || "Sin título"}
                        </p>
                        {video.description?.trim() && (
                          <p className="text-xs text-muted-foreground line-clamp-2" title={video.description}>
                            {video.description}
                          </p>
                        )}
                        {video.skills && video.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {video.skills.map((skillId) => (
                              <Badge key={skillId} variant="secondary" className="text-[10px] font-normal">
                                {getVideoSkillLabel(skillId)}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {video.createdAt
                            ? format(new Date(video.createdAt as unknown as number | Date), "EEEE d MMM yyyy", {
                                locale: es,
                              })
                            : ""}
                        </p>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <RecordOrUploadVideoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        schoolId={schoolId}
        initialPlayerId={playerId}
        initialPlayerName={playerName}
        embedded={embedded}
        defaultModeOnOpen={videoDialogMode}
        onSuccess={() => setDialogOpen(false)}
      />

      <AlertDialog open={!!videoToDelete} onOpenChange={() => setVideoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este video?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará de la videoteca del jugador. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
