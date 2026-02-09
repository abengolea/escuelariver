/**
 * Tipos para el Centro de Soporte: flujos guiados, conversaciones, tickets y eventos.
 * Multi-tenant: schoolId como partición en paths de Firestore.
 */

// --- Support Flow (config-driven) ---

export type SupportStepType =
  | 'choice'   // Botones/opciones
  | 'form'     // Campos estructurados (severity, playerId, etc.)
  | 'info'     // Solo mensaje informativo
  | 'ai_free_text'  // Usuario escribe libre; opcionalmente llamar IA
  | 'confirm'  // Confirmar antes de crear ticket
  | 'create_ticket'; // Crear ticket y terminar

export interface SupportFlowChoice {
  label: string;
  value: string;
  /** Id del siguiente paso si se elige esta opción */
  nextStepId: string;
}

export interface SupportFlowStepBase {
  id: string;
  type: SupportStepType;
  /** Mensaje o pregunta mostrada al usuario */
  message: string;
  /** Texto opcional de ayuda */
  helpText?: string;
}

export interface SupportFlowStepChoice extends SupportFlowStepBase {
  type: 'choice';
  choices: SupportFlowChoice[];
}

export interface SupportFlowStepForm extends SupportFlowStepBase {
  type: 'form';
  /** Campos a recoger: severity, playerId, reproSteps, device, etc. */
  fields: SupportFlowFormField[];
  /** Id del siguiente paso tras enviar el formulario */
  nextStepId: string;
}

export interface SupportFlowFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'player_select';
  required?: boolean;
  options?: { label: string; value: string }[];
  placeholder?: string;
}

export interface SupportFlowStepInfo extends SupportFlowStepBase {
  type: 'info';
  /** Siguiente paso (ej. volver al inicio o crear ticket) */
  nextStepId: string;
}

export interface SupportFlowStepAiFreeText extends SupportFlowStepBase {
  type: 'ai_free_text';
  /** Siguiente paso tras procesar texto (ej. confirm o create_ticket) */
  nextStepId: string;
}

export interface SupportFlowStepConfirm extends SupportFlowStepBase {
  type: 'confirm';
  /** Siguiente paso si confirma (normalmente create_ticket) */
  nextStepId: string;
}

export interface SupportFlowStepCreateTicket extends SupportFlowStepBase {
  type: 'create_ticket';
}

export type SupportFlowStep =
  | SupportFlowStepChoice
  | SupportFlowStepForm
  | SupportFlowStepInfo
  | SupportFlowStepAiFreeText
  | SupportFlowStepConfirm
  | SupportFlowStepCreateTicket;

export interface SupportFlow {
  id: string;
  name: string;
  category: SupportCategory;
  enabled: boolean;
  steps: Record<string, SupportFlowStep>;
  startStepId: string;
  updatedAt: Date;
  updatedBy?: string;
}

export type SupportCategory =
  | 'login_access'
  | 'permissions'
  | 'player_edit'
  | 'video_upload'
  | 'reports'
  | 'payments_ui'
  | 'performance'
  | 'bug_report'
  | 'other';

// --- Conversation (chat session) ---

export interface SupportConversation {
  id: string;
  userId: string;
  userEmail?: string;
  userRole?: string;
  flowId?: string;
  state?: Record<string, unknown>;
  messages?: SupportConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  ticketId?: string;
}

export interface SupportConversationMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  stepId?: string;
}

// --- Ticket ---

export type TicketSeverity = 'low' | 'medium' | 'high' | 'critical';
export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_user'
  | 'resolved'
  | 'closed';

export interface SupportTicket {
  id: string;
  ticketNumber: number;
  schoolId: string;
  userId: string;
  userEmail?: string;
  userDisplayName?: string;
  userRole?: string;
  category: SupportCategory;
  severity: TicketSeverity;
  summary: string;
  description?: string;
  conversationId?: string;
  flowId?: string;
  tags?: string[];
  deviceInfo?: string;
  route?: string;
  affectedPlayerId?: string;
  status: TicketStatus;
  assignedToUid?: string;
  internalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  firstResponseAt?: Date;
  resolvedAt?: Date;
}

// --- Ticket events (audit trail) ---

export type SupportTicketEventType =
  | 'created'
  | 'status_change'
  | 'assignment'
  | 'note_added';

export interface SupportTicketEvent {
  id: string;
  type: SupportTicketEventType;
  fromStatus?: TicketStatus;
  toStatus?: TicketStatus;
  assignedToUid?: string;
  createdByUid: string;
  createdAt: Date;
  payload?: Record<string, unknown>;
}

// --- Client context (telemetry) ---

export interface SupportClientContext {
  route?: string;
  timestamp: string;
  userAgent?: string;
  viewport?: string;
}

// --- AI extraction output ---

export interface SupportAiExtraction {
  summary: string;
  category: SupportCategory;
  severity: TicketSeverity;
  suggestedTags: string[];
  missingFields: string[];
}
