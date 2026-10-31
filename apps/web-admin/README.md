# ASSMA Web Admin

Back-office **web** pour la gestion ASSMA (tableau de bord, fournisseurs, commandes, produits).

- Même projet **Firebase** que l’app mobile
- Mêmes comptes **admin / super-admin**
- **Aucun rebuild** de l’app mobile (iOS/Android) requis

## Démarrer en local

```bash
cd apps/web-admin
npm install
npm run dev
```

Ouvrir l’URL affichée (ex. `http://localhost:5173`), se connecter avec un compte `super-admin` ou `admin`.

## Déployer (sans toucher au mobile)

Build statique :

```bash
npm run build
```

Le dossier `dist/` peut être hébergé sur :

- Firebase Hosting
- Vercel / Netlify
- Cloudflare Pages
- n’importe quel hébergeur de fichiers statiques

Exemple Firebase Hosting (une fois le site configuré) :

```bash
firebase deploy --only hosting
```

Après déploiement, ajouter le domaine dans Firebase Console → Authentication → Settings → **Authorized domains**.

## Périmètre actuel

| Page | Actions |
|------|---------|
| Tableau de bord | Stats + valider vérifications en attente |
| Fournisseurs | Valider / Suspendre / Supprimer |
| Commandes | Liste temps réel + avancer le statut |
| Produits | Liste + supprimer |

## Périmètre actuel (aligné Super Admin mobile)

| Page | Actions |
|------|---------|
| Tableau de bord | Stats, menu, vérifications, activité récente |
| Fournisseurs | Valider / Suspendre / Supprimer / Ajouter / Dossier |
| Vendeurs | Activer / Suspendre |
| Produits | Créer, **modifier**, supprimer, photos |
| Commandes | Liste temps réel, détail, avancer le statut |
| Support | Tickets → marquer résolu |
| Analytiques | CA, commandes, graphique |
| Push promo | Cloud Function `sendProductPromoBroadcast` |
| Import Alibaba | Publier une fiche depuis un lien + image |
