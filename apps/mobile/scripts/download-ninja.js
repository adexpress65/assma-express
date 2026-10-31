/**
 * Télécharge ninja 1.12.1 (Windows) dans tools/ninja.exe — évite l’erreur Ninja
 * "Filename longer than 260 characters" avec le binaire 1.10 du SDK CMake.
 * Exécution synchrone (adapté à npm postinstall). macOS/Linux : no-op.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const ZIP_URL =
  "https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip";
const OUT = path.join(__dirname, "..", "tools", "ninja.exe");

function main() {
  if (process.platform !== "win32") {
    return;
  }
  if (fs.existsSync(OUT) && fs.statSync(OUT).size > 50_000) {
    return;
  }

  const toolsDir = path.dirname(OUT);
  fs.mkdirSync(toolsDir, { recursive: true });

  const tmpDir = path.join(os.tmpdir(), `ninja-win-${process.pid}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const zipPath = path.join(tmpDir, "ninja-win.zip");

  const curlExe = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "curl.exe");
  const psExe = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );

  try {
    console.log("[download-ninja] Téléchargement de Ninja 1.12.1 (Windows)…");
    if (!fs.existsSync(curlExe)) {
      throw new Error("curl.exe introuvable (Windows récent requis)");
    }
    const dl = spawnSync(
      curlExe,
      ["-L", "-o", zipPath, ZIP_URL],
      { stdio: "inherit", windowsHide: true },
    );
    if (dl.status !== 0) {
      throw new Error(`curl exit ${dl.status}`);
    }

    const ex = spawnSync(
      psExe,
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${tmpDir.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: "inherit", windowsHide: true },
    );
    if (ex.status !== 0) {
      throw new Error(`Expand-Archive exit ${ex.status}`);
    }

    const extracted = path.join(tmpDir, "ninja.exe");
    if (!fs.existsSync(extracted)) {
      throw new Error("ninja.exe absent après extraction");
    }
    fs.copyFileSync(extracted, OUT);
    console.log("[download-ninja] OK :", OUT);
  } catch (e) {
    console.warn("[download-ninja] Échec — relancez : npm run ninja:download");
    console.warn("[download-ninja]", e.message);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main();
