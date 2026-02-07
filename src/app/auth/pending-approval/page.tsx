"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PendingApprovalPage() {
  return (
    <Card className="w-full max-w-md shadow-2xl border-2">
      <CardHeader className="items-center text-center">
        <MailCheck className="h-16 w-16 text-green-500" />
        <CardTitle className="text-2xl font-headline mt-4">¡Registro Completado!</CardTitle>
        <CardDescription>
          Tu cuenta ha sido creada exitosamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-muted-foreground">
          Un administrador necesita asignarte a una escuela y darte un rol. Una vez que lo hagan, podrás iniciar sesión y acceder al panel.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/auth/login">
            Entendido, volver a inicio de sesión
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
