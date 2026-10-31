import { useEffect, useState, useCallback } from "react";
import { db } from "@/src/config/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

export function useFlashDeals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDeals = useCallback(() => {
    const ref = collection(db, "flashDeals");
    const q = query(ref, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDeals(list);
        setLoading(false);
      },
      (err) => {
        console.log("Erreur Firestore useFlashDeals:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, []);

  useEffect(() => {
    const unsub = loadDeals();
    return () => unsub();
  }, []);

  return { deals, loading, reload: loadDeals };
}
