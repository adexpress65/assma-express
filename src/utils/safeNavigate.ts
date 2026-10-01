import type { Href, Router } from "expo-router";
import { InteractionManager } from "react-native";

/**
 * Décision de navigation après création d’un produit.
 * Jamais `router.back()` : sur Android, `canGoBack()` peut être vrai
 * alors que `back()` termine l’Activity (fermeture de l’app).
 */
export function resolveProductCreateSuccessNav(
  action: "view" | "continue",
  productId: string,
  fallbackHref: string,
): { kind: "stay" } | { kind: "replace"; href: string } {
  if (action === "continue") {
    return { kind: "stay" };
  }
  const id = String(productId || "").trim();
  return { kind: "replace", href: id ? `/product/${id}` : fallbackHref };
}

export function productDetailHref(productId: string): Href {
  return `/product/${String(productId).trim()}` as Href;
}

export function goBackOrReplace(router: Router, fallbackHref: Href): void {
  try {
    router.replace(fallbackHref);
  } catch {
    try {
      router.push(fallbackHref);
    } catch {
      /* rester sur l’écran courant plutôt que de tuer l’app */
    }
  }
}

function scheduleAfterAlert(run: () => void): void {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(run, 50);
  });
}

/**
 * Après un Alert natif : `replace` vers un écran interne (jamais `back()`).
 * Si la route cible échoue, on tente le fallback puis `push`.
 */
export function replaceAfterAlert(
  router: Router,
  href: Href,
  fallbackHref?: Href,
): void {
  scheduleAfterAlert(() => {
    try {
      router.replace(href);
    } catch {
      try {
        if (fallbackHref) {
          router.replace(fallbackHref);
          return;
        }
        router.push(href);
      } catch {
        try {
          router.push(fallbackHref ?? href);
        } catch {
          /* rester sur l’écran courant plutôt que de tuer l’app */
        }
      }
    }
  });
}

export function stayAfterAlert(onStay: () => void): void {
  scheduleAfterAlert(onStay);
}
