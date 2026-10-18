
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "Configuration CRON_SECRET manquante." },
      { status: 500 }
    );
  }

  if (
    request.headers.get("authorization") !==
    `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      { error: "Accès non autorisé." },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Configuration Supabase serveur manquante." },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const today = new Date().toISOString().slice(0, 10);

    const batchSize = 500;
    const maxRows = 10_000;
    const prospects: Array<{ id: string; user_id: string | null; company_id: string | null; status: string | null; next_follow_up: string | null; phone: string | null; email: string | null }> = [];
    for (let offset = 0; offset < maxRows; offset += batchSize) {
      const { data, error } = await supabase
        .from("doss_prospects")
        .select("id, user_id, company_id, status, next_follow_up, phone, email")
        .lte("next_follow_up", today)
        .not("next_follow_up", "is", null)
        .order("id", { ascending: true })
        .range(offset, offset + batchSize - 1);
      if (error) {
        console.error("Erreur lecture des relances :", error.message);
        return NextResponse.json({ error: "Impossible de vérifier les relances." }, { status: 500 });
      }
      prospects.push(...((data ?? []) as typeof prospects));
      if (!data || data.length < batchSize) break;
    }
    const truncated = prospects.length >= maxRows;

    const statutValide = (status: string | null) =>
      status === "Nouveau" || status === "Contacté";

    const avecIdentifiants = prospects.filter(
      (p) => p.user_id && p.company_id && statutValide(p.status)
    );

    const pretsWhatsApp = avecIdentifiants.filter(
      (p) => Boolean(p.phone?.trim())
    );

    const sansTelephone = avecIdentifiants.filter(
      (p) => !p.phone?.trim()
    );

    return NextResponse.json({
      success: true,
      date: today,
      relancesEchues: prospects.length,
      prospectsEligibles: avecIdentifiants.length,
      pretsWhatsApp: pretsWhatsApp.length,
      sansTelephone: sansTelephone.length,
      lignesIgnorees:
        prospects.length - avecIdentifiants.length,
      traitementLimite: truncated,
      envoiWhatsApp: false,
      messagesEnvoyes: 0,
      message:
        "Vérification terminée. Aucun message envoyé.",
    });
  } catch (error) {
    console.error("Erreur automatisation CRM :", error);

    return NextResponse.json(
      { error: "Erreur interne pendant la vérification." },
      { status: 500 }
    );
  }
}
