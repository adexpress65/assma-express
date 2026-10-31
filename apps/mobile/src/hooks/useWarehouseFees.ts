import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  DEFAULT_WAREHOUSE_FEES_CONFIG,
  parseWarehouseFeesConfig,
  type WarehouseFeesConfig,
} from "@/utils/warehouseFee";

type UseWarehouseFeesResult = {
  config: WarehouseFeesConfig;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/**
 * Lit `config/warehouseFees`. Si le document n’existe pas, utilise les défauts
 * en mémoire (sans écriture auto — le BO crée le doc à la première sauvegarde).
 */
export function useWarehouseFees(subscribe = true): UseWarehouseFeesResult {
  const [config, setConfig] = useState<WarehouseFeesConfig>(
    DEFAULT_WAREHOUSE_FEES_CONFIG,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const snap = await getDoc(doc(db, "config", "warehouseFees"));
      if (snap.exists()) {
        setConfig(parseWarehouseFeesConfig(snap.data()));
      } else {
        setConfig(DEFAULT_WAREHOUSE_FEES_CONFIG);
      }
      setError(null);
    } catch (e) {
      console.error("[warehouseFees] lecture impossible", e);
      setError("Impossible de charger les frais d'entrepôt.");
      setConfig(DEFAULT_WAREHOUSE_FEES_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!subscribe) {
      void refresh();
      return;
    }

    setLoading(true);
    const ref = doc(db, "config", "warehouseFees");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setConfig(parseWarehouseFeesConfig(snap.data()));
        } else {
          setConfig(DEFAULT_WAREHOUSE_FEES_CONFIG);
        }
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("[warehouseFees] snapshot error", err);
        setError("Impossible de charger les frais d'entrepôt.");
        setConfig(DEFAULT_WAREHOUSE_FEES_CONFIG);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [subscribe]);

  return { config, loading, error, refresh };
}

/** Persistance BO / scripts — crée ou fusionne le document. */
export async function saveWarehouseFeesConfig(
  config: WarehouseFeesConfig,
  updatedBy?: string | null,
): Promise<void> {
  const ref = doc(db, "config", "warehouseFees");
  await setDoc(
    ref,
    {
      currency: "USD",
      usdToXof: config.usdToXof,
      warehouses: config.warehouses.map((w, i) => ({
        id: w.id,
        label: w.label,
        feeUsd: w.feeUsd,
        active: w.active !== false,
        sortOrder: w.sortOrder || i + 1,
      })),
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    },
    { merge: true },
  );
}
