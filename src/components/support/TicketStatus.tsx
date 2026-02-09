'use client';

import { useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { SupportTicket } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ticket } from 'lucide-react';

const statusLabels: Record<string, string> = {
  open: 'Abierto',
  in_progress: 'En curso',
  waiting_user: 'Esperando tu respuesta',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

const severityLabels: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

interface TicketStatusProps {
  schoolId: string;
  userId: string;
}

export function TicketStatus({ schoolId, userId }: TicketStatusProps) {
  const path = schoolId ? `schools/${schoolId}/supportTickets` : '';
  const { data: tickets, loading } = useCollection<SupportTicket>(
    path,
    {
      where: ['userId', '==', userId],
      orderBy: ['createdAt', 'desc'],
      limit: 50,
    }
  );

  if (!schoolId) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          No hay escuela activa.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5" />
          Mis tickets
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Estado de tus solicitudes de soporte.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !tickets?.length ? (
          <p className="text-muted-foreground text-sm">No tenés tickets abiertos.</p>
        ) : (
          <ul className="space-y-3">
            {(tickets as (SupportTicket & { id: string })[]).map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-1 rounded-lg border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    #{t.ticketNumber} · {t.summary}
                  </span>
                  <Badge variant="secondary">{statusLabels[t.status] ?? t.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-muted-foreground">
                  <span>{severityLabels[t.severity] ?? t.severity}</span>
                  <span>·</span>
                  <span>{format(t.createdAt instanceof Date ? t.createdAt : new Date((t.createdAt as { toDate?: () => Date }).toDate?.() ?? t.createdAt), 'd MMM yyyy, HH:mm', { locale: es })}</span>
                </div>
                {t.description && (
                  <p className="line-clamp-2 text-muted-foreground">{t.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
