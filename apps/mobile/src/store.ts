/**
 * @deprecated Ce store Redux n'est plus branché au routeur Expo principal.
 * La gestion du panier passe exclusivement par CartContext (src/contexts/CartContext.tsx).
 * Fichier conservé pour éviter les erreurs d'import dans les anciens points d'entrée
 * archivés (App.tsx, App_AllInOne*.tsx). À supprimer lors du nettoyage final.
 */
import { configureStore } from "@reduxjs/toolkit";
import cartReducer from "./slices/cartSlice";

export const store = configureStore({
  reducer: {
    cart: cartReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
