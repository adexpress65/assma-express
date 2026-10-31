import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type NavLinkDef = {
  to: string;
  label: string;
  end?: boolean;
  superAdminOnly?: boolean;
};

const LINKS: NavLinkDef[] = [
  { to: "/", label: "Tableau de bord", end: true },
  { to: "/companies", label: "Fournisseurs" },
  { to: "/sellers", label: "Vendeurs", superAdminOnly: true },
  { to: "/user-roles", label: "Utilisateurs / rôles", superAdminOnly: true },
  { to: "/products", label: "Produits" },
  { to: "/stock", label: "Produits — Stock" },
  { to: "/products/new", label: "Ajouter un produit" },
  { to: "/orders", label: "Commandes" },
  { to: "/support", label: "Support" },
  { to: "/analytics", label: "Analytiques" },
  { to: "/promo", label: "Push promo", superAdminOnly: true },
  { to: "/warehouse-fees", label: "Frais d'entrepôt", superAdminOnly: true },
];

export function Layout() {
  const { displayName, role, logout, isSuperAdmin } = useAuth();
  const visibleLinks = LINKS.filter(
    (link) => !link.superAdminOnly || isSuperAdmin,
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>ASSMA</strong>
          <span>Administration web</span>
        </div>
        <nav>
          {visibleLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-meta">
            <span className="user-name">{displayName}</span>
            <span className="user-role">{role}</span>
          </div>
          <button type="button" className="btn ghost" onClick={() => logout()}>
            Déconnexion
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
