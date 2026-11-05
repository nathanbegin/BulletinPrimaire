/** Mode d'évaluation d'une matière. */
export type GradingMode = 'percent' | 'letter' | 'passfail';

/** Une cote alphabétique de l'échelle (ex. A ≥ 90 %, valeur représentative 95 %). */
export interface LetterGrade {
  code: string;
  /** Seuil minimal en pourcentage pour obtenir cette cote. */
  min: number;
  /** Valeur en pourcentage utilisée pour les calculs (moyennes, statistiques). */
  value: number;
  label?: string;
}

export interface Term {
  id: string;
  name: string;
  start: string; // AAAA-MM-JJ
  end: string;
  /** Pondération dans le résultat final (Québec : 20 / 20 / 60). */
  weight: number;
}

export interface Settings {
  schoolName: string;
  teacherName: string;
  schoolYear: string;
  letterScale: LetterGrade[];
  /** Seuil de réussite en pourcentage. */
  passThreshold: number;
  /** Arrondir les résultats d'étape à l'unité (comme au bulletin). */
  roundResults: boolean;
  /** Afficher la moyenne du groupe au bulletin. */
  showGroupAverage: boolean;
}

export interface Group {
  id: string;
  name: string;
  /** Numéro de groupe (ex. « 301 »). */
  number?: string;
  level: string; // ex. « 3e année »
  /** Année scolaire du groupe (ex. « 2026-2027 »). */
  schoolYear?: string;
  teacherName?: string;
  schoolName?: string;
}

/** Mesures prévues au plan d'intervention (Québec). */
export type SupportKind = 'pi' | 'adaptation' | 'modification';

export interface StudentSupport {
  /** Élève ayant un plan d'intervention. */
  hasPlan: boolean;
  /** Mesures d'adaptation (n'affectent pas les exigences) ou de modification (exigences modifiées). */
  adaptation: boolean;
  modification: boolean;
  /** Dispositions / difficultés (ex. « Temps supplémentaire », « Dyslexie »). */
  tags: string[];
  notes: string;
}

export interface Student {
  id: string;
  groupId: string;
  firstName: string;
  lastName: string;
  code?: string; // code permanent
  active: boolean;
  support?: StudentSupport;
}

export interface Competency {
  id: string;
  name: string;
  weight: number;
}

export interface Subject {
  id: string;
  groupId: string;
  name: string;
  mode: GradingMode;
  competencies: Competency[];
  order: number;
}

export interface Evaluation {
  id: string;
  groupId: string;
  subjectId: string;
  competencyId?: string;
  termId: string;
  title: string;
  date: string;
  /** Total de points (mode pourcentage uniquement). */
  maxScore: number;
  /** Pondération de l'évaluation parmi celles de la même compétence/matière. */
  weight: number;
}

/**
 * Note saisie :
 *  - nombre : points obtenus (mode pourcentage)
 *  - chaîne : code de cote (mode lettre) ou 'S' / 'E' (succès / échec)
 *  - 'ABS'  : absent, exclu des calculs
 */
export type Mark = number | string;

export const ABSENT = 'ABS';

export interface AppData {
  version: number;
  settings: Settings;
  terms: Term[];
  groups: Group[];
  students: Student[];
  subjects: Subject[];
  evaluations: Evaluation[];
  /** marks[evaluationId][studentId] */
  marks: Record<string, Record<string, Mark>>;
  /** comments[termId][studentId] */
  comments: Record<string, Record<string, string>>;
}
