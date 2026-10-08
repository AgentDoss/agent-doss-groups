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

    alert(
      JSON.stringify({
        count: data?.length ?? 0,
        error: error?.message ?? null,
      })
    );

    console.log("PROSPECTS DATA =", data);
    console.log("PROSPECTS ERROR =", error);

    setProspects((data as Prospect[]) ?? []);
    setLoading(false);
  }

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
            <h3>{prospects.length} prospect(s)</h3>

            {prospects.length === 0 ? (
              <p className="muted">
                Aucun prospect enregistré.
              </p>
            ) : (
              prospects.map((p) => (
                <div
                  key={p.id}
                  className="hrow"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "12px 0",
                    borderBottom: "1px solid rgba(255,255,255,.08)",
                  }}
                >
                  <div>
                    <strong>{p.name}</strong>

                    <div className="muted">
                      {p.company}
                    </div>

                    {p.email && (
                      <div className="muted">
                        📧 {p.email}
                      </div>
                    )}

                    {p.phone && (
                      <div className="muted">
                        📞 {p.phone}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div>
                      Score : {p.score ?? 50}
                    </div>

                    <div className="muted">
                      {p.status ?? "Nouveau"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </>
  );
}
