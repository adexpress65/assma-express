import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import {
  canAccessAdmin,
  canAccessSuperAdmin,
  resolveAuthorizedRole,
  type UserRole,
} from "../lib/roles";

type AuthState = {
  user: User | null;
  role: UserRole;
  displayName: string | null;
  loading: boolean;
  error: string | null;
  allowed: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>("visitor");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setError(null);
      try {
        if (!firebaseUser) {
          setUser(null);
          setRole("visitor");
          setDisplayName(null);
          return;
        }
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        const data = snap.exists() ? snap.data() : {};
        const nextRole = await resolveAuthorizedRole(firebaseUser, data?.role);
        setUser(firebaseUser);
        setRole(nextRole);
        setDisplayName(
          (data?.displayName as string) ||
            firebaseUser.displayName ||
            firebaseUser.email,
        );
        if (!canAccessAdmin(nextRole)) {
          setError(
            "Accès réservé aux comptes admin / super-admin. Déconnexion…",
          );
          await signOut(auth);
          setUser(null);
          setRole("visitor");
        }
      } catch (e) {
        console.error(e);
        setError("Impossible de charger le profil utilisateur.");
        setUser(null);
        setRole("visitor");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      role,
      displayName,
      loading,
      error,
      allowed: !!user && canAccessAdmin(role),
      isSuperAdmin: canAccessSuperAdmin(role),
      isAdmin: role === "admin",
      login: async (email, password) => {
        setError(null);
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      logout: async () => {
        await signOut(auth);
      },
    }),
    [user, role, displayName, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
