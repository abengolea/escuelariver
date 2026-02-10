"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth, useFirestore } from "@/firebase";
import { sendSignInLinkToEmail } from "firebase/auth";
import { collection, doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { getCategoryLabel } from "@/lib/utils";
import type { School } from "@/lib/types";
import { useCollection } from "@/firebase";

const registrationSchema = z.object({
  schoolId: z.string().min(1, "Seleccioná una escuela."),
  firstName: z.string().min(2, "El nombre debe tener al menos 2 caracteres."),
  lastName: z.string().min(2, "El apellido debe tener al menos 2 caracteres."),
  birthDate: z.date({ required_error: "La fecha de nacimiento es requerida." }),
  email: z.string().email("Debe ser un email válido."),
  emailConfirm: z.string().email("Debe ser un email válido."),
  phone: z.string().min(10, "El teléfono debe tener al menos 10 dígitos."),
}).refine((data) => data.email === data.emailConfirm, {
  message: "Los emails no coinciden.",
  path: ["emailConfirm"],
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;

const PHONE_PREFIX = "+54 ";

export function PlayerRegistrationForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [emailSent, setEmailSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState("");

  const { data: schools, loading: schoolsLoading } = useCollection<School>(
    "schools",
    { orderBy: ["name", "asc"] }
  );

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      schoolId: "",
      firstName: "",
      lastName: "",
      email: "",
      emailConfirm: "",
      phone: PHONE_PREFIX,
    },
  });

  const birthDate = form.watch("birthDate");
  const categoryLabel = birthDate ? getCategoryLabel(birthDate) : null;

  async function onSubmit(values: RegistrationFormValues) {
    const emailNorm = values.email.trim().toLowerCase();

    try {
      const safeId = `${emailNorm.replace(/@/g, "_").replace(/\./g, "_")}_${values.schoolId}`;
      const attemptRef = doc(firestore, "emailVerificationAttempts", safeId);

      const existing = await getDoc(attemptRef);
      if (existing.exists() && existing.data()?.status === "pending") {
        const exp = existing.data()?.expiresAt?.toDate?.();
        if (exp && exp > new Date()) {
          toast({
            variant: "destructive",
            title: "Solicitud pendiente",
            description: "Ya existe una solicitud con este email para esta escuela. Revisá tu bandeja o esperá unos minutos.",
          });
          return;
        }
      }

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      const attemptData = {
        email: emailNorm,
        playerData: {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          birthDate: Timestamp.fromDate(values.birthDate),
          schoolId: values.schoolId,
          tutorPhone: values.phone.startsWith("+") ? values.phone : PHONE_PREFIX + values.phone,
          category: categoryLabel ?? undefined,
        },
        status: "pending",
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: Timestamp.now(),
      };

      await setDoc(attemptRef, attemptData);
      const attemptId = safeId;

      const actionCodeSettings = {
        url: `${window.location.origin}/auth/registro/verificar?attemptId=${attemptId}`,
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, emailNorm, actionCodeSettings);

      window.localStorage.setItem("emailForSignIn", emailNorm);
      setSentToEmail(emailNorm);
      setEmailSent(true);
      toast({
        title: "Email enviado",
        description: `Te enviamos un enlace de verificación a ${emailNorm}. Hacé clic para continuar.`,
      });
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error("Registro error:", { code: error.code, message: error.message, error });
      const isRateLimit = error.code === "auth/too-many-requests";
      const isPermissionDenied = error.code === "permission-denied";
      toast({
        variant: "destructive",
        title: "Error",
        description: isRateLimit
          ? "Demasiados intentos. Probá de nuevo en unos minutos."
          : isPermissionDenied
            ? "Sin permisos. Verificá que las reglas de Firestore estén desplegadas y que el dominio esté autorizado en Firebase."
            : error.message || "No se pudo enviar el email. Verificá la dirección e intentá de nuevo.",
      });
    }
  }

  if (emailSent) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center rounded-full bg-primary/10 p-4">
          <Mail className="h-12 w-12 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-center">Revisá tu email</h3>
        <p className="text-sm text-muted-foreground text-center">
          Te enviamos un enlace a <strong>{sentToEmail}</strong>. Hacé clic para crear tu contraseña y completar el registro.
        </p>
        <p className="text-xs text-muted-foreground text-center">
          ¿No ves el correo? Revisá la carpeta de spam.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="schoolId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Escuela</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={schoolsLoading}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná tu escuela" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(schools ?? [])
                    .filter((s) => s.status === "active")
                    .map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del jugador</FormLabel>
                <FormControl>
                  <Input placeholder="Lionel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido del jugador</FormLabel>
                <FormControl>
                  <Input placeholder="Messi" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="birthDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de nacimiento</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP", { locale: es })
                      ) : (
                        <span>Elegí una fecha</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    captionLayout="dropdown"
                    fromYear={2007}
                    toYear={new Date().getFullYear()}
                    locale={es}
                    disabled={(date) =>
                      date > new Date() || date < new Date("2007-01-01")
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {categoryLabel && (
                <FormDescription>
                  Categoría: <strong>{categoryLabel}</strong>
                </FormDescription>
              )}
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
                <Input type="email" placeholder="ejemplo@gmail.com" {...field} />
              </FormControl>
              <FormDescription>Para notificaciones y acceso al panel.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="emailConfirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="ejemplo@gmail.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono de contacto</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2 rounded-md border px-3">
                  <span className="text-lg" title="Argentina">🇦🇷</span>
                  <Input
                    type="tel"
                    placeholder="9 11 1234 5678"
                    className="border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    value={field.value}
                    onChange={(e) => {
                      const v = e.target.value;
                      const stripped = v.replace(/\D/g, "");
                      const formatted = stripped.startsWith("54")
                        ? "+54 " + stripped.slice(2).replace(/(\d{2})(\d{4})(\d{4})/, "$1 $2 $3")
                        : stripped.length > 0
                        ? PHONE_PREFIX + stripped.replace(/(\d{2})(\d{4})(\d{4})/, "$1 $2 $3")
                        : PHONE_PREFIX;
                      field.onChange(formatted);
                    }}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting || schoolsLoading}
        >
          {form.formState.isSubmitting && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {form.formState.isSubmitting ? "Enviando..." : "Enviar y verificar email"}
        </Button>
      </form>
    </Form>
  );
}
