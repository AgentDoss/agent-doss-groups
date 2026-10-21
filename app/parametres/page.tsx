"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Company = { id: string; name: string; activity: string | null; offer: string | null; target: string | null; city: string | null; country: string | null; goals: string | null; notes: string | null };
const callbackBase = "https://agent-doss-groups.vercel.app";

export default function SettingsPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<Partial<Company>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const sb = getSupabase();
    const { data: session } = await sb.auth.getSession();
    if (!session.session) { window.location.href = "/login"; return; }
    const { data, error: readError } = await sb.from("doss_company").select("id,name,activity,offer,target,city,country,goals,notes").eq("is_active", true).maybeSingle();
    if (readError) throw readError;
    const next = (data as Company | null) ?? null;
    setCompany(next); setForm(next ?? {}); setLoading(false);
  }, []);

  useEffect(() => { void load().catch((e) => { setError(e instanceof Error ? e.message : "Impossible de charger les paramètres."); setLoading(false); }); }, [load]);

  async function save() {
    if (!company) return;
    setSaving(true); setMessage(""); setError("");
    const { error: saveError } = await getSupabase().from("doss_company").update({ name: form.name, activity: form.activity, offer: form.offer, target: form.target, city: form.city, country: form.country, goals: form.goals, notes: form.notes }).eq("id", company.id);
    if (saveError) setError(saveError.message); else { setCompany({ ...company, ...form } as Company); setMessage("Fiche entreprise enregistrée."); }
    setSaving(false);
  }

  function update(key: keyof Company, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  function copy(value: string) { void navigator.clipboard?.writeText(value); setMessage("URL copiée dans le presse-papiers."); }

  return <main className="settingsPage">
    <header className="settingsHero"><div><div className="eyebrow">Configuration stratégique</div><h1>Paramètres & intégrations</h1><p>Centralisez votre entreprise, vos préférences et vos futurs canaux de communication.</p></div><span className="settingsShield">✦ Données protégées</span></header>
    {error ? <div className="card pad settingsError">{error}</div> : null}
    {loading ? <div className="card pad settingsEmpty">Chargement de votre espace de configuration…</div> : <>
      <section className="settingsLayout">
        <div className="card pad"><div className="panelTitle"><div><div className="eyebrow">Contexte des agents</div><h2>Fiche entreprise</h2></div><span className="softBadge">Source IA</span></div><p className="settingsHint">Ces informations servent de référence aux agents. Ils doivent distinguer vos données réelles des hypothèses.</p><div className="settingsForm"><Field label="Nom de l’entreprise" value={form.name ?? ""} onChange={(v) => update("name", v)} /><Field label="Activité" value={form.activity ?? ""} onChange={(v) => update("activity", v)} /><Field label="Offre principale" value={form.offer ?? ""} onChange={(v) => update("offer", v)} /><Field label="Clients visés" value={form.target ?? ""} onChange={(v) => update("target", v)} /><div className="fieldPair"><Field label="Ville" value={form.city ?? ""} onChange={(v) => update("city", v)} /><Field label="Pays" value={form.country ?? ""} onChange={(v) => update("country", v)} /></div><Field label="Objectifs commerciaux" value={form.goals ?? ""} onChange={(v) => update("goals", v)} area /><Field label="Notes pour les agents" value={form.notes ?? ""} onChange={(v) => update("notes", v)} area /></div><div className="settingsActions"><button className="primaryButton" onClick={() => void save()} disabled={saving || !company}>{saving ? "Enregistrement…" : "Enregistrer la fiche"}</button>{message ? <span className="ok">{message}</span> : null}</div></div>
        <div className="settingsStack"><div className="card pad"><div className="panelTitle"><div><div className="eyebrow">Canaux officiels</div><h2>Réseaux sociaux</h2></div></div><p className="settingsHint">Les agents préparent. Vous validez. Aucun message ne sera envoyé sans confirmation humaine.</p><SocialCard icon="f" name="Facebook Page" detail="Publication et statistiques de votre Page professionnelle" status="Préparation Meta" /><SocialCard icon="◉" name="WhatsApp Business" detail="Messages Cloud API avec numéro professionnel" status="Test Meta réussi" /><SocialCard icon="♪" name="TikTok" detail="Dépôt de vidéos et photos avec consentement" status="À préparer" /></div><div className="card pad"><div className="panelTitle"><div><div className="eyebrow">Sécurité OAuth</div><h2>URLs de rappel</h2></div></div><p className="settingsHint">À déclarer dans les tableaux de bord Meta et TikTok. Les secrets restent côté serveur.</p><Callback label="Meta Facebook" value={`${callbackBase}/api/social/meta/callback`} onCopy={copy} /><Callback label="TikTok" value={`${callbackBase}/api/social/tiktok/callback`} onCopy={copy} /><div className="securityNote">🔒 Ne mettez jamais un App Secret, Client Secret ou token dans l’APK.</div></div></div>
      </section>
    </>}
  </main>;
}

function Field({ label, value, onChange, area = false }: { label: string; value: string; onChange: (value: string) => void; area?: boolean }) { return <label className="settingsField"><span>{label}</span>{area ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} /> : <input value={value} onChange={(e) => onChange(e.target.value)} />}</label>; }
function SocialCard({ icon, name, detail, status }: { icon: string; name: string; detail: string; status: string }) { return <div className="socialCard"><span className="socialIcon">{icon}</span><div><b>{name}</b><small>{detail}</small></div><span className="softBadge">{status}</span></div>; }
function Callback({ label, value, onCopy }: { label: string; value: string; onCopy: (value: string) => void }) { return <div className="callbackRow"><small>{label}</small><button onClick={() => onCopy(value)} title="Copier l’URL">{value}<b>Copier</b></button></div>; }
