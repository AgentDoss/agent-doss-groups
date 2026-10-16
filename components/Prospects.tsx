
"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import Logo from "@/components/Logo";
import MagicBackground from "@/components/MagicBackground";

interface Prospect {
  id: string;
  user_id: string;
  company_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source?: string | null;
  status: string | null;
  score: number | null;
  created_at?: string | null;
  next_follow_up: string | null;
}

interface Company {
  id: string;
  name: string;
}

const STATUSES = [
  "Nouveau",
  "À contacter",
  "Contacté",
  "En négociation",
  "Client gagné",
  "Perdu",
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 14px",
  marginTop: 7,
  borderRadius: 10,
  border: "1px solid rgba(212,175,55,0.35)",
  background: "rgba(15,15,20,0.8)",
  color: "#ffffff",
  fontSize: 16,
  minHeight: 46,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginTop: 15,
  color: "#e5c76b",
  fontSize: 15,
  fontWeight: 600,
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid rgba(212,175,55,0.45)",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 44,
};

const followUpCardStyle: React.CSSProperties = {
  background: "rgba(24,24,32,0.97)",
  borderRadius: 16,
  padding: 20,
  minWidth: 0,
};

function formatDate(date: string) {
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWhatsAppNumber(phone: string | null) {
  if (!phone) return "";

  let number = phone.replace(/\D/g, "");

  if (number.startsWith("00")) {
    number = number.slice(2);
  }

  if (number.length === 10 && number.startsWith("0")) {
    number = "225" + number.slice(1);
  }

  return number;
}

export default function Prospects() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("Nouveau");
  const [nextFollowUp, setNextFollowUp] = useState("");

  const loadProspects = useCallback(
    async (ownerId: string, selectedCompanyId: string) => {
      if (!ownerId || !selectedCompanyId) {
        setProspects([]);
        return;
      }

      const supabase = getSupabase();

      const { data, error: loadError } = await supabase
        .from("doss_prospects")
        .select(
          "id,user_id,company_id,name,company,email,phone,source,status,score,created_at,next_follow_up"
        )
        .eq("user_id", ownerId)
        .eq("company_id", selectedCompanyId)
        .order("created_at", { ascending: false });

      if (loadError) {
        setError(
          "Impossible de charger les prospects : " + loadError.message
        );
        return;
      }

      setProspects((data ?? []) as Prospect[]);
    },
    []
  );

  const initialize = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = getSupabase();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        window.location.href = "/login";
        return;
      }

      const ownerId = session.user.id;
      setUserId(ownerId);

      const { data: companyData, error: companyError } = await supabase
        .from("doss_company")
        .select("id,name")
        .eq("user_id", ownerId)
        .order("created_at", { ascending: true });

      if (companyError) {
        setError(
          "Impossible de charger les entreprises : " +
            companyError.message
        );
        return;
      }

      const ownedCompanies = (companyData ?? []) as Company[];
      setCompanies(ownedCompanies);

      if (ownedCompanies.length === 0) {
        setCompanyId("");
        setProspects([]);
        return;
      }

      const storedCompanyId = localStorage.getItem("doss_company_id");
      const selectedCompany =
        ownedCompanies.find((item) => item.id === storedCompanyId) ??
        ownedCompanies[0];

      setCompanyId(selectedCompany.id);
      localStorage.setItem("doss_company_id", selectedCompany.id);

      await loadProspects(ownerId, selectedCompany.id);
    } catch {
      setError("Une erreur inattendue est survenue pendant le chargement.");
    } finally {
      setLoading(false);
    }
  }, [loadProspects]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const resetForm = () => {
    setEditingId("");
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setStatus("Nouveau");
    setNextFollowUp("");
    setError("");
    setNotice("");
  };

  const changeCompany = async (newCompanyId: string) => {
    setCompanyId(newCompanyId);
    localStorage.setItem("doss_company_id", newCompanyId);
    resetForm();
    setSearch("");
    setLoading(true);

    try {
      await loadProspects(userId, newCompanyId);
    } finally {
      setLoading(false);
    }
  };

  const saveProspect = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!userId || !companyId) {
      setError("Sélectionne d’abord une entreprise.");
      return;
    }

    if (!name.trim()) {
      setError("Le nom du prospect est obligatoire.");
      return;
    }

    if (
      email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      setError("L’adresse e-mail n’est pas valide.");
      return;
    }

    setSaving(true);

    try {
      const supabase = getSupabase();
      const wasEditing = Boolean(editingId);

      const values = {
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        status,
        next_follow_up: nextFollowUp || null,
      };

      if (editingId) {
        const { data, error: updateError } = await supabase
          .from("doss_prospects")
          .update(values)
          .eq("id", editingId)
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .select("id");

        if (updateError) {
          setError("Modification impossible : " + updateError.message);
          return;
        }

        if (!data || data.length === 0) {
          setError(
            "Aucune modification enregistrée. Vérifie les droits d’accès."
          );
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from("doss_prospects")
          .insert({
            ...values,
            user_id: userId,
            company_id: companyId,
            score: 50,
          });

        if (insertError) {
          setError("Création impossible : " + insertError.message);
          return;
        }
      }

      resetForm();
      setNotice(
        wasEditing
          ? "Prospect modifié avec succès."
          : "Prospect ajouté avec succès."
      );

      await loadProspects(userId, companyId);
    } catch {
      setError("Une erreur est survenue lors de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const editProspect = (prospect: Prospect) => {
    if (
      prospect.user_id !== userId ||
      prospect.company_id !== companyId
    ) {
      setError("Tu ne peux pas modifier ce prospect.");
      return;
    }

    setEditingId(prospect.id);
    setName(prospect.name ?? "");
    setCompany(prospect.company ?? "");
    setEmail(prospect.email ?? "");
    setPhone(prospect.phone ?? "");
    setStatus(prospect.status || "Nouveau");
    setNextFollowUp(prospect.next_follow_up ?? "");
    setError("");
    setNotice("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteProspect = async (prospect: Prospect) => {
    if (
      prospect.user_id !== userId ||
      prospect.company_id !== companyId
    ) {
      setError("Tu ne peux pas supprimer ce prospect.");
      return;
    }

    const confirmed = window.confirm(
      `Veux-tu vraiment supprimer le prospect « ${prospect.name} » ?`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    const supabase = getSupabase();

    const { data, error: deleteError } = await supabase
      .from("doss_prospects")
      .delete()
      .eq("id", prospect.id)
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .select("id");

    if (deleteError) {
      setError("Suppression impossible : " + deleteError.message);
      return;
    }

    if (!data || data.length === 0) {
      setError("Le prospect n’a pas été supprimé.");
      return;
    }

    if (editingId === prospect.id) resetForm();

    setNotice("Prospect supprimé.");
    await loadProspects(userId, companyId);
  };
    
  const convertToClient = async (prospect: Prospect) => {
    if (
      prospect.user_id !== userId ||
      prospect.company_id !== companyId
    ) {
      setError("Tu ne peux pas convertir ce prospect.");
      return;
    }

    const confirmed = window.confirm(
      `Convertir « ${prospect.name} » en client ?`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    const supabase = getSupabase();

    const { error: insertError } = await supabase
      .from("doss_clients")
      .insert({
        user_id: userId,
        company_id: companyId,
        prospect_id: prospect.id,
        name: prospect.name,
        company: prospect.company,
        email: prospect.email,
        phone: prospect.phone,
        status: "Actif",
        source: "Converti depuis un prospect",
      });

    if (insertError) {
      if (insertError.code === "23505") {
        setError("Ce prospect est déjà dans tes clients.");
      } else if (
        insertError.code === "42P01" ||
        insertError.code === "PGRST205"
      ) {
        setError(
          "La table des clients n’existe pas encore. Exécute le script supabase/002_doss_clients.sql dans Supabase (SQL Editor)."
        );
      } else {
        setError("Conversion impossible : " + insertError.message);
      }
      return;
    }

    const { error: statusError } = await supabase
      .from("doss_prospects")
      .update({ status: "Client gagné", next_follow_up: null })
      .eq("id", prospect.id)
      .eq("user_id", userId)
      .eq("company_id", companyId);

    if (statusError) {
      setError(
        "Le client a été créé, mais le statut du prospect n’a pas pu être mis à jour : " +
          statusError.message
      );
    } else {
      setNotice(
        `« ${prospect.name} » est maintenant client. Retrouve-le dans la page Clients.`
      );
    }

    await loadProspects(userId, companyId);
  };

  const openWhatsApp = (prospect: Prospect) => {
    if (
      prospect.user_id !== userId ||
      prospect.company_id !== companyId
    ) {
      setError("Tu ne peux pas contacter ce prospect.");
      return;
    }

    const number = getWhatsAppNumber(prospect.phone);

    if (!number) {
      setError(
        "Ce prospect n’a pas de numéro de téléphone. Ajoute son numéro avant d’utiliser WhatsApp."
      );
      return;
    }

    setError("");
    setNotice("");

    const today = getLocalDate();
    const followUp = prospect.next_follow_up;

    const isOverdue = Boolean(followUp && followUp < today);
    const isToday = followUp === today;
    const isFuture = Boolean(followUp && followUp > today);

    if (isFuture) {
      setNotice(
        "Relance prévue le " +
          formatDate(followUp!) +
          ". WhatsApp ne sera pas ouvert avant cette date."
      );
      return;
    }

    let message = "";

    if (isOverdue) {
      message =
        `Bonjour ${prospect.name},\n\n` +
        "Je me permets de revenir vers vous à la suite de notre précédent échange ou de notre prise de contact.\n\n" +
        "Chez AGENT DOSS GROUPS, nous aidons les entreprises à développer leur prospection commerciale, leur marketing et leur gestion client grâce à l’intelligence artificielle.\n\n" +
        "Seriez-vous disponible pour échanger sur vos besoins ?\n\n" +
        "Bien cordialement,\nAGENT DOSS GROUPS";
    } else if (isToday) {
      message =
        `Bonjour ${prospect.name},\n\n` +
        "Comme convenu, je reviens vers vous aujourd’hui au sujet de nos solutions d’intelligence artificielle pour les entreprises.\n\n" +
        "Seriez-vous disponible pour échanger quelques minutes sur vos besoins ?\n\n" +
        "Bien cordialement,\nAGENT DOSS GROUPS";
    } else if (prospect.status === "Contacté") {
      message =
        `Bonjour ${prospect.name},\n\n` +
        "Je reviens vers vous concernant notre prise de contact avec AGENT DOSS GROUPS.\n\n" +
        "Nous accompagnons les entreprises dans la prospection commerciale, le marketing digital et l’automatisation grâce à l’intelligence artificielle.\n\n" +
        "Avez-vous eu l’occasion de réfléchir à vos besoins ? Je serais ravi d’en discuter avec vous.\n\n" +
        "Bien cordialement,\nAGENT DOSS GROUPS";
    } else {
      message =
        `Bonjour ${prospect.name},\n\n` +
        "Je vous contacte au nom d’AGENT DOSS GROUPS.\n\n" +
        "Nous aidons les entreprises à gagner du temps et à développer leurs ventes grâce à des agents d’intelligence artificielle spécialisés dans la prospection, le marketing et la relation client.\n\n" +
        "Seriez-vous disponible pour un court échange afin de découvrir vos besoins ?\n\n" +
        "Bien cordialement,\nAGENT DOSS GROUPS";
    }

    const url =
      `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const today = getLocalDate();

  const activeProspects = prospects.filter(
    (prospect) =>
      prospect.status !== "Client gagné" &&
      prospect.status !== "Perdu"
  );

  const overdueProspects = activeProspects.filter(
    (prospect) =>
      !!prospect.next_follow_up &&
      prospect.next_follow_up < today
  );

  const todayProspects = activeProspects.filter(
    (prospect) => prospect.next_follow_up === today
  );

  const upcomingProspects = activeProspects.filter(
    (prospect) =>
      !!prospect.next_follow_up &&
      prospect.next_follow_up > today
  );

  const filteredProspects = prospects.filter((prospect) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;

    return [
      prospect.name,
      prospect.company,
      prospect.email,
      prospect.phone,
      prospect.status,
    ].some((value) =>
      (value ?? "").toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#0b0b10",
          color: "#e5c76b",
          padding: 24,
          fontSize: 18,
        }}
      >
        Chargement des prospects…
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0b10",
        color: "#ffffff",
        padding: "clamp(12px, 3vw, 28px)",
        boxSizing: "border-box",
      }}
    >
      <MagicBackground />

      <div
        style={{
          width: "100%",
          maxWidth: 900,
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <Logo />
          <nav style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <a
              href="/clients"
              style={{
                color: "#e5c76b",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              👥 Clients
            </a>
            <a
              href="/doss"
              style={{
                color: "#e5c76b",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              ← Tableau de bord
            </a>
          </nav>
        </header>

        <h1
          style={{
            color: "#e5c76b",
            fontSize: "clamp(25px, 5vw, 34px)",
            marginBottom: 8,
          }}
        >
          CRM sécurisé — Prospects
        </h1>

        <p style={{ color: "#b8b8c4", marginTop: 0, marginBottom: 22 }}>
          Ajoute tes prospects, suis leur statut et planifie les relances.
        </p>

        <section
          style={{
            background: "rgba(24,24,32,0.95)",
            border: "1px solid rgba(212,175,55,0.25)",
            borderRadius: 16,
            padding: "clamp(14px, 3vw, 22px)",
            marginBottom: 22,
          }}
        >
          <label style={labelStyle} htmlFor="active-company">
            Entreprise active
          </label>
          <select
            id="active-company"
            value={companyId}
            onChange={(event) => void changeCompany(event.target.value)}
            style={inputStyle}
          >
            {companies.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </section>

        <section
          style={{
            background: "rgba(24,24,32,0.95)",
            border: "1px solid rgba(212,175,55,0.25)",
            borderRadius: 16,
            padding: "clamp(14px, 3vw, 22px)",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              color: "#e5c76b",
              fontSize: 22,
              marginTop: 0,
              marginBottom: 8,
            }}
          >
            {editingId ? "✏️ Modifier le prospect" : "➕ Nouveau prospect"}
          </h2>

          <form onSubmit={saveProspect}>
            <label style={labelStyle} htmlFor="prospect-name">
              Nom *
            </label>
            <input
              id="prospect-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nom du prospect"
              required
              style={inputStyle}
            />

            <label style={labelStyle} htmlFor="prospect-company">
              Entreprise du prospect
            </label>
            <input
              id="prospect-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Nom de son entreprise"
              style={inputStyle}
            />

            <label style={labelStyle} htmlFor="prospect-email">
              E-mail
            </label>
            <input
              id="prospect-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="exemple@entreprise.com"
              style={inputStyle}
            />

            <label style={labelStyle} htmlFor="prospect-phone">
              Téléphone
            </label>
            <input
              id="prospect-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Numéro de téléphone avec indicatif pays"
              style={inputStyle}
            />

            <label style={labelStyle} htmlFor="prospect-status">
              Statut commercial
            </label>
            <select
              id="prospect-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              style={inputStyle}
            >
              {!STATUSES.includes(status) && (
                <option value={status}>{status}</option>
              )}

              {STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <label style={labelStyle} htmlFor="prospect-follow-up">
              📅 Prochaine date de relance
            </label>
            <input
              id="prospect-follow-up"
              type="date"
              value={nextFollowUp}
              onChange={(event) => setNextFollowUp(event.target.value)}
              style={inputStyle}
            />

            <p style={{ color: "#a7a7b4", fontSize: 13, marginTop: 8 }}>
              Laisse la date vide si aucune relance n’est prévue.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 18,
              }}
            >
              <button
                type="submit"
                disabled={saving || !companyId}
                style={{
                  ...buttonStyle,
                  flex: "1 1 180px",
                  background: "#d4af37",
                  color: "#151515",
                  opacity: saving ? 0.65 : 1,
                }}
              >
                {saving
                  ? "Enregistrement…"
                  : editingId
                    ? "Enregistrer les modifications"
                    : "Ajouter le prospect"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    ...buttonStyle,
                    flex: "1 1 120px",
                    background: "transparent",
                    color: "#e5c76b",
                  }}
                >
                  Annuler
                </button>
              )}
            </div>
          </form>

          {error && (
            <p
              role="alert"
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 10,
                background: "rgba(180,35,35,0.15)",
                color: "#ff9b9b",
                overflowWrap: "anywhere",
              }}
            >
              {error}
            </p>
          )}

          {notice && (
            <p
              role="status"
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 10,
                background: "rgba(30,150,90,0.12)",
                color: "#8ee0ae",
                overflowWrap: "anywhere",
              }}
            >
              {notice}
            </p>
          )}
        </section>
        
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <article
            style={{
              ...followUpCardStyle,
              border: "1px solid rgba(255,90,90,0.4)",
            }}
          >
            <p style={{ margin: 0, color: "#ff8585", fontWeight: 700 }}>
              🔴 Relances en retard
            </p>
            <p
              style={{
                fontSize: 32,
                fontWeight: 800,
                margin: "10px 0 4px",
                color: "#ff8585",
              }}
            >
              {overdueProspects.length}
            </p>
            <p style={{ margin: 0, color: "#b8b8c4", fontSize: 13 }}>
              Date de relance dépassée
            </p>
          </article>

          <article
            style={{
              ...followUpCardStyle,
              border: "1px solid rgba(255,196,80,0.4)",
            }}
          >
            <p style={{ margin: 0, color: "#ffd477", fontWeight: 700 }}>
              🟡 À relancer aujourd’hui
            </p>
            <p
              style={{
                fontSize: 32,
                fontWeight: 800,
                margin: "10px 0 4px",
                color: "#ffd477",
              }}
            >
              {todayProspects.length}
            </p>
            <p style={{ margin: 0, color: "#b8b8c4", fontSize: 13 }}>
              Relances prévues aujourd’hui
            </p>
          </article>

          <article
            style={{
              ...followUpCardStyle,
              border: "1px solid rgba(100,220,160,0.35)",
            }}
          >
            <p style={{ margin: 0, color: "#83e3ad", fontWeight: 700 }}>
              🟢 Relances à venir
            </p>
            <p
              style={{
                fontSize: 32,
                fontWeight: 800,
                margin: "10px 0 4px",
                color: "#83e3ad",
              }}
            >
              {upcomingProspects.length}
            </p>
            <p style={{ margin: 0, color: "#b8b8c4", fontSize: 13 }}>
              Relances programmées plus tard
            </p>
          </article>
        </section>

        <section>
          <label style={labelStyle} htmlFor="prospect-search">
            🔍 Rechercher un prospect
          </label>
          <input
            id="prospect-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nom, entreprise, e-mail, téléphone ou statut…"
            style={{ ...inputStyle, marginBottom: 16 }}
          />

          <p style={{ color: "#d6d6df", fontSize: 16 }}>
            <strong>{filteredProspects.length}</strong> prospect(s)
          </p>

          {filteredProspects.length === 0 ? (
            <div
              style={{
                background: "rgba(24,24,32,0.95)",
                borderRadius: 14,
                padding: 20,
                color: "#b8b8c4",
              }}
            >
              {prospects.length === 0
                ? "Aucun prospect pour cette entreprise. Ajoute ton premier prospect avec le formulaire."
                : "Aucun résultat pour cette recherche."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {filteredProspects.map((prospect) => {
                const followUp = prospect.next_follow_up;

                const isOverdue =
                  !!followUp &&
                  followUp < today &&
                  prospect.status !== "Client gagné" &&
                  prospect.status !== "Perdu";

                const isToday =
                  !!followUp &&
                  followUp === today &&
                  prospect.status !== "Client gagné" &&
                  prospect.status !== "Perdu";

                return (
                  <article
                    key={prospect.id}
                    style={{
                      background: "rgba(24,24,32,0.97)",
                      border: "1px solid rgba(212,175,55,0.25)",
                      borderRadius: 15,
                      padding: "clamp(14px, 3vw, 20px)",
                      minWidth: 0,
                      overflowWrap: "anywhere",
                    }}
                  >
                    <h3
                      style={{
                        color: "#f1d783",
                        fontSize: 20,
                        marginTop: 0,
                        marginBottom: 10,
                      }}
                    >
                      {prospect.name}
                    </h3>

                    {prospect.company && (
                      <p style={{ margin: "7px 0", color: "#dedee6" }}>
                        🏢 {prospect.company}
                      </p>
                    )}

                    {prospect.email && (
                      <p style={{ margin: "7px 0", color: "#dedee6" }}>
                        📧 {prospect.email}
                      </p>
                    )}

                    {prospect.phone && (
                      <p style={{ margin: "7px 0", color: "#dedee6" }}>
                        📞 {prospect.phone}
                      </p>
                    )}

                    <p style={{ margin: "10px 0", color: "#dedee6" }}>
                      ⭐ Score : {prospect.score ?? 50}
                    </p>

                    <p
                      style={{
                        display: "inline-block",
                        margin: "5px 0 10px",
                        padding: "7px 11px",
                        borderRadius: 20,
                        background: "rgba(212,175,55,0.12)",
                        color: "#f1d783",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      Statut : {prospect.status || "Nouveau"}
                    </p>

                    <p
                      style={{
                        margin: "5px 0 16px",
                        color: isOverdue
                          ? "#ff8585"
                          : isToday
                            ? "#ffd477"
                            : "#c8c8d2",
                        fontWeight: isOverdue || isToday ? 700 : 400,
                      }}
                    >
                      📅 Prochaine relance :{" "}
                      {followUp ? formatDate(followUp) : "Non planifiée"}
                      {isOverdue && " — EN RETARD"}
                      {isToday && " — AUJOURD’HUI"}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openWhatsApp(prospect)}
                        disabled={!prospect.phone}
                        style={{
                          ...buttonStyle,
                          flex: "1 1 100%",
                          background: prospect.phone
                            ? "rgba(37,211,102,0.14)"
                            : "rgba(100,100,100,0.12)",
                          color: prospect.phone ? "#70e0a0" : "#888888",
                          borderColor: prospect.phone
                            ? "rgba(37,211,102,0.4)"
                            : "rgba(120,120,120,0.3)",
                          cursor: prospect.phone ? "pointer" : "not-allowed",
                        }}
                      >
                        📲 Relancer sur WhatsApp
                      </button>

                      <button
                        type="button"
                        onClick={() => void convertToClient(prospect)}
                        style={{
                          ...buttonStyle,
                          flex: "1 1 100%",
                          background: "rgba(100,180,255,0.12)",
                          color: "#8cc8ff",
                          borderColor: "rgba(100,180,255,0.4)",
                        }}
                      >
                        👥 Convertir en client
                      </button>

                      <button
                        type="button"
                        onClick={() => editProspect(prospect)}
                        style={{
                          ...buttonStyle,
                          flex: "1 1 120px",
                          background: "rgba(212,175,55,0.13)",
                          color: "#f1d783",
                        }}
                      >
                        ✏️ Modifier
                      </button>

                      <button
                        type="button"
                        onClick={() => void deleteProspect(prospect)}
                        style={{
                          ...buttonStyle,
                          flex: "1 1 120px",
                          background: "rgba(180,35,35,0.12)",
                          color: "#ff9b9b",
                          borderColor: "rgba(255,100,100,0.3)",
                        }}
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
                        }

        
