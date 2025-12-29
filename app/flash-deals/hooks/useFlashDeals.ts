import { useEffect, useState, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../src/config/firebase";

export function useFlashDeals() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(["all"]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "flashDeals"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      setProducts(data);

      const uniqueCats = [
        "all",
        ...new Set(data.map((p) => p.category).filter(Boolean)),
      ];

      setCategories(uniqueCats);
    } catch (e) {
      console.log("FlashDeals error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, []);

  return {
    loading,
    refreshing,
    products,
    categories,
    selectedCategory,
    setSelectedCategory,
    onRefresh,
  };
}