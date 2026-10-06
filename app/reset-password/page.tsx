"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();

    const sb = getSupabase();

    const { error } = await sb.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Mot de passe mis à jour.");
    }
  }

  return (
    <form onSubmit={handleReset}>
      <h1>Nouveau mot de passe</h1>

      <input
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button type="submit">
        Mettre à jour
      </button>

      {message && <p>{message}</p>}
      {error && <p>{error}</p>}
    </form>
  );
}
