"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CreditCard } from "lucide-react";
import { useUserProfile, useCollection } from "@/firebase";
import type { School } from "@/lib/types";
import { SuperAdminPlayerPaymentsTab } from "@/components/admin/SuperAdminPlayerPaymentsTab";

export default function PagosJugadoresAdminPage() {
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
        <CreditCard className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Pagos de jugadores
          </h1>
          <p className="text-muted-foreground">
            Vista global de cobros a escuelas (Mercado Pago, manual). Para reclamos de padres sin acreditación.
          </p>
        </div>
      </div>
      <SuperAdminPlayerPaymentsTab schools={schools ?? null} />
    </div>
  );
}
