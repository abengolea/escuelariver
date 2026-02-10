"use client";

import { useUserProfile, useFirebase } from "@/firebase";
import { getAuth } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCollection } from "@/firebase";
import type { Player } from "@/lib/types";
import { ArrowLeft, Search, Send, Copy, Check } from "lucide-react";

type VerifyResult = {
  schoolId: string;
  playerCount: number;
  playerIds: string[];
  players: Record<string, string>;
} | null;

export default function PaymentsTestPage() {
  const { profile, isReady, isAdmin } = useUserProfile();
  const router = useRouter();
  const { app } = useFirebase();
  const [verifyResult, setVerifyResult] = useState<VerifyResult>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [manualPlayerId, setManualPlayerId] = useState("");
  const [manualPeriod, setManualPeriod] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
  );
  const [manualAmount, setManualAmount] = useState("15000");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualResponse, setManualResponse] = useState<{ ok: boolean; body: unknown } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const schoolId = profile?.activeSchoolId;

  const { data: players } = useCollection<Player>(
    schoolId ? `schools/${schoolId}/players` : "",
    { orderBy: ["lastName", "asc"] }
  );

  const getToken = async () => {
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  };

  useEffect(() => {
    if (!isReady) return;
    if (!profile) {
      router.push("/auth/pending-approval");
      return;
    }
    if (!isAdmin) {
      router.push("/dashboard");
      return;
    }
  }, [isReady, profile, isAdmin, router]);

  const runVerify = async () => {
    if (!schoolId) return;
    setVerifyLoading(true);
    setVerifyError(null);
    setVerifyResult(null);
    try {
      const token = await getToken();
      if (!token) {
        setVerifyError("No hay sesión");
        return;
      }
      const res = await fetch(
        `/api/payments/verify-school?schoolId=${encodeURIComponent(schoolId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (res.ok) setVerifyResult(data);
      else setVerifyError(data?.error ?? `HTTP ${res.status}`);
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setVerifyLoading(false);
    }
  };

  const runManualPayment = async () => {
    if (!schoolId || !manualPlayerId) return;
    setManualLoading(true);
    setManualResponse(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/payments/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          schoolId,
          playerId: manualPlayerId,
          period: manualPeriod,
          amount: Number(manualAmount),
          currency: "ARS",
        }),
      });
      const body = await res.json().catch(() => ({}));
      setManualResponse({ ok: res.ok, body });
    } finally {
      setManualLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isReady || !profile) {
    return <div className="p-8">Cargando…</div>;
  }

  if (!schoolId) {
    return (
      <div className="p-6 space-y-4">
        <Link href="/dashboard/payments" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver a Pagos
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Pruebas de pagos</CardTitle>
            <CardDescription>Seleccioná una escuela activa para probar (desde Ajustes o perfil)</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/payments"
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver a Pagos
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pruebas de pagos y backend</h1>
        <p className="text-muted-foreground text-sm">
          Compará lo que ve la app (frontend) con lo que ve el backend para detectar inconsistencias.
        </p>
      </div>

      {/* Lo que ve la app */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Lo que ve la app (frontend)</CardTitle>
          <CardDescription>Datos que usa esta pantalla: escuela activa y jugadores desde Firestore (cliente)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-muted-foreground font-mono text-xs">ID escuela (activeSchoolId):</Label>
            <code className="text-xs bg-muted px-2 py-1 rounded">{schoolId}</code>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => copyToClipboard(schoolId ?? "", "schoolId")}
            >
              {copied === "schoolId" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Jugadores en esta escuela (colección cliente):</Label>
            <ul className="mt-1 text-sm font-mono space-y-0.5">
              {(players ?? []).length === 0 && <li className="text-muted-foreground">Ninguno cargado</li>}
              {(players ?? []).map((p) => (
                <li key={p.id}>
                  <span className="text-muted-foreground">{p.id}</span> → {[p.lastName, p.firstName].filter(Boolean).join(", ")}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Lo que ve el backend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Lo que ve el backend</CardTitle>
          <CardDescription>Mismo schoolId consultado por la API (Firestore vía firebase-admin)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" onClick={runVerify} disabled={verifyLoading}>
            <Search className="mr-2 h-4 w-4" />
            {verifyLoading ? "Verificando…" : "Consultar verify-school para esta escuela"}
          </Button>
          {verifyError && (
            <p className="text-sm text-destructive">Error: {verifyError}</p>
          )}
          {verifyResult && (
            <div className="rounded bg-muted/50 p-3 text-xs font-mono space-y-1">
              <p><strong>playerCount:</strong> {verifyResult.playerCount}</p>
              <p><strong>playerIds:</strong> {verifyResult.playerIds.join(", ") || "(ninguno)"}</p>
              {Object.keys(verifyResult.players).length > 0 && (
                <p><strong>players (id → nombre):</strong> {JSON.stringify(verifyResult.players)}</p>
              )}
              <pre className="mt-2 overflow-auto max-h-48">{JSON.stringify(verifyResult, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Probar pago manual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Probar pago manual (API)</CardTitle>
          <CardDescription>Envía POST /api/payments/manual con schoolId + playerId. Si falla &quot;jugador no existe&quot;, los IDs no coinciden con lo que ve el backend.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 max-w-xs">
            <Label>Jugador (playerId)</Label>
            <Select value={manualPlayerId} onValueChange={setManualPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegir jugador" />
              </SelectTrigger>
              <SelectContent>
                {[
                  ...new Set([
                    ...(verifyResult?.playerIds ?? []),
                    ...(players?.map((p) => p.id) ?? []),
                  ]),
                ].map((id) => {
                  const name = verifyResult?.players?.[id] ?? (() => {
                    const p = players?.find((x) => x.id === id);
                    return p ? [p.lastName, p.firstName].filter(Boolean).join(", ") : "";
                  })();
                  return (
                    <SelectItem key={id} value={id}>
                      {id} {name ? ` — ${name}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 max-w-xs">
            <Label>Período (YYYY-MM)</Label>
            <Input
              type="text"
              value={manualPeriod}
              onChange={(e) => setManualPeriod(e.target.value)}
              placeholder="2026-02"
            />
          </div>
          <div className="grid gap-2 max-w-xs">
            <Label>Monto (ARS)</Label>
            <Input
              type="number"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
            />
          </div>
          <Button onClick={runManualPayment} disabled={manualLoading || !manualPlayerId}>
            <Send className="mr-2 h-4 w-4" />
            {manualLoading ? "Enviando…" : "Enviar pago manual"}
          </Button>
          {manualResponse && (
            <div className={`rounded p-3 text-xs font-mono ${manualResponse.ok ? "bg-green-500/10" : "bg-destructive/10"}`}>
              <p className="font-semibold">{manualResponse.ok ? "OK" : "Error"}</p>
              <pre className="mt-1 overflow-auto max-h-32">{JSON.stringify(manualResponse.body, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Para webhook/script */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">4. Para webhook o script de simulación</CardTitle>
          <CardDescription>Usá exactamente estos valores. Si el backend vio 0 jugadores, el webhook fallará hasta que proyecto/DB coincidan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs font-mono">
          <p><strong>schoolId:</strong> {schoolId}</p>
          <p><strong>playerIds (del backend):</strong> {(verifyResult?.playerIds ?? []).join(", ") || "— Ejecutá el paso 2 primero"}</p>
          <p className="text-muted-foreground mt-2">
            Ejemplo body webhook: {`{ "schoolId": "${schoolId}", "playerId": "<uno de los playerIds>", "period": "2026-02", "amount": 15000, "currency": "ARS" }`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
