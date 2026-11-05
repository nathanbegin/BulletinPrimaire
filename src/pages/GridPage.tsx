import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore, useActiveGroup, useActiveTerm } from '../store';
import {
  competencyResult,
  displayResult,
  evalPercents,
  fmtNum,
  formatMark,
  groupStudents,
  groupSubjects,
  markToPercent,
  parseInput,
  studentName,
  subjectTermResult,
} from '../lib/grading';
import { computeStats, type Stats } from '../lib/stats';
import { ABSENT, type Evaluation, type Mark, type Subject } from '../types';
import { Keypad } from '../components/Keypad';
import { EvaluationForm } from '../components/EvaluationForm';
import { Icon } from '../components/Icon';
import { PrintFrame, printNow } from '../components/Print';
import { navigate } from '../router';
import { SupportBadges } from '../components/SupportBadges';
import { exportGroupWorkbook } from '../lib/excel';

const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

interface ResultCol {
  key: string;
  label: string;
  sub: string;
  subject: Subject;
  competencyId: string | null | undefined; // undefined = résultat de la matière
}

export default function GridPage() {
  const data = useStore((s) => s.data);
  const subjectFilter = useStore((s) => s.ui.subjectFilter);
  const setUI = useStore((s) => s.setUI);
  const setMark = useStore((s) => s.setMark);
  const setMarks = useStore((s) => s.setMarks);
  const group = useActiveGroup()!;
  const term = useActiveTerm()!;
  const { settings } = data;

  const students = useMemo(() => groupStudents(data, group.id), [data.students, group.id]);
  const subjects = useMemo(() => groupSubjects(data, group.id), [data.subjects, group.id]);
  const subjMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const filterSubject = subjectFilter ? subjMap.get(subjectFilter) : undefined;

  const evals = useMemo(
    () =>
      data.evaluations
        .filter((e) => e.groupId === group.id && e.termId === term.id && (!filterSubject || e.subjectId === filterSubject.id))
        .sort((a, b) => (subjMap.get(a.subjectId)?.order ?? 0) - (subjMap.get(b.subjectId)?.order ?? 0) || a.date.localeCompare(b.date)),
    [data.evaluations, group.id, term.id, filterSubject, subjMap],
  );

  const resultCols: ResultCol[] = useMemo(() => {
    if (filterSubject) {
      return [
        ...filterSubject.competencies.map((c) => ({
          key: c.id,
          label: c.name,
          sub: `${c.weight} %`,
          subject: filterSubject,
          competencyId: c.id,
        })),
        { key: 'total', label: 'Résultat', sub: term.name, subject: filterSubject, competencyId: undefined },
      ];
    }
    return subjects.map((s) => ({ key: s.id, label: s.name, sub: 'Résultat', subject: s, competencyId: undefined }));
  }, [filterSubject, subjects, term.name]);

  const [showPct, setShowPct] = useState(false);
  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [formFor, setFormFor] = useState<Evaluation | 'new' | null>(null);
  const [touch] = useState(isTouch);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(false);
  const entryRef = useRef<HTMLDivElement>(null);
  const [entryH, setEntryH] = useState(0);

  // Garder la sélection dans les bornes
  useEffect(() => {
    if (active && (active.r >= students.length || active.c >= evals.length)) setActive(null);
  }, [students.length, evals.length, active]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const entryOpen = touch && !!active;
  useLayoutEffect(() => {
    if (!entryOpen) return setEntryH(0);
    const el = entryRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setEntryH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [entryOpen]);

  const cellEval = active ? evals[active.c] : undefined;
  const cellStudent = active ? students[active.r] : undefined;
  const cellSubject = cellEval ? subjMap.get(cellEval.subjectId) : undefined;

  const scrollTo = (r: number, c: number) => {
    requestAnimationFrame(() => {
      wrapRef.current?.querySelector(`[data-cell="${r}-${c}"]`)?.scrollIntoView({ block: touch ? 'center' : 'nearest', inline: 'nearest' });
    });
  };

  const select = (r: number, c: number) => {
    const rr = Math.max(0, Math.min(students.length - 1, r));
    const cc = Math.max(0, Math.min(evals.length - 1, c));
    setActive({ r: rr, c: cc });
    setEditing(false);
    setDraft('');
    setError(null);
    if (!touch) wrapRef.current?.focus({ preventScroll: true });
    scrollTo(rr, cc);
  };

  const move = (dr: number, dc: number) => {
    if (!active) return;
    select(active.r + dr, active.c + dc);
  };

  /** Valide le brouillon ; renvoie true si OK. */
  const commit = (): boolean => {
    if (!cellEval || !cellStudent || !cellSubject) return false;
    if (touch && draft === '') return true; // garde la valeur existante
    const res = parseInput(draft, cellSubject.mode, cellEval, settings);
    if ('error' in res) {
      setError(res.error);
      return false;
    }
    setMark(cellEval.id, cellStudent.id, res.mark);
    setEditing(false);
    setError(null);
    return true;
  };

  const pick = (m: Mark) => {
    if (!cellEval || !cellStudent) return;
    setMark(cellEval.id, cellStudent.id, m);
    move(1, 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!active || !cellEval || !cellSubject) return;
    if (editing) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (commit()) move(e.shiftKey ? -1 : 1, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commit()) move(-1, 0);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (commit()) move(0, e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        cancelRef.current = true;
        setEditing(false);
        setError(null);
        wrapRef.current?.focus();
      }
      return;
    }
    const k = e.key;
    if (k === 'ArrowDown' || k === 'Enter') { e.preventDefault(); move(e.shiftKey ? -1 : 1, 0); }
    else if (k === 'ArrowUp') { e.preventDefault(); move(-1, 0); }
    else if (k === 'ArrowLeft') { e.preventDefault(); move(0, -1); }
    else if (k === 'ArrowRight') { e.preventDefault(); move(0, 1); }
    else if (k === 'Tab') { e.preventDefault(); move(0, e.shiftKey ? -1 : 1); }
    else if (k === 'Home') { e.preventDefault(); select(active.r, 0); }
    else if (k === 'End') { e.preventDefault(); select(active.r, evals.length - 1); }
    else if (k === 'F2') {
      e.preventDefault();
      setEditing(true);
      setDraft(formatMark(data.marks[cellEval.id]?.[cellStudent!.id], cellSubject.mode).replace('.', ','));
    } else if (k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      setMark(cellEval.id, cellStudent!.id, undefined);
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      // Saisie directe d'une cote/S/É : enregistre et avance immédiatement
      if (cellSubject.mode !== 'percent') {
        const res = parseInput(k, cellSubject.mode, cellEval, settings);
        if (!('error' in res)) {
          pick(res.mark!);
          return;
        }
      }
      setEditing(true);
      setDraft(k);
      setError(null);
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (!active || editing) return;
    const text = e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    const rows = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
    const entries: { evalId: string; studentId: string; mark: Mark | undefined }[] = [];
    let errors = 0;
    rows.forEach((cols, dr) => {
      const st = students[active.r + dr];
      if (!st) return;
      cols.forEach((raw, dc) => {
        const ev = evals[active.c + dc];
        const subj = ev && subjMap.get(ev.subjectId);
        if (!ev || !subj) return;
        const res = parseInput(raw, subj.mode, ev, settings);
        if ('error' in res) errors++;
        else entries.push({ evalId: ev.id, studentId: st.id, mark: res.mark });
      });
    });
    setMarks(entries);
    setToast(`${entries.length} note(s) collée(s)${errors ? ` · ${errors} ignorée(s)` : ''}`);
  };

  const resultValue = (col: ResultCol, studentId: string) =>
    col.competencyId === undefined
      ? subjectTermResult(data, col.subject, term.id, studentId)
      : competencyResult(data, col.subject, col.competencyId, term.id, studentId);

  // Statistiques de pied de tableau
  const evalStats = evals.map((ev) => computeStats(evalPercents(data, ev, students.map((s) => s.id)), settings.passThreshold));
  const resStats = resultCols.map((col) =>
    computeStats(
      students.map((s) => resultValue(col, s.id)).filter((v): v is number => v !== null),
      settings.passThreshold,
    ),
  );

  if (!students.length || !subjects.length) {
    return (
      <div className="page">
        <h1>Notes</h1>
        <div className="empty">
          {!students.length && <p>Ce groupe ne contient aucun élève.</p>}
          {!subjects.length && <p>Aucune matière n’est configurée pour ce groupe.</p>}
          <button className="btn btn-primary" onClick={() => navigate(!students.length ? 'groupe/eleves' : 'groupe/matieres')}>
            Configurer le groupe
          </button>
        </div>
      </div>
    );
  }

  const hasPercent = evals.some((e) => subjMap.get(e.subjectId)?.mode === 'percent');

  return (
    <div className={`page page-grid ${entryOpen ? 'entry-open' : ''}`}>
      <div className="page-head">
        <h1>
          Notes <small>{group.name} · {term.name}</small>
        </h1>
        <div className="actions">
          {hasPercent && (
            <label className="toggle">
              <input type="checkbox" checked={showPct} onChange={(e) => setShowPct(e.target.checked)} /> Afficher en %
            </label>
          )}
          <button className="btn" onClick={() => navigate('numeriser')} title="Numériser un relevé papier avec l’IA">
            <Icon name="camera" size={18} /> Numériser
          </button>
          <button className="btn" onClick={printNow} title="Imprimer ou enregistrer en PDF">
            <Icon name="print" size={18} /> PDF
          </button>
          <button className="btn" onClick={() => exportGroupWorkbook(data, group)} title="Exporter le groupe en Excel">
            <Icon name="download" size={18} /> Excel
          </button>
          <button className="btn btn-primary" onClick={() => setFormFor('new')}>
            <Icon name="plus" size={18} /> Évaluation
          </button>
        </div>
      </div>

      <div className="chips" role="tablist">
        <button className={`chip ${!filterSubject ? 'active' : ''}`} onClick={() => setUI({ subjectFilter: null })}>
          Toutes
        </button>
        {subjects.map((s) => (
          <button key={s.id} className={`chip ${filterSubject?.id === s.id ? 'active' : ''}`} onClick={() => setUI({ subjectFilter: s.id })}>
            {shortName(s.name)}
          </button>
        ))}
      </div>

      {!evals.length && (
        <div className="empty small">
          Aucune évaluation {filterSubject ? `en ${filterSubject.name} ` : ''}pour {term.name}.{' '}
          <button className="link" onClick={() => setFormFor('new')}>
            Créer une évaluation
          </button>
        </div>
      )}

      <PrintFrame group={group} title={`Relevé de notes — ${term.name}`} subtitle={filterSubject ? filterSubject.name : 'Toutes les matières'}>
      <div
        className="sheet-wrap"
        ref={wrapRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        style={entryOpen && entryH ? { maxHeight: `calc(100dvh - var(--top-h) - var(--nav-h) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - ${entryH + 16}px)` } : undefined}
      >
        <table className="sheet">
          <thead>
            <tr>
              <th className="sticky-col corner">Élève</th>
              {evals.map((ev, c) => {
                const subj = subjMap.get(ev.subjectId)!;
                const comp = subj.competencies.find((x) => x.id === ev.competencyId);
                return (
                  <th key={ev.id} className={`eval-col ${active?.c === c ? 'col-active' : ''}`}>
                    <div className="th-subject">{shortName(subj.name)}{comp ? ` · ${shortName(comp.name)}` : ''}</div>
                    <button className="th-title" title={ev.title} onClick={() => setFormFor(ev)}>
                      {ev.title}
                    </button>
                    <div className="th-meta">
                      {subj.mode === 'percent' ? `/${fmtNum(ev.maxScore)}` : subj.mode === 'letter' ? 'Cote' : 'S/É'}
                      {ev.weight !== 1 && ` · ×${fmtNum(ev.weight)}`}
                      <button className="th-quick" title="Saisie rapide" onClick={() => navigate(`saisie/${ev.id}`)}>
                        <Icon name="bolt" size={14} />
                      </button>
                    </div>
                  </th>
                );
              })}
              {resultCols.map((col) => (
                <th key={col.key} className={`result-col ${col.competencyId === undefined && filterSubject ? 'result-total' : ''}`}>
                  <div className="th-subject">{col.sub}</div>
                  <div className="th-title static" title={col.label}>{shortName(col.label)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((st, r) => (
              <tr key={st.id} className={active?.r === r ? 'row-active' : ''}>
                <th className="sticky-col student-cell">
                  <span className="st-last">{st.lastName}</span>, {st.firstName}
                  <SupportBadges student={st} />
                </th>
                {evals.map((ev, c) => {
                  const subj = subjMap.get(ev.subjectId)!;
                  const mark = data.marks[ev.id]?.[st.id];
                  const pct = markToPercent(mark, subj.mode, ev, settings);
                  const isActive = active?.r === r && active?.c === c;
                  const cls = [
                    'cell',
                    isActive ? 'active' : '',
                    mark === ABSENT ? 'abs' : '',
                    pct !== null && pct < settings.passThreshold ? 'low' : '',
                    isActive && error ? 'error' : '',
                  ].join(' ');
                  return (
                    <td
                      key={ev.id}
                      data-cell={`${r}-${c}`}
                      className={cls}
                      onMouseDown={(e) => {
                        if (isActive && editing) return;
                        e.preventDefault();
                        if (editing && !touch && !commit()) return;
                        wrapRef.current?.focus({ preventScroll: true });
                        select(r, c);
                      }}
                      onDoubleClick={() => {
                        if (touch) return;
                        setEditing(true);
                        setDraft(formatMark(mark, subj.mode).replace('.', ','));
                      }}
                    >
                      {isActive && editing && !touch ? (
                        <input
                          className="cell-input"
                          autoFocus
                          value={draft}
                          onChange={(e) => {
                            setDraft(e.target.value);
                            setError(null);
                          }}
                          onBlur={() => {
                            if (cancelRef.current) cancelRef.current = false;
                            else commit();
                          }}
                        />
                      ) : isActive && touch && draft ? (
                        <span className="draft">{draft}</span>
                      ) : showPct && subj.mode === 'percent' && pct !== null ? (
                        fmtNum(pct, 0) + ' %'
                      ) : (
                        formatMark(mark, subj.mode)
                      )}
                    </td>
                  );
                })}
                {resultCols.map((col) => {
                  const v = resultValue(col, st.id);
                  return (
                    <td key={col.key} className={`result ${v !== null && v < settings.passThreshold ? 'low' : ''} ${col.competencyId === undefined && filterSubject ? 'result-total' : ''}`}>
                      {displayResult(v, col.subject.mode, settings)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            {(
              [
                ['Moyenne', (s: Stats) => s.mean],
                ['Médiane', (s: Stats) => s.median],
                ['Écart type', (s: Stats) => s.stdDev],
              ] as const
            ).map(([label, get]) => (
              <tr key={label}>
                <th className="sticky-col">{label}</th>
                {evalStats.map((s, i) => (
                  <td key={evals[i].id}>{get(s) === null ? '–' : fmtNum(get(s), 1)}</td>
                ))}
                {resStats.map((s, i) => (
                  <td key={resultCols[i].key} className="result">
                    {get(s) === null ? '–' : fmtNum(get(s), 1)}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      </PrintFrame>
      {!touch && evals.length > 0 && (
        <p className="hint no-print">
          Cliquez une cellule et tapez la note : <kbd>Entrée</kbd> passe à l’élève suivant, <kbd>Tab</kbd> à l’évaluation suivante,
          flèches pour naviguer, <kbd>Suppr</kbd> pour effacer. Collez une colonne depuis Excel avec <kbd>Ctrl</kbd>+<kbd>V</kbd>.
          Statistiques de pied en %. Tapez <kbd>abs</kbd> pour un absent.
        </p>
      )}

      {touch && active && cellEval && cellStudent && cellSubject && (
        <div className="entry-sheet" ref={entryRef}>
          <div className="entry-sheet-head">
            <div>
              <div className="es-student">
                {studentName(cellStudent)} <SupportBadges student={cellStudent} />
              </div>
              <div className="es-eval">
                {cellEval.title} {cellSubject.mode === 'percent' && `· /${fmtNum(cellEval.maxScore)}`}
              </div>
            </div>
            <div className={`es-value ${error ? 'error' : ''}`}>
              {error ?? (draft || formatMark(data.marks[cellEval.id]?.[cellStudent.id], cellSubject.mode) || '—')}
            </div>
            <button className="icon-btn" aria-label="Fermer" onClick={() => setActive(null)}>
              <Icon name="x" />
            </button>
          </div>
          <Keypad
            compact
            mode={cellSubject.mode}
            scale={settings.letterScale}
            maxScore={cellEval.maxScore}
            draft={draft}
            setDraft={(s) => {
              setDraft(s);
              setError(null);
            }}
            onCommit={() => commit() && move(1, 0)}
            onPick={pick}
            onClear={() => {
              setMark(cellEval.id, cellStudent.id, undefined);
              setDraft('');
            }}
            onPrev={() => move(-1, 0)}
            onNext={() => move(1, 0)}
          />
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
      {formFor && (
        <EvaluationForm
          groupId={group.id}
          termId={term.id}
          evaluation={formFor === 'new' ? undefined : formFor}
          defaultSubjectId={filterSubject?.id}
          onClose={() => setFormFor(null)}
          onSaved={(id, open) => open && navigate(`saisie/${id}`)}
        />
      )}
    </div>
  );
}

export function shortName(name: string): string {
  const map: Record<string, string> = {
    'Français, langue d’enseignement': 'Français',
    'Anglais, langue seconde': 'Anglais',
    'Géographie, histoire et éducation à la citoyenneté': 'Univers social',
    'Culture et citoyenneté québécoise': 'CCQ',
    'Éducation physique et à la santé': 'Éduc. physique',
    'Science et technologie': 'Sciences',
    'Résoudre une situation-problème': 'Résoudre',
    'Utiliser un raisonnement mathématique': 'Raisonner',
    'Communiquer oralement': 'Oral',
    'Communicate orally in English': 'Oral',
    'Understand texts read and heard': 'Understand',
    'Write texts': 'Write',
  };
  return map[name] ?? name;
}
