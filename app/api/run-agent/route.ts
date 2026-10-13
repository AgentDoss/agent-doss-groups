import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';
import { Resend } from 'resend';

// Forcer Next.js à traiter cette route comme une route dynamique
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    // Initialisation dynamique des SDK au moment de l'exécution
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variables Supabase manquantes dans Vercel.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const groq = new Groq({ apiKey: groqApiKey || '' });
    const resend = new Resend(resendApiKey || '');

    // 1. Récupérer un prospect en attente
    const { data: prospects, error: fetchError } = await supabase
      .from('prospects')
      .select('*')
      .eq('statut', 'pending')
      .limit(1);

    if (fetchError) throw fetchError;
    if (!prospects || prospects.length === 0) {
      return NextResponse.json({ message: 'Aucun nouveau prospect à contacter.' });
    }

    const prospect = prospects[0];

    // 2. Étape d'enrichissement optionnelle
    let infosEnrichies = prospect.entreprise;
    try {
      if (prospect.domaine_entreprise && process.env.HUNTER_API_KEY) {
        const hunterResponse = await fetch(
          `https://api.hunter.io/v2/domain-search?domain=${prospect.domaine_entreprise}&api_key=${process.env.HUNTER_API_KEY}`
        );
        const hunterData = await hunterResponse.json();
        if (hunterData.data && hunterData.data.organization) {
          infosEnrichies = `${prospect.entreprise} (${hunterData.data.organization})`;
        }
      }
    } catch (enrichError: any) {
      console.log('Erreur d\'enrichissement (ignorée) :', enrichError.message);
    }

    // 3. Générer le message via Groq
    const chatCompletion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en prospection commerciale B2B. Rédige un e-mail court, percutant et courtois (maximum 4 phrases).'
        },
        {
          role: 'user',
          content: `Rédige un e-mail de prospection pour ${prospect.nom}, qui travaille chez ${infosEnrichies}.`
        }
      ],
      temperature: 0.7,
    });

    const messageGenere = chatCompletion.choices[0]?.message?.content || "Bonjour";

    // 4. Envoyer l'e-mail via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: [prospect.email],
      subject: `Proposition de collaboration pour ${prospect.entreprise}`,
      text: messageGenere,
    });

    if (emailError) {
      throw new Error(`Erreur d'envoi Resend : ${emailError.message}`);
    }

    // 5. Mettre à jour le statut dans Supabase
    const { error: updateError } = await supabase
      .from('prospects')
      .update({ statut: 'sent' })
      .eq('id', prospect.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      prospect: prospect.email,
      messageGenere,
      emailId: emailData?.id,
    });

  } catch (error: any) {
    console.error('Erreur de l\'agent :', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
