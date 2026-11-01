# ASSMA Mobile Application

Cette application mobile cross-platform (iOS & Android) est développée avec **React Native** et **Expo** (Expo Router). Elle sert de vitrine et de plateforme opérationnelle pour les activités d'ASSMA.

## 🛠️ Stack Technique

- **Framework :** React Native & Expo (Managed Workflow)
- **Navigation :** Expo Router (File-based routing)
- **Base de données & Authentification :** Firebase (Firestore, Auth, Storage)
- **Langage :** TypeScript

---

## 🚀 Installation et Démarrage en Local

### 1. Prérequis
Assurez-vous d'avoir installé sur votre machine :
- **Node.js** (Version LTS recommandée, v18 ou v20)
- **npm** ou **yarn**
- **Expo Go** installé sur votre appareil mobile (pour les tests rapides)

### 2. Cloner le projet
```bash
git clone <URL_DU_DEPOT_GIT>
cd assma
```

### 3. Installer les dépendances
```bash
cd apps/mobile
npm install
# OU
yarn install
```

### 4. Configuration Firebase
Les configurations Firebase sont déjà intégrées dans le projet (fichier `src/config/firebase.ts`).

### 5. Lancer l'application en développement
```bash
# Démarrer le serveur Expo
npm start
# OU
npx expo start
```

Depuis le terminal, scannez le QR code avec **Expo Go** sur votre mobile (iOS : Camera app, Android : Expo Go app) ou lancez sur un émulateur.

---

## 📁 Structure du Projet
```
assma/
├── apps/
│   └── mobile/              # Application mobile principale
│       ├── app/            # Routes Expo Router (file-based)
│       ├── src/            # Code source
│       │   ├── components/ # Composants réutilisables
│       │   ├── contexts/   # Contextes React (Auth, Messages, Cart...)
│       │   ├── hooks/      # Hooks personnalisés
│       │   ├── services/   # Services métier (Firebase, API...)
│       │   ├── config/     # Configurations (Firebase, Env...)
│       │   └── utils/      # Fonctions utilitaires
│       └── assets/         # Images, animations, etc.
├── api-payments/           # Backend paiements (optionnel)
└── assma-backend/          # Backend principal (optionnel)
```

---

## 🔒 Sécurité
- Les fichiers de configuration sensibles (clés API, service accounts) sont **ignorés par Git** (via `.gitignore`)
- Les variables d'environnement Expo utilisent le préfixe `EXPO_PUBLIC_` pour les variables exposées au client
- Les console.log de débogage ont été nettoyés pour la production

---

## 📋 Scripts Disponibles (dans `apps/mobile/`)
| Commande               | Description                                  |
|------------------------|----------------------------------------------|
| `npm start`            | Démarrer le serveur Expo                     |
| `npm run android`      | Lancer sur émulateur Android                 |
| `npm run ios`          | Lancer sur simulateur iOS (macOS seulement)  |
| `npm run web`          | Lancer sur navigateur web                    |
| `npx expo build:android` | Build APK/AAB pour Android                  |
| `npx expo build:ios`     | Build IPA pour iOS                          |

---

## 📄 Licence
ASSMA - Tous droits réservés

---

## 🛠️ Développement & Propriété Intellectuelle

Cette application a été entièrement conçue, développée et optimisée de bout en bout par :
* **Développeur Principal** : `https://github.com/AskiaMohamed22` (NEXYORA)
* **Contact** : salambereaskiamohamed@gmail.com

*Tous droits de reproduction du code source réservés à l'auteur initial.*

---

## Clés et secrets du projet

Le fichier **`_secrets/assma-express-cles.zip`** contient toutes les clés et tous les secrets nécessaires pour faire tourner le projet : fichiers `.env`, clés Firebase Admin, compte Google Play, `google-services.json`, keystore Android, etc. **Ce ZIP n’a pas de mot de passe.**

### Comment l’utiliser

1. Télécharger `_secrets/assma-express-cles.zip` depuis ce dépôt.
2. Le décompresser **à la racine du projet** (le dossier qui contient `apps/`, `ngenius-backend/` et ce README), pour que chaque fichier retrouve son emplacement.
3. Lire `LISEZMOI.txt` à l’intérieur du ZIP : il indique le rôle de chaque fichier et où le recopier.
4. Si un fichier `.env` manque encore, copier le `.env.example` du même dossier vers `.env`.
5. Installer les dépendances :
   ```bash
   cd apps/mobile && npm install
   cd ../../ngenius-backend && npm install
   cd ../signaling-server && npm install
   cd ../apps/web-admin && npm install
   ```

### Keystore Android (très important)

Sans le keystore (fichier `.jks`) et le fichier `credentials.json`, **impossible de publier une mise à jour** de l’application sur le Play Store. Gardez-les en sûreté, faites une copie hors de cet ordinateur, et ne les perdez pas.

### Régénérer les clés dès que possible

Les clés Firebase Admin et Google Play ont déjà existé dans l’historique GitHub. Dès que vous avez récupéré le projet, **créez de nouvelles clés** dans la console Firebase et Google Play, puis remplacez les anciennes. Révoquez les anciennes.

### Avertissement

- **Ne jamais rendre ce dépôt public.**
- **Ne jamais ajouter de collaborateur** tant que les clés n’ont pas été régénérées.
- Ne commitez jamais les fichiers de clés en vrac (`.env`, `.jks`, `serviceAccount*.json`) : seul ce ZIP de remise est prévu pour ça.
