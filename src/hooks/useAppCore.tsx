import {
  useState,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { db, auth } from "../config/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

const AppContext = createContext<any>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState({
    products: [],
    userProfile: null,
    loading: true,
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "products"),
      where("companyId", "==", user.uid),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const pList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setData((prev) => ({ ...prev, products: pList, loading: false }));
    });

    return () => unsub();
  }, []);

  return (
    <AppContext.Provider value={data}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppCore = () => useContext(AppContext);
