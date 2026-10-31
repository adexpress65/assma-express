import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';
import AuthRequiredModal from '@/components/auth/AuthRequiredModal';
import LoginModal from '@/components/account/LoginModal';
import {
  GUEST_MODE_KEY,
  INTRO_SEEN_KEY,
  PENDING_AUTH_INTENT_KEY,
} from '@/constants/storageKeys';
import type {
  AuthGuardReason,
  AuthIntentHref,
  RequireAuthOptions,
} from '@/types/authGuard';

export type { AuthGuardReason, AuthIntentHref, RequireAuthOptions };

type PendingAuthIntent = {
  reason: AuthGuardReason;
  message?: string;
  href?: AuthIntentHref;
  params?: Record<string, string>;
  onAuthorized?: () => void;
};

type AuthGuardContextType = {
  requireAuth: (options?: RequireAuthOptions) => boolean;
  enterGuestMode: () => Promise<void>;
  openLogin: (options?: { message?: string; mode?: 'login' | 'register' }) => void;
};

const AuthGuardContext = createContext<AuthGuardContextType | undefined>(undefined);

export function AuthGuardProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [gateVisible, setGateVisible] = useState(false);
  const [loginVisible, setLoginVisible] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');
  const [reason, setReason] = useState<AuthGuardReason>('generic');
  const [customMessage, setCustomMessage] = useState<string | undefined>();

  const pendingRef = useRef<PendingAuthIntent | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PENDING_AUTH_INTENT_KEY);
        if (!raw || cancelled || pendingRef.current) return;
        const parsed = JSON.parse(raw) as {
          href?: string;
          params?: Record<string, string> | null;
          reason?: AuthGuardReason;
        };
        if (parsed?.href) {
          pendingRef.current = {
            reason: parsed.reason || 'generic',
            href: parsed.href,
            params: parsed.params ?? undefined,
          };
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistIntent = useCallback(async (intent: PendingAuthIntent | null) => {
    try {
      if (!intent?.href) {
        await AsyncStorage.removeItem(PENDING_AUTH_INTENT_KEY);
        return;
      }
      await AsyncStorage.setItem(
        PENDING_AUTH_INTENT_KEY,
        JSON.stringify({ href: intent.href, params: intent.params ?? null, reason: intent.reason }),
      );
    } catch {
      /* non bloquant */
    }
  }, []);

  const clearPending = useCallback(() => {
    pendingRef.current = null;
    void persistIntent(null);
  }, [persistIntent]);

  const consumePending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    void persistIntent(null);
    setGateVisible(false);
    setLoginVisible(false);

    const { href, params, onAuthorized } = pending;
    setTimeout(() => {
      onAuthorized?.();
      if (href) {
        if (params) {
          router.push({ pathname: href, params } as never);
        } else {
          router.push(href as never);
        }
      }
    }, 60);
  }, [persistIntent, router]);

  useEffect(() => {
    if (isLoading || !user) return;
    if (!pendingRef.current) return;
    consumePending();
  }, [user, isLoading, consumePending]);

  const requireAuth = useCallback(
    (options: RequireAuthOptions = {}): boolean => {
      if (user) return true;

      const intent: PendingAuthIntent = {
        reason: options.reason ?? 'generic',
        message: options.message,
        href: options.href,
        params: options.params,
        onAuthorized: options.onAuthorized,
      };
      pendingRef.current = intent;
      void persistIntent(intent);
      setReason(intent.reason);
      setCustomMessage(intent.message);
      setLoginMode('login');
      setLoginVisible(false);
      setGateVisible(true);
      return false;
    },
    [persistIntent, user],
  );

  const enterGuestMode = useCallback(async () => {
    await AsyncStorage.multiSet([
      [INTRO_SEEN_KEY, 'true'],
      [GUEST_MODE_KEY, 'true'],
    ]);
    router.replace('/(tabs)');
  }, [router]);

  const openLogin = useCallback(
    (options?: { message?: string; mode?: 'login' | 'register' }) => {
      if (options?.message) setCustomMessage(options.message);
      setLoginMode(options?.mode ?? 'login');
      setGateVisible(false);
      setLoginVisible(true);
    },
    [],
  );

  const handleCloseGate = useCallback(() => {
    setGateVisible(false);
    clearPending();
  }, [clearPending]);

  const handleCloseLogin = useCallback(() => {
    setLoginVisible(false);
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setLoginVisible(false);
    setGateVisible(false);
    void AsyncStorage.setItem(GUEST_MODE_KEY, 'false');
    // `user` se met à jour via onAuthStateChanged → consumePending
  }, []);

  const value = useMemo<AuthGuardContextType>(
    () => ({ requireAuth, enterGuestMode, openLogin }),
    [requireAuth, enterGuestMode, openLogin],
  );

  return (
    <AuthGuardContext.Provider value={value}>
      {children}
      <AuthRequiredModal
        visible={gateVisible}
        reason={reason}
        message={customMessage}
        onClose={handleCloseGate}
        onSignIn={() => openLogin({ mode: 'login', message: customMessage })}
        onRegister={() => openLogin({ mode: 'register', message: customMessage })}
      />
      <LoginModal
        visible={loginVisible}
        onClose={handleCloseLogin}
        onLoginSuccess={handleLoginSuccess}
        infoMessage={customMessage}
        initialMode={loginMode}
      />
    </AuthGuardContext.Provider>
  );
}

export function useRequireAuth(): AuthGuardContextType {
  const context = useContext(AuthGuardContext);
  if (context === undefined) {
    throw new Error('useRequireAuth must be used within an AuthGuardProvider');
  }
  return context;
}
