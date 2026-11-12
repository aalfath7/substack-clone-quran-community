// Hash password dengan PBKDF2-SHA256 lewat WebCrypto (native di Workers).
// Scrypt bawaan Better Auth berjalan di JS murni dan mudah melewati batas CPU Workers.
// Format: pbkdf2$<iterasi>$<salt base64>$<hash base64>

const ITERATIONS = 100_000; // batas maksimum PBKDF2 di Workers
const KEY_BITS = 256;
const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(b64: string) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword({ hash, password }: { hash: string; password: string }) {
  const [algo, iter, saltB64, hashB64] = hash.split("$");
  if (algo !== "pbkdf2" || !iter || !saltB64 || !hashB64) return false;

  const expected = fromBase64(hashB64);
  const actual = await derive(password, fromBase64(saltB64), Number(iter));
  if (actual.length !== expected.length) return false;

  // Perbandingan waktu-konstan
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
