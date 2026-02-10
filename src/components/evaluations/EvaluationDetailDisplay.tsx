"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Evaluation } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface EvaluationDetailDisplayProps {
  evaluation: Evaluation;
  schoolId: string;
  onDeleted: () => void;
  onEditClick: (evaluation: Evaluation) => void;
}

const positionLabels: Record<string, string> = {
  delantero: "Delantero",
  mediocampo: "Mediocampo",
  defensor: "Defensor",
  arquero: "Arquero",
};

const skillLabels: Record<string, string> = {
    control: "Control de Balón",
    pase: "Pase",
    definicion: "Definición",
    dribbling: "Dribbling",
    posicionamiento: "Posicionamiento",
    tomaDeDecision: "Toma de Decisión",
    presion: "Presión y Recuperación",
    // Arquero
    reflejos: "Reflejos y reacción",
    salida: "Salida del arco",
    juegoConLosPies: "Juego con los pies",
    atajadaColocacion: "Atajada y colocación",
    despeje: "Despeje y centro",
    posicionamientoArco: "Posicionamiento en el arco",
    comunicacionDefensa: "Comunicación con la defensa",
    // Socio-emocional
    respect: "Respeto",
    responsibility: "Responsabilidad",
    teamwork: "Compañerismo",
    resilience: "Resiliencia",
    learningAttitude: "Actitud de aprendizaje",
};

export function EvaluationDetailDisplay({ evaluation, schoolId, onDeleted, onEditClick }: EvaluationDetailDisplayProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteDoc(doc(firestore, `schools/${schoolId}/evaluations/${evaluation.id}`));
            toast({ title: "Evaluación eliminada", description: "La evaluación ha sido borrada correctamente." });
            onDeleted();
        } catch (err) {
            errorEmitter.emit("permission-error", new FirestorePermissionError({
                path: `schools/${schoolId}/evaluations/${evaluation.id}`,
                operation: "delete",
            }));
            toast({
                variant: "destructive",
                title: "Error al eliminar",
                description: "No tienes permiso para borrar esta evaluación o hubo un error.",
            });
        } finally {
            setDeleting(false);
        }
    };

    const renderSkill = (skillName: string, value?: number, comment?: string) => (
        <div key={skillName} className="text-sm py-1.5 space-y-0.5">
            <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{skillLabels[skillName] || skillName}</span>
                <span className="font-mono font-semibold">{value ?? "N/A"}</span>
            </div>
            {comment?.trim() && (
                <p className="text-muted-foreground text-xs italic pl-1 border-l-2 border-muted">{comment.trim()}</p>
            )}
        </div>
    );

    return (
        <div className="space-y-6 p-4 bg-muted/30 rounded-lg">
            <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => onEditClick(evaluation)}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Editar
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4 mr-1" />
                            Borrar
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Borrar esta evaluación?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará la evaluación del {evaluation.date ? format(evaluation.date, "d 'de' MMMM 'de' yyyy", { locale: es }) : "esta fecha"}.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => { e.preventDefault(); handleDelete(); }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={deleting}
                            >
                                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                                {deleting ? "Eliminando..." : "Borrar evaluación"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
            <Card>
                 <CardHeader>
                    <CardTitle className="font-headline text-xl">
                        Evaluación del {evaluation.date ? format(evaluation.date, "d 'de' MMMM 'de' yyyy", { locale: es }) : "Fecha desconocida"}
                    </CardTitle>
                    <CardDescription>
                        Comentarios y calificaciones de la sesión.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     {evaluation.position && (
                        <div>
                            <h4 className="font-semibold mb-2">Posición calificada</h4>
                            <p className="text-sm">
                                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-sm font-medium">
                                    {positionLabels[evaluation.position] ?? evaluation.position}
                                </span>
                            </p>
                        </div>
                    )}
                     <div>
                        <h4 className="font-semibold mb-2">Comentarios del Entrenador</h4>
                        <p className="text-sm text-muted-foreground italic">
                            {evaluation.coachComments || "Sin comentarios."}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-3 gap-4">
                {evaluation.technical && Object.keys(evaluation.technical).length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Técnica</CardTitle>
                        </CardHeader>
                        <CardContent>
                           {Object.entries(evaluation.technical).map(([key, value]) =>
                                renderSkill(key, value, evaluation.rubricComments?.[key])
                            )}
                        </CardContent>
                    </Card>
                )}
                {evaluation.tactical && Object.keys(evaluation.tactical).length > 0 && (
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Táctica</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {Object.entries(evaluation.tactical).map(([key, value]) =>
                                renderSkill(key, value, evaluation.rubricComments?.[key])
                            )}
                        </CardContent>
                    </Card>
                )}
                {evaluation.socioEmotional && Object.keys(evaluation.socioEmotional).length > 0 && (
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Socio-emocional</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {Object.entries(evaluation.socioEmotional).map(([key, value]) =>
                                renderSkill(key, value, evaluation.rubricComments?.[key])
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
