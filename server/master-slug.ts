export function hasValidMasterSlug(received: string | string[] | undefined) {
  const expected = process.env.MASTER_SLUG?.trim()
  if (!expected || typeof received !== 'string') return false
  return received === expected
}
