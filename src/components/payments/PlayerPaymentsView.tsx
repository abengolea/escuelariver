"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle, History, Loader2, CreditCard } from "lucide-react";
import type { Payment } from "@/lib/types/payments";
import type { DelinquentInfo } from "@/lib/types/payments";

const STATUS_LABELS: Record<string, string> = {
  approved: "Aprobado",
  pending: "Pendiente",
  rejected: "Rechazado",
  refunded: "Reembolsado",
};

const PROVIDER_LABELS: Record<string, string> = {
  mercadopago: "MercadoPago",
  dlocal: "DLocal",
  manual: "Manual",
};

const REGISTRATION_PERIOD = "inscripcion";

function formatPeriodDisplay(period: string): string {
  if (period === REGISTRATION_PERIOD) return "Inscripción";
  if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period;
  const [y, m] = period.split("-");
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  const monthName = format(date, "MMMM", { locale: es }).toUpperCase();
  return `${monthName}-${y}`;
}

type PaymentRow = Payment & { paidAt?: string; createdAt: string };

interface PlayerPaymentsViewProps {
  getToken: () => Promise<string | null>;
}

export function PlayerPaymentsView({ getToken }: PlayerPaymentsViewProps) {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [delinquent, setDelinquent] = useState<(DelinquentInfo & { dueDate: string }) | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [suggestedPeriod, setSuggestedPeriod] = useState<string>("");
  const [suggestedAmount, setSuggestedAmount] = useState<number>(0);
  const [suggestedCurrency, setSuggestedCurrency] = useState<string>("ARS");
  const [loading, setLoading] = useState(true);
  const [indexBuilding, setIndexBuilding] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [paying, setPaying] = useState(false);
  const [showRegistrationDialog, setShowRegistrationDialog] = useState(false);
  const [showAlDiaDialog, setShowAlDiaDialog] = useState(false);
  const [showRetryPrompt, setShowRetryPrompt] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { toast } = useToast();

  const hasRegistrationPending = delinquent?.period === REGISTRATION_PERIOD;

  // Si la carga tarda más de 8 segundos, mostrar opción de reintentar
  useEffect(() => {
    if (!loading) {
      setShowRetryPrompt(false);
      return;
    }
    const t = setTimeout(() => setShowRetryPrompt(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  const fetchData = useCallback(async (isRetry = false) => {
    if (!isRetry) setLoading(true);
    setFetchError(null);
    setIndexBuilding(false);
    const token = await getToken();
    if (!token) {
      setLoading(false);
      toast({
        title: "Sesión expirada",
        description: "Volvé a iniciar sesión para ver tus pagos.",
        variant: "destructive",
      });
      return;
    }
    try {
      const res = await fetch("/api/payments/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503 && body.code === "INDEX_BUILDING") {
          setIndexBuilding(true);
          setPayments([]);
          setDelinquent(null);
          return;
        }
        const msg = body.error ?? "Error al cargar tus pagos";
        const detail = body.detail;
        toast({
          title: "Error",
          description: detail ? `${msg}. ${detail}` : msg,
          variant: "destructive",
        });
        setPayments([]);
        setDelinquent(null);
        return;
      }
      setIndexBuilding(false);
      setPayments(body.payments ?? []);
      setDelinquent(body.delinquent ?? null);
      setSchoolId(body.schoolId ?? null);
      setPlayerId(body.playerId ?? null);
      setSuggestedPeriod(body.suggestedPeriod ?? "");
      setSuggestedAmount(body.suggestedAmount ?? 0);
      setSuggestedCurrency(body.suggestedCurrency ?? "ARS");
    } catch (e) {
      console.error(e);
      const isNetworkError =
        e instanceof TypeError && e.message === "Failed to fetch";
      const message = isNetworkError
        ? "No se pudo conectar. Verificá tu conexión a internet e intentá de nuevo."
        : e instanceof Error
          ? e.message
          : "No se pudieron cargar tus pagos";
      setFetchError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      setPayments([]);
      setDelinquent(null);
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [getToken, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Pop-up de inscripción: se abre cuando el sistema detecta inscripción pendiente
  useEffect(() => {
    if (!loading && delinquent?.period === REGISTRATION_PERIOD) {
      setShowRegistrationDialog(true);
    }
  }, [loading, delinquent?.period]);

  const handlePayCuota = useCallback(
    async (onSuccess?: () => void) => {
      const token = await getToken();
      if (!token || !schoolId || !playerId) {
        toast({ title: "Error", description: "No se pudo iniciar el pago.", variant: "destructive" });
        return;
      }
      const period = delinquent ? delinquent.period : suggestedPeriod;
      const amount = delinquent ? delinquent.amount : suggestedAmount;
      const currency = delinquent ? delinquent.currency : suggestedCurrency;
      if (amount <= 0) {
        toast({
          title: "Sin monto configurado",
          description: "Tu escuela aún no tiene cuotas configuradas. Contactá a la administración.",
          variant: "destructive",
        });
        return;
      }
      setPaying(true);
      try {
        const res = await fetch("/api/payments/intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            provider: "mercadopago",
            playerId,
            schoolId,
            period,
            amount,
            currency,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // 409 = ya está al día (no es error, es confirmación positiva)
          if (res.status === 409) {
            setShowAlDiaDialog(true);
            fetchData(true);
            return;
          }
          toast({
            title: "Error",
            description: data.error ?? "No se pudo generar el link de pago.",
            variant: "destructive",
          });
          return;
        }
        if (data.checkoutUrl) {
          window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
          toast({
            title: "Link generado",
            description: "Se abrió la ventana de pago. Si no se abrió, revisá el bloqueador de ventanas.",
          });
          onSuccess?.();
        }
      } catch (e) {
        toast({
          title: "Error",
          description: e instanceof Error ? e.message : "No se pudo iniciar el pago.",
          variant: "destructive",
        });
      } finally {
        setPaying(false);
      }
    },
    [getToken, schoolId, playerId, delinquent, suggestedPeriod, suggestedAmount, suggestedCurrency, toast, fetchData]
  );

  if (loading && !indexBuilding) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Mis pagos</h1>
          <p className="text-muted-foreground mt-1">Cargando tus pagos…</p>
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        {showRetryPrompt && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">La carga está tardando más de lo habitual.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRetrying(true);
                fetchData(true);
              }}
              disabled={retrying}
            >
              {retrying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reintentar
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Mis pagos</h1>
          <p className="text-muted-foreground">
            Historial de cuotas y estado de tu cuenta
          </p>
        </div>
        <Alert variant="destructive" className="border-destructive/50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error al cargar</AlertTitle>
          <AlertDescription>
            {fetchError}
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={retrying}
                onClick={() => {
                  setRetrying(true);
                  setFetchError(null);
                  fetchData(true);
                }}
              >
                {retrying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Reintentar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (indexBuilding) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Mis pagos</h1>
          <p className="text-muted-foreground">
            Historial de cuotas y estado de tu cuenta
          </p>
        </div>
        <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30">
          <History className="h-4 w-4" />
          <AlertTitle>Preparando tu historial</AlertTitle>
          <AlertDescription>
            Tu historial de pagos se está preparando. Puede tardar unos minutos. Probá de nuevo en un rato.
          </AlertDescription>
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={retrying}
              onClick={() => {
                setRetrying(true);
                fetchData(true);
              }}
            >
              {retrying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reintentar
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Mis pagos</h1>
          <p className="text-muted-foreground">
            Historial de cuotas y estado de tu cuenta
          </p>
        </div>
        <div className="shrink-0">
          <Button
            variant="destructive"
            size="sm"
            className="gap-2 font-headline"
            disabled={paying || (suggestedAmount <= 0 && !delinquent)}
            onClick={() => handlePayCuota()}
          >
            {paying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
            {hasRegistrationPending ? "Pagar inscripción" : "Pagar cuota"}
          </Button>
        </div>
      </div>

      {/* Estado actual: al día o cuota vencida */}
      {delinquent ? (
        <Alert variant="destructive" className="border-destructive/50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {delinquent.period === REGISTRATION_PERIOD ? "Inscripción pendiente" : "Cuota vencida"}
          </AlertTitle>
          <AlertDescription>
            Tenés {delinquent.period === REGISTRATION_PERIOD ? "el derecho de inscripción" : "una cuota"} pendiente: <strong>{formatPeriodDisplay(delinquent.period)}</strong>.
            Vencimiento: {format(new Date(delinquent.dueDate), "d 'de' MMMM yyyy", { locale: es })}.
            {delinquent.daysOverdue > 0 && (
              <> ({delinquent.daysOverdue} {delinquent.daysOverdue === 1 ? "día" : "días"} de demora)</>
            )}
            {" "}
            Monto: {delinquent.currency} {delinquent.amount.toLocaleString("es-AR")}.
            Podés pagar online con el botón de arriba.
            {hasRegistrationPending && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-destructive/50 hover:bg-destructive/10"
                onClick={() => setShowRegistrationDialog(true)}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Pagar inscripción
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200 text-lg">
              <CheckCircle className="h-5 w-5" />
              Al día
            </CardTitle>
            <CardDescription>
              No tenés cuotas vencidas. Tu cuenta está al día.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Pop-up cuando ya está al día */}
      <Dialog open={showAlDiaDialog} onOpenChange={setShowAlDiaDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              ¡Estás al día!
            </DialogTitle>
            <DialogDescription>
              No tenés pagos pendientes. Tu cuenta está en orden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowAlDiaDialog(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pop-up de inscripción pendiente */}
      <Dialog open={showRegistrationDialog && hasRegistrationPending} onOpenChange={setShowRegistrationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Pagá la inscripción
            </DialogTitle>
            <DialogDescription>
              {delinquent && (
                <>
                  Tenés el derecho de inscripción pendiente. Monto a abonar:{" "}
                  <strong className="text-foreground">
                    {delinquent.currency} {delinquent.amount.toLocaleString("es-AR")}
                  </strong>
                  .
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => handlePayCuota(() => setShowRegistrationDialog(false))}
              disabled={paying}
              className="w-full"
            >
              {paying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Pagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Historial de pagos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de pagos
          </CardTitle>
          <CardDescription>
            Cuotas que ya fueron abonadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">
              Aún no hay pagos registrados.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 rounded-md border">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Período</TableHead>
                    <TableHead className="text-xs sm:text-sm">Monto</TableHead>
                    <TableHead className="text-xs sm:text-sm">Estado</TableHead>
                    <TableHead className="text-xs sm:text-sm whitespace-nowrap">Fecha de pago</TableHead>
                    <TableHead className="text-xs sm:text-sm">Medio</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {formatPeriodDisplay(p.period)}
                    </TableCell>
                    <TableCell>
                      {p.currency} {p.amount.toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}
                      >
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.paidAt
                        ? format(new Date(p.paidAt), "d/MM/yyyy", { locale: es })
                        : p.createdAt
                          ? format(new Date(p.createdAt), "d/MM/yyyy", { locale: es })
                          : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {PROVIDER_LABELS[p.provider] ?? p.provider}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )
          }
        </CardContent>
      </Card>
    </div>
  );
}
