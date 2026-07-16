const path = require("path");
const { resolve: metroDefaultResolve } = require("metro-resolver");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

/** Désactivé comme avant ce dépôt (compat. certaines deps) ; avec Sentry, les imports relatifs `./constants` dans `dist/js/profiling/` peuvent échouer — voir resolveRequest ci-dessous. */
config.resolver.unstable_enablePackageExports = false;

const baseExts = config.resolver.sourceExts || [];
config.resolver.sourceExts = [...new Set([...baseExts, "cjs", "mjs"])];

const isWeb = process.argv.includes("--web");

config.resolver.alias = {
  ...(config.resolver.alias || {}),
  "@": path.resolve(__dirname, "src"),
  "@components": path.resolve(__dirname, "src/components"),
  "@screens": path.resolve(__dirname, "src/screens"),
  "@services": path.resolve(__dirname, "src/services"),
  "@config": path.resolve(__dirname, "src/config"),
  "@hooks": path.resolve(__dirname, "src/hooks"),
  "@contexts": path.resolve(__dirname, "src/contexts"),
  "@assets": path.resolve(__dirname, "src/assets"),
  "@utils": path.resolve(__dirname, "src/utils"),
  "@types": path.resolve(__dirname, "src/types"),
  ...(isWeb
    ? {
        "react-native-webrtc": path.resolve(
          __dirname,
          "react-native-webrtc.web.js"
        ),
      }
    : {}),
};

/** Correctif Metro : résolution explicite de `./constants` dans le profiling Hermes (@sentry/react-native ≥7). */
const sentryProfilingConstants = path.join(
  __dirname,
  "node_modules",
  "@sentry",
  "react-native",
  "dist",
  "js",
  "profiling",
  "constants.js"
);
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (ctx, moduleName, platform, ...rest) => {
  const origin = ctx?.originModulePath?.replace(/\\/g, "/") ?? "";
  if (
    (moduleName === "./constants" || moduleName === "./constants.js") &&
    origin.includes("@sentry/react-native/dist/js/profiling/")
  ) {
    return { type: "sourceFile", filePath: sentryProfilingConstants };
  }
  if (typeof upstreamResolveRequest === "function") {
    return upstreamResolveRequest(ctx, moduleName, platform, ...rest);
  }
  return metroDefaultResolve(ctx, moduleName, platform);
};

module.exports = config;
