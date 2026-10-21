"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

interface MetricsPayload {
  generatedAt: string;
  summary: { calls: number; successRate: number; averageLatencyMs: number; inputTokens: number; outputTokens: number; activeJobs: number; failedJobs: number; pendingDrafts: number; completedMissions: number };
  providers: Array<{ provider: string; calls: number }>;
  recent: Array<{ id: string; operation: string; provider: string | null; estimated_input_tokens: number; estimated_output_tokens: number; latency_ms: number; status: string; created_at: string }>;
  jobs: Array<{ id: string; enabled: boolean; last_error: string | null; last_run_at: string | null; attempt_count: number }>;
}

const number = new Intl.NumberFormat("fr-FR");
const date = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function PerformancePage() {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    try {
      const { data: session } = await getSupabase().auth.getSession();
      if (!session.session) { window.location.href = "/login"; return; }
      const response = await fetch("/api/metrics", { headers: { Authorization: `Bearer ${session.session.access_token}` }, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible de charger les performances.");
      setData(payload as MetricsPayload);
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de charger les performances."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const s = data?.summary;

  return <main className="performancePage">
    <header className="performanceHero">
      <div><div className="eyebrow">Pilotage intelligent</div><h1>Performance des agents</h1><p>Une vision claire de la fiabilité, de la vitesse et de l’autonomie de votre équipe IA.</p></div>
      <button className="ghostButton" onClick={() => { setLoading(true); void load(); }}>↻ Actualiser</button>
    </header>
    {loading ? <div className="card pad performanceEmpty">Chargement du cockpit de supervision…</div> : error ? <div className="card pad performanceError">{error}<button className="ghostButton" onClick={() => { setLoading(true); void load(); }}>Réessayer</button></div> : <>
      <section className="performanceStats">
        <Metric icon="✦" value={`${s?.successRate ?? 0}%`} label="Taux de réussite" tone="green" />
        <Metric icon="◷" value={`${s?.averageLatencyMs ?? 0} ms`} label="Latence moyenne" tone="blue" />
        <Metric icon="⚡" value={number.format((s?.inputTokens ?? 0) + (s?.outputTokens ?? 0))} label="Tokens estimés" tone="violet" />
        <Metric icon="⌁" value={number.format(s?.activeJobs ?? 0)} label="Routines actives" tone="gold" />
      </section>
      <section className="performanceGrid">
        <div className="card pad"><div className="panelTitle"><div><div className="eyebrow">Activité récente</div><h2>Appels IA</h2></div><span className="softBadge">{s?.calls ?? 0} appels</span></div>
          {data?.recent.length ? <div className="metricList">{data.recent.map((row) => <div className="metricRow" key={row.id}><div className={`metricStatus ${row.status}`} /> <div className="metricMain"><b>{row.operation === "autonomous_job" ? "Routine autonome" : "Mission interactive"}</b><small>{row.provider ?? "Fournisseur inconnu"} · {date.format(new Date(row.created_at))}</small></div><div className="metricValue"><b>{number.format(row.latency_ms)} ms</b><small>{number.format(row.estimated_input_tokens + row.estimated_output_tokens)} tokens</small></div></div>)}</div> : <p className="muted">Aucun appel IA enregistré pour le moment.</p>}
        </div>
        <div className="card pad"><div className="panelTitle"><div><div className="eyebrow">Répartition</div><h2>Fournisseurs IA</h2></div></div>{data?.providers.length ? <div className="providerList">{data.providers.map((provider) => <div className="providerRow" key={provider.provider}><span>{provider.provider}</span><b>{provider.calls}</b><div className="providerBar"><i style={{ width: `${Math.max(8, Math.round((provider.calls / Math.max(1, s?.calls ?? 1)) * 100))}%` }} /></div></div>)}</div> : <p className="muted">Les fournisseurs apparaîtront après la première mission.</p>}<div className="miniGrid"><Mini label="Brouillons à valider" value={s?.pendingDrafts ?? 0} /><Mini label="Missions terminées" value={s?.completedMissions ?? 0} /><Mini label="Routines en erreur" value={s?.failedJobs ?? 0} /></div></div>
      </section>
      <section className="card pad"><div className="panelTitle"><div><div className="eyebrow">Autonomie Cloud</div><h2>État des routines</h2></div><span className="softBadge green">Téléphone éteint : actif</span></div>{data?.jobs.length ? <div className="jobsGrid">{data.jobs.map((job) => <div className="jobRow" key={job.id}><span className={`jobDot ${job.enabled ? "on" : "off"}`} /><div><b>{job.enabled ? "Routine active" : "Routine en pause"}</b><small>{job.last_run_at ? `Dernier passage · ${date.format(new Date(job.last_run_at))}` : "Pas encore exécutée"}{job.attempt_count ? ` · ${job.attempt_count} tentative(s)` : ""}</small>{job.last_error ? <small className="err">Dernière erreur : {job.last_error}</small> : null}</div></div>)}</div> : <p className="muted">Aucune routine configurée.</p>}</section>
      <p className="performanceFoot">Dernière synchronisation : {data?.generatedAt ? date.format(new Date(data.generatedAt)) : "—"}. Les tokens sont estimés à partir du volume de texte ; aucun contenu de mission n’est affiché dans ce cockpit.</p>
    </>}
  </main>;
}

function Metric({ icon, value, label, tone }: { icon: string; value: string; label: string; tone: string }) { return <div className={`performanceMetric ${tone}`}><span>{icon}</span><b>{value}</b><small>{label}</small></div>; }
function Mini({ label, value }: { label: string; value: number }) { return <div className="miniMetric"><b>{number.format(value)}</b><small>{label}</small></div>; }
