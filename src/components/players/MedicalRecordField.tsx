"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStorage, useFirestore } from "@/firebase";
import { uploadMedicalRecord } from "@/lib/medical-record";
import { buildEmailHtml, escapeHtml, htmlToPlainText, sendMailDoc } from "@/lib/email";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, Loader2, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import type { MedicalRecord } from "@/lib/types";
import { useUser } from "@/firebase";

interface MedicalRecordFieldProps {
  value: MedicalRecord | null | undefined;
  onChange: (medicalRecord: MedicalRecord) => void;
  onApprove?: () => void;
  onReject?: () => void;
  schoolId: string;
  playerId: string;
  playerName?: string;
  /** Email del jugador para enviarle el mensaje automático cuando se rechaza. */
  playerEmail?: string | null;
  /** Si es true, muestra los botones Marcar cumplido / Marcar incumplido (solo admin/entrenador). */
  canApprove?: boolean;
  /** Si es true, el jugador no puede subir (solo ver); si false, puede subir. */
  disabled?: boolean;
}

export function MedicalRecordField({
  value,
  onChange,
  onApprove,
  onReject,
  schoolId,
  playerId,
  playerName = "",
  playerEmail,
  canApprove = false,
  disabled = false,
}: MedicalRecordFieldProps) {
  const storage = useStorage();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const hasFile = Boolean(value?.url);
  const isApproved = Boolean(value?.approvedAt);
  const isRejected = Boolean(value?.rejectedAt);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.type !== "application/pdf") {
      toast({
        variant: "destructive",
        title: "Archivo no válido",
        description: "Solo se permiten archivos PDF.",
      });
      e.target.value = "";
      return;
    }
    e.target.value = "";
    setUploading(true);
    try {
      const { url, storagePath } = await uploadMedicalRecord(storage, schoolId, playerId, file);
      const res = await fetch("/api/players/medical-record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          schoolId,
          playerId,
          url,
          storagePath,
          uploadedAt: new Date().toISOString(),
          uploadedBy: user.uid,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error al guardar la ficha");
      onChange({
        url,
        storagePath,
        uploadedAt: new Date(),
        uploadedBy: user.uid,
      });
      toast({
        title: "Ficha médica cargada",
        description: "El administrador o entrenador la revisará y marcará como cumplida si está correcta.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al subir",
        description: err instanceof Error ? err.message : "No se pudo subir el PDF.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async () => {
    if (!user || !onApprove) return;
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
        description: `${playerName || "El jugador"} ya no aparece en la lista de pendientes.`,
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
      onReject?.();

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
          : `${playerName || "El jugador"} quedó marcado. Avisale el motivo ya que no tiene email cargado.`,
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

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Ficha médica (PDF)</p>
      {!hasFile ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            El jugador debe adjuntar su ficha médica en PDF. También podés subirla vos desde aquí.
          </p>
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              className="w-fit gap-2"
              asChild
            >
              <label className="cursor-pointer gap-2 flex items-center">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Subir ficha médica (PDF)
                <input
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
              </label>
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setPreviewOpen(true)}
          >
            <FileText className="h-4 w-4" />
            Ver PDF
          </Button>
          <a
            href={value!.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir en nueva pestaña
          </a>
          {isApproved ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              Cumplido
            </span>
          ) : isRejected ? (
            <span className="text-sm text-red-600 dark:text-red-400" title={value?.rejectionReason}>
              Rechazada – {value?.rejectionReason || "Ver motivo en perfil"}
            </span>
          ) : canApprove ? (
            <>
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={handleApprove}
                disabled={approving}
              >
                {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Marcar cumplido
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => setRejectDialogOpen(true)}
                disabled={rejecting}
              >
                {rejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Marcar incumplido
              </Button>
            </>
          ) : (
            <span className="text-sm text-amber-600 dark:text-amber-400">
              Pendiente de revisión
            </span>
          )}
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              className="gap-2"
              asChild
            >
              <label className="cursor-pointer gap-2 flex items-center">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Reemplazar PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
              </label>
            </Button>
          )}
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Vista previa – Ficha médica {playerName ? `(${playerName})` : ""}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 rounded border bg-muted/30 overflow-hidden">
            {value?.url && (
              <iframe
                src={value.url}
                title="Ficha médica PDF"
                className="w-full h-[60vh] border-0"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cerrar
            </Button>
            {canApprove && !isApproved && value?.url && (
              <>
                <Button variant="destructive" onClick={() => setRejectDialogOpen(true)} disabled={rejecting}>
                  {rejecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Marcar incumplido
                </Button>
                <Button onClick={handleApprove} disabled={approving}>
                  {approving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Marcar cumplido
                </Button>
              </>
            )}
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
            <Label htmlFor="rejection-reason">Motivo del rechazo</Label>
            <Textarea
              id="rejection-reason"
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
    </div>
  );
}
