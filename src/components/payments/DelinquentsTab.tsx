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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, ExternalLink } from "lucide-react";
import type { DelinquentInfo } from "@/lib/types";

const REGISTRATION_PERIOD = "inscripcion";

function formatPeriodLabel(period: string): string {
  if (period === REGISTRATION_PERIOD) return "Inscripción";
  if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period;
  const [y, m] = period.split("-");
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return format(date, "MMMM yyyy", { locale: es });
}

interface DelinquentsTabProps {
  schoolId: string;
  getToken: () => Promise<string | null>;
}

export function DelinquentsTab({ schoolId, getToken }: DelinquentsTabProps) {
  const [delinquents, setDelinquents] = useState<DelinquentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualDialog, setManualDialog] = useState<DelinquentInfo | null>(null);
  const [manualAmount, setManualAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchDelinquents = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/payments/delinquents?schoolId=${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar morosos");
      const data = await res.json();
      setDelinquents(
        data.delinquents.map((d: DelinquentInfo & { dueDate: string }) => ({
          ...d,
          dueDate: new Date(d.dueDate),
        }))
      );
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudieron cargar los morosos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [schoolId, getToken, toast]);

  useEffect(() => {
    fetchDelinquents();
  }, [fetchDelinquents]);

  const handleCreateIntent = async (d: DelinquentInfo) => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: "mercadopago",
          playerId: d.playerId,
          schoolId: d.schoolId,
          period: d.period,
          amount: d.amount,
          currency: d.currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear link");
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
      }
    } catch (e) {
      toast({ title: "Error", description: "No se pudo generar el link de pago", variant: "destructive" });
    }
  };

  const handleMarkManual = async () => {
    if (!manualDialog) return;
    const amount = parseFloat(manualAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Monto inválido", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/payments/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          playerId: manualDialog.playerId,
          schoolId: manualDialog.schoolId,
          period: manualDialog.period,
          amount,
          currency: manualDialog.currency,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al registrar");
      }
      toast({ title: "Listo", description: "Pago registrado correctamente" });
      setManualDialog(null);
      setManualAmount("");
      fetchDelinquents();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Error al registrar pago",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : delinquents.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-8 text-center text-muted-foreground">
          No hay morosos en esta escuela
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jugador</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Días mora</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {delinquents.map((d) => (
                <TableRow key={`${d.playerId}-${d.period}`}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{d.playerName}</p>
                      {d.playerEmail && (
                        <p className="text-xs text-muted-foreground">{d.playerEmail}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatPeriodLabel(d.period)}</TableCell>
                  <TableCell>
                    <span className={d.daysOverdue >= 30 ? "font-semibold text-destructive" : ""}>
                      {d.daysOverdue} días
                    </span>
                  </TableCell>
                  <TableCell>
                    {d.currency} {d.amount.toLocaleString("es-AR")}
                    {d.isProrated && (
                      <span className="ml-1 text-xs text-muted-foreground">(prorrata mes ingreso)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.status === "suspended" ? "destructive" : "secondary"}>
                      {d.status === "suspended" ? "Suspendido" : "En mora"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCreateIntent(d)}
                      >
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Link de pago
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setManualDialog(d);
                          setManualAmount(String(d.amount));
                        }}
                      >
                        Pago manual
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!manualDialog} onOpenChange={() => setManualDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar pago manual</DialogTitle>
            <DialogDescription>
              Registrar un pago realizado fuera del sistema para {manualDialog?.playerName} -
              período {manualDialog?.period}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="amount">Monto</Label>
              <Input
                id="amount"
                type="number"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleMarkManual} disabled={submitting}>
              {submitting ? "Guardando…" : "Registrar pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
