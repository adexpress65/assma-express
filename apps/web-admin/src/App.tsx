import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { AdminDashboardPage } from "./pages/AdminDashboard";
import { CompaniesPage } from "./pages/Companies";
import { CompanyFormPage } from "./pages/CompanyForm";
import { CompanyDetailPage } from "./pages/CompanyDetail";
import { OrdersPage } from "./pages/Orders";
import { OrderDetailPage } from "./pages/OrderDetail";
import { ProductsPage } from "./pages/Products";
import { ProductFormPage } from "./pages/ProductForm";
import { SellersPage } from "./pages/Sellers";
import { SupportPage } from "./pages/Support";
import { AnalyticsPage } from "./pages/Analytics";
import { PromoPage } from "./pages/Promo";
import { WarehouseFeesPage } from "./pages/WarehouseFees";
import { UserRolesPage } from "./pages/UserRoles";
import { SuperAdminRoute } from "./components/SuperAdminRoute";
import { StockPage } from "./pages/Stock";
import { canAccessSuperAdmin } from "./lib/roles";

function Protected({ children }: { children: React.ReactNode }) {
  const { allowed, loading } = useAuth();
  if (loading) {
    return (
      <div className="login-page">
        <p className="muted">Chargement de la session…</p>
      </div>
    );
  }
  if (!allowed) return <Navigate to="/login" replace />;
  return children;
}

function HomeDashboard() {
  const { role } = useAuth();
  if (canAccessSuperAdmin(role)) {
    return <DashboardPage />;
  }
  return <AdminDashboardPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<HomeDashboard />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/new" element={<CompanyFormPage />} />
        <Route path="companies/:id" element={<CompanyDetailPage />} />
        <Route path="sellers" element={<SellersPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<ProductFormPage />} />
        <Route path="products/:id" element={<ProductFormPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route
          path="promo"
          element={
            <SuperAdminRoute>
              <PromoPage />
            </SuperAdminRoute>
          }
        />
        <Route
          path="warehouse-fees"
          element={
            <SuperAdminRoute>
              <WarehouseFeesPage />
            </SuperAdminRoute>
          }
        />
        <Route
          path="user-roles"
          element={
            <SuperAdminRoute>
              <UserRolesPage />
            </SuperAdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
