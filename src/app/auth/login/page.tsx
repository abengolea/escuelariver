"use client"
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useUser, useFirestore } from "@/firebase";
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, type User } from "firebase/auth";
import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Shield } from "lucide-react";

const DEFAULT_SCHOOL_ID = 'escuela-123-sn';

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading: authLoading } = useUser();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // This useEffect redirects a user if they are already authenticated.
  // The `!isLoggingIn` check prevents a race condition during a login attempt.
  useEffect(() => {
    if (!authLoading && user && !isLoggingIn) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router, isLoggingIn]);


  // NOTE: In a real app, user profile and school creation would be handled
  // by secure Cloud Functions. This is a temporary setup for the MVP.
  const createInitialData = async (user: User) => {
    const batch = writeBatch(firestore);

    // 1. Create a default School if it doesn't exist
    const schoolRef = doc(firestore, 'schools', DEFAULT_SCHOOL_ID);
    const schoolSnap = await getDoc(schoolRef);
    if (!schoolSnap.exists()) {
      batch.set(schoolRef, {
        name: 'Escuela de River - San Nicolás',
        city: 'San Nicolás de los Arroyos',
        province: 'Buenos Aires',
        address: 'Calle Falsa 123',
        status: 'active',
        createdAt: Timestamp.now(),
      });
    }

    // 2. Create the user's profile within that school
    const schoolUserRef = doc(firestore, `schools/${DEFAULT_SCHOOL_ID}/users`, user.uid);
    const schoolUserSnap = await getDoc(schoolUserRef);

    if (!schoolUserSnap.exists()) {
      batch.set(schoolUserRef, {
        displayName: user.displayName || user.email?.split('@')[0],
        email: user.email,
        role: 'school_admin', // Default new users to school_admin for MVP
        assignedCategories: [],
      });
    }

    // 3. Make specific users super_admin
    if (user.email === 'abengolea1@gmail.com') {
      const platformUserRef = doc(firestore, 'platformUsers', user.uid);
      batch.set(platformUserRef, { super_admin: true });
    }

    await batch.commit();
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await createInitialData(userCredential.user);
      router.push("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al iniciar sesión",
        description: "El correo electrónico o la contraseña son incorrectos.",
      });
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await createInitialData(result.user);
      router.push("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al iniciar sesión con Google",
        description: error.message,
      });
      setIsLoggingIn(false);
    }
  };

  const prefillSuperAdmin = () => {
    setEmail('abengolea1@gmail.com');
    setPassword('');
    toast({
        title: "Credenciales de Super Admin cargadas",
        description: "Ingresa la contraseña que creaste para 'abengolea1@gmail.com' y pulsa 'Iniciar Sesión'.",
    });
  }
  
  if (authLoading || user) {
      return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  return (
    <Card className="w-full max-w-sm shadow-2xl border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-headline">Iniciar Sesión</CardTitle>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prefillSuperAdmin} disabled={isLoggingIn}>
                            <Shield className="h-5 w-5 text-muted-foreground" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Acceso Rápido Super Admin</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
        <CardDescription>
          Ingresa tu correo para acceder al panel de tu escuela.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleEmailLogin} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="profe@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoggingIn}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center">
              <Label htmlFor="password">Contraseña</Label>
              <Link href="#" className="ml-auto inline-block text-sm underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <Input 
              id="password" 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoggingIn}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoggingIn}>
            {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Iniciar Sesión
          </Button>
          <Button variant="outline" className="w-full" type="button" onClick={handleGoogleLogin} disabled={isLoggingIn}>
            {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Iniciar Sesión con Google
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          ¿No tienes una cuenta?{" "}
          <Link href="/auth/signup" className="underline">
            Regístrate
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
