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
