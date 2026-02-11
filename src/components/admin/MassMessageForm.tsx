"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile, useCollection, useFirestore } from "@/firebase";
import type { Player } from "@/lib/types";
import { getCategoryLabel } from "@/lib/utils";
import { buildEmailHtml, htmlToPlainText, sendMailDoc } from "@/lib/email";
import { improveMassMessageWithAI } from "@/ai/flows/improve-mass-message";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Mail, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Categorías de edad (SUB-9, SUB-10, ...) derivadas de los jugadores. */
function getCategoriesFromPlayers(players: Player[]): string[] {
  const set = new Set<string>();
  for (const p of players) {
    if (p.birthDate) {
      set.add(getCategoryLabel(p.birthDate instanceof Date ? p.birthDate : new Date(p.birthDate)));
    }
  }
  return Array.from(set).sort((a, b) => {
    const nA = parseInt(a.replace("U", ""), 10);
    const nB = parseInt(b.replace("U", ""), 10);
    return nA - nB;
  });
}

/** Jugadores con email válido. */
function playersWithEmail(players: Player[]): Player[] {
  return players.filter((p) => p.email?.trim());
}

/** Filtra jugadores por categorías seleccionadas (o todos si allSelected). */
function filterByCategories(
  players: Player[],
  allSelected: boolean,
  selectedCategories: Set<string>
): Player[] {
  if (allSelected) return players;
  return players.filter((p) => {
    if (!p.birthDate) return false;
    const cat = getCategoryLabel(p.birthDate instanceof Date ? p.birthDate : new Date(p.birthDate));
    return selectedCategories.has(cat);
  });
}

export function MassMessageForm() {
  const { profile, activeSchoolId } = useUserProfile();
  const firestore = useFirestore();
  const { toast } = useToast();

  const { data: playersData, loading: playersLoading } = useCollection<Player>(
    activeSchoolId ? `schools/${activeSchoolId}/players` : "",
    {}
  );
  const players = (Array.isArray(playersData) ? playersData : []).filter((p) => !p.archived);

  const [allSelected, setAllSelected] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [improving, setImproving] = useState(false);

  const categories = useMemo(() => getCategoriesFromPlayers(players), [players]);
  const withEmail = useMemo(() => playersWithEmail(players), [players]);
  const filtered = useMemo(
    () => filterByCategories(withEmail, allSelected, selectedCategories),
    [withEmail, allSelected, selectedCategories]
  );

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleAll = () => {
    setAllSelected((prev) => !prev);
    if (!allSelected) setSelectedCategories(new Set());
  };

  const handleImproveWithAI = async () => {
    setImproving(true);
    try {
      const result = await improveMassMessageWithAI({
        subject: subject.trim(),
        body: body.trim(),
      });
      setSubject(result.subject);
      setBody(result.body);
      toast({
        title: "Ayuda de redacción",
        description: "Se sugirió un asunto y mensaje. Podés editarlos antes de enviar.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al mejorar con IA",
        description: err instanceof Error ? err.message : "No se pudo generar la sugerencia.",
      });
    } finally {
      setImproving(false);
    }
  };

  const handleSend = async () => {
    const sub = subject.trim();
    const content = body.trim();
    if (!sub) {
      toast({
        variant: "destructive",
        title: "Asunto requerido",
        description: "Escribí el asunto del mensaje.",
      });
      return;
    }
    if (!content) {
      toast({
        variant: "destructive",
        title: "Mensaje requerido",
        description: "Escribí el contenido del mensaje.",
      });
      return;
    }
    if (filtered.length === 0) {
      toast({
        variant: "destructive",
        title: "Sin destinatarios",
        description: "No hay jugadores con email en la selección. Agregá emails en los perfiles o elegí otras categorías.",
      });
      return;
    }

    setSending(true);
    try {
      const contentHtml = content.replace(/\n/g, "<br>");
      const html = buildEmailHtml(contentHtml, {
        title: "Escuelas River SN",
        baseUrl: typeof window !== "undefined" ? window.location.origin : "",
        greeting: "Mensaje de tu escuela:",
      });
      const text = htmlToPlainText(contentHtml);

      for (const player of filtered) {
        const to = player.email!.trim().toLowerCase();
        await sendMailDoc(firestore, { to, subject: sub, html, text });
      }

      toast({
        title: "Mensajes encolados",
        description: `Se encolaron ${filtered.length} correos. La extensión Trigger Email los enviará en breve.`,
      });
      setSubject("");
      setBody("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al encolar los correos.";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setSending(false);
    }
  };

  if (profile?.role !== "school_admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enviar mensajes</CardTitle>
          <CardDescription>Solo el administrador de la escuela puede enviar mensajes masivos.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (playersLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Cargando jugadores…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Enviar mensaje a los chicos
        </CardTitle>
        <CardDescription>
          Elegí destinatarios por categoría (o todos). Solo reciben el correo los jugadores que tienen email cargado en su perfil. Los envíos se realizan mediante Trigger Email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Destinatarios</Label>
          <p className="text-xs text-muted-foreground">
            Hacé clic en &quot;Todos&quot; o en cada categoría para sumar o quitar.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleAll}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                allSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent"
              )}
            >
              Todos
            </button>
            {categories.map((cat) => {
              const selected = allSelected || selectedCategories.has(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setAllSelected(false);
                    toggleCategory(cat);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {filtered.length} jugador{filtered.length !== 1 ? "es" : ""} con email recibirán el mensaje.
            {withEmail.length < players.length && (
              <> {players.length - withEmail.length} no tienen email cargado.</>
            )}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mass-subject">Asunto</Label>
          <Input
            id="mass-subject"
            placeholder="Ej: Próximo entrenamiento"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="mass-body">Mensaje</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    disabled={improving}
                    onClick={handleImproveWithAI}
                    aria-label="Ayuda de redacción con IA"
                  >
                    {improving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ayuda de redacción con IA</p>
                  <p className="text-xs text-muted-foreground">Mejora o sugiere asunto y mensaje</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Textarea
            id="mass-body"
            placeholder="Escribí el mensaje que recibirán por correo. Podés usar el botón de ayuda (✨) para que la IA sugiera o mejore el texto."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="resize-y"
          />
        </div>

        <Button onClick={handleSend} disabled={sending || filtered.length === 0}>
          {sending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando…
            </>
          ) : (
            <>Enviar a {filtered.length} destinatario{filtered.length !== 1 ? "s" : ""}</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
