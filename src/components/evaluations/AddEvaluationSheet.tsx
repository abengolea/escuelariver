"use client";

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
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";
import { useFirestore, useUserProfile, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "../ui/scroll-area";

const evaluationSchema = z.object({
  coachComments: z.string().min(1, "Los comentarios son requeridos."),
  // Technical skills
  control: z.number().min(1).max(5).default(3),
  pase: z.number().min(1).max(5).default(3),
  definicion: z.number().min(1).max(5).default(3),
  dribbling: z.number().min(1).max(5).default(3),
  // Tactical skills
  posicionamiento: z.number().min(1).max(5).default(3),
  tomaDeDecision: z.number().min(1).max(5).default(3),
  presion: z.number().min(1).max(5).default(3),
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
]

interface AddEvaluationSheetProps {
    playerId: string;
    schoolId: string;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export function AddEvaluationSheet({ playerId, schoolId, isOpen, onOpenChange }: AddEvaluationSheetProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { profile } = useUserProfile();

    const form = useForm<EvaluationFormValues>({
        resolver: zodResolver(evaluationSchema),
        defaultValues: {
            coachComments: "",
            control: 3,
            pase: 3,
            definicion: 3,
            dribbling: 3,
            posicionamiento: 3,
            tomaDeDecision: 3,
            presion: 3,
            respect: 2,
            responsibility: 2,
            teamwork: 2,
            resilience: 2,
        },
    });

    function onSubmit(values: EvaluationFormValues) {
        if (!profile) {
            toast({
                variant: "destructive",
                title: "Error de Perfil",
                description: "No tienes un perfil de usuario para realizar esta acción.",
            });
            return;
        }

        const { coachComments, ...ratings } = values;
        const evaluationData = {
            playerId: playerId,
            date: Timestamp.now(),
            coachComments: coachComments,
            technical: {
                control: ratings.control,
                pase: ratings.pase,
                definicion: ratings.definicion,
                dribbling: ratings.dribbling,
            },
            tactical: {
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
            createdAt: Timestamp.now(),
            createdBy: profile.uid,
        };

        const evaluationsCollectionRef = collection(firestore, `schools/${schoolId}/evaluations`);
        
        addDoc(evaluationsCollectionRef, evaluationData)
            .then(() => {
                toast({
                    title: "Evaluación guardada",
                    description: "La nueva evaluación ha sido guardada exitosamente.",
                });
                form.reset();
                onOpenChange(false);
            })
            .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: `schools/${schoolId}/evaluations`,
                    operation: 'create',
                    requestResourceData: evaluationData,
                });
                errorEmitter.emit('permission-error', permissionError);

                toast({
                    variant: "destructive",
                    title: "Error de permisos",
                    description: "No tienes permiso para crear evaluaciones. Contacta a un administrador.",
                });
            });
    }

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-xl w-full flex flex-col">
                <SheetHeader>
                    <SheetTitle className="font-headline">Nueva Evaluación de Jugador</SheetTitle>
                    <SheetDescription>
                        Califica las habilidades y el comportamiento del jugador. Los cambios se guardarán como una nueva entrada en su historial.
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 -mx-6 px-6">
                    <Form {...form}>
                        <form id="add-evaluation-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 py-4">
                            
                            {/* Technical Skills */}
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className="font-semibold text-lg">Habilidades Técnicas</h3>
                                {technicalSkills.map(skill => (
                                     <FormField
                                        key={skill.name}
                                        control={form.control}
                                        name={skill.name as keyof EvaluationFormValues}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{skill.label} - {field.value}</FormLabel>
                                                <FormControl>
                                                    <Slider
                                                        min={1}
                                                        max={5}
                                                        step={1}
                                                        defaultValue={[field.value]}
                                                        onValueChange={(value) => field.onChange(value[0])}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>

                             {/* Tactical Skills */}
                             <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className="font-semibold text-lg">Habilidades Tácticas</h3>
                                {tacticalSkills.map(skill => (
                                     <FormField
                                        key={skill.name}
                                        control={form.control}
                                        name={skill.name as keyof EvaluationFormValues}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{skill.label} - {field.value}</FormLabel>
                                                <FormControl>
                                                    <Slider
                                                        min={1}
                                                        max={5}
                                                        step={1}
                                                        defaultValue={[field.value]}
                                                        onValueChange={(value) => field.onChange(value[0])}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>

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
                                                <FormLabel>{skill.label} - {field.value}</FormLabel>
                                                <FormControl>
                                                    <Slider
                                                        min={1}
                                                        max={4}
                                                        step={1}
                                                        defaultValue={[field.value]}
                                                        onValueChange={(value) => field.onChange(value[0])}
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
                                    <FormControl>
                                    <Textarea
                                        placeholder="Describe el rendimiento general, actitud, y áreas de mejora..."
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
                        {form.formState.isSubmitting ? "Guardando..." : "Guardar Evaluación"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
