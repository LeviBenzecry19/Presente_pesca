/**
 * Senha do perfil.
 *
 * Não é login: o app abre escolhendo o perfil, sem digitar nada. A senha só é
 * pedida para editar ou excluir um perfil, para que ninguém apague a pescaria
 * do outro sem querer. Ainda assim, nada de guardar em texto puro — o que vai
 * para o banco é uma derivação PBKDF2 com sal aleatório.
 */
const ITERATIONS = 120_000;
const KEY_BITS = 256;

export interface PasswordHash {
  hash: string;
  salt: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return toBase64(bytes);
}

/**
 * Fallback para contextos não seguros (abrir por IP na rede local sem HTTPS),
 * onde `crypto.subtle` não existe. É fraco de propósito e só evita guardar a
 * senha legível; use `npm run dev:https` para ter o PBKDF2 de verdade.
 */
function weakDigest(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let round = 0; round < 5000; round++) {
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i) + round;
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
    }
  }
  return `weak.${h1.toString(16)}${h2.toString(16)}`;
}

async function derive(password: string, salt: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: encoder.encode(salt), iterations: ITERATIONS, hash: "SHA-256" },
      key,
      KEY_BITS,
    );
    return toBase64(new Uint8Array(bits));
  }
  return weakDigest(`${salt}|${password}`);
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = randomSalt();
  return { hash: await derive(password, salt), salt };
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  if (!stored.hash) return true; // perfil sem senha
  const candidate = await derive(password, stored.salt);
  if (candidate.length !== stored.hash.length) return false;
  // Comparação de tempo constante: não vaza onde os hashes divergem.
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ stored.hash.charCodeAt(i);
  return diff === 0;
}

export const MIN_PASSWORD_LENGTH = 4;

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}
