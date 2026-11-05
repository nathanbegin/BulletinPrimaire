/** Interprète une ligne « Prénom Nom », « Nom, Prénom » ou « Nom<TAB>Prénom ». */
export function parseName(line: string): { firstName: string; lastName: string } | null {
  const t = line.trim();
  if (!t) return null;
  if (t.includes('\t')) {
    const [a, b] = t.split('\t').map((x) => x.trim());
    return { lastName: a, firstName: b ?? '' };
  }
  if (t.includes(',')) {
    const [a, b] = t.split(',').map((x) => x.trim());
    return { lastName: a, firstName: b ?? '' };
  }
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
