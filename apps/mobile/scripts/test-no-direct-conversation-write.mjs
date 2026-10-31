/**
 * Échoue si une création de document `conversations/{id}` existe
 * hors de conversationRouting.ts (seeds protégés autorisés).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { strict as assert } from "node:assert";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const ALLOWED = new Set([
  "apps/mobile/src/services/conversationRouting.ts",
  "apps/mobile/scripts/seedConversations.ts",
  "apps/mobile/scripts/seedMessages.ts",
]);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "lib",
  "coverage",
  ".expo",
  "android",
  "ios",
  "src_backup",
  "app_BackupOld",
]);

const PARENT_COLLECTION =
  /collection\s*\(\s*[^,()\n]+,\s*['"]conversations['"]\s*\)/g;
const PARENT_DOC =
  /doc\s*\(\s*[^,()\n]+,\s*['"]conversations['"]\s*,\s*[^,()\n]+\s*\)/g;
const ADMIN_ADD =
  /\.collection\s*\(\s*['"]conversations['"]\s*\)\s*\.add\s*\(/g;
const ADMIN_SET =
  /\.collection\s*\(\s*['"]conversations['"]\s*\)\s*\.doc\s*\([^;]*?\)\s*\.set\s*\(/g;

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => " ".repeat(block.length))
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|cjs)$/.test(name)) continue;
    out.push(full);
  }
}

function violationsIn(source) {
  const clean = stripComments(source);
  const hits = [];
  const note = (index, label) => hits.push(`${lineOf(source, index)}:${label}`);

  for (const match of clean.matchAll(PARENT_COLLECTION)) {
    const name = match[0];
    const assign = new RegExp(
      `(?:const|let|var)\\s+(\\w+)\\s*=\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    );
    const assigned = clean.match(assign);
    const varName = assigned?.[1];
    if (/addDoc\s*\(\s*collection\s*\(/.test(match[0]) || clean.slice(Math.max(0, match.index - 12), match.index).includes("addDoc")) {
      note(match.index, "addDoc collection conversations");
    }
    if (varName && new RegExp(`\\baddDoc\\s*\\(\\s*${varName}\\b`).test(clean)) {
      note(match.index, `addDoc(${varName})`);
    }
    if (varName && new RegExp(`\\bbatch\\.set\\s*\\(\\s*${varName}\\b`).test(clean)) {
      note(match.index, `batch.set(${varName})`);
    }
    if (/doc\s*\(\s*collection\s*\(/.test(clean.slice(Math.max(0, match.index - 8), match.index + 8))) {
      note(match.index, "doc(collection conversations)");
    }
  }

  for (const match of clean.matchAll(
    /addDoc\s*\(\s*collection\s*\(\s*[^,()\n]+,\s*['"]conversations['"]\s*\)/g,
  )) {
    note(match.index, "addDoc(collection conversations)");
  }

  for (const match of clean.matchAll(PARENT_DOC)) {
    const varAssign = clean
      .slice(Math.max(0, match.index - 80), match.index)
      .match(/(?:const|let|var)\s+(\w+)\s*=\s*$/);
    const around = clean.slice(match.index, match.index + match[0].length + 40);
    if (/setDoc\s*\(\s*doc\s*\(/.test(clean.slice(Math.max(0, match.index - 10), match.index + 8)) || clean.slice(Math.max(0, match.index - 10), match.index).includes("setDoc(")) {
      note(match.index, "setDoc(doc conversations)");
    }
    if (varAssign) {
      const varName = varAssign[1];
      if (new RegExp(`\\bsetDoc\\s*\\(\\s*${varName}\\b`).test(clean)) {
        note(match.index, `setDoc(${varName})`);
      }
      if (new RegExp(`\\bbatch\\.set\\s*\\(\\s*${varName}\\b`).test(clean)) {
        note(match.index, `batch.set(${varName})`);
      }
    }
    void around;
  }

  for (const match of clean.matchAll(
    /(?:const|let|var)\s+(\w+)\s*=\s*doc\s*\(\s*[^,()\n]+,\s*['"]conversations['"]\s*,\s*[^,()\n]+\s*\)/g,
  )) {
    const varName = match[1];
    if (new RegExp(`\\bsetDoc\\s*\\(\\s*${varName}\\b`).test(clean)) {
      note(match.index, `setDoc(${varName})`);
    }
  }

  for (const match of clean.matchAll(ADMIN_ADD)) note(match.index, "admin .add conversations");
  for (const match of clean.matchAll(ADMIN_SET)) note(match.index, "admin .set conversations");
  for (const match of clean.matchAll(
    /batch\.set\s*\(\s*doc\s*\(\s*[^,()\n]+,\s*['"]conversations['"]\s*,/g,
  )) {
    note(match.index, "batch.set(doc conversations)");
  }

  return [...new Set(hits)];
}

test("aucune écriture conversations hors conversationRouting.ts", () => {
  const files = [];
  walk(ROOT, files);
  const found = [];
  for (const file of files) {
    const rel = relative(ROOT, file).replaceAll("\\", "/");
    if (ALLOWED.has(rel)) continue;
    const hits = violationsIn(readFileSync(file, "utf8"));
    for (const hit of hits) found.push(`${rel}:${hit}`);
  }
  assert.deepEqual(found, []);
});
