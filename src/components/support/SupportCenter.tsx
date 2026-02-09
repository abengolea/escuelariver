'use client';

import { useState, useCallback } from 'react';
import { useUserProfile } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import {
  runTransaction,
  doc,
  collection,
  Timestamp,
} from 'firebase/firestore';
import { SupportBot } from './SupportBot';
import { TicketStatus } from './TicketStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection } from '@/firebase';
import type { SupportFlow, SupportTicket } from '@/lib/types';
import { MessageCircle, Ticket, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function SupportCenter() {
  const { profile, user, isReady, activeSchoolId } = useUserProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedFlow, setSelectedFlow] = useState<SupportFlow | null>(null);
  const [flowKey, setFlowKey] = useState(0);

  const { data: flows, loading: flowsLoading } = useCollection<SupportFlow & { id: string }>(
    isReady ? 'supportFlows' : '',
    { where: ['enabled', '==', true] }
  );

  const createTicketFinal = useCallback(
    async (payload: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt'>) => {
      if (!activeSchoolId || !user) {
        throw new Error('No hay escuela activa o usuario');
      }
      const counterRef = doc(firestore, `schools/${activeSchoolId}/supportTicketCounter`, 'counter');
      const ticketsColl = collection(firestore, `schools/${activeSchoolId}/supportTickets`);
      const ticketRef = doc(ticketsColl);
      const ticketId = ticketRef.id;

      let ticketNumber = 0;
      const now = Timestamp.now();

      // Firestore no acepta undefined: armar objeto solo con campos definidos
      const firestoreData: Record<string, unknown> = {
        schoolId: activeSchoolId,
        userId: payload.userId,
        category: payload.category,
        severity: payload.severity,
        summary: payload.summary,
        status: payload.status,
        createdAt: now,
        updatedAt: now,
      };
      if (payload.userEmail != null) firestoreData.userEmail = payload.userEmail;
      if (payload.userDisplayName != null) firestoreData.userDisplayName = payload.userDisplayName;
      if (payload.userRole != null) firestoreData.userRole = payload.userRole;
      if (payload.description != null) firestoreData.description = payload.description;
      if (payload.conversationId != null) firestoreData.conversationId = payload.conversationId;
      if (payload.flowId != null) firestoreData.flowId = payload.flowId;
      if (payload.tags != null) firestoreData.tags = payload.tags;
      if (payload.deviceInfo != null) firestoreData.deviceInfo = payload.deviceInfo;
      if (payload.route != null) firestoreData.route = payload.route;
      if (payload.affectedPlayerId != null) firestoreData.affectedPlayerId = payload.affectedPlayerId;

      await runTransaction(firestore, async (tx) => {
        const counterSnap = await tx.get(counterRef);
        const lastNumber = counterSnap.exists() ? (counterSnap.data()?.lastNumber ?? 0) : 0;
        ticketNumber = lastNumber + 1;

        tx.set(counterRef, { lastNumber: ticketNumber });

        tx.set(ticketRef, {
          ...firestoreData,
          ticketNumber,
        });

        const eventsColl = collection(
          firestore,
          `schools/${activeSchoolId}/supportTickets/${ticketId}/supportTicketEvents`
        );
        tx.set(doc(eventsColl), {
          type: 'created',
          createdByUid: user.uid,
          createdAt: now,
        });
      });

      toast({
        title: 'Ticket creado',
        description: `Tu ticket #${ticketNumber} fue registrado. Puedes ver el estado en "Mis tickets".`,
      });
    },
    [firestore, activeSchoolId, user, toast]
  );

  if (!isReady || !profile || !activeSchoolId) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">Centro de Soporte</h1>
        <p className="text-muted-foreground">
          Resolvé dudas frecuentes o creá un ticket para que te contactemos.
        </p>
      </div>

      <Tabs defaultValue="chat" className="w-full">
        <TabsList>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Consulta guiada
          </TabsTrigger>
          <TabsTrigger value="tickets" className="flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            Mis tickets
          </TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="mt-4">
          {!selectedFlow ? (
            <Card>
              <CardHeader>
                <CardTitle>¿En qué podemos ayudarte?</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Elegí una opción para seguir los pasos guiados o crear un ticket.
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {flowsLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  (flows ?? []).map((f) => (
                    <Button
                      key={f.id}
                      variant="outline"
                      onClick={() => {
                        setSelectedFlow(f as SupportFlow);
                        setFlowKey((k) => k + 1);
                      }}
                    >
                      {f.name}
                    </Button>
                  ))
                )}
                {(flows ?? []).length === 0 && !flowsLoading && (
                  <p className="text-muted-foreground text-sm">
                    No hay flujos configurados. Contactá al administrador.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedFlow(null);
                  setFlowKey((k) => k + 1);
                }}
              >
                ← Cambiar tema
              </Button>
              <SupportBot
                key={flowKey}
                flow={selectedFlow}
                schoolId={activeSchoolId}
                userId={user!.uid}
                userEmail={user!.email ?? undefined}
                userDisplayName={profile.displayName}
                userRole={profile.role}
                onCreateTicket={createTicketFinal}
                onDone={() => setSelectedFlow(null)}
                clientContext={{
                  route: typeof window !== 'undefined' ? window.location.pathname : undefined,
                  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
                }}
              />
            </div>
          )}
        </TabsContent>
        <TabsContent value="tickets" className="mt-4">
          <TicketStatus schoolId={activeSchoolId} userId={user!.uid} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
