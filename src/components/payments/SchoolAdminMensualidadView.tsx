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
import { AlertTriangle, CheckCircle, History, Loader2, CreditCard } from "lucide-react";

type UnpaidItem = { period: string; dueDate: string; daysOverdue: number; amount: number; lateFee: number };
type PaymentRow = { id: string; period: string; amount: number; lateFeeAmount?: number; currency: string; status: string; provider: string; paidAt?: string };

function formatPeriodDisplay(period: string): string {
  if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period;
  const [y, m] = period.split("-");
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return format(date, "MMMM yyyy", { locale: es });
}

interface SchoolAdminMensualidadViewProps {
  schoolId: string;
  getToken: () => Promise<string | null>;
  /** Cuando cambia (ej. "success" al volver de MP), se refresca la lista */
  refreshTrigger?: string | null;
}

export function SchoolAdminMensualidadView({ schoolId, getToken, refreshTrigger }: SchoolAdminMensualidadViewProps) {
  const [status, setStatus] = useState<{
    isBonified: boolean;
    inDebt: boolean;
    totalDebt?: number;
    unpaid?: UnpaidItem[];
    showWarning: boolean;
    riskSuspension: boolean;
    message: string;
  } | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const [statusRes, paymentsRes] = await Promise.all([
        fetch(`/api/platform-fee/my-status?schoolId=${schoolId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/platform-fee/my-payments?schoolId=${schoolId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (statusRes.ok) {
        const d = await statusRes.json();
        setStatus(d);
      }
      if (paymentsRes.ok) {
        const p = await paymentsRes.json();
        setPayments(p.payments ?? []);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo cargar la información", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [schoolId, getToken, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (refreshTrigger === "success" || refreshTrigger === "pending") {
      const t = setTimeout(() => fetchData(), 2000);
      return () => clearTimeout(t);
    }
  }, [refreshTrigger, fetchData]);

  const handlePay = useCallback(
    async (period: string) => {
      const token = await getToken();
      if (!token) return;
      setPaying(period);
      try {
        const res = await fetch("/api/platform-fee/payment-link", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ schoolId, period }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 409) {
            toast({ title: "Ya está pagada", description: "Esta mensualidad ya fue registrada." });
            fetchData();
            return;
          }
          throw new Error(data.error ?? "No se pudo generar el link");
        }
        if (data.checkoutUrl) {
          window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
          toast({
            title: "Link generado",
            description: "Se abrió la ventana de pago. Si no se abrió, revisá el bloqueador de ventanas.",
          });
        } else {
          throw new Error("No se recibió el link de pago");
        }
      } catch (e) {
        toast({
          title: "Error",
          description: e instanceof Error ? e.message : "No se pudo iniciar el pago.",
          variant: "destructive",
        });
      } finally {
        setPaying(null);
      }
    },
    [schoolId, getToken, toast, fetchData]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">Cargando…</p>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (status?.isBonified) {
    return (
      <div className="space-y-6">
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200 text-lg">
              <CheckCircle className="h-5 w-5" />
              Escuela bonificada
            </CardTitle>
            <CardDescription>
              No tenés cuotas que pagar a la plataforma.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const firstUnpaid = status?.unpaid?.[0];
  const totalDebt = status?.totalDebt ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
        {status?.inDebt && firstUnpaid && (
          <div className="shrink-0">
            <Button
              variant="destructive"
              size="sm"
              className="gap-2 font-headline"
              disabled={!!paying}
              onClick={() => handlePay(firstUnpaid.period)}
            >
              {paying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Pagar mensualidad
            </Button>
          </div>
        )}
      </div>

      {/* Estado: al día o en mora */}
      {status?.inDebt ? (
        <Alert variant={status.riskSuspension ? "destructive" : "default"} className="border-destructive/50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Mensualidad pendiente</AlertTitle>
          <AlertDescription>
            <p className="mb-2">{status.message}</p>
            {status.unpaid && status.unpaid.length > 0 && (
              <div className="space-y-2 mt-3">
                <p className="text-sm font-medium">Cuotas pendientes:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {status.unpaid.map((u) => (
                    <li key={u.period}>
                      {formatPeriodDisplay(u.period)} — ${(u.amount + u.lateFee).toLocaleString("es-AR")}
                      {u.daysOverdue > 0 && (
                        <span className="text-muted-foreground ml-1">
                          ({u.daysOverdue} {u.daysOverdue === 1 ? "día" : "días"} de demora)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 mt-3">
                  {status.unpaid.map((u) => (
                    <Button
                      key={u.period}
                      size="sm"
                      variant="outline"
                      className="border-destructive/50 hover:bg-destructive/10"
                      disabled={!!paying}
                      onClick={() => handlePay(u.period)}
                    >
                      {paying === u.period ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      Pagar {formatPeriodDisplay(u.period)}
                    </Button>
                  ))}
                </div>
              </div>
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
              No tenés mensualidades pendientes. Tu escuela está al día con la plataforma.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Historial de pagos de la escuela a la plataforma */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de mensualidades
          </CardTitle>
          <CardDescription>
            Pagos que tu escuela realizó a la plataforma
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
                      <TableCell className="font-medium"> {formatPeriodDisplay(p.period)}</TableCell>
                      <TableCell>
                        ${(p.amount + (p.lateFeeAmount ?? 0)).toLocaleString("es-AR")} {p.currency}
                        {p.lateFeeAmount ? (
                          <span className="text-xs text-muted-foreground ml-1">(incluye mora)</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === "approved" ? "default" : "secondary"}>
                          {p.status === "approved" ? "Aprobado" : p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.paidAt ? format(new Date(p.paidAt), "d/MM/yyyy", { locale: es }) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.provider === "mercadopago" ? "Mercado Pago" : "Manual"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
