"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerRegistrationForm } from "@/components/registro/PlayerRegistrationForm";
import Link from "next/link";

export default function RegistroPage() {
  return (
    <Card className="w-full max-w-md shadow-2xl border-2">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Registro de Jugador</CardTitle>
        <CardDescription>
          Elegí tu escuela, completá tus datos y fecha de nacimiento, ingresá tu email dos veces y una contraseña. Un administrador o entrenador revisará tu solicitud y te avisará cuando te aprueben.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PlayerRegistrationForm />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{" "}
          <Link href="/auth/login" className="underline">
            Iniciar sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
