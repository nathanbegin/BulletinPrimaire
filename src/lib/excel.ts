import type { AppData, Group } from '../types';
import {
  competencyResult,
  evalStats,
  formatMark,
  groupStudents,
  groupSubjects,
  markToPercent,
  MODE_LABELS,
  percentToLetter,
  studentTermAverage,
  subjectTermResult,
  subjectYearResult,
} from './grading';
import { computeStats } from './stats';
import { groupLabel, groupSchool, groupTeacher, groupYear, supportSummary } from './support';

type Cell = string | number | null;

const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

function sheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).trim() || 'Feuille';
  let n = base;
  let i = 2;
  while (used.has(n)) n = `${base.slice(0, 27)} (${i++})`;
  used.add(n);
  return n;
}

/** Valeur exportée d'un résultat selon le mode de la matière. */
function resultCell(pct: number | null, mode: AppData['subjects'][number]['mode'], data: AppData): Cell {
  if (pct === null) return null;
  if (mode === 'letter') return percentToLetter(pct, data.settings.letterScale);
  if (mode === 'passfail') return pct >= data.settings.passThreshold ? 'Succès' : 'Échec';
  return data.settings.roundResults ? Math.round(pct) : r1(pct);
}

function statRows(label: string, firstCols: number, columns: (number | null)[][]): Cell[][] {
  const stats = columns.map((vals) => computeStats(vals.filter((v): v is number => v !== null)));
  const pad = Array(firstCols - 1).fill(null);
  return [
    [`${label} – Moyenne (%)`, ...pad, ...stats.map((s) => r1(s.mean))],
    [`${label} – Médiane (%)`, ...pad, ...stats.map((s) => r1(s.median))],
    [`${label} – Écart type`, ...pad, ...stats.map((s) => r1(s.stdDev))],
  ];
}

export function buildGroupWorkbookData(data: AppData, group: Group): { name: string; rows: Cell[][]; widths: number[] }[] {
  const used = new Set<string>();
  const sheets: { name: string; rows: Cell[][]; widths: number[] }[] = [];
  const students = groupStudents(data, group.id);
  const subjects = groupSubjects(data, group.id);

  // 1. Groupe
  sheets.push({
    name: sheetName('Groupe', used),
    widths: [22, 40],
    rows: [
      ['Groupe', group.name],
      ['Numéro', group.number ?? ''],
      ['Niveau', group.level],
      ['Année scolaire', groupYear(group, data)],
      ['Enseignant(e)', groupTeacher(group, data)],
      ['École', groupSchool(group, data)],
      ['Nombre d’élèves', students.length],
      ['Exporté le', new Date().toLocaleString('fr-CA')],
      [],
      ['Étapes', 'Pondération (%)', 'Début', 'Fin'],
      ...data.terms.map((t) => [t.name, t.weight, t.start, t.end]),
      [],
      ['Matière', 'Mode', 'Compétences', 'Enseignant(e)'],
      ...subjects.map((s) => [
        s.name,
        MODE_LABELS[s.mode],
        s.competencies.map((c) => `${c.name} (${c.weight} %)`).join(' · '),
        s.teacherName?.trim() || groupTeacher(group, data),
      ]),
    ],
  });

  // 2. Élèves
  sheets.push({
    name: sheetName('Élèves', used),
    widths: [18, 16, 16, 8, 12, 12, 40, 50],
    rows: [
      ['Nom', 'Prénom', 'Code permanent', 'Actif', 'Plan d’intervention', 'Modification', 'Dispositions', 'Notes'],
      ...groupStudents(data, group.id, true).map((s) => [
        s.lastName,
        s.firstName,
        s.code ?? '',
        s.active ? 'Oui' : 'Non',
        s.support?.hasPlan ? 'Oui' : '',
        s.support?.modification ? 'Oui' : '',
        supportSummary(s),
        s.support?.notes ?? '',
      ]),
    ],
  });

  // 3. Résultats par étape et final
  {
    const head1: Cell[] = ['Nom', 'Prénom', 'PI'];
    const cols: { get: (sid: string) => number | null; mode: AppData['subjects'][number]['mode'] }[] = [];
    for (const s of subjects) {
      for (const t of data.terms) {
        head1.push(`${s.name} – ${t.name}`);
        cols.push({ get: (sid) => subjectTermResult(data, s, t.id, sid), mode: s.mode });
      }
      head1.push(`${s.name} – Final`);
      cols.push({ get: (sid) => subjectYearResult(data, s, sid), mode: s.mode });
    }
    for (const t of data.terms) {
      head1.push(`Moyenne générale – ${t.name}`);
      cols.push({ get: (sid) => studentTermAverage(data, group.id, t.id, sid), mode: 'percent' });
    }
    const raw = students.map((st) => cols.map((c) => c.get(st.id)));
    sheets.push({
      name: sheetName('Résultats', used),
      widths: [18, 16, 6, ...cols.map(() => 14)],
      rows: [
        head1,
        ...students.map((st, i) => [
          st.lastName,
          st.firstName,
          st.support?.hasPlan ? 'PI' : '',
          ...raw[i].map((v, k) => resultCell(v, cols[k].mode, data)),
        ]),
        [],
        ...statRows('Groupe', 3, cols.map((_, k) => raw.map((r) => r[k]))),
      ],
    });
  }

  // 4. Notes détaillées par étape
  for (const t of data.terms) {
    const evals = data.evaluations
      .filter((e) => e.groupId === group.id && e.termId === t.id)
      .sort((a, b) => {
        const oa = subjects.find((s) => s.id === a.subjectId)?.order ?? 0;
        const ob = subjects.find((s) => s.id === b.subjectId)?.order ?? 0;
        return oa - ob || a.date.localeCompare(b.date);
      });
    if (!evals.length) continue;
    const subjOf = (id: string) => subjects.find((s) => s.id === id)!;
    const compName = (e: (typeof evals)[number]) => subjOf(e.subjectId).competencies.find((c) => c.id === e.competencyId)?.name ?? '';
    const resultCols = subjects.flatMap((s) => [
      ...s.competencies.map((c) => ({ label: `${s.name} – ${c.name}`, get: (sid: string) => competencyResult(data, s, c.id, t.id, sid), mode: s.mode })),
      { label: `${s.name} – Résultat`, get: (sid: string) => subjectTermResult(data, s, t.id, sid), mode: s.mode },
    ]);
    const pctRows = students.map((st) => evals.map((e) => markToPercent(data.marks[e.id]?.[st.id], subjOf(e.subjectId).mode, e, data.settings)));
    const resRaw = students.map((st) => resultCols.map((c) => c.get(st.id)));
    sheets.push({
      name: sheetName(`${t.name} – notes`, used),
      widths: [18, 16, ...evals.map(() => 14), ...resultCols.map(() => 14)],
      rows: [
        ['Matière', '', ...evals.map((e) => subjOf(e.subjectId).name), ...resultCols.map(() => 'Résultat d’étape (%)')],
        ['Compétence', '', ...evals.map(compName), ...resultCols.map((c) => c.label)],
        ['Évaluation', '', ...evals.map((e) => e.title), ...resultCols.map(() => null)],
        ['Date', '', ...evals.map((e) => e.date)],
        ['Noté sur / mode', '', ...evals.map((e) => (subjOf(e.subjectId).mode === 'percent' ? e.maxScore : MODE_LABELS[subjOf(e.subjectId).mode]))],
        ['Pondération', '', ...evals.map((e) => e.weight)],
        ['Nom', 'Prénom'],
        ...students.map((st, i) => [
          st.lastName,
          st.firstName,
          ...evals.map((e) => {
            const m = data.marks[e.id]?.[st.id];
            if (m === undefined) return null;
            return typeof m === 'number' ? m : formatMark(m, subjOf(e.subjectId).mode);
          }),
          ...resRaw[i].map((v, k) => resultCell(v, resultCols[k].mode, data)),
        ]),
        [],
        ...statRows('Groupe', 2, [...evals.map((_, k) => pctRows.map((r) => r[k])), ...resultCols.map((_, k) => resRaw.map((r) => r[k]))]),
      ],
    });
  }

  // 5. Statistiques par évaluation
  sheets.push({
    name: sheetName('Statistiques', used),
    widths: [12, 30, 30, 30, 10, 8, 10, 10, 10, 8, 8, 10],
    rows: [
      ['Étape', 'Matière', 'Compétence', 'Évaluation', 'Date', 'n', 'Moyenne (%)', 'Médiane (%)', 'Écart type', 'Min', 'Max', 'Réussite (%)'],
      ...data.evaluations
        .filter((e) => e.groupId === group.id)
        .map((e) => {
          const s = subjects.find((x) => x.id === e.subjectId);
          const st = evalStats(data, e);
          return [
            data.terms.find((t) => t.id === e.termId)?.name ?? '',
            s?.name ?? '',
            s?.competencies.find((c) => c.id === e.competencyId)?.name ?? '',
            e.title,
            e.date,
            st.count,
            r1(st.mean),
            r1(st.median),
            r1(st.stdDev),
            r1(st.min),
            r1(st.max),
            st.successRate === null ? null : Math.round(st.successRate * 100),
          ];
        }),
    ],
  });

  return sheets;
}

/** Génère et télécharge le classeur Excel (.xlsx) d'un groupe. */
export async function exportGroupWorkbook(data: AppData, group: Group) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const sh of buildGroupWorkbookData(data, group)) {
    const ws = XLSX.utils.aoa_to_sheet(sh.rows);
    ws['!cols'] = sh.widths.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, sh.name);
  }
  const fname = `${groupLabel(group)} ${groupYear(group, data)}`.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '_');
  XLSX.writeFile(wb, `Notes_${fname || 'groupe'}.xlsx`);
}
