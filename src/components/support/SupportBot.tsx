'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getNextStep, getStartStep } from '@/lib/support/flow-engine';
import type {
  SupportFlow,
  SupportFlowStep,
  SupportFlowStepChoice,
  SupportFlowStepForm,
  SupportFlowStepInfo,
  SupportFlowStepAiFreeText,
  SupportFlowStepConfirm,
  SupportTicket,
  TicketSeverity,
  SupportCategory,
} from '@/lib/types';
import { supportSummarizeAndExtract } from '@/ai/flows/support-summarize';
import { Loader2, Send, MessageCircle } from 'lucide-react';

type Message = { role: 'user' | 'bot'; content: string; stepId?: string };

interface SupportBotProps {
  flow: SupportFlow;
  schoolId: string;
  userId: string;
  userEmail?: string;
  userDisplayName?: string;
  userRole?: string;
  onCreateTicket: (payload: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDone?: () => void;
  clientContext?: { route?: string; userAgent?: string };
}

export function SupportBot({
  flow,
  schoolId,
  userId,
  userEmail,
  userDisplayName,
  userRole,
  onCreateTicket,
  onDone,
  clientContext,
}: SupportBotProps) {
  const [currentStep, setCurrentStep] = useState<SupportFlowStep | null>(() => getStartStep(flow));
  const [state, setState] = useState<Record<string, unknown>>({});
  const [messages, setMessages] = useState<Message[]>(() => {
    const start = getStartStep(flow);
    if (start) return [{ role: 'bot', content: start.message, stepId: start.id }];
    return [];
  });
  const [freeText, setFreeText] = useState('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goNext = useCallback(
    (userInput?: { choice?: string; formData?: Record<string, string | undefined>; freeText?: string; confirmed?: boolean }) => {
      const stepId = currentStep?.id ?? flow.startStepId;
      const result = getNextStep({
        flow,
        stepId,
        state,
        userInput,
      });
      setState(result.updatedState);

      if (result.createTicket && result.done) {
        setLoading(true);
        setError(null);
        buildAndCreateTicket(result.updatedState)
          .then(() => {
            setMessages((m) => [
              ...m,
              { role: 'bot', content: 'Ticket creado correctamente. Te contactaremos pronto.', stepId: 'create_ticket' },
            ]);
            setCurrentStep(null);
            onDone?.();
          })
          .catch((err) => {
            setError(err instanceof Error ? err.message : 'Error al crear el ticket');
          })
          .finally(() => setLoading(false));
        return;
      }

      if (result.nextStep) {
        setCurrentStep(result.nextStep);
        setMessages((m) => [...m, { role: 'bot', content: result.nextStep!.message, stepId: result.nextStep!.id }]);
      } else if (result.done) {
        setCurrentStep(null);
        onDone?.();
      }
    },
    [flow, state, currentStep, onCreateTicket, onDone]
  );

  async function buildAndCreateTicket(updatedState: Record<string, unknown>) {
    const severity = (updatedState.severity as string) || 'medium';
    const category = (updatedState.category as SupportCategory) || flow.category;
    const summary =
      (updatedState.summary as string) ||
      (updatedState.freeText as string) ||
      `Soporte: ${flow.name}`;
    const description = [updatedState.freeText, updatedState.reproSteps].filter(Boolean).join('\n\n') as string | undefined;
    const payload: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt'> = {
      schoolId,
      userId,
      userEmail,
      userDisplayName,
      userRole,
      category,
      severity: severity as TicketSeverity,
      summary,
      description,
      flowId: flow.id,
      tags: (updatedState.suggestedTags as string[]) || [flow.category],
      deviceInfo: clientContext?.userAgent,
      route: clientContext?.route,
      affectedPlayerId: updatedState.affectedPlayerId as string | undefined,
      status: 'open',
    };
    await onCreateTicket(payload);
  }

  const handleChoice = (value: string) => {
    setMessages((m) => [...m, { role: 'user', content: value }]);
    goNext({ choice: value });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const step = currentStep as SupportFlowStepForm;
    const data: Record<string, string | undefined> = {};
    step.fields.forEach((f) => {
      data[f.key] = formData[f.key] ?? undefined;
    });
    setMessages((m) => [...m, { role: 'user', content: Object.values(data).filter(Boolean).join(', ') }]);
    goNext({ formData: data });
    setFormData({});
  };

  const handleFreeTextSubmit = async () => {
    const text = freeText.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    setError(null);
    try {
      const extracted = await supportSummarizeAndExtract({ freeText: text, contextHint: flow.category });
      setState((s) => ({
        ...s,
        freeText: text,
        summary: extracted.summary,
        category: extracted.category,
        severity: extracted.severity,
        suggestedTags: extracted.suggestedTags,
      }));
      setFreeText('');
      goNext({ freeText: text });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el mensaje');
      setState((s) => ({ ...s, freeText: text }));
      goNext({ freeText: text });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = (confirmed: boolean) => {
    setMessages((m) => [...m, { role: 'user', content: confirmed ? 'Sí, crear ticket' : 'No' }]);
    goNext({ confirmed });
  };

  if (!currentStep && messages.length > 0 && !loading) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">Conversación finalizada.</p>
          {onDone && (
            <Button variant="outline" className="mt-2" onClick={onDone}>
              Iniciar otra consulta
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="pb-2">
        <h3 className="font-headline flex items-center gap-2 text-lg font-semibold">
          <MessageCircle className="h-5 w-5" />
          {flow.name}
        </h3>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-lg border bg-muted/30 p-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <span
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {msg.content}
              </span>
            </div>
          ))}
        </div>

        {currentStep && (
          <div className="space-y-3 border-t pt-3">
            {currentStep.type === 'choice' && (
              <div className="flex flex-wrap gap-2">
                {(currentStep as SupportFlowStepChoice).choices.map((c) => (
                  <Button
                    key={c.value}
                    variant="outline"
                    size="sm"
                    onClick={() => handleChoice(c.value)}
                    disabled={loading}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            )}

            {currentStep.type === 'form' && (
              <form onSubmit={handleFormSubmit} className="space-y-3">
                {(currentStep as SupportFlowStepForm).fields.map((f) => (
                  <div key={f.key}>
                    <Label htmlFor={f.key}>{f.label}</Label>
                    {f.type === 'textarea' ? (
                      <Textarea
                        id={f.key}
                        value={formData[f.key] ?? ''}
                        onChange={(e) => setFormData((d) => ({ ...d, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="mt-1"
                        required={f.required}
                      />
                    ) : (
                      <Input
                        id={f.key}
                        type="text"
                        value={formData[f.key] ?? ''}
                        onChange={(e) => setFormData((d) => ({ ...d, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="mt-1"
                        required={f.required}
                      />
                    )}
                  </div>
                ))}
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
                </Button>
              </form>
            )}

            {currentStep.type === 'info' && (
              <Button
                onClick={() => goNext()}
                disabled={loading}
              >
                Continuar
              </Button>
            )}

            {currentStep.type === 'ai_free_text' && (
              <div className="flex gap-2">
                <Textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Describe tu problema..."
                  rows={3}
                  className="flex-1"
                />
                <Button
                  onClick={handleFreeTextSubmit}
                  disabled={loading || !freeText.trim()}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            )}

            {currentStep.type === 'confirm' && (
              <div className="flex gap-2">
                <Button onClick={() => handleConfirm(true)} disabled={loading}>
                  Sí, crear ticket
                </Button>
                <Button variant="outline" onClick={() => handleConfirm(false)} disabled={loading}>
                  No
                </Button>
              </div>
            )}

            {currentStep.type === 'create_ticket' && (
              <Button
                onClick={() => goNext()}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear ticket'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
