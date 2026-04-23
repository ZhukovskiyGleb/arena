export interface HexCoord {
  q: number;
  r: number;
  s: number;
}

const SQRT3 = Math.sqrt(3);

// Pointy-top hex: 6 directions starting from top-left, going clockwise
const DIRECTIONS: HexCoord[] = [
  { q: 1, r: -1, s: 0 },
  { q: 1, r: 0, s: -1 },
  { q: 0, r: 1, s: -1 },
  { q: -1, r: 1, s: 0 },
  { q: -1, r: 0, s: 1 },
  { q: 0, r: -1, s: 1 },
];

export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
}

export function hexNeighbors(h: HexCoord): HexCoord[] {
  return DIRECTIONS.map(d => ({ q: h.q + d.q, r: h.r + d.r, s: h.s + d.s }));
}

export function hexRing(center: HexCoord, radius: number): HexCoord[] {
  if (radius === 0) return [{ ...center }];
  const results: HexCoord[] = [];
  let h: HexCoord = {
    q: center.q + DIRECTIONS[4].q * radius,
    r: center.r + DIRECTIONS[4].r * radius,
    s: center.s + DIRECTIONS[4].s * radius,
  };
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push({ ...h });
      h = { q: h.q + DIRECTIONS[i].q, r: h.r + DIRECTIONS[i].r, s: h.s + DIRECTIONS[i].s };
    }
  }
  return results;
}

function cubeRound(fq: number, fr: number, fs: number): HexCoord {
  let q = Math.round(fq);
  let r = Math.round(fr);
  let s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  else s = -q - r;
  return { q, r, s };
}

export function hexToPixel(h: HexCoord, size: number): { x: number; y: number } {
  return {
    x: size * (SQRT3 * h.q + (SQRT3 / 2) * h.r),
    y: size * 1.5 * h.r,
  };
}

export function pixelToHex(x: number, y: number, size: number): HexCoord {
  const fq = ((SQRT3 / 3) * x - (1 / 3) * y) / size;
  const fr = ((2 / 3) * y) / size;
  return cubeRound(fq, fr, -fq - fr);
}

export function polarToHex(radius: number, angle: number): HexCoord {
  return pixelToHex(radius * SQRT3 * Math.cos(angle), radius * SQRT3 * Math.sin(angle), 1);
}
