"use client";

import { useCollection } from "@/firebase";
import type { Player, PlayerVideo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  Filter,
  Film,
  Trash2,
} from "lucide-react";
import { getVideoSkillLabel, VIDEO_SKILL_GROUPS } from "@/lib/video-skills";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import Link from "next/link";

const SCHOOL_VIDEO_LIMIT = 120;

interface SchoolVideotecaGalleryProps {
  schoolId: string;
}

export function SchoolVideotecaGallery({ schoolId }: SchoolVideotecaGalleryProps) {
  const [filterPlayer, setFilterPlayer] = useState<string | "all">("all");
  const [filterSkill, setFilterSkill] = useState<string | "all">("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [videoToDelete, setVideoToDelete] = useState<PlayerVideo | null>(null);
  const firestore = useFirestore();
  const { toast } = useToast();

  const { data: videos, loading, error } = useCollection<PlayerVideo>(
    schoolId ? `schools/${schoolId}/playerVideos` : "",
    {
      orderBy: ["createdAt", "desc"],
      limit: SCHOOL_VIDEO_LIMIT,
    }
  );

  const { data: players } = useCollection<Player>(
    schoolId ? `schools/${schoolId}/players` : ""
  );

  const playerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of players ?? []) {
      if (p.archived) continue;
      m.set(p.id, `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Jugador");
    }
    return m;
  }, [players]);

  const activePlayerOptions = useMemo(() => {
    return (
      players?.filter((p) => !p.archived).sort((a, b) => {
        const na = `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
        const nb = `${b.firstName ?? ""} ${b.lastName ?? ""}`.trim();
        return na.localeCompare(nb, "es");
      }) ?? []
    );
  }, [players]);

  const filteredAndSortedVideos = useMemo(() => {
    if (!videos) return [];
    let list = [...videos];
    if (filterPlayer !== "all") {
      list = list.filter((v) => v.playerId === filterPlayer);
    }
    if (filterSkill !== "all") {
      list = list.filter((v) => v.skills?.includes(filterSkill));
    }
    list.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt as unknown as number | Date).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt as unknown as number | Date).getTime() : 0;
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });
    return list;
  }, [videos, filterPlayer, filterSkill, sortOrder]);

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
      await deleteDoc(doc(firestore, `schools/${schoolId}/playerVideos/${videoToDelete.id}`));
      toast({ title: "Video eliminado", description: "Se eliminó de la videoteca." });
      setVideoToDelete(null);
    } catch {
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
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="aspect-video rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No se pudo cargar la videoteca. Si el error persiste, puede faltar un índice en Firestore para ordenar
          por fecha (revisá la consola de Firebase).
        </CardContent>
      </Card>
    );
  }

  const empty = !videos || videos.length === 0;
  const hasListFilters = filterPlayer !== "all" || filterSkill !== "all";

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold font-headline">Videos de la escuela</h2>
          <p className="text-sm text-muted-foreground">
            Listado de hasta {SCHOOL_VIDEO_LIMIT} videos más recientes. Desde cada tarjeta podés ir al perfil del
            jugador.
          </p>
        </div>

        {!empty && (
          <Card className="p-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-muted-foreground shrink-0">Jugador:</span>
                <Select value={filterPlayer} onValueChange={(v) => setFilterPlayer(v)}>
                  <SelectTrigger className="w-[min(100%,220px)] h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {activePlayerOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm font-medium text-muted-foreground shrink-0">Fundamento:</span>
                <Select value={filterSkill} onValueChange={(v) => setFilterSkill(v)}>
                  <SelectTrigger className="w-[min(100%,200px)] h-9">
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
                {hasListFilters && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                    setFilterPlayer("all");
                    setFilterSkill("all");
                  }}>
                    Limpiar filtros
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-muted-foreground shrink-0">Ordenar:</span>
                <Select value={sortOrder} onValueChange={(v: "desc" | "asc") => setSortOrder(v)}>
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
                  ? "Ningún video coincide con los filtros."
                  : `${filteredAndSortedVideos.length} video${filteredAndSortedVideos.length !== 1 ? "s" : ""} mostrado${filteredAndSortedVideos.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </Card>
        )}

        {empty ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-14">
              <Film className="h-12 w-12 text-muted-foreground mb-3 opacity-60" />
              <p className="text-muted-foreground text-center max-w-md text-sm">
                Todavía no hay videos en esta escuela. Usá &quot;Subir video&quot; o &quot;Grabar con cámara&quot;
                arriba para agregar el primero.
              </p>
            </CardContent>
          </Card>
        ) : filteredAndSortedVideos.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Ningún video coincide con los filtros. Probá limpiar o elegir otro jugador o fundamento.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {videosByMonth.map(([monthKey, monthVideos]) => (
              <section key={monthKey} className="space-y-3">
                <h3 className="text-sm font-semibold font-headline border-b border-border pb-2 capitalize">
                  {monthSectionTitle(monthKey)}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {monthVideos.map((video) => {
                    const pname = playerNameById.get(video.playerId) ?? "Jugador";
                    return (
                      <Card key={video.id} className="overflow-hidden">
                        <div className="aspect-video bg-black relative group">
                          <video
                            src={video.url}
                            controls
                            className="w-full h-full object-contain"
                            preload="metadata"
                            playsInline
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity h-8 w-8"
                            onClick={() => setVideoToDelete(video)}
                            aria-label="Eliminar video"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <CardHeader className="py-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium truncate flex-1" title={video.title || undefined}>
                              {video.title || "Sin título"}
                            </p>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                              <Link
                                href={`/dashboard/players/${video.playerId}?tab=videoteca`}
                                aria-label={`Ver perfil de ${pname}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                          <Link
                            href={`/dashboard/players/${video.playerId}?tab=videoteca`}
                            className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 w-fit"
                          >
                            {pname}
                          </Link>
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
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

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
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
