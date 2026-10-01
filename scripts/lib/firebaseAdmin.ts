import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const here = dirname(fileURLToPath(import.meta.url));
const scriptsDir = join(here, "..");
const rootDir = join(scriptsDir, "..");

function resolveCredentialPath(): string | null {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const candidates = [
    envPath,
    join(scriptsDir, "serviceAccount.json"),
    join(scriptsDir, "serviceAccountKey.json"),
    join(rootDir, "assma-expresse-firebase-adminsdk-fbsvc-b87148844b.json"),
    join(rootDir, "serviceAccountKey.json"),
  ].filter((p): p is string => Boolean(p));

  return candidates.find((p) => existsSync(p)) ?? null;
}

export function initAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const credPath = resolveCredentialPath();
  if (credPath) {
    const sa = JSON.parse(readFileSync(credPath, "utf8"));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    console.log("Admin SDK : certificat →", credPath);
  } else {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    console.log("Admin SDK : Application Default Credentials");
  }

  return admin.app();
}
