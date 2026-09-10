// Gera os ícones PNG do PWA a partir de um SVG simples (peixe + anzol).
// Uso: npm run icons   (requer a devDependency `sharp`)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "public/icons");
mkdirSync(out, { recursive: true });

const BRAND = "#0a6b95";
const ACCENT = "#f59e0b";

/** Arte central (peixe + anzol) em um quadro 512×512, sem fundo. */
const art = `
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <!-- corpo do peixe -->
    <path d="M92 236c58-74 142-104 226-82 44 12 82 38 108 66-26 30-64 56-108 68-84 22-168-8-226-52z" fill="#ffffff"/>
    <!-- cauda -->
    <path d="M414 174l70-58v208l-70-58z" fill="#ffffff"/>
    <!-- olho -->
    <circle cx="164" cy="212" r="16" fill="${BRAND}"/>
    <!-- barbatana -->
    <path d="M236 174c22-28 60-40 96-32-20 18-32 40-36 62" fill="${BRAND}" opacity=".35"/>
    <!-- anzol -->
    <path d="M330 322v58c0 34-28 62-62 62s-62-28-62-62" stroke="${ACCENT}" stroke-width="26"/>
    <path d="M206 380l-24-22" stroke="${ACCENT}" stroke-width="26"/>
  </g>`;

const roundedSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${BRAND}"/>
  ${art}
</svg>`;

// Maskable: fundo cheio e arte reduzida para caber na "zona segura" (80%).
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND}"/>
  <g transform="translate(51.2 51.2) scale(0.8)">${art}</g>
</svg>`;

// Badge monocromático (Android mostra na barra de status).
const badgeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 512 512">
  <g fill="#ffffff">
    <path d="M92 236c58-74 142-104 226-82 44 12 82 38 108 66-26 30-64 56-108 68-84 22-168-8-226-52z"/>
    <path d="M414 174l70-58v208l-70-58z"/>
    <circle cx="164" cy="212" r="16" fill="${BRAND}"/>
  </g>
</svg>`;

async function png(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(resolve(out, file));
  console.log(`✓ ${file}`);
}

writeFileSync(resolve(out, "icon.svg"), roundedSvg(512).trim());
console.log("✓ icon.svg");
await png(roundedSvg(512), 192, "icon-192.png");
await png(roundedSvg(512), 512, "icon-512.png");
await png(roundedSvg(512), 180, "apple-touch-icon.png");
await png(maskableSvg, 512, "maskable-512.png");
await png(badgeSvg, 96, "badge-96.png");
