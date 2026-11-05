import { useState } from 'react';
import { Modal } from './Modal';
import { useStore } from '../store';
import { groupSubjects } from '../lib/grading';
import type { Evaluation } from '../types';

interface Props {
  groupId: string;
  termId: string;
  evaluation?: Evaluation;
  defaultSubjectId?: string | null;
  onClose: () => void;
  onSaved?: (id: string, openEntry: boolean) => void;
}

export function EvaluationForm({ groupId, termId, evaluation, defaultSubjectId, onClose, onSaved }: Props) {
  const data = useStore((s) => s.data);
  const addEvaluation = useStore((s) => s.addEvaluation);
  const updateEvaluation = useStore((s) => s.updateEvaluation);
  const deleteEvaluation = useStore((s) => s.deleteEvaluation);
  const subjects = groupSubjects(data, groupId);
  const [f, setF] = useState<Omit<Evaluation, 'id'>>(() =>
    evaluation
      ? { ...evaluation }
      : {
          groupId,
          termId,
          subjectId: defaultSubjectId ?? subjects[0]?.id ?? '',
          competencyId: undefined,
          title: '',
          date: new Date().toISOString().slice(0, 10),
          maxScore: 20,
          weight: 1,
        },
  );
  const subject = subjects.find((s) => s.id === f.subjectId);
  const comps = subject?.competencies ?? [];
  const compId = f.competencyId && comps.some((c) => c.id === f.competencyId) ? f.competencyId : comps[0]?.id;
  const hasMarks = evaluation && Object.keys(data.marks[evaluation.id] ?? {}).length > 0;

  const save = (openEntry: boolean) => {
    if (!f.subjectId) return;
    const payload = {
      ...f,
      title: f.title.trim() || 'Évaluation',
      competencyId: comps.length ? compId : undefined,
      maxScore: f.maxScore > 0 ? f.maxScore : 100,
      weight: f.weight > 0 ? f.weight : 1,
    };
    let id = evaluation?.id;
    if (evaluation) updateEvaluation(evaluation.id, payload);
    else id = addEvaluation(payload);
    onClose();
    onSaved?.(id!, openEntry);
  };

  return (
    <Modal
      title={evaluation ? 'Modifier l’évaluation' : 'Nouvelle évaluation'}
      onClose={onClose}
      footer={
        <>
          {evaluation && (
            <button
              className="btn btn-danger-ghost"
              onClick={() => {
                if (confirm(`Supprimer « ${evaluation.title} » et ses notes ?`)) {
                  deleteEvaluation(evaluation.id);
                  onClose();
                }
              }}
            >
              Supprimer
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={() => save(false)}>
            Enregistrer
          </button>
          {!evaluation && (
            <button className="btn btn-primary" onClick={() => save(true)}>
              Créer et saisir
            </button>
          )}
        </>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save(!evaluation);
        }}
      >
        <label>
          Titre
          <input autoFocus value={f.title} placeholder="ex. Dictée #3" onChange={(e) => setF({ ...f, title: e.target.value })} />
        </label>
        <label>
          Matière
          <select value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value, competencyId: undefined })}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {comps.length > 0 && (
          <label>
            Compétence
            <select value={compId} onChange={(e) => setF({ ...f, competencyId: e.target.value })}>
              {comps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.weight} %)
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="form-row">
          <label>
            Étape
            <select value={f.termId} onChange={(e) => setF({ ...f, termId: e.target.value })}>
              {data.terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </label>
        </div>
        <div className="form-row">
          {subject?.mode === 'percent' && (
            <label>
              Noté sur
              <input
                type="number"
                inputMode="decimal"
                min={1}
                step="any"
                value={f.maxScore}
                onChange={(e) => setF({ ...f, maxScore: parseFloat(e.target.value) || 0 })}
              />
              {hasMarks && <small className="hint">Les points déjà saisis ne sont pas convertis.</small>}
            </label>
          )}
          <label>
            Pondération
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={f.weight}
              onChange={(e) => setF({ ...f, weight: parseFloat(e.target.value) || 0 })}
            />
            <small className="hint">Poids relatif parmi les évaluations de la même compétence.</small>
          </label>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
