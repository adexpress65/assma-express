import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatDate } from "../lib/orders";

type Company = {
  id: string;
  name: string;
  email?: string;
  contactEmail?: string;
  status?: string;
  isActive?: boolean;
  verification?: { status?: string; verified?: boolean };
  category?: string;
  type?: string;
  location?: string;
  createdAt?: unknown;
};

function verificationLabel(c: Company): string {
  const v = c.verification?.status || c.status || "unknown";
  if (v === "verified" || v === "active" || c.verification?.verified) return "Validé";
  if (v === "pending") return "En attente";
  if (v === "rejected" || v === "suspended") return "Suspendu / rejeté";
  return String(v);
}

export function CompaniesPage() {
  const [rows, setRows] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "companies"), orderBy("name", "asc")),
      ).catch(async () => getDocs(collection(db, "companies")));
      setRows(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Company, "id">) })),
      );
    } catch (e) {
      console.error(e);
      alert("Impossible de charger les fournisseurs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.contactEmail?.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function approve(id: string) {
    setBusyId(id);
    try {
      await updateDoc(doc(db, "companies", id), {
        "verification.status": "verified",
        "verification.verified": true,
        isActive: true,
        status: "active",
        updatedAt: new Date(),
      });
      await load();
    } catch {
      alert("Validation impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function suspend(id: string) {
    setBusyId(id);
    try {
      await updateDoc(doc(db, "companies", id), {
        "verification.status": "rejected",
        "verification.verified": false,
        isActive: false,
        status: "pending",
        updatedAt: new Date(),
      });
      await load();
    } catch {
      alert("Suspension impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer définitivement cette entreprise ?")) return;
    setBusyId(id);
    try {
      await deleteDoc(doc(db, "companies", id));
      setRows((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert("Suppression impossible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Fournisseurs</h1>
          <p className="muted">{filtered.length} entreprise(s)</p>
        </div>
        <div className="header-actions">
          <input
            className="search"
            placeholder="Rechercher nom, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Link className="btn primary" to="/companies/new">
            Ajouter une boutique
          </Link>
        </div>
      </header>

      {loading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Type</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/companies/${c.id}`}>
                      <strong>{c.name || "Sans nom"}</strong>
                    </Link>
                    <div className="tiny muted">{c.location || ""}</div>
                  </td>
                  <td>{c.email || c.contactEmail || "—"}</td>
                  <td>{c.type || c.category || "—"}</td>
                  <td>
                    <span className="badge">{verificationLabel(c)}</span>
                    <div className="tiny muted">{formatDate(c.createdAt)}</div>
                  </td>
                  <td className="right actions">
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busyId === c.id}
                      onClick={() => void approve(c.id)}
                    >
                      Valider
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={busyId === c.id}
                      onClick={() => void suspend(c.id)}
                    >
                      Suspendre
                    </button>
                    <button
                      type="button"
                      className="btn danger"
                      disabled={busyId === c.id}
                      onClick={() => void remove(c.id)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
