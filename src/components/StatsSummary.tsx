import type { Stats } from '../lib/stats';
import { fmtNum, fmtPct } from '../lib/grading';

export function StatsSummary({ stats, total, compact }: { stats: Stats; total?: number; compact?: boolean }) {
  const items: [string, string][] = [
    ['Notes', total !== undefined ? `${stats.count}/${total}` : String(stats.count)],
    ['Moyenne', fmtPct(stats.mean)],
    ['Médiane', fmtPct(stats.median)],
    ['Écart type', stats.stdDev === null ? '–' : fmtNum(stats.stdDev)],
    ['Min – Max', stats.min === null ? '–' : `${fmtNum(stats.min, 0)} – ${fmtNum(stats.max, 0)}`],
    ['Réussite', stats.successRate === null ? '–' : `${fmtNum(stats.successRate * 100, 0)} %`],
  ];
  return (
    <div className={`stat-tiles ${compact ? 'compact' : ''}`}>
      {items.map(([k, v]) => (
        <div className="stat-tile" key={k}>
          <div className="stat-label">{k}</div>
          <div className="stat-value">{v}</div>
        </div>
      ))}
    </div>
  );
}
