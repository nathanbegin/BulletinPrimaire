import { describe, expect, it } from 'vitest';
import { computeStats, median, stdDev, weightedMean } from '../stats';
import { markToPercent, parseInput, percentToLetter, subjectTermResult, subjectYearResult, displayResult } from '../grading';
import { defaultSettings, emptyData, uid } from '../defaults';
import { parseName } from '../names';
import type { AppData, Evaluation, Subject } from '../../types';

const settings = defaultSettings();
const ev: Evaluation = { id: 'e', groupId: 'g', subjectId: 's', termId: 't', title: 'T', date: '2026-01-01', maxScore: 20, weight: 1 };

describe('stats', () => {
  it('médiane, écart type, moyenne pondérée', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
    expect(weightedMean([{ value: 80, weight: 1 }, { value: 60, weight: 3 }, { value: null, weight: 5 }])).toBe(65);
    const s = computeStats([50, 70, 90], 60);
    expect(s.mean).toBe(70);
    expect(s.successRate).toBeCloseTo(2 / 3);
    expect(computeStats([]).mean).toBeNull();
  });
});

describe('saisie', () => {
  it('pourcentage : points, virgule, fraction, %', () => {
    expect(parseInput('17', 'percent', ev, settings)).toEqual({ mark: 17 });
    expect(parseInput('15,5', 'percent', ev, settings)).toEqual({ mark: 15.5 });
    expect(parseInput('8/10', 'percent', ev, settings)).toEqual({ mark: 16 });
    expect(parseInput('75%', 'percent', ev, settings)).toEqual({ mark: 15 });
    expect('error' in parseInput('25', 'percent', ev, settings)).toBe(true);
    expect(parseInput('abs', 'percent', ev, settings)).toEqual({ mark: 'ABS' });
    expect(parseInput('', 'percent', ev, settings)).toEqual({ mark: undefined });
  });
  it('cotes et succès/échec', () => {
    expect(parseInput('b', 'letter', ev, settings)).toEqual({ mark: 'B' });
    expect('error' in parseInput('Z', 'letter', ev, settings)).toBe(true);
    expect(parseInput('é', 'passfail', ev, settings)).toEqual({ mark: 'E' });
    expect(parseInput('s', 'passfail', ev, settings)).toEqual({ mark: 'S' });
  });
  it('conversions', () => {
    expect(markToPercent(15, 'percent', ev, settings)).toBe(75);
    expect(markToPercent('A', 'letter', ev, settings)).toBe(95);
    expect(markToPercent('ABS', 'percent', ev, settings)).toBeNull();
    expect(percentToLetter(84, settings.letterScale)).toBe('B');
    expect(percentToLetter(12, settings.letterScale)).toBe('F');
    expect(displayResult(59.6, 'passfail', settings)).toBe('Succès');
  });
  it('noms', () => {
    expect(parseName('Léa Tremblay')).toEqual({ firstName: 'Léa', lastName: 'Tremblay' });
    expect(parseName('Gagnon, Félix')).toEqual({ firstName: 'Félix', lastName: 'Gagnon' });
    expect(parseName('Roy\tAlice')).toEqual({ firstName: 'Alice', lastName: 'Roy' });
  });
});

describe('résultats', () => {
  const d: AppData = emptyData();
  const [t1, t2, t3] = d.terms;
  const subj: Subject = {
    id: 's', groupId: 'g', name: 'Français', mode: 'percent', order: 0,
    competencies: [{ id: 'lire', name: 'Lire', weight: 50 }, { id: 'ecrire', name: 'Écrire', weight: 30 }, { id: 'oral', name: 'Oral', weight: 20 }],
  };
  d.subjects.push(subj);
  const add = (termId: string, comp: string, max: number, mark: number, weight = 1) => {
    const e = { ...ev, id: uid(), termId, competencyId: comp, maxScore: max, weight };
    d.evaluations.push(e);
    d.marks[e.id] = { st: mark };
  };
  add(t1.id, 'lire', 20, 16); // 80
  add(t1.id, 'lire', 10, 6, 3); // 60 (poids 3) => lire = 65
  add(t1.id, 'ecrire', 40, 36); // 90
  // oral : aucune évaluation -> pondération renormalisée
  it('pondération des compétences', () => {
    // (65*50 + 90*30) / 80 = 74.375
    expect(subjectTermResult(d, subj, t1.id, 'st')).toBeCloseTo(74.375);
  });
  it('résultat final pondéré par étape', () => {
    add(t2.id, 'lire', 10, 10); // 100
    add(t3.id, 'lire', 10, 5); // 50
    // (74.375*20 + 100*20 + 50*60) / 100
    expect(subjectYearResult(d, subj, 'st')).toBeCloseTo(64.875);
    // jusqu'à l'étape 2 seulement
    expect(subjectYearResult(d, subj, 'st', undefined, t2.id)).toBeCloseTo((74.375 + 100) / 2);
  });
});
