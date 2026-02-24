import React, { createContext, useState, useContext, ReactNode, useMemo } from 'react';

type Currency = { 
  code: string; 
  symbol: string; 
  rate: number;   // Conversion depuis XOF
  label: string;
};

const currencies: Record<string, Currency> = {
  XOF: { code: 'XOF', symbol: 'CFA', rate: 1, label: 'XOF (CFA)' },
  USD: { code: 'USD', symbol: '$', rate: 0.0016, label: 'USD ($)' },
  EUR: { code: 'EUR', symbol: '€', rate: 0.0015, label: 'EUR (€)' },
};

interface CurrencyContextType {
  currency: Currency;
  setCurrencyByCode: (code: string) => void;
  allCurrencies: Currency[];

  // 🔥 AJOUT CRITIQUE
  formatPrice: (priceXOF: number | string) => string;
  convertPrice: (priceXOF: number | string) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrency] = useState<Currency>(currencies.XOF);

  const setCurrencyByCode = (code: string) => {
    if (currencies[code]) {
      setCurrency(currencies[code]);
    }
  };

  // 🔥 Conversion pure (sans format)
  const convertPrice = (priceXOF: number | string): number => {
    const value = typeof priceXOF === 'string' ? parseFloat(priceXOF) : priceXOF;
    if (!value || isNaN(value)) return 0;
    return value * currency.rate;
  };

  // 🔥 Format final affichage
  const formatPrice = (priceXOF: number | string): string => {
    const converted = convertPrice(priceXOF);

    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: currency.code === 'XOF' ? 0 : 2,
      maximumFractionDigits: currency.code === 'XOF' ? 0 : 2,
    }).format(converted);

    return `${formatted} ${currency.symbol}`;
  };

  const value = useMemo(() => ({
    currency,
    setCurrencyByCode,
    allCurrencies: Object.values(currencies),
    formatPrice,
    convertPrice,
  }), [currency]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
};
