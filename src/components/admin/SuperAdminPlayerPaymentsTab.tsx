"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CreditCard, Loader2, RefreshCw, Search, ExternalLink } from "lucide-react";
import { useUserProfile } from "@/firebase";
import type { School } from "@/lib/types";

type PaymentRow = {
  id: string;
  playerId: string;
  schoolId: string;
  schoolName?: string;
  playerName?: string;
  period: string;
  amount: number;
  currency: string;
  provider: string;
  providerPaymentId?: string;
  status: string;
  paymentType?: string;
  paidAt?: string;
  createdAt: string;
};

type IntentRow = {
  id: string;
  playerId: string;
  schoolId: string;
  schoolName?: string;
  playerName?: string;
  period: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  checkoutUrl?: string;
  providerPreferenceId?: string;
  createdAt: string;
  updatedAt: string;
};

interface SuperAdminPlayerPaymentsTabProps {
  schools: School[] | null;
}

function formatPeriodLabel(period: string): string {
  if (period === "inscripcion") return "Inscripción";
  if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period;
  const [y, m] = period.split("-");
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return format(date, "MMM yyyy", { locale: es });
}

function statusBadge(status: string) {
  const labels: Record<string, string> = {
    approved: "Aprobado",
    pending: "Pendiente",
    rejected: "Rechazado",
    refunded: "Reembolsado",
  };
  const cls =
    status === "approved"
      ? "border-green-600/50 bg-green-500/10 text-green-800 dark:text-green-400"
      : status === "pending"
        ? "border-amber-600/50 bg-amber-500/10 text-amber-900 dark:text-amber-200"
        : "";
  return (
    <Badge
      variant={status === "rejected" || status === "refunded" ? "destructive" : "secondary"}
      className={cls}
    >
      {labels[status] ?? status}
    </Badge>
  );
}

export function SuperAdminPlayerPaymentsTab({ schools }: SuperAdminPlayerPaymentsTabProps) {
  const { user } = useUserProfile();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [intents, setIntents] = useState<IntentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [schoolId, setSchoolId] = useState<string>("");
  const [provider, setProvider] = useState<string>("mercadopago");
  const [status, setStatus] = useState<string>("");
  const [playerSearchDraft, setPlayerSearchDraft] = useState("");
  const [appliedPlayerSearch, setAppliedPlayerSearch] = useState("");
  const [includeIntents, setIncludeIntents] = useState(true);
  const [offset, setOffset] = useState(0);
  const pageSize = 40;

  const getToken = useCallback(async () => {
    if (!user) return null;
    return user.getIdToken().catch(() => null);
  }, [user]);

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (schoolId) params.set("schoolId", schoolId);
      if (provider && provider !== "all") params.set("provider", provider);
      if (status) params.set("status", status);
      if (appliedPlayerSearch.trim()) params.set("playerSearch", appliedPlayerSearch.trim());
      params.set("limit", String(pageSize));
      params.set("offset", String(offset));
      if (includeIntents) {
        params.set("includeIntents", "1");
        params.set("intentsLimit", "50");
      }
      const res = await fetch(`/api/admin/player-payments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        const msg = [err.error, err.detail].filter(Boolean).join(" — ");
        throw new Error(msg || res.statusText);
      }
      const data = await res.json();
      setPayments(data.payments ?? []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setIntents(data.intents ?? []);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudieron cargar los pagos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [getToken, schoolId, provider, status, appliedPlayerSearch, offset, includeIntents, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const applySearch = () => {
    setAppliedPlayerSearch(playerSearchDraft.trim());
    setOffset(0);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            Filtros
          </CardTitle>
          <CardDescription>
            Pagos que las familias hacen a cada escuela (Mercado Pago y otros). Podés cruzar con lo que dicen
            los padres si no aparece en el panel del colegio.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Escuela</Label>
              <Select
                value={schoolId || "all"}
                onValueChange={(v) => {
                  setSchoolId(v === "all" ? "" : v);
                  setOffset(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las escuelas</SelectItem>
                  {schools?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Select
                value={provider}
                onValueChange={(v) => {
                  setProvider(v);
                  setOffset(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="dlocal">dLocal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={status || "all"}
                onValueChange={(v) => {
                  setStatus(v === "all" ? "" : v);
                  setOffset(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Cualquiera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cualquiera</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                  <SelectItem value="refunded">Reembolsado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Jugador (nombre)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ej. Latanzzio, Heredia…"
                  value={playerSearchDraft}
                  onChange={(e) => setPlayerSearchDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applySearch()}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="intents"
                checked={includeIntents}
                onCheckedChange={(c) => {
                  setIncludeIntents(c === true);
                  setOffset(0);
                }}
              />
              <Label htmlFor="intents" className="text-sm font-normal cursor-pointer">
                Mostrar checkouts recientes (intenciones)
              </Label>
            </div>
            <Button type="button" onClick={() => void fetchData()} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Actualizar
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={() => applySearch()}>
              <Search className="h-4 w-4" />
              Buscar jugador
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos registrados</CardTitle>
          <CardDescription>
            {loading ? "Cargando…" : `${total} resultado(s) en esta vista.`}{" "}
            {appliedPlayerSearch.trim()
              ? "La búsqueda por nombre revisa los últimos movimientos recientes (hasta ~450)."
              : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto border-t sm:border-t-0 -mx-4 sm:mx-0 px-4 sm:px-0">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Escuela</TableHead>
                  <TableHead>Jugador</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="font-mono text-xs">ID operación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading &&
                  [...Array(6)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(8)].map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                {!loading &&
                  payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(p.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{p.schoolName ?? p.schoolId}</span>
                          <Link
                            href={`/dashboard/schools/${p.schoolId}`}
                            className="text-xs text-primary inline-flex items-center gap-1 w-fit hover:underline"
                          >
                            Abrir escuela <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>{p.playerName ?? p.playerId}</TableCell>
                      <TableCell>{formatPeriodLabel(p.period)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.currency} {p.amount.toLocaleString("es-AR")}
                      </TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell className="capitalize">{p.provider}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[140px] truncate" title={p.providerPaymentId}>
                        {p.providerPaymentId ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          {!loading && payments.length === 0 && (
            <p className="text-center text-muted-foreground py-8 px-4">No hay pagos con estos filtros.</p>
          )}
          {!loading && total > pageSize && (
            <div className="flex justify-center gap-2 py-4">
              <Button
                variant="outline"
                size="sm"
                disabled={offset <= 0}
                onClick={() => setOffset((o) => Math.max(0, o - pageSize))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + pageSize >= total}
                onClick={() => setOffset((o) => o + pageSize)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {includeIntents && (
        <Card>
          <CardHeader>
            <CardTitle>Checkouts / intenciones recientes</CardTitle>
            <CardDescription>
              Links de pago generados. Si hay intención pero no aparece pago aprobado, puede fallar el webhook de
              Mercado Pago o el padre no terminó el pago.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto border-t sm:border-t-0">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Creado</TableHead>
                    <TableHead>Escuela</TableHead>
                    <TableHead>Jugador</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado intent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && intents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading &&
                    intents.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(it.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>{it.schoolName ?? it.schoolId}</TableCell>
                        <TableCell>{it.playerName ?? it.playerId}</TableCell>
                        <TableCell>{formatPeriodLabel(it.period)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {it.currency} {it.amount.toLocaleString("es-AR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{it.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
            {!loading && intents.length === 0 && (
              <p className="text-center text-muted-foreground py-6">No hay intenciones en este rango.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
