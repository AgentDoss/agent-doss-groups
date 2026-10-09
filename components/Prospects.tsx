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
  status: string | null;
  score: number | null;
  created_at?: string;
}

interface Company {
  id: string;
  name: string;
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const sb = getSupabase();

  const loadProspects = useCallback(
    async (ownerId: string, selectedCompanyId: string) => {
      setLoading(true);
      setError("");

      try {
        const { data, error: queryError } = await sb
          .from("doss_prospects")
          .select(
            "id,user_id,company_id,name,company,email,phone,status,score,created_at"
          )
          .eq("user_id", ownerId)
          .eq("company_id", selectedCompanyId)
          .order("created_at", { ascending: false });

        if (queryError) throw queryError;

        setProspects((data ?? []) as Prospect[]);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Impossible de charger les prospects."
        );
      } finally {
        setLoading(false);
      }
    },
    [sb]
  );

  const initialize = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await sb.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        window.location.replace("/login");
        return;
      }

      const ownerId = session.user.id;
      setUserId(ownerId);

      const { data, error: companyError } = await sb
        .from("doss_company")
        .select("id,name")
        .order("created_at", { ascending: true });

      if (companyError) throw companyError;

      const ownedCompanies = (data ?? []) as Company[];
      setCompanies(ownedCompanies);

      if (ownedCompanies.length === 0) {
        setCompanyId("");
        setProspects([]);
        setError(
          "Aucune entreprise accessible. Crée ou vérifie ton entreprise avant d'ajouter des prospects."
        );
        return;
      }

      let savedCompanyId = "";

      try {
        savedCompanyId =
          localStorage.getItem("doss_company_id") ?? "";
      } catch {
        // Le stockage local est facultatif.
      }

      const selected = ownedCompanies.some(
        (item) => item.id === savedCompanyId
      )
        ? savedCompanyId
        : ownedCompanies[0].id;

      setCompanyId(selected);

      await loadProspects(ownerId, selected);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Erreur lors de l'initialisation."
      );
      setLoading(false);
    }
  }, [sb, loadProspects]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  async function changeCompany(nextId: string) {
    if (!companies.some((item) => item.id === nextId)) return;

    setCompanyId(nextId);
    setEditingId(null);
    resetForm();
    setNotice("");
    setError("");
    setProspects([]);

    try {
      localStorage.setItem("doss_company_id", nextId);
    } catch {
      // Le choix reste actif en mémoire.
    }

    if (userId) {
      await loadProspects(userId, nextId);
    }
  }

  function resetForm() {
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setEditingId(null);
  }

  async function saveProspect() {
    setError("");
    setNotice("");

    const cleanName = name.trim();

    if (!userId || !companyId) {
      setError("Connecte-toi et sélectionne une entreprise.");
      return;
    }

    if (!cleanName) {
      setError("Le nom du prospect est obligatoire.");
      return;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("L'adresse e-mail n'est pas valide.");
      return;
    }

    setSaving(true);

    try {
      const values = {
        name: cleanName,
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      };

      if (editingId) {
        const { data, error: updateError } = await sb
          .from("doss_prospects")
          .update(values)
          .eq("id", editingId)
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .select("id");

        if (updateError) throw updateError;

        if (!data?.length) {
          throw new Error(
            "Aucune modification effectuée. Vérifie les droits d'accès au prospect."
          );
        }

        setNotice("Prospect mis à jour.");
      } else {
        const { error: insertError } = await sb
          .from("doss_prospects")
          .insert({
            ...values,
            user_id: userId,
            company_id: companyId,
            status: "Nouveau",
            score: 50,
          });

        if (insertError) throw insertError;

        setNotice("Prospect ajouté.");
      }

      resetForm();
      await loadProspects(userId, companyId);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Impossible d'enregistrer le prospect."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteProspect(id: string) {
    if (!userId || !companyId) return;

    if (!confirm("Confirmer la suppression de ce prospect ?")) return;

    setError("");
    setNotice("");

    try {
      const { data, error: deleteError } = await sb
        .from("doss_prospects")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .select("id");

      if (deleteError) throw deleteError;

      if (!data?.length) {
        throw new Error(
          "Suppression non effectuée. Vérifie les droits d'accès."
        );
      }

      if (editingId === id) resetForm();

      setNotice("Prospect supprimé.");
      await loadProspects(userId, companyId);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Impossible de supprimer le prospect."
      );
    }
  }

  function editProspect(p: Prospect) {
    if (p.user_id !== userId || p.company_id !== companyId) {
      setError("Tu ne peux pas modifier ce prospect.");
      return;
    }

    setEditingId(p.id);
    setName(p.name ?? "");
    setCompany(p.company ?? "");
    setEmail(p.email ?? "");
    setPhone(p.phone ?? "");
    setError("");
    setNotice("");
  }

  const filtered = prospects.filter((p) => {
    const txt = search.trim().toLowerCase();

    return (
      p.name?.toLowerCase().includes(txt) ||
      p.company?.toLowerCase().includes(txt) ||
      p.email?.toLowerCase().includes(txt) ||
      p.phone?.toLowerCase().includes(txt)
    );
  });

  return (
    <>
      <MagicBackground />

      <main className="formWrap">
        <div className="formTop">
          <Logo size={48} />
          <div>
            <div className="eyebrow">CRM sécurisé</div>
            <h1>Prospects</h1>
          </div>
        </div>

        {error && (
          <div className="card pad" role="alert" style={{ marginBottom: 16 }}>
            <strong>Attention</strong>
            <p>{error}</p>
          </div>
        )}

        {notice && (
          <div className="card pad" role="status" style={{ marginBottom: 16 }}>
            {notice}
          </div>
        )}

        <section className="card pad" style={{ marginBottom: 20 }}>
          <label htmlFor="prospect-company">
            Entreprise active
          </label>

          <select
            id="prospect-company"
            value={companyId}
            onChange={(e) => void changeCompany(e.target.value)}
            disabled={loading || companies.length === 0 || saving}
            style={{ width: "100%", marginTop: 8, marginBottom: 16 }}
          >
            {companies.length === 0 && (
              <option value="">Aucune entreprise disponible</option>
            )}

            {companies.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <h3>
            {editingId ? "✏️ Modifier prospect" : "➕ Nouveau prospect"}
          </h3>

          <input
            placeholder="Nom *"
            value={name}
            maxLength={150}
            onChange={(e) => setName(e.target.value)}
            disabled={saving || !companyId}
          />

          <input
            placeholder="Entreprise du prospect"
            value={company}
            maxLength={200}
            onChange={(e) => setCompany(e.target.value)}
            disabled={saving || !companyId}
          />

          <input
            placeholder="E-mail"
            type="email"
            value={email}
            maxLength={254}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving || !companyId}
          />

          <input
            placeholder="Téléphone"
            type="tel"
            value={phone}
            maxLength={40}
            onChange={(e) => setPhone(e.target.value)}
            disabled={saving || !companyId}
          />

          <button
            className="sendButton"
            style={{ marginTop: 12 }}
            onClick={() => void saveProspect()}
            disabled={saving || loading || !companyId}
          >
            {saving
              ? "Enregistrement..."
              : editingId
                ? "Mettre à jour"
                : "Ajouter"}
          </button>

          {editingId && (
            <button
              className="ghostButton"
              style={{ marginTop: 8 }}
              onClick={resetForm}
              disabled={saving}
            >
              Annuler la modification
            </button>
          )}
        </section>

        <section className="card pad">
          <input
            placeholder="🔍 Rechercher un prospect..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 20 }}
          />

          <h3>{filtered.length} prospect(s)</h3>

          {loading ? (
            <p>Chargement...</p>
          ) : filtered.length === 0 ? (
            <p className="muted">
              Aucun prospect enregistré pour cette entreprise.
            </p>
          ) : (
            filtered.map((p) => (
              <article
                key={p.id}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid rgba(255,255,255,.08)",
                }}
              >
                <strong>{p.name}</strong>

                {p.company && <div className="muted">{p.company}</div>}
                {p.email && <div className="muted">📧 {p.email}</div>}
                {p.phone && <div className="muted">📞 {p.phone}</div>}

                <div style={{ marginTop: 8 }}>
                  Score : {p.score ?? 50}
                </div>

                <div className="muted">{p.status ?? "Nouveau"}</div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    className="ghostButton"
                    onClick={() => editProspect(p)}
                    disabled={saving}
                  >
                    ✏️ Modifier
                  </button>

                  <button
                    className="ghostButton"
                    onClick={() => void deleteProspect(p.id)}
                    disabled={saving}
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    </>
  );
}
