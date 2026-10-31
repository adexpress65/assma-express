import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  formatDate,
  formatMoney,
  fulfillmentStatusLabel,
  deliveryModeLabel,
  shouldConfirmDeliveryMode,
  nextFulfillmentStatus,
  normalizeOrderStatus,
  orderStatusLabel,
  resolveFulfillmentStatus,
  type AdminOrderStatus,
  type FulfillmentStatus,
} from "../lib/orders";

type OrderRow = {
  id: string;
  orderId?: string;
  status: AdminOrderStatus;
  fulfillmentStatus?: FulfillmentStatus;
  deliveryMode?: string;
  rawStatus?: string;
  total?: number;
  currency?: string;
  customerName?: string;
  phone?: string;
  city?: string;
  createdAt?: unknown;
  paymentStatus?: string;
};

type FilterKey = "all" | "active" | "shipped" | "delivered" | "issues";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "active", label: "Confirmée / prépa." },
  { key: "shipped", label: "Expédiées" },
  { key: "delivered", label: "Livrées" },
  { key: "issues", label: "Annul. / échec" },
];

function matchesFilter(status: AdminOrderStatus, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "active") {
    return status === "confirmed" || status === "processing" || status === "pending";
  }
  if (filter === "shipped") return status === "shipped";
  if (filter === "delivered") return status === "delivered";
  return status === "cancelled" || status === "failed";
}

export function OrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("active");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(200),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data();
            const shipping = (data.shippingAddress || {}) as Record<string, string>;
            return {
              id: d.id,
              orderId: data.orderId || data.orderNumber,
              status: normalizeOrderStatus(data.status),
              fulfillmentStatus: resolveFulfillmentStatus(data),
              deliveryMode: String(data.deliveryMode || ""),
              rawStatus: String(data.status || ""),
              total: Number(data.total ?? data.amount ?? 0),
              currency: data.currency || "XOF",
              customerName:
                shipping.fullName || data.customerName || data.userName || "—",
              phone: shipping.phone || data.phone || "",
              city: shipping.city || "",
              createdAt: data.createdAt,
              paymentStatus: String(data.paymentStatus || data.payment?.status || ""),
            };
          }),
        );
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
        alert("Impossible de charger les commandes.");
      },
    );
    return () => unsub();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!matchesFilter(r.status, filter)) return false;
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        String(r.orderId || "").toLowerCase().includes(q) ||
        String(r.customerName || "").toLowerCase().includes(q) ||
        String(r.phone || "").replace(/\s/g, "").includes(q.replace(/\s/g, ""))
      );
    });
  }, [rows, filter, search]);

  const advance = useCallback(async (row: OrderRow) => {
    const next = nextFulfillmentStatus(row.fulfillmentStatus, row.deliveryMode);
    if (!next) return;
    setBusyId(row.id);
    try {
      await updateDoc(doc(db, "orders", row.id), {
        fulfillmentStatus: next,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      alert("Mise à jour du suivi logistique impossible.");
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Commandes</h1>
          <p className="muted">Temps réel — ouvrir une fiche pour le détail</p>
        </div>
        <input
          className="search"
          placeholder="N°, client, téléphone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </header>

      <div className="filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={filter === f.key ? "chip active" : "chip"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
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
                <th>Commande</th>
                <th>Client</th>
                <th>Date</th>
                <th>Total</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const next = nextFulfillmentStatus(r.fulfillmentStatus, r.deliveryMode);
                return (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/orders/${r.id}`}>
                        <strong>{r.orderId || r.id.slice(0, 8)}</strong>
                      </Link>
                      <div className="tiny muted">{r.id}</div>
                    </td>
                    <td>
                      {r.customerName}
                      <div className="tiny muted">
                        {[r.phone, r.city].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td>{formatMoney(r.total, r.currency)}</td>
                    <td>
                      <span className="badge">{orderStatusLabel(r.status)}</span>
                      {r.fulfillmentStatus ? (
                        <div className="tiny muted">
                          Logistique: {fulfillmentStatusLabel(r.fulfillmentStatus)}
                        </div>
                      ) : null}
                      {shouldConfirmDeliveryMode(r) ? (
                        <div className="tiny muted">Mode de livraison à confirmer</div>
                      ) : deliveryModeLabel(r.deliveryMode) ? (
                        <div className="tiny muted">{deliveryModeLabel(r.deliveryMode)}</div>
                      ) : null}
                      {r.paymentStatus ? (
                        <div className="tiny muted">Paiement: {r.paymentStatus}</div>
                      ) : null}
                    </td>
                    <td className="right actions">
                      <Link className="btn" to={`/orders/${r.id}`}>
                        Détail
                      </Link>
                      {next ? (
                        <button
                          type="button"
                          className="btn primary"
                          disabled={busyId === r.id}
                          onClick={() => void advance(r)}
                        >
                          → {fulfillmentStatusLabel(next)}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Aucune commande pour ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
