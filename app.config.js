export default {
  expo: {
    name: "A2Express", 
    slug: "assma-express",
    // ✅ CHANGEMENT : Passer à 1.0.4 (supérieur à 1.0.3)
    version: "1.0.4", 
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
      url: "https://u.expo.dev/bb3399ba-97b7-4707-80eb-b524775df88a"
    },
    runtimeVersion: {
      policy: "appVersion"
    },

    android: {
      package: "com.askia1.assmaexpress",
      // ✅ CRUCIAL : Passer à 5 (Le code 4 est déjà utilisé sur le Store)
      versionCode: 5, 
      softwareKeyboardLayoutMode: "pan",
      supportsRtl: false, 
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      permissions: [
        "CAMERA", "RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS",
        "INTERNET", "ACCESS_NETWORK_STATE", "ACCESS_WIFI_STATE", "WAKE_LOCK"
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
      // ✅ OPTIONNEL : Aligner le buildNumber sur Android
      buildNumber: "5",
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