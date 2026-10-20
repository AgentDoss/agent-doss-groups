"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";

 type Draft = {
  id: string;
  run_id: string | null;
  agent_id: string;
  channel: string;
  recipient: string | null;
  content: string;
  status: "pending" | "approved" | "sent" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  company_uuid: string | null;
};

const STATUS_LABEL: Record<Draft["status"], string> = {
  pending: "À valider",
  approved: "Approuvé",
  sent: "Envoyé",
  rejected: "Refusé",
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ValidationCenter() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        window.location.href = "/login";
        return;
      }
      const response = await fetch("/api/drafts", { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Impossible de charger les brouillons");
      setDrafts(payload.drafts ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    setError("");
    try {
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expirée");
      const response = await fetch(`/api/drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, reviewNote: note[id] ?? "" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "La validation a échoué");
      setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...payload.draft } : draft));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur de validation");
    } finally {
      setBusyId(null);
    }
  }

  const visible = useMemo(() => filter === "pending" ? drafts.filter((draft) => draft.status === "pending") : drafts, [drafts, filter]);
  const pendingCount = drafts.filter((draft) => draft.status === "pending").length;

  return (
    <main className="content validationPage">
      <div className="top">
        <div>
          <div className="eyebrow">Contrôle humain · sécurité opérationnelle</div>
          <h1>Centre de validation <span className="gradText">des agents</span></h1>
          <p className="muted">Les agents préparent. Vous décidez. Aucun message externe n’est envoyé automatiquement.</p>
        </div>
        <button className="ghostButton" onClick={() => void load()} disabled={loading}>↻ Actualiser</button>
      </div>

      <section className="validationHero card">
        <div className="validationOrb" aria-hidden="true" />
        <div className="validationHeroIcon">✦</div>
        <div><strong>{pendingCount} brouillon{pendingCount > 1 ? "s" : ""} en attente</strong><span> Chaque sortie IA reste traçable et réversible.</span></div>
      </section>

      <div className="validationToolbar">
        <div className="filterTabs" role="tablist" aria-label="Filtrer les brouillons">
          <button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>À traiter ({pendingCount})</button>
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Historique ({drafts.length})</button>
        </div>
        {error && <span className="err" role="alert">{error}</span>}
      </div>

      {loading ? <div className="card pad">Chargement des brouillons…</div> : visible.length === 0 ? (
        <div className="card pad emptyState"><div className="cardIcon">✓</div><h2>Tout est sous contrôle</h2><p className="muted">Aucun brouillon ne nécessite votre attention pour le moment.</p></div>
      ) : (
        <div className="validationList">
          {visible.map((draft) => (
            <article className={`card draftCard ${draft.status}`} key={draft.id}>
              <div className="draftMeta"><span className="tag">{draft.agent_id}</span><span className={`statusPill ${draft.status}`}>{STATUS_LABEL[draft.status]}</span><time>{dateLabel(draft.created_at)}</time></div>
              <p className="draftContent">{draft.content}</p>
              {draft.review_note && <p className="reviewNote">Note : {draft.review_note}</p>}
              {draft.status === "pending" && <>
                <label className="noteField">Note interne (facultatif)<textarea value={note[draft.id] ?? ""} onChange={(event) => setNote((current) => ({ ...current, [draft.id]: event.target.value }))} maxLength={1000} placeholder="Pourquoi approuvez-vous ou refusez-vous cette proposition ?" /></label>
                <div className="draftActions"><button className="rejectButton" onClick={() => void review(draft.id, "rejected")} disabled={busyId === draft.id}>Refuser</button><button className="approveButton" onClick={() => void review(draft.id, "approved")} disabled={busyId === draft.id}>{busyId === draft.id ? "Enregistrement…" : "Approuver"}</button></div>
              </>}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
