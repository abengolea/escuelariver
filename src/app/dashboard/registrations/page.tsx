import { PendingRegistrations } from "@/components/admin/PendingRegistrations";
import { AccessRequestsList } from "@/components/admin/AccessRequestsList";

export default function RegistrationsPage() {
  return (
    <div className="flex flex-col gap-6 min-w-0">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Solicitudes</h1>
      </div>
      <div className="space-y-8">
        <AccessRequestsList />
        <div>
          <h2 className="text-xl font-semibold mb-2">Solicitudes de registro (nuevos jugadores)</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Formularios de preinscripción de jugadores para que se unan a tu escuela.
          </p>
          <PendingRegistrations />
        </div>
      </div>
    </div>
  );
}
