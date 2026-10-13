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
    <div className="min-h-screen w-full bg-[#07090e] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <MagicBackground />
      
      {/* Halos lumineux d'arrière-plan pour l'effet Premium */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-gradient-to-tr from-indigo-600/30 via-purple-600/30 to-pink-600/20 rounded-full blur-[100px] sm:blur-[140px] pointer-events-none" />

      {/* Carte principale avec effet Glassmorphism premium */}
      <div className="w-full max-w-md bg-[#121624]/90 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 sm:p-10 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative z-10 transition-all duration-300">
        
        {/* En-tête du formulaire */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 mb-4 shadow-inner">
            <Logo size={48} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
            AGENT DOSS GROUPS
          </h1>
          <p className="text-xs sm:text-sm text-indigo-300/80 mt-1 font-medium">
            {mode === "in" ? "Centre de Commande • Équipe IA" : "Création de votre accès Entreprise"}
          </p>
        </div>

        {/* Messages d'erreur ou d'information */}
        {error && (
          <div role="alert" className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm text-center animate-shake">
            {error}
          </div>
        )}

        {info && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm text-center">
            {info}
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={submit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              Adresse E-mail professionnelle
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@entreprise.com"
              className="w-full px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm shadow-inner"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                Mot de passe
              </label>
              {mode === "in" && (
                <a href="/mot-de-passe-oublie" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-semibold">
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full mt-2 py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-[0_10px_25px_rgba(79,70,229,0.4)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 tracking-wide"
          >
            {busy ? "Traitement en cours..." : mode === "in" ? "Se connecter au Dashboard ➜" : "Créer le compte Entreprise"}
          </button>
        </form>

        {/* Boutons de bascule de mode */}
        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
            className="text-xs text-gray-400 hover:text-white transition-colors font-medium inline-flex items-center gap-1.5"
          >
            {mode === "in" ? (
              <>Pas encore de compte ? <span className="text-indigo-400 font-bold hover:underline">Créer un compte</span></>
            ) : (
              <>Déjà un compte ? <span className="text-indigo-400 font-bold hover:underline">Se connecter</span></>
            )}
          </button>
        </div>

      </div>

      {/* Signature discrète en bas */}
      <div className="absolute bottom-4 text-[10px] text-gray-500 tracking-wider">
        AGENT DOSS GROUPS • Intelligence Artificielle pour Entreprises
      </div>
    </div>
  );
        }
      
