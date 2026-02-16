"use client";

import React, { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Control } from "react-hook-form";
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
import { collection, addDoc, doc, updateDoc, getDoc, Timestamp } from "firebase/firestore";
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
  { value: "delantero", label: "Delantero" },
  { value: "mediocampo", label: "Mediocampo" },
  { value: "defensor", label: "Defensor" },
  { value: "arquero", label: "Arquero" },
];

const MAX_STARS = 10;

const evaluationSchema = z.object({
  position: z.enum(["delantero", "mediocampo", "defensor", "arquero"]).optional(),
  // Validación de coachComments se hace manualmente en onSubmit (evita desincronía estado/DOM)
  coachComments: z.string().optional().default(""),
  /** Comentarios opcionales por rubro (key = nombre del campo, ej. control, pase). Valores pueden venir undefined si no se tocó el campo. */
  rubricComments: z.record(z.union([z.string(), z.undefined()]).transform((s) => (typeof s === "string" ? s : ""))).optional().default({}),
  // Technical skills (jugador de campo) — 1 a 10 estrellas
  control: z.number().min(1).max(MAX_STARS).default(5),
  pase: z.number().min(1).max(MAX_STARS).default(5),
  definicion: z.number().min(1).max(MAX_STARS).default(5),
  dribbling: z.number().min(1).max(MAX_STARS).default(5),
  // Tactical skills (jugador de campo)
  posicionamiento: z.number().min(1).max(MAX_STARS).default(5),
  tomaDeDecision: z.number().min(1).max(MAX_STARS).default(5),
  presion: z.number().min(1).max(MAX_STARS).default(5),
  // Technical skills (arquero)
  reflejos: z.number().min(1).max(MAX_STARS).default(5),
  salida: z.number().min(1).max(MAX_STARS).default(5),
  juegoConLosPies: z.number().min(1).max(MAX_STARS).default(5),
  atajadaColocacion: z.number().min(1).max(MAX_STARS).default(5),
  despeje: z.number().min(1).max(MAX_STARS).default(5),
  // Tactical skills (arquero)
  posicionamientoArco: z.number().min(1).max(MAX_STARS).default(5),
  comunicacionDefensa: z.number().min(1).max(MAX_STARS).default(5),
  // Socio-emotional skills — también 1 a 10
  respect: z.number().min(1).max(MAX_STARS).default(5),
  responsibility: z.number().min(1).max(MAX_STARS).default(5),
  teamwork: z.number().min(1).max(MAX_STARS).default(5),
  resilience: z.number().min(1).max(MAX_STARS).default(5),
});

type EvaluationFormValues = z.infer<typeof evaluationSchema>;

const technicalSkills: { name: keyof EvaluationFormValues, label: string }[] = [
    { name: "control", label: "Control de Balón" },
    { name: "pase", label: "Pase" },
    { name: "definicion", label: "Definición" },
    { name: "dribbling", label: "Dribbling / Gambeta" },
];

const tacticalSkills: { name: keyof EvaluationFormValues, label: string }[] = [
    { name: "posicionamiento", label: "Posicionamiento" },
    { name: "tomaDeDecision", label: "Toma de Decisión" },
    { name: "presion", label: "Presión y Recuperación" },
];

const socioEmotionalSkills: { name: keyof EvaluationFormValues, label: string }[] = [
    { name: "respect", label: "Respeto" },
    { name: "responsibility", label: "Responsabilidad" },
    { name: "teamwork", label: "Compañerismo" },
    { name: "resilience", label: "Resiliencia / Tolerancia a la Frustración" },
];

const arqueroTechnicalSkills: { name: keyof EvaluationFormValues; label: string }[] = [
    { name: "reflejos", label: "Reflejos y reacción" },
    { name: "salida", label: "Salida del arco" },
    { name: "juegoConLosPies", label: "Juego con los pies" },
    { name: "atajadaColocacion", label: "Atajada y colocación" },
    { name: "despeje", label: "Despeje y centro" },
];

const arqueroTacticalSkills: { name: keyof EvaluationFormValues; label: string }[] = [
    { name: "posicionamientoArco", label: "Posicionamiento en el arco" },
    { name: "comunicacionDefensa", label: "Comunicación con la defensa" },
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
    control: 5,
    pase: 5,
    definicion: 5,
    dribbling: 5,
    posicionamiento: 5,
    tomaDeDecision: 5,
    presion: 5,
    reflejos: 5,
    salida: 5,
    juegoConLosPies: 5,
    atajadaColocacion: 5,
    despeje: 5,
    posicionamientoArco: 5,
    comunicacionDefensa: 5,
    respect: 5,
    responsibility: 5,
    teamwork: 5,
    resilience: 5,
};

function getDefaultValuesFromEvaluation(e: Evaluation): EvaluationFormValues {
    return {
        position: e.position ?? undefined,
        coachComments: e.coachComments ?? "",
        rubricComments: e.rubricComments ?? {},
        control: e.technical?.control ?? 5,
        pase: e.technical?.pase ?? 5,
        definicion: e.technical?.definicion ?? 5,
        dribbling: e.technical?.dribbling ?? 5,
        posicionamiento: e.tactical?.posicionamiento ?? 5,
        tomaDeDecision: e.tactical?.tomaDeDecision ?? 5,
        presion: e.tactical?.presion ?? 5,
        reflejos: e.technical?.reflejos ?? 5,
        salida: e.technical?.salida ?? 5,
        juegoConLosPies: e.technical?.juegoConLosPies ?? 5,
        atajadaColocacion: e.technical?.atajadaColocacion ?? 5,
        despeje: e.technical?.despeje ?? 5,
        posicionamientoArco: e.tactical?.posicionamientoArco ?? 5,
        comunicacionDefensa: e.tactical?.comunicacionDefensa ?? 5,
        respect: e.socioEmotional?.respect ?? 5,
        responsibility: e.socioEmotional?.responsibility ?? 5,
        teamwork: e.socioEmotional?.teamwork ?? 5,
        resilience: e.socioEmotional?.resilience ?? 5,
    };
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
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="min-h-[56px] text-sm resize-none"
                    />
                    <div className="flex flex-wrap gap-2">
                        {canUseVoice && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onToggleVoice(field.value ?? "", field.onChange)}
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
                            onClick={() => onImproveWithAI(skillName, skillLabel, field.value ?? "")}
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
        const isArquero = position === "arquero";
        const payload = {
            ...(position && { position }),
            coachComments,
            ...(Object.keys(rubricComments || {}).length > 0 && { rubricComments: rubricComments }),
            technical: isArquero
                ? {
                    reflejos: ratings.reflejos,
                    salida: ratings.salida,
                    juegoConLosPies: ratings.juegoConLosPies,
                    atajadaColocacion: ratings.atajadaColocacion,
                    despeje: ratings.despeje,
                }
                : {
                    control: ratings.control,
                    pase: ratings.pase,
                    definicion: ratings.definicion,
                    dribbling: ratings.dribbling,
                },
            tactical: isArquero
                ? {
                    posicionamientoArco: ratings.posicionamientoArco,
                    comunicacionDefensa: ratings.comunicacionDefensa,
                }
                : {
                    posicionamiento: ratings.posicionamiento,
                    tomaDeDecision: ratings.tomaDeDecision,
                    presion: ratings.presion,
                },
            socioEmotional: {
                respect: ratings.respect,
                responsibility: ratings.responsibility,
                teamwork: ratings.teamwork,
                resilience: ratings.resilience,
            },
        };

        if (isEditMode && editingEvaluation) {
            const docRef = doc(firestore, `schools/${schoolId}/evaluations/${editingEvaluation.id}`);
            try {
                await updateDoc(docRef, payload);
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
                        const subject = "Nueva evaluación - Escuelas River SN";
                        const contentHtml = `<p>Hola <strong>${escapeHtml(firstName)}</strong>,</p><p>Tu entrenador cargó una nueva evaluación. Entrá al panel para verla.</p><p><a href="${typeof window !== "undefined" ? window.location.origin : ""}/dashboard" style="color: #d4002a; font-weight: bold;">Ver mi perfil</a></p>`;
                        const html = buildEmailHtml(contentHtml, {
                            title: "Escuelas River SN",
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
            // Actualizar transcripción por índice (interim y final) para evitar duplicados
            const startIdx = typeof event.resultIndex === "number" ? event.resultIndex : 0;
            for (let i = startIdx; i < event.results.length; i++) {
                const r = event.results[i];
                const t = r[0]?.transcript?.trim();
                if (t) transcriptByIndexRef.current.set(i, t);
            }
            const parts = Array.from(transcriptByIndexRef.current.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([, text]) => text);
            const fullTranscript = parts.join(" ");
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

    const position = form.watch("position");
    const isArquero = position === "arquero";

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
                            : "Califica las habilidades y el comportamiento del jugador. Los cambios se guardarán como una nueva entrada en su historial."}
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

                            {/* Technical + Tactical: cambian según posición (arquero vs campo) */}
                            {isArquero ? (
                                <>
                                    <div className="space-y-4 p-4 border rounded-lg">
                                        <h3 className="font-semibold text-lg">Habilidades Técnicas (Arquero)</h3>
                                        {arqueroTechnicalSkills.map(skill => (
                                            <FormField
                                                key={skill.name}
                                                control={form.control}
                                                name={skill.name as keyof EvaluationFormValues}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{skill.label}</FormLabel>
                                                        <FormControl>
                                                            <StarRating
                                                                value={field.value}
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
                                    <div className="space-y-4 p-4 border rounded-lg">
                                        <h3 className="font-semibold text-lg">Habilidades Tácticas (Arquero)</h3>
                                        {arqueroTacticalSkills.map(skill => (
                                            <FormField
                                                key={skill.name}
                                                control={form.control}
                                                name={skill.name as keyof EvaluationFormValues}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{skill.label}</FormLabel>
                                                        <FormControl>
                                                            <StarRating
                                                                value={field.value}
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
                                </>
                            ) : (
                                <>
                                    <div className="space-y-4 p-4 border rounded-lg">
                                        <h3 className="font-semibold text-lg">Habilidades Técnicas</h3>
                                        {technicalSkills.map(skill => (
                                            <FormField
                                                key={skill.name}
                                                control={form.control}
                                                name={skill.name as keyof EvaluationFormValues}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{skill.label}</FormLabel>
                                                        <FormControl>
                                                            <StarRating
                                                                value={field.value}
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
                                    <div className="space-y-4 p-4 border rounded-lg">
                                        <h3 className="font-semibold text-lg">Habilidades Tácticas</h3>
                                        {tacticalSkills.map(skill => (
                                            <FormField
                                                key={skill.name}
                                                control={form.control}
                                                name={skill.name as keyof EvaluationFormValues}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{skill.label}</FormLabel>
                                                        <FormControl>
                                                            <StarRating
                                                                value={field.value}
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
                                </>
                            )}

                             {/* Socio-emotional Skills */}
                             <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className="font-semibold text-lg">Aspectos Socio-emocionales</h3>
                                {socioEmotionalSkills.map(skill => (
                                     <FormField
                                        key={skill.name}
                                        control={form.control}
                                        name={skill.name as keyof EvaluationFormValues}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{skill.label}</FormLabel>
                                                <FormControl>
                                                    <StarRating
                                                        value={field.value}
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
