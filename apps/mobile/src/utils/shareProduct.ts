import { Platform, Share } from 'react-native';

type ShareProductInput = {
  productId: string;
  title: string;
  priceLabel?: string;
  /** Chemin Expo Router, ex. `/product/wholesale/abc`. */
  path?: string;
};

export const PRODUCT_SHARE_WEB_ORIGIN = 'https://assma-expresse.web.app';

export function productShareWebUrl({
  productId,
  title,
  priceLabel,
  path,
}: ShareProductInput): string {
  const id = String(productId || '').trim();
  const url = new URL(`${PRODUCT_SHARE_WEB_ORIGIN}/p/${encodeURIComponent(id)}`);
  if (typeof path === 'string' && path.includes('/wholesale/')) {
    url.searchParams.set('w', '1');
  }
  const heading = (title || '').trim();
  if (heading) url.searchParams.set('n', heading.slice(0, 120));
  if (priceLabel) url.searchParams.set('pr', String(priceLabel).slice(0, 40));
  return url.toString();
}

/** Ouvre la feuille de partage avec un lien https (install si l’app n’est pas là). */
export async function shareProduct(input: ShareProductInput): Promise<void> {
  const id = String(input.productId || '').trim();
  if (!id) return;

  const url = productShareWebUrl(input);
  const heading = (input.title || 'Produit A2Express').trim();
  const message = [
    heading,
    input.priceLabel ? `Prix : ${input.priceLabel}` : null,
    'Voir ce produit sur A2Express :',
    url,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await Share.share(
      Platform.OS === 'ios'
        ? { title: heading, message, url }
        : { title: heading, message },
    );
  } catch {
    /* Feuille fermée ou partage indisponible. */
  }
}
