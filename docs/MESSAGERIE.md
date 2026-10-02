# Messagerie A2Express

Toute création de `conversations/{id}` passe par `apps/mobile/src/services/conversationRouting.ts`.

| Type | Destinataire | Participants |
|---|---|---|
| `customer_to_store` | propriétaire société : `ownerUid`, `ownerId` ou `sellerUid` s’il existe ; sinon le compte dont l’id est l’id du document boutique (même si `uid` a été écrasé) ; sinon `uid` seulement s’il est ce compte. Le compte support n’est destinataire boutique que s’il est lui-même ce compte. Un sellerId produit n’est pris que s’il est ce propriétaire. | `[clientUid, sellerUid]` |
| `seller_to_customer` | même propriétaire (colis / commande) | `[clientUid, sellerUid]` |
| `customer_to_support` | `SUPPORT_INBOX_UID` | `[clientUid, SUPPORT_INBOX_UID]` |

Un fil déjà créé n’est pas réécrit par le client. `sendMessage` fait `updateDoc` (pas de `setDoc` merge). Les règles Firestore refusent une création sans `conversationKind` valide, avec des participants incorrects, ou si l’auteur n’est pas participant. Un fil boutique n’accepte que le propriétaire de cette boutique : le super-admin reçoit les clients de sa propre boutique, et ne reçoit pas ceux d’une autre. Le support (`customer_to_support`) reste un fil à part.

Une ancienne conversation, même sans `conversationKind`, reste utilisable : un participant peut y envoyer un message et mettre à jour le document (dernier message, non-lus). Les champs de routage déjà présents ne peuvent pas changer. Si `conversationKind` manque et que le vendeur déjà enregistré est le vrai propriétaire, l’envoi peut ajouter seulement ce champ. La création d’un nouveau fil reste stricte.

Les anciens écrans `/messages`, `/chat` et `/product-chat` redirigent vers l’onglet Messages. Les seeds (`seedConversations.ts`, `seedMessages.ts`) s’arrêtent sans `FIRESTORE_EMULATOR_HOST` et `MESSAGING_SEED_OK=1`.

## Tests

```
cd apps/mobile
npm run test:critical

cd ../..
npm run test:messaging-rules
```

Le test des règles lance l’émulateur Firestore. Il faut `firebase-tools` et un JDK 21 (la CLI récente refuse Java 17).

## Mise en production

L’OTA suffit (channel `production`, app déjà en 1.0.10). Ordre : OTA, puis règles, puis sauvegarde, puis migration.

```
cd apps/mobile
eas update --channel production --message "Messagerie : le client parle au vendeur"

cd ../..
firebase deploy --only firestore:rules --project assma-expresse

cd scripts
npx tsx migrate-conversation-routing.ts --backup
npx tsx migrate-conversation-routing.ts --execute
npx tsx migrate-conversation-routing.ts --rollback
```

`--execute` refuse de tourner sans la sauvegarde. `--rollback` remet l’état noté dans le journal. La migration a déjà été exécutée : 51 fils corrigés, 6 laissés tels quels faute de propriétaire. Les 2 fils où le super-admin est le client ont été migrés avec les autres (il reste le client).

Un fil boutique déjà créé vers un `uid` de société écrasé, alors que l’id du document est le compte du propriétaire, se répare à part. Ne pas relancer la migration générale.

```
cd c:\Dev\assma
npx tsx scripts/repair-store-account-owner.ts --backup
npx tsx scripts/repair-store-account-owner.ts
npx tsx scripts/repair-store-account-owner.ts --execute
```
