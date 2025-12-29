// services/categoriesService.ts
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";

export interface Category {
  id: string;
  name: string;
  image?: string;
}

export async function getCategories(): Promise<Category[]> {
  try {
    const ref = collection(db, "categories");
    const snap = await getDocs(ref);

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Category[];
  } catch (error) {
    console.error("Erreur Firestore (getCategories):", error);
    return [];
  }
}
