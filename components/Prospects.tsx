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

  const [search, setSearch] = useState("");

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  async function load() {
    const { data } = await getSupabase()
      .from("doss_prospects")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    setProspects((data as Prospect[]) ?? []);
    setLoading(false);
  }

  async function saveProspect() {
    if (!name.trim()) return;

    if (editingId) {
      await getSupabase()
        .from("doss_prospects")
        .update({
          name,
          company,
          email,
          phone,
        })
        .eq("id", editingId);
    } else {
      await getSupabase()
        .from("doss_prospects")
        .insert({
          name,
          company,
          email,
          phone,
          status: "Nouveau",
          score: 50,
        });
    }

    setEditingId(null);
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");

    load();
  }

  async function deleteProspect(id: string) {
    if (!confirm("Supprimer ce prospect ?"))
      return;

    await getSupabase()
      .from("doss_prospects")
      .delete()
      .eq("id", id);

    load();
  }

  function editProspect(p: Prospect) {
    setEditingId(p.id);

    setName(p.name ?? "");
    setCompany(p.company ?? "");
    setEmail(p.email ?? "");
    setPhone(p.phone ?? "");
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = prospects.filter((p) => {
    const txt = search.toLowerCase();

    return (
      p.name?.toLowerCase().includes(txt) ||
      p.company?.toLowerCase().includes(txt) ||
      p.email?.toLowerCase().includes(txt)
    );
  });

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
                <div
          className="card pad"
          style={{ marginBottom: 20 }}
        >
          <h3>
            {editingId
              ? "✏️ Modifier prospect"
              : "➕ Nouveau prospect"}
          </h3>

          <input
            placeholder="Nom"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
          />

          <input
            placeholder="Entreprise"
            value={company}
            onChange={(e) =>
              setCompany(e.target.value)
            }
          />

          <input
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <input
            placeholder="Téléphone"
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value)
            }
          />

          <button
            className="sendButton"
            style={{ marginTop: 12 }}
            onClick={saveProspect}
          >
            {editingId
              ? "Mettre à jour"
              : "Ajouter"}
          </button>
        </div>

        <div className="card pad">
          <input
            placeholder="🔍 Rechercher..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            style={{
              marginBottom: 20,
            }}
          />

          <h3>
            {filtered.length} prospect(s)
          </h3>

          {loading ? (
            <p>Chargement...</p>
          ) : filtered.length === 0 ? (
            <p className="muted">
              Aucun prospect enregistré.
            </p>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: "14px 0",
                  borderBottom:
                    "1px solid rgba(255,255,255,.08)",
                }}
              >
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

                <div
                  style={{
                    marginTop: 8,
                  }}
                >
                  Score : {p.score ?? 50}
                </div>

                <div className="muted">
                  {p.status ?? "Nouveau"}
                </div>
                                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    className="ghostButton"
                    onClick={() => editProspect(p)}
                  >
                    ✏️ Modifier
                  </button>

                  <button
                    className="ghostButton"
                    onClick={() =>
                      deleteProspect(p.id)
                    }
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}
                
