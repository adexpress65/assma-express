/**
 * Stock de ligne et matrice de commande (fiche produit détail / wholesale).
 * Une clé couleur×taille = `${color}__${size}` (normalisée), jamais la taille seule.
 */

export type ProductAttribute = {
  id?: string;
  name: string;
  values: string[];
};

export type ProductVariant = {
  id: string;
  color?: string;
  size?: string;
  combination?: Record<string, string>;
  price: number;
  stock?: number;
  sku?: string;
  image?: string;
};

export type ProductForOrderMatrix = {
  id: string;
  price: number;
  minOrder?: number;
  stockQuantity: number;
  mainImage?: string;
  hasVariants?: boolean;
  variantColors?: string[];
  variantSizes?: string[];
  variantAttributes?: ProductAttribute[];
  attributes?: ProductAttribute[];
  variants?: ProductVariant[];
};

export type OrderMatrixItem = {
  variantId: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  stock: number;
  image?: string;
  sku: string;
  extraLabel?: string;
};

/**
 * Stock d'une ligne de variante.
 * - stock absent / undefined / null / '' → fallback sur stockQuantity parent
 * - stock === 0 (y compris "0") → 0, rupture réelle, pas de fallback
 * - stock < 0 (ex. -1) → 0, rupture : jamais de fallback parent
 */
export function resolveLineStock(variantStock: unknown, parentStockQuantity: number): number {
  const parent = Number(parentStockQuantity);
  const parentQty = Number.isFinite(parent) && parent > 0 ? parent : 0;

  if (variantStock === undefined || variantStock === null || variantStock === '') {
    return parentQty;
  }

  const n = Number(variantStock);
  if (!Number.isFinite(n)) {
    return parentQty;
  }
  // n <= 0 : rupture. Un négatif n'est pas une quantité vendable ; le retomber
  // sur le parent masquerait l'indispo (même classe de bug que stock === 0).
  // L'ancien `n > 0` faisait ce fallback pour -1 : ce n'était pas voulu.
  if (n <= 0) {
    return 0;
  }
  return n;
}

export function normalizeColorKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

/** Valeurs d’attribut utilisables (ignore tableau vide, undefined, blancs). */
export function attributeValues(attr?: { values?: unknown } | null): string[] {
  if (!attr || !Array.isArray(attr.values)) return [];
  return attr.values.map((v) => String(v ?? '').trim()).filter(Boolean);
}

export function isColorAttributeName(name: unknown): boolean {
  return /couleur|color|colour/i.test(String(name ?? ''));
}

export function isSizeAttributeName(name: unknown): boolean {
  return /taille|size|pointure/i.test(String(name ?? ''));
}

export function findColorAttribute(
  attrs?: ProductAttribute[] | null,
): ProductAttribute | undefined {
  return (attrs || []).find((a) => isColorAttributeName(a?.name));
}

export function findSizeAttribute(
  attrs?: ProductAttribute[] | null,
): ProductAttribute | undefined {
  const list = attrs || [];
  return (
    list.find((a) => isSizeAttributeName(a?.name) && attributeValues(a).length > 0) ||
    list.find((a) => isSizeAttributeName(a?.name))
  );
}

/** Clé unique couleur + taille (2 couleurs × 3 tailles → 6 clés, pas 3). */
export function orderMatrixKey(color: unknown, size: unknown): string {
  return `${normalizeColorKey(color)}__${normalizeColorKey(size)}`;
}

/** Certains produits n'ont que variantColors/variantSizes/variantAttributes sans tableau attributes. */
export function normalizeVariantAttributes<T extends ProductForOrderMatrix>(product: T): T {
  if (product.attributes?.length) {
    return product;
  }

  if (Array.isArray(product.variantAttributes) && product.variantAttributes.length > 0) {
    return { ...product, attributes: product.variantAttributes, hasVariants: true };
  }

  const attributes: ProductAttribute[] = [];
  if (Array.isArray(product.variantColors) && product.variantColors.length > 0) {
    attributes.push({ name: 'Couleur', values: product.variantColors });
  }
  if (Array.isArray(product.variantSizes) && product.variantSizes.length > 0) {
    attributes.push({ name: 'Taille', values: product.variantSizes });
  }
  if (!attributes.length) {
    return product;
  }
  return { ...product, attributes, hasVariants: true };
}

function readCombinationColor(
  combination: Record<string, string>,
  colorAttrName?: string,
): string {
  if (colorAttrName && combination[colorAttrName] != null) {
    return String(combination[colorAttrName]);
  }
  for (const [key, value] of Object.entries(combination)) {
    if (/couleur|color/i.test(key)) {
      return String(value);
    }
  }
  return combination.Couleur || combination.Color || '';
}

function readCombinationSize(
  combination: Record<string, string>,
  sizeAttrName?: string,
): string {
  if (sizeAttrName && combination[sizeAttrName] != null) {
    return String(combination[sizeAttrName]);
  }
  return Object.entries(combination)
    .filter(([key]) => !/couleur|color/i.test(key))
    .map(([, value]) => value)
    .join(' - ');
}

function readCombinationExtras(
  combination: Record<string, string>,
  colorAttrName?: string,
  sizeAttrName?: string,
): string {
  return Object.entries(combination)
    .filter(([key]) => {
      if (colorAttrName && key === colorAttrName) return false;
      if (sizeAttrName && key === sizeAttrName) return false;
      if (/couleur|color/i.test(key)) return false;
      if (/taille|size/i.test(key)) return false;
      return true;
    })
    .map(([, value]) => value)
    .join(' · ');
}

function findVariantForColorSize(
  variants: ProductForOrderMatrix['variants'],
  color: string,
  size: string,
  colorAttrName?: string,
  sizeAttrName?: string,
) {
  const wantColor = normalizeColorKey(color);
  const wantSize = normalizeColorKey(size);
  return variants?.find((v) => {
    const comb = v.combination || {};
    const vColor = v.color || readCombinationColor(comb, colorAttrName);
    const vSize = v.size || readCombinationSize(comb, sizeAttrName);
    return normalizeColorKey(vColor) === wantColor && normalizeColorKey(vSize) === wantSize;
  });
}

function pushMatrixItem(
  matrix: Record<string, OrderMatrixItem>,
  key: string,
  item: OrderMatrixItem,
) {
  matrix[key] = item;
}

export function buildOrderMatrix(
  normalizedProduct: ProductForOrderMatrix,
  colorAttributeMeta: { name: string; values: string[] } | undefined,
  sizeAttributeMeta: { name: string; values: string[] } | undefined,
): Record<string, OrderMatrixItem> {
  const newMatrix: Record<string, OrderMatrixItem> = {};
  const colorAttrName = colorAttributeMeta?.name;
  const sizeAttrName = sizeAttributeMeta?.name;
  const colorValues = attributeValues(colorAttributeMeta);
  const sizeValues = attributeValues(sizeAttributeMeta);

  const makeItem = (
    matrixKey: string,
    color: string,
    size: string,
    existingVariant?: ProductVariant,
    extraLabel?: string,
  ): OrderMatrixItem => ({
    variantId: existingVariant?.id || `gen-${matrixKey}`,
    color,
    size,
    extraLabel,
    quantity: 0,
    // Prix catalogue du document (`price` / `priceXOF`), pas `variants[].price` :
    // ce dernier peut rester figé (ex. 1500) après une promo sur le prix vitrine (600).
    price: normalizedProduct.price,
    stock: resolveLineStock(existingVariant?.stock, normalizedProduct.stockQuantity),
    image: existingVariant?.image || normalizedProduct.mainImage,
    sku: existingVariant?.sku || `${normalizedProduct.id}-${matrixKey}`,
  });

  if (colorValues.length > 0 && sizeValues.length > 0) {
    colorValues.forEach((color) => {
      sizeValues.forEach((size) => {
        const matrixKey = orderMatrixKey(color, size);
        pushMatrixItem(
          newMatrix,
          matrixKey,
          makeItem(
            matrixKey,
            color,
            size,
            findVariantForColorSize(
              normalizedProduct.variants,
              color,
              size,
              colorAttrName,
              sizeAttrName,
            ),
          ),
        );
      });
    });
    return newMatrix;
  }

  const usableAttributes = (normalizedProduct.attributes || []).filter(
    (attr) => attr?.name && attributeValues(attr).length > 0,
  );

  if (usableAttributes.length > 0) {
    const attrNames = usableAttributes.map((a) => a.name);

    const generateCombinations = (attrIndex: number, currentComb: Record<string, string>) => {
      if (attrIndex === usableAttributes.length) {
        const matrixKey = Object.entries(currentComb)
          .map(([k, v]) => `${k}:${normalizeColorKey(v)}`)
          .join('|');

        const existingVariant = normalizedProduct.variants?.find((v) =>
          attrNames.every(
            (name) =>
              String(v.combination?.[name] ?? '')
                .trim()
                .toLowerCase() === String(currentComb[name] ?? '').trim().toLowerCase(),
          ),
        );

        const extras = readCombinationExtras(currentComb, colorAttrName, sizeAttrName);
        pushMatrixItem(
          newMatrix,
          matrixKey,
          makeItem(
            matrixKey,
            readCombinationColor(currentComb, colorAttrName),
            readCombinationSize(currentComb, sizeAttrName),
            existingVariant,
            extras || undefined,
          ),
        );
        return;
      }

      const currentAttr = usableAttributes[attrIndex];
      attributeValues(currentAttr).forEach((val) => {
        generateCombinations(attrIndex + 1, { ...currentComb, [currentAttr.name]: val });
      });
    };

    generateCombinations(0, {});
    if (Object.keys(newMatrix).length > 0) {
      return newMatrix;
    }
  }

  if (normalizedProduct.variants && normalizedProduct.variants.length > 0) {
    normalizedProduct.variants.forEach((variant) => {
      const combination = variant.combination || {};
      const color = variant.color || readCombinationColor(combination, colorAttrName);
      const size = variant.size || readCombinationSize(combination, sizeAttrName) || '';
      const matrixKey =
        variant.id ||
        (color || size
          ? orderMatrixKey(color, size)
          : `variant-${Object.keys(newMatrix).length}`);

      pushMatrixItem(
        newMatrix,
        matrixKey,
        makeItem(
          matrixKey,
          color || '',
          size,
          variant,
          readCombinationExtras(combination, colorAttrName, sizeAttrName) || undefined,
        ),
      );
    });
    if (Object.keys(newMatrix).length > 0) {
      return newMatrix;
    }
  }

  if (colorValues.length > 0) {
    colorValues.forEach((color) => {
      const matrixKey = orderMatrixKey(color, '');
      pushMatrixItem(
        newMatrix,
        matrixKey,
        makeItem(
          matrixKey,
          color,
          '',
          findVariantForColorSize(
            normalizedProduct.variants,
            color,
            '',
            colorAttrName,
            sizeAttrName,
          ),
        ),
      );
    });
    return newMatrix;
  }

  newMatrix.default = {
    variantId: 'default',
    color: '',
    size: '',
    quantity: normalizedProduct.minOrder || 1,
    price: normalizedProduct.price,
    stock: normalizedProduct.stockQuantity || 0,
    image: normalizedProduct.mainImage,
    sku: normalizedProduct.id,
  };
  return newMatrix;
}
