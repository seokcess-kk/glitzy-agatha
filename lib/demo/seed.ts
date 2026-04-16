/**
 * Deterministic PRNG 엔진
 * 동일한 (clinicId, date, platform) → 동일한 숫자.
 * 페이지 리로드나 다른 페이지에서도 값이 일관되어야 "가짜"티가 안 남.
 */

export function hash32(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), 1 | t)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function rngFor(...parts: (string | number)[]): () => number {
  return mulberry32(hash32(parts.join('|')))
}

export function randInRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min)
}

export function randIntInRange(rng: () => number, min: number, max: number): number {
  return Math.floor(randInRange(rng, min, max + 1))
}
