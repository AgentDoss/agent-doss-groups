
import "server-only";

const GRAPH_API_VERSION = "v23.0";

interface WhatsAppTextMessage {
  to: string;
  text: string;
}

interface WhatsAppApiResponse {
  messaging_product?: string;
  messages?: Array<{ id: string }>;
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

export async function sendWhatsAppTextMessage({
  to,
  text,
}: WhatsAppTextMessage): Promise<WhatsAppApiResponse> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    throw new Error(
      "Configuration WhatsApp manquante côté serveur.",
    );
  }

  const normalizedTo = to.replace(/[^\d]/g, "");

  if (!normalizedTo || normalizedTo.length < 8 || normalizedTo.length > 15) {
    throw new Error("Numéro de destinataire WhatsApp invalide.");
  }

  if (!text.trim()) {
    throw new Error("Le message WhatsApp ne peut pas être vide.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizedTo,
        type: "text",
        text: {
          preview_url: false,
          body: text,
        },
      }),
      cache: "no-store",
    },
  );

  const result = (await response.json()) as WhatsAppApiResponse;

  if (!response.ok) {
    throw new Error(
      `Échec d'envoi WhatsApp (HTTP ${response.status}).`,
    );
  }

  return result;
        }
