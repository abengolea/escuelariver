"use client";

import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cake, User, Contact, Bot, FilePlus, ArrowLeft, UserX, ClipboardCheck, Video } from "lucide-react";
import { calculateAge, isPlayerProfileComplete } from "@/lib/utils";
import { useDoc, useUserProfile, useCollection, useUser, useFirebase } from "@/firebase";
import { getAuth } from "firebase/auth";
import type { Player, Evaluation } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTab } from "@/components/players/PlayerProfile/SummaryTab";
import { MedicalRecordField } from "@/components/players/MedicalRecordField";
import { isMedicalRecordApproved, isMedicalRecordRejected } from "@/lib/utils";
import { AnalyticsTab } from "@/components/players/PlayerProfile/AnalyticsTab";
import { useState } from "react";
import { AddEvaluationSheet } from "@/components/evaluations/AddEvaluationSheet";
import { EvaluationsTab } from "@/components/evaluations/EvaluationsTab";
import { PlayerVideoteca } from "@/components/videos/PlayerVideoteca";
import { AttendanceHistory } from "@/components/attendance/AttendanceHistory";
import { PhysicalAssessmentsTab } from "@/components/physical-assessments/PhysicalAssessmentsTab";
import { Activity } from "lucide-react";
import { EditPlayerDialog } from "@/components/players/EditPlayerDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertCircle, Archive, Lock, FileHeart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlayerPaymentStatusCard } from "@/components/players/PlayerPaymentStatusCard";

export default function PlayerProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { activeSchoolId, isReady: profileReady, profile, isSuperAdmin } = useUserProfile();
  const { user } = useUser();
  const { app } = useFirebase();
  const getToken = async () => {
    const auth = getAuth(app);
    const u = auth.currentUser;
    if (!u) return null;
    return u.getIdToken();
  };
  const { toast } = useToast();
  const router = useRouter();
  const isViewingAsPlayer = profile?.role === "player" && String(profile?.playerId ?? "") === String(id);
  const [isEvalSheetOpen, setEvalSheetOpen] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<Evaluation | null>(null);
  const [isEditPlayerOpen, setEditPlayerOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const schoolIdFromQuery = searchParams.get('schoolId');
  const schoolId = schoolIdFromQuery || activeSchoolId;
  
  const { data: player, loading: playerLoading } = useDoc<Player>(
      profileReady && schoolId ? `schools/${schoolId}/players/${id}` : ''
  );

  const { data: evaluations, loading: evalsLoading, error: evalsError } = useCollection<Evaluation>(
    profileReady && schoolId ? `schools/${schoolId}/evaluations` : '',
    { where: ['playerId', '==', id], orderBy: ['date', 'desc'], limit: 20 }
  );

  const isLoading = playerLoading || !profileReady || evalsLoading;

  if (isLoading) {
    return (
        <div className="flex flex-col gap-8">
            <header className="flex flex-col md:flex-row gap-6">
                <Skeleton className="h-32 w-32 rounded-full" />
                <div className="flex-1 space-y-3">
                    <Skeleton className="h-6 w-24 rounded" />
                    <Skeleton className="h-10 w-1/2 rounded" />
                    <Skeleton className="h-6 w-1/3 rounded" />
                     <div className="mt-4 flex items-center gap-4">
                        <Skeleton className="h-5 w-20 rounded" />
                        <Skeleton className="h-5 w-20 rounded" />
                        <Skeleton className="h-5 w-20 rounded" />
                     </div>
                </div>
            </header>
            <Skeleton className="h-10 w-full max-w-md rounded-md" />
            <Skeleton className="h-64 w-full rounded-lg" />
        </div>
    );
  }

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16">
        <div className="rounded-full bg-muted p-4">
          <UserX className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Jugador no encontrado</h2>
          <p className="text-muted-foreground max-w-sm">
            {schoolId
              ? "No existe un jugador con este ID en la escuela seleccionada, o no tienes permiso para verlo."
              : "Falta el identificador de escuela. Entra desde la lista de jugadores de tu escuela."}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={schoolId ? `/dashboard/players?schoolId=${schoolId}` : "/dashboard/players"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a jugadores
          </Link>
        </Button>
      </div>
    );
  }

  const playerWithSchool = { ...player, escuelaId: schoolId! };
  const profileComplete = isPlayerProfileComplete(player);
  const showLockedContent = isViewingAsPlayer && !profileComplete;
  const canArchive =
    !!schoolId &&
    !player.archived &&
    (profile?.role === "school_admin" || isSuperAdmin);

  const canToggleStatus =
    !!schoolId &&
    !player.archived &&
    !isViewingAsPlayer &&
    (profile?.role === "school_admin" || profile?.role === "coach" || isSuperAdmin);

  const handleToggleStatus = async () => {
    if (!user || !schoolId || statusUpdating) return;
    const newStatus = player.status === "active" ? "inactive" : "active";
    setStatusUpdating(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/players/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ schoolId, playerId: id, status: newStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error al cambiar estado");
      toast({
        title: newStatus === "active" ? "Jugador activado" : "Jugador desactivado",
        description:
          newStatus === "active"
            ? "El jugador ya puede ingresar al panel."
            : "El jugador ya no puede ingresar al panel.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo cambiar el estado",
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleArchive = async () => {
    if (!user || !schoolId) return;
    setArchiving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/players/archive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ schoolId, playerId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error al archivar");
      setArchiveDialogOpen(false);
      toast({
        title: "Jugador archivado",
        description: "El jugador ya no aparecerá en listados ni en totales.",
      });
      router.push(`/dashboard/players?schoolId=${schoolId}`);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo archivar el jugador",
      });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <>
    <AddEvaluationSheet
      playerId={id}
      schoolId={schoolId!}
      isOpen={isEvalSheetOpen}
      onOpenChange={(open) => {
        setEvalSheetOpen(open);
        if (!open) setEditingEvaluation(null);
      }}
      playerName={`${player.firstName ?? ""} ${player.lastName ?? ""}`.trim()}
      evaluationsSummary={evaluations?.map((e) => ({ date: e.date, coachComments: e.coachComments ?? "" })) ?? []}
      editingEvaluation={editingEvaluation}
    />
    <EditPlayerDialog
      player={player}
      schoolId={schoolId!}
      isOpen={isEditPlayerOpen}
      onOpenChange={setEditPlayerOpen}
      isPlayerEditing={isViewingAsPlayer}
    />
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row gap-6">
        <Avatar className="h-32 w-32 border-4 border-card">
          <AvatarImage src={player.photoUrl || undefined} data-ai-hint="person portrait" />
          <AvatarFallback className="text-4xl">
            {(player.firstName?.[0] || '')}{(player.lastName?.[0] || '')}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          {canToggleStatus ? (
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={statusUpdating}
              className={`mb-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 cursor-pointer ${
                player.status === "active"
                  ? "border-green-600/50 bg-green-500/10 text-green-700 hover:bg-green-500/20 dark:text-green-400 dark:hover:bg-green-500/20"
                  : player.status === "suspended"
                    ? "border-amber-600/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/20"
                    : "border-red-600/50 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/20"
              }`}
            >
              {statusUpdating
                ? "…"
                : player.status === "active"
                  ? "Activo"
                  : player.status === "suspended"
                    ? "Mora"
                    : "Desactivado"}
            </button>
          ) : (
            <Badge
              variant={player.status === "active" ? "secondary" : "destructive"}
              className={`mb-2 capitalize ${player.status === "active" ? "border-green-600/50 bg-green-500/10 text-green-700 dark:text-green-400" : ""} ${player.status === "suspended" ? "border-amber-600/50 bg-amber-500/10 text-amber-800 dark:text-amber-400" : ""}`}
            >
              {player.status === "active" ? "Activo" : player.status === "suspended" ? "Mora" : "Desactivado"}
            </Badge>
          )}
          <h1 className="text-4xl font-bold font-headline">{player.firstName || ''} {player.lastName || ''}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
             {player.birthDate && <div className="flex items-center gap-1"><Cake className="h-4 w-4" /> {calculateAge(player.birthDate)} años</div>}
             {player.tutorContact?.name && <div className="flex items-center gap-1"><User className="h-4 w-4" /> Tutor: {player.tutorContact.name}</div>}
             {player.tutorContact?.phone && <div className="flex items-center gap-1"><Contact className="h-4 w-4" /> {player.tutorContact.phone}</div>}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Button variant="outline" onClick={() => setEditPlayerOpen(true)}>
            Editar Perfil
          </Button>
          {!isViewingAsPlayer && (
            <Button onClick={() => setEvalSheetOpen(true)}>
              <FilePlus className="mr-2 h-4 w-4" />
              Nueva Evaluación
            </Button>
          )}
        </div>
      </header>

      {player.archived && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-500">
          <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle>Jugador archivado</AlertTitle>
          <AlertDescription>
            Este jugador está archivado. No aparece en listados ni en totales de la escuela.
          </AlertDescription>
          <Button variant="outline" size="sm" className="mt-2" asChild>
            <Link href={schoolId ? `/dashboard/players?schoolId=${schoolId}` : "/dashboard/players"}>
              Volver a jugadores
            </Link>
          </Button>
        </Alert>
      )}

      {/* Cartel obligatorio para el jugador con perfil incompleto: no puede ver evaluaciones, videos, etc. */}
      {showLockedContent && (
        <Alert className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-500 shadow-md">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-lg">Completá tu perfil para desbloquear todo</AlertTitle>
          <AlertDescription className="mt-1">
            Para ver tus evaluaciones, videos y más, tenés que completar <strong>todos</strong> los datos de tu perfil: nombre, apellido, fecha de nacimiento, tutor (nombre y teléfono), email y <strong>foto</strong>. Podés sacar una foto con la cámara o subir una desde tu dispositivo en &quot;Editar Perfil&quot;.
          </AlertDescription>
          <Button className="mt-4" size="lg" onClick={() => setEditPlayerOpen(true)}>
            Completar perfil
          </Button>
        </Alert>
      )}

      {!isViewingAsPlayer && !player.email && (
        <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Este jugador no puede iniciar sesión</AlertTitle>
          <AlertDescription>
            Falta completar el <strong>Email (acceso al panel)</strong> en Editar perfil. Sin ese email, al iniciar sesión verá &quot;Acceso Pendiente&quot;. Agregá el mismo email con el que el jugador se registra y guardá.
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        defaultValue={
          (() => {
            const t = searchParams.get("tab");
            return t && ["summary", "evaluations", "physical", "videoteca", "attendance", "analytics"].includes(t)
              ? t
              : "summary";
          })()
        }
        className="w-full"
      >
        {/* Móvil: grid 3 columnas (2 filas) para usar todo el ancho; md+: una fila */}
        <TabsList
          className={`
            w-full bg-card grid grid-cols-3 gap-1 p-1 h-auto md:h-10
            ${isViewingAsPlayer ? "md:grid-cols-5" : "md:grid-cols-6"}
          `}
        >
          <TabsTrigger value="summary" className="text-xs px-2 py-2 md:text-sm md:px-3 md:py-1.5">
            Resumen
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="text-xs px-2 py-2 md:text-sm md:px-3 md:py-1.5">
            <span className="hidden sm:inline">Evaluaciones</span>
            <span className="sm:hidden">Eval.</span>
          </TabsTrigger>
          <TabsTrigger value="physical" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 md:gap-2">
            <span className="hidden sm:inline">Físicas</span>
            <span className="sm:hidden">Fís.</span>
            <Activity className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
          </TabsTrigger>
          <TabsTrigger value="videoteca" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 md:gap-2">
            <Video className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
            <span className="truncate">Videoteca</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 md:gap-2">
            <ClipboardCheck className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
            <span className="truncate">Asistencia</span>
          </TabsTrigger>
          {!isViewingAsPlayer && (
          <TabsTrigger value="analytics" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 md:gap-2">
            <Bot className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
            <span className="truncate">Análisis IA</span>
            <Badge variant="secondary" className="text-[9px] font-normal shrink-0 hidden sm:inline-flex">En desarrollo</Badge>
          </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="summary">
          {isViewingAsPlayer && !isMedicalRecordApproved(player) && (
            <Alert className={`mb-4 ${isMedicalRecordRejected(player) ? "border-red-500 bg-red-50 dark:bg-red-950/40 dark:border-red-500" : "border-amber-500 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-500"}`}>
              <FileHeart className={`h-4 w-4 ${isMedicalRecordRejected(player) ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`} />
              <AlertTitle>{isMedicalRecordRejected(player) ? "Ficha médica rechazada" : "Ficha médica obligatoria"}</AlertTitle>
              <AlertDescription>
                {isMedicalRecordRejected(player) && player.medicalRecord?.rejectionReason ? (
                  <>
                    Tu ficha médica no fue aprobada. Motivo: <strong>{player.medicalRecord.rejectionReason}</strong>.
                    Por favor subí una nueva ficha corregida en la sección de abajo.
                  </>
                ) : (
                  <>
                    Debes cargar tu ficha médica en PDF. Podés subirla en la sección &quot;Ficha médica&quot; más abajo. Una vez revisada por el entrenador o administrador, quedará marcada como cumplida.
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}
          <SummaryTab
            player={playerWithSchool}
            lastCoachComment={evaluations?.[0]?.coachComments}
            canEditCoachFeedback={!isViewingAsPlayer && (profile?.role === "school_admin" || profile?.role === "coach")}
            schoolId={schoolId ?? undefined}
            playerId={id}
          />
          <div className="mt-4">
            <PlayerPaymentStatusCard
              getToken={getToken}
              playerId={isViewingAsPlayer ? undefined : id}
              schoolId={isViewingAsPlayer ? undefined : schoolId ?? undefined}
            />
          </div>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="font-headline">Ficha médica</CardTitle>
              <p className="text-sm text-muted-foreground">
                PDF obligatorio. El jugador puede subirla aquí; el entrenador o administrador la revisa y marca como cumplida.
              </p>
            </CardHeader>
            <CardContent>
              <MedicalRecordField
                value={player.medicalRecord}
                onChange={() => {}}
                onApprove={() => {}}
                onReject={() => {}}
                schoolId={schoolId!}
                playerId={id}
                playerName={`${player.firstName ?? ""} ${player.lastName ?? ""}`.trim()}
                playerEmail={player.email}
                canApprove={!isViewingAsPlayer && (profile?.role === "school_admin" || profile?.role === "coach")}
                disabled={false}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="evaluations">
          {showLockedContent ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Lock className="h-12 w-12 text-muted-foreground mb-4 opacity-60" />
                <h3 className="font-semibold text-lg mb-2">Completá tu perfil</h3>
                <p className="text-muted-foreground max-w-sm mb-4">
                  Para ver tus evaluaciones necesitás completar todos los datos de tu perfil, incluida la foto (podés sacarla con la cámara o subir una).
                </p>
                <Button onClick={() => setEditPlayerOpen(true)}>Completar perfil</Button>
              </CardContent>
            </Card>
          ) : (
            <EvaluationsTab
              playerId={id}
              schoolId={schoolId!}
              evaluations={evaluations}
              loading={evalsLoading}
              error={evalsError}
              onOpenCreate={() => setEvalSheetOpen(true)}
              onEditClick={(evalData) => {
                setEditingEvaluation(evalData);
                setEvalSheetOpen(true);
              }}
              isViewingAsPlayer={isViewingAsPlayer}
            />
          )}
        </TabsContent>
        <TabsContent value="physical">
          {showLockedContent ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Lock className="h-12 w-12 text-muted-foreground mb-4 opacity-60" />
                <h3 className="font-semibold text-lg mb-2">Completá tu perfil</h3>
                <p className="text-muted-foreground max-w-sm mb-4">
                  Para ver tus evaluaciones físicas completá todos los datos de tu perfil, incluida la foto.
                </p>
                <Button onClick={() => setEditPlayerOpen(true)}>Completar perfil</Button>
              </CardContent>
            </Card>
          ) : (
            <PhysicalAssessmentsTab player={playerWithSchool} schoolId={schoolId!} isViewingAsPlayer={isViewingAsPlayer} />
          )}
        </TabsContent>
        <TabsContent value="videoteca">
          {showLockedContent ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Lock className="h-12 w-12 text-muted-foreground mb-4 opacity-60" />
                <h3 className="font-semibold text-lg mb-2">Completá tu perfil</h3>
                <p className="text-muted-foreground max-w-sm mb-4">
                  Para ver tu videoteca completá todos los datos de tu perfil, incluida la foto (sacala con la cámara o subila).
                </p>
                <Button onClick={() => setEditPlayerOpen(true)}>Completar perfil</Button>
              </CardContent>
            </Card>
          ) : (
            <PlayerVideoteca
              schoolId={schoolId!}
              playerId={id}
              playerName={`${player.firstName ?? ""} ${player.lastName ?? ""}`.trim()}
              embedded
              isViewingAsPlayer={isViewingAsPlayer}
            />
          )}
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceHistory schoolId={schoolId!} playerId={id} />
        </TabsContent>
        {!isViewingAsPlayer && (
        <TabsContent value="analytics">
          <AnalyticsTab player={playerWithSchool} evaluations={evaluations || []} />
        </TabsContent>
        )}
      </Tabs>

      {canArchive && (
        <div className="flex justify-end">
          <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-600 dark:hover:bg-amber-950/50">
                <Archive className="mr-2 h-4 w-4" />
                Archivar jugador
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>¿Archivar este jugador?</AlertDialogTitle>
              <AlertDialogDescription>
                El jugador dejará de aparecer en listados, no se contará en cantidad de jugadores ni sus pagos en los totales. Es útil para jugadores de prueba. Los datos se conservan pero quedan ocultos.
              </AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleArchive();
                  }}
                  disabled={archiving}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {archiving ? "Archivando…" : "Sí, archivar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
    </>
  );
}
