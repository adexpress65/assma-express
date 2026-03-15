export default {
  expo: {
    name: "A2Express",
    slug: "assma-express",
    // ✅ PASSAGE EN 1.0.5 (La 1.0.4 existe déjà sur ton store)
    version: "1.0.5",
    orientation: "portrait",
    userInterfaceStyle: "light",
    jsEngine: "hermes",
    scheme: "assmaexpress",

    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
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
      "expo-notifications"
    ],

    android: {
      package: "com.askia1.assmaexpress",
      // ✅ LIEN NATIF VERS FIREBASE
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
      // ✅ VERSION 6 (Supérieure à la version 5 vue sur ta capture)
      versionCode: 6,
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
        "VIBRATE"
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
      // ✅ ALIGNÉ SUR ANDROID
      buildNumber: "6",
      supportsRtl: false,
      infoPlist: {
        NSPhotoLibraryUsageDescription: "L'application a besoin d'accéder à vos photos.",
        NSCameraUsageDescription: "L'application a besoin d'accéder à votre caméra.",
        NSMicrophoneUsageDescription: "L'application a besoin d'accéder à votre microphone.",
        CFBundleURLTypes: [{ CFBundleURLSchemes: ["assmaexpress"] }]
      }
    },

    extra: {
      API_BASE_URL: "https://ngenius-backend.onrender.com",
      REALTIME_URL: "https://ngenius-backend.onrender.com",
      eas: { projectId: "bb3399ba-97b7-4707-80eb-b524775df88a" }
    }
  }
};