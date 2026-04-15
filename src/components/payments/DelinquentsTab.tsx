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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, ExternalLink, Download, Mail, CheckCircle2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import type { DelinquentInfo, PlayerCurrentOnMonthlyQuota } from "@/lib/types";

function delinquentKey(d: DelinquentInfo): string {
  return `${d.playerId}:${d.period}`;
}

const REGISTRATION_PERIOD = "inscripcion";

const MONTHS: { value: string; label: string }[] = [
  { value: "01", label: "Enero" }, { value: "02", label: "Febrero" }, { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" }, { value: "05", label: "Mayo" }, { value: "06", label: "Junio" },
  { value: "07", label: "Julio" }, { value: "08", label: "Agosto" }, { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" }, { value: "11", label: "Noviembre" }, { value: "12", label: "Diciembre" },
];

function formatPeriodLabel(period: string): string {
  if (period === REGISTRATION_PERIOD) return "Inscripción";
  const ropaMatch = period.match(/^ropa-(\d+)$/);
  if (ropaMatch) return `Pago de ropa (${ropaMatch[1]})`;
  if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period;
  const [y, m] = period.split("-");
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return format(date, "MMMM yyyy", { locale: es });
}

function getYears(): number[] {
  const current = new Date().getFullYear();
  const start = 2024;
  const end = Math.max(current + 1, start + 2);
  const years: number[] = [];
  for (let y = end; y >= start; y--) years.push(y);
  return years;
}

interface DelinquentsTabProps {
  schoolId: string;
  getToken: () => Promise<string | null>;
}

export function DelinquentsTab({ schoolId, getToken }: DelinquentsTabProps) {
  const [delinquents, setDelinquents] = useState<DelinquentInfo[]>([]);
  /** Jugadores al día solo en cuota mensual (misma lógica que morosos; no incluye inscripción ni ropa). */
  const [currentOnMonthly, setCurrentOnMonthly] = useState<PlayerCurrentOnMonthlyQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  /** Concepto: "all" | "inscripcion" | "monthly" | "clothing" */
  const [conceptFilter, setConceptFilter] = useState("");
  /** Subfiltro: ropa-N para ropa; YYYY-MM para cuota mensual */
  const [periodFilter, setPeriodFilter] = useState("");
  const [manualDialog, setManualDialog] = useState<DelinquentInfo | null>(null);
  const [manualAmount, setManualAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [reminderStats, setReminderStats] = useState<{ sentToday: number; sentMonth: number; dailyLimit: number; remainingToday: number } | null>(null);
  const [sendRemindersDialog, setSendRemindersDialog] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const { toast } = useToast();

  const handleExportCsv = () => {
    const escape = (v: string | number | undefined) => {
      if (v == null || v === "") return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const cols = ["Jugador", "Email", "Período", "Días mora", "Monto", "Moneda", "Estado", "Teléfono tutor", "Nombre tutor"];
    const rows = delinquents.map((d) => [
      escape(d.playerName),
      escape(d.playerEmail),
      escape(formatPeriodLabel(d.period)),
      escape(d.daysOverdue),
      escape(d.amount),
      escape(d.currency),
      escape(d.status === "suspended" ? "Suspendido" : "En mora"),
      escape(d.tutorContact?.phone),
      escape(d.tutorContact?.name),
    ]);
    const csv = [cols.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `morosos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportación completada", description: `${delinquents.length} registros exportados.` });
  };

  const handleExportCurrentMonthlyCsv = () => {
    const escape = (v: string | number | undefined) => {
      if (v == null || v === "") return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const cols = ["Jugador", "Email", "Estado"];
    const statusLabel = (s: string) =>
      s === "suspended" ? "Suspendido" : s === "inactive" ? "Inactivo" : "Activo";
    const rows = currentOnMonthly.map((p) => [
      escape(p.playerName),
      escape(p.playerEmail),
      escape(statusLabel(p.status)),
    ]);
    const csv = [cols.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `al-dia-cuota-mensual-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Exportación completada",
      description: `${currentOnMonthly.length} jugador${currentOnMonthly.length !== 1 ? "es" : ""} en la lista.`,
    });
  };

  const fetchDelinquents = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setFetchError(null);
    const token = await getToken();
    if (!token) {
      setLoading(false);
      setFetchError("Sesión expirada. Volvé a iniciar sesión.");
      setCurrentOnMonthly([]);
      return;
    }
    try {
      const params = new URLSearchParams({ schoolId });
      const concept = conceptFilter || "";
      const period = periodFilter || "";
      if (concept) params.set("concept", concept);
      if (period) params.set("period", period);
      const res = await fetch(`/api/payments/delinquents?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data.error ??
          (res.status === 401 ? "Sesión expirada. Volvé a iniciar sesión." : null) ??
          (res.status === 400 ? "Falta seleccionar la escuela." : null) ??
          (res.status === 503 ? "Los índices se están creando. Volvé a intentar en unos minutos." : null) ??
          `Error al cargar morosos (${res.status})`;
        setFetchError(msg);
        setCurrentOnMonthly([]);
        toast({ title: "Error", description: msg, variant: "destructive" });
        return;
      }
      const list = data.delinquents ?? [];
      setDelinquents(
        list.map((d: DelinquentInfo & { dueDate: string }) => ({
          ...d,
          dueDate: new Date(d.dueDate),
        }))
      );
      setCurrentOnMonthly(data.currentOnMonthlyQuota ?? []);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudieron cargar los morosos";
      setFetchError(message);
      setCurrentOnMonthly([]);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [schoolId, conceptFilter, periodFilter, getToken, toast]);

  useEffect(() => {
    fetchDelinquents();
  }, [fetchDelinquents]);

  const fetchReminderStats = useCallback(async () => {
    if (!schoolId) return;
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/payments/reminder-stats?schoolId=${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReminderStats(data);
      }
    } catch {
      // silencioso
    }
  }, [schoolId, getToken]);

  useEffect(() => {
    if (!loading && delinquents.length > 0) fetchReminderStats();
  }, [loading, delinquents.length, fetchReminderStats]);

  /** Morosos con email que aún no recibieron recordatorio (se pueden seleccionar para enviar) */
  const selectableForReminder = delinquents.filter(
    (d) => d.playerEmail?.trim() && (d.reminderCount ?? 0) === 0
  );
  const selectableCount = selectableForReminder.length;
  const selectedSelectableCount = selectableForReminder.filter((d) => selectedKeys.has(delinquentKey(d))).length;
  const selectedWithEmailCount = selectedSelectableCount;
  const isAllSelected = selectableCount > 0 && selectedSelectableCount === selectableCount;
  const isIndeterminate = selectedSelectableCount > 0 && selectedSelectableCount < selectableCount;

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected || isIndeterminate) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(selectableForReminder.map(delinquentKey)));
    }
  };

  const handleSendReminders = async () => {
    const token = await getToken();
    if (!token) return;
    const items = delinquents.filter((d) => selectedKeys.has(delinquentKey(d)));
    if (items.length === 0) {
      toast({ title: "Seleccioná al menos un moroso", variant: "destructive" });
      return;
    }
    const withEmail = items.filter((d) => d.playerEmail?.trim());
    if (withEmail.length === 0) {
      toast({ title: "Ninguno de los seleccionados tiene email cargado", variant: "destructive" });
      return;
    }
    setSendingReminders(true);
    try {
      const res = await fetch("/api/payments/send-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          schoolId,
          items: withEmail.map((d) => ({
            playerId: d.playerId,
            period: d.period,
            playerEmail: d.playerEmail?.trim() || undefined,
            playerName: d.playerName,
            amount: d.amount,
            currency: d.currency,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "No se pudieron enviar los recordatorios", variant: "destructive" });
        return;
      }
      const sent = data.sent ?? 0;
      const skipped = data.skipped ?? 0;
      const noEmail = data.noEmail ?? 0;
      const errs = data.errors ?? [];
      setSendRemindersDialog(false);
      setSelectedKeys(new Set());
      fetchReminderStats();
      fetchDelinquents();
      const msg = errs.length > 0
        ? `Enviados: ${sent}. Omitidos: ${skipped}. Sin email: ${noEmail}. Errores: ${errs.slice(0, 2).join("; ")}`
        : `Se enviaron ${sent} recordatorios${skipped ? `. ${skipped} omitidos (ya enviados antes)` : ""}${noEmail ? `. ${noEmail} sin email` : ""}`;
      toast({ title: "Recordatorios enviados", description: msg });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Error al enviar", variant: "destructive" });
    } finally {
      setSendingReminders(false);
    }
  };

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
      <Collapsible defaultOpen className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <CollapsibleTrigger className="flex w-full items-center gap-2 p-4 text-left font-medium hover:bg-muted/40 [&[data-state=open]>svg:last-child]:rotate-180">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <span className="min-w-0 flex-1">
            Al día en cuota mensual
            <span className="ml-2 text-sm font-normal text-muted-foreground">({currentOnMonthly.length})</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 border-t px-4 pb-4 pt-3">
            <p className="text-sm text-muted-foreground">
              Lista de jugadores con cuota mensual configurada y sin meses vencidos impagos.{" "}
              <strong className="font-medium text-foreground">No</strong> tiene en cuenta inscripción ni ropa: pueden
              aparecer aquí y aun figurar como morosos por otros conceptos.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCurrentMonthlyCsv}
              disabled={loading || currentOnMonthly.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : fetchError ? null : currentOnMonthly.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nadie cumple este criterio o no hay cuotas mensuales configuradas.</p>
            ) : (
              <div className="max-h-72 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Jugador</TableHead>
                      <TableHead className="text-xs sm:text-sm">Email</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentOnMonthly.map((p) => (
                      <TableRow key={p.playerId}>
                        <TableCell className="font-medium">{p.playerName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.playerEmail ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "suspended" ? "destructive" : "secondary"}>
                            {p.status === "suspended" ? "Suspendido" : p.status === "inactive" ? "Inactivo" : "Activo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={loading || delinquents.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => setSendRemindersDialog(true)}
          disabled={loading || delinquents.length === 0 || selectedWithEmailCount === 0 || (reminderStats?.remainingToday ?? 0) <= 0}
        >
          <Mail className="mr-2 h-4 w-4" />
          Enviar recordatorio masivo ({selectedWithEmailCount})
        </Button>
        {reminderStats && (
          <span className="text-sm text-muted-foreground">
            Hoy: {reminderStats.sentToday}/{reminderStats.dailyLimit} · Este mes: {reminderStats.sentMonth}
          </span>
        )}
        <Select
          value={conceptFilter || "all"}
          onValueChange={(v) => {
            setConceptFilter(v === "all" ? "" : v);
            setPeriodFilter("");
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Concepto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los conceptos</SelectItem>
            <SelectItem value="inscripcion">Inscripción</SelectItem>
            <SelectItem value="monthly">Cuota mensual</SelectItem>
            <SelectItem value="clothing">Ropa</SelectItem>
          </SelectContent>
        </Select>
        {conceptFilter === "monthly" && (
          <>
            <Select
              value={periodFilter ? periodFilter.slice(5, 7) : "all"}
              onValueChange={(m) =>
                setPeriodFilter(
                  m === "all"
                    ? ""
                    : `${periodFilter ? periodFilter.slice(0, 4) : new Date().getFullYear()}-${m}`
                )
              }
            >
              <SelectTrigger className="w-32">
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
              value={periodFilter ? periodFilter.slice(0, 4) : "all"}
              onValueChange={(y) =>
                setPeriodFilter(
                  y === "all"
                    ? ""
                    : `${y}-${periodFilter ? periodFilter.slice(5, 7) : String(new Date().getMonth() + 1).padStart(2, "0")}`
                )
              }
            >
              <SelectTrigger className="w-24">
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
          </>
        )}
        {conceptFilter === "clothing" && (
          <Select value={periodFilter || "all"} onValueChange={(v) => setPeriodFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Cuota" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="ropa-1">Cuota 1</SelectItem>
              <SelectItem value="ropa-2">Cuota 2</SelectItem>
              <SelectItem value="ropa-3">Cuota 3</SelectItem>
              <SelectItem value="ropa-4">Cuota 4</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : fetchError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive font-medium mb-2">{fetchError}</p>
          <Button variant="outline" size="sm" onClick={() => fetchDelinquents()}>
            Reintentar
          </Button>
        </div>
      ) : delinquents.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-8 text-center text-muted-foreground">
          No hay morosos en esta escuela
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border min-w-0">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={isIndeterminate ? "indeterminate" : isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
                <TableHead className="text-xs sm:text-sm">Jugador</TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">Período</TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">Días mora</TableHead>
                <TableHead className="text-xs sm:text-sm">Monto</TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">Recordatorios</TableHead>
                <TableHead className="text-xs sm:text-sm">Estado</TableHead>
                <TableHead className="text-xs sm:text-sm text-right w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {delinquents.map((d) => {
                const key = delinquentKey(d);
                const hasEmail = !!(d.playerEmail ?? "").trim();
                const alreadySent = (d.reminderCount ?? 0) > 0;
                const canSelect = hasEmail && !alreadySent;
                return (
                <TableRow key={`${d.playerId}-${d.period}`}>
                  <TableCell>
                    <Checkbox
                      checked={selectedKeys.has(key)}
                      onCheckedChange={() => toggleSelect(key)}
                      disabled={!canSelect}
                      aria-label={`Seleccionar ${d.playerName}`}
                    />
                  </TableCell>
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
                  <TableCell className="whitespace-nowrap">
                    {(d.reminderCount ?? 0) > 0 ? (
                      <span title={d.lastReminderSentAt ? `Enviado: ${format(new Date(d.lastReminderSentAt), "dd/MM/yyyy HH:mm", { locale: es })}` : undefined}>
                        {d.reminderCount} {d.reminderCount === 1 ? "enviado" : "enviados"}
                        {d.lastReminderSentAt && (
                          <span className="block text-xs text-muted-foreground">
                            {format(new Date(d.lastReminderSentAt), "dd/MM/yy")}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
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
              );})}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={sendRemindersDialog} onOpenChange={setSendRemindersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar recordatorios masivos</DialogTitle>
            <DialogDescription>
              Se enviará un email a {selectedWithEmailCount} moroso(s) con recordatorio de pago e incluyendo link de pago.
              Límite diario: {reminderStats?.sentToday ?? 0}/{reminderStats?.dailyLimit ?? 200}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendRemindersDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendReminders} disabled={sendingReminders}>
              {sendingReminders ? "Enviando…" : "Enviar recordatorios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendRemindersDialog} onOpenChange={setSendRemindersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar recordatorios de pago</DialogTitle>
            <DialogDescription>
              Se enviarán {selectedWithEmailCount} email(s) con recordatorio de pago y link de Mercado Pago.
              Los morosos sin email no recibirán el recordatorio.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendRemindersDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendReminders} disabled={sendingReminders}>
              {sendingReminders ? "Enviando…" : "Confirmar envío"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendRemindersDialog} onOpenChange={setSendRemindersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar recordatorios de pago</DialogTitle>
            <DialogDescription>
              Se enviarán {selectedWithEmailCount} email(s) con recordatorio de pago y link para abonar. Los que no tienen email cargado no recibirán el correo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendRemindersDialog(false)}>Cancelar</Button>
            <Button onClick={handleSendReminders} disabled={sendingReminders}>
              {sendingReminders ? "Enviando…" : "Enviar recordatorios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={sendRemindersDialog} onOpenChange={setSendRemindersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar recordatorios de pago</DialogTitle>
            <DialogDescription>
              Se enviarán {selectedWithEmailCount} email(s) con recordatorio de pago y link para pagar.
              Los morosos sin email quedan excluidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendRemindersDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendReminders} disabled={sendingReminders}>
              {sendingReminders ? "Enviando…" : "Enviar recordatorios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
