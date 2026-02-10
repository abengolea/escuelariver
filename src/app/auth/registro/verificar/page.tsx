"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, useFirestore } from "@/firebase";
import { signInWithEmailLink, isSignInWithEmailLink, updatePassword } from "firebase/auth";
import {
  doc,
  getDoc,
  deleteDoc,
  addDoc,
  setDoc,
  collection,
  Timestamp,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";

function VerificarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [step, setStep] = useState<"loading" | "password" | "creating" | "success" | "error">(
    "loading"
  );
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [attemptData, setAttemptData] = useState<{
    email: string;
    playerData: {
      firstName: string;
      lastName: string;
      birthDate: { toDate: () => Date };
      schoolId: string;
      tutorPhone: string;
    };
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const attemptId = searchParams.get("attemptId");

  useEffect(() => {
    if (!attemptId) {
      setStep("error");
      setErrorMsg("Enlace inválido. Falta el identificador de solicitud.");
      return;
    }

    const run = async () => {
      try {
        const attemptRef = doc(firestore, "emailVerificationAttempts", attemptId);
        const snap = await getDoc(attemptRef);

        if (!snap.exists()) {
          setStep("error");
          setErrorMsg("El enlace expiró o ya fue usado.");
          return;
        }

        const data = snap.data();
        if (data?.status !== "pending") {
          setStep("error");
          setErrorMsg("Este enlace ya fue utilizado.");
          return;
        }

        const expiresAt = data.expiresAt?.toDate?.() ?? new Date(0);
        if (expiresAt < new Date()) {
          setStep("error");
          setErrorMsg("El enlace expiró. Volvé a solicitar el registro.");
          return;
        }

        const emailStored = window.localStorage.getItem("emailForSignIn");
        const email = data.email as string;
        const fullUrl = window.location.href;

        if (!isSignInWithEmailLink(auth, fullUrl)) {
          setStep("error");
          setErrorMsg("Este enlace no es válido para verificación.");
          return;
        }

        const emailToUse = emailStored || email;
        if (!emailToUse) {
          setStep("error");
          setErrorMsg("No se encontró el email. Volvé a iniciar el registro.");
          return;
        }

        const result = await signInWithEmailLink(auth, emailToUse, fullUrl);
        window.localStorage.removeItem("emailForSignIn");

        const birthDate = data.playerData?.birthDate;
        setAttemptData({
          email,
          playerData: {
            ...data.playerData,
            birthDate:
              typeof birthDate?.toDate === "function"
                ? birthDate
                : { toDate: () => new Date(birthDate) },
          },
        });

        const needsPassword = !result.user.hasOwnProperty("password");
        if (result.user.providerData.every((p) => p?.providerId === "password")) {
          const needs = !(result.user as { providerData?: unknown[] }).providerData?.some(
            (p: { providerId?: string }) => p?.providerId === "password"
          );
        }

        setStep("password");
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        setStep("error");
        setErrorMsg(e.message || "Ocurrió un error al verificar el enlace.");
      }
    };

    run();
  }, [attemptId, auth, firestore]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attemptData || password.length < 6) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres.",
      });
      return;
    }
    if (password !== passwordConfirm) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Las contraseñas no coinciden.",
      });
      return;
    }

    setStep("creating");
    const user = auth.currentUser;
    if (!user) {
      setStep("error");
      setErrorMsg("Sesión perdida. Volvé a intentar.");
      return;
    }

    try {
      await updatePassword(user, password);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message || "No se pudo crear la contraseña.",
      });
      setStep("password");
      return;
    }

    try {
      const pendingRef = collection(
        firestore,
        `schools/${attemptData.playerData.schoolId}/pendingPlayers`
      );

      const birthDate = attemptData.playerData.birthDate;
      const birthDateVal =
        typeof birthDate === "object" && birthDate !== null && "toDate" in birthDate
          ? (birthDate as { toDate: () => Date }).toDate()
          : new Date(birthDate);

      const emailNorm = attemptData.email.toLowerCase();
      await addDoc(pendingRef, {
        firstName: attemptData.playerData.firstName,
        lastName: attemptData.playerData.lastName,
        birthDate: Timestamp.fromDate(birthDateVal),
        email: emailNorm,
        tutorContact: {
          name: "Responsable",
          phone: attemptData.playerData.tutorPhone || "",
        },
        submittedAt: Timestamp.now(),
        submittedBy: user.uid,
      });

      await setDoc(doc(firestore, "pendingPlayerByEmail", emailNorm), {
        schoolId: attemptData.playerData.schoolId,
        createdAt: Timestamp.now(),
      });

      const attemptDocRef = doc(firestore, "emailVerificationAttempts", attemptId!);
      await deleteDoc(attemptDocRef);

      setStep("success");
      toast({
        title: "Registro completado",
        description: "Tu solicitud fue enviada. Un administrador la revisará pronto.",
      });
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message || "No se pudo crear la solicitud.",
      });
      setStep("password");
    }
  };

  if (step === "loading") {
    return (
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Verificando enlace...</p>
        </CardContent>
      </Card>
    );
  }

  if (step === "error") {
    return (
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>{errorMsg}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <a href="/auth/registro">Volver al registro</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "password") {
    return (
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardHeader>
          <CardTitle>Crear contraseña</CardTitle>
          <CardDescription>
            Ingresá una contraseña para acceder al panel cuando aprueben tu solicitud.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">Confirmar contraseña</Label>
              <Input
                id="passwordConfirm"
                type="password"
                placeholder="Repetí la contraseña"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Completar registro
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step === "creating") {
    return (
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Creando solicitud...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-2xl border-2">
      <CardHeader>
        <div className="flex justify-center">
          <CheckCircle className="h-16 w-16 text-green-600" />
        </div>
        <CardTitle className="text-center">¡Listo!</CardTitle>
        <CardDescription className="text-center">
          Tu solicitud fue enviada. Un administrador de la escuela la revisará y cuando te aprueben
          podrás iniciar sesión con tu email y contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button asChild className="w-full">
          <a href="/auth/login">Ir a iniciar sesión</a>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function VerificarPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full max-w-md shadow-2xl border-2">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Cargando...</p>
          </CardContent>
        </Card>
      }
    >
      <VerificarContent />
    </Suspense>
  );
}
