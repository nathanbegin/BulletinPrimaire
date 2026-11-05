import type { Student } from '../types';
import { supportBadges, supportSummary } from '../lib/support';

export function SupportBadges({ student }: { student: Student }) {
  const b = supportBadges(student);
  if (!b.length) return null;
  const summary = supportSummary(student);
  return (
    <span className="support-badges" title={summary || b.map((x) => x.title).join(', ')}>
      {b.map((x) => (
        <span key={x.code} className={`sb sb-${x.kind}`} aria-label={x.title}>
          {x.code}
        </span>
      ))}
    </span>
  );
}
