"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Edit } from "lucide-react";
import { useFirestore } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { School } from "@/lib/types";

const schoolSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  city: z.string().min(2, "La ciudad es requerida."),
  province: z.string().min(2, "La provincia es requerida."),
  address: z.string().optional(),
});

interface EditSchoolDialogProps {
  school: School;
  children: React.ReactNode; // To use as a trigger
}

export function EditSchoolDialog({ school, children }: EditSchoolDialogProps) {
  const [open, setOpen] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof schoolSchema>>({
    resolver: zodResolver(schoolSchema),
    defaultValues: {
      name: school.name,
      city: school.city,
      province: school.province,
      address: school.address || "",
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof schoolSchema>) {
    const schoolRef = doc(firestore, 'schools', school.id);
    
    try {
      await updateDoc(schoolRef, {
        name: values.name,
        city: values.city,
        province: values.province,
        address: values.address,
      });

      toast({
        title: "¡Escuela actualizada!",
        description: `Los datos de "${values.name}" han sido guardados.`,
      });
      setOpen(false);

    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Error al actualizar",
            description: "No se pudieron guardar los cambios. Por favor, revisa tus permisos e inténtalo de nuevo.",
        });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Escuela</DialogTitle>
          <DialogDescription>
            Modifica los datos de la sede. Los cambios se aplicarán inmediatamente.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nombre de la Sede</FormLabel>
                    <FormControl>
                        <Input placeholder="Ej: Escuela de River - Córdoba" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Provincia</FormLabel>
                    <FormControl>
                        <Input placeholder="Córdoba" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Ciudad</FormLabel>
                    <FormControl>
                        <Input placeholder="Córdoba Capital" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Dirección (Opcional)</FormLabel>
                    <FormControl>
                        <Input placeholder="Av. Siempre Viva 742" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
