import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  getStockStatus,
  mapProductStockDoc,
  sortByStockAsc,
  stockStatusLabel,
  type ProductStockRow,
  type StockStatusKey,
} from "../lib/productStock";

type CompanyOpt = { id: string; name: string };

const LIST_LIMIT = 200;
const OWNER_FIELDS = ["companyId", "sellerId", "supplierId"] as const;

async function loadProducts(companyId: string): Promise<ProductStockRow[]> {
  const productsRef = collection(db, "products");

  if (companyId) {
    const byId = new Map<string, ProductStockRow>();
    for (const field of OWNER_FIELDS) {
      try {
        const snap = await getDocs(
          query(productsRef, where(field, "==", companyId), limit(LIST_LIMIT)),
        );
        for (const d of snap.docs) {
          if (!byId.has(d.id)) {
            byId.set(
              d.id,
              mapProductStockDoc(d.id, d.data() as Record<string, unknown>),
            );
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    return sortByStockAsc(Array.from(byId.values()));
  }

  const snap = await getDocs(
    query(productsRef, orderBy("createdAt", "desc"), limit(LIST_LIMIT)),
  ).catch(async () => getDocs(query(productsRef, limit(LIST_LIMIT))));

  return sortByStockAsc(
    snap.docs.map((d) =>
      mapProductStockDoc(d.id, d.data() as Record<string, unknown>),
    ),
  );
}

export function StockPage() {
  const [rows, setRows] = useState<ProductStockRow[]>([]);
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StockStatusKey | "all">("all");
  const [threshold, setThreshold] = useState(DEFAULT_LOW_STOCK_THRESHOLD);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await loadProducts(companyId));
    } catch (e) {
      console.error(e);
      alert("Impossible de charger le stock produits.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void getDocs(
      query(collection(db, "companies"), orderBy("name", "asc")),
    )
      .catch(async () => getDocs(collection(db, "companies")))
      .then((snap) =>
        setCompanies(
          snap.docs.map((d) => ({
            id: d.id,
            name: String((d.data() as { name?: string }).name || d.id),
          })),
        ),
      )
      .catch(() => setCompanies([]));
  }, []);

  const counts = useMemo(() => {
    let ok = 0;
    let low = 0;
    let out = 0;
    for (const row of rows) {
      const s = getStockStatus(row.stock, threshold, row.unlimitedStock);
      if (s === "ok") ok += 1;
      else if (s === "low") low += 1;
      else out += 1;
    }
    return { ok, low, out, all: rows.length };
  }, [rows, threshold]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const status = getStockStatus(row.stock, threshold, row.unlimitedStock);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.companyName.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter, threshold]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Produits — Stock</h1>
          <p className="muted">
            {filtered.length} fiche(s) — tri stock croissant, lecture seule
          </p>
        </div>
        <div className="header-actions">
          <input
            className="search"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
            Actualiser
          </button>
        </div>
      </header>

      <div className="filters">
        <label className="inline-label">
          Fournisseur
          <select
            className="search"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">Tous les fournisseurs</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-label">
          Seuil stock faible
          <input
            className="search threshold-input"
            type="number"
            min={1}
            max={999}
            value={threshold}
            onChange={(e) =>
              setThreshold(Math.max(1, Number(e.target.value) || DEFAULT_LOW_STOCK_THRESHOLD))
            }
          />
        </label>
      </div>

      <div className="filters">
        {(
          [
            ["all", counts.all, "Tous"],
            ["out", counts.out, "Rupture"],
            ["low", counts.low, "Stock faible"],
            ["ok", counts.ok, "En stock"],
          ] as const
        ).map(([key, count, label]) => (
          <button
            key={key}
            type="button"
            className={statusFilter === key ? "chip active" : "chip"}
            onClick={() => setStatusFilter(key)}
          >
            {label} ({count})
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
                <th>Produit</th>
                <th>Fournisseur</th>
                <th>Stock actuel</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Aucun produit à afficher
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const status = getStockStatus(p.stock, threshold, p.unlimitedStock);
                  return (
                    <tr key={p.id}>
                      <td className="product-cell">
                        {p.mainImage ? (
                          <img src={p.mainImage} alt="" className="thumb" />
                        ) : (
                          <div className="thumb placeholder" />
                        )}
                        <div>
                          <strong>{p.name}</strong>
                          <div className="tiny muted">{p.id}</div>
                        </div>
                      </td>
                      <td>{p.companyName || "—"}</td>
                      <td className="stock-num">
                        {p.unlimitedStock ? "Stock illimité" : p.stock}
                      </td>
                      <td>
                        <span className={`badge ${status}`}>
                          {stockStatusLabel(status)}
                        </span>
                      </td>
                      <td className="right actions">
                        <Link className="btn" to={`/products/${p.id}`}>
                          Fiche
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
