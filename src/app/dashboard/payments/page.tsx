"use client";

import { useUserProfile, useFirebase } from "@/firebase";
import { getAuth } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
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

  const schoolId = profile?.activeSchoolId;

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
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Pagos y Morosidad</h1>
          <p className="text-muted-foreground">
            Gestioná cuotas, pagos ingresados y morosos de tu escuela
          </p>
        </div>
        <Link
          href="/dashboard/payments/test"
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <FlaskConical className="mr-1 h-4 w-4" />
          Pruebas de pagos
        </Link>
      </div>

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">
            <Banknote className="mr-2 h-4 w-4" />
            Pagos ingresados
          </TabsTrigger>
          <TabsTrigger value="delinquents">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Morosos
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="mr-2 h-4 w-4" />
            Configuración
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
