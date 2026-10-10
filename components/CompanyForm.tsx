"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";
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

type EditableField =
  | "name"
  | "activity"
  | "offer"
  | "target"
  | "location"
  | "phone"
  | "email"
  | "website"
  | "address"
  | "city"
  | "country"
  | "goals"
  | "notes";

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

const FIELDS: {
  key: EditableField;
  label: string;
  hint: string;
  max: number;
  rows: number;
}[] = [
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
];

export default function CompanyForm() {
  const [list, setList] = useState<Company[]>([]);
  const [current, setCurrent] = useState("new");
  const [form, setForm] = useState<Company>(EMPTY);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const pick = useCallback((id: string, rows: Company[]) => {
    setCurrent(id);
    setMsg("");
    setError("");

    const row = rows.find((company) => company.id === id);
    setForm(row ? { ...row } : { ...EMPTY });
  }, []);

  // Annule la création et revient à une entreprise existante.
  const cancelCreation = useCallback(() => {
    if (saving || current !== "new" || list.length === 0) return;

    let activeCompany = list.find((company) => company.is_active);

    if (!activeCompany) {
      try {
        const savedId = window.localStorage.getItem("doss_company_id");
        activeCompany = list.find((company) => company.id === savedId);
      } catch {
        // Le stockage local peut être indisponible.
      }
    }

    const companyToRestore = activeCompany || list[0];

    pick(companyToRestore.id, list);
  }, [current, list, pick, saving]);

  const reload = useCallback(
    async (selected?: string) => {
      const { data, error: queryError } = await getSupabase()
        .from("doss_company")
        .select(COLS)
        .order("created_at", { ascending: true });

      if (queryError) throw queryError;

      const rows = (data ?? []) as Company[];

      setList(rows);

      const requestedId = selected || current;
      const selectedId = rows.some((company) => company.id === requestedId)
        ? requestedId
        : rows.find((company) => company.is_active)?.id ||
          rows[0]?.id ||
          "new";

      pick(selectedId, rows);
    },
    [current, pick]
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const { data: authData, error: authError } =
          await getSupabase().auth.getUser();

        if (authError) throw authError;

        if (!authData.user) {
          throw new Error("Session expirée. Connecte-toi à nouveau.");
        }

        const { data, error: queryError } = await getSupabase()
          .from("doss_company")
          .select(COLS)
          .order("created_at", { ascending: true });

        if (queryError) throw queryError;

        if (cancelled) return;

        const rows = (data ?? []) as Company[];
        setList(rows);

        let preferredId = "new";

        try {
          preferredId =
            window.localStorage.getItem("doss_company_id") || "new";
        } catch {
          // Le stockage local peut être indisponible.
        }

        const selectedId = rows.some((company) => company.id === preferredId)
          ? preferredId
          : rows.find((company) => company.is_active)?.id ||
            rows[0]?.id ||
            "new";

        pick(selectedId, rows);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Impossible de charger les entreprises."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [pick]);

  async function setActive(id: string) {
    setMsg("");
    setError("");

    if (saving) return;

    if (!list.some((company) => company.id === id)) {
      setError("Entreprise invalide ou inaccessible.");
      return;
    }

    setSaving(true);

    try {
      const sb = getSupabase();

      const { error: deactivateError } = await sb
        .from("doss_company")
        .update({ is_active: false })
        .eq("is_active", true);

      if (deactivateError) throw deactivateError;

      const { data, error: activateError } = await sb
        .from("doss_company")
        .update({ is_active: true })
        .eq("id", id)
        .select("id");

      if (activateError) throw activateError;

      if (!data?.some((company) => company.id === id)) {
        throw new Error(
          "L'entreprise n'a pas été activée. Vérifie tes droits d'accès."
        );
      }

      await reload(id);

      try {
        window.localStorage.setItem("doss_company_id", id);
      } catch {
        // L'activation en base reste prioritaire.
      }

      setMsg("Entreprise active mise à jour.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Impossible de changer l'entreprise active."
      );
    } finally {
      setSaving(false);
    }
  }

  async function save(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setMsg("");
    setError("");

    if (saving) return;

    const cleanName = form.name.trim();

    if (!cleanName) {
      setError("Le nom de l'entreprise est obligatoire.");
      return;
    }

    setSaving(true);

    try {
      const sb = getSupabase();

      const payload = Object.fromEntries(
        FIELDS.map(({ key }) => [key, String(form[key] ?? "").trim()])
      ) as Record<EditableField, string>;

      let id: string;

      if (current === "new") {
        if (list.length >= MAX_COMPANIES) {
          throw new Error(
            `La limite de ${MAX_COMPANIES} entreprises est atteinte.`
          );
        }

        const { data, error: insertError } = await sb
          .from("doss_company")
          .insert(payload)
          .select("id")
          .single();

        if (insertError) throw insertError;

        id = data.id;
      } else {
        const { data, error: updateError } = await sb
          .from("doss_company")
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", current)
          .select("id");

        if (updateError) throw updateError;

        if (!data?.some((company) => company.id === current)) {
          throw new Error(
            "Aucune entreprise modifiée. Vérifie tes droits d'accès."
          );
        }

        id = current;
      }

      await reload(id);

      setMsg("Entreprise enregistrée avec succès.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Erreur lors de l'enregistrement."
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setMsg("");
    setError("");

    if (current === "new" || saving) return;

    const company = list.find((item) => item.id === current);

    if (!company) {
      setError("Entreprise introuvable.");
      return;
    }

    const confirmed = window.confirm(
      `Supprimer définitivement l'entreprise "${company.name}" ?`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const { data, error: deleteError } = await getSupabase()
        .from("doss_company")
        .delete()
        .eq("id", current)
        .select("id");

      if (deleteError) throw deleteError;

      if (!data?.some((item) => item.id === current)) {
        throw new Error(
          "Aucune entreprise supprimée. Vérifie tes droits d'accès."
        );
      }

      await reload();

      setMsg("Entreprise supprimée.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Impossible de supprimer cette entreprise."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <MagicBackground />

      <main className="content">
        <div className="top companyTop">
          <div>
            <div className="eyebrow companyEyebrow">
              AGENT DOSS GROUPS · ESPACE ENTREPRISE
            </div>

            <h1>Mes entreprises</h1>

            <p className="companySubtitle">
              Gérez vos sociétés, vos coordonnées et vos objectifs.
            </p>
          </div>

          <div className="companyHeaderActions">
            {current === "new" && list.length > 0 && (
              <button
                type="button"
                className="companyCancelButton"
                onClick={cancelCreation}
                disabled={saving}
              >
                ✕ Annuler la création
              </button>
            )}

            <button
              type="button"
              className="companyNewButton"
              onClick={() => pick("new", list)}
              disabled={saving || list.length >= MAX_COMPANIES}
            >
              ＋ Nouvelle entreprise
            </button>
          </div>
        </div>

        {loading ? (
          <p>Chargement...</p>
        ) : (
          <>
            <div className="coTabs">
              {list.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  className={`coTab ${current === company.id ? "on" : ""}`}
                  onClick={() => pick(company.id, list)}
                  disabled={saving}
                >
                  🏢 {company.name || "Sans nom"}

                  {company.is_active && (
                    <span className="tag">Active</span>
                  )}
                </button>
              ))}

              {list.length < MAX_COMPANIES && (
                <button
                  type="button"
                  className="coTab"
                  onClick={() => pick("new", list)}
                  disabled={saving}
                >
                  + Nouvelle
                </button>
              )}
            </div>

            <div className="card pad">
              <h2>{form.name || "Nouvelle entreprise"}</h2>

              {form.is_active && (
                <span className="tag">✅ Entreprise Active</span>
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
                {FIELDS.map((field) => (
                  <div className="field" key={field.key}>
                    <label htmlFor={`company-${field.key}`}>
                      {field.label}
                    </label>

                    {field.rows === 1 ? (
                      <input
                        id={`company-${field.key}`}
                        type="text"
                        maxLength={field.max}
                        placeholder={field.hint}
                        value={form[field.key]}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            [field.key]: event.target.value,
                          }))
                        }
                        disabled={saving}
                      />
                    ) : (
                      <textarea
                        id={`company-${field.key}`}
                        rows={field.rows}
                        maxLength={field.max}
                        placeholder={field.hint}
                        value={form[field.key]}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            [field.key]: event.target.value,
                          }))
                        }
                        disabled={saving}
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
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </button>

                  {current !== "new" && (
                    <>
                      <button
                        type="button"
                        className="ghostButton"
                        onClick={() => void setActive(current)}
                        disabled={saving}
                      >
                        {saving ? "Traitement..." : "Définir active"}
                      </button>

                      <button
                        type="button"
                        className="dangerBtn"
                        onClick={() => void remove()}
                        disabled={saving}
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                </div>

                {msg && (
                  <p className="ok" role="status">
                    {msg}
                  </p>
                )}

                {error && (
                  <p className="err" role="alert">
                    {error}
                  </p>
                )}
              </form>
            </div>
          </>
        )}
      </main>
    </>
  );
  }
