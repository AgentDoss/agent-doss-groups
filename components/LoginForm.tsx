"use client";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import Logo from "@/components/Logo";
import MagicBackground from "@/components/MagicBackground";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo(""); setBusy(true);
    try {
      const sb = getSupabase();
      if (mode === "in") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/doss";
      } else {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) window.location.href = "/doss";
        else setInfo("Compte créé. Vérifiez votre e-mail pour confirmer, puis connectez-vous.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="loginWrap">
      <MagicBackground />
      <form className="card loginCard" onSubmit={submit}>
        <Logo size={56} />
        <h1>AGENT DOSS GROUPS</h1>
        <p className="muted">{mode === "in" ? "Connectez-vous à votre équipe IA" : "Créez votre compte"}</p>
        <label>E-mail
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>Mot de passe
          <input type="password" required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"}
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="primaryButton" disabled={busy} type="submit">
          {busy ? "Patientez…" : mode === "in" ? "Se connecter" : "Créer le compte"}
        </button>
        {error && <p role="alert" className="err">{error}</p>}
        {info && <p className="ok">{info}</p>}
        {mode === "in" && <a className="linkBtn" href="/mot-de-passe-oublie">Mot de passe oublié ?</a>}
        <button type="button" className="linkBtn" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Pas de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
        </button>
      </form>
    </main>
  );
}
