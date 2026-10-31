import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatMoney } from "../lib/orders";

type Product = {
  id: string;
  name?: string;
  price?: number;
  currency?: string;
  status?: string;
  isActive?: boolean;
  companyName?: string;
  supplier?: string;
  sellerName?: string;
  mainImage?: string;
  imageUrl?: string;
  images?: string[];
};

export function ProductsPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "products"),
          orderBy("createdAt", "desc"),
          limit(200),
        ),
      ).catch(async () =>
        getDocs(query(collection(db, "products"), limit(200))),
      );
      setRows(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Product, "id">),
        })),
      );
    } catch (e) {
      console.error(e);
      alert("Impossible de charger les produits.");
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
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.companyName?.toLowerCase().includes(q) ||
        p.supplier?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function remove(id: string, name?: string) {
    if (!confirm(`Supprimer « ${name || id} » ?`)) return;
    setBusyId(id);
    try {
      await deleteDoc(doc(db, "products", id));
      setRows((prev) => prev.filter((p) => p.id !== id));
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
          <h1>Produits</h1>
          <p className="muted">{filtered.length} fiche(s) — créer, modifier, supprimer</p>
        </div>
        <div className="header-actions">
          <input
            className="search"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Link className="btn" to="/stock">
            Produits — Stock
          </Link>
          <Link className="btn primary" to="/products/new">
            Ajouter un produit
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
                <th>Produit</th>
                <th>Boutique</th>
                <th>Prix</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const img = p.mainImage || p.imageUrl || p.images?.[0];
                return (
                  <tr key={p.id}>
                    <td className="product-cell">
                      {img ? (
                        <img src={img} alt="" className="thumb" />
                      ) : (
                        <div className="thumb placeholder" />
                      )}
                      <div>
                        <strong>{p.name || "Sans nom"}</strong>
                        <div className="tiny muted">{p.id}</div>
                      </div>
                    </td>
                    <td>{p.companyName || p.supplier || p.sellerName || "—"}</td>
                    <td>{formatMoney(p.price, p.currency || "XOF")}</td>
                    <td>
                      <span className="badge">
                        {p.status || (p.isActive ? "actif" : "inactif")}
                      </span>
                    </td>
                    <td className="right actions">
                      <Link className="btn" to={`/products/${p.id}`}>
                        Modifier
                      </Link>
                      <button
                        type="button"
                        className="btn danger"
                        disabled={busyId === p.id}
                        onClick={() => void remove(p.id, p.name)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
