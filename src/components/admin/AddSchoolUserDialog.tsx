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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, UserPlus } from "lucide-react";
import { useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { getFirebaseConfig } from "@/firebase/config";
import { doc, writeBatch, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

const addUserSchema = z
  .object({
    displayName: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
    email: z.string().email("El correo electrónico no es válido."),
    emailConfirm: z.string().email("El correo electrónico no es válido."),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
    role: z.enum(["school_admin", "coach"], { required_error: "El rol es requerido." }),
  })
  .refine((data) => data.email === data.emailConfirm, {
    message: "Los correos electrónicos no coinciden.",
    path: ["emailConfirm"],
  });

export function AddSchoolUserDialog({ schoolId }: { schoolId: string }) {
  const [open, setOpen] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof addUserSchema>>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      displayName: "",
      email: "",
      emailConfirm: "",
      password: "",
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof addUserSchema>) {
    const tempAppName = `temp-user-creation-${Date.now()}`;
    const tempApp = initializeApp(getFirebaseConfig(), tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
        // 1. Create the user in the temporary, isolated auth instance
        const userCredential = await createUserWithEmailAndPassword(tempAuth, values.email, values.password);
        const newUser = userCredential.user;
        await updateProfile(newUser, { displayName: values.displayName });

        // 2. Create the Firestore documents using a batch write for atomicity
        const batch = writeBatch(firestore);

        // Doc 1: The user's role within the school
        const schoolUserRef = doc(firestore, 'schools', schoolId, 'users', newUser.uid);
        const schoolUserData = {
            displayName: values.displayName,
            email: (values.email ?? '').trim().toLowerCase(),
            role: values.role,
        };
        batch.set(schoolUserRef, schoolUserData);
        
        // Doc 2: The user's global profile document
        const platformUserRef = doc(firestore, 'platformUsers', newUser.uid);
        const platformUserData = {
            email: (values.email ?? '').trim().toLowerCase(),
            super_admin: false,
            createdAt: Timestamp.now()
        };
        batch.set(platformUserRef, platformUserData);

        await batch.commit();

        toast({
            title: "¡Usuario añadido!",
            description: `${values.displayName} ha sido añadido a la escuela como ${values.role}.`,
        });
        form.reset();
        setOpen(false);

    } catch (error: any) {
        let title = "Error";
        let description = "Ocurrió un error inesperado.";
        if (error.code) { // Firebase auth errors have a 'code' property
            title = "Error de Autenticación";
            if (error.code === 'auth/email-already-in-use') {
                description = "Este email ya está registrado. Si un intento anterior falló, elimina el usuario desde la consola de Firebase (Autenticación) y vuelve a intentarlo.";
            } else if (error.code === 'auth/weak-password') {
                description = "La contraseña proporcionada es demasiado débil (mínimo 6 caracteres).";
            }
        } else {
            title = "Error de Base de Datos";
            description = "No se pudo asignar el rol al usuario en la escuela. Verifica los permisos.";
            const permissionError = new FirestorePermissionError({
                path: `schools/${schoolId}/users/NEW_USER_ID`,
                operation: 'create',
                requestResourceData: { displayName: values.displayName, email: values.email, role: values.role },
            });
            errorEmitter.emit('permission-error', permissionError);
        }
        toast({
            variant: "destructive",
            title: title,
            description: description,
            duration: 9000,
        });
    } finally {
        // 3. Clean up the temporary app
        await deleteApp(tempApp);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Añadir Responsable
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Añadir Usuario a la Escuela</DialogTitle>
          <DialogDescription>
            Crea un nuevo usuario y asígnalo como responsable (administrador o entrenador) a esta escuela.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre y Apellido</FormLabel>
                  <FormControl>
                    <Input placeholder="Enzo Pérez" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="eperez@riverplate.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emailConfirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Repetí el correo electrónico" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña Inicial</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un rol para el usuario" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="school_admin">Administrador de Escuela</SelectItem>
                      <SelectItem value="coach">Entrenador</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => { form.reset(); setOpen(false); }}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Guardando..." : "Guardar Usuario"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
