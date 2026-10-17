
import { NextRequest, NextResponse } from "next/server";
import { verifyWhatsAppWebhookToken } from "@/lib/whatsapp/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AGENT DOSS GROUPS
 * Webhook WhatsApp Cloud API.
 *
 * GET : vérification du webhook par Meta.
 * POST : réception des événements WhatsApp.
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode !== "subscribe" ||
    !challenge ||
    !verifyWhatsAppWebhookToken(token)
  ) {
    return NextResponse.json(
      { error: "Vérification du webhook refusée." },
      { status: 403 },
    );
  }

  return new Response(challenge, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST() {
  // Le traitement des messages sera ajouté après la configuration
  // de la réception sécurisée des événements Meta.
  return NextResponse.json(
    { error: "Le traitement des messages n'est pas encore activé." },
    { status: 501 },
  );
}
