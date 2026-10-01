import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { DEFAULT_EXCHANGE_RATES } from '@/utils/productPrice';

export type ExchangeRatesMap = Record<string, number>;

function parseRates(data: Record<string, unknown> | undefined): ExchangeRatesMap {
  const rates: ExchangeRatesMap = { ...DEFAULT_EXCHANGE_RATES };
  if (!data) return rates;
  for (const [key, value] of Object.entries(data)) {
    if (key === 'updatedAt' || key === 'source' || key === 'base') continue;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) {
      rates[key.toUpperCase()] = n;
    }
  }
  rates.XOF = 1;
  return rates;
}

/**
 * Lit `config/exchangeRates` (cache Firestore). Aucun appel API depuis le client.
 */
export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRatesMap>(DEFAULT_EXCHANGE_RATES);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, 'config', 'exchangeRates');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          setRates(parseRates(data));
          const ts = data.updatedAt as { toDate?: () => Date } | Date | undefined;
          if (ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
            setUpdatedAt((ts as { toDate: () => Date }).toDate());
          } else if (ts instanceof Date) {
            setUpdatedAt(ts);
          }
        } else {
          setRates({ ...DEFAULT_EXCHANGE_RATES });
        }
        setLoading(false);
      },
      (err) => {
        console.warn('[exchangeRates] lecture impossible, fallback défauts', err);
        setRates({ ...DEFAULT_EXCHANGE_RATES });
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  return { rates, updatedAt, loading };
}
