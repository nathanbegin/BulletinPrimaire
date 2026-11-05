import { useState } from 'react';
import { useStore, useActiveGroup, useActiveTerm } from '../store';
import { evalStats, fmtNum, fmtPct, groupStudents, groupSubjects, MODE_LABELS } from '../lib/grading';
import { EvaluationForm } from '../components/EvaluationForm';
import { Icon } from '../components/Icon';
import { navigate } from '../router';
import type { Evaluation } from '../types';

export default function EvaluationsPage() {
  const data = useStore((s) => s.data);
  const group = useActiveGroup()!;
  const term = useActiveTerm()!;
  const [form, setForm] = useState<{ ev?: Evaluation; subjectId?: string } | null>(null);
  const subjects = groupSubjects(data, group.id);
  const nStudents = groupStudents(data, group.id).length;

  return (
    <div className="page">
      <div className="page-head">
        <h1>
          Évaluations <small>{term.name}</small>
        </h1>
        <div className="actions">
          <button className="btn" onClick={() => navigate('numeriser')} disabled={!subjects.length}>
            <Icon name="camera" size={18} /> Numériser un relevé
          </button>
          <button className="btn btn-primary" onClick={() => setForm({})} disabled={!subjects.length}>
            <Icon name="plus" size={18} /> Nouvelle évaluation
          </button>
        </div>
      </div>
      {!subjects.length && (
        <div className="empty">
          Ajoutez d’abord des matières au groupe.{' '}
          <button className="link" onClick={() => navigate('groupe/matieres')}>Configurer les matières</button>
        </div>
      )}
      {subjects.map((s) => {
        const evs = data.evaluations
          .filter((e) => e.subjectId === s.id && e.termId === term.id)
          .sort((a, b) => a.date.localeCompare(b.date));
        return (
          <section key={s.id} className="card">
            <div className="card-head">
              <h2>{s.name}</h2>
              <span className="badge">{MODE_LABELS[s.mode]}</span>
              <span className="spacer" />
              <button className="btn btn-sm" onClick={() => setForm({ subjectId: s.id })}>
                <Icon name="plus" size={16} /> Ajouter
              </button>
            </div>
            {!evs.length ? (
              <p className="muted small-pad">Aucune évaluation.</p>
            ) : (
              <div className="table-scroll">
                <table className="list-table">
                  <thead>
                    <tr>
                      <th>Évaluation</th>
                      {s.competencies.length > 0 && <th>Compétence</th>}
                      <th>Date</th>
                      <th className="num">Sur</th>
                      <th className="num">Poids</th>
                      <th className="num">Saisies</th>
                      <th className="num">Moyenne</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {evs.map((e) => {
                      const st = evalStats(data, e);
                      const n = Object.keys(data.marks[e.id] ?? {}).length;
                      return (
                        <tr key={e.id}>
                          <td>
                            <button className="link strong" onClick={() => setForm({ ev: e })}>
                              {e.title}
                            </button>
                          </td>
                          {s.competencies.length > 0 && <td>{s.competencies.find((c) => c.id === e.competencyId)?.name ?? '–'}</td>}
                          <td className="nowrap">{e.date}</td>
                          <td className="num">{s.mode === 'percent' ? fmtNum(e.maxScore) : '–'}</td>
                          <td className="num">{fmtNum(e.weight)}</td>
                          <td className={`num ${n < nStudents ? 'warn' : ''}`}>
                            {n}/{nStudents}
                          </td>
                          <td className="num">{fmtPct(st.mean)}</td>
                          <td className="row-actions">
                            <button className="btn btn-sm btn-primary" onClick={() => navigate(`saisie/${e.id}`)} title="Saisie rapide">
                              <Icon name="bolt" size={16} /> Saisir
                            </button>
                            <button className="icon-btn" onClick={() => navigate(`stats/evaluation/${e.id}`)} title="Statistiques">
                              <Icon name="chart" size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
      {form && (
        <EvaluationForm
          groupId={group.id}
          termId={term.id}
          evaluation={form.ev}
          defaultSubjectId={form.subjectId}
          onClose={() => setForm(null)}
          onSaved={(id, open) => open && navigate(`saisie/${id}`)}
        />
      )}
    </div>
  );
}
