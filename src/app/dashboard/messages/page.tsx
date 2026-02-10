"use client";

import { MassMessageForm } from "@/components/admin/MassMessageForm";

export default function MessagesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Mensajes</h1>
        <p className="text-muted-foreground">
          Enviá correos masivos a los jugadores (por categoría o a todos) desde la aplicación.
        </p>
      </div>
      <MassMessageForm />
    </div>
  );
}
