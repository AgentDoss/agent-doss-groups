"use client";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import AuthShell, { Brand, Ic, ICONS } from "@/components/AuthShell";

type Mode = "in" | "up";

function PasswordInput({ value, onChange, autoComplete, placeholder = "••••••••" }: { value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="v7Input">
      <Ic d={ICONS.lock} />
      <input type={show ? "text" : "password"} required minLength={6} autoComplete={autoComplete} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="v7Eye" onClick={() => setShow(!show)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
        <Ic d={show ? ICONS.eyeOff : ICONS.eye} className="" />
      </button>
    </span>
  );
}

export default function LoginForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [terms, setTerms] = useState(true);
  const [mode, setMode] = useState<Mode>("in");
  const [anim, setAnim] = useState<"" | "flipOut" | "flipIn">("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Petite bascule 3D entre Connexion et Création de compte
  function switchMode() {
    setAnim("flipOut");
    setTimeout(() => {
      setMode((m) => (m === "in" ? "up" : "in"));
      setError(""); setInfo("");
      setAnim("flipIn");
      setTimeout(() => setAnim(""), 340);
    }, 220);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo("");
    if (mode === "up" && password !== password2) { setError("Les deux mots de passe sont différents."); return; }
    setBusy(true);
    try {
      const sb = getSupabase();
      if (mode === "in") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/doss";
      } else {
        const { data, error } = await sb.auth.signUp({ email, password, options: name.trim() ? { data: { full_name: name.trim() } } : undefined });
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

  async function oauth(provider: "google" | "apple") {
    setError(""); setInfo("");
    try {
      const { error } = await getSupabase().auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/doss` } });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible avec ce service.");
    }
  }

  const isIn = mode === "in";
  return (
    <AuthShell>
      <form className={`v7Card ${anim}`} onSubmit={submit}>
        <Brand
          title={isIn ? <>Bon <em>retour</em></> : <>Créer un <em>compte</em></>}
          sub={isIn ? "Connectez-vous à votre équipe IA" : "Rejoignez votre équipe IA en quelques secondes"}
        />

        {!isIn && (
          <label className="v7Field">Nom complet
            <span className="v7Input"><Ic d={ICONS.user} />
              <input type="text" autoComplete="name" placeholder="Alex Johnson" value={name} onChange={(e) => setName(e.target.value)} />
            </span>
          </label>
        )}
        <label className="v7Field">E-mail
          <span className="v7Input"><Ic d={ICONS.mail} />
            <input type="email" required autoComplete="email" placeholder="nom@domaine.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </span>
        </label>

        {isIn ? (
          <label className="v7Field">Mot de passe
            <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
          </label>
        ) : (
          <div className="v7Row2">
            <label className="v7Field">Mot de passe
              <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
            </label>
            <label className="v7Field">Confirmer
              <PasswordInput value={password2} onChange={setPassword2} autoComplete="new-password" />
            </label>
          </div>
        )}

        {isIn ? (
          <div className="v7Opts"><span /><a className="v7Link" href="/mot-de-passe-oublie">Mot de passe oublié ?</a></div>
        ) : (
          <label className="v7Check"><input type="checkbox" required checked={terms} onChange={(e) => setTerms(e.target.checked)} /> J&apos;accepte les conditions d&apos;utilisation</label>
        )}

        <button className="v7Btn" disabled={busy} type="submit">
          {busy ? "Patientez…" : <>{isIn ? "Se connecter" : "Créer le compte"} <Ic d={ICONS.arrow} className="" /></>}
        </button>
        {error && <p role="alert" className="v7Msg err">{error}</p>}
        {info && <p className="v7Msg ok">{info}</p>}

        <div className="v7Or">ou continuer avec</div>
        <div className="v7Social">
          <button type="button" className="v7Soc" onClick={() => oauth("google")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1a6.2 6.2 0 0 1 0-12.4c2 0 3.3.9 4 1.6l2.7-2.6A9.9 9.9 0 0 0 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4 9.6-9.8 0-.7-.1-1.2-.2-1.7z" /></svg>
            Google
          </button>
          <button type="button" className="v7Soc" onClick={() => oauth("apple")}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" /></svg>
            Apple
          </button>
        </div>

        <p className="v7Foot">
          {isIn ? "Pas de compte ? " : "Déjà un compte ? "}
          <button type="button" className="v7Link gold" onClick={switchMode}>{isIn ? "Créer un compte" : "Se connecter"}</button>
        </p>
      </form>
    </AuthShell>
  );
}
