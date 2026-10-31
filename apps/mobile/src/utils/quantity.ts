// utils/quantity.ts

export const saneQty = (qty: any): number => {
  const n = Number(qty);

  // Si NaN, null, undefined, string vide → quantité 1
  if (!n || isNaN(n) || n <= 0) return 1;

  // Pas de décimal dans un panier
  return Math.floor(n);
};
