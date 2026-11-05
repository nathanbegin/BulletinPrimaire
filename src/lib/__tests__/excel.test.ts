import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildGroupWorkbookData } from '../excel';
import { demoData } from '../defaults';
import { groupsByYear } from '../support';

describe('export Excel', () => {
  it('construit un classeur valide pour la démo', () => {
    const d = demoData();
    const sheets = buildGroupWorkbookData(d, d.groups[0]);
    const names = sheets.map((s) => s.name);
    expect(names).toContain('Résultats');
    expect(names).toContain('Élèves');
    expect(names.some((n) => n.startsWith('Étape 1'))).toBe(true);
    expect(names.every((n) => n.length <= 31)).toBe(true);
    const wb = XLSX.utils.book_new();
    for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    expect(buf.length).toBeGreaterThan(1000);
    const eleves = sheets.find((s) => s.name === 'Élèves')!;
    expect(eleves.rows.filter((r) => r[4] === 'Oui').length).toBe(2); // 2 élèves avec PI
  });
  it('trie les groupes par année scolaire', () => {
    const d = demoData();
    d.groups.push({ id: 'x', name: 'Ancien', level: '', schoolYear: '2020-2021' });
    expect(groupsByYear(d).map((y) => y.year).at(-1)).toBe('2020-2021');
  });
});
