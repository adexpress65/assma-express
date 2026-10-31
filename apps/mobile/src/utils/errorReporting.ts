import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? "";
const sentryActive = Boolean(dsn);

/**
 * Point d’entrée unique pour le suivi des erreurs côté client (Sentry si DSN défini).
 */
export function captureException(
  error: unknown,
  context?: { screen?: string; tags?: Record<string, string> }
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  if (__DEV__) {
    console.error(
      `[captureException]${context?.screen ? ` ${context.screen}` : ""}`,
      context?.tags,
      err
    );
  }
  if (!sentryActive) return;
  try {
    Sentry.captureException(err, {
      tags: context?.tags,
      contexts: context?.screen
        ? { app_screen: { name: context.screen } }
        : undefined,
    });
  } catch {
    /* ignore */
  }
}
