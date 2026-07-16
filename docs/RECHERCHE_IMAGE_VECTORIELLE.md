# Recherche par image (CLIP + Firestore)

## Architecture

1. **Produits** : documents Firestore `products/{productId}` (source de vérité).
2. **Embeddings** : collection `product_image_embeddings/{productId}` avec champ `embedding` (tableau de 512 nombres, L2-normalisé), `modelId`, `sourceImageUrl`, `updatedAt`.
3. **Recherche texte** : inchangée côté Algolia (index `products`, synchro via `onProductWrite`).
4. **Recherche image** : la Cloud Function `visualImageSearch` (HTTPS, région `europe-west1`) :
   - reçoit `imageBase64` + `mimeType` + `limit` (défaut 20) ;
   - calcule l’embedding CLIP de la requête (`@xenova/transformers`, modèle `Xenova/clip-vit-base-patch32`) ;
   - charge tous les embeddings depuis Firestore ;
   - calcule la **similarité cosinus** (produit scalaire sur vecteurs normalisés) ;
   - retourne les **top-k** `productId` puis hydrate les champs depuis `products/`.

Aucun passage par des mots-clés ni par Algolia pour le classement image.

## Pourquoi l’ancien système échouait

- L’API Express + Prisma indexait un **pseudo-vecteur texte** (hash de tokens) et **ne lisait qu’un sous-ensemble** d’articles (`take: 500`) avec des **seuils sur score** : beaucoup de produits n’étaient jamais candidats.
- Le mobile mélangeait **Algolia filtré par catégories déduites du texte Gemini** : si la catégorie ou les facettes ne correspondaient pas, **zéro ou peu de résultats** alors que le produit existait dans Firestore.
- Les flux **Firestore vs Prisma** divergeaient : un ID pouvait exister d’un côté seulement.

## Déploiement

```bash
cd functions
npm install
npm run build
firebase deploy --only functions:visualImageSearch
```

Rendre la fonction **invocable publiquement** (IAM) ou protéger par App Check / auth selon votre politique.

## Indexation des images existantes

Sur une machine avec accès au projet Firebase (compte de service ou `gcloud auth application-default login`) :

```bash
cd functions
npm run build
set GOOGLE_APPLICATION_CREDENTIALS=C:\chemin\vers\cle.json
node lib/backfillEmbeddings.js
```

Le script ne traite que les produits dont l’URL d’image est **HTTP(S) absolue** (`mainImage`, `imageUrl` ou `image`).

## Application mobile

- `searchVisualImageVector` dans `src/services/visualSearchApi.ts` appelle l’URL (Expo `extra.visualImageSearchUrl` ou `EXPO_PUBLIC_VISUAL_IMAGE_SEARCH_URL`).
- Le **base64 n’est pas** passé dans les params Expo Router (trop volumineux). Le flux lit l’image via **`getBase64FromImageUri(imageUri)`** (copie locale + `expo-file-system`) puis appelle la Cloud Function.
- `PremiumHeader` envoie `imageUri`, `imageMimeType`, `visualSearchPayload` ; la barre de recherche peut afficher le texte Gemini (**affichage seul**) sans piloter le classement si la recherche vectorielle a bien l’image.
- Les résultats CLIP sont triés **uniquement par `visualScore`** (`publish(..., clipPureRanking)`), sans re-scoring texte / Gemini.

## Passage à un vrai moteur vectoriel (Pinecone, pgvector, etc.)

Dès que le catalogue dépasse quelques milliers de produits, remplacez le scan mémoire de tous les embeddings dans `visualSearchCore.ts` par une requête **ANN** (approximate nearest neighbors) sur votre base externe, en gardant le même contrat : embedding requête → liste d’ids → lecture Firestore `products`.
