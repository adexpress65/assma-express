import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchAdminDashboardSnapshot,
  type AdminDashboardSnapshot,
} from "../lib/adminDashboardQueries";
import { useAuth } from "../auth/AuthContext";

function formatWhen(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminDashboardPage() {
  const { displayName } = useAuth();
  const [snapshot, setSnapshot] = useState<AdminDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchAdminDashboardSnapshot());
    } catch (e) {
      console.error(e);
      setError("Impossible de charger le tableau de bord admin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="page admin-dashboard">
      <header className="page-header admin-dashboard-header">
        <div>
          <p className="eyebrow admin-eyebrow">Administration opérationnelle</p>
          <h1>Bonjour, {displayName || "Admin"}</h1>
          <p className="muted">{today}</p>
        </div>
        <button type="button" className="btn admin-btn" onClick={() => void load()} disabled={loading}>
          Actualiser
        </button>
      </header>

      {error && <div className="alert danger">{error}</div>}

      {loading && !snapshot ? (
        <p className="muted">Chargement…</p>
      ) : (
        <>
          <div className="admin-kpi-grid">
            <Link to="/orders" className="admin-kpi-card">
              <span className="admin-kpi-label">Commandes en attente</span>
              <strong>{snapshot?.kpis.pendingOrders ?? 0}</strong>
            </Link>
            <Link to="/stock" className="admin-kpi-card">
              <span className="admin-kpi-label">Stock faible</span>
              <strong>{snapshot?.kpis.lowStockProducts ?? 0}</strong>
            </Link>
            <Link to="/support" className="admin-kpi-card">
              <span className="admin-kpi-label">Tickets support</span>
              <strong>{snapshot?.kpis.openSupportTickets ?? 0}</strong>
            </Link>
          </div>

          <section className="panel admin-panel">
            <div className="panel-head">
              <h2>Commandes — file de traitement</h2>
              <Link to="/orders">Voir tout</Link>
            </div>
            {(snapshot?.ordersQueue ?? []).length === 0 ? (
              <p className="muted">Aucune commande en attente de traitement.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Commande</th>
                    <th>Statut</th>
                    <th>Montant</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot!.ordersQueue.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link to={`/orders/${row.id}`}>#{row.id.slice(0, 8)}</Link>
                      </td>
                      <td>{row.statusLabel}</td>
                      <td>{row.totalLabel}</td>
                      <td>{formatWhen(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="two-col">
            <section className="panel admin-panel">
              <div className="panel-head">
                <h2>Catalogue & stock</h2>
                <Link to="/stock">Stock</Link>
              </div>
              <h3 className="admin-subtitle">Produits à stock faible</h3>
              {(snapshot?.lowStockProducts ?? []).length === 0 ? (
                <p className="muted">Aucun produit en stock faible.</p>
              ) : (
                <ul className="activity">
                  {snapshot!.lowStockProducts.map((p) => (
                    <li key={p.id}>
                      <div>
                        <strong>{p.name}</strong>
                        <div className="muted tiny">{p.companyName || "—"}</div>
                      </div>
                      <span className={`admin-badge ${p.status === "out" ? "danger" : "warn"}`}>
                        {p.status === "out" ? "Rupture" : `${p.stock} restants`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="admin-subtitle">En attente de validation</h3>
              {(snapshot?.pendingProducts ?? []).length === 0 ? (
                <p className="muted">Aucun produit en attente.</p>
              ) : (
                <ul className="activity">
                  {snapshot!.pendingProducts.map((p) => (
                    <li key={p.id}>
                      <div>
                        <Link to={`/products/${p.id}`}>
                          <strong>{p.name}</strong>
                        </Link>
                        <div className="muted tiny">Non vérifié</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel admin-panel">
              <div className="panel-head">
                <h2>Support</h2>
                <Link to="/support">Tickets</Link>
              </div>
              {(snapshot?.openTickets ?? []).length === 0 ? (
                <p className="muted">Aucun ticket ouvert.</p>
              ) : (
                <ul className="activity">
                  {snapshot!.openTickets.map((t) => (
                    <li key={t.id}>
                      <div>
                        <strong>{t.subject}</strong>
                        <div className="muted tiny">{t.preview}</div>
                      </div>
                      <span className="tiny admin-badge">{t.status}</span>
                    </li>
                  ))}
                </ul>
              )}
              {(snapshot?.pendingCompanies ?? []).length > 0 ? (
                <>
                  <h3 className="admin-subtitle">
                    Fournisseurs à valider ({snapshot!.kpis.pendingCompanyVerifications})
                  </h3>
                  <ul className="activity">
                    {snapshot!.pendingCompanies.map((c) => (
                      <li key={c.id}>
                        <div>
                          <Link to={`/companies/${c.id}`}>
                            <strong>{c.name}</strong>
                          </Link>
                          <div className="muted tiny">{c.email}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          </div>

          <div className="admin-quick-links">
            <Link to="/products" className="admin-quick-link">Produits</Link>
            <Link to="/companies" className="admin-quick-link">Fournisseurs</Link>
            <Link to="/analytics" className="admin-quick-link">Analytiques</Link>
          </div>
        </>
      )}
    </div>
  );
}
