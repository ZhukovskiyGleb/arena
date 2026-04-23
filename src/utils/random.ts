let _seed: number | null = null;

export function setSeed(seed: number | null): void {
  _seed = seed === null ? null : seed >>> 0;
}

function nextFloat(): number {
  if (_seed === null) return Math.random();
  // Mulberry32 PRNG
  _seed = (_seed + 0x6d2b79f5) >>> 0;
  let z = _seed;
  z = Math.imul(z ^ (z >>> 15), z | 1);
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
  return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
}

export function random(x: number): number {
  const lo = Math.max(1, Math.floor(x / 5));
  return lo + Math.floor(nextFloat() * (x - lo + 1));
}
