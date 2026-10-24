import { timingSafeEqual } from 'node:crypto'

export function hasValidMasterSlug(received: string | string[] | undefined) {
  const expected = process.env.MASTER_SLUG
  if (!expected || typeof received !== 'string') return false

  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(received)
  if (expectedBuffer.length !== receivedBuffer.length) return false
  return timingSafeEqual(expectedBuffer, receivedBuffer)
}
