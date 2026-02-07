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

const DEFAULT_SCHOOL_ID = 'escuela-123-sn';

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading } = useUser();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

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
    if (user.email === 'abengolea1@gmail.com' || user.email === 'goyitobengolea@gmail.com') {
      const platformUserRef = doc(firestore, 'platformUsers', user.uid);
      batch.set(platformUserRef, { super_admin: true });
    }

    await batch.commit();
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
    }
  };

  const handleGoogleLogin = async () => {
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
    }
  };

  const prefillSuperAdmin = () => {
    setEmail('goyitobengolea@gmail.com');
    setPassword('');
    toast({
        title: "Credenciales de Super Admin cargadas",
        description: "Ingresa la contraseña que creaste para 'goyitobengolea@gmail.com' y pulsa 'Iniciar Sesión'.",
    });
  }
  
  if (loading || user) {
      return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  return (
    <Card className="w-full max-w-sm shadow-2xl border-2">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Iniciar Sesión</CardTitle>
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
            />
          </div>
          <Button type="submit" className="w-full">
            Iniciar Sesión
          </Button>
          <Button variant="outline" className="w-full" type="button" onClick={handleGoogleLogin}>
            Iniciar Sesión con Google
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          ¿No tienes una cuenta?{" "}
          <Link href="/auth/signup" className="underline">
            Regístrate
          </Link>
        </div>
        <div className="relative mt-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Opciones de Desarrollo
            </span>
          </div>
        </div>
        <Button
          variant="secondary"
          className="w-full mt-4"
          type="button"
          onClick={prefillSuperAdmin}
        >
          Acceso Rápido como Super Admin
        </Button>
      </CardContent>
    </Card>
  );
}
