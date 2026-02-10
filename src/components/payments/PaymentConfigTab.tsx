"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CreditCard, CheckCircle2 } from "lucide-react";

interface PaymentConfigTabProps {
  schoolId: string;
  getToken: () => Promise<string | null>;
}

export function PaymentConfigTab({ schoolId, getToken }: PaymentConfigTabProps) {
  const [amount, setAmount] = useState("");
  const [dueDayOfMonth, setDueDayOfMonth] = useState("10");
  const [registrationAmount, setRegistrationAmount] = useState("");
  const [registrationCancelsMonthFee, setRegistrationCancelsMonthFee] = useState(true);
  const [moraFromActivationMonth, setMoraFromActivationMonth] = useState(true);
  const [prorateDayOfMonth, setProrateDayOfMonth] = useState("15");
  const [proratePercent, setProratePercent] = useState("50");
  const [delinquencyDaysEmail, setDelinquencyDaysEmail] = useState("10");
  const [delinquencyDaysSuspension, setDelinquencyDaysSuspension] = useState("30");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mpConnected, setMpConnected] = useState<boolean | null>(null);
  const [mpConnecting, setMpConnecting] = useState(false);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const mp = searchParams.get("mercadopago");
    const message = searchParams.get("message");
    if (mp === "connected") {
      toast({ title: "Mercado Pago conectado", description: "Tu cuenta quedó vinculada. Los cobros se acreditarán en tu cuenta." });
      setMpConnected(true);
      window.history.replaceState({}, "", "/dashboard/payments?tab=config");
    } else if (mp === "error") {
      toast({
        title: "Error al conectar Mercado Pago",
        description: message || "No se pudo completar la autorización.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/dashboard/payments?tab=config");
    }
  }, [searchParams, toast]);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const [configRes, statusRes] = await Promise.all([
          fetch(`/api/payments/config?schoolId=${schoolId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/payments/mercadopago/status?schoolId=${schoolId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (configRes.ok) {
          const data = await configRes.json();
          setAmount(String(data.amount ?? ""));
          setDueDayOfMonth(String(data.dueDayOfMonth ?? 10));
          setRegistrationAmount(String(data.registrationAmount ?? ""));
          setRegistrationCancelsMonthFee(data.registrationCancelsMonthFee !== false);
          setMoraFromActivationMonth(data.moraFromActivationMonth !== false);
          setProrateDayOfMonth(String(data.prorateDayOfMonth ?? 15));
          setProratePercent(String(data.proratePercent ?? 50));
          setDelinquencyDaysEmail(String(data.delinquencyDaysEmail ?? 10));
          setDelinquencyDaysSuspension(String(data.delinquencyDaysSuspension ?? 30));
        }
        if (statusRes.ok) {
          const status = await statusRes.json();
          setMpConnected(!!status.connected);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolId, getToken]);

  const handleSave = async () => {
    const am = parseFloat(amount);
    const day = parseInt(dueDayOfMonth, 10);
    const prorateDay = parseInt(prorateDayOfMonth, 10);
    const proratePct = parseInt(proratePercent, 10);
    const daysEmail = parseInt(delinquencyDaysEmail, 10);
    const daysSusp = parseInt(delinquencyDaysSuspension, 10);

    if (isNaN(am) || am < 0) {
      toast({ title: "Error", description: "Monto inválido", variant: "destructive" });
      return;
    }
    if (isNaN(day) || day < 1 || day > 31) {
      toast({ title: "Error", description: "Día de vencimiento debe ser 1-31", variant: "destructive" });
      return;
    }
    if (isNaN(prorateDay) || prorateDay < 0 || prorateDay > 31) {
      toast({ title: "Error", description: "Día prorrata debe ser 0-31 (0 = sin prorrata)", variant: "destructive" });
      return;
    }
    if (isNaN(proratePct) || proratePct < 0 || proratePct > 100) {
      toast({ title: "Error", description: "Porcentaje prorrata debe ser 0-100", variant: "destructive" });
      return;
    }
    if (isNaN(daysEmail) || daysEmail < 1 || daysEmail > 90) {
      toast({ title: "Error", description: "Días aviso mora: 1-90", variant: "destructive" });
      return;
    }
    if (isNaN(daysSusp) || daysSusp < 1 || daysSusp > 365) {
      toast({ title: "Error", description: "Días suspensión: 1-365", variant: "destructive" });
      return;
    }
    const regAm = registrationAmount === "" ? 0 : parseFloat(registrationAmount);
    if (registrationAmount !== "" && (isNaN(regAm) || regAm < 0)) {
      toast({ title: "Error", description: "Monto inscripción debe ser ≥ 0", variant: "destructive" });
      return;
    }

    setSaving(true);
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/payments/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          schoolId,
          amount: am,
          currency: "ARS",
          dueDayOfMonth: day,
          registrationAmount: regAm,
          registrationCancelsMonthFee,
          moraFromActivationMonth,
          prorateDayOfMonth: prorateDay,
          proratePercent: proratePct,
          delinquencyDaysEmail: daysEmail,
          delinquencyDaysSuspension: daysSusp,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      toast({ title: "Guardado", description: "Configuración actualizada" });
    } catch (e) {
      toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleConnectMercadoPago = async () => {
    const token = await getToken();
    if (!token) {
      toast({ title: "Error", description: "Tenés que iniciar sesión", variant: "destructive" });
      return;
    }
    setMpConnecting(true);
    try {
      const res = await fetch(`/api/payments/mercadopago/connect?schoolId=${encodeURIComponent(schoolId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "No se pudo iniciar la conexión");
      }
      const redirectUrl = (data as { redirectUrl?: string }).redirectUrl;
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
      throw new Error("No se recibió la URL de Mercado Pago");
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo conectar con Mercado Pago",
        variant: "destructive",
      });
    } finally {
      setMpConnecting(false);
    }
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Mercado Pago
          </CardTitle>
          <CardDescription>
            Para que tu escuela cobre directamente en su cuenta de Mercado Pago, conectá tu cuenta (autorización oficial). No tenés que enviar claves ni contraseñas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mpConnected ? (
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span className="font-medium">Cuenta conectada</span>
            </div>
          ) : (
            <Button onClick={handleConnectMercadoPago} disabled={mpConnecting}>
              {mpConnecting ? "Redirigiendo a Mercado Pago…" : "Conectar Mercado Pago"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuota mensual</CardTitle>
          <CardDescription>Monto base y día de vencimiento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="amount">Monto de la cuota (ARS)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="dueDay">Día de vencimiento (1-31)</Label>
            <Input
              id="dueDay"
              type="number"
              min={1}
              max={31}
              value={dueDayOfMonth}
              onChange={(e) => setDueDayOfMonth(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Derecho de inscripción</CardTitle>
          <CardDescription>
            Monto inicial de inscripción (puede ser distinto a la cuota mensual). Definí si al pagar la inscripción se considera cubierta la cuota del mes de alta o si la cuota se paga aparte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="registrationAmount">Monto inscripción (ARS). 0 = sin cobro de inscripción</Label>
            <Input
              id="registrationAmount"
              type="number"
              min={0}
              value={registrationAmount}
              onChange={(e) => setRegistrationAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="registrationCancels">La inscripción cancela la cuota del mes de alta</Label>
              <p className="text-sm text-muted-foreground">
                Si está activado: pagar inscripción cuenta como pagar la cuota del mes en que se dio de alta. Si está desactivado: la cuota del mes se paga aparte (a mes vencido).
              </p>
            </div>
            <Switch
              id="registrationCancels"
              checked={registrationCancelsMonthFee}
              onCheckedChange={setRegistrationCancelsMonthFee}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas de mora</CardTitle>
          <CardDescription>Configuración de morosidad y suspensión</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="moraFrom">Mora desde mes de activación</Label>
              <p className="text-sm text-muted-foreground">
                Si está activado, el jugador solo debe desde el mes en que se dio de alta. Si no, se consideran todos los períodos.
              </p>
            </div>
            <Switch
              id="moraFrom"
              checked={moraFromActivationMonth}
              onCheckedChange={setMoraFromActivationMonth}
            />
          </div>

          <Separator />

          <div>
            <Label htmlFor="prorateDay">Día límite para prorrata (0 = sin prorrata)</Label>
            <p className="text-sm text-muted-foreground mb-1">
              Si el jugador se activa después de este día, paga un porcentaje de la cuota en su primer mes.
            </p>
            <Input
              id="prorateDay"
              type="number"
              min={0}
              max={31}
              value={prorateDayOfMonth}
              onChange={(e) => setProrateDayOfMonth(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="proratePercent">Porcentaje en mes de ingreso (si activó después del día límite)</Label>
            <Input
              id="proratePercent"
              type="number"
              min={0}
              max={100}
              value={proratePercent}
              onChange={(e) => setProratePercent(e.target.value)}
            />
          </div>

          <Separator />

          <div>
            <Label htmlFor="daysEmail">Días de mora para aviso por email</Label>
            <p className="text-sm text-muted-foreground mb-1">
              Se envía aviso al padre/tutor pasados estos días sin pago.
            </p>
            <Input
              id="daysEmail"
              type="number"
              min={1}
              max={90}
              value={delinquencyDaysEmail}
              onChange={(e) => setDelinquencyDaysEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="daysSusp">Días de mora para suspensión</Label>
            <p className="text-sm text-muted-foreground mb-1">
              Se marca al jugador como suspendido pasados estos días sin pago.
            </p>
            <Input
              id="daysSusp"
              type="number"
              min={1}
              max={365}
              value={delinquencyDaysSuspension}
              onChange={(e) => setDelinquencyDaysSuspension(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Guardando…" : "Guardar configuración"}
      </Button>
    </div>
  );
}
