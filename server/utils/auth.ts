import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'crypto'

// Passwords are hashed with scrypt and stored as `scrypt$N$r$p$<salt b64>$<hash b64>`, so the cost can be raised
// later without breaking existing hashes (needsRehash() reports old parameters). The legacy format
// `<salt hex>:<sha256 hex>` is still accepted, and login upgrades it (server/api/auth/login.post.ts).

const SCRYPT_N = 2 ** 15 // ~32 MB of memory per hash (128 * N * r)
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 64

function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

function scryptOptions(N: number, r: number, p: number): ScryptOptions {
  return { N, r, p, maxmem: 256 * N * r }
}

export async function hashUserPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, KEY_LEN, scryptOptions(SCRYPT_N, SCRYPT_R, SCRYPT_P))
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyUserPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith('scrypt$')) {
    const [, n, r, p, saltB64, hashB64] = stored.split('$')
    const N = Number(n), R = Number(r), P = Number(p)
    if (!N || !R || !P || !saltB64 || !hashB64) return false
    const expected = Buffer.from(hashB64, 'base64')
    const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, scryptOptions(N, R, P))
    return timingSafeEqual(actual, expected)
  }

  // Legacy: salt:sha256(salt + password), both hex
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const inputHash = createHash('sha256').update(salt + password).digest('hex')
  const storedBuffer = Buffer.from(hash, 'hex')
  const inputBuffer = Buffer.from(inputHash, 'hex')
  if (storedBuffer.length !== inputBuffer.length) return false
  return timingSafeEqual(storedBuffer, inputBuffer)
}

/** True when a stored hash uses the legacy format or older scrypt parameters, and should be replaced. */
export function needsRehash(stored: string): boolean {
  if (!stored.startsWith('scrypt$')) return true
  const [, n, r, p] = stored.split('$')
  return Number(n) !== SCRYPT_N || Number(r) !== SCRYPT_R || Number(p) !== SCRYPT_P
}

// Hashed for unknown usernames, so a login for a user that doesn't exist takes as long as one that does.
let dummyHash: Promise<string> | null = null
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashUserPassword(randomBytes(16).toString('hex'))
  await verifyUserPassword(password, await dummyHash)
}
