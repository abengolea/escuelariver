import { collection, addDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { EMAIL_LOGO_BASE64 } from "./email-logo-base64";

/** Colección que usa la extensión Trigger Email (firestore-send-email). */
export const MAIL_COLLECTION = "mail";

const BRAND_RED = "#d4002a";
const BODY_BG = "#f5f5f5";
const CARD_BG = "#ffffff";
const TEXT_COLOR = "#1a1a1a";
const MUTED_COLOR = "#6b7280";
const HEADER_BG = "#0a0a0a";

/** CID del logo como adjunto inline (compatible con clientes que bloquean data: URI). */
const LOGO_CID = "logo@river";

/**
 * Genera HTML de correo con tipografía y estilo Escuela River: cabecera negra,
 * logo de River (adjunto inline por CID) + "ESCUELAS" (rojo) "RIVER" (blanco) "SN" (rojo).
 */
export function buildEmailHtml(
  contentHtml: string,
  options?: { title?: string; greeting?: string; baseUrl?: string }
): string {
  const title = options?.title ?? "Escuelas River SN";
  const greeting = options?.greeting ?? "";

  const headerContent = `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
        <tr>
          <td style="padding-right: 16px; vertical-align: middle;">
            <img src="cid:${LOGO_CID}" alt="River" width="48" height="48" style="display: block; width: 48px; height: 48px; object-fit: contain;" />
          </td>
          <td style="vertical-align: middle;">
            <span style="color: ${BRAND_RED}; font-weight: 800; font-size: 20px; letter-spacing: 0.04em; text-transform: uppercase;">ESCUELAS</span>
            <span style="color: #ffffff; font-weight: 800; font-size: 20px; letter-spacing: 0.04em; text-transform: uppercase;"> RIVER </span>
            <span style="color: ${BRAND_RED}; font-weight: 800; font-size: 20px; letter-spacing: 0.04em; text-transform: uppercase;">SN</span>
          </td>
        </tr>
      </table>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:${BODY_BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.6; color: ${TEXT_COLOR};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${BODY_BG}; padding: 24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px;">
          <tr>
            <td style="background-color:${HEADER_BG}; color: #fff; padding: 20px 24px; text-align: center; font-weight: 800; font-size: 20px; letter-spacing: 0.04em;">
              ${headerContent}
            </td>
          </tr>
          <tr>
            <td style="background-color:${CARD_BG}; padding: 28px 24px; border: 1px solid #e5e7eb;">
              ${greeting ? `<p style="margin: 0 0 16px 0; color: ${MUTED_COLOR}; font-size: 15px;">${escapeHtml(greeting)}</p>` : ""}
              <div style="margin: 0; color: ${TEXT_COLOR};">
                ${contentHtml}
              </div>
              <p style="margin: 24px 0 0 0; padding-top: 16px; border-top: 1px solid #eee; font-size: 13px; color: ${MUTED_COLOR};">
                Este correo fue enviado por Escuelas River SN. No responder a este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Escapa HTML para evitar XSS en contenido controlado (ej. nombre del jugador). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Convierte contenido HTML simple a texto plano (quita tags).
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

export interface MailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Adjunto inline del logo para que los clientes de correo lo muestren (evita data: URI bloqueados). */
const LOGO_ATTACHMENT = {
  filename: "logo-river.png",
  content: EMAIL_LOGO_BASE64,
  encoding: "base64" as const,
  cid: LOGO_CID,
};

/**
 * Encola un correo creando un documento en la colección mail (Trigger Email).
 * Incluye el logo como adjunto inline (CID) para que se vea en todos los clientes.
 */
export async function sendMailDoc(
  firestore: Firestore,
  payload: MailPayload
): Promise<void> {
  const text =
    payload.text ?? htmlToPlainText(payload.html);
  await addDoc(collection(firestore, MAIL_COLLECTION), {
    to: payload.to,
    message: {
      subject: payload.subject,
      html: payload.html,
      text,
      attachments: [LOGO_ATTACHMENT],
    },
  });
}
