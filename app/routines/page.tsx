"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

const TEMPLATES = [["relances", "Relances commerciales"], ["prospection", "Prospection"], ["rapport", "Rapport de pilotage"], ["contenu", "Contenu marketing"], ["custom", "Routine personnalisée"]] as const;
type Job = { id: string; title: string; template: string; instruction: string; enabled: boolean; every_hours: number; next_run_at: string; last_run_at?: string | null; attempt_count?: number; last_error?: string | null };
type Draft = { id: string; run_id: string | null; agent_id: string; channel: string; content: string; status: string; created_at: string; review_note?: string | null };

export default function RoutinesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [title, setTitle] = useState("Audit commercial quotidien");
  const [instruction, setInstruction] = useState("Analyse les prospects ouverts, identifie les relances en retard, classe les priorités et prépare les messages comme brouillons. N'envoie rien.");
  const [template, setTemplate] = useState("relances");
  const [everyHours, setEveryHours] = useState("24");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function request(path: string, init?: RequestInit) {
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) { window.location.href = "/login"; throw new Error("Session expirée"); }
    return fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } });
  }

  async function load() {
    try {
      const [jobsRes, draftsRes] = await Promise.all([request("/api/jobs"), request("/api/drafts")]);
      const jobsJson = await jobsRes.json(); const draftsJson = await draftsRes.json();
      if (!jobsRes.ok) throw new Error(jobsJson.error || "Erreur routines");
      if (!draftsRes.ok) throw new Error(draftsJson.error || "Erreur brouillons");
      setJobs(jobsJson.jobs ?? []); setDrafts(draftsJson.drafts ?? []);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Impossible de charger le centre autonome"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function create(e: FormEvent) {
    e.preventDefault(); setSaving(true); setNotice("");
    try {
      const res = await request("/api/jobs", { method: "POST", body: JSON.stringify({ title, instruction, template, everyHours: Number(everyHours) }) });
      const json = await res.json(); if (!res.ok) throw new Error(json.error || "Création impossible");
      setJobs((old) => [json.job, ...old]); setNotice("Routine créée. Elle est prête pour le prochain passage automatique.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Création impossible"); }
    finally { setSaving(false); }
  }

  async function toggle(job: Job) {
    const res = await request(`/api/jobs/${job.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !job.enabled }) });
    const json = await res.json(); if (res.ok) setJobs((old) => old.map((x) => x.id === job.id ? json.job : x)); else setNotice(json.error || "Modification impossible");
  }
  async function remove(job: Job) {
    if (!window.confirm(`Supprimer « ${job.title} » ?`)) return;
    const res = await request(`/api/jobs/${job.id}`, { method: "DELETE" });
    if (res.ok) setJobs((old) => old.filter((x) => x.id !== job.id)); else setNotice("Suppression impossible");
  }
  async function review(draft: Draft, status: "approved" | "rejected") {
    const res = await request(`/api/drafts/${draft.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    const json = await res.json(); if (res.ok) setDrafts((old) => old.map((x) => x.id === draft.id ? json.draft : x)); else setNotice(json.error || "Action impossible");
  }

  return <main className="routinePage">
    <header className="routineHeader"><Link href="/doss" className="backLink">← Centre de commande</Link><div className="routineKicker">AUTOMATISATION SÉCURISÉE · CTO</div><h1>Routines IA <span>qui travaillent pour vous.</span></h1><p>Les agents analysent, expliquent et préparent. Vous gardez le dernier mot avant toute action externe.</p></header>
    <section className="routineGrid">
      <form className="routineForm" onSubmit={create}><div className="eyebrow">Nouvelle routine</div><label>Nom de la routine<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required /></label><label>Type<select value={template} onChange={(e) => setTemplate(e.target.value)}>{TEMPLATES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>Instruction de l’agent<textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={2000} rows={6} required /></label><label>Fréquence<select value={everyHours} onChange={(e) => setEveryHours(e.target.value)}><option value="24">Tous les jours</option><option value="48">Tous les 2 jours</option><option value="168">Chaque semaine</option></select></label><button className="primaryButton" disabled={saving}>{saving ? "Activation…" : "Activer la routine →"}</button>{notice && <p className="routineNotice">{notice}</p>}</form>
      <section className="routineList"><div className="listHeading"><div><div className="eyebrow">Pilotage autonome</div><h2>Vos routines</h2></div><span className="routineCount">{jobs.length}</span></div>{loading ? <div className="emptyRoutine">Chargement…</div> : jobs.length === 0 ? <div className="emptyRoutine"><strong>Votre première routine commence ici.</strong><span>Créez un audit quotidien pour recevoir un plan d’action commercial prêt à valider.</span></div> : jobs.map((job) => <article className="jobCard" key={job.id}><div className="jobIcon">✦</div><div className="jobBody"><div className="jobTop"><h3>{job.title}</h3><span className={job.enabled ? "jobStatus" : "jobStatus paused"}><i /> {job.enabled ? "Active" : "En pause"}</span></div><p>{job.instruction}</p><small>{job.enabled ? `Prochaine exécution : ${new Date(job.next_run_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}` : "Exécution suspendue"}{job.last_error ? ` · Dernière erreur : ${job.last_error}` : ""}</small><div className="jobActions"><button onClick={() => void toggle(job)}>{job.enabled ? "Mettre en pause" : "Reprendre"}</button><button onClick={() => void remove(job)}>Supprimer</button></div></div></article>)}</section>
    </section>
    <section className="draftPanel"><div className="listHeading"><div><div className="eyebrow">Validation humaine</div><h2>Brouillons des agents</h2></div><span className="routineCount">{drafts.filter((x) => x.status === "pending").length}</span></div>{drafts.length === 0 ? <div className="emptyRoutine"><strong>Aucun brouillon pour le moment.</strong><span>Le premier résultat apparaîtra ici après l’exécution de votre routine.</span></div> : drafts.map((draft) => <article className="draftCard" key={draft.id}><div className="draftMeta"><span>{draft.agent_id}</span><span>{new Date(draft.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</span><b className={`draftBadge ${draft.status}`}>{draft.status}</b></div><pre>{draft.content}</pre>{draft.status === "pending" && <div className="draftActions"><button className="approveButton" onClick={() => void review(draft, "approved")}>Approuver le brouillon</button><button className="rejectButton" onClick={() => void review(draft, "rejected")}>Rejeter</button></div>}</article>)}</section>
  </main>;
}
