"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, CreditCard, ExternalLink, Shirt } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import type { DelinquentInfo } from "@/lib/types/payments";

const REGISTRATION_PERIOD = "inscripcion";

type ClothingPendingItem = { period: string; amount: number; installmentIndex: number; totalInstallments: number };

function formatPeriodLabel(period: string): string {
  if (period === REGISTRATION_PERIOD) return "Inscripción";
  if (period?.startsWith?.("ropa-")) return `Ropa (cuota ${period.replace("ropa-", "")})`;
  if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period;
  const [y, m] = period.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

interface PlayerPaymentStatusCardProps {
  getToken: () => Promise<string | null>;
  /** Cuando el admin ve el perfil: playerId y schoolId para consultar morosos. */
  playerId?: string;
  schoolId?: string;
}

export function PlayerPaymentStatusCard({ getToken, playerId: propPlayerId, schoolId: propSchoolId }: PlayerPaymentStatusCardProps) {
  const [loading, setLoading] = useState(true);
  const [delinquents, setDelinquents] = useState<(DelinquentInfo & { dueDate?: string })[]>([]);
  const [clothingPending, setClothingPending] = useState<ClothingPendingItem[]>([]);
  const [suggestedCurrency, setSuggestedCurrency] = useState("ARS");
  const [error, setError] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const { toast } = useToast();

  const isAdminView = Boolean(propPlayerId && propSchoolId);

  const fetchStatus = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      if (isAdminView) {
        const [delRes, clothRes] = await Promise.all([
          fetch(`/api/payments/delinquents?schoolId=${encodeURIComponent(propSchoolId!)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          propPlayerId && propSchoolId
            ? fetch(`/api/payments/clothing-pending?schoolId=${encodeURIComponent(propSchoolId)}&playerId=${encodeURIComponent(propPlayerId)}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
            : Promise.resolve(null),
        ]);
        const delBody = await delRes.json().catch(() => ({}));
        if (!delRes.ok) {
          setError(delBody.error ?? "Error al cargar");
          setDelinquents([]);
          setClothingPending([]);
          return;
        }
        const playerDelinquents = (delBody.delinquents ?? []).filter(
          (d: DelinquentInfo) => d.playerId === propPlayerId
        );

        if (clothRes) {
          const clothBody = await clothRes.json().catch(() => ({}));
          const clothing = clothBody.clothingPending ?? [];
          setClothingPending(clothing);
          if (clothBody.currency) setSuggestedCurrency(clothBody.currency);
          // Excluir ropa de delinquents cuando clothing-pending las trae: evita duplicados.
          const withoutRopa =
            clothing.length > 0
              ? playerDelinquents.filter((d: DelinquentInfo) => !d.period?.startsWith?.("ropa-"))
              : playerDelinquents;
          setDelinquents(withoutRopa);
        } else {
          setClothingPending([]);
          setDelinquents(playerDelinquents);
        }
      } else {
        const res = await fetch("/api/payments/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error ?? "Error al cargar");
          setDelinquents([]);
          setClothingPending([]);
          return;
        }
        const clothing = body.clothingPending ?? [];
        setClothingPending(clothing);
        setSuggestedCurrency(body.suggestedCurrency ?? "ARS");
        const rawDelinquents: (DelinquentInfo & { dueDate?: string })[] =
          Array.isArray(body.delinquents) && body.delinquents.length > 0
            ? body.delinquents
            : body.delinquent
              ? [body.delinquent]
              : [];
        const withoutRopa =
          clothing.length > 0
            ? rawDelinquents.filter((d: DelinquentInfo) => !d.period?.startsWith?.("ropa-"))
            : rawDelinquents;
        setDelinquents(withoutRopa);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setDelinquents([]);
      setClothingPending([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, isAdminView, propPlayerId, propSchoolId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const allPending = [
    ...delinquents.map((d) => ({ type: "delinquent" as const, period: d.period, amount: d.amount, currency: d.currency })),
    ...clothingPending.map((c) => ({ type: "clothing" as const, period: c.period, amount: c.amount, currency: suggestedCurrency })),
  ];
  const firstPending = allPending[0];
  const hasPending = allPending.length > 0;

  const handleCreateLink = useCallback(async () => {
    if (!firstPending || !propPlayerId || !propSchoolId) return;
    const token = await getToken();
    if (!token) return;
    setCreatingLink(true);
    try {
      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: "mercadopago",
          playerId: propPlayerId,
          schoolId: propSchoolId,
          period: firstPending.period,
          amount: firstPending.amount,
          currency: firstPending.currency,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error al crear link");
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast({ title: "Link generado", description: "Se abrió la ventana de pago." });
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo generar el link de pago",
      });
    } finally {
      setCreatingLink(false);
    }
  }, [firstPending, propPlayerId, propSchoolId, getToken, toast]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {isAdminView ? "Pagos del jugador" : "Pagos"}
        </CardTitle>
        <CardDescription>
          {hasPending ? (
            isAdminView ? (
              <>Lo que debe este jugador: {[
                delinquents.some((d) => d.period === REGISTRATION_PERIOD) && "inscripción",
                delinquents.some((d) => d.period !== REGISTRATION_PERIOD && !d.period?.startsWith?.("ropa-")) && "cuota mensual",
                clothingPending.length > 0 && "ropa",
              ].filter(Boolean).join(", ")}.</>
            ) : (
              <>Tenés pagos pendientes.</>
            )
          ) : (
            isAdminView ? (
              <>Al día con pagos.</>
            ) : (
              <>Estado de tus cuotas, inscripción y ropa.</>
            )
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasPending ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="font-medium">Pagos pendientes</span>
            </div>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              {delinquents.map((d) => (
                <li key={d.period}>
                  {formatPeriodLabel(d.period)}: {d.currency} {d.amount.toLocaleString("es-AR")}
                </li>
              ))}
              {clothingPending.map((c) => (
                <li key={c.period}>
                  <span className="inline-flex items-center gap-1">
                    <Shirt className="h-3.5 w-3.5" />
                    Cuota {c.installmentIndex} de {c.totalInstallments}: {suggestedCurrency} {c.amount.toLocaleString("es-AR")}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {isAdminView ? (
                <Button onClick={handleCreateLink} disabled={creatingLink}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {creatingLink ? "Generando…" : "Crear link de pago"}
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/dashboard/payments">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pagar
                  </Link>
                </Button>
              )}
              {isAdminView && (
                <Button variant="outline" asChild>
                  <Link href="/dashboard/payments?tab=delinquents">Ver en Pagos</Link>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle className="h-5 w-5 shrink-0" />
            <span className="font-medium">Al día (inscripción, cuota y ropa)</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
