import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, useActiveGroup, useActiveTerm } from '../store';
import { evalPercents, fmtNum, formatMark, groupStudents, groupSubjects, markToPercent, parseInput, studentName } from '../lib/grading';
import { computeStats } from '../lib/stats';
import { Keypad } from '../components/Keypad';
import { StatsSummary } from '../components/StatsSummary';
import { Icon } from '../components/Icon';
import { navigate } from '../router';
import type { Mark } from '../types';
import { shortName } from './GridPage';
import { SupportBadges } from '../components/SupportBadges';
import { supportSummary } from '../lib/support';

export default function QuickEntryPage({ evalId }: { evalId?: string }) {
  const data = useStore((s) => s.data);
  const setMark = useStore((s) => s.setMark);
  const group = useActiveGroup()!;
  const term = useActiveTerm()!;
  const ev = data.evaluations.find((e) => e.id === evalId);
  const subject = ev && data.subjects.find((s) => s.id === ev.subjectId);
  const students = useMemo(() => groupStudents(data, ev?.groupId ?? group.id), [data.students, ev?.groupId, group.id]);
  const marks = (ev && data.marks[ev.id]) || {};

  const [skipFilled, setSkipFilled] = useState(false);
  const [idx, setIdx] = useState(() => {
    const first = students.findIndex((s) => marks[s.id] === undefined);
    return first < 0 ? 0 : first;
  });
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft('');
    setError(null);
    listRef.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [idx, evalId]);

  const termEvals = useMemo(() => {
    const order = new Map(groupSubjects(data, group.id).map((s) => [s.id, s.order]));
    return data.evaluations
      .filter((e) => e.groupId === group.id && e.termId === term.id)
      .sort((a, b) => (order.get(a.subjectId) ?? 0) - (order.get(b.subjectId) ?? 0) || a.date.localeCompare(b.date));
  }, [data.evaluations, data.subjects, group.id, term.id]);

  const goNext = (justFilled?: string) => {
    for (let i = idx + 1; i < students.length; i++) {
      const filled = students[i].id === justFilled || marks[students[i].id] !== undefined;
      if (!skipFilled || !filled) {
        setIdx(i);
        return;
      }
    }
    setDone(true);
  };
  const goPrev = () => {
    setDone(false);
    setIdx((i) => Math.max(0, i - 1));
  };

  const student = students[idx];

  const save = (m: Mark | undefined) => {
    if (!ev || !student) return;
    setMark(ev.id, student.id, m);
    goNext(student.id);
  };

  const commit = () => {
    if (!ev || !subject) return;
    if (draft === '') return goNext();
    const res = parseInput(draft, subject.mode, ev, data.settings);
    if ('error' in res) return setError(res.error);
    save(res.mark);
  };

  // Clavier physique (ordinateur, tablette avec clavier)
  useEffect(() => {
    if (!ev || !subject) return;
    const on = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (done) return;
        commit();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setDraft((d) => d.slice(0, -1));
        setError(null);
      } else if (e.key === 'Delete') {
        if (student) setMark(ev.id, student.id, undefined);
      } else if (e.key.length === 1 && !done) {
        if (subject.mode !== 'percent') {
          const res = parseInput(e.key, subject.mode, ev, data.settings);
          if (!('error' in res)) {
            e.preventDefault();
            save(res.mark);
          }
          return;
        }
        if (/^[0-9.,/%a-zA-Z]$/.test(e.key)) {
          e.preventDefault();
          setDraft((d) => (d + e.key).slice(0, 8));
          setError(null);
        }
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  if (!ev || !subject) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>Saisie rapide <small>{term.name}</small></h1>
        </div>
        <p>Choisissez l’évaluation à saisir :</p>
        <div className="card-list">
          {termEvals.map((e) => {
            const s = data.subjects.find((x) => x.id === e.subjectId);
            const n = Object.keys(data.marks[e.id] ?? {}).length;
            return (
              <button key={e.id} className="card-item" onClick={() => navigate(`saisie/${e.id}`)}>
                <span className="ci-sub">{shortName(s?.name ?? '')}</span>
                <span className="ci-title">{e.title}</span>
                <span className="ci-meta">{n}/{students.length} notes</span>
              </button>
            );
          })}
          {!termEvals.length && <div className="empty small">Aucune évaluation pour cette étape.</div>}
        </div>
      </div>
    );
  }

  const comp = subject.competencies.find((c) => c.id === ev.competencyId);
  const filledCount = students.filter((s) => marks[s.id] !== undefined).length;
  const stats = computeStats(evalPercents(data, ev, students.map((s) => s.id)), data.settings.passThreshold);
  const evIdx = termEvals.findIndex((e) => e.id === ev.id);
  const nextEval = termEvals[evIdx + 1];
  const current = student ? marks[student.id] : undefined;
  const currentPct = student ? markToPercent(current, subject.mode, ev, data.settings) : null;

  return (
    <div className="quick">
      <div className="quick-top">
        <button className="icon-btn" onClick={() => navigate('notes')} aria-label="Retour aux notes">
          <Icon name="back" />
        </button>
        <select
          className="quick-eval-select"
          value={ev.id}
          onChange={(e) => {
            setDone(false);
            setIdx(0);
            navigate(`saisie/${e.target.value}`);
          }}
        >
          {termEvals.map((e) => {
            const s = data.subjects.find((x) => x.id === e.subjectId);
            return (
              <option key={e.id} value={e.id}>
                {shortName(s?.name ?? '')} — {e.title}
              </option>
            );
          })}
        </select>
      </div>
      <div className="quick-sub">
        {shortName(subject.name)}
        {comp && ` · ${comp.name}`}
        {subject.mode === 'percent' && ` · sur ${fmtNum(ev.maxScore)}`} ·{' '}
        <strong>
          {filledCount}/{students.length}
        </strong>{' '}
        saisies
        <div className="progress">
          <div style={{ width: `${(filledCount / Math.max(1, students.length)) * 100}%` }} />
        </div>
      </div>

      <div className="quick-body">
        <div className="quick-main">
          {done ? (
            <div className="quick-done">
              <Icon name="check" size={40} />
              <h2>Fin de la liste</h2>
              <p>
                {filledCount}/{students.length} élèves notés.
              </p>
              <div className="actions center">
                <button className="btn" onClick={() => { setDone(false); setIdx(0); }}>
                  Revoir depuis le début
                </button>
                {nextEval && (
                  <button className="btn btn-primary" onClick={() => { setDone(false); setIdx(0); navigate(`saisie/${nextEval.id}`); }}>
                    Évaluation suivante
                  </button>
                )}
                <button className="btn" onClick={() => navigate('notes')}>
                  Retour au tableau
                </button>
              </div>
            </div>
          ) : (
            student && (
              <>
                <div className="quick-card">
                  <div className="qc-pos">
                    Élève {idx + 1} / {students.length}
                  </div>
                  <div className="qc-name">
                    {studentName(student)} <SupportBadges student={student} />
                  </div>
                  {supportSummary(student) && <div className="qc-support">{supportSummary(student)}</div>}
                  <div className={`qc-value ${error ? 'error' : ''} ${draft ? 'typing' : ''}`}>
                    {error ? error : draft || formatMark(current, subject.mode) || <span className="muted">—</span>}
                    {subject.mode === 'percent' && !error && <span className="qc-max">/{fmtNum(ev.maxScore)}</span>}
                  </div>
                  <div className="qc-pct">
                    {!draft && currentPct !== null && subject.mode === 'percent' ? `${fmtNum(currentPct, 1)} %` : ' '}
                  </div>
                </div>
                <Keypad
                  mode={subject.mode}
                  scale={data.settings.letterScale}
                  maxScore={ev.maxScore}
                  draft={draft}
                  setDraft={(s) => {
                    setDraft(s);
                    setError(null);
                  }}
                  onCommit={commit}
                  onPick={save}
                  onClear={() => {
                    setMark(ev.id, student.id, undefined);
                    setDraft('');
                  }}
                  onPrev={goPrev}
                  onNext={() => goNext()}
                />
              </>
            )
          )}
          <label className="toggle">
            <input type="checkbox" checked={skipFilled} onChange={(e) => setSkipFilled(e.target.checked)} /> Sauter les élèves déjà notés
          </label>
        </div>

        <aside className="quick-side">
          <StatsSummary stats={stats} total={students.length} compact />
          <div className="quick-list" ref={listRef}>
            {students.map((s, i) => {
              const m = marks[s.id];
              const p = markToPercent(m, subject.mode, ev, data.settings);
              return (
                <button
                  key={s.id}
                  data-i={i}
                  className={`ql-item ${i === idx && !done ? 'active' : ''}`}
                  onClick={() => {
                    setDone(false);
                    setIdx(i);
                  }}
                >
                  <span>
                    {studentName(s)} <SupportBadges student={s} />
                  </span>
                  <span className={`ql-mark ${p !== null && p < data.settings.passThreshold ? 'low' : ''}`}>
                    {formatMark(m, subject.mode) || '·'}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
