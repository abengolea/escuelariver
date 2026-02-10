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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Banknote, AlertTriangle, CheckCircle, History, Loader2, CreditCard, ChevronDown } from "lucide-react";
import type { Payment } from "@/lib/types/payments";
import type { DelinquentInfo } from "@/lib/types/payments";

type PaymentProviderOption = "mercadopago" | "dlocal";

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
  const [payingProvider, setPayingProvider] = useState<PaymentProviderOption | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async (isRetry = false) => {
    if (!isRetry) setLoading(true);
    setIndexBuilding(false);
    const token = await getToken();
    if (!token) {
      setLoading(false);
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
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudieron cargar tus pagos",
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

  const handlePayCuota = useCallback(
    async (provider: PaymentProviderOption) => {
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
      setPayingProvider(provider);
      try {
        const res = await fetch("/api/payments/intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            provider,
            playerId,
            schoolId,
            period,
            amount,
            currency,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
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
        }
      } catch (e) {
        toast({
          title: "Error",
          description: e instanceof Error ? e.message : "No se pudo iniciar el pago.",
          variant: "destructive",
        });
      } finally {
        setPayingProvider(null);
      }
    },
    [getToken, schoolId, playerId, delinquent, suggestedPeriod, suggestedAmount, suggestedCurrency, toast]
  );

  if (loading && !indexBuilding) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="gap-2 font-headline"
                disabled={payingProvider != null || (suggestedAmount <= 0 && !delinquent)}
              >
                {payingProvider ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Pagar cuota
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handlePayCuota("mercadopago")}
                disabled={payingProvider != null}
              >
                Mercado Pago
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handlePayCuota("dlocal")}
                disabled={payingProvider != null}
              >
                DLocal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            Contactá a tu escuela para regularizar el pago.
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha de pago</TableHead>
                  <TableHead>Medio</TableHead>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
