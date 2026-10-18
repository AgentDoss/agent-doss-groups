"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

const TEMPLATES = [
  ["relances", "Relances commerciales"],
  ["prospection", "Prospection"],
  ["rapport", "Rapport de pilotage"],
  ["contenu", "Contenu marketing"],
  ["custom", "Routine personnalisée"],
] as const;

type Job = { id: string; title: string; template: string; instruction: string; enabled: boolean; every_hours: number; next_run_at: string; last_run_at?: string | null; };

export default function RoutinesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
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
      const res = await request("/api/jobs");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur");
      setJobs(json.jobs ?? []);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Impossible de charger les routines"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function create(e: FormEvent) {
    e.preventDefault(); setSaving(true); setNotice("");
    try {
      const res = await request("/api/jobs", { method: "POST", body: JSON.stringify({ title, instruction, template, everyHours: Number(everyHours) }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Création impossible");
      setJobs((old) => [json.job, ...old]);
      setNotice("Routine créée. Elle produira un brouillon lors de sa prochaine exécution.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Création impossible"); }
    finally { setSaving(false); }
  }

  return <main className="routinePage">
    <header className="routineHeader">
      <a href="/doss" className="backLink">← Centre de commande</a>
      <div className="routineKicker">AUTOMATISATION SÉCURISÉE</div>
      <h1>Routines IA <span>qui travaillent pour vous.</span></h1>
      <p>Planifiez une analyse récurrente. DOSS prépare les résultats en brouillons, puis vous gardez le dernier mot.</p>
    </header>
    <section className="routineGrid">
      <form className="routineForm" onSubmit={create}>
        <div className="eyebrow">Nouvelle routine</div>
        <label>Nom de la routine<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required /></label>
        <label>Type<select value={template} onChange={(e) => setTemplate(e.target.value)}>{TEMPLATES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>Instruction de l’agent<textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={2000} rows={6} required /></label>
        <label>Fréquence<select value={everyHours} onChange={(e) => setEveryHours(e.target.value)}><option value="24">Tous les jours</option><option value="48">Tous les 2 jours</option><option value="168">Chaque semaine</option></select></label>
        <button className="primaryButton" disabled={saving}>{saving ? "Activation…" : "Activer la routine →"}</button>
        {notice && <p className="routineNotice">{notice}</p>}
      </form>
      <section className="routineList">
        <div className="listHeading"><div><div className="eyebrow">Votre système autonome</div><h2>Routines actives</h2></div><span className="routineCount">{jobs.length}</span></div>
        {loading ? <div className="emptyRoutine">Chargement…</div> : jobs.length === 0 ? <div className="emptyRoutine"><strong>Votre première routine commence ici.</strong><span>Créez un audit quotidien pour recevoir chaque matin un plan d’action commercial prêt à valider.</span></div> : jobs.map((job) => <article className="jobCard" key={job.id}><div className="jobIcon">✦</div><div className="jobBody"><div className="jobTop"><h3>{job.title}</h3><span className="jobStatus"><i /> Active</span></div><p>{job.instruction}</p><small>Chaque {job.every_hours} h · prochaine exécution : {new Date(job.next_run_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</small></div></article>)}
      </section>
    </section>
  </main>;
}
