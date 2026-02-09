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
  useCollection,
  useFirestore,
  useUserProfile,
  errorEmitter,
  FirestorePermissionError,
} from "@/firebase";
import {
  doc,
  writeBatch,
  collection,
  setDoc,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";
import type { PendingPlayer } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, User, X } from "lucide-react";
import { calculateAge } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type ActionState = {
  type: "approving" | "rejecting";
  playerId: string;
} | null;

export function PendingRegistrations() {
  const { profile, activeSchoolId, isReady } = useUserProfile();
  const { toast } = useToast();
  const firestore = useFirestore();

  const {
    data: pendingPlayers,
    loading,
    error,
  } = useCollection<PendingPlayer>(
    isReady && activeSchoolId ? `schools/${activeSchoolId}/pendingPlayers` : "",
    { orderBy: ["submittedAt", "asc"] }
  );

  const [actionState, setActionState] = useState<ActionState>(null);
  const [approveAllState, setApproveAllState] = useState(false);
  const [playerToConfirm, setPlayerToConfirm] = useState<{
    player: PendingPlayer;
    action: "approve" | "reject";
  } | null>(null);

  const handleApprove = async (pendingPlayer: PendingPlayer) => {
    if (!profile || !activeSchoolId) {
      toast({
        variant: "destructive",
        title: "Error de perfil",
        description: "No se puede aprobar la solicitud.",
      });
      return;
    }
    setActionState({ type: "approving", playerId: pendingPlayer.id });

    const batch = writeBatch(firestore);

    const emailNorm = (pendingPlayer as { email?: string }).email?.trim().toLowerCase();
    if (emailNorm) {
      const pendingByEmailRef = doc(firestore, "pendingPlayerByEmail", emailNorm);
      batch.delete(pendingByEmailRef);
    }

    // 1. Define el nuevo documento del jugador
    const newPlayerRef = doc(collection(firestore, `schools/${activeSchoolId}/players`));
    const newPlayerData = {
      firstName: pendingPlayer.firstName,
      lastName: pendingPlayer.lastName,
      birthDate: pendingPlayer.birthDate,
      ...(emailNorm && { email: emailNorm }),
      dni: pendingPlayer.dni || "",
      healthInsurance: "",
      tutorContact: pendingPlayer.tutorContact,
      status: "active",
      observations: `Aprobado desde solicitud de registro el ${format(
        new Date(),
        "PPP",
        { locale: es }
      )}.`,
      photoUrl: "",
      createdAt: Timestamp.now(),
      createdBy: profile.uid,
    };
    batch.set(newPlayerRef, newPlayerData);

    if (emailNorm) {
      batch.set(doc(firestore, "playerLogins", emailNorm), {
        schoolId: activeSchoolId,
        playerId: newPlayerRef.id,
      });
    }

    // 2. Define la eliminación del jugador pendiente
    const pendingPlayerRef = doc(
      firestore,
      `schools/${activeSchoolId}/pendingPlayers`,
      pendingPlayer.id
    );
    batch.delete(pendingPlayerRef);

    try {
      await batch.commit();
      toast({
        title: "¡Jugador Aprobado!",
        description: `${pendingPlayer.firstName} ${pendingPlayer.lastName} ahora es parte de la escuela.`,
      });
    } catch (err) {
      errorEmitter.emit(
        "permission-error",
        new FirestorePermissionError({
          path: `schools/${activeSchoolId}/players`,
          operation: "create",
        })
      );
      toast({
        variant: "destructive",
        title: "Error de Permisos",
        description:
          "No se pudo aprobar al jugador. Revisa tus permisos de escritura.",
      });
    } finally {
      setActionState(null);
      setPlayerToConfirm(null);
    }
  };

  const handleReject = async (pendingPlayer: PendingPlayer) => {
    if (!activeSchoolId) return;
    setActionState({ type: "rejecting", playerId: pendingPlayer.id });

    const pendingPlayerRef = doc(
      firestore,
      `schools/${activeSchoolId}/pendingPlayers`,
      pendingPlayer.id
    );

    try {
      const emailNorm = (pendingPlayer as { email?: string }).email?.trim().toLowerCase();
      if (emailNorm) {
        const pendingByEmailRef = doc(firestore, "pendingPlayerByEmail", emailNorm);
        await deleteDoc(pendingByEmailRef);
      }
      await deleteDoc(pendingPlayerRef);
      toast({
        title: "Solicitud Rechazada",
        description: `Se ha eliminado la solicitud de ${pendingPlayer.firstName}.`,
      });
    } catch (err) {
      errorEmitter.emit(
        "permission-error",
        new FirestorePermissionError({
          path: pendingPlayerRef.path,
          operation: "delete",
        })
      );
      toast({
        variant: "destructive",
        title: "Error de Permisos",
        description: "No se pudo rechazar la solicitud. Revisa tus permisos.",
      });
    } finally {
      setActionState(null);
      setPlayerToConfirm(null);
    }
  };

  const handleApproveAll = async () => {
    if (!profile || !activeSchoolId || !pendingPlayers?.length) return;
    setApproveAllState(true);
    let approved = 0;
    for (const player of pendingPlayers) {
      try {
        const batch = writeBatch(firestore);
        const emailNorm = (player as { email?: string }).email?.trim().toLowerCase();
        if (emailNorm) {
          batch.delete(doc(firestore, "pendingPlayerByEmail", emailNorm));
        }
        const newPlayerRef = doc(collection(firestore, `schools/${activeSchoolId}/players`));
        batch.set(newPlayerRef, {
          firstName: player.firstName,
          lastName: player.lastName,
          birthDate: player.birthDate,
          ...(emailNorm && { email: emailNorm }),
          dni: player.dni || "",
          healthInsurance: "",
          tutorContact: player.tutorContact,
          status: "active",
          observations: `Aprobado desde solicitud de registro el ${format(new Date(), "PPP", { locale: es })}.`,
          photoUrl: "",
          createdAt: Timestamp.now(),
          createdBy: profile.uid,
        });
        if (emailNorm) {
          batch.set(doc(firestore, "playerLogins", emailNorm), {
            schoolId: activeSchoolId,
            playerId: newPlayerRef.id,
          });
        }
        batch.delete(doc(firestore, `schools/${activeSchoolId}/pendingPlayers`, player.id));
        await batch.commit();
        approved++;
      } catch (err) {
        errorEmitter.emit(
          "permission-error",
          new FirestorePermissionError({
            path: `schools/${activeSchoolId}/players`,
            operation: "create",
          })
        );
        toast({
          variant: "destructive",
          title: "Error",
          description: `Se aprobaron ${approved} de ${pendingPlayers.length}. No se pudo aprobar a ${player.firstName}.`,
        });
        break;
      }
    }
    if (approved > 0) {
      toast({
        title: "¡Listo!",
        description: approved === pendingPlayers.length
          ? `Se aprobaron las ${approved} solicitudes.`
          : `Se aprobaron ${approved} de ${pendingPlayers.length} solicitudes.`,
      });
    }
    setApproveAllState(false);
  };
  
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
            <CardFooter className="gap-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-destructive/10 border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error de Permisos</CardTitle>
          <CardDescription className="text-destructive/80">
            No tienes permiso para ver las solicitudes de registro. Por favor,
            contacta a un administrador de la plataforma.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!pendingPlayers || pendingPlayers.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <CardHeader>
          <div className="mx-auto bg-primary/10 p-4 rounded-full">
            <User className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="mt-4">No hay solicitudes pendientes</CardTitle>
          <CardDescription>
            Cuando un nuevo jugador se registre, su solicitud aparecerá aquí
            para ser aprobada.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          onClick={handleApproveAll}
          disabled={approveAllState}
        >
          {approveAllState ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Aprobar todas
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pendingPlayers.map((player) => (
          <Card key={player.id} className="flex flex-col">
            <CardHeader>
              <CardTitle>
                {player.firstName} {player.lastName}
              </CardTitle>
              <CardDescription>
                Solicitud recibida el{" "}
                {format(player.submittedAt, "PPP", { locale: es })}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-2 text-sm">
                <p><strong>Edad:</strong> {calculateAge(player.birthDate)} años</p>
                {(player as { email?: string }).email && (
                  <p><strong>Email:</strong> {(player as { email?: string }).email}</p>
                )}
                {player.dni && <p><strong>DNI:</strong> {player.dni}</p>}
                <p><strong>Tutor:</strong> {player.tutorContact.name}</p>
                <p><strong>Tel. Tutor:</strong> {player.tutorContact.phone}</p>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                className="w-full"
                onClick={() => setPlayerToConfirm({ player, action: "approve" })}
                disabled={!!actionState || approveAllState}
              >
                {actionState?.type === 'approving' && actionState?.playerId === player.id ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Check />
                )}
                <span className="ml-2">Aprobar</span>
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setPlayerToConfirm({ player, action: "reject" })}
                disabled={!!actionState || approveAllState}
              >
                {actionState?.type === 'rejecting' && actionState?.playerId === player.id ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <X />
                )}
                <span className="ml-2">Rechazar</span>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <AlertDialog
        open={!!playerToConfirm}
        onOpenChange={(open) => !open && setPlayerToConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              {playerToConfirm?.action === "approve"
                ? `Estás a punto de añadir a ${playerToConfirm?.player.firstName} a la lista oficial de jugadores de la escuela.`
                : `Esta acción eliminará la solicitud de ${playerToConfirm?.player.firstName} permanentemente. No se podrá deshacer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!actionState}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!!actionState}
              onClick={() =>
                playerToConfirm?.action === "approve"
                  ? handleApprove(playerToConfirm.player)
                  : handleReject(playerToConfirm.player)
              }
               className={playerToConfirm?.action === 'reject' ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {actionState ? <Loader2 className="mr-2 animate-spin"/> : (playerToConfirm?.action === 'approve' ? 'Sí, Aprobar' : 'Sí, Rechazar')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
