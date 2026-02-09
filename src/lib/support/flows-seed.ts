/**
 * Flujos guiados de soporte (config-driven).
 * Cargar en Firestore en la colección supportFlows para activar el Centro de Soporte.
 * Uso: ejecutar script de seed o importar y llamar desde consola/admin.
 */

import type { SupportFlow } from '@/lib/types';

const now = new Date();

export const supportFlowsSeed: (Omit<SupportFlow, 'updatedAt'> & { updatedAt: Date })[] = [
  {
    id: 'login_access',
    name: 'Login / Acceso',
    category: 'login_access',
    enabled: true,
    startStepId: 'login_choice',
    steps: {
      login_choice: {
        id: 'login_choice',
        type: 'choice',
        message: '¿Qué problema tenés con el acceso?',
        choices: [
          { label: 'No puedo iniciar sesión', value: 'no_login', nextStepId: 'login_tips' },
          { label: 'Olvidé mi contraseña', value: 'forgot_password', nextStepId: 'login_tips' },
          { label: 'Cuenta bloqueada o pendiente', value: 'blocked', nextStepId: 'login_tips' },
          { label: 'Otro', value: 'other', nextStepId: 'login_free_text' },
        ],
      },
      login_tips: {
        id: 'login_tips',
        type: 'info',
        message: 'Probá: 1) Verificar que el email sea el correcto. 2) Usar "¿Olvidaste tu contraseña?" en la pantalla de login. 3) Revisar la carpeta de spam. Si después de eso seguís sin poder entrar, creá un ticket y te ayudamos.',
        nextStepId: 'login_confirm',
      },
      login_free_text: {
        id: 'login_free_text',
        type: 'ai_free_text',
        message: 'Contanos en una frase qué te pasa con el acceso. Luego podés crear un ticket.',
        nextStepId: 'login_confirm',
      },
      login_confirm: {
        id: 'login_confirm',
        type: 'confirm',
        message: '¿Querés que creemos un ticket para que un operador te contacte?',
        nextStepId: 'create_ticket',
      },
      create_ticket: {
        id: 'create_ticket',
        type: 'create_ticket',
        message: 'Se creará un ticket con los datos que indicaste.',
      },
    },
    updatedAt: now,
  },
  {
    id: 'permissions',
    name: 'Permisos / Rol',
    category: 'permissions',
    enabled: true,
    startStepId: 'perm_choice',
    steps: {
      perm_choice: {
        id: 'perm_choice',
        type: 'choice',
        message: '¿Qué pasa con tus permisos?',
        choices: [
          { label: 'No veo opciones que debería ver', value: 'missing_options', nextStepId: 'perm_info' },
          { label: 'Me dice que no tengo permiso', value: 'denied', nextStepId: 'perm_info' },
          { label: 'Necesito otro rol (admin/entrenador)', value: 'change_role', nextStepId: 'perm_form' },
        ],
      },
      perm_info: {
        id: 'perm_info',
        type: 'info',
        message: 'Tu rol en la escuela define qué podés ver. Si sos jugador, solo ves tu perfil y soporte. Si sos entrenador o admin, tenés más opciones. Un administrador de la escuela puede asignarte otro rol.',
        nextStepId: 'perm_confirm',
      },
      perm_form: {
        id: 'perm_form',
        type: 'form',
        message: 'Completá estos datos para el ticket.',
        fields: [
          { key: 'severity', label: 'Severidad', type: 'select', required: true, options: [
            { label: 'Baja', value: 'low' },
            { label: 'Media', value: 'medium' },
            { label: 'Alta (bloquea mi trabajo)', value: 'high' },
          ]},
          { key: 'reproSteps', label: '¿Qué estabas intentando hacer?', type: 'textarea', required: false },
        ],
        nextStepId: 'perm_confirm',
      },
      perm_confirm: {
        id: 'perm_confirm',
        type: 'confirm',
        message: '¿Crear ticket para que revisen tu rol/permisos?',
        nextStepId: 'create_ticket',
      },
      create_ticket: {
        id: 'create_ticket',
        type: 'create_ticket',
        message: 'Se creará el ticket.',
      },
    },
    updatedAt: now,
  },
  {
    id: 'player_edit',
    name: 'Jugadores (crear / editar / duplicados)',
    category: 'player_edit',
    enabled: true,
    startStepId: 'player_choice',
    steps: {
      player_choice: {
        id: 'player_choice',
        type: 'choice',
        message: '¿Qué necesitás?',
        choices: [
          { label: 'Crear un jugador', value: 'create', nextStepId: 'player_info' },
          { label: 'Editar datos de un jugador', value: 'edit', nextStepId: 'player_form' },
          { label: 'Jugador duplicado o error', value: 'duplicate', nextStepId: 'player_form' },
        ],
      },
      player_info: {
        id: 'player_info',
        type: 'info',
        message: 'Desde "Jugadores" en el menú podés agregar un nuevo jugador. Si el botón no aparece, necesitás rol de entrenador o administrador de la escuela.',
        nextStepId: 'player_confirm',
      },
      player_form: {
        id: 'player_form',
        type: 'form',
        message: 'Datos para el ticket (opcional: jugador afectado).',
        fields: [
          { key: 'affectedPlayerId', label: 'ID del jugador (si lo conocés)', type: 'text', required: false },
          { key: 'severity', label: 'Severidad', type: 'select', options: [
            { label: 'Baja', value: 'low' },
            { label: 'Media', value: 'medium' },
            { label: 'Alta', value: 'high' },
          ]},
          { key: 'reproSteps', label: 'Descripción del problema', type: 'textarea', required: true },
        ],
        nextStepId: 'player_confirm',
      },
      player_confirm: {
        id: 'player_confirm',
        type: 'confirm',
        message: '¿Crear ticket con estos datos?',
        nextStepId: 'create_ticket',
      },
      create_ticket: {
        id: 'create_ticket',
        type: 'create_ticket',
        message: 'Se creará el ticket.',
      },
    },
    updatedAt: now,
  },
  {
    id: 'video_upload',
    name: 'Videos (subir / reproducir)',
    category: 'video_upload',
    enabled: true,
    startStepId: 'video_choice',
    steps: {
      video_choice: {
        id: 'video_choice',
        type: 'choice',
        message: '¿Qué problema tenés con los videos?',
        choices: [
          { label: 'No puedo subir (tamaño/formato)', value: 'upload', nextStepId: 'video_info' },
          { label: 'El video no se reproduce', value: 'playback', nextStepId: 'video_info' },
          { label: 'Otro', value: 'other', nextStepId: 'video_form' },
        ],
      },
      video_info: {
        id: 'video_info',
        type: 'info',
        message: 'Límites: videos cortos de unos 15–20 segundos; formatos habituales (webm, mp4). Si el archivo es muy grande o el formato no es compatible, probá grabar de nuevo desde la app o comprimir.',
        nextStepId: 'video_confirm',
      },
      video_form: {
        id: 'video_form',
        type: 'form',
        message: 'Completá para el ticket.',
        fields: [
          { key: 'deviceInfo', label: 'Dispositivo (ej. Chrome en Windows)', type: 'text', required: false },
          { key: 'reproSteps', label: 'Pasos para reproducir', type: 'textarea', required: true },
          { key: 'severity', label: 'Severidad', type: 'select', options: [
            { label: 'Baja', value: 'low' },
            { label: 'Media', value: 'medium' },
            { label: 'Alta', value: 'high' },
          ]},
        ],
        nextStepId: 'video_confirm',
      },
      video_confirm: {
        id: 'video_confirm',
        type: 'confirm',
        message: '¿Crear ticket?',
        nextStepId: 'create_ticket',
      },
      create_ticket: {
        id: 'create_ticket',
        type: 'create_ticket',
        message: 'Se creará el ticket.',
      },
    },
    updatedAt: now,
  },
  {
    id: 'reports',
    name: 'Informes / Gemini (timeouts, salida incorrecta)',
    category: 'reports',
    enabled: true,
    startStepId: 'reports_choice',
    steps: {
      reports_choice: {
        id: 'reports_choice',
        type: 'choice',
        message: '¿Qué falló con el informe?',
        choices: [
          { label: 'Timeout o no carga', value: 'timeout', nextStepId: 'reports_info' },
          { label: 'Texto incorrecto o incompleto', value: 'bad_output', nextStepId: 'reports_form' },
          { label: 'Faltan datos', value: 'missing_data', nextStepId: 'reports_form' },
        ],
      },
      reports_info: {
        id: 'reports_info',
        type: 'info',
        message: 'Los informes se generan con IA y a veces pueden tardar. Probá de nuevo en unos segundos. Si sigue fallando, creá un ticket indicando qué jugador/fecha.',
        nextStepId: 'reports_confirm',
      },
      reports_form: {
        id: 'reports_form',
        type: 'form',
        message: 'Datos para investigar.',
        fields: [
          { key: 'affectedPlayerId', label: 'ID jugador (si aplica)', type: 'text', required: false },
          { key: 'reproSteps', label: 'Qué hiciste y qué salió mal', type: 'textarea', required: true },
          { key: 'severity', label: 'Severidad', type: 'select', options: [
            { label: 'Baja', value: 'low' },
            { label: 'Media', value: 'medium' },
            { label: 'Alta', value: 'high' },
          ]},
        ],
        nextStepId: 'reports_confirm',
      },
      reports_confirm: {
        id: 'reports_confirm',
        type: 'confirm',
        message: '¿Crear ticket?',
        nextStepId: 'create_ticket',
      },
      create_ticket: {
        id: 'create_ticket',
        type: 'create_ticket',
        message: 'Se creará el ticket.',
      },
    },
    updatedAt: now,
  },
  {
    id: 'payments_ui',
    name: 'Pagos (solo integración / UX)',
    category: 'payments_ui',
    enabled: true,
    startStepId: 'pay_info',
    steps: {
      pay_info: {
        id: 'pay_info',
        type: 'info',
        message: 'Los pagos se gestionan directamente con cada escuela; la app no procesa ni retiene el dinero. Si pagaste y no se refleja en la app, puede ser un tema de sincronización con la escuela. Podemos ayudarte con la parte de la app (pantalla, mensajes, flujo).',
        nextStepId: 'pay_confirm',
      },
      pay_confirm: {
        id: 'pay_confirm',
        type: 'confirm',
        message: '¿Querés abrir un ticket para revisar la integración/UX de pagos en la app?',
        nextStepId: 'create_ticket',
      },
      create_ticket: {
        id: 'create_ticket',
        type: 'create_ticket',
        message: 'Se creará el ticket.',
      },
    },
    updatedAt: now,
  },
  {
    id: 'performance',
    name: 'Rendimiento / App lenta',
    category: 'performance',
    enabled: true,
    startStepId: 'perf_form',
    steps: {
      perf_form: {
        id: 'perf_form',
        type: 'form',
        message: 'Completá para poder investigar.',
        fields: [
          { key: 'deviceInfo', label: 'Dispositivo y navegador', type: 'text', required: false },
          { key: 'route', label: '¿En qué pantalla pasa? (ej. /dashboard/players)', type: 'text', required: false },
          { key: 'reproSteps', label: '¿Qué estabas haciendo?', type: 'textarea', required: true },
          { key: 'severity', label: 'Severidad', type: 'select', options: [
            { label: 'Baja', value: 'low' },
            { label: 'Media', value: 'medium' },
            { label: 'Alta', value: 'high' },
          ]},
        ],
        nextStepId: 'perf_confirm',
      },
      perf_confirm: {
        id: 'perf_confirm',
        type: 'confirm',
        message: '¿Crear ticket?',
        nextStepId: 'create_ticket',
      },
      create_ticket: {
        id: 'create_ticket',
        type: 'create_ticket',
        message: 'Se creará el ticket.',
      },
    },
    updatedAt: now,
  },
  {
    id: 'bug_report',
    name: 'Reportar un bug',
    category: 'bug_report',
    enabled: true,
    startStepId: 'bug_form',
    steps: {
      bug_form: {
        id: 'bug_form',
        type: 'form',
        message: 'Contanos el bug con el mayor detalle posible.',
        fields: [
          { key: 'reproSteps', label: 'Pasos para reproducir', type: 'textarea', required: true },
          { key: 'deviceInfo', label: 'Dispositivo y navegador', type: 'text', required: false },
          { key: 'route', label: 'URL o pantalla donde ocurre', type: 'text', required: false },
          { key: 'severity', label: 'Severidad', type: 'select', options: [
            { label: 'Baja', value: 'low' },
            { label: 'Media', value: 'medium' },
            { label: 'Alta', value: 'high' },
            { label: 'Crítica (bloquea todo)', value: 'critical' },
          ]},
        ],
        nextStepId: 'bug_confirm',
      },
      bug_confirm: {
        id: 'bug_confirm',
        type: 'confirm',
        message: '¿Enviar reporte como ticket?',
        nextStepId: 'create_ticket',
      },
      create_ticket: {
        id: 'create_ticket',
        type: 'create_ticket',
        message: 'Se creará el ticket.',
      },
    },
    updatedAt: now,
  },
];
