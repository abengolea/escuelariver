"use client";

/// <reference path="@/types/speech-recognition.d.ts" />
import React, { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Control } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
    SheetClose
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/ui/star-rating";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Mic, MicOff, Sparkles } from "lucide-react";
import { useFirestore, useUserProfile, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, addDoc, doc, updateDoc, getDoc, Timestamp, deleteField } from "firebase/firestore";
import { buildEmailHtml, escapeHtml, htmlToPlainText, sendMailDoc } from "@/lib/email";
import type { Evaluation, PlayerPosition } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "../ui/scroll-area";
import { improveCoachCommentsWithAI, improveRubricCommentWithAI } from "@/ai/flows/improve-coach-comments";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/** Valor usado en el Select para "sin posición"; no puede ser "" porque Radix lo reserva para el placeholder. */
const POSITION_NONE = "__none__";

const positionOptions: { value: PlayerPosition; label: string }[] = [
  { value: "arquero", label: "Arquero" },
  { value: "defensor", label: "Defensor" },
  { value: "lateral", label: "Lateral" },
  { value: "mediocampista", label: "Mediocampista" },
  { value: "delantero", label: "Delantero" },
  { value: "extremo", label: "Extremo" },
];

/** Solo posiciones fútbol válidas. Legacy (básquet, mediocampo) se excluye al guardar. */
function normalizePositionForEvaluation(p: string | undefined): PlayerPosition | undefined {
  if (!p) return undefined;
  if (p === "mediocampo") return "mediocampista";
  if (["base", "escolta", "ala", "ala_pivot", "pivot"].includes(p)) return undefined;
  return p as PlayerPosition;
}

const MAX_STARS = 10;

/** Rúbrica de jugadores de campo (se guarda en `technical` si la posición no es arquero). */
const OUTFIELD_RUBRIC_KEYS = [
  "controlPase",
  "recepcionPecho",
  "cabezazo",
  "remateArco",
  "dribbling",
  "defensa",
  "dominioBalon",
] as const;

/** Rúbrica de arqueros (se guarda en `technical` si la posición es arquero). */
const GOALKEEPER_RUBRIC_KEYS = [
  "posicionInicial",
  "pasesManoPie",
  "tomaBaja",
  "tomaMedia",
  "tomaAlta",
  "tomaBajaConCaida",
  "caidaDerecha",
  "caidaIzquierda",
  "saltos",
  "salidaPunos",
] as const;

const ALL_RUBRIC_KEYS = [...OUTFIELD_RUBRIC_KEYS, ...GOALKEEPER_RUBRIC_KEYS] as const;

type OutfieldRubricKey = (typeof OUTFIELD_RUBRIC_KEYS)[number];

const evaluationSchema = z.object({
  // Solo fútbol en UI. Aceptamos legacy (básquet, mediocampo) para cargar evaluaciones existentes.
  position: z
    .union([
      z.enum(["arquero", "defensor", "lateral", "mediocampista", "mediocampo", "delantero", "extremo"]),
      z.enum(["base", "escolta", "ala", "ala_pivot", "pivot"]),
    ])
    .optional(),
  // Validación de coachComments se hace manualmente en onSubmit (evita desincronía estado/DOM)
  coachComments: z.string().optional().default(""),
  /** Comentarios opcionales por rubro (key = nombre del campo). Valores pueden venir undefined si no se tocó el campo. */
  rubricComments: z.record(z.union([z.string(), z.undefined()]).transform((s) => (typeof s === "string" ? s : ""))).optional().default({}),
  controlPase: z.number().min(1).max(MAX_STARS).default(5),
  recepcionPecho: z.number().min(1).max(MAX_STARS).default(5),
  cabezazo: z.number().min(1).max(MAX_STARS).default(5),
  remateArco: z.number().min(1).max(MAX_STARS).default(5),
  dribbling: z.number().min(1).max(MAX_STARS).default(5),
  defensa: z.number().min(1).max(MAX_STARS).default(5),
  dominioBalon: z.number().min(1).max(MAX_STARS).default(5),
  posicionInicial: z.number().min(1).max(MAX_STARS).default(5),
  pasesManoPie: z.number().min(1).max(MAX_STARS).default(5),
  tomaBaja: z.number().min(1).max(MAX_STARS).default(5),
  tomaMedia: z.number().min(1).max(MAX_STARS).default(5),
  tomaAlta: z.number().min(1).max(MAX_STARS).default(5),
  tomaBajaConCaida: z.number().min(1).max(MAX_STARS).default(5),
  caidaDerecha: z.number().min(1).max(MAX_STARS).default(5),
  caidaIzquierda: z.number().min(1).max(MAX_STARS).default(5),
  saltos: z.number().min(1).max(MAX_STARS).default(5),
  salidaPunos: z.number().min(1).max(MAX_STARS).default(5),
});

type EvaluationFormValues = z.infer<typeof evaluationSchema>;

const rubricSkillsOutfield: { name: OutfieldRubricKey; label: string }[] = [
  { name: "controlPase", label: "Control y pase" },
  { name: "recepcionPecho", label: "Recepción de pecho" },
  { name: "cabezazo", label: "Cabezazo" },
  { name: "remateArco", label: "Remate al arco" },
  { name: "dribbling", label: "Dribbling" },
  { name: "defensa", label: "Defensa" },
  { name: "dominioBalon", label: "Dominio de balón (jueguitos)" },
];

const rubricSkillsGoalkeeper: { name: (typeof GOALKEEPER_RUBRIC_KEYS)[number]; label: string }[] = [
  { name: "posicionInicial", label: "Posición inicial" },
  { name: "pasesManoPie", label: "Pases de mano y pie" },
  { name: "tomaBaja", label: "Toma baja" },
  { name: "tomaMedia", label: "Toma media" },
  { name: "tomaAlta", label: "Toma alta" },
  { name: "tomaBajaConCaida", label: "Toma baja con caída" },
  { name: "caidaDerecha", label: "Caída derecha" },
  { name: "caidaIzquierda", label: "Caída izquierda" },
  { name: "saltos", label: "Saltos" },
  { name: "salidaPunos", label: "Salidas de puños" },
];

/** Evaluación mínima para contexto de IA (fecha + comentarios). */
export type EvaluationSummaryForAI = { date: Date; coachComments: string };

interface AddEvaluationSheetProps {
    playerId: string;
    schoolId: string;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    /** Nombre del jugador (para "Mejorar con IA"). */
    playerName?: string;
    /** Evaluaciones anteriores del jugador (para que la IA mejore el texto con contexto). */
    evaluationsSummary?: EvaluationSummaryForAI[];
    /** Si se pasa, el sheet abre en modo edición con estos datos. */
    editingEvaluation?: Evaluation | null;
}

const defaultFormValues: EvaluationFormValues = {
    position: undefined,
    coachComments: "",
    rubricComments: {},
    controlPase: 5,
    recepcionPecho: 5,
    cabezazo: 5,
    remateArco: 5,
    dribbling: 5,
    defensa: 5,
    dominioBalon: 5,
    posicionInicial: 5,
    pasesManoPie: 5,
    tomaBaja: 5,
    tomaMedia: 5,
    tomaAlta: 5,
    tomaBajaConCaida: 5,
    caidaDerecha: 5,
    caidaIzquierda: 5,
    saltos: 5,
    salidaPunos: 5,
};

function pickRubricComments(raw: Record<string, string> | undefined): Record<string, string> {
    if (!raw) return {};
    const next: Record<string, string> = {};
    for (const key of ALL_RUBRIC_KEYS) {
        const v = raw[key];
        if (typeof v === "string" && v.length) next[key] = v;
    }
    return next;
}

/** Comentarios por rubro al editar: preserva claves nuevas y reutiliza texto de rubros viejos si aplica. */
function mergeLegacyRubricComments(raw: Record<string, string> | undefined): Record<string, string> {
    const r = raw ?? {};
    const out = pickRubricComments(r);
    const setIfEmpty = (key: OutfieldRubricKey, legacyVal: string | undefined) => {
        const v = legacyVal?.trim();
        if (v && !out[key]?.trim()) out[key] = v;
    };
    setIfEmpty("controlPase", r.pase ?? r.control ?? r.manejo);
    setIfEmpty("dominioBalon", r.manejo ?? r.control);
    setIfEmpty("remateArco", r.tiro ?? r.definicion);
    return pickRubricComments(out);
}

/** Carga evaluaciones viejas: mapea campos legacy a la rúbrica de campo cuando faltan claves; arqueros usan solo rúbrica de arco. */
function getDefaultValuesFromEvaluation(e: Evaluation): EvaluationFormValues {
    const t = e.technical ?? {};
    const tact = e.tactical ?? {};
    const isGk = e.position === "arquero";
    const legacyManejoCtrl = (t.manejo ?? t.control) as number | undefined;
    const legacyPase = t.pase as number | undefined;
    const outfield = {
        controlPase: (t.controlPase as number | undefined) ?? legacyPase ?? legacyManejoCtrl ?? 5,
        recepcionPecho: (t.recepcionPecho as number | undefined) ?? 5,
        cabezazo: (t.cabezazo as number | undefined) ?? 5,
        remateArco: (t.remateArco as number | undefined) ?? (t.tiro as number | undefined) ?? (t.definicion as number | undefined) ?? 5,
        dribbling: (t.dribbling as number | undefined) ?? 5,
        defensa: (t.defensa as number | undefined) ?? (tact.defensa as number | undefined) ?? (tact.presion as number | undefined) ?? 5,
        dominioBalon: (t.dominioBalon as number | undefined) ?? legacyManejoCtrl ?? legacyPase ?? 5,
    };
    const goalkeeper = {
        posicionInicial: (t.posicionInicial as number | undefined) ?? 5,
        pasesManoPie: (t.pasesManoPie as number | undefined) ?? 5,
        tomaBaja: (t.tomaBaja as number | undefined) ?? 5,
        tomaMedia: (t.tomaMedia as number | undefined) ?? 5,
        tomaAlta: (t.tomaAlta as number | undefined) ?? 5,
        tomaBajaConCaida: (t.tomaBajaConCaida as number | undefined) ?? 5,
        caidaDerecha: (t.caidaDerecha as number | undefined) ?? 5,
        caidaIzquierda: (t.caidaIzquierda as number | undefined) ?? 5,
        saltos: (t.saltos as number | undefined) ?? 5,
        salidaPunos: (t.salidaPunos as number | undefined) ?? 5,
    };
    const shared = {
        position: e.position ?? undefined,
        coachComments: e.coachComments ?? "",
        rubricComments: mergeLegacyRubricComments(e.rubricComments as Record<string, string> | undefined),
    };
    if (isGk) {
        return { ...defaultFormValues, ...shared, ...goalkeeper };
    }
    return { ...defaultFormValues, ...shared, ...outfield };
}

/** Comentario por rubro usando FormField para evitar re-renders que quitan el foco del textarea. */
function RubricCommentField({
    control,
    skillName,
    skillLabel,
    canUseVoice,
    isRecording,
    onToggleVoice,
    onImproveWithAI,
    improvingKey,
}: {
    control: Control<EvaluationFormValues>;
    skillName: string;
    skillLabel: string;
    canUseVoice: boolean;
    isRecording: boolean;
    onToggleVoice: (value: string, onChange: (v: string) => void) => void;
    onImproveWithAI: (rubricKey: string, rubricLabel: string, currentDraft: string) => void;
    improvingKey: string | null;
}) {
    return (
        <FormField
            control={control}
            name={`rubricComments.${skillName}` as keyof EvaluationFormValues}
            render={({ field }) => (
                <div className="mt-2 space-y-1.5">
                    <Textarea
                        placeholder={`Comentario opcional para ${skillLabel}… Escribí o usá "Hablar" y después "Mejorar con IA".`}
                        value={typeof field.value === "string" ? field.value : ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="min-h-[56px] text-sm resize-none"
                    />
                    <div className="flex flex-wrap gap-2">
                        {canUseVoice && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onToggleVoice(typeof field.value === "string" ? field.value : "", field.onChange)}
                            >
                                {isRecording ? <MicOff className="h-3 w-3 mr-1" /> : <Mic className="h-3 w-3 mr-1" />}
                                {isRecording ? "Detener" : "Hablar"}
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={improvingKey !== null}
                            onClick={() => onImproveWithAI(skillName, skillLabel, typeof field.value === "string" ? field.value : "")}
                        >
                            {improvingKey === skillName ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                                <Sparkles className="h-3 w-3 mr-1" />
                            )}
                            Mejorar con IA
                        </Button>
                    </div>
                </div>
            )}
        />
    );
}

export function AddEvaluationSheet({ playerId, schoolId, isOpen, onOpenChange, playerName, evaluationsSummary = [], editingEvaluation = null }: AddEvaluationSheetProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { profile } = useUserProfile();
    const [isRecording, setRecording] = useState(false);
    const [isImproving, setImproving] = useState(false);
    const [improvingRubricKey, setImprovingRubricKey] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const coachCommentsRef = useRef<HTMLTextAreaElement | null>(null);
    const transcriptByIndexRef = useRef<Map<number, string>>(new Map());

    const isEditMode = Boolean(editingEvaluation?.id);

    const form = useForm<EvaluationFormValues>({
        resolver: zodResolver(evaluationSchema),
        defaultValues: defaultFormValues,
    });

    const watchedPosition = useWatch({ control: form.control, name: "position" });
    const isGoalkeeperRubric = watchedPosition === "arquero";
    const rubricSkillsActive = isGoalkeeperRubric ? rubricSkillsGoalkeeper : rubricSkillsOutfield;

    // Solo resetear al abrir el sheet (no mientras está abierto), para no borrar lo que escribe el usuario.
    const prevOpenRef = React.useRef(false);
    React.useEffect(() => {
        const justOpened = isOpen && !prevOpenRef.current;
        prevOpenRef.current = isOpen;
        if (!justOpened) return;
        if (editingEvaluation) {
            form.reset(getDefaultValuesFromEvaluation(editingEvaluation));
        } else {
            form.reset(defaultFormValues);
        }
    }, [isOpen, editingEvaluation?.id]);

    async function onSubmit(values: EvaluationFormValues) {
        if (!profile) {
            toast({
                variant: "destructive",
                title: "Error de Perfil",
                description: "No tienes un perfil de usuario para realizar esta acción.",
            });
            return;
        }

        // Validación manual de comentarios: usar estado y, si viene vacío, valor del DOM (evita desincronía)
        let coachComments = (values.coachComments ?? "").trim();
        if (!coachComments && coachCommentsRef.current?.value) {
            coachComments = (coachCommentsRef.current.value ?? "").trim();
            if (coachComments) form.setValue("coachComments", coachCommentsRef.current.value);
        }
        if (!coachComments) {
            toast({
                variant: "destructive",
                title: "Completa los datos",
                description: "Los Comentarios Generales del Entrenador son obligatorios. Escribí al menos un carácter (no solo espacios).",
            });
            return;
        }

        const { position, rubricComments, ...ratings } = values;
        const normalizedPosition =
          position && position !== "mediocampo" && !["base", "escolta", "ala", "ala_pivot", "pivot"].includes(position)
            ? position
            : position === "mediocampo"
              ? "mediocampista"
              : undefined;
        const rubricForSave = pickRubricComments(rubricComments as Record<string, string>);
        const isGkEval = normalizedPosition === "arquero";
        const technical = isGkEval
            ? {
                  posicionInicial: ratings.posicionInicial,
                  pasesManoPie: ratings.pasesManoPie,
                  tomaBaja: ratings.tomaBaja,
                  tomaMedia: ratings.tomaMedia,
                  tomaAlta: ratings.tomaAlta,
                  tomaBajaConCaida: ratings.tomaBajaConCaida,
                  caidaDerecha: ratings.caidaDerecha,
                  caidaIzquierda: ratings.caidaIzquierda,
                  saltos: ratings.saltos,
                  salidaPunos: ratings.salidaPunos,
              }
            : {
                  controlPase: ratings.controlPase,
                  recepcionPecho: ratings.recepcionPecho,
                  cabezazo: ratings.cabezazo,
                  remateArco: ratings.remateArco,
                  dribbling: ratings.dribbling,
                  defensa: ratings.defensa,
                  dominioBalon: ratings.dominioBalon,
              };
        const payload = {
            ...(normalizedPosition && { position: normalizedPosition }),
            coachComments,
            ...(Object.keys(rubricForSave).length > 0 && { rubricComments: rubricForSave }),
            technical,
        };

        if (isEditMode && editingEvaluation) {
            const docRef = doc(firestore, `schools/${schoolId}/evaluations/${editingEvaluation.id}`);
            try {
                await updateDoc(docRef, {
                    ...payload,
                    tactical: deleteField(),
                    socioEmotional: deleteField(),
                });
                toast({ title: "Evaluación actualizada", description: "Los cambios se han guardado correctamente." });
                form.reset();
                onOpenChange(false);
            } catch {
                errorEmitter.emit("permission-error", new FirestorePermissionError({
                    path: `schools/${schoolId}/evaluations/${editingEvaluation.id}`,
                    operation: "update",
                    requestResourceData: payload,
                }));
                toast({
                    variant: "destructive",
                    title: "Error de permisos",
                    description: "No tienes permiso para modificar esta evaluación.",
                });
            }
            return;
        }

        const evaluationData = {
            playerId,
            date: Timestamp.now(),
            ...payload,
            createdAt: Timestamp.now(),
            createdBy: profile.uid,
            evaluatedByName: profile.displayName?.trim() || profile.email || "Entrenador",
        };

        const evaluationsCollectionRef = collection(firestore, `schools/${schoolId}/evaluations`);
        try {
            await addDoc(evaluationsCollectionRef, evaluationData);
            toast({
                title: "Evaluación guardada",
                description: "La nueva evaluación ha sido guardada exitosamente.",
            });
            form.reset();
            onOpenChange(false);
            // Enviar mail en segundo plano para no bloquear la UI
            (async () => {
                try {
                    const playerRef = doc(firestore, `schools/${schoolId}/players/${playerId}`);
                    const playerSnap = await getDoc(playerRef);
                    const playerData = playerSnap.data();
                    const playerEmail = playerData?.email?.trim?.();
                    const firstName = playerData?.firstName ?? playerName ?? "jugador";
                    if (playerEmail) {
                        const subject = "Nueva evaluación - Escuelas River";
                        const contentHtml = `<p>Hola <strong>${escapeHtml(firstName)}</strong>,</p><p>Tu entrenador cargó una nueva evaluación. Entrá al panel para verla.</p><p><a href="${typeof window !== "undefined" ? window.location.origin : ""}/dashboard" style="color: hsl(var(--primary)); font-weight: bold;">Ver mi perfil</a></p>`;
                        const html = buildEmailHtml(contentHtml, {
                            title: "Escuelas River",
                            greeting: "Tenés una novedad en tu perfil.",
                            baseUrl: typeof window !== "undefined" ? window.location.origin : "",
                        });
                        await sendMailDoc(firestore, { to: playerEmail, subject, html, text: htmlToPlainText(contentHtml) });
                    }
                } catch {
                    // No bloquear si falla el envío del mail
                }
            })();
        } catch {
            errorEmitter.emit("permission-error", new FirestorePermissionError({
                path: `schools/${schoolId}/evaluations`,
                operation: "create",
                requestResourceData: evaluationData,
            }));
            toast({
                variant: "destructive",
                title: "Error de permisos",
                description: "No tienes permiso para crear evaluaciones. Contacta a un administrador.",
            });
        }
    }

    const canUseVoice = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

    const toggleVoice = async (currentValue: string, onChange: (v: string) => void) => {
        const SpeechRecognitionAPI = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
            ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) return;

        if (isRecording) {
            recognitionRef.current?.stop();
            recognitionRef.current = null;
            setRecording(false);
            return;
        }

        transcriptByIndexRef.current = new Map();
        const baseValue = currentValue ?? "";

        // Pedir permiso de micrófono antes (ayuda en localhost y evita errores silenciosos)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((t) => t.stop());
        } catch {
            toast({
                variant: "destructive",
                title: "Error de voz",
                description: "Permiso de micrófono denegado o no disponible. Revisá la configuración del navegador.",
            });
            return;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.lang = "es-AR";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const startIdx = typeof event.resultIndex === "number" ? event.resultIndex : 0;
            for (let i = startIdx; i < event.results.length; i++) {
                const r = event.results[i];
                const t = r[0]?.transcript?.trim();
                if (t) transcriptByIndexRef.current.set(i, t);
            }
            const parts = Array.from(transcriptByIndexRef.current.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([, text]) => text);
            // En Chrome móvil la API repite la misma frase varias veces; filtrar duplicados consecutivos
            const deduped = parts.filter((p, i) => i === 0 || p !== parts[i - 1]);
            const fullTranscript = deduped.join(" ");
            if (fullTranscript) onChange(baseValue ? `${baseValue} ${fullTranscript}` : fullTranscript);
        };
        recognition.onend = () => {
            setRecording(false);
            recognitionRef.current = null;
        };
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            setRecording(false);
            recognitionRef.current = null;
            const err = event.error;
            let desc = "No se pudo grabar. Prueba de nuevo.";
            if (err === "not-allowed") desc = "Permiso de micrófono denegado. Revisá la configuración del navegador.";
            else if (err === "no-speech") desc = "No se detectó voz. Hablá más cerca del micrófono.";
            else if (err === "audio-capture") desc = "No se encontró micrófono o está en uso por otra app.";
            else if (err === "network") desc = "El servicio de voz no respondió. Si tenés internet, probá desactivar VPN/firewall o usar otro navegador (Chrome suele funcionar mejor).";
            toast({ variant: "destructive", title: "Error de voz", description: desc });
        };
        recognitionRef.current = recognition;
        recognition.start();
        setRecording(true);
    };

    const handleImproveWithAI = async (currentDraft: string) => {
        const name = playerName ?? "el jugador";
        setImproving(true);
        try {
            const previousSummary = evaluationsSummary.length > 0
                ? evaluationsSummary
                    .map((e) => `Evaluación del ${format(e.date, "PPP", { locale: es })}: ${e.coachComments || "(sin comentarios)"}`)
                    .join("\n\n")
                : "Sin evaluaciones anteriores.";
            const result = await improveCoachCommentsWithAI({
                playerName: name,
                previousEvaluationsSummary: previousSummary,
                currentDraft: currentDraft || "(El entrenador no escribió nada aún; genera un comentario breve y alentador basado en el historial si hay datos.)",
            });
            form.setValue("coachComments", result.improvedText);
            toast({ title: "Texto mejorado", description: "Los comentarios se han redactado con IA." });
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Error al mejorar con IA",
                description: err instanceof Error ? err.message : "No se pudo generar el texto.",
            });
        } finally {
            setImproving(false);
        }
    };

    const handleImproveRubricComment = async (rubricKey: string, rubricLabel: string, currentDraft: string) => {
        const name = playerName ?? "el jugador";
        setImprovingRubricKey(rubricKey);
        try {
            const result = await improveRubricCommentWithAI({
                playerName: name,
                rubricLabel,
                currentDraft: currentDraft.trim() || "(sin texto)",
            });
            const current = form.getValues("rubricComments") ?? {};
            form.setValue("rubricComments", { ...current, [rubricKey]: result.improvedText });
            toast({ title: "Comentario mejorado", description: `Texto del rubro "${rubricLabel}" redactado con IA.` });
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Error al mejorar con IA",
                description: err instanceof Error ? err.message : "No se pudo generar el texto.",
            });
        } finally {
            setImprovingRubricKey(null);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-xl w-full flex flex-col">
                <SheetHeader>
                    <SheetTitle className="font-headline">
                        {isEditMode ? "Editar Evaluación" : "Nueva Evaluación de Jugador"}
                    </SheetTitle>
                    <SheetDescription>
                        {isEditMode
                            ? "Modifica las calificaciones y comentarios. La fecha de la evaluación no cambia."
                            : "Califica solo los rubros acordados (técnica). Los cambios se guardarán como una nueva entrada en su historial."}
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 -mx-6 px-6">
                    <Form {...form}>
                        <form id="add-evaluation-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 py-4">

                            {/* Posición del jugador */}
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className="font-semibold text-lg">Posición del jugador</h3>
                                <FormField
                                    control={form.control}
                                    name="position"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>¿En qué posición califica mejor al jugador?</FormLabel>
                                            <Select
                                                onValueChange={(v) => field.onChange(v === POSITION_NONE ? undefined : (v as PlayerPosition))}
                                                value={field.value ?? POSITION_NONE}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecciona una posición (opcional)" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value={POSITION_NONE}>Sin especificar</SelectItem>
                                                    {positionOptions.map((opt) => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className="font-semibold text-lg">Rúbrica deportiva</h3>
                                <p className="text-sm text-muted-foreground">
                                    {isGoalkeeperRubric
                                        ? "Posición inicial, pases con mano y pie, tomas altas/medias/bajas, toma baja con caída, caídas, saltos y salidas de puños."
                                        : "Control y pase, recepción de pecho, cabezazo, remate al arco, dribbling, defensa y dominio de balón (jueguitos)."}
                                </p>
                                {rubricSkillsActive.map((skill) => (
                                    <FormField
                                        key={skill.name}
                                        control={form.control}
                                        name={skill.name}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{skill.label}</FormLabel>
                                                <FormControl>
                                                    <StarRating
                                                        value={typeof field.value === "number" ? field.value : 5}
                                                        max={MAX_STARS}
                                                        size={22}
                                                        onValueChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <RubricCommentField
                                                    control={form.control}
                                                    skillName={skill.name}
                                                    skillLabel={skill.label}
                                                    canUseVoice={canUseVoice}
                                                    isRecording={isRecording}
                                                    onToggleVoice={toggleVoice}
                                                    onImproveWithAI={handleImproveRubricComment}
                                                    improvingKey={improvingRubricKey}
                                                />
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                           
                            {/* Comentarios Generales: register() para que el valor esté siempre sincronizado con el formulario */}
                            <div className="space-y-2">
                                <Label htmlFor="coachComments">Comentarios Generales del Entrenador <span className="text-destructive">*</span></Label>
                                <p className="text-xs text-muted-foreground">Único campo obligatorio. Escribí al menos un carácter (no solo espacios).</p>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {canUseVoice && (
                                        <Button
                                            type="button"
                                            variant={isRecording ? "destructive" : "outline"}
                                            size="sm"
                                            onClick={() => toggleVoice(form.getValues("coachComments") ?? "", (v) => form.setValue("coachComments", v))}
                                        >
                                            {isRecording ? <MicOff className="h-4 w-4 mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
                                            {isRecording ? "Detener grabación" : "Hablar (transcribir)"}
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={isImproving}
                                        onClick={() => handleImproveWithAI(form.getValues("coachComments") ?? "")}
                                    >
                                        {isImproving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                                        Mejorar con IA
                                    </Button>
                                </div>
                                {(() => {
                                    const { ref: regRef, ...regRest } = form.register("coachComments", {
                                        setValueAs: (v) => (typeof v === "string" ? v : ""),
                                    });
                                    return (
                                        <Textarea
                                            id="coachComments"
                                            placeholder="Escribe o graba con voz. Luego puedes usar «Mejorar con IA» para que quede un texto coherente usando todas las evaluaciones."
                                            className="min-h-[120px]"
                                            {...regRest}
                                            ref={(el) => {
                                                coachCommentsRef.current = el;
                                                if (typeof regRef === "function") regRef(el);
                                                else if (regRef) (regRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                                            }}
                                        />
                                    );
                                })()}
                            </div>
                        </form>
                    </Form>
                </ScrollArea>
                 <SheetFooter className="pt-4 border-t">
                    <SheetClose asChild>
                        <Button type="button" variant="outline">Cancelar</Button>
                    </SheetClose>
                    <Button
                        type="button"
                        disabled={form.formState.isSubmitting}
                        onClick={() => {
                            // Forzar sincronía: leer valor del DOM y llevarlo al form antes de validar (evita race con RHF)
                            const domValue = coachCommentsRef.current?.value ?? "";
                            if (domValue !== form.getValues("coachComments")) {
                                form.setValue("coachComments", domValue, { shouldValidate: false });
                            }
                            form.handleSubmit(onSubmit, (errors) => {
                                // Mensaje según el campo que falló (no asumir siempre coachComments)
                                const firstKey = Object.keys(errors)[0];
                                const firstErr = firstKey ? errors[firstKey as keyof typeof errors] : null;
                                const message = firstErr && typeof firstErr === "object" && "message" in firstErr
                                    ? String((firstErr as { message?: string }).message)
                                    : null;
                                const description = firstKey === "coachComments"
                                    ? (message ?? "Solo los Comentarios Generales del Entrenador son obligatorios.")
                                    : firstKey === "rubricComments"
                                        ? (message ?? "Revisá los comentarios opcionales por rubro (algún valor no es válido).")
                                        : (message ?? "Revisá los campos marcados.");
                                toast({
                                    variant: "destructive",
                                    title: "Error de validación",
                                    description,
                                });
                            })();
                        }}
                    >
                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {form.formState.isSubmitting ? "Guardando..." : isEditMode ? "Guardar cambios" : "Guardar Evaluación"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
