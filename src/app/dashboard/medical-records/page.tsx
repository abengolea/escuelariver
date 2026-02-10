"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Upload, ExternalLink, CheckCircle, UserX, Loader2, XCircle } from "lucide-react";
import { useCollection, useUserProfile, useUser } from "@/firebase";
import type { Player, MedicalRecord } from "@/lib/types";
import { isMedicalRecordApproved, isMedicalRecordRejected } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { MedicalRecordField } from "@/components/players/MedicalRecordField";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildEmailHtml, escapeHtml, htmlToPlainText, sendMailDoc } from "@/lib/email";
import { useFirestore } from "@/firebase";
import { useState } from "react";

export default function MedicalRecordsPage() {
  const { isReady, activeSchoolId, profile } = useUserProfile();
  const [refreshingPlayerId, setRefreshingPlayerId] = useState<string | null>(null);

  const schoolId = activeSchoolId;
  const isStaff = profile?.role === "school_admin" || profile?.role === "coach";
  const canList = isReady && schoolId && isStaff;

  const { data: players, loading } = useCollection<Player>(
    canList ? `schools/${schoolId}/players` : "",
    { orderBy: ["lastName", "asc"] }
  );

  const activePlayers = useMemo(
    () => (players ?? []).filter((p) => !p.archived),
    [players]
  );

  const withoutFile = useMemo(
    () => activePlayers.filter((p) => !p.medicalRecord?.url),
    [activePlayers]
  );

  const pendingReview = useMemo(
    () =>
      activePlayers.filter(
        (p) => p.medicalRecord?.url && !isMedicalRecordApproved(p)
      ),
    [activePlayers]
  );

  const pendingCount = withoutFile.length + pendingReview.length;

  if (!isReady || !schoolId) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <UserX className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-center">
          Solo el administrador o el entrenador de la escuela pueden ver la lista de fichas médicas.
        </p>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Volver al panel</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-headline sm:text-3xl">
          Fichas médicas
        </h1>
        <p className="text-muted-foreground mt-1">
          Jugadores que aún no cargaron ficha médica o tienen una ficha pendiente de revisión. Podés subir la ficha por ellos o marcar como cumplido tras revisar el PDF.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Sin ficha cargada</CardTitle>
            <CardDescription>
              No han adjuntado ningún PDF todavía.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{withoutFile.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Pendiente de revisión</CardTitle>
            <CardDescription>
              Tienen PDF subido; falta que revises y marques cumplido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingReview.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Listado de pendientes</CardTitle>
          <CardDescription>
            {pendingCount === 0
              ? "Todos los jugadores activos tienen ficha médica cumplida."
              : "Hacé clic en «Ver PDF» para revisar y luego «Marcar cumplido» si está correcta. También podés subir la ficha por el jugador."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : pendingCount === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>No hay jugadores pendientes de ficha médica.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jugador</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withoutFile.map((player) => (
                    <TableRow key={player.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/players/${player.id}?schoolId=${schoolId}`}
                          className="font-medium hover:underline"
                        >
                          {player.firstName} {player.lastName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Sin adjuntar</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link
                              href={`/dashboard/players/${player.id}?schoolId=${schoolId}`}
                              className="gap-2"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Ir al perfil
                            </Link>
                          </Button>
                          <MedicalRecordInlineUpload
                            schoolId={schoolId}
                            playerId={player.id}
                            playerName={`${player.firstName} ${player.lastName}`}
                            onSuccess={() => setRefreshingPlayerId(player.id)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendingReview.map((player) => (
                    <TableRow key={player.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/players/${player.id}?schoolId=${schoolId}`}
                          className="font-medium hover:underline"
                        >
                          {player.firstName} {player.lastName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {isMedicalRecordRejected(player) ? (
                          <Badge variant="outline" className="border-red-500 text-red-700 dark:text-red-400" title={player.medicalRecord?.rejectionReason}>
                            Rechazada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                            Pendiente revisión
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <PendingReviewRowActions
                          schoolId={schoolId}
                          playerId={player.id}
                          playerName={`${player.firstName} ${player.lastName}`}
                          playerEmail={player.email}
                          medicalRecord={player.medicalRecord}
                          onApprove={() => setRefreshingPlayerId(player.id)}
                          onReject={() => setRefreshingPlayerId(player.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Acciones compactas para fila "pendiente de revisión": Ver PDF + Marcar cumplido + Marcar incumplido. */
function PendingReviewRowActions({
  schoolId,
  playerId,
  playerName,
  playerEmail,
  medicalRecord,
  onApprove,
  onReject,
}: {
  schoolId: string;
  playerId: string;
  playerName: string;
  playerEmail?: string | null;
  medicalRecord?: MedicalRecord | null;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleApprove = async () => {
    if (!user) return;
    setApproving(true);
    try {
      const res = await fetch("/api/players/medical-record/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ schoolId, playerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error al marcar cumplido");
      onApprove();
      toast({
        title: "Ficha marcada como cumplida",
        description: `${playerName} ya no aparece en la lista de pendientes.`,
      });
      setPreviewOpen(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo marcar como cumplida",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!user) return;
    const reason = rejectionReason.trim();
    if (!reason) {
      toast({
        variant: "destructive",
        title: "Motivo requerido",
        description: "Explicá qué está mal con la ficha para que el jugador pueda corregirlo.",
      });
      return;
    }
    setRejecting(true);
    try {
      const res = await fetch("/api/players/medical-record/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ schoolId, playerId, rejectionReason: reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error al marcar incumplida");
      onReject();

      const emailTo = playerEmail?.trim().toLowerCase();
      if (emailTo) {
        const subject = "Tu ficha médica no fue aprobada";
        const safeReason = escapeHtml(reason).replace(/\n/g, "<br>");
        const contentHtml = `<p>Hola,</p><p>Tu ficha médica no fue aprobada. Motivo:</p><p><strong>${safeReason}</strong></p><p>Por favor subí una nueva ficha médica corregida desde tu perfil en el panel.</p>`;
        const html = buildEmailHtml(contentHtml, {
          title: "Escuelas River SN",
          baseUrl: typeof window !== "undefined" ? window.location.origin : "",
          greeting: "Mensaje de tu escuela:",
        });
        await sendMailDoc(firestore, {
          to: emailTo,
          subject,
          html,
          text: htmlToPlainText(contentHtml),
        });
      }

      toast({
        title: "Ficha marcada como incumplida",
        description: emailTo
          ? "Se envió un correo al jugador con el motivo."
          : `${playerName} quedó marcado. Avisale el motivo ya que no tiene email cargado.`,
      });
      setRejectDialogOpen(false);
      setRejectionReason("");
      setPreviewOpen(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo marcar como incumplida",
      });
    } finally {
      setRejecting(false);
    }
  };

  if (!medicalRecord?.url) return null;

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setPreviewOpen(true)}
        >
          <FileText className="h-4 w-4" />
          Ver PDF
        </Button>
        <Button size="sm" className="gap-2" onClick={handleApprove} disabled={approving}>
          {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Marcar cumplido
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="gap-2"
          onClick={() => setRejectDialogOpen(true)}
          disabled={rejecting}
        >
          {rejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          Marcar incumplido
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/players/${playerId}?schoolId=${schoolId}`} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Ir al perfil
          </Link>
        </Button>
      </div>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Vista previa – Ficha médica ({playerName})</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 rounded border bg-muted/30 overflow-hidden">
            <iframe
              src={medicalRecord.url}
              title="Ficha médica PDF"
              className="w-full h-[60vh] border-0"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cerrar
            </Button>
            <Button variant="destructive" onClick={() => setRejectDialogOpen(true)} disabled={rejecting}>
              {rejecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Marcar incumplido
            </Button>
            <Button onClick={handleApprove} disabled={approving}>
              {approving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Marcar cumplido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar ficha como incumplida</DialogTitle>
            <DialogDescription>
              Explicá qué está mal con la ficha (ej. mal impresa, faltan datos, no es legible). El jugador recibirá un correo automático con este motivo para que pueda corregirla.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="rejection-reason-row">Motivo del rechazo</Label>
            <Textarea
              id="rejection-reason-row"
              placeholder="Ej: La ficha está mal impresa y no se lee bien. Por favor subí una nueva en buena calidad."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="resize-y"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectionReason(""); }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting || !rejectionReason.trim()}>
              {rejecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Marcar incumplido y notificar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Botón + diálogo para subir ficha médica en nombre del jugador (solo en lista). */
function MedicalRecordInlineUpload({
  schoolId,
  playerId,
  playerName,
  onSuccess,
}: {
  schoolId: string;
  playerId: string;
  playerName: string;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const handleSuccess = () => {
    onSuccess?.();
    setOpen(false);
  };

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Subir ficha
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Subir ficha médica – {playerName}</DialogTitle>
          </DialogHeader>
          <MedicalRecordField
            value={undefined}
            onChange={handleSuccess}
            schoolId={schoolId}
            playerId={playerId}
            playerName={playerName}
            canApprove={false}
            disabled={false}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
