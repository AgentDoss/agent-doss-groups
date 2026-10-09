"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DOSS_AGENTS,
  directorRoute,
  getAgentById,
  type AgentId,
  type DirectorRoute,
} from "@/lib/agents";
import { getSupabase } from "@/lib/supabase";
import Logo from "@/components/Logo";
import MagicBackground from "@/components/MagicBackground";
import { PLANS, monthStartISO, type PlanId } from "@/lib/plans";

const EXAMPLES = [
  "Trouve de nouveaux clients",
  "Prépare une campagne Facebook",
  "Analyse mon chiffre d'affaires",
  "Organise ma journée",
  "Relance mes clients inactifs",
];

const CONF = {
  high: "Confiance élevée",
  medium: "Confiance moyenne",
  low: "Confiance faible",
} as const;

const COLORS: Record<AgentId, string> = {
  director: "#6d4aff",
  marketing: "#ec4899",
  prospect: "#0ea5e9",
  commercial: "#f97316",
  client: "#10b981",
  finance: "#eab308",
  analyst: "#3b82f6",
  assistant: "#8b5cf6",
  strategy: "#14b8a6",
};

const acc = (id: AgentId) =>
  ({ "--acc": COLORS[id] }) as React.CSSProperties;

type Evt =
  | { type: "route"; route: DirectorRoute }
  | { type: "delta"; text: string }
  | {
      type: "done";
      status: "done" | "error";
      provider: string | null;
      missionId?: string;
      error?: string;
    };

interface HistoryItem {
  id: string;
  message: string;
  primary_agent: AgentId;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
  activity?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  lead_count?: number;
  prospect_count?: number;
  customer_count?: number;
  monthly_revenue?: number;
  ai_score?: number;
}

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        if (!line.trim()) {
          return <div key={i} style={{ height: 8 }} />;
        }

        const parts = line
          .split(/(\*\*[^*]+\*\*)/g)
          .map((p, j) =>
            p.length > 4 &&
            p.startsWith("**") &&
            p.endsWith("**") ? (
              <strong key={j}>{p.slice(2, -2)}</strong>
            ) : (
              p
            )
          );

        return (
          <div
            key={i}
            className={
              /^(\d+[.)]|[-•])\s/.test(line.trim())
                ? "li"
                : undefined
            }
          >
            {parts}
          </div>
        );
      })}
    </>
  );
}

export default function DossTeam() {
  const [msg, setMsg] = useState("");
  const [route, setRoute] = useState<DirectorRoute | null>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [provider, setProvider] = useState<string | null>(null);
  const [ttft, setTtft] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [burst, setBurst] = useState(0);

  const [companies, setCompanies] = useState<Company[] | null>(
    null
  );

  const [companyId, setCompanyId] = useState("");
  const [prospectsCount, setProspectsCount] = useState(0);
  const [plan, setPlan] = useState<PlanId>("gratuit");
  const [used, setUsed] = useState(0);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<AgentId | null>(null);

  const resultRef = useRef<HTMLElement | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await getSupabase()
        .from("doss_missions")
        .select("id,message,primary_agent,created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      setHistory((data as HistoryItem[]) ?? []);
    } catch {
      // Historique facultatif
    }
  }, []);

  const loadCompanies = useCallback(async () => {
    try {
      const sb = getSupabase();

      const { data, error } = await sb
        .from("doss_company")
        .select(`
          id,
          name,
          activity,
          email,
          phone,
          city,
          country,
          lead_count,
          customer_count,
          monthly_revenue,
          ai_score
        `)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const list = (data ?? []) as Company[];

      const enriched = await Promise.all(
        list.map(async (company) => {
          const { count, error: countError } = await sb
            .from("doss_prospects")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("company_id", company.id);

          if (countError) {
            console.error(
              "Erreur de comptage des prospects :",
              countError.message
            );

            return {
              ...company,
              prospect_count: company.lead_count ?? 0,
            };
          }

          return {
            ...company,
            prospect_count: count ?? 0,
          };
        })
      );

      setCompanies(enriched);

      let saved = "";

      try {
        saved = localStorage.getItem("doss_company_id") ?? "";
      } catch {
        // Stockage local indisponible
      }

      setCompanyId(
        enriched.some((company) => company.id === saved)
          ? saved
          : enriched[0]?.id ?? ""
      );
    } catch (error) {
      console.error(
        "Erreur de chargement des entreprises :",
        error
      );
    }
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const sb = getSupabase();

      const { data: p } = await sb
        .from("doss_profiles")
        .select("plan")
        .maybeSingle();

      const pl = (p as { plan?: string } | null)?.plan;

      setPlan(
        pl === "pro" || pl === "entreprise"
          ? pl
          : "gratuit"
      );

      const { count } = await sb
        .from("doss_missions")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("status", "done")
        .gte("created_at", monthStartISO());

      setUsed(count ?? 0);
    } catch {
      // Informations de quota facultatives
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getSupabase().auth.getSession();

        if (!data.session) {
          window.location.href = "/login";
          return;
        }

        setEmail(data.session.user.email ?? "");
        setReady(true);

        loadHistory();
        loadCompanies();
        loadUsage();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Erreur de configuration"
        );
        setReady(true);
      }
    })();
  }, [loadHistory, loadCompanies, loadUsage]);
  async function send(text = msg) {
    const message = text.trim();

    if (!message || loading) return;

    setBurst((b) => b + 1);
    setMsg(message);
    setError("");
    setAnswer("");
    setProvider(null);
    setTtft(null);
    setRoute(directorRoute(message));
    setStage(1);
    setLoading(true);

    const t0 = performance.now();

    setTimeout(
      () =>
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        }),
      50
    );

    try {
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const res = await fetch("/api/doss/mission", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          companyId: companyId || undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erreur serveur");
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let first = true;

      const handle = (ev: Evt) => {
        if (ev.type === "route") {
          setRoute(ev.route);
        } else if (ev.type === "delta") {
          if (first) {
            first = false;
            setStage(2);
            setTtft((performance.now() - t0) / 1000);
          }

          setAnswer((a) => a + ev.text);
        } else {
          setProvider(ev.provider);

          if (ev.error) setError(ev.error);

          setStage(3);
        }
      };

      for (;;) {
        const { done, value } = await reader.read();

        if (done) break;

        buf += dec.decode(value, { stream: true });

        let i: number;

        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);

          if (line) handle(JSON.parse(line) as Evt);
        }
      }

      loadHistory();
      loadUsage();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Erreur inconnue"
      );
      setStage(3);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Presse-papiers indisponible
    }
  }

  async function logout() {
    await getSupabase().auth.signOut();
    window.location.href = "/login";
  }

  const primary = route
    ? getAgentById(route.primaryAgent)
    : undefined;

  const sel = selected
    ? getAgentById(selected)
    : undefined;

  const totalCaps = DOSS_AGENTS.reduce(
    (n, a) => n + a.capabilities.length,
    0
  );

  const limit = PLANS[plan].monthly;
useEffect(() => {
  let cancelled = false;

  async function loadProspectsCount() {
    try {
      const { count, error } = await getSupabase()
        .from("doss_prospects")
        .select("id", {
          count: "exact",
          head: true,
        });

      if (error) throw error;

      if (!cancelled) {
        setProspectsCount(count ?? 0);
      }
    } catch (error) {
      console.error(
        "Erreur de comptage des prospects :",
        error
      );
    }
  }

  loadProspectsCount();

  return () => {
    cancelled = true;
  };
}, []);
  if (!ready) {
    return (
      <div className="boot">
        <Logo size={64} />
      </div>
    );
  }

  return (
    <>
      <MagicBackground />

      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <Logo size={44} />
            <div>
              <b>DOSS GROUPS</b>
              <small>Équipe IA · 9 experts</small>
            </div>
          </div>

          <div className="lbl">Votre équipe</div>

          <nav className="nav">
            {DOSS_AGENTS.map((a) => (
              <button
                key={a.id}
                style={acc(a.id)}
                className={`menuItem${
                  selected === a.id ? " active" : ""
                }`}
                onClick={() =>
                  setSelected(
                    selected === a.id ? null : a.id
                  )
                }
              >
                <span className="mic">{a.icon}</span>
                <span>
                  {a.name.replace("DOSS ", "")}
                  <small>{a.role}</small>
                </span>
              </button>
            ))}
          </nav>

          <div className="side-foot">
            <small>{email}</small>

            <a className="ghostButton" href="/entreprise">
              🏢 Mes entreprises
            </a>

            <a className="ghostButton" href="/prospects">
  🎯 Prospects ({prospectsCount})
</a>

            <button
              className="ghostButton"
              onClick={logout}
            >
              Déconnexion
            </button>
          </div>
        </aside>

        <main className="content">
          <div className="top">
            <div>
              <div className="eyebrow">Centre de commande</div>
              <h1>
                Votre équipe d'experts IA,{" "}
                <span className="gradText">
                  prête à agir
                </span>
              </h1>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {companies && companies.length > 0 && (
                <select
                  className="coSelect"
                  aria-label="Entreprise active"
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);

                    try {
                      localStorage.setItem(
                        "doss_company_id",
                        e.target.value
                      );
                    } catch {
                      // Stockage local indisponible
                    }
                  }}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      🏢 {c.name || "Entreprise sans nom"}
                    </option>
                  ))}
                </select>
              )}

              <div className="status">
                <span className="statusDot" />
                9 experts en ligne
              </div>
            </div>
          </div>

          <section className="hero">
            <div className="aurora" aria-hidden="true" />

            <div className="runes" aria-hidden="true">
              <span>✨</span>
              <span>🔮</span>
              <span>⭐</span>
              <span>🪄</span>
              <span>✨</span>
            </div>

            <h2>
              Confiez une mission. Un expert s'en charge.
            </h2>

            <p>
              DOSS Directeur identifie le bon spécialiste
              et la réponse s'affiche en direct.
            </p>

            <div className="composer">
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={2}
                aria-label="Mission"
                placeholder="Ex. : Trouve de nouveaux clients et prépare les relances…"
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey
                  ) {
                    e.preventDefault();
                    send();
                  }
                }}
              />

              <span className="sendWrap">
                <button
                  className="sendButton"
                  onClick={() => send()}
                  disabled={loading}
                >
                  {loading ? "En cours…" : "Lancer ➜"}
                </button>

                {burst > 0 && (
                  <span
                    key={burst}
                    className="burst"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <i
                        key={i}
                        style={
                          {
                            "--a": `${i * 30}deg`,
                          } as React.CSSProperties
                        }
                      />
                    ))}
                  </span>
                )}
              </span>
            </div>

            <div className="chips">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  className="chip"
                  onClick={() => send(e)}
                  disabled={loading}
                >
                  {e}
                </button>
              ))}
            </div>
          </section>

          {companies && companies.length === 0 && (
            <a
              className="card pad notice"
              href="/entreprise"
            >
              🏢{" "}
              <strong>
                Complétez votre fiche entreprise
              </strong>
              : vos agents donneront des conseils adaptés
              à votre activité. <span>Remplir ➜</span>
            </a>
          )}

          <div className="stats">
            <div className="card stat">
              <b>9</b>
              <span>agents experts</span>
            </div>

            <div className="card stat">
              <b>{totalCaps}</b>
              <span>capacités</span>
            </div>

            <div className="card stat">
              <b>
                {used}/{limit}
              </b>
              <span>
                missions ce mois · offre {PLANS[plan].label}
              </span>
            </div>

            <div className="card stat">
              <b>
                {ttft !== null
                  ? `${ttft.toFixed(1)} s`
                  : "Direct"}
              </b>
              <span>
                {ttft !== null
                  ? "premier mot reçu"
                  : "réponse en continu"}
              </span>
            </div>
          </div>

          {error && !primary && (
            <p
              role="alert"
              className="err"
              style={{ marginTop: 16 }}
            >
              {error}
            </p>
          )}

          {companies &&
            companyId &&
            (() => {
              const company = companies.find(
                (c) => c.id === companyId
              );

              if (!company) return null;

              return (
                <section
                  className="card pad"
                  style={{ marginTop: 18 }}
                >
                  <div className="eyebrow">
                    Entreprise active
                  </div>

                  <h2 style={{ marginTop: 6 }}>
                    🏢 {company.name}
                  </h2>

                  {company.activity && (
                    <p className="muted">
                      {company.activity}
                    </p>
                  )}

                  <div className="companyMeta">
                    {company.email && (
                      <div>📧 {company.email}</div>
                    )}

                    {company.phone && (
                      <div>📞 {company.phone}</div>
                    )}

                    {(company.city || company.country) && (
                      <div>
                        🌍 {company.city}{" "}
                        {company.country
                          ? `• ${company.country}`
                          : ""}
                      </div>
                    )}
                  </div>

                  <div className="stats">
                    <div className="card stat">
                      <b>{company.prospect_count ?? 0}</b>
                      <span>Prospects</span>
                    </div>

                    <div className="card stat">
                      <b>{company.customer_count ?? 0}</b>
                      <span>Clients</span>
                    </div>

                    <div className="card stat">
                      <b>
                        {company.monthly_revenue ?? 0} €
                      </b>
                      <span>CA mensuel</span>
                    </div>

                    <div className="card stat">
                      <b>{company.ai_score ?? 50}</b>
                      <span>Score IA</span>
                    </div>
                  </div>
                </section>
              );
            })()}
          {route && primary && (
            <section
              ref={resultRef}
              className={`card pad result${
                loading ? " busy" : ""
              }`}
              style={{
                ...acc(primary.id),
                marginTop: 18,
              }}
              aria-live="polite"
            >
              <div className="steps">
                {[
                  "Mission reçue",
                  "Agent identifié",
                  "Rédaction",
                  "Terminé",
                ].map((s, i) => (
                  <span
                    key={s}
                    className={`step${
                      stage > i - 1 && stage !== 0
                        ? " on"
                        : ""
                    }${stage === i ? " cur" : ""}`}
                  >
                    {s}
                  </span>
                ))}
              </div>

              <div className="rt">
                <div className="cardIcon big">
                  {primary.icon}
                </div>

                <div
                  style={{
                    flex: 1,
                    minWidth: 200,
                  }}
                >
                  <div className="eyebrow">
                    Expert responsable
                  </div>

                  <strong style={{ fontSize: 19 }}>
                    {primary.name}
                  </strong>

                  <div className="muted">
                    {route.reason}
                  </div>
                </div>

                <span className="chip solid">
                  {CONF[route.confidence]}
                </span>
              </div>

              {route.supportingAgents.length > 0 && (
                <p
                  className="muted"
                  style={{ margin: "12px 0 0" }}
                >
                  En renfort :{" "}
                  {route.supportingAgents
                    .map(
                      (id) => getAgentById(id)?.name
                    )
                    .join(" · ")}
                </p>
              )}

              {loading && !answer && (
                <div
                  className="typing"
                  aria-label="Rédaction en cours"
                >
                  <i />
                  <i />
                  <i />
                </div>
              )}

              {answer && (
                <div className="agentBubble">
                  <Rich text={answer} />
                </div>
              )}

              {answer && !loading && (
                <div className="resFoot">
                  <button
                    className="ghostButton"
                    onClick={copy}
                  >
                    {copied
                      ? "Copié ✓"
                      : "Copier la réponse"}
                  </button>

                  {provider && (
                    <small className="muted">
                      Moteur : {provider}
                      {ttft !== null
                        ? ` · premier mot en ${ttft.toFixed(1)} s`
                        : ""}
                    </small>
                  )}
                </div>
              )}

              {error && (
                <p role="alert" className="err">
                  {error}
                </p>
              )}
            </section>
          )}

          {sel && (
            <section
              className="card pad"
              style={{
                ...acc(sel.id),
                marginTop: 18,
              }}
            >
              <h3 style={{ margin: 0 }}>
                {sel.icon} {sel.name}
              </h3>

              <p
                className="muted"
                style={{ margin: "6px 0 12px" }}
              >
                {sel.description}
              </p>

              <div className="eyebrow">Capacités</div>

              <div style={{ margin: "8px 0 14px" }}>
                {sel.capabilities.map((c) => (
                  <span key={c} className="tag">
                    {c}
                  </span>
                ))}
              </div>

              <div className="eyebrow">Garde-fous</div>

              <ul
                className="muted"
                style={{
                  margin: "8px 0 0",
                  paddingLeft: 18,
                }}
              >
                {sel.guardrails.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </section>
          )}

          <h3 className="sect">Votre équipe</h3>

          <div className="grid">
            {DOSS_AGENTS.map((a) => (
              <button
                key={a.id}
                style={acc(a.id)}
                className="card pad agCard"
                onClick={() => {
                  setSelected(a.id);
                  window.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  });
                }}
              >
                <div className="cardIcon">{a.icon}</div>
                <h4>{a.name}</h4>
                <div className="eyebrow">{a.role}</div>
                <p className="muted">{a.description}</p>
              </button>
            ))}
          </div>

          {history.length > 0 && (
            <>
              <h3 className="sect">Dernières missions</h3>

              <div className="card pad">
                {history.map((h) => (
                  <div key={h.id} className="hrow">
                    <span>
                      {getAgentById(h.primary_agent)?.icon ??
                        "🤖"}
                    </span>

                    <span className="hmsg">
                      {h.message}
                    </span>

                    <small className="muted">
                      {new Date(
                        h.created_at
                      ).toLocaleDateString("fr-FR")}
                    </small>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
                  }
