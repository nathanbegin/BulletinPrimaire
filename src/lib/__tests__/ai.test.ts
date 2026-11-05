import { describe, expect, it } from 'vitest';
import { normalizeScan, type ScanResult } from '../ai';
import { demoData } from '../defaults';

describe('normalisation du résultat de numérisation', () => {
  it('écarte les identifiants inconnus, les doublons et aligne les valeurs', () => {
    const d = demoData();
    const g = d.groups[0];
    const [s1] = d.students;
    const fr = d.subjects[0];
    const raw = {
      columns: [
        { title: ' Dictée ', subject_id: fr.id, competency_id: 'inexistant', max_score: 20, kind: 'points', date: '12 oct' },
        { title: '', subject_id: 'xyz', competency_id: '', max_score: -1, kind: 'bizarre', date: '2026-10-12' },
      ],
      rows: [
        { name_on_sheet: 'A', student_id: s1.id, values: [{ text: ' 17 ', uncertain: false }] },
        { name_on_sheet: 'B', student_id: s1.id, values: [{ text: '12', uncertain: true }, { text: 'B', uncertain: false }, { text: 'trop', uncertain: false }] },
        { name_on_sheet: 'C', student_id: 'fantome', values: [] },
      ],
      notes: 'ok',
    } as unknown as ScanResult;
    const r = normalizeScan(raw, d, g);
    expect(r.columns[0]).toMatchObject({ title: 'Dictée', subject_id: fr.id, competency_id: '', max_score: 20, date: '' });
    expect(r.columns[1]).toMatchObject({ title: 'Évaluation', subject_id: '', max_score: 0, kind: 'unknown', date: '2026-10-12' });
    expect(r.rows.map((x) => x.student_id)).toEqual([s1.id, '', '']);
    expect(r.rows[0].values).toEqual([{ text: '17', uncertain: false }, { text: '', uncertain: false }]);
    expect(r.rows[1].values).toHaveLength(2);
  });
});
