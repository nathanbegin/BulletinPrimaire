export interface Stats {
  count: number;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
  /** Proportion (0–1) de valeurs ≥ seuil, si fourni. */
  successRate: number | null;
}

export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Écart type de population (le groupe entier est la population). */
export function stdDev(values: number[]): number | null {
  const m = mean(values);
  if (m === null) return null;
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeStats(values: number[], threshold?: number): Stats {
  return {
    count: values.length,
    mean: mean(values),
    median: median(values),
    stdDev: stdDev(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    successRate:
      threshold === undefined || !values.length
        ? null
        : values.filter((v) => v >= threshold).length / values.length,
  };
}

/** Moyenne pondérée ; ignore les paires dont la valeur est nulle. */
export function weightedMean(pairs: { value: number | null; weight: number }[]): number | null {
  let sum = 0;
  let w = 0;
  for (const p of pairs) {
    if (p.value === null || !(p.weight > 0)) continue;
    sum += p.value * p.weight;
    w += p.weight;
  }
  return w > 0 ? sum / w : null;
}
