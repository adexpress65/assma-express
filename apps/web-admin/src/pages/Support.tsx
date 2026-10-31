import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatDate } from "../lib/orders";

type Ticket = {
  id: string;
  status: string;
  subject: string;
  preview: string;
  userEmail?: string;
  createdAt?: unknown;
};

function pickSubject(data: Record<string, unknown>): string {
  return String(
    data.subject ?? data.title ?? data.topic ?? data.category ?? "Ticket support",
  );
}

function pickPreview(data: Record<string, unknown>): string {
  return String(data.message ?? data.body ?? data.description ?? "—").slice(0, 160);
}

export function SupportPage() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "supportTickets"),
          orderBy("createdAt", "desc"),
          limit(80),
        ),
      ).catch(async () =>
        getDocs(query(collection(db, "supportTickets"), limit(80))),
      );
      setRows(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            status: String(data.status ?? "open").toLowerCase(),
            subject: pickSubject(data),
            preview: pickPreview(data),
            userEmail: String(data.userEmail ?? data.email ?? "") || undefined,
            createdAt: data.createdAt,
          };
        }),
      );
    } catch (e) {
      console.error(e);
      alert("Impossible de charger les tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(id: string) {
    setBusyId(id);
    try {
      await updateDoc(doc(db, "supportTickets", id), {
        status: "resolved",
        updatedAt: serverTimestamp(),
      });
      setRows((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: "resolved" } : t)),
      );
    } catch {
      alert("Mise à jour impossible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Support & tickets</h1>
          <p className="muted">Collection Firestore supportTickets</p>
        </div>
        <button className="btn" onClick={() => void load()}>
          Actualiser
        </button>
      </header>
      {loading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <div className="panel">
          {rows.length === 0 ? (
            <p className="muted">Aucun ticket.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Sujet</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.subject}</strong>
                      <div className="tiny muted">{t.preview}</div>
                    </td>
                    <td>{t.userEmail || "—"}</td>
                    <td>{formatDate(t.createdAt)}</td>
                    <td>
                      <span className="badge">{t.status}</span>
                    </td>
                    <td className="right">
                      {t.status !== "resolved" && t.status !== "closed" && (
                        <button
                          className="btn primary"
                          disabled={busyId === t.id}
                          onClick={() => void resolve(t.id)}
                        >
                          Marquer résolu
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
