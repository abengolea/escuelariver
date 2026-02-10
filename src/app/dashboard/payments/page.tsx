"use client";

import { useUserProfile, useFirebase } from "@/firebase";
import { getAuth } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentsTab } from "@/components/payments/PaymentsTab";
import { DelinquentsTab } from "@/components/payments/DelinquentsTab";
import { PaymentConfigTab } from "@/components/payments/PaymentConfigTab";
import { PlayerPaymentsView } from "@/components/payments/PlayerPaymentsView";
import { Banknote, AlertTriangle, Settings, FlaskConical } from "lucide-react";

export default function PaymentsPage() {
  const { profile, isReady, isAdmin, isPlayer } = useUserProfile();
  const router = useRouter();
  const { app } = useFirebase();
  const searchParams = useSearchParams();

  const schoolId = profile?.activeSchoolId;
  const tabFromUrl = searchParams.get("tab");
  const defaultTab = useMemo(() => {
    if (tabFromUrl === "config" || tabFromUrl === "delinquents") return tabFromUrl;
    return "payments";
  }, [tabFromUrl]);

  const getToken = async () => {
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  };

  useEffect(() => {
    if (!isReady) return;
    if (!profile) {
      router.push("/auth/pending-approval");
      return;
    }
    if (!isAdmin && !isPlayer) {
      router.push("/dashboard");
      return;
    }
  }, [isReady, profile, isAdmin, isPlayer, router]);

  if (!isReady || !profile) {
    return <div className="p-8">Cargando…</div>;
  }

  if (isPlayer) {
    return (
      <div className="p-4 md:p-6">
        <PlayerPaymentsView getToken={getToken} />
      </div>
    );
  }

  if (!schoolId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
          <CardDescription>Seleccioná una escuela para gestionar pagos</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight font-headline sm:text-3xl">Pagos y Morosidad</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Gestioná cuotas, pagos ingresados y morosos de tu escuela
          </p>
        </div>
        <Link
          href="/dashboard/payments/test"
          className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:underline shrink-0"
        >
          <FlaskConical className="mr-1 h-4 w-4" />
          Pruebas de pagos
        </Link>
      </div>

      <Tabs defaultValue={defaultTab} key={tabFromUrl ?? "payments"}>
        <TabsList className="w-full grid grid-cols-3 gap-1 p-1 h-auto md:h-10 bg-card">
          <TabsTrigger value="payments" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 md:gap-2">
            <Banknote className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Pagos ingresados</span>
            <span className="sm:hidden truncate">Pagos</span>
          </TabsTrigger>
          <TabsTrigger value="delinquents" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 md:gap-2">
            <AlertTriangle className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
            <span className="truncate">Morosos</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 md:gap-2">
            <Settings className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Configuración</span>
            <span className="sm:hidden truncate">Config</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="payments">
          <PaymentsTab schoolId={schoolId} getToken={getToken} />
        </TabsContent>
        <TabsContent value="delinquents">
          <DelinquentsTab schoolId={schoolId} getToken={getToken} />
        </TabsContent>
        <TabsContent value="config">
          <PaymentConfigTab schoolId={schoolId} getToken={getToken} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
