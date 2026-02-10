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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCollection } from "@/firebase";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Banknote } from "lucide-react";
import type { Payment, Player } from "@/lib/types";

/** Pago con nombre de jugador enriquecido por la API */
type PaymentWithPlayerName = Payment & { playerName?: string };

interface PaymentsTabProps {
  schoolId: string;
  getToken: () => Promise<string | null>;
}

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

/** Convierte "2026-02" → "FEBRERO-2026", "inscripcion" → "Inscripción" */
function formatPeriodDisplay(period: string): string {
  if (period === REGISTRATION_PERIOD) return "Inscripción";
  if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period;
  const [y, m] = period.split("-");
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  const monthName = format(date, "MMMM", { locale: es }).toUpperCase();
  return `${monthName}-${y}`;
}

const MONTHS: { value: string; label: string }[] = [
  { value: "01", label: "Enero" }, { value: "02", label: "Febrero" }, { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" }, { value: "05", label: "Mayo" }, { value: "06", label: "Junio" },
  { value: "07", label: "Julio" }, { value: "08", label: "Agosto" }, { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" }, { value: "11", label: "Noviembre" }, { value: "12", label: "Diciembre" },
];

const currentPeriod = () =>
  `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

/** Años desde 2026 en adelante (y los próximos años) */
function getYears(): number[] {
  const current = new Date().getFullYear();
  const start = 2026;
  const end = Math.max(current + 2, start + 2);
  const years: number[] = [];
  for (let y = end; y >= start; y--) {
    years.push(y);
  }
  return years;
}

export function PaymentsTab({ schoolId, getToken }: PaymentsTabProps) {
  const [payments, setPayments] = useState<PaymentWithPlayerName[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    period: "",
    status: "",
    provider: "",
  });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPlayerId, setManualPlayerId] = useState("");
  const [manualPaymentType, setManualPaymentType] = useState<"monthly" | "registration">("monthly");
  const [manualPeriod, setManualPeriod] = useState(currentPeriod());
  const [manualAmount, setManualAmount] = useState("15000");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [configRegistrationAmount, setConfigRegistrationAmount] = useState(0);
  const { toast } = useToast();

  const { data: players } = useCollection<Player>(
    schoolId ? `schools/${schoolId}/players` : "",
    { orderBy: ["lastName", "asc"] }
  );

  const fetchConfig = useCallback(async () => {
    const token = await getToken();
    if (!token || !schoolId) return;
    try {
      const res = await fetch(`/api/payments/config?schoolId=${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConfigRegistrationAmount(Number(data.registrationAmount) || 0);
      }
    } catch {
      // ignore
    }
  }, [schoolId, getToken]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) return;
    const params = new URLSearchParams({ schoolId });
    if (filters.period) params.set("period", filters.period);
    if (filters.status) params.set("status", filters.status);
    if (filters.provider) params.set("provider", filters.provider);
    try {
      const res = await fetch(`/api/payments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? data.error ?? "Error al cargar pagos");
      }
      const data = await res.json();
      setPayments(
        data.payments.map((p: PaymentWithPlayerName & { paidAt?: string; createdAt?: string }) => ({
          ...p,
          paidAt: p.paidAt ? new Date(p.paidAt) : undefined,
          createdAt: new Date(p.createdAt!),
        }))
      );
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [schoolId, filters.period, filters.status, filters.provider, getToken]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleManualPayment = async () => {
    const amount = parseFloat(manualAmount);
    const period = manualPaymentType === "registration" ? REGISTRATION_PERIOD : manualPeriod;
    if (!manualPlayerId || Number.isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Completá jugador y monto válido." });
      return;
    }
    if (manualPaymentType === "monthly" && !manualPeriod) {
      toast({ variant: "destructive", title: "Completá el período para la cuota mensual." });
      return;
    }
    setManualSubmitting(true);
    const token = await getToken();
    if (!token) {
      toast({ variant: "destructive", title: "No se pudo obtener sesión." });
      setManualSubmitting(false);
      return;
    }
    try {
      const res = await fetch("/api/payments/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          playerId: manualPlayerId,
          schoolId,
          period,
          amount,
          currency: "ARS",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Error al registrar pago");
      }
      toast({ title: "Pago registrado correctamente." });
      setManualOpen(false);
      setManualPlayerId("");
      setManualPaymentType("monthly");
      setManualPeriod(currentPeriod());
      setManualAmount("15000");
      fetchPayments();
    } catch (e) {
      toast({
        variant: "destructive",
        title: e instanceof Error ? e.message : "Error al registrar pago",
      });
    } finally {
      setManualSubmitting(false);
    }
  };

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
  const isInCurrentMonth = (p: Payment) => {
    const date = p.paidAt ?? p.createdAt;
    const ts = date.getTime();
    return ts >= currentMonthStart && ts <= currentMonthEnd;
  };
  const approvedInList = payments.filter((p) => p.status === "approved");
  const totalInList = approvedInList.reduce((s, p) => s + p.amount, 0);
  const approvedThisMonth = approvedInList.filter(isInCurrentMonth);
  const totalThisMonth = approvedThisMonth.reduce((s, p) => s + p.amount, 0);
  const currentMonthLabel = formatPeriodDisplay(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );

  const filterMonth = filters.period ? filters.period.slice(5, 7) : "all";
  const filterYear = filters.period ? filters.period.slice(0, 4) : "all";
  const setPeriodFromMonthYear = (month: string, year: string) => {
    if (month === "all" || year === "all" || !month || !year) {
      setFilters((f) => ({ ...f, period: "" }));
      return;
    }
    setFilters((f) => ({ ...f, period: `${year}-${month}` }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setManualOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <Banknote className="mr-2 h-4 w-4" />
          Registrar pago manual
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pagos aprobados en lista</p>
          <p className="text-2xl font-bold">{approvedInList.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total en lista</p>
          <p className="text-2xl font-bold">ARS {totalInList.toLocaleString("es-AR")}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Mes en curso ({currentMonthLabel})</p>
          <p className="text-2xl font-bold">{approvedThisMonth.length} pagos</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total mes en curso</p>
          <p className="text-2xl font-bold">ARS {totalThisMonth.toLocaleString("es-AR")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filterMonth}
          onValueChange={(v) =>
            setPeriodFromMonthYear(v, filterYear === "all" ? String(new Date().getFullYear()) : filterYear)
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterYear}
          onValueChange={(v) =>
            setPeriodFromMonthYear(
              filterMonth === "all" ? String(new Date().getMonth() + 1).padStart(2, "0") : filterMonth,
              v
            )
          }
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {getYears().map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.provider}
          onValueChange={(v) => setFilters((f) => ({ ...f, provider: v }))}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Proveedor" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-md border min-w-0">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">Período</TableHead>
                <TableHead className="text-xs sm:text-sm">Jugador</TableHead>
                <TableHead className="text-xs sm:text-sm">Monto</TableHead>
                <TableHead className="text-xs sm:text-sm">Proveedor</TableHead>
                <TableHead className="text-xs sm:text-sm">Estado</TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay pagos para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatPeriodDisplay(p.period)}</TableCell>
                    <TableCell>{p.playerName ?? p.playerId}</TableCell>
                    <TableCell>
                      {p.currency} {p.amount.toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell>
                      {p.provider === "manual"
                        ? (p.metadata as { collectedByDisplayName?: string; collectedByEmail?: string } | undefined)
                            ?.collectedByDisplayName ||
                          (p.metadata as { collectedByEmail?: string } | undefined)?.collectedByEmail ||
                          "Manual"
                        : PROVIDER_LABELS[p.provider] ?? p.provider}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === "approved"
                            ? "default"
                            : p.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.paidAt
                        ? format(p.paidAt, "dd/MM/yyyy HH:mm", { locale: es })
                        : format(p.createdAt, "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago manual</DialogTitle>
            <DialogDescription>
              Simulá o registrá un pago realizado fuera del sistema (efectivo, transferencia, etc.).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="manual-player">Jugador</Label>
              <Select value={manualPlayerId} onValueChange={setManualPlayerId}>
                <SelectTrigger id="manual-player" className="mt-1">
                  <SelectValue placeholder="Elegí un jugador" />
                </SelectTrigger>
                <SelectContent>
                  {(players ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {[p.firstName, p.lastName].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de pago</Label>
              <Select
                value={manualPaymentType}
                onValueChange={(v: "monthly" | "registration") => {
                  setManualPaymentType(v);
                  if (v === "registration") setManualAmount(String(configRegistrationAmount || ""));
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Cuota mensual</SelectItem>
                  <SelectItem value="registration">Inscripción</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {manualPaymentType === "monthly" && (
              <div>
                <Label htmlFor="manual-period">Período (YYYY-MM)</Label>
                <Input
                  id="manual-period"
                  value={manualPeriod}
                  onChange={(e) => setManualPeriod(e.target.value)}
                  placeholder="2026-02"
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <Label htmlFor="manual-amount">Monto (ARS)</Label>
              <Input
                id="manual-amount"
                type="number"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder={manualPaymentType === "registration" ? String(configRegistrationAmount || "0") : "15000"}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleManualPayment} disabled={manualSubmitting}>
              {manualSubmitting ? "Guardando…" : "Registrar pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
