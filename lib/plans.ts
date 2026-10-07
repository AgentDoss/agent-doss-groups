export type PlanId = "gratuit" | "pro" | "entreprise";

// Modifiez ici les limites mensuelles de chaque offre.
export const PLANS: Record<PlanId, { label: string; monthly: number }> = {
  gratuit: { label: "Gratuite", monthly: 10 },
  pro: { label: "Pro", monthly: 300 },
  entreprise: { label: "Entreprise", monthly: 3000 },
};

// Nombre maximal de missions par minute et par utilisateur.
export const RATE_PER_MINUTE = 6;

// Début du mois courant (UTC), pour compter les missions du mois.
export function monthStartISO(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}
