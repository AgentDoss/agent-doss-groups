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

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${cronSecret}`) {
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

    const { data, error } = await supabase
      .from("doss_prospects")
      .select("id, user_id, company_id, next_follow_up")
      .lte("next_follow_up", today)
      .not("next_follow_up", "is", null)
      .limit(500);

    if (error) {
      console.error("Erreur lecture des relances :", error.message);

      return NextResponse.json(
        { error: "Impossible de vérifier les relances." },
        { status: 500 }
      );
    }

    const prospects = data ?? [];

    const valid = prospects.filter(
      (p) => p.user_id && p.company_id
    );

    const ignored = prospects.length - valid.length;

    return NextResponse.json({
      success: true,
      date: today,
      relancesEchues: valid.length,
      lignesIgnorees: ignored,
      envoiWhatsApp: false,
      message: "Vérification terminée. Aucun message envoyé.",
    });
  } catch (error) {
    console.error("Erreur automatisation CRM :", error);

    return NextResponse.json(
      { error: "Erreur interne pendant la vérification." },
      { status: 500 }
    );
  }
          }
