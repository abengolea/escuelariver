"use client";

import React, { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { improveCoachCommentsWithAI } from "@/ai/flows/improve-coach-comments";
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

const evaluationSchema = z.object({
  position: z.enum(["delantero", "mediocampo", "defensor", "arquero"]).optional(),
  coachComments: z.string().min(1, "Los comentarios son requeridos."),
  // Technical skills (jugador de campo)
  control: z.number().min(1).max(5).default(3),
  pase: z.number().min(1).max(5).default(3),
  definicion: z.number().min(1).max(5).default(3),
  dribbling: z.number().min(1).max(5).default(3),
  // Tactical skills (jugador de campo)
  posicionamiento: z.number().min(1).max(5).default(3),
  tomaDeDecision: z.number().min(1).max(5).default(3),
  presion: z.number().min(1).max(5).default(3),
  // Technical skills (arquero)
  reflejos: z.number().min(1).max(5).default(3),
  salida: z.number().min(1).max(5).default(3),
  juegoConLosPies: z.number().min(1).max(5).default(3),
  atajadaColocacion: z.number().min(1).max(5).default(3),
  despeje: z.number().min(1).max(5).default(3),
  // Tactical skills (arquero)
  posicionamientoArco: z.number().min(1).max(5).default(3),
  comunicacionDefensa: z.number().min(1).max(5).default(3),
  // Socio-emotional skills
  respect: z.number().min(1).max(4).default(2),
  responsibility: z.number().min(1).max(4).default(2),
  teamwork: z.number().min(1).max(4).default(2),
  resilience: z.number().min(1).max(4).default(2),
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
    control: 3,
    pase: 3,
    definicion: 3,
    dribbling: 3,
    posicionamiento: 3,
    tomaDeDecision: 3,
    presion: 3,
    reflejos: 3,
    salida: 3,
    juegoConLosPies: 3,
    atajadaColocacion: 3,
    despeje: 3,
    posicionamientoArco: 3,
    comunicacionDefensa: 3,
    respect: 2,
    responsibility: 2,
    teamwork: 2,
    resilience: 2,
};

function getDefaultValuesFromEvaluation(e: Evaluation): EvaluationFormValues {
    return {
        position: e.position ?? undefined,
        coachComments: e.coachComments ?? "",
        control: e.technical?.control ?? 3,
        pase: e.technical?.pase ?? 3,
        definicion: e.technical?.definicion ?? 3,
        dribbling: e.technical?.dribbling ?? 3,
        posicionamiento: e.tactical?.posicionamiento ?? 3,
        tomaDeDecision: e.tactical?.tomaDeDecision ?? 3,
        presion: e.tactical?.presion ?? 3,
        reflejos: e.technical?.reflejos ?? 3,
        salida: e.technical?.salida ?? 3,
        juegoConLosPies: e.technical?.juegoConLosPies ?? 3,
        atajadaColocacion: e.technical?.atajadaColocacion ?? 3,
        despeje: e.technical?.despeje ?? 3,
        posicionamientoArco: e.tactical?.posicionamientoArco ?? 3,
        comunicacionDefensa: e.tactical?.comunicacionDefensa ?? 3,
        respect: e.socioEmotional?.respect ?? 2,
        responsibility: e.socioEmotional?.responsibility ?? 2,
        teamwork: e.socioEmotional?.teamwork ?? 2,
        resilience: e.socioEmotional?.resilience ?? 2,
    };
}

export function AddEvaluationSheet({ playerId, schoolId, isOpen, onOpenChange, playerName, evaluationsSummary = [], editingEvaluation = null }: AddEvaluationSheetProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { profile } = useUserProfile();
    const [isRecording, setRecording] = useState(false);
    const [isImproving, setImproving] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    const isEditMode = Boolean(editingEvaluation?.id);

    const form = useForm<EvaluationFormValues>({
        resolver: zodResolver(evaluationSchema),
        defaultValues: defaultFormValues,
    });

    // Al abrir en modo edición, rellenar el formulario con los datos de la evaluación.
    React.useEffect(() => {
        if (isOpen && editingEvaluation) {
            form.reset(getDefaultValuesFromEvaluation(editingEvaluation));
        } else if (isOpen && !editingEvaluation) {
            form.reset(defaultFormValues);
        }
    }, [isOpen, editingEvaluation?.id]);

    function onSubmit(values: EvaluationFormValues) {
        if (!profile) {
            toast({
                variant: "destructive",
                title: "Error de Perfil",
                description: "No tienes un perfil de usuario para realizar esta acción.",
            });
            return;
        }

        const { coachComments, position, ...ratings } = values;
        const isArquero = position === "arquero";
        const payload = {
            ...(position && { position }),
            coachComments,
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
            updateDoc(docRef, payload)
                .then(() => {
                    toast({ title: "Evaluación actualizada", description: "Los cambios se han guardado correctamente." });
                    form.reset();
                    onOpenChange(false);
                })
                .catch(() => {
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
                });
            return;
        }

        const evaluationData = {
            playerId,
            date: Timestamp.now(),
            ...payload,
            createdAt: Timestamp.now(),
            createdBy: profile.uid,
        };

        const evaluationsCollectionRef = collection(firestore, `schools/${schoolId}/evaluations`);
        addDoc(evaluationsCollectionRef, evaluationData)
            .then(async () => {
                toast({
                    title: "Evaluación guardada",
                    description: "La nueva evaluación ha sido guardada exitosamente.",
                });
                form.reset();
                onOpenChange(false);
                // Notificar por mail al jugador si tiene email
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
            })
            .catch(() => {
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
            });
    }

    const canUseVoice = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

    const toggleVoice = (currentValue: string, onChange: (v: string) => void) => {
        const SpeechRecognitionAPI = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
            ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) return;

        if (isRecording) {
            recognitionRef.current?.stop();
            recognitionRef.current = null;
            setRecording(false);
            return;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.lang = "es-AR";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const transcript = Array.from(event.results)
                .map((r) => r[0].transcript)
                .join("");
            if (transcript) onChange(currentValue ? `${currentValue} ${transcript}` : transcript);
        };
        recognition.onend = () => {
            setRecording(false);
            recognitionRef.current = null;
        };
        recognition.onerror = () => {
            setRecording(false);
            recognitionRef.current = null;
            toast({ variant: "destructive", title: "Error de voz", description: "No se pudo grabar. Prueba de nuevo." });
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
                                                                max={5}
                                                                onValueChange={field.onChange}
                                                            />
                                                        </FormControl>
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
                                                                max={5}
                                                                onValueChange={field.onChange}
                                                            />
                                                        </FormControl>
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
                                                                max={5}
                                                                onValueChange={field.onChange}
                                                            />
                                                        </FormControl>
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
                                                                max={5}
                                                                onValueChange={field.onChange}
                                                            />
                                                        </FormControl>
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
                                                        max={4}
                                                        onValueChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                           
                            <FormField
                                control={form.control}
                                name="coachComments"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Comentarios Generales del Entrenador</FormLabel>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {canUseVoice && (
                                            <Button
                                                type="button"
                                                variant={isRecording ? "destructive" : "outline"}
                                                size="sm"
                                                onClick={() => toggleVoice(field.value, field.onChange)}
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
                                            onClick={() => handleImproveWithAI(field.value)}
                                        >
                                            {isImproving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                                            Mejorar con IA
                                        </Button>
                                    </div>
                                    <FormControl>
                                    <Textarea
                                        placeholder="Escribe o graba con voz. Luego puedes usar «Mejorar con IA» para que quede un texto coherente usando todas las evaluaciones."
                                        className="min-h-[120px]"
                                        {...field}
                                    />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </form>
                    </Form>
                </ScrollArea>
                 <SheetFooter className="pt-4 border-t">
                    <SheetClose asChild>
                        <Button type="button" variant="outline">Cancelar</Button>
                    </SheetClose>
                    <Button type="submit" form="add-evaluation-form" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {form.formState.isSubmitting ? "Guardando..." : isEditMode ? "Guardar cambios" : "Guardar Evaluación"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
