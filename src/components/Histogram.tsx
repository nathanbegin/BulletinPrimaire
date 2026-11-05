import type { LetterGrade } from '../types';
import { sortedScale } from '../lib/grading';

/** Répartition des résultats (%) selon les tranches de l'échelle de cotes. */
export function Histogram({ values, scale, threshold }: { values: number[]; scale: LetterGrade[]; threshold: number }) {
  const bins = sortedScale(scale)
    .map((g, i, arr) => ({
      code: g.code,
      min: g.min,
      max: i === 0 ? 100 : arr[i - 1].min,
      count: 0,
    }))
    .reverse();
  for (const v of values) {
    const b = [...bins].reverse().find((x) => v >= x.min) ?? bins[0];
    b.count++;
  }
  const maxCount = Math.max(1, ...bins.map((b) => b.count));
  return (
    <figure className="histo" aria-label="Répartition des résultats">
      <div className="histo-bars">
        {bins.map((b) => (
          <div className="histo-col" key={b.code} title={`${b.code} (${b.min}–${b.max} %) : ${b.count} élève${b.count > 1 ? 's' : ''}`}>
            <span className="histo-count">{b.count || ''}</span>
            <div className={`histo-bar ${b.max <= threshold ? 'below' : ''}`} style={{ height: `${(b.count / maxCount) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="histo-axis">
        {bins.map((b) => (
          <span key={b.code}>
            <strong>{b.code}</strong>
            <small>{b.min}–{b.max}</small>
          </span>
        ))}
      </div>
    </figure>
  );
}
