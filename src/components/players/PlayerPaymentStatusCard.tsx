"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, CreditCard } from "lucide-react";
import Link from "next/link";
import type { DelinquentInfo } from "@/lib/types/payments";

const REGISTRATION_PERIOD = "inscripcion";

interface PlayerPaymentStatusCardProps {
  getToken: () => Promise<string | null>;
  /** Cuando el admin ve el perfil: playerId y schoolId para consultar morosos. */
  playerId?: string;
  schoolId?: string;
}

export function PlayerPaymentStatusCard({ getToken, playerId: propPlayerId, schoolId: propSchoolId }: PlayerPaymentStatusCardProps) {
  const [loading, setLoading] = useState(true);
  const [delinquent, setDelinquent] = useState<(DelinquentInfo & { dueDate?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdminView = Boolean(propPlayerId && propSchoolId);

  const fetchStatus = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      if (isAdminView) {
        const res = await fetch(`/api/payments/delinquents?schoolId=${encodeURIComponent(propSchoolId!)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error ?? "Error al cargar");
          setDelinquent(null);
          return;
        }
        const playerDelinquent = (body.delinquents ?? []).find(
          (d: DelinquentInfo) => d.playerId === propPlayerId
        ) ?? null;
        setDelinquent(playerDelinquent ? { ...playerDelinquent, dueDate: (playerDelinquent as { dueDate?: string }).dueDate } : null);
      } else {
        const res = await fetch("/api/payments/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error ?? "Error al cargar");
          setDelinquent(null);
          return;
        }
        setDelinquent(body.delinquent ?? null);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setDelinquent(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, isAdminView, propPlayerId, propSchoolId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Pagos</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasRegistrationPending = delinquent?.period === REGISTRATION_PERIOD;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Pagos
        </CardTitle>
        <CardDescription>
          {delinquent ? (
            isAdminView ? (
              hasRegistrationPending ? (
                <>Inscripción pendiente.</>
              ) : (
                <>Cuota pendiente.</>
              )
            ) : hasRegistrationPending ? (
              <>Tenés el derecho de inscripción pendiente.</>
            ) : (
              <>Tenés una cuota pendiente.</>
            )
          ) : (
            isAdminView ? (
              <>Al día con pagos.</>
            ) : (
              <>Estado de tus cuotas e inscripción.</>
            )
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {delinquent ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="font-medium">
                {hasRegistrationPending ? "Inscripción pendiente" : "Cuota pendiente"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Monto: {delinquent.currency} {delinquent.amount.toLocaleString("es-AR")}
            </p>
            <Button asChild className="w-full sm:w-auto">
              <Link href={isAdminView ? "/dashboard/payments?tab=delinquents" : "/dashboard/payments"}>
                <CreditCard className="h-4 w-4 mr-2" />
                {isAdminView
                  ? "Ver en Pagos"
                  : hasRegistrationPending
                    ? "Pagar inscripción"
                    : "Pagar cuota"}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle className="h-5 w-5 shrink-0" />
            <span className="font-medium">Al día</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
