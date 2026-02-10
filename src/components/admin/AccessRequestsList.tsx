"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  useCollection,
  useFirestore,
  useUserProfile,
  errorEmitter,
  FirestorePermissionError,
} from "@/firebase";
import {
  doc,
  updateDoc,
  setDoc,
  addDoc,
  collection,
  Timestamp,
} from "firebase/firestore";
import type { AccessRequest, Player } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type ActionState = { type: "approving" | "rejecting"; requestId: string } | null;

export function AccessRequestsList() {
  const { profile, activeSchoolId, isReady } = useUserProfile();
  const { toast } = useToast();
  const firestore = useFirestore();

  // Solo se muestran solicitudes pendientes; todas las registraciones son de tipo "player"
  const { data: requests, loading, error } = useCollection<AccessRequest>(
    isReady ? "accessRequests" : "",
    { where: ["status", "==", "pending"], limit: 50 }
  );

  const { data: players } = useCollection<Player>(
    isReady && activeSchoolId ? `schools/${activeSchoolId}/players` : "",
    {}
  );

  const [actionState, setActionState] = useState<ActionState>(null);
  const [approveDialog, setApproveDialog] = useState<{
    request: AccessRequest;
    linkToPlayerId: string | "new";
  } | null>(null);

  const handleApprove = async (request: AccessRequest, linkToPlayerId: string | "new") => {
    if (!profile || !activeSchoolId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se puede aprobar la solicitud.",
      });
      return;
    }
    setActionState({ type: "approving", requestId: request.id });
    const emailNorm = request.email.trim().toLowerCase();

    try {
      if (linkToPlayerId === "new") {
        const playersRef = collection(firestore, `schools/${activeSchoolId}/players`);
        const nameParts = (request.displayName || "").trim().split(/\s+/);
        const firstName = nameParts[0] || "Jugador";
        const lastName = nameParts.slice(1).join(" ") || "";
        const newPlayerRef = await addDoc(playersRef, {
          firstName,
          lastName,
          birthDate: Timestamp.fromDate(new Date("2010-01-01")),
          email: emailNorm,
          tutorContact: { name: "Por completar", phone: "" },
          status: "active",
          observations: `Aprobado desde solicitud de acceso el ${format(new Date(), "PPP", { locale: es })}.`,
          createdAt: Timestamp.now(),
          createdBy: profile.uid,
        });
        await setDoc(doc(firestore, "playerLogins", emailNorm), {
          schoolId: activeSchoolId,
          playerId: newPlayerRef.id,
        });
        await updateDoc(doc(firestore, "accessRequests", request.id), {
          status: "approved",
          approvedSchoolId: activeSchoolId,
          approvedPlayerId: newPlayerRef.id,
          approvedAt: Timestamp.now(),
        });
        toast({
          title: "Solicitud aprobada",
          description: `Se creó el jugador y ${request.email} ya puede iniciar sesión.`,
        });
      } else {
        const playerRef = doc(firestore, `schools/${activeSchoolId}/players`, linkToPlayerId);
        await updateDoc(playerRef, { email: emailNorm });
        await setDoc(doc(firestore, "playerLogins", emailNorm), {
          schoolId: activeSchoolId,
          playerId: linkToPlayerId,
        });
        await updateDoc(doc(firestore, "accessRequests", request.id), {
          status: "approved",
          approvedSchoolId: activeSchoolId,
          approvedPlayerId: linkToPlayerId,
          approvedAt: Timestamp.now(),
        });
        toast({
          title: "Solicitud aprobada",
          description: `Se vinculó ${request.email} al jugador. Ya puede iniciar sesión.`,
        });
      }
      setApproveDialog(null);
    } catch (err) {
      errorEmitter.emit(
        "permission-error",
        new FirestorePermissionError({
          path: "accessRequests",
          operation: "update",
        })
      );
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo aprobar la solicitud. Inténtalo de nuevo.",
      });
    } finally {
      setActionState(null);
    }
  };

  const handleReject = async (request: AccessRequest) => {
    setActionState({ type: "rejecting", requestId: request.id });
    try {
      await updateDoc(doc(firestore, "accessRequests", request.id), {
        status: "rejected",
      });
      toast({
        title: "Solicitud rechazada",
        description: `Se rechazó la solicitud de ${request.email}.`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo rechazar la solicitud.",
      });
    } finally {
      setActionState(null);
      setApproveDialog(null);
    }
  };

  const pendingList = requests?.filter((r) => r.status === "pending") ?? [];
  const sortedPending = [...pendingList].sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  );

  if (!isReady || !activeSchoolId) return null;

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader></Card>
        <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader></Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-destructive/10 border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>No se pueden cargar las solicitudes de acceso.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Solicitudes de acceso (jugadores)
          </CardTitle>
          <CardDescription>
            Usuarios que ya tienen cuenta y pidieron poder entrar como jugador. Aprobá para vincular su email a un jugador de tu escuela.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedPending.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay solicitudes de acceso pendientes.</p>
          ) : (
            <ul className="space-y-3">
              {sortedPending.map((req) => (
                <li
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{req.displayName || req.email}</p>
                    <p className="text-sm text-muted-foreground">{req.email}</p>
                    {req.createdAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(req.createdAt, "PPP p", { locale: es })}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setApproveDialog({ request: req, linkToPlayerId: "new" })}
                      disabled={!!actionState}
                    >
                      {actionState?.requestId === req.id && actionState?.type === "approving" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(req)}
                      disabled={!!actionState}
                    >
                      {actionState?.requestId === req.id && actionState?.type === "rejecting" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4 mr-1" />
                      )}
                      Rechazar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!approveDialog} onOpenChange={() => setApproveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar solicitud de acceso</DialogTitle>
            <DialogDescription>
              {approveDialog && (
                <>Vincular <strong>{approveDialog.request.email}</strong> a un jugador de tu escuela.</>
              )}
            </DialogDescription>
          </DialogHeader>
          {approveDialog && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Jugador</Label>
                <Select
                  value={approveDialog.linkToPlayerId}
                  onValueChange={(v) => setApproveDialog({ ...approveDialog, linkToPlayerId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir jugador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Crear nuevo jugador con este email</SelectItem>
                    {(players ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.firstName} {p.lastName}
                        {p.email ? ` (${p.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>
              Cancelar
            </Button>
            {approveDialog && (
              <Button
                onClick={() => handleApprove(approveDialog.request, approveDialog.linkToPlayerId)}
                disabled={!!actionState}
              >
                {actionState?.type === "approving" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Aprobar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
