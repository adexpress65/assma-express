import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatDate, formatMoney } from "../lib/orders";
import { useAuth } from "../auth/AuthContext";

type Stats = {
  companies: number;
  pending: number;
  products: number;
  orders: number;
  tickets: number;
  users: number;
};

type PendingCompany = {
  id: string;
  name: string;
  email: string;
  createdAt?: unknown;
};

type Activity = {
  id: string;
  title: string;
  description: string;
  when: unknown;
};

const MENU = [
  { to: "/companies", label: "Fournisseurs", hint: "Valider, suspendre, ajouter" },
  { to: "/products", label: "Produits", hint: "Créer et modifier le catalogue" },
  { to: "/stock", label: "Produits — Stock", hint: "Stock, ruptures, filtre fournisseur" },
  { to: "/products/new", label: "Ajouter un produit", hint: "Nouvelle fiche complète" },
  { to: "/orders", label: "Commandes", hint: "Suivi et fulfilment" },
  { to: "/sellers", label: "Vendeurs", hint: "Activer / suspendre les comptes", superAdminOnly: true },
  { to: "/user-roles", label: "Utilisateurs / rôles", hint: "Attribuer admin, vendeur ou client", superAdminOnly: true },
  { to: "/support", label: "Support", hint: "Tickets clients" },
  { to: "/analytics", label: "Analytiques", hint: "CA et volumes" },
  { to: "/promo", label: "Push promo", hint: "Notification produit", superAdminOnly: true },
];

export function DashboardPage() {
  const { displayName, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingCompany[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const companiesCol = collection(db, "companies");
      const pendingQ = query(
        companiesCol,
        where("verification.status", "==", "pending"),
      );
      const ticketsQ = query(
        collection(db, "supportTickets"),
        where("status", "in", ["open", "pending"]),
      );

      const [companiesC, pendingC, productsC, ordersC, usersC] = await Promise.all([
        getCountFromServer(companiesCol),
        getCountFromServer(pendingQ),
        getCountFromServer(collection(db, "products")),
        getCountFromServer(collection(db, "orders")),
        getCountFromServer(collection(db, "users")),
      ]);

      let tickets = 0;
      try {
        tickets = (await getCountFromServer(ticketsQ)).data().count;
      } catch {
        tickets = 0;
      }

      setStats({
        companies: companiesC.data().count,
        pending: pendingC.data().count,
        products: productsC.data().count,
        orders: ordersC.data().count,
        tickets,
        users: usersC.data().count,
      });

      const pendingSnap = await getDocs(
        query(pendingQ, orderBy("createdAt", "desc"), limit(12)),
      ).catch(async () => getDocs(query(pendingQ, limit(12))));

      setPending(
        pendingSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || "Sans nom"),
            email: String(data.email || data.contactEmail || "—"),
            createdAt: data.createdAt,
          };
        }),
      );

      const [companiesRecent, productsRecent, ordersRecent] = await Promise.all([
        getDocs(query(companiesCol, orderBy("createdAt", "desc"), limit(4))).catch(
          async () => ({ docs: [] as typeof pendingSnap.docs }),
        ),
        getDocs(
          query(collection(db, "products"), orderBy("createdAt", "desc"), limit(4)),
        ).catch(async () => ({ docs: [] as typeof pendingSnap.docs })),
        getDocs(
          query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(4)),
        ).catch(async () => ({ docs: [] as typeof pendingSnap.docs })),
      ]);

      const items: Activity[] = [
        ...companiesRecent.docs.map((d) => ({
          id: `c-${d.id}`,
          title: "Nouveau fournisseur",
          description: String(d.data().name || d.id),
          when: d.data().createdAt,
        })),
        ...productsRecent.docs.map((d) => ({
          id: `p-${d.id}`,
          title: "Produit publié",
          description: String(d.data().name || d.id),
          when: d.data().createdAt,
        })),
        ...ordersRecent.docs.map((d) => ({
          id: `o-${d.id}`,
          title: "Commande",
          description: formatMoney(
            Number(d.data().total ?? d.data().amount ?? 0),
            String(d.data().currency || "XOF"),
          ),
          when: d.data().createdAt,
        })),
      ];
      items.sort((a, b) => {
        const ta =
          a.when && typeof a.when === "object" && "seconds" in a.when
            ? Number((a.when as { seconds: number }).seconds)
            : 0;
        const tb =
          b.when && typeof b.when === "object" && "seconds" in b.when
            ? Number((b.when as { seconds: number }).seconds)
            : 0;
        return tb - ta;
      });
      setActivity(items.slice(0, 8));
    } catch (e) {
      console.error(e);
      setError("Impossible de charger le tableau de bord.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(id: string) {
    setActionId(id);
    try {
      await updateDoc(doc(db, "companies", id), {
        "verification.status": "verified",
        "verification.verified": true,
        isActive: true,
        status: "active",
        updatedAt: new Date(),
      });
      setPending((prev) => prev.filter((c) => c.id !== id));
      setStats((s) =>
        s ? { ...s, pending: Math.max(0, s.pending - 1) } : s,
      );
    } catch {
      alert("Validation impossible.");
    } finally {
      setActionId(null);
    }
  }

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Super Admin</p>
          <h1>Bienvenue, {displayName || "Admin"}</h1>
          <p className="muted">{today}</p>
        </div>
        <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
          Actualiser
        </button>
      </header>

      {error && <div className="alert danger">{error}</div>}

      {loading && !stats ? (
        <p className="muted">Chargement…</p>
      ) : (
        <>
          <div className="stat-grid six">
            <Link to="/companies" className="stat-card">
              <span>Fournisseurs</span>
              <strong>{stats?.companies ?? 0}</strong>
            </Link>
            <Link to="/companies" className="stat-card warn">
              <span>Vérifications</span>
              <strong>{stats?.pending ?? 0}</strong>
            </Link>
            <Link to="/products" className="stat-card">
              <span>Produits</span>
              <strong>{stats?.products ?? 0}</strong>
            </Link>
            <Link to="/orders" className="stat-card">
              <span>Commandes</span>
              <strong>{stats?.orders ?? 0}</strong>
            </Link>
            <Link to="/support" className="stat-card">
              <span>Tickets ouverts</span>
              <strong>{stats?.tickets ?? 0}</strong>
            </Link>
            <div className="stat-card">
              <span>Utilisateurs</span>
              <strong>{stats?.users ?? 0}</strong>
            </div>
          </div>

          <h2 className="section-title">Administration</h2>
          <div className="menu-grid">
            {MENU.filter((item) => !item.superAdminOnly || isSuperAdmin).map((item) => (
              <Link key={item.to} to={item.to} className="menu-card">
                <strong>{item.label}</strong>
                <span className="muted">{item.hint}</span>
              </Link>
            ))}
          </div>

          <div className="two-col">
            <section className="panel">
              <div className="panel-head">
                <h2>Vérifications en attente</h2>
                <Link to="/companies">Tout voir</Link>
              </div>
              {pending.length === 0 ? (
                <p className="muted">Aucune vérification en attente.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Boutique</th>
                      <th>Email</th>
                      <th>Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link to={`/companies/${c.id}`}>{c.name}</Link>
                        </td>
                        <td>{c.email}</td>
                        <td>{formatDate(c.createdAt)}</td>
                        <td className="right">
                          <button
                            type="button"
                            className="btn primary"
                            disabled={actionId === c.id}
                            onClick={() => void approve(c.id)}
                          >
                            {actionId === c.id ? "…" : "Valider"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Activité récente</h2>
              </div>
              {activity.length === 0 ? (
                <p className="muted">Aucune activité récente.</p>
              ) : (
                <ul className="activity">
                  {activity.map((a) => (
                    <li key={a.id}>
                      <div>
                        <strong>{a.title}</strong>
                        <div className="muted tiny">{a.description}</div>
                      </div>
                      <span className="tiny muted">{formatDate(a.when)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
