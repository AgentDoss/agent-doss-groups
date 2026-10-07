"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import Logo from "@/components/Logo";
import MagicBackground from "@/components/MagicBackground";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setInfo("");
    try {
      const { error: err } = await getSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
      });
      if (err) throw err;
      setInfo("Si cette adresse correspond à un compte, un lien de réinitialisation vient d'être envoyé. Vérifiez aussi les spams.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="loginWrap">
      <MagicBackground />
      <form className="card loginCard" onSubmit={submit}>
        <Logo size={56} />
        <h1>Mot de passe oublié</h1>
        <p className="muted">Entrez votre e-mail : nous vous envoyons un lien pour choisir un nouveau mot de passe.</p>
        <label>E-mail
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="primaryButton" disabled={busy} type="submit">{busy ? "Envoi…" : "Envoyer le lien"}</button>
        {error && <p role="alert" className="err">{error}</p>}
        {info && <p className="ok">{info}</p>}
        <a className="linkBtn" href="/login">← Retour à la connexion</a>
      </form>
    </main>
  );
}

export function ResetForm() {
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    const { data: sub } = sb.auth.onAuthStateChange((ev) => {
      if (ev === "PASSWORD_RECOVERY" || ev === "SIGNED_IN") setReady(true);
    });
    sb.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo("");
    if (pw.length < 6) { setError("Minimum 6 caractères."); return; }
    if (pw !== pw2) { setError("Les deux mots de passe sont différents."); return; }
    setBusy(true);
    try {
      const { error: err } = await getSupabase().auth.updateUser({ password: pw });
      if (err) throw err;
      setInfo("Mot de passe modifié ✓ Redirection…");
      setTimeout(() => { window.location.href = "/doss"; }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="loginWrap">
      <MagicBackground />
      <form className="card loginCard" onSubmit={submit}>
        <Logo size={56} />
        <h1>Nouveau mot de passe</h1>
        {!ready ? (
          <p className="muted">Vérification du lien… Si rien ne se passe, ouvrez le lien reçu par e-mail ou refaites une demande.</p>
        ) : (
          <>
            <label>Nouveau mot de passe
              <input type="password" required minLength={6} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </label>
            <label>Confirmer
              <input type="password" required minLength={6} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </label>
            <button className="primaryButton" disabled={busy} type="submit">{busy ? "Patientez…" : "Enregistrer"}</button>
          </>
        )}
        {error && <p role="alert" className="err">{error}</p>}
        {info && <p className="ok">{info}</p>}
        <a className="linkBtn" href="/mot-de-passe-oublie">Demander un nouveau lien</a>
      </form>
    </main>
  );
}
