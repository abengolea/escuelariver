"use client";

import { useUserProfile, useFirebase } from "@/firebase";
import { getAuth } from "firebase/auth";
import { useCallback } from "react";
import { TrainingSchedulesPanel } from "@/components/training/TrainingSchedulesPanel";
import { Dumbbell } from "lucide-react";

export default function TrainingSchedulesPage() {
  const { profile, isReady } = useUserProfile();
  const { app } = useFirebase();

  const getToken = useCallback(async () => {
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }, [app]);

  if (!isReady) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Horarios de entrenamiento
        </h1>
        <p className="text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  if (!profile?.activeSchoolId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Horarios de entrenamiento
        </h1>
        <p className="text-muted-foreground">
          No tenés una escuela seleccionada. Elegí una sede en Ajustes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <div className="flex items-center gap-3">
        <Dumbbell className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Horarios de entrenamiento
          </h1>
          <p className="text-muted-foreground">
            Definí cuotas, categorías y entrenador asignado por día. Usá el rango de categorías para
            agrupar de SUB-X a SUB-Y sin marcar una por una.
          </p>
        </div>
      </div>
      <TrainingSchedulesPanel schoolId={profile.activeSchoolId} getToken={getToken} />
    </div>
  );
}
