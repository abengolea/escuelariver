"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * El registro público es solo para jugadores.
 * Los demás roles (admin de escuela, entrenador) se crean desde el panel
 * por superadmin o admin de la escuela. Redirigimos a /auth/registro.
 */
export default function SignupPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/auth/registro");
  }, [router]);
  return null;
}
