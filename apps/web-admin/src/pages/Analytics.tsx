import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatMoney } from "../lib/orders";

type Range = "week" | "month";

export function AnalyticsPage() {
  const [range, setRange] = useState<Range>("week");
  const [revenue, setRevenue] = useState(0);
  const [orders, setOrders] = useState(0);
  const [products, setProducts] = useState(0);
  const [companies, setCompanies] = useState(0);
  const [series, setSeries] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        getCountFromServer(collection(db, "products")),
        getCountFromServer(collection(db, "companies")),
      ]);
      setProducts(p.data().count);
      setCompanies(c.data().count);

      const snap = await getDocs(
        query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(800)),
      ).catch(async () =>
        getDocs(query(collection(db, "orders"), limit(800))),
      );

      const days = range === "week" ? 7 : 30;
      const since = Date.now() - days * 86400000;
      const buckets = Array.from({ length: days }, () => 0);
      let total = 0;
      let count = 0;

      snap.docs.forEach((d) => {
        const data = d.data();
        const created = data.createdAt as { seconds?: number; toDate?: () => Date } | undefined;
        let ts = 0;
        if (created?.toDate) ts = created.toDate().getTime();
        else if (created?.seconds) ts = created.seconds * 1000;
        if (ts < since) return;
        const amount = Number(data.total ?? data.amount ?? 0);
        total += amount;
        count += 1;
        const idx = Math.min(days - 1, Math.max(0, Math.floor((ts - since) / 86400000)));
        buckets[idx] += amount;
      });

      setRevenue(total);
      setOrders(count);
      setSeries(buckets);
    } catch (e) {
      console.error(e);
      alert("Impossible de charger les analytiques.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const max = useMemo(() => Math.max(1, ...series), [series]);
  const avg = orders > 0 ? revenue / orders : 0;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Analytiques</h1>
          <p className="muted">CA et commandes sur la période (échantillon Firestore)</p>
        </div>
        <div className="filters">
          <button
            className={range === "week" ? "chip active" : "chip"}
            onClick={() => setRange("week")}
            type="button"
          >
            7 jours
          </button>
          <button
            className={range === "month" ? "chip active" : "chip"}
            onClick={() => setRange("month")}
            type="button"
          >
            30 jours
          </button>
        </div>
      </header>

      {loading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card accent">
              <span>Chiffre d’affaires</span>
              <strong>{formatMoney(revenue)}</strong>
            </div>
            <div className="stat-card">
              <span>Commandes</span>
              <strong>{orders}</strong>
            </div>
            <div className="stat-card">
              <span>Panier moyen</span>
              <strong>{formatMoney(avg)}</strong>
            </div>
            <div className="stat-card">
              <span>Produits / fournisseurs</span>
              <strong>
                {products} / {companies}
              </strong>
            </div>
          </div>
          <section className="panel">
            <h2>CA par jour</h2>
            <div className="bars" aria-label="Graphique CA">
              {series.map((v, i) => (
                <div
                  key={i}
                  className="bar"
                  style={{ height: `${Math.max(4, (v / max) * 140)}px` }}
                  title={formatMoney(v)}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
