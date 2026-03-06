"use client";

import { useUserProfile, useFirebase } from "@/firebase";
import { getAuth } from "firebase/auth";
import { useCallback } from "react";
import { AttendanceSheet } from "@/components/attendance/AttendanceSheet";
import { ClipboardCheck } from "lucide-react";

export default function AttendancePage() {
  const { activeSchoolId, isReady } = useUserProfile();
  const { app } = useFirebase();

  const getToken = useCallback(async () => {
    if (!app) return null;
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }, [app]);

  if (!isReady) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Planilla de asistencia
        </h1>
        <p className="text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  if (!activeSchoolId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Planilla de asistencia
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
        <ClipboardCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Planilla de asistencia
          </h1>
          <p className="text-muted-foreground">
            Marcá los jugadores que faltaron al entrenamiento.
          </p>
        </div>
      </div>
      <AttendanceSheet schoolId={activeSchoolId} getToken={getToken} />
    </div>
  );
}
