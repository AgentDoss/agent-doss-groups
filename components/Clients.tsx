"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import Logo from "@/components/Logo";
import MagicBackground from "@/components/MagicBackground";

interface Client {
  id: string;
  user_id: string;
  company_id: string;
  prospect_id: string | null;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  total_amount: number | null;
  last_purchase_date: string | null;
  next_follow_up: string | null;
  source: string | null;
  notes: string | null;
  created_at?: string | null;
}

interface Company {
  id: string;
  name: string;
}

const STATUSES = ["Actif", "VIP", "À réactiver", "Inactif"];

const CLIENT_COLUMNS =
  "id,user_id,company_id,prospect_id,name,company,email,phone,status,total_amount,last_purchase_date,next_follow_up,source,notes,created_at";

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

const statCardStyle: React.CSSProperties = {
  background: "rgba(24,24,32,0.97)",
  borderRadius: 16,
  padding: 20,
  minWidth: 0,
};

const sectionStyle: React.CSSProperties = {
  background: "rgba(24,24,32,0.95)",
  border: "1px solid rgba(212,175,55,0.25)",
  borderRadius: 16,
  padding: "clamp(14px, 3vw, 22px)",
  marginBottom: 22,
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

function formatAmount(value: number) {
  return Math.round(value).toLocaleString("fr-FR");
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

function describeLoadError(message: string, code?: string) {
  const tableMissing =
    code === "42P01" ||
    code === "PGRST205" ||
    (/doss_clients/i.test(message) &&
      /(does not exist|schema cache)/i.test(message));

  if (tableMissing) {
    return (
      "La table des clients n’existe pas encore. Exécute le script " +
      "supabase/002_doss_clients.sql dans Supabase (SQL Editor), puis recharge cette page."
    );
  }

  return message;
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
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
  const [status, setStatus] = useState("Actif");
  const [totalAmount, setTotalAmount] = useState("");
  const [lastPurchase, setLastPurchase] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [notes, setNotes] = useState("");

  const loadClients = useCallback(
    async (ownerId: string, selectedCompanyId: string) => {
      if (!ownerId || !selectedCompanyId) {
        setClients([]);
        return;
      }

      const supabase = getSupabase();

      const { data, error: loadError } = await supabase
        .from("doss_clients")
        .select(CLIENT_COLUMNS)
        .eq("user_id", ownerId)
        .eq("company_id", selectedCompanyId)
        .order("created_at", { ascending: false });

      if (loadError) {
        setError(
          "Impossible de charger les clients : " +
            describeLoadError(loadError.message, loadError.code)
        );
        return;
      }

      setClients((data ?? []) as Client[]);
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
          "Impossible de charger les entreprises : " + companyError.message
        );
        return;
      }

      const ownedCompanies = (companyData ?? []) as Company[];
      setCompanies(ownedCompanies);

      if (ownedCompanies.length === 0) {
        setCompanyId("");
        setClients([]);
        return;
      }

      let storedCompanyId = "";
      try {
        storedCompanyId = localStorage.getItem("doss_company_id") ?? "";
      } catch {
        // Stockage local indisponible
      }

      const selectedCompany =
        ownedCompanies.find((item) => item.id === storedCompanyId) ??
        ownedCompanies[0];

      setCompanyId(selectedCompany.id);
      try {
        localStorage.setItem("doss_company_id", selectedCompany.id);
      } catch {
        // Stockage local indisponible
      }

      await loadClients(ownerId, selectedCompany.id);
    } catch {
      setError("Une erreur inattendue est survenue pendant le chargement.");
    } finally {
      setLoading(false);
    }
  }, [loadClients]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const resetForm = () => {
    setEditingId("");
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setStatus("Actif");
    setTotalAmount("");
    setLastPurchase("");
    setNextFollowUp("");
    setNotes("");
    setError("");
    setNotice("");
  };

  const changeCompany = async (newCompanyId: string) => {
    setCompanyId(newCompanyId);
    try {
      localStorage.setItem("doss_company_id", newCompanyId);
    } catch {
      // Stockage local indisponible
    }
    resetForm();
    setSearch("");
    setLoading(true);

    try {
      await loadClients(userId, newCompanyId);
    } finally {
      setLoading(false);
    }
  };

  const saveClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!userId || !companyId) {
      setError("Sélectionne d’abord une entreprise.");
      return;
    }

    if (!name.trim()) {
      setError("Le nom du client est obligatoire.");
      return;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("L’adresse e-mail n’est pas valide.");
      return;
    }

    const amount = totalAmount.trim() ? Number(totalAmount.replace(",", ".")) : 0;

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Le montant doit être un nombre positif.");
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
        total_amount: amount,
        last_purchase_date: lastPurchase || null,
        next_follow_up: nextFollowUp || null,
        notes: notes.trim() || null,
      };

      if (editingId) {
        const { data, error: updateError } = await supabase
          .from("doss_clients")
          .update(values)
          .eq("id", editingId)
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .select("id");

        if (updateError) {
          setError(
            "Modification impossible : " +
              describeLoadError(updateError.message, updateError.code)
          );
          return;
        }

        if (!data || data.length === 0) {
          setError("Aucune modification enregistrée. Vérifie les droits d’accès.");
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from("doss_clients")
          .insert({
            ...values,
            user_id: userId,
            company_id: companyId,
            source: "Ajout manuel",
          });

        if (insertError) {
          setError(
            "Création impossible : " +
              describeLoadError(insertError.message, insertError.code)
          );
          return;
        }
      }

      resetForm();
      setNotice(
        wasEditing ? "Client modifié avec succès." : "Client ajouté avec succès."
      );

      await loadClients(userId, companyId);
    } catch {
      setError("Une erreur est survenue lors de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const editClient = (client: Client) => {
    if (client.user_id !== userId || client.company_id !== companyId) {
      setError("Tu ne peux pas modifier ce client.");
      return;
    }

    setEditingId(client.id);
    setName(client.name ?? "");
    setCompany(client.company ?? "");
    setEmail(client.email ?? "");
    setPhone(client.phone ?? "");
    setStatus(client.status || "Actif");
    setTotalAmount(
      client.total_amount !== null && Number(client.total_amount) > 0
        ? String(client.total_amount)
        : ""
    );
    setLastPurchase(client.last_purchase_date ?? "");
    setNextFollowUp(client.next_follow_up ?? "");
    setNotes(client.notes ?? "");
    setError("");
    setNotice("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteClient = async (client: Client) => {
    if (client.user_id !== userId || client.company_id !== companyId) {
      setError("Tu ne peux pas supprimer ce client.");
      return;
    }

    const confirmed = window.confirm(
      `Veux-tu vraiment supprimer le client « ${client.name} » ?`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    const supabase = getSupabase();

    const { data, error: deleteError } = await supabase
      .from("doss_clients")
      .delete()
      .eq("id", client.id)
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .select("id");

    if (deleteError) {
      setError("Suppression impossible : " + deleteError.message);
      return;
    }

    if (!data || data.length === 0) {
      setError("Le client n’a pas été supprimé.");
      return;
    }

    if (editingId === client.id) resetForm();

    setNotice("Client supprimé.");
    await loadClients(userId, companyId);
  };

  const companyName =
    companies.find((item) => item.id === companyId)?.name ?? "notre entreprise";

  const openWhatsApp = (client: Client) => {
    if (client.user_id !== userId || client.company_id !== companyId) {
      setError("Tu ne peux pas contacter ce client.");
      return;
    }

    const number = getWhatsAppNumber(client.phone);

    if (!number) {
      setError(
        "Ce client n’a pas de numéro de téléphone. Ajoute son numéro avant d’utiliser WhatsApp."
      );
      return;
    }

    setError("");
    setNotice("");

    const todayDate = getLocalDate();
    const followUp = client.next_follow_up;
    const dueFollowUp = Boolean(followUp && followUp <= todayDate);
    const dormant = client.status === "À réactiver" || client.status === "Inactif";

    let message = "";

    if (dormant) {
      message =
        `Bonjour ${client.name},\n\n` +
        "Cela fait un moment que nous n’avons pas échangé.\n\n" +
        `Chez ${companyName}, nous restons à votre disposition. Comment allez-vous, et y a-t-il un besoin sur lequel nous pouvons vous aider ?\n\n` +
        `Cordialement,\n${companyName}`;
    } else if (dueFollowUp) {
      message =
        `Bonjour ${client.name},\n\n` +
        "Je reviens vers vous comme prévu pour faire le point avec vous.\n\n" +
        "Êtes-vous satisfait de notre collaboration ? Y a-t-il quelque chose que nous pouvons améliorer ?\n\n" +
        `Cordialement,\n${companyName}`;
    } else {
      message =
        `Bonjour ${client.name},\n\n` +
        `Merci pour votre confiance envers ${companyName}.\n\n` +
        "Nous souhaitons nous assurer que tout se passe bien de votre côté. N’hésitez pas à nous écrire si vous avez une question ou un besoin.\n\n" +
        `Cordialement,\n${companyName}`;
    }

    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const today = getLocalDate();

  const activeClients = clients.filter(
    (client) => client.status === "Actif" || client.status === "VIP"
  );

  const dormantClients = clients.filter(
    (client) => client.status === "À réactiver" || client.status === "Inactif"
  );

  const dueFollowUps = clients.filter(
    (client) => !!client.next_follow_up && client.next_follow_up <= today
  );

  const totalRevenue = clients.reduce(
    (sum, client) => sum + (Number(client.total_amount) || 0),
    0
  );

  const filteredClients = clients.filter((client) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;

    return [
      client.name,
      client.company,
      client.email,
      client.phone,
      client.status,
      client.notes,
    ].some((value) => (value ?? "").toLowerCase().includes(term));
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
        Chargement des clients…
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
              href="/prospects"
              style={{
                color: "#e5c76b",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              🎯 Prospects
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
          CRM sécurisé — Clients
        </h1>

        <p style={{ color: "#b8b8c4", marginTop: 0, marginBottom: 22 }}>
          Ajoute tes clients, suis leurs achats et planifie les relances de fidélisation.
        </p>

        <section style={sectionStyle}>
          <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="active-company">
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

        <section style={{ ...sectionStyle, marginBottom: 24 }}>
          <h2
            style={{
              color: "#e5c76b",
              fontSize: 22,
              marginTop: 0,
              marginBottom: 8,
            }}
          >
            {editingId ? "✏️ Modifier le client" : "➕ Nouveau client"}
          </h2>

          <form onSubmit={saveClient}>
            <label style={labelStyle} htmlFor="client-name">
              Nom *
            </label>
            <input
              id="client-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nom du client"
              required
              style={inputStyle}
            />

            <label style={labelStyle} htmlFor="client-company">
              Entreprise du client
            </label>
            <input
              id="client-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Nom de son entreprise (facultatif)"
              style={inputStyle}
            />

            <label style={labelStyle} htmlFor="client-email">
              E-mail
            </label>
            <input
              id="client-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="exemple@entreprise.com"
              style={inputStyle}
            />

            <label style={labelStyle} htmlFor="client-phone">
              Téléphone
            </label>
            <input
              id="client-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Numéro de téléphone avec indicatif pays"
              style={inputStyle}
            />

            <label style={labelStyle} htmlFor="client-status">
              Statut du client
            </label>
            <select
              id="client-status"
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

            <label style={labelStyle} htmlFor="client-amount">
              💰 Montant total des achats (FCFA)
            </label>
            <input
              id="client-amount"
              inputMode="decimal"
              value={totalAmount}
              onChange={(event) => setTotalAmount(event.target.value)}
              placeholder="Ex. : 150000"
              style={inputStyle}
            />

            <label style={labelStyle} htmlFor="client-last-purchase">
              🛒 Date du dernier achat
            </label>
            <input
              id="client-last-purchase"
              type="date"
              value={lastPurchase}
              onChange={(event) => setLastPurchase(event.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle} htmlFor="client-follow-up">
              📅 Prochaine date de relance
            </label>
            <input
              id="client-follow-up"
              type="date"
              value={nextFollowUp}
              onChange={(event) => setNextFollowUp(event.target.value)}
              style={inputStyle}
            />

            <p style={{ color: "#a7a7b4", fontSize: 13, marginTop: 8 }}>
              Laisse la date vide si aucune relance n’est prévue.
            </p>

            <label style={labelStyle} htmlFor="client-notes">
              📝 Notes
            </label>
            <textarea
              id="client-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Préférences, produits achetés, remarques…"
              rows={3}
              maxLength={2000}
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
            />

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
                    : "Ajouter le client"}
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
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <article
            style={{ ...statCardStyle, border: "1px solid rgba(212,175,55,0.4)" }}
          >
            <p style={{ margin: 0, color: "#f1d783", fontWeight: 700 }}>
              👥 Clients
            </p>
            <p
              style={{
                fontSize: 32,
                fontWeight: 800,
                margin: "10px 0 4px",
                color: "#f1d783",
              }}
            >
              {clients.length}
            </p>
            <p style={{ margin: 0, color: "#b8b8c4", fontSize: 13 }}>
              Dans cette entreprise
            </p>
          </article>

          <article
            style={{ ...statCardStyle, border: "1px solid rgba(100,220,160,0.35)" }}
          >
            <p style={{ margin: 0, color: "#83e3ad", fontWeight: 700 }}>
              🟢 Clients actifs
            </p>
            <p
              style={{
                fontSize: 32,
                fontWeight: 800,
                margin: "10px 0 4px",
                color: "#83e3ad",
              }}
            >
              {activeClients.length}
            </p>
            <p style={{ margin: 0, color: "#b8b8c4", fontSize: 13 }}>
              Statut Actif ou VIP
            </p>
          </article>

          <article
            style={{ ...statCardStyle, border: "1px solid rgba(255,196,80,0.4)" }}
          >
            <p style={{ margin: 0, color: "#ffd477", fontWeight: 700 }}>
              💤 À réactiver
            </p>
            <p
              style={{
                fontSize: 32,
                fontWeight: 800,
                margin: "10px 0 4px",
                color: "#ffd477",
              }}
            >
              {dormantClients.length}
            </p>
            <p style={{ margin: 0, color: "#b8b8c4", fontSize: 13 }}>
              À réactiver ou inactifs
            </p>
          </article>

          <article
            style={{ ...statCardStyle, border: "1px solid rgba(255,90,90,0.4)" }}
          >
            <p style={{ margin: 0, color: "#ff8585", fontWeight: 700 }}>
              🔴 Relances à faire
            </p>
            <p
              style={{
                fontSize: 32,
                fontWeight: 800,
                margin: "10px 0 4px",
                color: "#ff8585",
              }}
            >
              {dueFollowUps.length}
            </p>
            <p style={{ margin: 0, color: "#b8b8c4", fontSize: 13 }}>
              En retard ou prévues aujourd’hui
            </p>
          </article>
        </section>

        <p style={{ color: "#d6d6df", fontSize: 15, marginBottom: 24 }}>
          💰 Montant total des achats enregistrés :{" "}
          <strong style={{ color: "#f1d783" }}>
            {formatAmount(totalRevenue)} FCFA
          </strong>
        </p>

        <section>
          <label style={labelStyle} htmlFor="client-search">
            🔍 Rechercher un client
          </label>
          <input
            id="client-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nom, entreprise, e-mail, téléphone, statut ou notes…"
            style={{ ...inputStyle, marginBottom: 16 }}
          />

          <p style={{ color: "#d6d6df", fontSize: 16 }}>
            <strong>{filteredClients.length}</strong> client(s)
          </p>

          {filteredClients.length === 0 ? (
            <div
              style={{
                background: "rgba(24,24,32,0.95)",
                borderRadius: 14,
                padding: 20,
                color: "#b8b8c4",
              }}
            >
              {clients.length === 0
                ? "Aucun client pour cette entreprise. Ajoute ton premier client avec le formulaire, ou convertis un prospect depuis la page Prospects."
                : "Aucun résultat pour cette recherche."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {filteredClients.map((client) => {
                const followUp = client.next_follow_up;
                const isOverdue = !!followUp && followUp < today;
                const isToday = !!followUp && followUp === today;
                const amount = Number(client.total_amount) || 0;

                return (
                  <article
                    key={client.id}
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
                      {client.name}
                    </h3>

                    {client.company && (
                      <p style={{ margin: "7px 0", color: "#dedee6" }}>
                        🏢 {client.company}
                      </p>
                    )}

                    {client.email && (
                      <p style={{ margin: "7px 0", color: "#dedee6" }}>
                        📧 {client.email}
                      </p>
                    )}

                    {client.phone && (
                      <p style={{ margin: "7px 0", color: "#dedee6" }}>
                        📞 {client.phone}
                      </p>
                    )}

                    <p
                      style={{
                        display: "inline-block",
                        margin: "8px 0 10px",
                        padding: "7px 11px",
                        borderRadius: 20,
                        background: "rgba(212,175,55,0.12)",
                        color: "#f1d783",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      Statut : {client.status || "Actif"}
                    </p>

                    {amount > 0 && (
                      <p style={{ margin: "7px 0", color: "#dedee6" }}>
                        💰 Achats : {formatAmount(amount)} FCFA
                      </p>
                    )}

                    {client.last_purchase_date && (
                      <p style={{ margin: "7px 0", color: "#dedee6" }}>
                        🛒 Dernier achat : {formatDate(client.last_purchase_date)}
                      </p>
                    )}

                    {client.source && (
                      <p style={{ margin: "7px 0", color: "#a7a7b4", fontSize: 14 }}>
                        Origine : {client.source}
                      </p>
                    )}

                    {client.notes && (
                      <p
                        style={{
                          margin: "10px 0",
                          color: "#c8c8d2",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        📝 {client.notes}
                      </p>
                    )}

                    <p
                      style={{
                        margin: "8px 0 16px",
                        color: isOverdue ? "#ff8585" : isToday ? "#ffd477" : "#c8c8d2",
                        fontWeight: isOverdue || isToday ? 700 : 400,
                      }}
                    >
                      📅 Prochaine relance :{" "}
                      {followUp ? formatDate(followUp) : "Non planifiée"}
                      {isOverdue && " — EN RETARD"}
                      {isToday && " — AUJOURD’HUI"}
                    </p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => openWhatsApp(client)}
                        disabled={!client.phone}
                        style={{
                          ...buttonStyle,
                          flex: "1 1 100%",
                          background: client.phone
                            ? "rgba(37,211,102,0.14)"
                            : "rgba(100,100,100,0.12)",
                          color: client.phone ? "#70e0a0" : "#888888",
                          borderColor: client.phone
                            ? "rgba(37,211,102,0.4)"
                            : "rgba(120,120,120,0.3)",
                          cursor: client.phone ? "pointer" : "not-allowed",
                        }}
                      >
                        📲 Contacter sur WhatsApp
                      </button>

                      <button
                        type="button"
                        onClick={() => editClient(client)}
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
                        onClick={() => void deleteClient(client)}
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
