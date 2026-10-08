"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import Logo from "@/components/Logo";
import MagicBackground from "@/components/MagicBackground";

interface Prospect {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  score: number | null;
}

export default function Prospects() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error } = await getSupabase()
  .from("doss_prospects")
  .select("*")
  .order("created_at", { ascending: false });

console.log("PROSPECTS DATA =", data);
console.log("PROSPECTS ERROR =", error);

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <MagicBackground />

      <main className="formWrap">

        <div className="formTop">
          <Logo size={48} />
          <div>
            <div className="eyebrow">CRM</div>
            <h1>Prospects</h1>
          </div>
        </div>

        {loading ? (
          <p>Chargement...</p>
        ) : (
          <div className="card pad">
            <h3>
              {prospects.length} prospect(s)
            </h3>

            {prospects.map((p) => (
              <div key={p.id} className="hrow">

                <span>
                  👤 {p.name}
                </span>

                <span className="muted">
                  {p.company}
                </span>

                <span>
                  {p.score ?? 50}
                </span>

              </div>
            ))}
          </div>
        )}

      </main>
    </>
  );
            }
