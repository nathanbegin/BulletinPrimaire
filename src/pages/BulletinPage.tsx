import { Fragment, useState } from 'react';
import { useStore, useActiveGroup, useActiveTerm } from '../store';
import {
  competencyResult,
  displayResult,
  groupStudents,
  groupSubjects,
  studentTermAverage,
  subjectTermResult,
  subjectTermStats,
  subjectYearResult,
} from '../lib/grading';
import { Icon } from '../components/Icon';
import type { AppData, Group, Student, Term } from '../types';
import { groupLabel, groupSchool, groupTeacher, groupYear } from '../lib/support';
import { mean } from '../lib/stats';
import { PrintFooterLine, printNow } from '../components/Print';

export default function BulletinPage() {
  const data = useStore((s) => s.data);
  const group = useActiveGroup()!;
  const term = useActiveTerm()!;
  const students = groupStudents(data, group.id);
  const [sel, setSel] = useState<string>('all');
  const shown = sel === 'all' ? students : students.filter((s) => s.id === sel);

  return (
    <div className="page">
      <div className="page-head no-print">
        <h1>
          Bulletins <small>{term.name}</small>
        </h1>
        <div className="actions">
          <select value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Élève">
            <option value="all">Tous les élèves ({students.length})</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.lastName}, {s.firstName}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={printNow}>
            <Icon name="print" size={18} /> Imprimer / PDF
          </button>
        </div>
      </div>
      <p className="hint no-print">
        Les étapes postérieures à {term.name} sont laissées vides. Le résultat final est pondéré selon les étapes ({data.terms.map((t) => `${t.weight} %`).join(' / ')}).
      </p>
      {shown.map((s) => (
        <BulletinSheet key={s.id} data={data} group={group} term={term} student={s} />
      ))}
    </div>
  );
}

function BulletinSheet({ data, group, term, student }: { data: AppData; group: Group; term: Term; student: Student }) {
  const setComment = useStore((s) => s.setComment);
  const { settings } = data;
  const subjects = groupSubjects(data, group.id);
  const termIdx = data.terms.findIndex((t) => t.id === term.id);
  const terms = data.terms;
  const showAvg = settings.showGroupAverage;
  const comment = data.comments[term.id]?.[student.id] ?? '';
  const students = groupStudents(data, group.id);
  const termTiles = terms.map((t, i) => {
    if (i > termIdx) return { t, future: true, r: null, g: null };
    const g = mean(students.map((st) => studentTermAverage(data, group.id, t.id, st.id)).filter((v): v is number => v !== null));
    return { t, future: false, r: studentTermAverage(data, group.id, t.id, student.id), g };
  });

  const cells = (get: (t: Term) => { r: number | null; g: number | null }, mode: AppData['subjects'][number]['mode']) =>
    terms.map((t, i) => {
      const future = i > termIdx;
      const { r, g } = future ? { r: null, g: null } : get(t);
      return (
        <Fragment key={t.id}>
          <td className={`num b-res ${future ? 'future' : ''} ${t.id === term.id ? 'current' : ''} ${r !== null && r < settings.passThreshold ? 'low' : ''}`}>
            {future ? '' : displayResult(r, mode, settings)}
          </td>
          {showAvg && <td className={`num b-grp ${future ? 'future' : ''}`}>{future ? '' : displayResult(g, mode, settings)}</td>}
        </Fragment>
      );
    });

  return (
    <article className="bulletin">
      <header className="b-head">
        <div className="b-brand">
          <img src="./icon.svg" alt="" width={40} height={40} />
          <div>
          <div className="b-school">{groupSchool(group, data) || 'École'}</div>
          <div className="b-title">Bulletin scolaire — {term.name}</div>
          <div className="muted">Année scolaire {groupYear(group, data)}</div>
          </div>
        </div>
        <div className="b-ident">
          <div>
            <span>Élève</span>
            <strong>
              {student.firstName} {student.lastName}
            </strong>
          </div>
          {student.code && (
            <div>
              <span>Code permanent</span>
              <strong>{student.code}</strong>
            </div>
          )}
          <div>
            <span>Groupe</span>
            <strong>
              {groupLabel(group)}
              {group.level ? ` · ${group.level}` : ''}
            </strong>
          </div>
          {groupTeacher(group, data) && (
            <div>
              <span>Enseignant(e)</span>
              <strong>{groupTeacher(group, data)}</strong>
            </div>
          )}
        </div>
      </header>

      <div className="b-tiles">
        {termTiles.map(({ t, future, r, g }) => (
          <div key={t.id} className={`b-tile ${future ? 'future' : ''} ${t.id === term.id ? 'current' : ''}`}>
            <div className="b-tile-label">
              {t.name} <small>({t.weight} %)</small>
            </div>
            <div className={`b-tile-value ${r !== null && r < settings.passThreshold ? 'low' : ''}`}>{future ? '—' : displayResult(r, 'percent', settings)}</div>
            <div className="b-tile-sub">{future ? 'À venir' : showAvg ? `Groupe : ${displayResult(g, 'percent', settings)}` : 'Moyenne générale'}</div>
          </div>
        ))}
      </div>

      <table className="b-table">
        <thead>
          <tr>
            <th rowSpan={2} className="b-subj">Matière / compétence</th>
            {terms.map((t) => (
              <th key={t.id} colSpan={showAvg ? 2 : 1} className={t.id === term.id ? 'current' : ''}>
                {t.name} <small>({t.weight} %)</small>
              </th>
            ))}
            <th rowSpan={2} className="b-final-h">Résultat final</th>
          </tr>
          <tr>
            {terms.map((t) => (
              <Fragment key={t.id}>
                <th className="b-sub">Résultat</th>
                {showAvg && <th className="b-sub">Moy. groupe</th>}
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => (
            <Fragment key={s.id}>
              <tr className="row-strong">
                <td>
                  {s.name}
                  {s.teacherName?.trim() && s.teacherName.trim() !== groupTeacher(group, data) && (
                    <span className="b-subj-teacher">Enseignant(e) : {s.teacherName}</span>
                  )}
                </td>
                {cells(
                  (t) => ({ r: subjectTermResult(data, s, t.id, student.id), g: subjectTermStats(data, s, t.id).mean }),
                  s.mode,
                )}
                <td className="num b-final strong">{displayResult(subjectYearResult(data, s, student.id, undefined, term.id), s.mode, settings)}</td>
              </tr>
              {s.competencies.map((c) => (
                <tr key={c.id} className="row-sub">
                  <td>
                    {c.name} <span className="muted">({c.weight} %)</span>
                  </td>
                  {cells(
                    (t) => ({ r: competencyResult(data, s, c.id, t.id, student.id), g: subjectTermStats(data, s, t.id, c.id).mean }),
                    s.mode,
                  )}
                  <td className="num b-final">{displayResult(subjectYearResult(data, s, student.id, c.id, term.id), s.mode, settings)}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      {student.support?.modification && (
        <p className="b-note">* Les résultats de cet élève sont établis en fonction d’exigences modifiées (plan d’intervention).</p>
      )}
      <div className="b-comment">
        <div className="b-label">Commentaires de l’enseignant(e)</div>
        <textarea
          className="no-print"
          rows={3}
          value={comment}
          placeholder="Forces, défis, recommandations…"
          onChange={(e) => setComment(term.id, student.id, e.target.value)}
        />
        <div className="print-only b-comment-text">{comment || ' '}</div>
      </div>

      <footer className="b-sign">
        <div>Signature de l’enseignant(e)</div>
        <div>Signature du parent</div>
      </footer>
      <PrintFooterLine group={group} className="b-footer" />
    </article>
  );
}
