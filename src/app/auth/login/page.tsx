"use client"
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useUser, useFirestore } from "@/firebase";
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

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

  const createUserProfile = async (user: User) => {
    const userDocRef = doc(firestore, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);
    if (!docSnap.exists()) {
      // New user, create profile with default role and a placeholder club ID
      await setDoc(userDocRef, {
        displayName: user.displayName || user.email?.split('@')[0],
        email: user.email,
        photoURL: user.photoURL,
        role: 'entrenador',
        clubId: 'club-123', // NOTE: All new coaches are assigned to a default club
      });
    } else {
      // Existing user, just update some fields, but crucially, not the role or clubId
      await setDoc(userDocRef, {
        displayName: user.displayName,
        photoURL: user.photoURL,
        email: user.email,
      }, { merge: true });
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await createUserProfile(userCredential.user);
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
      await createUserProfile(result.user);
      router.push("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al iniciar sesión con Google",
        description: error.message,
      });
    }
  };
  
  if (loading || user) {
      return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  return (
    <Card className="w-full max-w-sm shadow-2xl border-2">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Iniciar Sesión</CardTitle>
        <CardDescription>
          Ingresa tu correo electrónico para acceder a tu cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleEmailLogin} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="coach@example.com"
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
          <Link href="#" className="underline">
            Regístrate
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
