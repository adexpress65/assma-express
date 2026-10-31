/**
 * Initialisation Sentry — importer ce module une seule fois depuis `app/_layout.tsx`
 * avant le reste de l’app pour que les erreurs de démarrage soient capturées.
 *
 * Variables :
 * - EXPO_PUBLIC_SENTRY_DSN : DSN du projet (public, peut être dans .env / EAS env).
 * - SENTRY_ORG / SENTRY_PROJECT : utilisés au build natif par le plugin Expo pour uploader les source maps (secrets EAS).
 */
import type { ComponentType } from "react";
import * as Sentry from "@sentry/react-native";
import { isRunningInExpoGo } from "expo";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? "";

export const sentryEnabled = Boolean(dsn);

let navigationIntegration:
  | ReturnType<typeof Sentry.reactNavigationIntegration>
  | undefined;

if (sentryEnabled) {
  navigationIntegration = Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: !isRunningInExpoGo(),
  });

  Sentry.init({
    dsn,
    enabled: true,
    /** Désactivé par défaut (RGPD) : passer à true si vous acceptez d’envoyer plus de contexte. */
    sendDefaultPii: false,
    debug: __DEV__,
    environment: __DEV__ ? "development" : "production",
    tracesSampleRate: __DEV__ ? 1.0 : 0.15,
    profilesSampleRate: __DEV__ ? 1.0 : 0.1,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30_000,
    enableNativeFramesTracking: !isRunningInExpoGo(),
    integrations: [navigationIntegration],
  });
}

/**
 * À appeler avec le ref renvoyé par `useNavigationContainerRef()` (expo-router).
 * Le SDK accepte l’objet ref ou le conteneur directement.
 */
export function registerSentryNavigationContainer(ref: unknown): void {
  if (!navigationIntegration || ref == null) return;
  navigationIntegration.registerNavigationContainer(ref);
}

/** Associer l’utilisateur connecté aux événements Sentry (appeler depuis AuthContext). */
export function setSentryUser(params: {
  id?: string | null;
  email?: string;
  username?: string;
}): void {
  if (!sentryEnabled) return;
  if (!params.id) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: params.id,
    email: params.email,
    username: params.username,
  });
}

/**
 * Enveloppe recommandée par Sentry pour capturer les erreurs React au sommet de l’arbre.
 */
export function wrapRootComponent<P extends object>(
  Root: ComponentType<P>
): ComponentType<P> {
  if (!sentryEnabled) return Root;
  return Sentry.wrap(Root) as ComponentType<P>;
}

export { Sentry };
