/**
 * Server-only admin preview key for `/shows/admin/[id]?key=…`.
 * Set `TEAVIE_ADMIN_KEY` in env (min 8 chars). Never expose in client bundles.
 */
export function isValidAdminKey(key) {
  const expected = String(process.env.TEAVIE_ADMIN_KEY ?? "").trim();
  if (expected.length < 8) return false;
  const provided = String(key ?? "").trim();
  if (!provided) return false;
  return provided === expected;
}
