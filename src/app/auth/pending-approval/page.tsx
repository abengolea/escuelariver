"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserX, LogOut, Send, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth, useFirestore } from "@/firebase";
import { signOut } from "firebase/auth";
import { collection, addDoc, doc, getDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function PendingApprovalPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [hasWebRegistrationPending, setHasWebRegistrationPending] = useState<boolean | null>(null);
  const [isAccountDisabled, setIsAccountDisabled] = useState<boolean | null>(null);
  const [hasPendingAccessRequest, setHasPendingAccessRequest] = useState<boolean | null>(null);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/auth/login');
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión exitosamente.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo cerrar la sesión. Inténtalo de nuevo.",
      });
    }
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user?.email) {
      setHasWebRegistrationPending(false);
      setIsAccountDisabled(false);
      setHasPendingAccessRequest(false);
      return;
    }
    const emailNorm = user.email.trim().toLowerCase();
    getDoc(doc(firestore, "pendingPlayerByEmail", emailNorm))
      .then((snap) => setHasWebRegistrationPending(snap.exists()))
      .catch(() => setHasWebRegistrationPending(false));
    getDoc(doc(firestore, "playerLogins", emailNorm))
      .then((loginSnap) => {
        if (!loginSnap.exists()) {
          setIsAccountDisabled(false);
          return;
        }
        const { schoolId: sid, playerId } = loginSnap.data() as { schoolId: string; playerId: string };
        return getDoc(doc(firestore, `schools/${sid}/players/${playerId}`));
      })
      .then((playerSnap) => {
        if (!playerSnap || !playerSnap.exists()) {
          setIsAccountDisabled(false);
          return;
        }
        const status = (playerSnap.data() as { status?: string })?.status;
        setIsAccountDisabled(status !== undefined && status !== "active");
      })
      .catch(() => setIsAccountDisabled(false));
    // Verificar si ya tiene una solicitud de acceso pendiente (evitar duplicados)
    getDocs(
      query(
        collection(firestore, "accessRequests"),
        where("uid", "==", user.uid),
        where("status", "==", "pending")
      )
    )
      .then((snap) => setHasPendingAccessRequest(!snap.empty))
      .catch(() => setHasPendingAccessRequest(false));
  }, [auth.currentUser, firestore]);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleRequestAccess = async () => {
    const user = auth.currentUser;
    if (!user?.email) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo obtener tu email." });
      return;
    }
    if (hasPendingAccessRequest) {
      toast({
        variant: "destructive",
        title: "Ya tenés una solicitud pendiente",
        description: "Esperá a que un entrenador la apruebe. No hace falta enviar otra.",
      });
      return;
    }
    setSending(true);
    try {
      // Verificación final antes de crear (evitar duplicados por doble clic o race)
      const existingSnap = await getDocs(
        query(
          collection(firestore, "accessRequests"),
          where("uid", "==", user.uid),
          where("status", "==", "pending")
        )
      );
      if (!existingSnap.empty) {
        setHasPendingAccessRequest(true);
        setRequestSent(true);
        toast({
          title: "Ya tenés una solicitud pendiente",
          description: "Esperá a que un entrenador la apruebe.",
        });
        return;
      }
      await addDoc(collection(firestore, "accessRequests"), {
        uid: user.uid,
        email: user.email.trim().toLowerCase(),
        displayName: user.displayName || user.email.split("@")[0] || "Jugador",
        type: "player",
        status: "pending",
        createdAt: Timestamp.now(),
      });
      setRequestSent(true);
      setHasPendingAccessRequest(true);
      toast({
        title: "Solicitud enviada",
        description: "Un entrenador verá tu solicitud en Solicitudes y te dará acceso cuando la apruebe.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo enviar la solicitud. Inténtalo de nuevo.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-2xl border-2">
      <CardHeader className="items-center text-center">
        <UserX className="h-16 w-16 text-destructive" />
        <CardTitle className="text-2xl font-headline mt-4">
          {isAccountDisabled ? "Cuenta desactivada" : "Acceso Pendiente"}
        </CardTitle>
        <CardDescription>
          {isAccountDisabled
            ? "Tu cuenta de jugador está desactivada. No podés ingresar al panel. Contactá a la escuela para reactivarla."
            : "Tu cuenta está activa, pero no tienes permisos para acceder."}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        {isAccountDisabled ? (
          <div className="flex flex-col gap-2">
            <Button onClick={handleLogout} variant="outline" className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        ) : hasWebRegistrationPending ? (
          <>
            <div className="flex justify-center">
              <Clock className="h-12 w-12 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              Tu solicitud de registro como jugador está <strong>pendiente de aprobación</strong>. Un administrador de la escuela la revisará pronto. Cuando te aprueben, podrás entrar al panel.
            </p>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              Si eres <strong>jugador</strong>, podés enviar una solicitud. Un entrenador la verá en Solicitudes y te dará acceso al aprobarla.
            </p>
            {requestSent || hasPendingAccessRequest ? (
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                Ya tenés una solicitud pendiente. Cuando un entrenador la apruebe, podrás entrar. Usá &quot;Reintentar&quot; después.
              </p>
            ) : (
              <Button onClick={handleRequestAccess} disabled={sending} className="w-full" variant="secondary">
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Enviando…" : "Solicitar acceso como jugador"}
              </Button>
            )}
          </>
        )}
        {!isAccountDisabled && (
          <div className="flex flex-col gap-2">
            <Button onClick={handleRetry} className="w-full">
              Reintentar
            </Button>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
