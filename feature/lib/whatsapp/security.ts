
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * AGENT DOSS GROUPS
 * Sécurité du webhook WhatsApp Cloud API.
 *
 * Ce module ne modifie aucun fichier existant.
 */

export function verifyWhatsAppWebhookToken(
  receivedToken: string | null,
): boolean {
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expectedToken || !receivedToken) {
    return false;
  }

  const received = Buffer.from(receivedToken, "utf8");
  const expected = Buffer.from(expectedToken, "utf8");

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret || !signatureHeader) {
    return false;
  }

  const expectedSignature =
    "sha256=" +
    createHmac("sha256", appSecret)
      .update(rawBody, "utf8")
      .digest("hex");

  const received = Buffer.from(signatureHeader, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}
