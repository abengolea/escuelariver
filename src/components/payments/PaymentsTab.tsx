"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCollection } from "@/firebase";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Banknote, Pencil, Download, ChevronDown, Search, Check } from "lucide-react";
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

/** Convierte "2026-02" → "FEBRERO-2026", "inscripcion" → "Inscripción", "ropa-1" → "Pago de ropa (1)" */
function formatPeriodDisplay(period: string): string {
  if (period === REGISTRATION_PERIOD) return "Inscripción";
  const ropaMatch = period.match(/^ropa-(\d+)$/);
  if (ropaMatch) return `Pago de ropa (${ropaMatch[1]})`;
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
    playerId: "",
    concept: "" as "" | "inscripcion" | "monthly" | "clothing",
    period: "",
    status: "",
    provider: "",
  });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPlayerId, setManualPlayerId] = useState("");
  const [manualPaymentType, setManualPaymentType] = useState<"monthly" | "registration" | "clothing">("monthly");
  const [manualPeriod, setManualPeriod] = useState(currentPeriod());
  const [manualClothingInstallment, setManualClothingInstallment] = useState("1");
  const [manualAmount, setManualAmount] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<PaymentWithPlayerName | null>(null);
  const [editNewPeriod, setEditNewPeriod] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [configRegistrationAmount, setConfigRegistrationAmount] = useState(0);
  const [configClothingAmount, setConfigClothingAmount] = useState(0);
  const [configClothingInstallments, setConfigClothingInstallments] = useState(2);
  const [clothingPendingForPlayer, setClothingPendingForPlayer] = useState<
    { period: string; amount: number; installmentIndex: number; totalInstallments: number }[]
  >([]);
  const [clothingConfigured, setClothingConfigured] = useState(false);
  const [clothingPendingLoading, setClothingPendingLoading] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [playerFilterPopoverOpen, setPlayerFilterPopoverOpen] = useState(false);
  const [playerFilterSearch, setPlayerFilterSearch] = useState("");
  const { toast } = useToast();

  const { data: players } = useCollection<Player>(
    schoolId ? `schools/${schoolId}/players` : "",
    { orderBy: ["lastName", "asc"] }
  );
  const activePlayers = useMemo(
    () => (players ?? []).filter((p) => !p.archived),
    [players]
  );

  const playersSortedByName = useMemo(
    () =>
      [...activePlayers].sort((a, b) => {
        const ln = (a.lastName ?? "").localeCompare(b.lastName ?? "", "es", { sensitivity: "base" });
        if (ln !== 0) return ln;
        return (a.firstName ?? "").localeCompare(b.firstName ?? "", "es", { sensitivity: "base" });
      }),
    [activePlayers]
  );

  const filteredPlayersForFilter = useMemo(() => {
    const q = playerFilterSearch.trim().toLowerCase();
    if (!q) return playersSortedByName;
    return playersSortedByName.filter((p) => {
      const fn = (p.firstName ?? "").toLowerCase();
      const ln = (p.lastName ?? "").toLowerCase();
      const full = `${fn} ${ln}`;
      const fullInv = `${ln} ${fn}`;
      return (
        full.includes(q) ||
        fullInv.includes(q) ||
        full.split(/\s+/).some((w) => w.startsWith(q))
      );
    });
  }, [playersSortedByName, playerFilterSearch]);

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
        setConfigClothingAmount(Number(data.clothingAmount) || 0);
        setConfigClothingInstallments(Math.max(1, Number(data.clothingInstallments) || 2));
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
    if (filters.playerId) {
      params.set("playerId", filters.playerId);
      /** Un solo jugador: traer suficientes filas para ver historial completo en pantalla */
      params.set("limit", "500");
    }
    if (filters.concept === "inscripcion") {
      params.set("concept", "inscripcion");
    } else if (filters.concept === "monthly" && filters.period) {
      params.set("concept", "monthly");
      params.set("period", filters.period);
    } else if (filters.concept === "clothing") {
      params.set("concept", "clothing");
    } else if (filters.period) {
      params.set("period", filters.period);
    }
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
      toast({
        variant: "destructive",
        title: "Error al cargar pagos",
        description: e instanceof Error ? e.message : "Revisá la consola para más detalles.",
      });
    } finally {
      setLoading(false);
    }
  }, [
    schoolId,
    filters.playerId,
    filters.concept,
    filters.period,
    filters.status,
    filters.provider,
    getToken,
  ]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Al seleccionar jugador + tipo ropa: chequear cuántas cuotas configuradas y cuáles pagadas
  const fetchClothingPending = useCallback(async () => {
    if (manualPaymentType !== "clothing" || !manualPlayerId || !schoolId) {
      setClothingPendingForPlayer([]);
      setClothingConfigured(false);
      return;
    }
    setClothingPendingLoading(true);
    const token = await getToken();
    if (!token) {
      setClothingPendingForPlayer([]);
      setClothingPendingLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/payments/clothing-pending?schoolId=${encodeURIComponent(schoolId)}&playerId=${encodeURIComponent(manualPlayerId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setClothingPendingForPlayer(data.clothingPending ?? []);
        setClothingConfigured(data.clothingConfigured ?? false);
      } else {
        setClothingPendingForPlayer([]);
        setClothingConfigured(false);
      }
    } catch {
      setClothingPendingForPlayer([]);
      setClothingConfigured(false);
    } finally {
      setClothingPendingLoading(false);
    }
  }, [manualPaymentType, manualPlayerId, schoolId, getToken]);

  useEffect(() => {
    fetchClothingPending();
  }, [fetchClothingPending]);

  // Cuota mensual: monto según config + jugador (género, categoría, prorrata del mes de alta)
  useEffect(() => {
    if (
      !manualOpen ||
      manualPaymentType !== "monthly" ||
      !manualPlayerId ||
      !manualPeriod ||
      !schoolId
    ) {
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(manualPeriod)) return;

    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      try {
        const res = await fetch(
          `/api/payments/expected-amount?schoolId=${encodeURIComponent(schoolId)}&playerId=${encodeURIComponent(manualPlayerId)}&period=${encodeURIComponent(manualPeriod)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { amount?: number };
        if (typeof data.amount === "number" && !Number.isNaN(data.amount) && !cancelled) {
          setManualAmount(String(data.amount));
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    manualOpen,
    manualPaymentType,
    manualPlayerId,
    manualPeriod,
    schoolId,
    getToken,
  ]);

  // Al cargar cuotas pendientes, seleccionar la primera y su monto
  useEffect(() => {
    if (manualPaymentType === "clothing" && clothingPendingForPlayer.length > 0) {
      const first = clothingPendingForPlayer[0];
      setManualClothingInstallment(String(first.installmentIndex));
      setManualAmount(String(first.amount));
    }
  }, [manualPaymentType, clothingPendingForPlayer]);

  const handleManualPayment = async () => {
    const amount = parseFloat(manualAmount);
    const period =
      manualPaymentType === "registration"
        ? REGISTRATION_PERIOD
        : manualPaymentType === "clothing"
          ? `ropa-${manualClothingInstallment}`
          : manualPeriod;
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
      setManualClothingInstallment("1");
      setManualAmount("");
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

  const openEditDialog = (p: PaymentWithPlayerName) => {
    setEditPayment(p);
    setEditNewPeriod(p.period === REGISTRATION_PERIOD ? currentPeriod() : p.period);
    setEditDialogOpen(true);
  };

  const handleEditPayment = async () => {
    if (!editPayment || !schoolId || !editNewPeriod) return;
    if (editPayment.period === editNewPeriod) {
      setEditDialogOpen(false);
      return;
    }
    setEditSubmitting(true);
    const token = await getToken();
    if (!token) {
      toast({ variant: "destructive", title: "No se pudo obtener sesión." });
      setEditSubmitting(false);
      return;
    }
    try {
      const res = await fetch("/api/payments/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentId: editPayment.id,
          schoolId,
          newPeriod: editNewPeriod,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Error al actualizar");
      }
      toast({ title: "Pago actualizado correctamente." });
      setEditDialogOpen(false);
      setEditPayment(null);
      fetchPayments();
    } catch (e) {
      toast({
        variant: "destructive",
        title: e instanceof Error ? e.message : "Error al actualizar el pago",
      });
    } finally {
      setEditSubmitting(false);
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

  const handleExportCsv = async () => {
    const token = await getToken();
    if (!token) {
      toast({ variant: "destructive", title: "No se pudo obtener sesión." });
      return;
    }
    setExportingCsv(true);
    try {
      const params = new URLSearchParams({ schoolId, limit: "10000", offset: "0" });
      if (filters.playerId) params.set("playerId", filters.playerId);
      if (filters.period) params.set("period", filters.period);
      if (filters.status) params.set("status", filters.status);
      if (filters.provider) params.set("provider", filters.provider);
      if (filters.concept === "inscripcion") {
        params.set("concept", "inscripcion");
      } else if (filters.concept === "monthly" && filters.period) {
        params.set("concept", "monthly");
        params.set("period", filters.period);
      } else if (filters.concept === "clothing") {
        params.set("concept", "clothing");
      }
      const res = await fetch(`/api/payments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? data.error ?? "Error al exportar");
      }
      const data = await res.json();
      const items: PaymentWithPlayerName[] = (data.payments ?? []).map(
        (p: PaymentWithPlayerName & { paidAt?: string; createdAt?: string }) => ({
          ...p,
          paidAt: p.paidAt ? new Date(p.paidAt) : undefined,
          createdAt: new Date(p.createdAt!),
        })
      );
      const escape = (v: string | number | undefined) => {
        if (v == null || v === "") return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const cols = ["Período", "Jugador", "Monto", "Moneda", "Proveedor", "Estado", "Fecha pago", "Fecha registro"];
      const rows = items.map((p) => [
        escape(formatPeriodDisplay(p.period)),
        escape(p.playerName ?? p.playerId),
        escape(p.amount),
        escape(p.currency),
        escape(
          p.provider === "manual"
            ? (p.metadata as { collectedByDisplayName?: string; collectedByEmail?: string } | undefined)
                ?.collectedByDisplayName ||
              (p.metadata as { collectedByEmail?: string } | undefined)?.collectedByEmail ||
              "Manual"
            : PROVIDER_LABELS[p.provider] ?? p.provider
        ),
        escape(STATUS_LABELS[p.status] ?? p.status),
        escape(p.paidAt ? format(p.paidAt, "dd/MM/yyyy HH:mm", { locale: es }) : ""),
        escape(p.createdAt ? format(p.createdAt, "dd/MM/yyyy HH:mm", { locale: es }) : ""),
      ]);
      const csv = [cols.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pagos-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exportación completada", description: `${items.length} registros exportados.` });
    } catch (e) {
      toast({
        variant: "destructive",
        title: e instanceof Error ? e.message : "Error al exportar",
      });
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <Button
          variant="outline"
          onClick={handleExportCsv}
          disabled={exportingCsv || loading}
        >
          <Download className="mr-2 h-4 w-4" />
          {exportingCsv ? "Exportando…" : "Exportar CSV"}
        </Button>
        <Button
          onClick={() => {
            setManualPlayerId("");
            setManualPaymentType("monthly");
            setManualPeriod(currentPeriod());
            setManualClothingInstallment("1");
            setManualAmount("");
            setManualOpen(true);
          }}
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
        <Popover
          open={playerFilterPopoverOpen}
          onOpenChange={(open) => {
            setPlayerFilterPopoverOpen(open);
            if (!open) setPlayerFilterSearch("");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={playerFilterPopoverOpen}
              className="w-[280px] min-w-[160px] max-w-full justify-between font-normal"
            >
              <span className="truncate text-left">
                {(() => {
                  if (!filters.playerId) return "Todos los jugadores";
                  const sel = playersSortedByName.find((p) => p.id === filters.playerId);
                  return sel ? `${sel.lastName}, ${sel.firstName}` : "Jugador…";
                })()}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="flex items-center gap-2 border-b px-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                placeholder="Nombre o apellido…"
                autoFocus
                value={playerFilterSearch}
                onChange={(e) => setPlayerFilterSearch(e.target.value)}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-2"
              />
            </div>
            <ScrollArea className="max-h-[260px]">
              <div className="p-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
                  onClick={() => {
                    setFilters((f) => ({ ...f, playerId: "" }));
                    setPlayerFilterPopoverOpen(false);
                  }}
                >
                  {!filters.playerId ? <Check className="h-4 w-4 shrink-0" /> : (
                    <span className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  <span>Todos los jugadores</span>
                </button>
                {filteredPlayersForFilter.length > 0
                  ? filteredPlayersForFilter.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent text-left"
                        onClick={() => {
                          setFilters((f) => ({ ...f, playerId: pl.id }));
                          setPlayerFilterPopoverOpen(false);
                        }}
                      >
                        {filters.playerId === pl.id ? (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <span className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                        <span className="truncate">
                          {pl.lastName}, {pl.firstName}
                        </span>
                      </button>
                    ))
                  : (
                      <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No hay jugadores que coincidan.
                      </p>
                    )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
        <Select
          value={filters.concept || "all"}
          onValueChange={(v) =>
            setFilters((f) => ({
              ...f,
              concept: v === "all" ? "" : (v as "inscripcion" | "monthly" | "clothing"),
              // No auto-seleccionar mes: dejar vacío para ver todos hasta que elijan mes explícitamente
              period: v !== "monthly" ? "" : f.period,
            }))
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Concepto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los conceptos</SelectItem>
            <SelectItem value="inscripcion">Inscripción</SelectItem>
            <SelectItem value="monthly">Cuota mensual</SelectItem>
            <SelectItem value="clothing">Ropa</SelectItem>
          </SelectContent>
        </Select>
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
                <TableHead className="text-xs sm:text-sm w-[70px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
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
                    <TableCell>
                      {p.status === "approved" && !p.period.startsWith("ropa-") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditDialog(p)}
                          title="Editar período"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={(o) => { if (!o) setEditPayment(null); setEditDialogOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar tipo de pago</DialogTitle>
            <DialogDescription>
              Cambiá el período/tipo del pago. Por ejemplo, si se cargó como inscripción pero era una cuota mensual (o viceversa).
            </DialogDescription>
          </DialogHeader>
          {editPayment && (
            <div className="grid gap-4 py-4">
              <div>
                <Label>Pago actual</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {editPayment.playerName ?? editPayment.playerId} — {formatPeriodDisplay(editPayment.period)} — {editPayment.currency} {editPayment.amount.toLocaleString("es-AR")}
                </p>
              </div>
              <div>
                <Label htmlFor="edit-period">Nuevo período</Label>
                <Select value={editNewPeriod} onValueChange={setEditNewPeriod}>
                  <SelectTrigger id="edit-period" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={REGISTRATION_PERIOD}>Inscripción</SelectItem>
                    {(() => {
                      const years = getYears();
                      const pm = editPayment.period.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
                      if (pm && !years.includes(parseInt(pm[1], 10))) {
                        years.push(parseInt(pm[1], 10));
                        years.sort((a, b) => b - a);
                      }
                      return years.flatMap((year) =>
                        MONTHS.map((m) => {
                          const val = `${year}-${m.value}`;
                          return (
                            <SelectItem key={val} value={val}>
                              {formatPeriodDisplay(val)}
                            </SelectItem>
                          );
                        })
                      );
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditPayment} disabled={editSubmitting || !editPayment || editPayment.period === editNewPeriod}>
              {editSubmitting ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  {activePlayers.map((p) => (
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
                onValueChange={(v: "monthly" | "registration" | "clothing") => {
                  setManualPaymentType(v);
                  if (v === "registration") {
                    setManualAmount(String(configRegistrationAmount || ""));
                  } else if (v === "clothing" && configClothingInstallments > 0) {
                    const perCuota = Math.floor(configClothingAmount / configClothingInstallments);
                    const remainder = configClothingAmount - perCuota * configClothingInstallments;
                    const firstCuota = perCuota + (remainder > 0 ? 1 : 0);
                    setManualAmount(String(firstCuota));
                  } else if (v === "monthly") {
                    setManualAmount("");
                  }
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Cuota mensual</SelectItem>
                  <SelectItem value="registration">Inscripción</SelectItem>
                  <SelectItem value="clothing">Pago de ropa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {manualPaymentType === "clothing" && (
              <div>
                <Label htmlFor="manual-clothing">¿Qué cuota del pago de ropa es?</Label>
                {!manualPlayerId ? (
                  <p className="text-sm text-muted-foreground mt-1">
                    Elegí un jugador para ver sus cuotas pendientes (según la config de la escuela: {configClothingInstallments} cuota{configClothingInstallments !== 1 ? "s" : ""} por defecto).
                  </p>
                ) : clothingPendingLoading ? (
                  <p className="text-sm text-muted-foreground mt-1">Cargando cuotas pendientes…</p>
                ) : clothingPendingForPlayer.length === 0 && clothingConfigured ? (
                  <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                    Este jugador ya tiene todas las cuotas de ropa pagadas ({configClothingInstallments} cuota{configClothingInstallments !== 1 ? "s" : ""} configurada{configClothingInstallments !== 1 ? "s" : ""}).
                  </p>
                ) : clothingPendingForPlayer.length === 0 && !clothingConfigured ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-2">
                      La escuela no tiene pago de ropa configurado. Podés registrar igual (2 cuotas por defecto). Configurá en Administración → Pagos → Configuración para que se calcule automáticamente.
                    </p>
                    <Select
                      value={manualClothingInstallment}
                      onValueChange={setManualClothingInstallment}
                    >
                      <SelectTrigger id="manual-clothing" className="mt-1">
                        <SelectValue placeholder="Elegí la cuota" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Cuota 1</SelectItem>
                        <SelectItem value="2">Cuota 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <>
                    <Select
                      value={manualClothingInstallment}
                      onValueChange={(v) => {
                        setManualClothingInstallment(v);
                        const item = clothingPendingForPlayer.find((p) => String(p.installmentIndex) === v);
                        if (item) setManualAmount(String(item.amount));
                      }}
                    >
                      <SelectTrigger id="manual-clothing" className="mt-1">
                        <SelectValue placeholder="Elegí la cuota" />
                      </SelectTrigger>
                      <SelectContent>
                        {clothingPendingForPlayer.map((item) => (
                          <SelectItem key={item.period} value={String(item.installmentIndex)}>
                            Cuota {item.installmentIndex} de {item.totalInstallments} — ARS {item.amount.toLocaleString("es-AR")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1">
                      Se muestran solo las cuotas pendientes de este jugador ({configClothingInstallments} cuota{configClothingInstallments !== 1 ? "s" : ""} configurada{configClothingInstallments !== 1 ? "s" : ""}).
                    </p>
                  </>
                )}
              </div>
            )}
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
                placeholder={
                  manualPaymentType === "registration"
                    ? String(configRegistrationAmount || "0")
                    : manualPaymentType === "clothing"
                      ? String(configClothingAmount ? Math.floor(configClothingAmount / configClothingInstallments) : "0")
                      : "Elegí jugador y período"
                }
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleManualPayment}
              disabled={
                manualSubmitting ||
                !!(
                  manualPaymentType === "clothing" &&
                  manualPlayerId &&
                  clothingPendingForPlayer.length === 0 &&
                  clothingConfigured &&
                  !clothingPendingLoading
                )
              }
            >
              {manualSubmitting ? "Guardando…" : "Registrar pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
