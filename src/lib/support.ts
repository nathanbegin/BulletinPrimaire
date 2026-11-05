import type { AppData, Group, Student, StudentSupport } from '../types';

/** Dispositions fréquentes (suggestions) — l'enseignant(e) peut en saisir d'autres. */
export const SUPPORT_SUGGESTIONS = [
  'Temps supplémentaire',
  'Lieu calme / local isolé',
  'Lecture des consignes à voix haute',
  'Aide technologique (synthèse vocale)',
  'Aide technologique (correcteur)',
  'Fractionnement de la tâche',
  'Aide-mémoire autorisé',
  'Orthopédagogie',
  'Orthophonie',
  'Psychoéducation',
  'Francisation',
  'Difficulté en lecture',
  'Difficulté en écriture',
  'Difficulté en mathématique',
  'Attention / concentration',
  'Comportement',
  'Douance',
];

export function emptySupport(): StudentSupport {
  return { hasPlan: false, adaptation: false, modification: false, tags: [], notes: '' };
}

export function hasSupport(s: Student): boolean {
  const p = s.support;
  return !!p && (p.hasPlan || p.adaptation || p.modification || p.tags.length > 0 || p.notes.trim() !== '');
}

/** Courtes étiquettes à afficher à côté du nom. */
export function supportBadges(s: Student): { code: string; title: string; kind: string }[] {
  const p = s.support;
  if (!p) return [];
  const out: { code: string; title: string; kind: string }[] = [];
  if (p.hasPlan) out.push({ code: 'PI', title: 'Plan d’intervention', kind: 'pi' });
  if (p.adaptation) out.push({ code: 'Ad', title: 'Mesures d’adaptation', kind: 'ad' });
  if (p.modification) out.push({ code: 'Mo', title: 'Mesures de modification (exigences modifiées)', kind: 'mo' });
  if (!out.length && (p.tags.length || p.notes.trim())) out.push({ code: '!', title: 'Dispositions particulières', kind: 'tag' });
  return out;
}

export function supportSummary(s: Student): string {
  const p = s.support;
  if (!p) return '';
  return [
    p.hasPlan && 'Plan d’intervention',
    p.adaptation && 'Adaptation',
    p.modification && 'Modification',
    ...p.tags,
  ]
    .filter(Boolean)
    .join(', ');
}

// ----- Groupes -----

export function groupYear(g: Group, data: AppData): string {
  return g.schoolYear || data.settings.schoolYear;
}
export function groupTeacher(g: Group, data: AppData): string {
  return g.teacherName || data.settings.teacherName;
}
export function groupSchool(g: Group, data: AppData): string {
  return g.schoolName || data.settings.schoolName;
}
export function groupLabel(g: Group): string {
  return g.number && !g.name.includes(g.number) ? `${g.name} (${g.number})` : g.name;
}

/** Groupes triés par année scolaire (plus récente d'abord) puis par numéro / nom. */
export function groupsByYear(data: AppData): { year: string; groups: Group[] }[] {
  const map = new Map<string, Group[]>();
  for (const g of data.groups) {
    const y = groupYear(g, data);
    map.set(y, [...(map.get(y) ?? []), g]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, groups]) => ({
      year,
      groups: groups.sort((a, b) => (a.number ?? '').localeCompare(b.number ?? '', 'fr', { numeric: true }) || a.name.localeCompare(b.name, 'fr')),
    }));
}
