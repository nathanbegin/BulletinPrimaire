import { Fragment } from 'react';
import { useStore, useActiveGroup, useActiveTerm } from '../store';
import {
  competencyResult,
  displayResult,
  evalPercents,
  fmtNum,
  fmtPct,
  formatMark,
  groupStudents,
  groupSubjects,
  markToPercent,
  studentName,
  studentTermAverage,
  subjectTermResult,
  subjectTermStats,
  subjectYearResult,
} from '../lib/grading';
import { computeStats, mean, type Stats } from '../lib/stats';
import { StatsSummary } from '../components/StatsSummary';
import { Histogram } from '../components/Histogram';
import { navigate } from '../router';
import { shortName } from './GridPage';
import type { AppData, Evaluation, Group, Term } from '../types';

export default function StatsPage({ tab = 'groupe', itemId }: { tab?: string; itemId?: string }) {
  const data = useStore((s) => s.data);
  const group = useActiveGroup()!;
  const term = useActiveTerm()!;
  const tabs = [
    ['groupe', 'Groupe'],
    ['evaluation', 'Évaluation'],
    ['eleve', 'Élève'],
  ];
  return (
    <div className="page">
      <div className="page-head">
        <h1>
          Statistiques <small>{group.name} · {term.name}</small>
        </h1>
      </div>
      <div className="tabs">
        {tabs.map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => navigate(`stats/${k}`)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'evaluation' && <EvalStats data={data} group={group} term={term} evalId={itemId} />}
      {tab === 'eleve' && <StudentStats data={data} group={group} term={term} studentId={itemId} />}
      {tab === 'groupe' && <GroupStats data={data} group={group} term={term} />}
    </div>
  );
}

function StatCells({ s }: { s: Stats }) {
  return (
    <>
      <td className="num">{s.count}</td>
      <td className="num strong">{fmtPct(s.mean)}</td>
      <td className="num">{fmtPct(s.median)}</td>
      <td className="num">{fmtNum(s.stdDev)}</td>
      <td className="num">{s.min === null ? '–' : `${fmtNum(s.min, 0)}–${fmtNum(s.max, 0)}`}</td>
      <td className="num">{s.successRate === null ? '–' : `${fmtNum(s.successRate * 100, 0)} %`}</td>
    </>
  );
}
const STAT_HEAD = (
  <>
    <th className="num">n</th>
    <th className="num">Moyenne</th>
    <th className="num">Médiane</th>
    <th className="num">Écart type</th>
    <th className="num">Min–Max</th>
    <th className="num">Réussite</th>
  </>
);

function GroupStats({ data, group, term }: { data: AppData; group: Group; term: Term }) {
  const subjects = groupSubjects(data, group.id);
  const students = groupStudents(data, group.id);
  const avgs = students.map((s) => studentTermAverage(data, group.id, term.id, s.id)).filter((v): v is number => v !== null);
  const overall = computeStats(avgs, data.settings.passThreshold);
  return (
    <>
      <section className="card">
        <h2>Moyenne générale des élèves</h2>
        <StatsSummary stats={overall} total={students.length} />
        {avgs.length > 0 && <Histogram values={avgs} scale={data.settings.letterScale} threshold={data.settings.passThreshold} />}
      </section>
      <section className="card">
        <h2>Par matière et compétence</h2>
        <div className="table-scroll">
          <table className="list-table">
            <thead>
              <tr>
                <th>Matière</th>
                {STAT_HEAD}
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <SubjectRows key={s.id} data={data} subject={s} term={term} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">Statistiques calculées sur les résultats d’étape des élèves (en %). Écart type de population.</p>
      </section>
    </>
  );
}

function SubjectRows({ data, subject, term }: { data: AppData; subject: AppData['subjects'][number]; term: Term }) {
  return (
    <>
      <tr className="row-strong">
        <td>{subject.name}</td>
        <StatCells s={subjectTermStats(data, subject, term.id)} />
      </tr>
      {subject.competencies.map((c) => (
        <tr key={c.id} className="row-sub">
          <td>
            {c.name} <span className="muted">({c.weight} %)</span>
          </td>
          <StatCells s={subjectTermStats(data, subject, term.id, c.id)} />
        </tr>
      ))}
    </>
  );
}

function EvalStats({ data, group, term, evalId }: { data: AppData; group: Group; term: Term; evalId?: string }) {
  const subjects = groupSubjects(data, group.id);
  const evals = data.evaluations
    .filter((e) => e.groupId === group.id && e.termId === term.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const ev: Evaluation | undefined = data.evaluations.find((e) => e.id === evalId) ?? evals[0];
  if (!ev) return <div className="empty">Aucune évaluation pour cette étape.</div>;
  const subj = subjects.find((s) => s.id === ev.subjectId)!;
  const students = groupStudents(data, group.id);
  const values = evalPercents(data, ev, students.map((s) => s.id));
  const stats = computeStats(values, data.settings.passThreshold);
  const rows = students
    .map((s) => {
      const m = data.marks[ev.id]?.[s.id];
      return { s, m, p: markToPercent(m, subj.mode, ev, data.settings) };
    })
    .sort((a, b) => (b.p ?? -1) - (a.p ?? -1));
  return (
    <>
      <div className="toolbar">
        <select value={ev.id} onChange={(e) => navigate(`stats/evaluation/${e.target.value}`)}>
          {evals.map((e) => (
            <option key={e.id} value={e.id}>
              {shortName(subjects.find((s) => s.id === e.subjectId)?.name ?? '')} — {e.title}
            </option>
          ))}
        </select>
        <button className="btn btn-sm" onClick={() => navigate(`saisie/${ev.id}`)}>
          Saisir / modifier les notes
        </button>
      </div>
      <section className="card">
        <h2>
          {ev.title} <small className="muted">{subj.name}{subj.mode === 'percent' ? ` · sur ${fmtNum(ev.maxScore)}` : ''}</small>
        </h2>
        <StatsSummary stats={stats} total={students.length} />
        {values.length > 0 && <Histogram values={values} scale={data.settings.letterScale} threshold={data.settings.passThreshold} />}
      </section>
      <section className="card">
        <h2>Résultats des élèves</h2>
        <div className="table-scroll">
          <table className="list-table">
            <thead>
              <tr>
                <th>Élève</th>
                <th className="num">Note</th>
                <th className="num">%</th>
                <th className="num">Écart à la moyenne</th>
                <th className="num">Cote z</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, m, p }) => (
                <tr key={s.id}>
                  <td>
                    <button className="link" onClick={() => navigate(`stats/eleve/${s.id}`)}>
                      {studentName(s)}
                    </button>
                  </td>
                  <td className="num">{formatMark(m, subj.mode) || '–'}</td>
                  <td className={`num ${p !== null && p < data.settings.passThreshold ? 'low-text' : ''}`}>{fmtPct(p)}</td>
                  <td className="num">{p === null || stats.mean === null ? '–' : signed(p - stats.mean)}</td>
                  <td className="num">{p === null || stats.mean === null || !stats.stdDev ? '–' : signed((p - stats.mean) / stats.stdDev, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function signed(n: number, d = 1) {
  return (n > 0 ? '+' : '') + fmtNum(n, d);
}

function StudentStats({ data, group, term, studentId }: { data: AppData; group: Group; term: Term; studentId?: string }) {
  const students = groupStudents(data, group.id);
  const st = students.find((s) => s.id === studentId) ?? students[0];
  if (!st) return <div className="empty">Aucun élève.</div>;
  const subjects = groupSubjects(data, group.id);
  const evals = data.evaluations
    .filter((e) => e.groupId === group.id && e.termId === term.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const own: number[] = [];
  const evRows = evals.map((e) => {
    const subj = subjects.find((s) => s.id === e.subjectId)!;
    const m = data.marks[e.id]?.[st.id];
    const p = markToPercent(m, subj.mode, e, data.settings);
    if (p !== null) own.push(p);
    return { e, subj, m, p, avg: mean(evalPercents(data, e)) };
  });
  const ownStats = computeStats(own, data.settings.passThreshold);
  const idx = students.indexOf(st);
  return (
    <>
      <div className="toolbar">
        <button className="icon-btn" disabled={idx <= 0} onClick={() => navigate(`stats/eleve/${students[idx - 1].id}`)} aria-label="Élève précédent">
          ‹
        </button>
        <select value={st.id} onChange={(e) => navigate(`stats/eleve/${e.target.value}`)}>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.lastName}, {s.firstName}
            </option>
          ))}
        </select>
        <button className="icon-btn" disabled={idx >= students.length - 1} onClick={() => navigate(`stats/eleve/${students[idx + 1].id}`)} aria-label="Élève suivant">
          ›
        </button>
      </div>
      <section className="card">
        <h2>
          {studentName(st)} <small className="muted">— évaluations de {term.name}</small>
        </h2>
        <StatsSummary stats={ownStats} total={evals.length} />
      </section>
      <section className="card">
        <h2>Résultats par matière</h2>
        <div className="table-scroll">
          <table className="list-table">
            <thead>
              <tr>
                <th>Matière</th>
                {data.terms.map((t) => (
                  <th key={t.id} className="num">
                    {t.name}
                  </th>
                ))}
                <th className="num">Moy. groupe ({term.name})</th>
                <th className="num">Résultat final</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const gAvg = subjectTermStats(data, s, term.id).mean;
                return (
                  <Fragment key={s.id}>
                    <tr className="row-strong">
                      <td>{s.name}</td>
                      {data.terms.map((t) => (
                        <td key={t.id} className="num">
                          {displayResult(subjectTermResult(data, s, t.id, st.id), s.mode, data.settings)}
                        </td>
                      ))}
                      <td className="num muted">{displayResult(gAvg, s.mode, data.settings)}</td>
                      <td className="num">{displayResult(subjectYearResult(data, s, st.id), s.mode, data.settings)}</td>
                    </tr>
                    {s.competencies.map((c) => (
                      <tr key={c.id} className="row-sub">
                        <td>{c.name}</td>
                        {data.terms.map((t) => (
                          <td key={t.id} className="num">
                            {displayResult(competencyResult(data, s, c.id, t.id, st.id), s.mode, data.settings)}
                          </td>
                        ))}
                        <td className="num muted">{displayResult(subjectTermStats(data, s, term.id, c.id).mean, s.mode, data.settings)}</td>
                        <td className="num">{displayResult(subjectYearResult(data, s, st.id, c.id), s.mode, data.settings)}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Évaluations — {term.name}</h2>
        <div className="table-scroll">
          <table className="list-table">
            <thead>
              <tr>
                <th>Évaluation</th>
                <th>Matière</th>
                <th className="num">Note</th>
                <th className="num">%</th>
                <th className="num">Moy. groupe</th>
                <th className="num">Écart</th>
              </tr>
            </thead>
            <tbody>
              {evRows.map(({ e, subj, m, p, avg }) => (
                <tr key={e.id}>
                  <td>
                    <button className="link" onClick={() => navigate(`stats/evaluation/${e.id}`)}>
                      {e.title}
                    </button>
                  </td>
                  <td>{shortName(subj.name)}</td>
                  <td className="num">{formatMark(m, subj.mode) || '–'}</td>
                  <td className={`num ${p !== null && p < data.settings.passThreshold ? 'low-text' : ''}`}>{fmtPct(p)}</td>
                  <td className="num muted">{fmtPct(avg)}</td>
                  <td className="num">{p === null || avg === null ? '–' : signed(p - avg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
