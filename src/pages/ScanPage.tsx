import { useMemo, useRef, useState } from 'react';
import { useStore, useActiveGroup, useActiveTerm } from '../store';
import { aiConfigured, AIError, prepareFile, scanGradeSheet, type ScanInput, type ScanResult } from '../lib/ai';
import { groupStudents, groupSubjects, parseInput } from '../lib/grading';
import { parseName } from '../lib/names';
import { Icon } from '../components/Icon';
import { navigate } from '../router';
import { shortName } from './GridPage';
import type { Evaluation, GradingMode, Mark, Settings } from '../types';

type PreparedFile = ScanInput['files'][number] & { preview: string; name: string };

interface ColPlan {
  include: boolean;
  target: string; // 'new' ou id d'évaluation existante
  title: string;
  subjectId: string;
  competencyId: string;
  maxScore: number;
  date: string;
}

interface RowPlan {
  target: string; // id élève, '' = ignorer, 'new' = créer
  nameOnSheet: string;
  values: { text: string; uncertain: boolean }[];
}

const MAX_FILES = 6;

export default function ScanPage() {
  const data = useStore((s) => s.data);
  const group = useActiveGroup()!;
  const term = useActiveTerm()!;
  const addEvaluation = useStore((s) => s.addEvaluation);
  const addStudents = useStore((s) => s.addStudents);
  const setMarks = useStore((s) => s.setMarks);

  const [files, setFiles] = useState<PreparedFile[]>([]);
  const [hint, setHint] = useState('');
  const [termId, setTermId] = useState(term.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cols, setCols] = useState<ColPlan[]>([]);
  const [rows, setRows] = useState<RowPlan[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);

  const subjects = groupSubjects(data, group.id);
  const students = groupStudents(data, group.id, true);
  const configured = aiConfigured();

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    try {
      const prepared = await Promise.all([...list].slice(0, MAX_FILES - files.length).map(prepareFile));
      setFiles((f) => [...f, ...prepared].slice(0, MAX_FILES));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const analyse = async () => {
    setBusy(true);
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = await scanGradeSheet(data, group, { files, hint }, ctrl.signal);
      setResult(r);
      setCols(r.columns.map((c, i) => planColumn(c, r, i)));
      setRows(r.rows.map((row) => ({ target: row.student_id, nameOnSheet: row.name_on_sheet, values: row.values })));
    } catch (e) {
      setError(e instanceof AIError ? e.message : `Erreur inattendue : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const planColumn = (c: ScanResult['columns'][number], r: ScanResult, i: number): ColPlan => {
    const subj = subjects.find((s) => s.id === c.subject_id) ?? subjects[0];
    const nums = r.rows.map((row) => parseFloat((row.values[i]?.text ?? '').replace(',', '.'))).filter((n) => isFinite(n));
    const inferredMax = nums.length ? Math.max(...nums) : 0;
    const maxScore = c.max_score > 0 ? c.max_score : inferredMax > 20 ? 100 : inferredMax > 10 ? 20 : inferredMax > 0 ? 10 : 100;
    return {
      include: true,
      target: 'new',
      title: c.title,
      subjectId: subj?.id ?? '',
      competencyId: c.competency_id || subj?.competencies[0]?.id || '',
      maxScore,
      date: c.date || new Date().toISOString().slice(0, 10),
    };
  };

  /** Évaluation (réelle ou fictive) servant à valider les valeurs d'une colonne. */
  const evalFor = (c: ColPlan): { ev: Evaluation; mode: GradingMode } | null => {
    if (c.target !== 'new') {
      const ev = data.evaluations.find((e) => e.id === c.target);
      const s = ev && subjects.find((x) => x.id === ev.subjectId);
      return ev && s ? { ev, mode: s.mode } : null;
    }
    const s = subjects.find((x) => x.id === c.subjectId);
    if (!s) return null;
    return {
      ev: { id: '', groupId: group.id, subjectId: s.id, termId, title: c.title, date: c.date, maxScore: c.maxScore > 0 ? c.maxScore : 100, weight: 1 },
      mode: s.mode,
    };
  };

  const parsed = useMemo(
    () =>
      rows.map((r) =>
        r.values.map((v, i) => {
          const c = cols[i];
          const t = c && evalFor(c);
          if (!c?.include || !t) return { ok: false, skip: true, mark: undefined as Mark | undefined, error: '' };
          const res = parseCell(v.text, t.mode, t.ev, data.settings);
          return 'error' in res ? { ok: false, skip: false, mark: undefined, error: res.error } : { ok: true, skip: false, mark: res.mark, error: '' };
        }),
      ),
    [rows, cols, data, termId],
  );

  const existingTermEvals = data.evaluations.filter((e) => e.groupId === group.id && e.termId === termId);
  const errorCount = parsed.reduce((n, r, ri) => n + (rows[ri].target ? r.filter((c) => !c.ok && !c.skip).length : 0), 0);
  const importCount = parsed.reduce((n, r, ri) => n + (rows[ri].target ? r.filter((c) => c.ok && c.mark !== undefined).length : 0), 0);
  const unmatched = rows.filter((r) => !r.target).length;
  const taken = new Set(rows.map((r) => r.target).filter((t) => t && t !== 'new'));

  const doImport = () => {
    // 1. Élèves à créer
    const newRows = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.target === 'new');
    const before = new Set(useStore.getState().data.students.map((s) => s.id));
    if (newRows.length) addStudents(group.id, newRows.map(({ r }) => parseName(r.nameOnSheet) ?? { firstName: r.nameOnSheet, lastName: '' }));
    const created = useStore.getState().data.students.filter((s) => !before.has(s.id));
    const rowStudent = rows.map((r) => r.target);
    newRows.forEach(({ i }, k) => (rowStudent[i] = created[k]?.id ?? ''));

    // 2. Évaluations
    const colEval = cols.map((c) => {
      if (!c.include) return '';
      if (c.target !== 'new') return c.target;
      const s = subjects.find((x) => x.id === c.subjectId);
      if (!s) return '';
      return addEvaluation({
        groupId: group.id,
        subjectId: s.id,
        competencyId: s.competencies.length ? c.competencyId || s.competencies[0].id : undefined,
        termId,
        title: c.title.trim() || 'Évaluation',
        date: c.date,
        maxScore: c.maxScore > 0 ? c.maxScore : 100,
        weight: 1,
      });
    });

    // 3. Notes
    const marks = useStore.getState().data.marks;
    const entries: { evalId: string; studentId: string; mark: Mark | undefined }[] = [];
    parsed.forEach((r, ri) => {
      const sid = rowStudent[ri];
      if (!sid) return;
      r.forEach((cell, ci) => {
        const evId = colEval[ci];
        if (!evId || !cell.ok || cell.mark === undefined) return;
        if (!overwrite && marks[evId]?.[sid] !== undefined) return;
        entries.push({ evalId: evId, studentId: sid, mark: cell.mark });
      });
    });
    setMarks(entries);
    useStore.getState().setUI({ termId, subjectFilter: null });
    alert(`${entries.length} note(s) importée(s)${newRows.length ? `, ${newRows.length} élève(s) ajouté(s)` : ''}.`);
    navigate('notes');
  };

  // ------------------------------------------------------------------ rendu

  if (!configured) {
    return (
      <div className="page">
        <h1>Numériser un relevé</h1>
        <div className="empty">
          <p>
            La numérisation utilise l’IA Claude pour lire vos relevés papier. Ajoutez d’abord votre clé API dans les réglages.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('reglages')}>
            Configurer l’IA
          </button>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>
            Numériser un relevé <small>{group.name}</small>
          </h1>
        </div>
        <section className="card">
          <h2>1. Photographiez le relevé</h2>
          <p className="muted">
            Une photo nette, bien éclairée et prise de face donne les meilleurs résultats. Jusqu’à {MAX_FILES} pages (photos ou PDF).
          </p>
          <div className="actions left">
            <button className="btn btn-primary" onClick={() => cameraRef.current?.click()} disabled={files.length >= MAX_FILES}>
              <Icon name="camera" size={18} /> Prendre une photo
            </button>
            <button className="btn" onClick={() => pickRef.current?.click()} disabled={files.length >= MAX_FILES}>
              Choisir des fichiers
            </button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={pickRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          {files.length > 0 && (
            <div className="scan-thumbs">
              {files.map((f, i) => (
                <div className="scan-thumb" key={i}>
                  {f.preview ? <img src={f.preview} alt={`Page ${i + 1}`} /> : <div className="scan-pdf">PDF</div>}
                  <span>Page {i + 1}</span>
                  <button className="icon-btn" aria-label="Retirer" onClick={() => setFiles(files.filter((_, k) => k !== i))}>
                    <Icon name="x" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="card form">
          <h2>2. Précisions (facultatif)</h2>
          <label>
            Étape des évaluations
            <select value={termId} onChange={(e) => setTermId(e.target.value)}>
              {data.terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Indications pour l’IA
            <textarea rows={2} value={hint} onChange={(e) => setHint(e.target.value)} placeholder="ex. Les 3 premières colonnes sont des dictées sur 20, la dernière est la SAÉ de mathématique." />
          </label>
        </section>
        {error && <div className="alert error">{error}</div>}
        <div className="actions left">
          <button className="btn btn-primary btn-lg" disabled={!files.length || busy} onClick={analyse}>
            <Icon name="bolt" size={18} /> {busy ? 'Analyse en cours…' : 'Analyser avec l’IA'}
          </button>
          {busy && (
            <button className="btn" onClick={() => abortRef.current?.abort()}>
              Annuler
            </button>
          )}
        </div>
        {busy && <p className="hint">La lecture d’un relevé manuscrit prend habituellement de 20 secondes à 1 minute.</p>}
        <p className="hint">
          Les images et la liste des élèves du groupe sont envoyées au service Claude d’Anthropic pour l’analyse. Rien n’est importé avant votre vérification.
        </p>
      </div>
    );
  }

  return (
    <div className="page page-grid">
      <div className="page-head">
        <h1>
          Vérifier la numérisation <small>{group.name} · {data.terms.find((t) => t.id === termId)?.name}</small>
        </h1>
        <div className="actions">
          <button className="btn" onClick={() => setResult(null)}>
            Recommencer
          </button>
          <button className="btn btn-primary" disabled={!importCount} onClick={doImport}>
            <Icon name="check" size={18} /> Importer {importCount} note{importCount > 1 ? 's' : ''}
          </button>
        </div>
      </div>
      {result.notes && <div className="alert info">🤖 {result.notes}</div>}
      <div className="scan-summary">
        <span>{rows.length} lignes · {cols.filter((c) => c.include).length} évaluation(s)</span>
        {errorCount > 0 && <span className="pill pill-error">{errorCount} case(s) à corriger</span>}
        {unmatched > 0 && <span className="pill pill-warn">{unmatched} élève(s) non associé(s)</span>}
        <span className="pill pill-uncertain">Jaune = lecture incertaine</span>
        <label className="toggle">
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> Remplacer les notes déjà saisies
        </label>
      </div>

      <div className="sheet-wrap scan-sheet">
        <table className="sheet">
          <thead>
            <tr>
              <th className="sticky-col corner">Élève</th>
              {cols.map((c, i) => {
                const subj = subjects.find((s) => s.id === c.subjectId);
                const upd = (p: Partial<ColPlan>) => setCols(cols.map((x, k) => (k === i ? { ...x, ...p } : x)));
                return (
                  <th key={i} className={`scan-col ${c.include ? '' : 'excluded'}`}>
                    <label className="toggle small">
                      <input type="checkbox" checked={c.include} onChange={(e) => upd({ include: e.target.checked })} /> Importer
                    </label>
                    <select value={c.target} onChange={(e) => upd({ target: e.target.value })} aria-label="Destination">
                      <option value="new">+ Nouvelle évaluation</option>
                      {existingTermEvals.map((e) => (
                        <option key={e.id} value={e.id}>
                          {shortName(subjects.find((s) => s.id === e.subjectId)?.name ?? '')} — {e.title}
                        </option>
                      ))}
                    </select>
                    {c.target === 'new' && (
                      <>
                        <input value={c.title} onChange={(e) => upd({ title: e.target.value })} aria-label="Titre" />
                        <select value={c.subjectId} onChange={(e) => upd({ subjectId: e.target.value, competencyId: subjects.find((s) => s.id === e.target.value)?.competencies[0]?.id ?? '' })} aria-label="Matière">
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {shortName(s.name)}
                            </option>
                          ))}
                        </select>
                        {subj && subj.competencies.length > 0 && (
                          <select value={c.competencyId} onChange={(e) => upd({ competencyId: e.target.value })} aria-label="Compétence">
                            {subj.competencies.map((x) => (
                              <option key={x.id} value={x.id}>
                                {shortName(x.name)}
                              </option>
                            ))}
                          </select>
                        )}
                        {subj?.mode === 'percent' && (
                          <div className="input-suffix">
                            <span>sur</span>
                            <input type="number" inputMode="decimal" value={c.maxScore} onChange={(e) => upd({ maxScore: parseFloat(e.target.value) || 0 })} aria-label="Noté sur" />
                          </div>
                        )}
                        {subj && subj.mode !== 'percent' && <small className="muted">{subj.mode === 'letter' ? 'Cotes' : 'Succès / Échec'}</small>}
                      </>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className={r.target ? '' : 'row-ignored'}>
                <th className="sticky-col scan-student">
                  <div className="scan-name">« {r.nameOnSheet || '?'} »</div>
                  <select
                    value={r.target}
                    onChange={(e) => setRows(rows.map((x, k) => (k === ri ? { ...x, target: e.target.value } : x)))}
                    aria-label="Élève correspondant"
                  >
                    <option value="">— Ignorer —</option>
                    <option value="new">+ Ajouter comme nouvel élève</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id} disabled={taken.has(s.id) && s.id !== r.target}>
                        {s.lastName}, {s.firstName}
                      </option>
                    ))}
                  </select>
                </th>
                {r.values.map((v, ci) => {
                  const p = parsed[ri][ci];
                  const cls = ['scan-cell', v.uncertain ? 'uncertain' : '', !p.ok && !p.skip ? 'invalid' : '', p.skip ? 'skip' : ''].join(' ');
                  return (
                    <td key={ci} className={cls} title={p.error || (v.uncertain ? 'Lecture incertaine' : '')}>
                      <input
                        value={v.text}
                        onChange={(e) =>
                          setRows(
                            rows.map((x, k) =>
                              k === ri ? { ...x, values: x.values.map((y, j) => (j === ci ? { text: e.target.value, uncertain: false } : y)) } : x,
                            ),
                          )
                        }
                        aria-label={`Note de ${r.nameOnSheet}`}
                      />
                      {!p.ok && !p.skip && <small className="cell-err">{p.error}</small>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        Vérifiez les cases jaunes (lecture incertaine) et rouges (valeur invalide pour la matière, la raison est indiquée sous la case). Les cases vides ne sont pas importées.
        {` ${rows.filter((r) => r.target && r.target !== 'new').length} élève(s) reconnu(s) automatiquement.`}
      </p>
    </div>
  );
}

/** Valide une case transcrite, en tolérant ½ et les cotes nuancées (B+ → B si l'échelle n'a pas de B+). */
function parseCell(raw: string, mode: GradingMode, ev: Evaluation, settings: Settings) {
  const t = raw.trim().replace('½', ',5').replace(/\s+/g, '');
  const res = parseInput(t, mode, ev, settings);
  if ('error' in res && mode === 'letter' && /[+\-−]$/.test(t)) return parseInput(t.slice(0, -1), mode, ev, settings);
  return res;
}
