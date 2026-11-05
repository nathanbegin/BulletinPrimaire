import type { AppData, GradingMode, LetterGrade, Settings, Subject, Term } from '../types';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const DEFAULT_LETTER_SCALE: LetterGrade[] = [
  { code: 'A', min: 90, value: 95, label: 'Dépasse les attentes' },
  { code: 'B', min: 80, value: 85, label: 'Répond très bien aux attentes' },
  { code: 'C', min: 70, value: 75, label: 'Répond aux attentes' },
  { code: 'D', min: 60, value: 65, label: 'Répond minimalement aux attentes' },
  { code: 'E', min: 50, value: 55, label: 'Ne répond pas aux attentes' },
  { code: 'F', min: 0, value: 35, label: 'Échec marqué' },
];

export function currentSchoolYear(d = new Date()): string {
  const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

export function defaultTerms(schoolYear = currentSchoolYear()): Term[] {
  const y = parseInt(schoolYear.slice(0, 4), 10);
  return [
    { id: uid(), name: 'Étape 1', start: `${y}-08-28`, end: `${y}-11-07`, weight: 20 },
    { id: uid(), name: 'Étape 2', start: `${y}-11-10`, end: `${y + 1}-02-13`, weight: 20 },
    { id: uid(), name: 'Étape 3', start: `${y + 1}-02-16`, end: `${y + 1}-06-20`, weight: 60 },
  ];
}

export function defaultSettings(): Settings {
  return {
    schoolName: '',
    teacherName: '',
    schoolYear: currentSchoolYear(),
    letterScale: DEFAULT_LETTER_SCALE.map((l) => ({ ...l })),
    passThreshold: 60,
    roundResults: true,
    showGroupAverage: true,
  };
}

export interface SubjectTemplate {
  name: string;
  mode: GradingMode;
  competencies: { name: string; weight: number }[];
}

/** Matières du Programme de formation de l'école québécoise (primaire). */
export const QC_SUBJECTS: SubjectTemplate[] = [
  {
    name: 'Français, langue d’enseignement',
    mode: 'percent',
    competencies: [
      { name: 'Lire', weight: 50 },
      { name: 'Écrire', weight: 30 },
      { name: 'Communiquer oralement', weight: 20 },
    ],
  },
  {
    name: 'Mathématique',
    mode: 'percent',
    competencies: [
      { name: 'Résoudre une situation-problème', weight: 30 },
      { name: 'Utiliser un raisonnement mathématique', weight: 70 },
    ],
  },
  {
    name: 'Anglais, langue seconde',
    mode: 'percent',
    competencies: [
      { name: 'Communicate orally in English', weight: 50 },
      { name: 'Understand texts read and heard', weight: 35 },
      { name: 'Write texts', weight: 15 },
    ],
  },
  { name: 'Science et technologie', mode: 'percent', competencies: [] },
  { name: 'Géographie, histoire et éducation à la citoyenneté', mode: 'percent', competencies: [] },
  { name: 'Culture et citoyenneté québécoise', mode: 'percent', competencies: [] },
  { name: 'Éducation physique et à la santé', mode: 'percent', competencies: [] },
  { name: 'Arts plastiques', mode: 'percent', competencies: [] },
  { name: 'Musique', mode: 'percent', competencies: [] },
  { name: 'Art dramatique', mode: 'percent', competencies: [] },
  { name: 'Danse', mode: 'percent', competencies: [] },
];

export function subjectFromTemplate(t: SubjectTemplate, groupId: string, order: number): Subject {
  return {
    id: uid(),
    groupId,
    name: t.name,
    mode: t.mode,
    order,
    competencies: t.competencies.map((c) => ({ id: uid(), ...c })),
  };
}

export function emptyData(): AppData {
  const settings = defaultSettings();
  return {
    version: 1,
    settings,
    terms: defaultTerms(settings.schoolYear),
    groups: [],
    students: [],
    subjects: [],
    evaluations: [],
    marks: {},
    comments: {},
  };
}

const FIRST = ['Léa', 'Félix', 'Emma', 'William', 'Alice', 'Noah', 'Florence', 'Thomas', 'Charlotte', 'Liam', 'Rosalie', 'Jacob', 'Zoé', 'Nathan', 'Olivia', 'Édouard', 'Juliette', 'Arnaud', 'Maëlle', 'Samuel', 'Clara', 'Loïc'];
const LAST = ['Tremblay', 'Gagnon', 'Roy', 'Côté', 'Bouchard', 'Gauthier', 'Morin', 'Lavoie', 'Fortin', 'Gagné', 'Ouellet', 'Pelletier', 'Bélanger', 'Lévesque', 'Bergeron', 'Leblanc', 'Paquette', 'Girard', 'Simard', 'Boucher', 'Caron', 'Beaulieu'];

/** Jeu de données de démonstration. */
export function demoData(): AppData {
  const d = emptyData();
  d.settings.schoolName = 'École primaire des Érables';
  d.settings.teacherName = 'Mme Dubois';
  const g = {
    id: uid(),
    name: 'Groupe 301',
    number: '301',
    level: '3e année',
    schoolYear: d.settings.schoolYear,
    teacherName: d.settings.teacherName,
    schoolName: d.settings.schoolName,
  };
  d.groups.push(g);
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  FIRST.forEach((f, i) =>
    d.students.push({ id: uid(), groupId: g.id, firstName: f, lastName: LAST[i], active: true }),
  );
  d.students[3].support = { hasPlan: true, adaptation: true, modification: false, tags: ['Temps supplémentaire', 'Difficulté en lecture'], notes: 'Suivi en orthopédagogie 2×/semaine.' };
  d.students[9].support = { hasPlan: true, adaptation: false, modification: true, tags: ['Difficulté en mathématique'], notes: '' };
  d.students[14].support = { hasPlan: false, adaptation: false, modification: false, tags: ['Attention / concentration'], notes: 'Rencontre parents prévue.' };
  QC_SUBJECTS.slice(0, 8).forEach((t, i) => {
    const s = subjectFromTemplate(t, g.id, i);
    if (t.name.startsWith('Arts')) s.mode = 'letter';
    if (t.name.startsWith('Éducation physique')) s.mode = 'passfail';
    d.subjects.push(s);
  });
  const [t1, t2] = d.terms;
  const mkEval = (subjIdx: number, compIdx: number | null, termId: string, title: string, max: number, date: string) => {
    const s = d.subjects[subjIdx];
    const ev = {
      id: uid(),
      groupId: g.id,
      subjectId: s.id,
      competencyId: compIdx === null ? undefined : s.competencies[compIdx]?.id,
      termId,
      title,
      date,
      maxScore: max,
      weight: 1,
    };
    d.evaluations.push(ev);
    d.marks[ev.id] = {};
    d.students.forEach((st, i) => {
      const ability = 0.55 + ((i * 37) % 40) / 100;
      const r = Math.min(1, Math.max(0.2, ability + (rnd() - 0.5) * 0.25));
      let mark: string | number;
      if (s.mode === 'percent') mark = Math.round(r * max * 2) / 2;
      else if (s.mode === 'letter') mark = r >= 0.9 ? 'A' : r >= 0.8 ? 'B' : r >= 0.7 ? 'C' : r >= 0.6 ? 'D' : 'E';
      else mark = r >= 0.6 ? 'S' : 'E';
      if (!(termId === t2.id && i > 15)) d.marks[ev.id][st.id] = mark;
    });
  };
  const y = d.terms[0].start.slice(0, 4);
  mkEval(0, 0, t1.id, 'Lecture – Les saisons', 20, `${y}-09-19`);
  mkEval(0, 0, t1.id, 'Compréhension de lecture', 30, `${y}-10-10`);
  mkEval(0, 1, t1.id, 'Production écrite #1', 40, `${y}-10-03`);
  mkEval(0, 2, t1.id, 'Exposé oral', 10, `${y}-10-24`);
  mkEval(1, 0, t1.id, 'SP – La sortie au verger', 20, `${y}-10-15`);
  mkEval(1, 1, t1.id, 'Additions et soustractions', 25, `${y}-09-26`);
  mkEval(1, 1, t1.id, 'Géométrie', 20, `${y}-10-29`);
  mkEval(2, 0, t1.id, 'Oral interaction', 10, `${y}-10-08`);
  mkEval(3, null, t1.id, 'Les états de la matière', 30, `${y}-10-17`);
  mkEval(4, null, t1.id, 'Les Iroquoiens vers 1500', 25, `${y}-10-22`);
  mkEval(5, null, t1.id, 'Le vivre-ensemble', 20, `${y}-10-30`);
  mkEval(6, null, t1.id, 'Habiletés motrices', 1, `${y}-10-01`);
  mkEval(7, null, t1.id, 'Création – Paysage d’automne', 1, `${y}-10-20`);
  mkEval(0, 0, t2.id, 'Lecture – Contes', 20, `${y}-11-20`);
  mkEval(1, 1, t2.id, 'Multiplications', 30, `${y}-11-27`);
  return d;
}
