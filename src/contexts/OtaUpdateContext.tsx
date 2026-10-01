import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";
import * as Updates from "expo-updates";

export type OtaStatus =
  | "idle"
  | "checking"
  | "downloading"
  | "pending-reload"
  | "ready"
  | "failed";

type OtaContextValue = {
  status: OtaStatus;
  /** true = la JS bundle courante peut servir au checkout (à jour, ou check impossible). */
  ensureCheckoutReady: () => Promise<boolean>;
};

const OtaUpdateContext = createContext<OtaContextValue | undefined>(undefined);

const CHECK_MIN_INTERVAL_MS = 20_000;
const CHECK_TIMEOUT_MS = 6_000;

function otaSupported(): boolean {
  if (__DEV__) return false;
  if (Platform.OS === "web") return false;
  try {
    return Updates.isEnabled === true;
  } catch {
    return false;
  }
}

/**
 * Résout `null` si le serveur d'updates ne répond pas à temps : le paiement ne doit jamais
 * attendre indéfiniment un check OTA.
 */
async function checkForUpdateWithTimeout(): Promise<Updates.UpdateCheckResult | null> {
  const check = Updates.checkForUpdateAsync();
  // Marque la promesse comme gérée au cas où le timeout gagne la course.
  check.catch(() => undefined);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      check,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), CHECK_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function OtaUpdateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<OtaStatus>(() =>
    otaSupported() ? "idle" : "ready",
  );
  const inFlight = useRef<Promise<void> | null>(null);
  const lastCheckAt = useRef(0);
  const pendingReload = useRef(false);

  const runCheck = useCallback(async () => {
    if (!otaSupported()) {
      setStatus("ready");
      return;
    }
    if (inFlight.current) {
      await inFlight.current;
      return;
    }

    const work = (async () => {
      setStatus(pendingReload.current ? "pending-reload" : "checking");
      try {
        const update = await checkForUpdateWithTimeout();
        lastCheckAt.current = Date.now();
        // `null` = timeout : on continue avec le bundle courant.
        if (!update?.isAvailable) {
          pendingReload.current = false;
          setStatus("ready");
          return;
        }
        setStatus("downloading");
        await Updates.fetchUpdateAsync();
        pendingReload.current = true;
        setStatus("pending-reload");
      } catch (error) {
        console.log("OTA check failed, continuing with current version:", error);
        setStatus("failed");
      }
    })();

    inFlight.current = work;
    try {
      await work;
    } finally {
      inFlight.current = null;
    }
  }, []);

  useEffect(() => {
    void runCheck();
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      if (Date.now() - lastCheckAt.current < CHECK_MIN_INTERVAL_MS) return;
      void runCheck();
    });
    return () => sub.remove();
  }, [runCheck]);

  const ensureCheckoutReady = useCallback(async () => {
    if (!otaSupported()) return true;
    if (inFlight.current) {
      await inFlight.current;
    } else if (Date.now() - lastCheckAt.current >= CHECK_MIN_INTERVAL_MS) {
      await runCheck();
    }
    if (!pendingReload.current) return true;
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.log("OTA reload failed, continuing with current version:", error);
      setStatus("failed");
      return true;
    }
    return false;
  }, [runCheck]);

  return (
    <OtaUpdateContext.Provider value={{ status, ensureCheckoutReady }}>
      {children}
    </OtaUpdateContext.Provider>
  );
}

export function useOtaUpdate(): OtaContextValue {
  const ctx = useContext(OtaUpdateContext);
  if (!ctx) {
    throw new Error("useOtaUpdate must be used within an OtaUpdateProvider");
  }
  return ctx;
}
