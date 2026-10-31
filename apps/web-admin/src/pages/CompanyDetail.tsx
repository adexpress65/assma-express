import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatDate } from "../lib/orders";

export function CompanyDetailPage() {
  const { id } = useParams();
  const [company, setCompany] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "companies", id));
        if (snap.exists()) setCompany({ id: snap.id, ...snap.data() });
        else setCompany(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function approve() {
    if (!id) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "companies", id), {
        "verification.status": "verified",
        "verification.verified": true,
        isActive: true,
        status: "active",
        updatedAt: new Date(),
      });
      setCompany((prev) =>
        prev
          ? {
              ...prev,
              isActive: true,
              status: "active",
              verification: { status: "verified", verified: true },
            }
          : prev,
      );
    } catch {
      alert("Validation impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Chargement…</p>;
  if (!company) {
    return (
      <div className="page">
        <p>Entreprise introuvable.</p>
        <Link to="/companies">Retour</Link>
      </div>
    );
  }

  const verification = company.verification as { status?: string } | undefined;
  const status = verification?.status || String(company.status || "en attente");

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            <Link to="/companies">Fournisseurs</Link>
          </p>
          <h1>{String(company.name || "Dossier")}</h1>
        </div>
        <button className="btn primary" disabled={busy} onClick={() => void approve()}>
          Valider le fournisseur
        </button>
      </header>
      <section className="panel">
        <dl className="kv">
          <div>
            <dt>Email</dt>
            <dd>{String(company.email || company.contactEmail || "—")}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{String(company.type || company.category || "—")}</dd>
          </div>
          <div>
            <dt>Localisation</dt>
            <dd>{String(company.location || "—")}</dd>
          </div>
          <div>
            <dt>Statut</dt>
            <dd>
              <span className="badge">{status}</span>
            </dd>
          </div>
          <div>
            <dt>Créé le</dt>
            <dd>{formatDate(company.createdAt)}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{String(company.description || "—")}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
