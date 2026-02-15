"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase";

interface EditCoachFeedbackDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  playerId: string;
  playerName: string;
  initialValue: string;
  onSuccess?: () => void;
}

export function EditCoachFeedbackDialog({
  isOpen,
  onOpenChange,
  schoolId,
  playerId,
  playerName,
  initialValue,
  onSuccess,
}: EditCoachFeedbackDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [value, setValue] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) setValue(initialValue);
  }, [isOpen, initialValue]);

  const handleOpenChange = (open: boolean) => {
    if (!open) setValue(initialValue);
    onOpenChange(open);
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo verificar tu sesión. Volvé a iniciar sesión.",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/players/coach-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          schoolId,
          playerId,
          coachFeedback: value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Error al guardar");
      }
      toast({
        title: "Devolución guardada",
        description: `La devolución del entrenador para ${playerName} se guardó correctamente.`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: err instanceof Error ? err.message : "No se pudo guardar la devolución.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar devolución del entrenador</DialogTitle>
          <DialogDescription>
            Comentarios o devolución para {playerName}. Solo visible para staff de la escuela.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Escribí la devolución o comentarios del entrenador para este jugador..."
            className="min-h-[120px] resize-y"
            disabled={isSubmitting}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
