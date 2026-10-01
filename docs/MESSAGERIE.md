# Messagerie A2Express

Toute création de `conversations/{id}` passe par `apps/mobile/src/services/conversationRouting.ts`.

| Type | Destinataire | Participants |
|---|---|---|
| `customer_to_store` | propriétaire société (`ownerUid`, `ownerId`, `sellerUid`, `uid`), jamais le support. Un sellerId produit n’est pris que s’il est l’un de ces propriétaires. | `[clientUid, sellerUid]` |
| `seller_to_customer` | même propriétaire (colis / commande) | `[clientUid, sellerUid]` |
| `customer_to_support` | `SUPPORT_INBOX_UID` | `[clientUid, SUPPORT_INBOX_UID]` |

Un fil déjà créé n’est pas réécrit par le client. `sendMessage` fait `updateDoc` (pas de `setDoc` merge). Les règles Firestore refusent une création sans `conversationKind` valide, avec des participants incorrects, si l’auteur n’est pas participant, ou si un fil boutique n’a pas le propriétaire de la société (le super-admin n’est jamais destinataire boutique).

Les anciens écrans `/messages`, `/chat` et `/product-chat` redirigent vers l’onglet Messages. Les seeds (`seedConversations.ts`, `seedMessages.ts`) s’arrêtent sans `FIRESTORE_EMULATOR_HOST` et `MESSAGING_SEED_OK=1`.

## Tests

```
cd apps/mobile
npm run test:critical

cd ../..
npm run test:messaging-rules
```

Le test des règles lance l’émulateur Firestore. Il faut `firebase-tools` et un JDK 21 (la CLI récente refuse Java 17).

## Migration (dry-run d’abord)

```
cd scripts
npx tsx migrate-conversation-routing.ts
npx tsx migrate-conversation-routing.ts --execute
```

Puis déployer les règles : `firebase deploy --only firestore:rules`. Les Cloud Functions de messagerie n’ont pas changé de contrat. Fusionner `fix/messagerie-routage` (app) et `fix/messagerie-routage-monorepo` dans `principal` seulement après la migration réelle, puis publier une nouvelle version de l’app.
