import { createHash, randomBytes, timingSafeEqual } from 'crypto'

export async function hashUserPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(salt + password).digest('hex')
  return `${salt}:${hash}`
}

export async function verifyUserPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const inputHash = createHash('sha256').update(salt + password).digest('hex')
  const storedBuffer = Buffer.from(hash, 'hex')
  const inputBuffer = Buffer.from(inputHash, 'hex')
  if (storedBuffer.length !== inputBuffer.length) return false
  return timingSafeEqual(storedBuffer, inputBuffer)
}
