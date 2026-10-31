import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatDate, formatMoney } from "../lib/orders";

type Seller = {
  id: string;
  displayName: string;
  email: string;
  status: string;
  productCount: number;
  totalSales: number;
  totalRevenue: number;
  createdAt?: unknown;
  phone?: string;
  storeName?: string;
};

export function SellersPage() {
  const [rows, setRows] = useState<Seller[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "pending" | "suspended">(
    "all",
  );
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "users"),
          where("role", "==", "seller"),
          orderBy("createdAt", "desc"),
        ),
      ).catch(async () =>
        getDocs(query(collection(db, "users"), where("role", "==", "seller"))),
      );
      setRows(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            displayName: String(data.displayName || "Vendeur"),
            email: String(data.email || "—"),
            status: String(data.status || "pending"),
            productCount: Number(data.productCount || 0),
            totalSales: Number(data.totalSales || 0),
            totalRevenue: Number(data.totalRevenue || 0),
            createdAt: data.createdAt,
            phone: data.phone as string | undefined,
            storeName: data.storeName as string | undefined,
          };
        }),
      );
    } catch (e) {
      console.error(e);
      alert("Impossible de charger les vendeurs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        s.displayName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.storeName || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, status]);

  async function setSellerStatus(id: string, next: string) {
    setBusyId(id);
    try {
      await updateDoc(doc(db, "users", id), {
        status: next,
        updatedAt: new Date(),
      });
      setRows((prev) => prev.map((s) => (s.id === id ? { ...s, status: next } : s)));
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
          <h1>Vendeurs</h1>
          <p className="muted">{filtered.length} compte(s)</p>
        </div>
        <input
          className="search"
          placeholder="Nom, email, boutique…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </header>
      <div className="filters">
        {(["all", "active", "pending", "suspended"] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={status === k ? "chip active" : "chip"}
            onClick={() => setStatus(k)}
          >
            {k === "all" ? "Tous" : k}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Vendeur</th>
                <th>Boutique</th>
                <th>CA</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.displayName}</strong>
                    <div className="tiny muted">{s.email}</div>
                    <div className="tiny muted">{formatDate(s.createdAt)}</div>
                  </td>
                  <td>{s.storeName || "—"}</td>
                  <td>{formatMoney(s.totalRevenue)}</td>
                  <td>
                    <span className="badge">{s.status}</span>
                  </td>
                  <td className="right actions">
                    {s.status !== "active" && (
                      <button
                        className="btn primary"
                        disabled={busyId === s.id}
                        onClick={() => void setSellerStatus(s.id, "active")}
                      >
                        Activer
                      </button>
                    )}
                    {s.status === "active" && (
                      <button
                        className="btn"
                        disabled={busyId === s.id}
                        onClick={() => void setSellerStatus(s.id, "suspended")}
                      >
                        Suspendre
                      </button>
                    )}
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
