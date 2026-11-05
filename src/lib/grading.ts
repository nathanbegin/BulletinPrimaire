import { ABSENT, type AppData, type Evaluation, type GradingMode, type LetterGrade, type Mark, type Settings, type Subject } from '../types';
import { computeStats, weightedMean, type Stats } from './stats';

export const MODE_LABELS: Record<GradingMode, string> = {
  percent: 'Pourcentage',
  letter: 'Cote (A, B, C…)',
  passfail: 'Succès / Échec',
};

export function sortedScale(scale: LetterGrade[]): LetterGrade[] {
  return [...scale].sort((a, b) => b.min - a.min);
}

/** Convertit un pourcentage en cote selon l'échelle. */
export function percentToLetter(pct: number, scale: LetterGrade[]): string {
  const s = sortedScale(scale);
  for (const g of s) if (pct >= g.min) return g.code;
  return s.length ? s[s.length - 1].code : '';
}

/** Convertit une note saisie en pourcentage (null si absente / invalide). */
export function markToPercent(mark: Mark | undefined, mode: GradingMode, ev: Evaluation, settings: Settings): number | null {
  if (mark === undefined || mark === null || mark === '' || mark === ABSENT) return null;
  switch (mode) {
    case 'percent': {
      if (typeof mark !== 'number' || !isFinite(mark)) return null;
      const max = ev.maxScore > 0 ? ev.maxScore : 100;
      return (mark / max) * 100;
    }
    case 'letter': {
      const g = settings.letterScale.find((l) => l.code.toUpperCase() === String(mark).toUpperCase());
      return g ? g.value : null;
    }
    case 'passfail':
      return mark === 'S' ? 100 : mark === 'E' ? 0 : null;
  }
}

/**
 * Interprète une saisie clavier. Retourne :
 *  - { mark } si valide (mark undefined = effacer)
 *  - { error } sinon
 */
export function parseInput(
  raw: string,
  mode: GradingMode,
  ev: Evaluation,
  settings: Settings,
): { mark: Mark | undefined } | { error: string } {
  const t = raw.trim();
  if (t === '') return { mark: undefined };
  const up = t.toUpperCase();
  if (up === 'ABS' || up === 'AB' || up === '-' || up === 'X') return { mark: ABSENT };
  switch (mode) {
    case 'percent': {
      let txt = t.replace(',', '.').replace(/\s/g, '');
      const isPct = txt.endsWith('%');
      if (isPct) txt = txt.slice(0, -1);
      // Accepte aussi « 17/20 »
      const frac = txt.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
      let n: number;
      if (frac) {
        const d = parseFloat(frac[2]);
        if (!(d > 0)) return { error: 'Dénominateur invalide' };
        n = (parseFloat(frac[1]) / d) * ev.maxScore;
      } else {
        if (!/^\d+(\.\d+)?$/.test(txt)) return { error: 'Nombre attendu' };
        n = parseFloat(txt);
        if (isPct) n = (n / 100) * ev.maxScore;
      }
      if (n < 0) return { error: 'Note négative' };
      if (n > ev.maxScore) return { error: `Maximum ${ev.maxScore}` };
      return { mark: Math.round(n * 100) / 100 };
    }
    case 'letter': {
      const g = settings.letterScale.find((l) => l.code.toUpperCase() === up);
      if (!g) return { error: 'Cote inconnue' };
      return { mark: g.code };
    }
    case 'passfail': {
      if (['S', 'SUCCÈS', 'SUCCES', 'R', 'O', 'OUI', '1'].includes(up)) return { mark: 'S' };
      if (['E', 'É', 'ÉCHEC', 'ECHEC', 'N', 'NON', '0'].includes(up)) return { mark: 'E' };
      return { error: 'S ou É' };
    }
  }
}

/** Texte affiché dans une cellule pour une note saisie. */
export function formatMark(mark: Mark | undefined, mode: GradingMode): string {
  if (mark === undefined || mark === null) return '';
  if (mark === ABSENT) return 'ABS';
  if (mode === 'passfail') return mark === 'S' ? 'S' : mark === 'E' ? 'É' : String(mark);
  if (typeof mark === 'number') return fmtNum(mark);
  return String(mark);
}

export function fmtNum(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return '–';
  const r = Math.round(n * 10 ** decimals) / 10 ** decimals;
  return r.toLocaleString('fr-CA', { maximumFractionDigits: decimals });
}

export function fmtPct(n: number | null | undefined, decimals = 1): string {
  return n === null || n === undefined ? '–' : `${fmtNum(n, decimals)} %`;
}

/** Présente un pourcentage selon le mode de la matière. */
export function displayResult(pct: number | null, mode: GradingMode, settings: Settings, decimals = 0): string {
  if (pct === null) return '–';
  const v = settings.roundResults ? Math.round(pct) : pct;
  switch (mode) {
    case 'percent':
      return fmtPct(v, settings.roundResults ? 0 : decimals || 1);
    case 'letter':
      return percentToLetter(v, settings.letterScale);
    case 'passfail':
      return v >= settings.passThreshold ? 'Succès' : 'Échec';
  }
}

// ---------------------------------------------------------------------------
// Calcul des résultats
// ---------------------------------------------------------------------------

export function evalPercents(data: AppData, ev: Evaluation, studentIds?: string[]): number[] {
  const subj = data.subjects.find((s) => s.id === ev.subjectId);
  if (!subj) return [];
  const m = data.marks[ev.id] ?? {};
  const ids = studentIds ?? data.students.filter((s) => s.groupId === ev.groupId && s.active).map((s) => s.id);
  const out: number[] = [];
  for (const id of ids) {
    const p = markToPercent(m[id], subj.mode, ev, data.settings);
    if (p !== null) out.push(p);
  }
  return out;
}

export function evalStats(data: AppData, ev: Evaluation): Stats {
  return computeStats(evalPercents(data, ev), data.settings.passThreshold);
}

/** Résultat (%) d'un élève pour une compétence (ou la matière entière si competencyId est null) dans une étape. */
export function competencyResult(
  data: AppData,
  subject: Subject,
  competencyId: string | null,
  termId: string,
  studentId: string,
): number | null {
  const evs = data.evaluations.filter(
    (e) =>
      e.subjectId === subject.id &&
      e.termId === termId &&
      (competencyId === null || e.competencyId === competencyId),
  );
  return weightedMean(
    evs.map((e) => ({
      value: markToPercent(data.marks[e.id]?.[studentId], subject.mode, e, data.settings),
      weight: e.weight,
    })),
  );
}

/** Résultat (%) d'un élève dans une matière pour une étape. */
export function subjectTermResult(data: AppData, subject: Subject, termId: string, studentId: string): number | null {
  const comps = subject.competencies;
  if (!comps.length) return competencyResult(data, subject, null, termId, studentId);
  // Évaluations non rattachées à une compétence : comptées comme une « compétence » de poids moyen
  const pairs = comps.map((c) => ({
    value: competencyResult(data, subject, c.id, termId, studentId),
    weight: c.weight,
  }));
  const orphan = data.evaluations.filter(
    (e) => e.subjectId === subject.id && e.termId === termId && (!e.competencyId || !comps.some((c) => c.id === e.competencyId)),
  );
  if (orphan.length) {
    const avgW = comps.reduce((a, c) => a + c.weight, 0) / comps.length;
    pairs.push({
      value: weightedMean(
        orphan.map((e) => ({
          value: markToPercent(data.marks[e.id]?.[studentId], subject.mode, e, data.settings),
          weight: e.weight,
        })),
      ),
      weight: avgW,
    });
  }
  return weightedMean(pairs);
}

/** Résultat final (cumulatif) pondéré par les étapes, jusqu'à l'étape donnée inclusivement. */
export function subjectYearResult(
  data: AppData,
  subject: Subject,
  studentId: string,
  competencyId?: string | null,
  uptoTermId?: string,
): number | null {
  const terms = data.terms;
  const idx = uptoTermId ? terms.findIndex((t) => t.id === uptoTermId) : terms.length - 1;
  return weightedMean(
    terms.slice(0, idx + 1).map((t) => ({
      value:
        competencyId === undefined
          ? subjectTermResult(data, subject, t.id, studentId)
          : competencyResult(data, subject, competencyId, t.id, studentId),
      weight: t.weight,
    })),
  );
}

export function groupStudents(data: AppData, groupId: string, includeInactive = false) {
  return data.students
    .filter((s) => s.groupId === groupId && (includeInactive || s.active))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'));
}

export function groupSubjects(data: AppData, groupId: string) {
  return data.subjects.filter((s) => s.groupId === groupId).sort((a, b) => a.order - b.order);
}

/** Statistiques de groupe pour une matière à une étape. */
export function subjectTermStats(data: AppData, subject: Subject, termId: string, competencyId?: string | null): Stats {
  const vals: number[] = [];
  for (const st of groupStudents(data, subject.groupId)) {
    const v =
      competencyId === undefined
        ? subjectTermResult(data, subject, termId, st.id)
        : competencyResult(data, subject, competencyId, termId, st.id);
    if (v !== null) vals.push(v);
  }
  return computeStats(vals, data.settings.passThreshold);
}

/** Moyenne générale d'un élève à une étape (toutes matières, poids égal). */
export function studentTermAverage(data: AppData, groupId: string, termId: string, studentId: string): number | null {
  return weightedMean(
    groupSubjects(data, groupId).map((s) => ({ value: subjectTermResult(data, s, termId, studentId), weight: 1 })),
  );
}

export function studentName(s: { firstName: string; lastName: string }) {
  return `${s.firstName} ${s.lastName}`.trim();
}
