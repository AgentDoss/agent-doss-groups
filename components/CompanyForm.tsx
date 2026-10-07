"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import Logo from "@/components/Logo";
import MagicBackground from "@/components/MagicBackground";

interface Company {
  id: string;

  name: string;
  activity: string;
  offer: string;
  target: string;
  location: string;
  goals: string;
  notes: string;

  website: string;
  email: string;
  phone: string;

  address: string;
  city: string;
  country: string;

  monthly_revenue: number;
  lead_count: number;
  customer_count: number;
  ai_score: number;

  is_active: boolean;
}

const EMPTY: Company = {
  id: "",

  name: "",
  activity: "",
  offer: "",
  target: "",
  location: "",
  goals: "",
  notes: "",

  website: "",
  email: "",
  phone: "",

  address: "",
  city: "",
  country: "",

  monthly_revenue: 0,
  lead_count: 0,
  customer_count: 0,
  ai_score: 50,

  is_active: false,
};

const MAX_COMPANIES = 3;

const COLS = `
id,
name,
activity,
offer,
target,
location,
goals,
notes,
website,
email,
phone,
address,
city,
country,
monthly_revenue,
lead_count,
customer_count,
ai_score,
is_active
`;

const FIELDS = [
  {
    key: "name",
    label: "Nom de l'entreprise",
    hint: "Nom commercial",
    max: 120,
    rows: 1,
  },

  {
    key: "activity",
    label: "Activité",
    hint: "Votre activité principale",
    max: 600,
    rows: 3,
  },

  {
    key: "offer",
    label: "Produits & Services",
    hint: "Ce que vous vendez",
    max: 1000,
    rows: 4,
  },

  {
    key: "target",
    label: "Clients visés",
    hint: "Votre clientèle",
    max: 600,
    rows: 3,
  },

  {
    key: "location",
    label: "Zone géographique",
    hint: "Zone couverte",
    max: 200,
    rows: 1,
  },

  {
    key: "phone",
    label: "Téléphone",
    hint: "+225...",
    max: 50,
    rows: 1,
  },

  {
    key: "email",
    label: "Email",
    hint: "contact@entreprise.com",
    max: 120,
    rows: 1,
  },

  {
    key: "website",
    label: "Site Web",
    hint: "https://...",
    max: 200,
    rows: 1,
  },

  {
    key: "address",
    label: "Adresse",
    hint: "Rue, quartier...",
    max: 300,
    rows: 2,
  },

  {
    key: "city",
    label: "Ville",
    hint: "Abidjan",
    max: 120,
    rows: 1,
  },

  {
    key: "country",
    label: "Pays",
    hint: "Côte d'Ivoire",
    max: 120,
    rows: 1,
  },

  {
    key: "goals",
    label: "Objectifs",
    hint: "Objectifs actuels",
    max: 800,
    rows: 3,
  },

  {
    key: "notes",
    label: "Notes",
    hint: "Informations complémentaires",
    max: 800,
    rows: 3,
  },
] as const;

export default function CompanyForm() {
  const [list, setList] = useState<Company[]>([]);
  const [current, setCurrent] = useState("new");
  const [form, setForm] = useState<Company>(EMPTY);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
    const pick = (id: string, rows: Company[]) => {
    setCurrent(id);
    setMsg("");
    setError("");

    const row = rows.find((x) => x.id === id);

    setForm(row ? row : EMPTY);
  };

  const reload = async (selected?: string) => {
    const { data, error } = await getSupabase()
      .from("doss_company")
      .select(COLS)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const rows = (data as Company[]) || [];

    setList(rows);

    pick(selected || rows[0]?.id || "new", rows);
  };

  async function setActive(id: string) {
    await getSupabase()
      .from("doss_company")
      .update({ is_active: false })
      .neq("id", "");

    await getSupabase()
      .from("doss_company")
      .update({ is_active: true })
      .eq("id", id);

    reload(id);
  }

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Erreur chargement entreprise"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(ev: React.FormEvent) {
    ev.preventDefault();

    setSaving(true);

    try {
      const sb = getSupabase();

      let id = current;

      if (current === "new") {
        const { data, error } = await sb
          .from("doss_company")
          .insert({
            ...form,
          })
          .select("id")
          .single();

        if (error) throw error;

        id = data.id;
      } else {
        const { error } = await sb
          .from("doss_company")
          .update({
            ...form,
            updated_at: new Date().toISOString(),
          })
          .eq("id", current);

        if (error) throw error;
      }

      await reload(id);

      setMsg("Entreprise enregistrée avec succès");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Erreur d'enregistrement"
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (current === "new") return;

    if (!confirm("Supprimer cette entreprise ?")) return;

    const { error } = await getSupabase()
      .from("doss_company")
      .delete()
      .eq("id", current);

    if (error) {
      setError(error.message);
      return;
    }

    reload();
               }
    return (
    <>
      <MagicBackground />

      <main className="content">

        <div className="top">
          <div>
            <div className="eyebrow">AGENT DOSS GROUPS</div>
            <h1>Entreprises</h1>
          </div>
        </div>

        {loading ? (
          <p>Chargement...</p>
        ) : (
          <>
            <div className="coTabs">

              {list.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`coTab ${current === c.id ? "on" : ""}`}
                  onClick={() => pick(c.id, list)}
                >
                  🏢 {c.name || "Sans nom"}

                  {c.is_active && (
                    <span className="tag">
                      Active
                    </span>
                  )}
                </button>
              ))}

              {list.length < MAX_COMPANIES && (
                <button
                  type="button"
                  className="coTab"
                  onClick={() => pick("new", list)}
                >
                  + Nouvelle
                </button>
              )}
            </div>

            <div className="card pad">

              <h2>
                {form.name || "Nouvelle entreprise"}
              </h2>

              {form.is_active && (
                <span className="tag">
                  ✅ Entreprise Active
                </span>
              )}

              <div className="stats">

                <div className="card stat">
                  <b>{form.lead_count}</b>
                  <span>Prospects</span>
                </div>

                <div className="card stat">
                  <b>{form.customer_count}</b>
                  <span>Clients</span>
                </div>

                <div className="card stat">
                  <b>{form.monthly_revenue}</b>
                  <span>CA Mensuel</span>
                </div>

                <div className="card stat">
                  <b>{form.ai_score}/100</b>
                  <span>Score IA</span>
                </div>

              </div>

              <form onSubmit={save}>

                {FIELDS.map((f) => (
                  <div className="field" key={f.key}>

                    <label>{f.label}</label>

                    {f.rows === 1 ? (
                      <input
                        value={(form as any)[f.key]}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            [f.key]: e.target.value,
                          })
                        }
                      />
                    ) : (
                      <textarea
                        rows={f.rows}
                        value={(form as any)[f.key]}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            [f.key]: e.target.value,
                          })
                        }
                      />
                    )}

                  </div>
                ))}

                <div className="saveBar">

                  <button
                    className="primaryButton"
                    type="submit"
                    disabled={saving}
                  >
                    {saving
                      ? "Enregistrement..."
                      : "Enregistrer"}
                  </button>

                  {current !== "new" && (
                    <>
                      <button
                        type="button"
                        className="ghostButton"
                        onClick={() => setActive(current)}
                      >
                        Définir active
                      </button>

                      <button
                        type="button"
                        className="dangerBtn"
                        onClick={remove}
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                </div>

                {msg && <p className="ok">{msg}</p>}
                {error && <p className="err">{error}</p>}

              </form>

            </div>
          </>
        )}
      </main>
    </>
  );
}
  
