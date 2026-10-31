import { useEffect, useState, type FormEvent } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../auth/AuthContext";

type WarehouseRow = {
  id: string;
  label: string;
  feeUsd: number;
  active: boolean;
  sortOrder: number;
};

type FormState = {
  usdToXof: string;
  warehouses: WarehouseRow[];
};

const DEFAULTS: FormState = {
  usdToXof: "625",
  warehouses: [
    {
      id: "guangzhou",
      label: "Guangzhou",
      feeUsd: 1.9,
      active: true,
      sortOrder: 1,
    },
    { id: "yiwu", label: "Yiwu", feeUsd: 2.3, active: true, sortOrder: 2 },
  ],
};

function slugifyId(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function WarehouseFeesPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newFee, setNewFee] = useState("1.00");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "config", "warehouseFees"));
        if (!snap.exists()) {
          setForm(DEFAULTS);
          return;
        }
        const data = snap.data();
        const list = Array.isArray(data.warehouses) ? data.warehouses : [];
        setForm({
          usdToXof: String(data.usdToXof ?? 625),
          warehouses: list.map((row: Record<string, unknown>, i: number) => ({
            id: String(row.id || `hub-${i}`),
            label: String(row.label || row.id || `Hub ${i + 1}`),
            feeUsd: Number(row.feeUsd) || 0,
            active: row.active !== false,
            sortOrder: Number(row.sortOrder) || i + 1,
          })),
        });
      } catch (e) {
        console.error(e);
        setError("Impossible de charger config/warehouseFees.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateRow(id: string, patch: Partial<WarehouseRow>) {
    setForm((prev) => ({
      ...prev,
      warehouses: prev.warehouses.map((w) =>
        w.id === id ? { ...w, ...patch } : w,
      ),
    }));
  }

  function addWarehouse() {
    const label = newLabel.trim();
    if (!label) {
      setError("Indiquez un nom d'entrepôt.");
      return;
    }
    let id = slugifyId(label);
    if (!id) id = `hub-${Date.now()}`;
    if (form.warehouses.some((w) => w.id === id)) {
      id = `${id}-${Date.now()}`;
    }
    const feeUsd = Number(newFee.replace(",", ".")) || 0;
    setForm((prev) => ({
      ...prev,
      warehouses: [
        ...prev.warehouses,
        {
          id,
          label,
          feeUsd,
          active: true,
          sortOrder: prev.warehouses.length + 1,
        },
      ],
    }));
    setNewLabel("");
    setNewFee("1.00");
    setError(null);
  }

  function removeWarehouse(id: string) {
    setForm((prev) => ({
      ...prev,
      warehouses: prev.warehouses.filter((w) => w.id !== id),
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const usdToXof = Number(form.usdToXof.replace(",", "."));
    if (!Number.isFinite(usdToXof) || usdToXof <= 0) {
      setError("Le taux USD → XOF doit être un nombre positif (ex. 625).");
      return;
    }
    if (form.warehouses.length === 0) {
      setError("Ajoutez au moins un entrepôt.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await setDoc(
        doc(db, "config", "warehouseFees"),
        {
          currency: "USD",
          usdToXof,
          warehouses: form.warehouses.map((w, i) => ({
            id: w.id,
            label: w.label.trim() || w.id,
            feeUsd: Number(w.feeUsd) || 0,
            active: w.active !== false,
            sortOrder: w.sortOrder || i + 1,
          })),
          updatedAt: new Date(),
          updatedBy: user?.uid ?? null,
        },
        { merge: true },
      );
      setMessage("Grille des frais d'entrepôt enregistrée.");
    } catch (err) {
      console.error(err);
      setError("Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Chargement de la grille…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Frais d'entrepôt</h1>
          <p className="muted">
            Grille USD par hub d'origine — appliquée aux commandes 0 FCFA
            (une fois par entrepôt distinct). Document Firestore{" "}
            <code>config/warehouseFees</code>.
          </p>
        </div>
      </header>

      {error && <div className="alert danger">{error}</div>}
      {message && <div className="alert">{message}</div>}

      <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
        <section className="panel">
          <h2>Taux de change</h2>
          <label>
            USD → XOF
            <input
              type="number"
              min="1"
              step="1"
              value={form.usdToXof}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, usdToXof: e.target.value }))
              }
            />
          </label>
          <p className="muted">
            Exemple : 1,90$ × {form.usdToXof || "625"} ={" "}
            {Math.round(1.9 * (Number(form.usdToXof) || 625))} XOF
          </p>
        </section>

        <section className="panel">
          <h2>Entrepôts</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Libellé</th>
                  <th>Frais (USD)</th>
                  <th>Actif</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.warehouses.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <code>{w.id}</code>
                    </td>
                    <td>
                      <input
                        value={w.label}
                        onChange={(e) =>
                          updateRow(w.id, { label: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={w.feeUsd}
                        onChange={(e) =>
                          updateRow(w.id, {
                            feeUsd: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={w.active}
                        onChange={(e) =>
                          updateRow(w.id, { active: e.target.checked })
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn danger"
                        onClick={() => removeWarehouse(w.id)}
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row-2" style={{ marginTop: 16 }}>
            <label>
              Nouvel entrepôt
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ex. Shenzhen"
              />
            </label>
            <label>
              Frais USD
              <input
                type="number"
                min="0"
                step="0.01"
                value={newFee}
                onChange={(e) => setNewFee(e.target.value)}
              />
            </label>
          </div>
          <button type="button" className="btn" onClick={addWarehouse}>
            Ajouter l'entrepôt
          </button>
        </section>

        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
