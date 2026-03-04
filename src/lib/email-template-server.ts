/**
 * Plantilla de email con logo para uso en servidor (API, Cloud Functions).
 * Sin dependencias de Firestore cliente.
 */

import { EMAIL_LOGO_BASE64 } from "./email-logo-base64";

const BODY_BG = "#f5f5f5";
const CARD_BG = "#ffffff";
const TEXT_COLOR = "#1a1a1a";
const MUTED_COLOR = "#6b7280";
const HEADER_BG = "#0a0a0a";
const LOGO_CID = "logo@app";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Genera HTML de correo con cabecera (logo + ESCUELAS RIVER) y cuerpo.
 */
export function buildEmailHtmlServer(
  contentHtml: string,
  options?: { title?: string; greeting?: string }
): string {
  const title = options?.title ?? "Escuelas River";
  const greeting = options?.greeting ?? "";

  const headerContent = `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
        <tr>
          <td style="padding-right: 16px; vertical-align: middle;">
            <img src="cid:${LOGO_CID}" alt="Logo" width="48" height="48" style="display: block; width: 48px; height: 48px; object-fit: contain;" />
          </td>
          <td style="vertical-align: middle;">
            <span style="color: #ffffff; font-weight: 800; font-size: 20px; letter-spacing: 0.04em; text-transform: uppercase;">ESCUELAS RIVER</span>
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
                Este correo fue enviado por Escuelas River. No responder a este mensaje.
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

/** Adjunto del logo para Trigger Email (mismo CID que la plantilla). */
export const LOGO_ATTACHMENT_SERVER = {
  filename: "logo-app.png",
  content: EMAIL_LOGO_BASE64,
  encoding: "base64" as const,
  cid: LOGO_CID,
};
