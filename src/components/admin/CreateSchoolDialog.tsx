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
import { Loader2, PlusCircle, UserPlus } from "lucide-react";
import { useFirestore, useAuth } from "@/firebase";
import { collection, doc, writeBatch, Timestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "../ui/separator";

const schoolSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  city: z.string().min(2, "La ciudad es requerida."),
  province: z.string().min(2, "La provincia es requerida."),
  address: z.string().optional(),
  adminDisplayName: z.string().min(3, "El nombre del administrador es requerido."),
  adminEmail: z.string().email("El correo electrónico no es válido."),
  adminPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

export function CreateSchoolDialog() {
  const [open, setOpen] = useState(false);
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof schoolSchema>>({
    resolver: zodResolver(schoolSchema),
    defaultValues: {
      name: "",
      city: "",
      province: "",
      address: "",
      adminDisplayName: "",
      adminEmail: "",
      adminPassword: "",
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof schoolSchema>) {
     // 1. Create the user in Firebase Auth
    let newUser;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, values.adminEmail, values.adminPassword);
        newUser = userCredential.user;
        await updateProfile(newUser, { displayName: values.adminDisplayName });
    } catch (authError: any) {
        let description = "Ocurrió un error al crear el usuario administrador.";
        if (authError.code === 'auth/email-already-in-use') {
            description = "El correo electrónico para el administrador ya está en uso.";
        } else if (authError.code === 'auth/weak-password') {
            description = "La contraseña proporcionada es demasiado débil (mínimo 6 caracteres).";
        }
        toast({
            variant: "destructive",
            title: "Error de Autenticación",
            description: description,
        });
        return; 
    }

    // 2. If user creation is successful, create the school and the role doc in a batch
    const newSchoolRef = doc(collection(firestore, 'schools'));
    const schoolUserRef = doc(firestore, 'schools', newSchoolRef.id, 'users', newUser.uid);
    const batch = writeBatch(firestore);

    const schoolData = {
        name: values.name,
        city: values.city,
        province: values.province,
        address: values.address,
        status: 'active' as const,
        createdAt: Timestamp.now(),
    };

    const schoolUserData = {
        displayName: values.adminDisplayName,
        email: values.adminEmail,
        role: 'school_admin' as const,
        assignedCategories: [],
    };

    batch.set(newSchoolRef, schoolData);
    batch.set(schoolUserRef, schoolUserData);

    try {
        await batch.commit();
        toast({
            title: "¡Escuela y Administrador Creados!",
            description: `Se creó la escuela "${values.name}" y se asignó a ${values.adminEmail} como administrador.`,
        });
        form.reset();
        setOpen(false);
    } catch (firestoreError: any) {
        console.error("Firestore batch commit failed:", firestoreError);
        toast({
            variant: "destructive",
            title: "Error Crítico de Base de Datos",
            description: `Se creó el usuario ${values.adminEmail}, pero no se pudo crear la escuela ni asignar el rol. Por favor, elimina el usuario manualmente desde la consola de Firebase y vuelve a intentarlo.`,
            duration: 15000, 
        });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Crear Nueva Escuela
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nueva Escuela</DialogTitle>
          <DialogDescription>
            Completa los datos para registrar una nueva sede y su administrador.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
            <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Datos de la Escuela</h3>
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
            </div>

            <Separator />
            
            <div className="space-y-2">
                 <h3 className="font-semibold text-foreground flex items-center gap-2"><UserPlus className="h-5 w-5" /> Datos del Administrador</h3>
                 <FormField
                    control={form.control}
                    name="adminDisplayName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nombre y Apellido del Admin</FormLabel>
                        <FormControl>
                            <Input placeholder="Marcelo Gallardo" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="adminEmail"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Email del Admin</FormLabel>
                        <FormControl>
                            <Input type="email" placeholder="mg@riverplate.com" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="adminPassword"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Contraseña Inicial</FormLabel>
                        <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                         <p className="text-xs text-muted-foreground pt-1">Mínimo 6 caracteres. El administrador podrá cambiarla luego.</p>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Creando..." : "Crear Escuela y Admin"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
