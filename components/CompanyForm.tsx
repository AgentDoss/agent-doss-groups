"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import Logo from "@/components/Logo";
import MagicBackground from "@/components/MagicBackground";

interface Company {
  name: string; activity: string; offer: string; target: string; location: string; goals: string; notes: string;
}
const EMPTY: Company = { name: "", activity: "", offer: "", target: "", location: "", goals: "", notes: "" };

const FIELDS: Array<{ key: keyof Company; label: string; hint: string; max: number; rows: number }> = [
  { key: "name", label: "Nom de l'entreprise", hint: "Ex. : Boutique Lumière", max: 120, rows: 1 },
  { key: "activity", label: "Activité", hint: "Que faites-vous ? Ex. : vente de peinture et matériaux de construction", max: 600, rows: 3 },
  { key: "offer", label: "Produits ou services", hint: "Vos principaux produits ou services, avec les prix si possible", max: 1000, rows: 4 },
  { key: "target", label: "Clients visés", hint: "Qui achète chez vous ? Ex. : particuliers, artisans, entreprises", max: 600, rows: 3 },
  { key: "location", label: "Zone géographique", hint: "Ville, région, pays où vous travaillez", max: 200, rows: 1 },
  { key: "goals", label: "Objectifs actuels", hint: "Ex. : gagner 20 nouveaux clients par mois, lancer une promotion", max: 800, rows: 3 },
  { key: "notes", label: "Autres informations utiles", hint: "Concurrents, contraintes, ton souhaité, langue des clients…", max: 800, rows: 3 },
];

export default function CompanyForm() {
  const [form, setForm] = useState<Company>(EMPTY);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        const { data: s } = await sb.auth.getSession();
        if (!s.session) { window.location.href = "/login"; return; }
        setUserId(s.session.user.id);
        const { data, error: e } = await sb
          .from("doss_company")
          .select("name,activity,offer,target,location,goals,notes")
          .maybeSingle();
        if (e) throw e;
        if (data) setForm({ ...EMPTY, ...(data as Partial<Company>) });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement (le SQL 002 a-t-il été exécuté ?)");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true); setMsg(""); setError("");
    try {
      const { error: e } = await getSupabase()
        .from("doss_company")
        .upsert({ user_id: userId, ...form, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (e) throw e;
      setMsg("Fiche enregistrée ✓ Vos agents l'utiliseront dès la prochaine mission.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <MagicBackground />
      <main className="formWrap">
        <div className="formTop">
          <Logo size={48} />
          <div>
            <div className="eyebrow">Votre entreprise</div>
            <h1>Fiche entreprise</h1>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Plus cette fiche est précise, plus vos agents donnent des conseils adaptés. Elle est transmise au fournisseur d'IA à chaque mission :
          n'y mettez ni mot de passe, ni numéro de carte, ni information confidentielle.
        </p>
        {loading ? (
          <p className="muted">Chargement…</p>
        ) : (
          <form className="card pad" onSubmit={save}>
            {FIELDS.map((f) => (
              <div className="field" key={f.key}>
                <label htmlFor={f.key}>{f.label}</label>
                <span className="hint">{f.hint}</span>
                {f.rows === 1 ? (
                  <input id={f.key} maxLength={f.max} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                ) : (
                  <textarea id={f.key} rows={f.rows} maxLength={f.max} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                )}
                <span className="count">{form[f.key].length} / {f.max}</span>
              </div>
            ))}
            <div className="saveBar">
              <button className="primaryButton" type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer la fiche"}</button>
              <a className="ghostButton" href="/doss">← Retour aux agents</a>
            </div>
            {msg && <p className="ok">{msg}</p>}
            {error && <p role="alert" className="err">{error}</p>}
          </form>
        )}
      </main>
    </>
  );
}
