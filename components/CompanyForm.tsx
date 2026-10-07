"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import Logo from "@/components/Logo";
import MagicBackground from "@/components/MagicBackground";

interface Fields { name: string; activity: string; offer: string; target: string; location: string; goals: string; notes: string }
interface Company extends Fields { id: string }
const EMPTY: Fields = { name: "", activity: "", offer: "", target: "", location: "", goals: "", notes: "" };
const MAX_COMPANIES = 3;
const COLS = "id,name,activity,offer,target,location,goals,notes";

const FIELDS: Array<{ key: keyof Fields; label: string; hint: string; max: number; rows: number }> = [
  { key: "name", label: "Nom de l'entreprise", hint: "Ex. : Boutique Lumière", max: 120, rows: 1 },
  { key: "activity", label: "Activité", hint: "Que faites-vous ? Ex. : vente de peinture et matériaux de construction", max: 600, rows: 3 },
  { key: "offer", label: "Produits ou services", hint: "Vos principaux produits ou services, avec les prix si possible", max: 1000, rows: 4 },
  { key: "target", label: "Clients visés", hint: "Qui achète chez vous ? Ex. : particuliers, artisans, entreprises", max: 600, rows: 3 },
  { key: "location", label: "Zone géographique", hint: "Ville, région, pays où vous travaillez", max: 200, rows: 1 },
  { key: "goals", label: "Objectifs actuels", hint: "Ex. : gagner 20 nouveaux clients par mois, lancer une promotion", max: 800, rows: 3 },
  { key: "notes", label: "Autres informations utiles", hint: "Concurrents, contraintes, ton souhaité, langue des clients…", max: 800, rows: 3 },
];

export default function CompanyForm() {
  const [list, setList] = useState<Company[]>([]);
  const [current, setCurrent] = useState("new");
  const [form, setForm] = useState<Fields>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const pick = (id: string, rows: Company[]) => {
    setCurrent(id); setMsg(""); setError("");
    const r = rows.find((x) => x.id === id);
    setForm(r ? { name: r.name, activity: r.activity, offer: r.offer, target: r.target, location: r.location, goals: r.goals, notes: r.notes } : EMPTY);
  };

  const reload = async (select?: string) => {
    const { data, error: e } = await getSupabase().from("doss_company").select(COLS).order("created_at", { ascending: true });
    if (e) throw e;
    const rows = (data as Company[]) ?? [];
    setList(rows);
    pick(select ?? rows[0]?.id ?? "new", rows);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: s } = await getSupabase().auth.getSession();
        if (!s.session) { window.location.href = "/login"; return; }
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement (le SQL 003 a-t-il été exécuté ?)");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true); setMsg(""); setError("");
    try {
      const sb = getSupabase();
      let id = current;
      if (current === "new") {
        const { data, error: e } = await sb.from("doss_company").insert({ ...form }).select("id").single();
        if (e) throw e;
        id = (data as { id: string }).id;
      } else {
        const { error: e } = await sb.from("doss_company").update({ ...form, updated_at: new Date().toISOString() }).eq("id", current);
        if (e) throw e;
      }
      try { localStorage.setItem("doss_company_id", id); } catch { /* ignoré */ }
      await reload(id);
      setMsg("Fiche enregistrée ✓ Vos agents l'utiliseront dès la prochaine mission.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (current === "new" || !window.confirm("Supprimer cette entreprise ? Cette action est définitive.")) return;
    setError("");
    try {
      const { error: e } = await getSupabase().from("doss_company").delete().eq("id", current);
      if (e) throw e;
      try { localStorage.removeItem("doss_company_id"); } catch { /* ignoré */ }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible");
    }
  }

  return (
    <>
      <MagicBackground />
      <main className="formWrap">
        <div className="formTop">
          <Logo size={48} />
          <div><div className="eyebrow">Vos entreprises</div><h1>Fiches entreprise</h1></div>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Vous pouvez gérer jusqu'à {MAX_COMPANIES} entreprises. Sur l'écran des agents, choisissez celle pour laquelle ils travaillent.
          La fiche est transmise au fournisseur d'IA à chaque mission : n'y mettez ni mot de passe, ni numéro de carte, ni information confidentielle.
        </p>
        {loading ? (
          <p className="muted">Chargement…</p>
        ) : (
          <>
            <div className="coTabs">
              {list.map((c) => (
                <button key={c.id} type="button" className={`coTab${current === c.id ? " on" : ""}`} onClick={() => pick(c.id, list)}>
                  🏢 {c.name || "Sans nom"}
                </button>
              ))}
              {list.length < MAX_COMPANIES && (
                <button type="button" className={`coTab${current === "new" ? " on" : ""}`} onClick={() => pick("new", list)}>
                  ＋ Nouvelle entreprise
                </button>
              )}
            </div>
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
                <button className="primaryButton" type="submit" disabled={saving}>{saving ? "Enregistrement…" : current === "new" ? "Créer l'entreprise" : "Enregistrer"}</button>
                <a className="ghostButton" href="/doss">← Retour aux agents</a>
                {current !== "new" && <button type="button" className="dangerBtn" onClick={remove}>Supprimer</button>}
              </div>
              {msg && <p className="ok">{msg}</p>}
              {error && <p role="alert" className="err">{error}</p>}
            </form>
          </>
        )}
      </main>
    </>
  );
}
