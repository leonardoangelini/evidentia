export function newId(prefix?: string): string {
  const uuid =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix ? `${prefix}_${uuid}` : uuid;
}
