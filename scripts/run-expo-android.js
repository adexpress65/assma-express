/**
 * Sous Windows, les builds CMake/Ninja (new arch) échouent souvent si le chemin du projet
 * dépasse ~260 caractères. Une jonction (junction) vers un chemin court évite ce problème.
 *
 * Variable d'environnement EXPO_ANDROID_NO_JUNCTION=1 pour désactiver et utiliser le chemin normal.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = path.resolve(__dirname, "..");
const extraArgs = process.argv.slice(2);

function runExpo(cwd) {
  const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
  return spawnSync(cmd, ["expo", "run:android", ...extraArgs], {
    cwd,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
}

if (process.platform !== "win32" || process.env.EXPO_ANDROID_NO_JUNCTION === "1") {
  const r = runExpo(projectRoot);
  process.exit(r.status ?? 1);
}

/** Nom de junction dérivé du chemin (évite collisions entre clones). */
const tag = crypto.createHash("sha1").update(projectRoot.toLowerCase()).digest("hex").slice(0, 12);
const junctionName = `A2E_${tag}`;
const junctionPath = path.join("C:\\", junctionName);

/** PATH minimal dans certains environnements npm/Cursor : ne pas compter sur `cmd` dans le PATH. */
const cmdExe = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "cmd.exe");

function pathsEqual(a, b) {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch {
    return false;
  }
}

function ensureJunction() {
  if (fs.existsSync(junctionPath)) {
    if (pathsEqual(projectRoot, junctionPath)) {
      return junctionPath;
    }
    console.error(
      `[run-expo-android] ${junctionPath} existe déjà et ne pointe pas vers ce projet.`,
    );
    console.error("Supprimez la jonction ou définissez EXPO_ANDROID_NO_JUNCTION=1.");
    process.exit(1);
  }
  try {
    const mk = spawnSync(cmdExe, ["/c", "mklink", "/J", junctionPath, projectRoot], {
      stdio: "inherit",
      windowsHide: true,
    });
    if (mk.status !== 0) {
      throw new Error(`mklink exit ${mk.status}`);
    }
  } catch {
    console.error(
      "[run-expo-android] mklink /J a échoué (essayez d'exécuter le terminal en administrateur),",
    );
    console.error("ou déplacez le dossier vers un chemin court (ex. C:\\dev\\assma),");
    console.error("ou activez les chemins longs Windows et remplacez ninja.exe du SDK CMake par la v1.12+.");
    process.exit(1);
  }
  return junctionPath;
}

console.log(
  `[run-expo-android] Jonction Windows (chemins Ninja/CMake) : ${junctionPath} -> projet`,
);
const cwd = ensureJunction();

const r = runExpo(cwd);
process.exit(r.status ?? 1);
