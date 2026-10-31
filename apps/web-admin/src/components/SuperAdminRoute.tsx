import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="login-page">
        <p className="muted">Chargement de la session…</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
