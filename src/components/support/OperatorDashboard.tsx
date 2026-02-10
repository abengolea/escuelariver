'use client';

import { useState } from 'react';
import { useUserProfile } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase';
import { doc, updateDoc, Timestamp, collection, addDoc } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { SupportTicket } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ticket, AlertCircle, Loader2, MessageSquare, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { seedSupportFlows } from '@/lib/support/seed-support-flows';
import { buildEmailHtml, escapeHtml, htmlToPlainText, sendMailDoc } from '@/lib/email';

const statusLabels: Record<string, string> = {
  open: 'Abierto',
  in_progress: 'En curso',
  waiting_user: 'Esperando usuario',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

const severityLabels: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

export function OperatorDashboard() {
  const { profile, isSuperAdmin, isReady, activeSchoolId } = useUserProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [schoolFilter, setSchoolFilter] = useState<string>(activeSchoolId ?? '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<(SupportTicket & { id: string }) | null>(null);
  const [internalNotes, setInternalNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [seedingFlows, setSeedingFlows] = useState(false);

  const canOperate = isReady && isSuperAdmin;
  const path = canOperate && schoolFilter
    ? `schools/${schoolFilter}/supportTickets`
    : '';

  const { data: tickets, loading } = useCollection<SupportTicket & { id: string }>(
    path,
    {
      orderBy: ['createdAt', 'desc'],
      limit: 100,
    }
  );

  const ticketsWithSchool = (tickets ?? []).map((t) => ({ ...t, schoolId: t.schoolId ?? schoolFilter }));
  const filteredTickets =
    statusFilter && statusFilter !== 'all'
      ? ticketsWithSchool.filter((t) => t.status === statusFilter)
      : ticketsWithSchool;

  const openCount = (tickets ?? []).filter((t) => t.status === 'open').length;
  const inProgressCount = (tickets ?? []).filter((t) => t.status === 'in_progress').length;

  const handleStatusChange = async (ticket: SupportTicket & { id: string }, newStatus: string) => {
    if (!ticket.schoolId || !canOperate) return;
    setUpdating(true);
    const ticketRef = doc(firestore, `schools/${ticket.schoolId}/supportTickets`, ticket.id);
    const eventsColl = collection(
      firestore,
      `schools/${ticket.schoolId}/supportTickets/${ticket.id}/supportTicketEvents`
    );
    try {
      const now = Timestamp.now();
      await updateDoc(ticketRef, {
        status: newStatus,
        updatedAt: now,
        ...(newStatus === 'in_progress' && !ticket.firstResponseAt
          ? { firstResponseAt: now }
          : {}),
        ...(newStatus === 'resolved' || newStatus === 'closed' ? { resolvedAt: now } : {}),
      });
      await addDoc(eventsColl, {
        type: 'status_change',
        fromStatus: ticket.status,
        toStatus: newStatus,
        createdByUid: profile?.uid ?? '',
        createdAt: now,
      });

      // Avisar por mail al usuario cuando se resuelve o cierra el ticket
      if ((newStatus === 'resolved' || newStatus === 'closed') && ticket.userEmail?.trim()) {
        try {
          const statusLabel = statusLabels[newStatus] ?? newStatus;
          const contentHtml = `<p>Tu ticket de soporte <strong>#${ticket.ticketNumber}</strong> fue marcado como <strong>${escapeHtml(statusLabel)}</strong>.</p><p>Resumen: ${escapeHtml(ticket.summary)}</p><p>Si tenés más dudas, podés abrir otro ticket desde el Centro de Soporte en la app.</p>`;
          const subject = `Ticket #${ticket.ticketNumber} ${statusLabel} - Escuelas River SN`;
          const html = buildEmailHtml(contentHtml, {
            title: subject,
            greeting: `Hola${ticket.userDisplayName ? ` ${escapeHtml(ticket.userDisplayName)}` : ''},`,
          });
          await sendMailDoc(firestore, {
            to: ticket.userEmail.trim(),
            subject,
            html,
            text: htmlToPlainText(html),
          });
        } catch (emailErr) {
          console.warn('[OperatorDashboard] Email de ticket resuelto no enviado:', emailErr);
        }
      }

      toast({ title: 'Estado actualizado', description: `Ticket #${ticket.ticketNumber} → ${statusLabels[newStatus] ?? newStatus}` });
      setSelectedTicket(null);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo actualizar',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedTicket?.schoolId || !canOperate) return;
    setUpdating(true);
    const ticketRef = doc(firestore, `schools/${selectedTicket.schoolId}/supportTickets`, selectedTicket.id);
    const eventsColl = collection(
      firestore,
      `schools/${selectedTicket.schoolId}/supportTickets/${selectedTicket.id}/supportTicketEvents`
    );
    try {
      const now = Timestamp.now();
      await updateDoc(ticketRef, { internalNotes, updatedAt: now });
      await addDoc(eventsColl, {
        type: 'note_added',
        createdByUid: profile?.uid ?? '',
        createdAt: now,
        payload: { noteLength: internalNotes.length },
      });
      toast({ title: 'Notas guardadas' });
      setSelectedTicket(null);
      setInternalNotes('');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudieron guardar las notas',
      });
    } finally {
      setUpdating(false);
    }
  };

  if (!canOperate) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-destructive">
          <AlertCircle className="h-5 w-5" />
          Solo el superadministrador puede ver y resolver tickets de soporte técnico.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">Panel de Soporte (Operadores)</h1>
        <p className="text-muted-foreground">
          Triaje y seguimiento de tickets de soporte técnico. Solo superadmin.
        </p>
      </div>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtrar por escuela</CardTitle>
            <CardDescription>Superadmin puede ver cualquier escuela.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="ID de escuela (dejar vacío para ver todas no soportado en esta versión)"
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Por ahora mostramos la escuela activa. Para ver otra, cambiá de escuela en el panel.
            </p>
          </CardContent>
        </Card>
      )}

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Flujos del Centro de Soporte</CardTitle>
            <CardDescription>
              Cargá los flujos guiados por defecto en Firestore para que los usuarios vean opciones en el Centro de Soporte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={async () => {
                setSeedingFlows(true);
                try {
                  const { loaded, errors } = await seedSupportFlows(firestore);
                  if (errors.length > 0) {
                    toast({
                      variant: 'destructive',
                      title: 'Flujos cargados con errores',
                      description: `${loaded} cargados. Errores: ${errors.join('; ')}`,
                    });
                  } else {
                    toast({
                      title: 'Flujos cargados',
                      description: `Se cargaron ${loaded} flujos en supportFlows.`,
                    });
                  }
                } catch (e) {
                  toast({
                    variant: 'destructive',
                    title: 'Error al cargar flujos',
                    description: e instanceof Error ? e.message : String(e),
                  });
                } finally {
                  setSeedingFlows(false);
                }
              }}
              disabled={seedingFlows}
            >
              {seedingFlows ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Cargar flujos por defecto
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abiertos</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <span className="text-2xl font-bold">{openCount}</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En curso</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <span className="text-2xl font-bold">{inProgressCount}</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total (filtro)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <span className="text-2xl font-bold">{filteredTickets.length}</span>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Tickets</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : filteredTickets.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay tickets con el filtro actual.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border min-w-0">
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">#</TableHead>
                    <TableHead className="text-xs sm:text-sm">Resumen</TableHead>
                    <TableHead className="text-xs sm:text-sm">Severidad</TableHead>
                    <TableHead className="text-xs sm:text-sm">Estado</TableHead>
                    <TableHead className="text-xs sm:text-sm whitespace-nowrap">Fecha</TableHead>
                    <TableHead className="text-right w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {filteredTickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono">{t.ticketNumber}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{t.summary}</TableCell>
                    <TableCell>
                      <Badge variant={t.severity === 'critical' || t.severity === 'high' ? 'destructive' : 'secondary'}>
                        {severityLabels[t.severity] ?? t.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{statusLabels[t.status] ?? t.status}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(t.createdAt instanceof Date ? t.createdAt : new Date((t.createdAt as { toDate?: () => Date }).toDate?.() ?? t.createdAt), 'd MMM HH:mm', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTicket(t);
                          setInternalNotes(t.internalNotes ?? '');
                        }}
                      >
                        Ver / Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ticket #{selectedTicket?.ticketNumber} · {selectedTicket?.summary}</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">{selectedTicket.description}</p>
              <div>
                <Label>Estado</Label>
                <Select
                  value={selectedTicket.status}
                  onValueChange={(v) => handleStatusChange(selectedTicket, v)}
                  disabled={updating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notas internas (solo operadores)</Label>
                <Textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                  placeholder="Notas para el equipo..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTicket(null)}>Cerrar</Button>
            <Button onClick={handleSaveNotes} disabled={updating}>
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar notas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
