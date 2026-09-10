// Copia src/sw/sw.js para public/sw.js carimbando a versão do build.
// Roda automaticamente antes de `next build` (script "prebuild").
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(resolve(root, "src/sw/sw.js"), "utf8");
const version = process.env.SW_VERSION || new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

mkdirSync(resolve(root, "public"), { recursive: true });
// replaceAll: o placeholder também aparece no comentário de cabeçalho do arquivo.
writeFileSync(resolve(root, "public/sw.js"), src.replaceAll("__SW_VERSION__", version));
console.log(`public/sw.js gerado (versão ${version})`);
