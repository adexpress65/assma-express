/** * Clé Gemini injectée au build (EAS / local) — voir commentaire dans `extra.geminiApiKey`. 
 */
function readGeminiApiKeyForBuild() {
  return String(
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      "",
  ).trim();
}

const expoConfig = {
  expo: {
    name: "A2Express",
    slug: "assma-express",
    // ✅ PASSAGE EN 1.0.10 (build store : auth téléphone + correctifs)
    version: "1.0.10",
    orientation: "portrait",
    userInterfaceStyle: "light",
    jsEngine: "hermes",
    scheme: "assmaexpress",

    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      // Doit matcher SplashLogo + app/index.tsx (#ffffff) pour un handoff sans flash.
      backgroundColor: "#ffffff"
    },

    updates: {
      url: "https://u.expo.dev/bb3399ba-97b7-4707-80eb-b524775df88a",
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 30000
    },
    runtimeVersion: {
      policy: "appVersion"
    },

    // ✅ PLUGINS REQUIS POUR NOTIFICATIONS ET ROUTAGE
    plugins: [
      "expo-router",
      "expo-notifications",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "A2Express utilise votre position pour préremplir votre adresse (livraison ou boutique).",
        },
      ],
      /**
       * Sentry : upload des source maps / symboles au build EAS natif.
       * Sur expo.dev → Project secrets : SENTRY_AUTH_TOKEN
       * Variables de build : SENTRY_ORG, SENTRY_PROJECT (slug Sentry.io)
       */
      [
        "@sentry/react-native/expo",
        {
          url: "https://sentry.io/",
          organization: process.env.SENTRY_ORG ?? "",
          project: process.env.SENTRY_PROJECT ?? "",
        },
      ],
    ],

    android: {
      package: "com.askia1.assmaexpress",
      // ✅ LIEN NATIF VERS FIREBASE
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
      // ✅ Doit être > 16 (dernier binaire Play Store)
      versionCode: 17,
      softwareKeyboardLayoutMode: "pan",
      supportsRtl: false,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      permissions: [
        "CAMERA",
        "RECORD_AUDIO",
        "MODIFY_AUDIO_SETTINGS",
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "ACCESS_WIFI_STATE",
        "WAKE_LOCK",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION"
      ],
      intentFilters: [
        {
          action: "VIEW",
          category: ["BROWSABLE", "DEFAULT"],
          data: [{ scheme: "assmaexpress" }]
        }
      ]
    },

    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.askia1.assmaexpress",
      // ✅ Doit être > 17 (dernier binaire App Store)
      buildNumber: "18",
      supportsRtl: false,
	  googleServicesFile: "./google-services-ios.json",
	  // 🔴 AJOUT CRUCIAL DES ENTITLEMENTS POUR APPLE SIGN-IN
      entitlements: {
        "com.apple.developer.applesignin": ["Default"]
      },
      infoPlist: {
        NSPhotoLibraryUsageDescription: "A2Express nécessite l'accès à votre galerie pour vous permettre de choisir une photo de profil ou d'importer des images de vos colis.",
        NSCameraUsageDescription: "A2Express nécessite l'accès à votre appareil photo pour vous permettre de prendre en photo vos colis ou de scanner des codes-barres.",
        NSMicrophoneUsageDescription: "A2Express nécessite l'accès à votre microphone pour vous permettre d'enregistrer des notes vocales destinées au support client.",
        NSLocationWhenInUseUsageDescription:
          "A2Express utilise votre position pour préremplir votre adresse de livraison ou boutique.",
        CFBundleURLTypes: [{ CFBundleURLSchemes: ["assmaexpress"] }]
      }
    },

    extra: {
      API_BASE_URL: "https://ngenius-backend.onrender.com",
      REALTIME_URL: "https://ngenius-backend.onrender.com",
      /**
       * Clé Gemini embarquée au moment du build.
       * Lu depuis les variables d'environnement Expo (Plain text) que tu viens de configurer.
       */
      geminiApiKey: readGeminiApiKeyForBuild(),
      visualImageSearchUrl:
        process.env.EXPO_PUBLIC_VISUAL_IMAGE_SEARCH_URL ||
        "https://europe-west1-assma-expresse.cloudfunctions.net/visualImageSearch",
      eas: { projectId: "bb3399ba-97b7-4707-80eb-b524775df88a" },
      /** DSN public Sentry — aussi disponible via process.env.EXPO_PUBLIC_SENTRY_DSN au runtime */
      sentryDsn:
        process.env.EXPO_PUBLIC_SENTRY_DSN ??
        process.env.SENTRY_DSN ??
        ""
    }
  }
};

if (process.env.EAS_BUILD === "true" && !readGeminiApiKeyForBuild()) {
  console.warn(
    "[EAS Build] Clé Gemini absente : vérifiez vos variables d'environnement sur expo.dev",
  );
}

export default expoConfig;