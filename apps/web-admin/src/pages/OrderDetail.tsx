import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  extractOrderItems,
  formatDate,
  formatMoney,
  deliveryModeLabel,
  DELIVERY_MODE_UNCONFIRMED_MESSAGE,
  fulfillmentStatusLabel,
  shouldConfirmDeliveryMode,
  isPaymentConfirmed,
  nextFulfillmentStatus,
  normalizeOrderStatus,
  orderStatusLabel,
  resolveFulfillmentStatus,
  resolveOrderShippingMethod,
} from "../lib/orders";
import {
  formatVariantQuantityLine,
  getOrderItemVariantLines,
  getOrderLineStableKey,
  hasVisibleVariantAttrs,
} from "../lib/orderItemVariants";

export function OrderDetailPage() {
  const { id } = useParams();
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "orders", id));
        if (snap.exists()) setRaw({ id: snap.id, ...snap.data() });
        else setRaw(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function advance() {
    if (!id || !raw) return;
    const fulfillment = resolveFulfillmentStatus(raw);
    const next = nextFulfillmentStatus(fulfillment, raw.deliveryMode);
    if (!next) return;
    if (!isPaymentConfirmed(raw)) {
      alert("Paiement non confirmé : impossible d’avancer le suivi logistique.");
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, "orders", id), {
        fulfillmentStatus: next,
        updatedAt: serverTimestamp(),
      });
      setRaw((prev) => (prev ? { ...prev, fulfillmentStatus: next } : prev));
    } catch {
      alert("Mise à jour impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Chargement…</p>;
  if (!raw) {
    return (
      <div className="page">
        <p>Commande introuvable.</p>
        <Link to="/orders">Retour</Link>
      </div>
    );
  }

  const status = normalizeOrderStatus(raw.status);
  const fulfillment = resolveFulfillmentStatus(raw);
  const next = nextFulfillmentStatus(fulfillment, raw.deliveryMode);
  const ship = (raw.shippingAddress || {}) as Record<string, string>;
  const items = extractOrderItems(raw);
  const paid = isPaymentConfirmed(raw);
  const transport = resolveOrderShippingMethod(raw);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            <Link to="/orders">Commandes</Link>
          </p>
          <h1>Commande {String(raw.orderId || raw.orderNumber || id)}</h1>
          <p className="muted">{formatDate(raw.createdAt)}</p>
        </div>
        {next && (
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => void advance()}
          >
            {busy ? "…" : `Passer en « ${fulfillmentStatusLabel(next)} »`}
          </button>
        )}
      </header>

      <div className="two-col">
        <section className="panel">
          <h2>Client & livraison</h2>
          <p>
            <strong>{ship.fullName || String(raw.customerName || "—")}</strong>
          </p>
          <p className="muted">
            {ship.phone || String(raw.phone || "—")}
            <br />
            {ship.street}
            {(ship.building || ship.floor || ship.apartment) && (
              <>
                <br />
                {[
                  ship.building ? `Bâtiment : ${ship.building}` : null,
                  ship.floor ? `Étage : ${ship.floor}` : null,
                  ship.apartment ? `Appt : ${ship.apartment}` : null,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </>
            )}
            <br />
            {[ship.postalCode, ship.city, ship.country].filter(Boolean).join(" ")}
            {ship.deliveryNote ? (
              <>
                <br />
                Note livreur : {ship.deliveryNote}
              </>
            ) : null}
          </p>
          <p>
            Paiement :{" "}
            <span className="badge">{paid ? "confirmé" : "non confirmé"}</span>
          </p>
          <p>
            Statut paiement : <span className="badge">{orderStatusLabel(status)}</span>
          </p>
          <p>
            Logistique :{" "}
            <span className="badge">
              {fulfillment ? fulfillmentStatusLabel(fulfillment) : "—"}
            </span>
          </p>
          <p>
            Dernier kilomètre :{" "}
            <span className="badge">
              {shouldConfirmDeliveryMode(raw)
                ? "À confirmer"
                : deliveryModeLabel(raw.deliveryMode) || "—"}
            </span>
          </p>
          {shouldConfirmDeliveryMode(raw) ? (
            <p className="muted" style={{ color: "#92400E" }}>
              {DELIVERY_MODE_UNCONFIRMED_MESSAGE}
            </p>
          ) : null}
          <p>
            <strong>Mode de transport :</strong> {transport.name}
          </p>
        </section>
        <section className="panel">
          <h2>Montants</h2>
          <p>Total : {formatMoney(Number(raw.total ?? raw.amount ?? 0), String(raw.currency || "XOF"))}</p>
          <p className="muted">Prestataire : {String(raw.provider || raw.paymentProvider || "—")}</p>
        </section>
      </div>

      <section className="panel">
        <h2>Articles</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Variante</th>
              <th>Boutique</th>
              <th>Qté</th>
              <th>Prix</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const variantLines = getOrderItemVariantLines(item);
              const productName = String(item.name || item.title || "—");
              const grouped = variantLines.length > 1;
              return (
              <tr key={getOrderLineStableKey(item, i)}>
                <td>{productName}</td>
                <td>
                  {!hasVisibleVariantAttrs(variantLines) ? (
                    "—"
                  ) : (
                    <ul className="variant-lines">
                      {variantLines.map((line, lineIndex) => (
                        <li key={`${line.color}-${line.size}-${lineIndex}`}>
                          {formatVariantQuantityLine(productName, line, {
                            includeName: !grouped,
                          })}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td>{String(item.companyName || item.supplier || "—")}</td>
                <td>{String(item.quantity ?? 1)}</td>
                <td>{formatMoney(Number(item.price ?? 0))}</td>
              </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Aucun article listé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

