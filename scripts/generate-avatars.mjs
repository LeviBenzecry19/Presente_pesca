// Gera os avatares padrão em public/avatars a partir de SVG.
// Uso: npm run avatars
//
// Para trocar por outra arte, basta sobrescrever o PNG correspondente em
// public/avatars/ mantendo o nome do arquivo — nada no código muda.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "public/avatars");
mkdirSync(out, { recursive: true });

const SIZE = 512;

/** Céu + mata + água: cenário comum aos avatares de pescador. */
const lakeScene = (skyTop, skyBottom, waterTop, waterBottom) => `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyTop}"/>
      <stop offset="100%" stop-color="${skyBottom}"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${waterTop}"/>
      <stop offset="100%" stop-color="${waterBottom}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <g fill="#ffffff" opacity=".85">
    <ellipse cx="120" cy="96" rx="46" ry="20"/>
    <ellipse cx="152" cy="86" rx="34" ry="17"/>
    <ellipse cx="386" cy="140" rx="40" ry="17"/>
    <ellipse cx="414" cy="132" rx="28" ry="13"/>
  </g>
  <path d="M0 268 L44 244 L86 262 L128 236 L176 258 L220 234 L268 256 L316 232 L364 254 L412 236 L460 258 L512 240 L512 300 L0 300 Z" fill="#2f5d3f"/>
  <path d="M0 276 L52 258 L104 272 L156 252 L208 270 L260 250 L312 268 L364 248 L416 266 L468 250 L512 264 L512 300 L0 300 Z" fill="#244a32"/>
  <rect y="296" width="512" height="216" fill="url(#water)"/>
  <g stroke="#ffffff" stroke-linecap="round" opacity=".45">
    <path d="M40 348 h72" stroke-width="7"/>
    <path d="M300 336 h96" stroke-width="7"/>
    <path d="M96 404 h120" stroke-width="8"/>
    <path d="M330 424 h108" stroke-width="8"/>
    <path d="M170 462 h150" stroke-width="9"/>
  </g>`;

/** Vara de pesca apontando para a água. */
const rod = `
  <g stroke-linecap="round">
    <path d="M296 330 L486 150" stroke="#1b1f24" stroke-width="11"/>
    <path d="M296 330 L486 150" stroke="#3d454e" stroke-width="4"/>
    <circle cx="316" cy="312" r="15" fill="#2b323a"/>
    <circle cx="316" cy="312" r="7" fill="#9aa6b2"/>
    <path d="M486 150 L500 300" stroke="#e6edf5" stroke-width="2.5" opacity=".85" fill="none"/>
  </g>`;

const angler = ({ skin, skinShade, hair, hoodie, hoodieShade, capCrown, capBrim }) => `
  ${lakeScene("#8fd0f5", "#cfeaff", "#3f92c9", "#1f5f92")}
  <g>
    <!-- pescoço: desenhado antes do corpo, que cobre a base -->
    <path d="M234 254 C234 306 240 330 248 348 L304 348 C292 324 288 292 288 254 Z" fill="${skinShade}"/>
    <!-- ombros -->
    <path d="M136 512 C140 400 200 334 268 334 C338 334 396 400 400 512 Z" fill="${hoodie}"/>
    <path d="M268 334 C318 334 360 372 382 426 L318 450 C306 400 290 362 268 334 Z" fill="${hoodieShade}"/>
    <!-- gola, esconde a emenda do pescoço -->
    <path d="M224 346 C248 328 292 328 316 346 C296 364 244 366 224 346 Z" fill="${hoodieShade}"/>
    <!-- cabeça de perfil, virada para a água -->
    <path d="M198 206 C198 152 236 118 282 118 C330 118 358 152 356 200 C355 232 344 258 326 274 C308 290 280 296 258 290 C226 282 198 250 198 206 Z" fill="${skin}"/>
    <path d="M352 200 C362 200 370 210 368 222 C366 234 356 240 348 236 Z" fill="${skin}"/>
    <circle cx="248" cy="226" r="16" fill="${skinShade}"/>
    <!-- cabelo na nuca -->
    <path d="M196 208 C192 158 226 120 274 118 C244 134 222 164 218 210 Z" fill="${hair}"/>
    <!-- óculos escuros -->
    <path d="M290 198 C312 192 342 194 360 200 L358 224 C340 234 312 234 292 224 Z" fill="#14181d"/>
    <path d="M298 204 C316 200 338 200 352 204 L351 216 C336 222 316 222 300 216 Z" fill="#2b333c" opacity=".75"/>
    <path d="M254 200 h38" stroke="#14181d" stroke-width="8" stroke-linecap="round"/>
    <!-- boné -->
    <path d="M194 198 C190 142 232 106 282 106 C330 106 358 142 358 186 C332 176 296 172 258 176 C230 180 208 188 194 198 Z" fill="${capCrown}"/>
    <path d="M282 106 C322 106 348 132 356 166 C334 160 306 157 280 158 C280 140 281 122 282 106 Z" fill="${capBrim}" opacity=".28"/>
    <path d="M352 176 C396 174 436 186 452 200 C430 212 392 216 350 210 Z" fill="${capBrim}"/>
    <circle cx="278" cy="108" r="9" fill="${capBrim}"/>
  </g>
  ${rod}`;

const AVATARS = {
  pescador: angler({
    skin: "#e8b48c", skinShade: "#cf9770", hair: "#3a2a20",
    hoodie: "#4d5a45", hoodieShade: "#3c4737",
    capCrown: "#232a22", capBrim: "#c9cfc2",
  }),
};

/** Recorta em círculo: os avatares são sempre exibidos redondos. */
const circleMask = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}" fill="#fff"/></svg>`,
);

for (const [name, art] of Object.entries(AVATARS)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">${art}</svg>`;
  writeFileSync(resolve(out, `${name}.svg`), svg);
  await sharp(Buffer.from(svg))
    .resize(SIZE, SIZE)
    .composite([{ input: circleMask, blend: "dest-in" }])
    .png()
    .toFile(resolve(out, `${name}.png`));
  console.log(`✓ ${name}.png`);
}
