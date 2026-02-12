"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, DollarSign } from "lucide-react";
import { useUserProfile, useCollection } from "@/firebase";
import type { School } from "@/lib/types";
import { SuperAdminMensualidadesTab } from "@/components/admin/SuperAdminMensualidadesTab";

export default function MensualidadesPage() {
  const router = useRouter();
  const { isSuperAdmin, isReady } = useUserProfile();
  const { data: schools } = useCollection<School>("schools", {
    orderBy: ["createdAt", "desc"],
  });

  useEffect(() => {
    if (!isReady) return;
    if (!isSuperAdmin) {
      router.replace("/dashboard");
      return;
    }
  }, [isReady, isSuperAdmin, router]);

  if (!isReady || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <DollarSign className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Mensualidades
          </h1>
          <p className="text-muted-foreground">
            Escuelas en mora, pagos ingresados y tarifas por escuela.
          </p>
        </div>
      </div>
      <SuperAdminMensualidadesTab schools={schools ?? null} />
    </div>
  );
}
