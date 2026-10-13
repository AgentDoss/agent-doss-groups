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
    <div className="min-h-screen w-full bg-[#0a0d14] text-white flex items-center justify-center p-4 relative overflow-hidden">
      <MagicBackground />
      
      {/* Halo lumineux d'arrière-plan */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-indigo-600/20 to-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-[#121624]/80 border border-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden relative z-10">
        
        {/* Colonne Gauche : Présentation Premium */}
        <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-transparent border-r border-white/10 relative">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <Logo size={48} />
              <span className="text-xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
                AGENT DOSS GROUPS
              </span>
            </div>

            <h1 className="text-3xl font-extrabold leading-tight mb-4">
              Pilotez votre entreprise avec une <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">équipe d'experts IA</span>.
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Prospection automatisée, marketing ciblé et gestion client intelligente. Tout votre écosystème commercial centralisé.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold">
                9
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Agents Spécialisés</p>
                <p className="text-xs text-gray-400">Directeur, Commercial, Prospect, Marketing...</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                ✓
              </div>
              <div>
                <p className="text-sm font-semibold text-white">100% Automatisé</p>
                <p className="text-xs text-gray-400">Exécution autonome de vos tâches et relances</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-8">
            © {new Date().getFullYear()} AGENT DOSS GROUPS. Tous droits réservés.
          </p>
        </div>

        {/* Colonne Droite : Formulaire */}
        <div className="p-8 sm:p-12 flex flex-col justify-center">
          <div className="lg:hidden mb-6 flex justify-center">
            <Logo size={56} />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2 text-center lg:text-left">
            {mode === "in" ? "Connexion au Centre de Commande" : "Création de compte Entreprise"}
          </h2>
          <p className="text-gray-400 text-sm mb-8 text-center lg:text-left">
            {mode === "in" ? "Entrez vos identifiants pour accéder à vos agents IA." : "Inscrivez-vous pour lancer vos premiers agents."}
          </p>

          {error && (
            <div role="alert" className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {info && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm text-center">
              {info}
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Adresse E-mail
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@entreprise.com"
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Mot de passe
                </label>
                {mode === "in" && (
                  <a href="/mot-de-passe-oublie" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                    Oublié ?
                  </a>
                )}
              </div>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setEmail ? setPassword(e.target.value) : null} // Conserve votre logique
                placeholder="••••••••"
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {busy ? "Patientez…" : mode === "in" ? "Se connecter au Dashboard ➜" : "Créer le compte Entreprise"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setMode(mode === "in" ? "up" : "in")}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
            >
              {mode === "in" ? "Pas de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
