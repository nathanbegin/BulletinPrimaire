import { useState } from 'react';
import { useStore, useActiveGroup } from '../store';
import { groupStudents, groupSubjects, MODE_LABELS } from '../lib/grading';
import { QC_SUBJECTS, subjectFromTemplate, uid } from '../lib/defaults';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { navigate } from '../router';
import { parseName } from '../lib/names';
import type { GradingMode, Student, StudentSupport, Subject } from '../types';
import { emptySupport, groupLabel, groupSchool, groupsByYear, groupTeacher, groupYear, hasSupport, SUPPORT_SUGGESTIONS, supportSummary } from '../lib/support';
import { SupportBadges } from '../components/SupportBadges';
import { exportGroupWorkbook } from '../lib/excel';
import { currentSchoolYear } from '../lib/defaults';

export default function GroupPage({ tab = 'eleves' }: { tab?: string }) {
  const group = useActiveGroup()!;
  const data = useStore((s) => s.data);
  const tabs = [
    ['eleves', 'Élèves'],
    ['matieres', 'Matières'],
    ['infos', 'Groupe'],
  ];
  return (
    <div className="page">
      <div className="page-head">
        <h1>
          {groupLabel(group)} <small>{[group.level, groupYear(group, data), groupTeacher(group, data)].filter(Boolean).join(' · ')}</small>
        </h1>
        <div className="actions">
          <button className="btn" onClick={() => exportGroupWorkbook(data, group)}>
            <Icon name="download" size={18} /> Excel
          </button>
        </div>
      </div>
      <div className="tabs">
        {tabs.map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => navigate(`groupe/${k}`)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'eleves' && <StudentsTab groupId={group.id} />}
      {tab === 'matieres' && <SubjectsTab groupId={group.id} />}
      {tab === 'infos' && <GroupInfoTab />}
    </div>
  );
}

function StudentsTab({ groupId }: { groupId: string }) {
  const data = useStore((s) => s.data);
  const addStudents = useStore((s) => s.addStudents);
  const updateStudent = useStore((s) => s.updateStudent);
  const deleteStudent = useStore((s) => s.deleteStudent);
  const students = groupStudents(data, groupId, true);
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [onlySupport, setOnlySupport] = useState(false);
  const [editSupport, setEditSupport] = useState<Student | null>(null);
  const nSupport = students.filter((s) => s.active && hasSupport(s)).length;
  const shown = onlySupport ? students.filter(hasSupport) : students;

  const parsed = bulk.split('\n').map(parseName).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <section className="card">
      <div className="card-head">
        <h2>{students.filter((s) => s.active).length} élèves</h2>
        <button className={`chip ${onlySupport ? 'active' : ''}`} onClick={() => setOnlySupport(!onlySupport)} title="Élèves avec plan d’intervention ou dispositions">
          En difficulté / PI : {nSupport}
        </button>
        <span className="spacer" />
        <button className="btn btn-primary btn-sm" onClick={() => setShowBulk(true)}>
          <Icon name="plus" size={16} /> Ajouter des élèves
        </button>
      </div>
      {!students.length && <p className="muted small-pad">Aucun élève. Ajoutez-les un par un ou collez une liste.</p>}
      <div className="table-scroll">
        <table className="list-table editable">
          {students.length > 0 && (
            <thead>
              <tr>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Code permanent</th>
                <th>Interventions</th>
                <th>Actif</th>
                <th />
              </tr>
            </thead>
          )}
          <tbody>
            {shown.map((s) => (
              <tr key={s.id} className={s.active ? '' : 'inactive'}>
                <td>
                  <input value={s.lastName} onChange={(e) => updateStudent(s.id, { lastName: e.target.value })} aria-label="Nom" />
                </td>
                <td>
                  <input value={s.firstName} onChange={(e) => updateStudent(s.id, { firstName: e.target.value })} aria-label="Prénom" />
                </td>
                <td>
                  <input value={s.code ?? ''} onChange={(e) => updateStudent(s.id, { code: e.target.value })} aria-label="Code permanent" placeholder="—" />
                </td>
                <td>
                  <button className="support-cell" onClick={() => setEditSupport(s)}>
                    <SupportBadges student={s} />
                    <span className="support-text">{supportSummary(s) || <span className="muted">Aucune</span>}</span>
                    <Icon name="edit" size={14} />
                  </button>
                </td>
                <td>
                  <input type="checkbox" checked={s.active} onChange={(e) => updateStudent(s.id, { active: e.target.checked })} aria-label="Actif" />
                </td>
                <td className="row-actions">
                  <button
                    className="icon-btn danger"
                    aria-label="Supprimer"
                    onClick={() => confirm(`Supprimer ${s.firstName} ${s.lastName} et toutes ses notes ?`) && deleteStudent(s.id)}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editSupport && (
        <SupportForm
          student={editSupport}
          onClose={() => setEditSupport(null)}
          onSave={(support) => {
            updateStudent(editSupport.id, { support });
            setEditSupport(null);
          }}
        />
      )}
      <p className="hint">PI = plan d’intervention · Ad = mesures d’adaptation · Mo = mesures de modification. Décochez « Actif » pour un élève qui a quitté le groupe : ses notes sont conservées mais il n’apparaît plus dans la saisie.</p>
      {showBulk && (
        <Modal
          title="Ajouter des élèves"
          onClose={() => setShowBulk(false)}
          footer={
            <>
              <span className="spacer" />
              <button className="btn" onClick={() => setShowBulk(false)}>
                Annuler
              </button>
              <button
                className="btn btn-primary"
                disabled={!parsed.length}
                onClick={() => {
                  addStudents(groupId, parsed);
                  setBulk('');
                  setShowBulk(false);
                }}
              >
                Ajouter {parsed.length || ''}
              </button>
            </>
          }
        >
          <p>Un élève par ligne : « Prénom Nom », « Nom, Prénom » ou deux colonnes collées d’Excel (Nom | Prénom).</p>
          <textarea autoFocus rows={10} className="full" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'Léa Tremblay\nGagnon, Félix'} />
          {parsed.length > 0 && (
            <p className="muted">
              Aperçu : {parsed.slice(0, 4).map((p) => `${p.firstName} ${p.lastName}`).join(' · ')}
              {parsed.length > 4 ? ' …' : ''}
            </p>
          )}
        </Modal>
      )}
    </section>
  );
}

function SubjectsTab({ groupId }: { groupId: string }) {
  const data = useStore((s) => s.data);
  const addSubject = useStore((s) => s.addSubject);
  const updateSubject = useStore((s) => s.updateSubject);
  const deleteSubject = useStore((s) => s.deleteSubject);
  const moveSubject = useStore((s) => s.moveSubject);
  const subjects = groupSubjects(data, groupId);
  const [adding, setAdding] = useState(false);
  const existing = new Set(subjects.map((s) => s.name));

  return (
    <>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> Ajouter une matière
        </button>
      </div>
      {subjects.map((s, i) => (
        <SubjectCard
          key={s.id}
          subject={s}
          first={i === 0}
          last={i === subjects.length - 1}
          onChange={(p) => updateSubject(s.id, p)}
          onDelete={() => {
            const n = data.evaluations.filter((e) => e.subjectId === s.id).length;
            if (confirm(`Supprimer « ${s.name} »${n ? ` et ses ${n} évaluation(s)` : ''} ?`)) deleteSubject(s.id);
          }}
          onMove={(d) => moveSubject(s.id, d)}
        />
      ))}
      {adding && (
        <Modal title="Ajouter une matière" onClose={() => setAdding(false)}>
          <p className="muted">Matières du Programme de formation de l’école québécoise :</p>
          <div className="card-list">
            {QC_SUBJECTS.map((t) => (
              <button
                key={t.name}
                className="card-item"
                disabled={existing.has(t.name)}
                onClick={() => {
                  const s = subjectFromTemplate(t, groupId, 0);
                  addSubject({ ...s });
                  setAdding(false);
                }}
              >
                <span className="ci-title">{t.name}</span>
                <span className="ci-meta">
                  {existing.has(t.name) ? 'Déjà ajoutée' : t.competencies.length ? t.competencies.map((c) => `${c.name} ${c.weight} %`).join(' · ') : 'Résultat disciplinaire'}
                </span>
              </button>
            ))}
            <button
              className="card-item"
              onClick={() => {
                const name = prompt('Nom de la matière');
                if (name?.trim()) addSubject({ groupId, name: name.trim(), mode: 'percent', competencies: [] });
                setAdding(false);
              }}
            >
              <span className="ci-title">Autre matière…</span>
              <span className="ci-meta">Matière personnalisée</span>
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function SubjectCard({
  subject: s,
  first,
  last,
  onChange,
  onDelete,
  onMove,
}: {
  subject: Subject;
  first: boolean;
  last: boolean;
  onChange: (p: Partial<Subject>) => void;
  onDelete: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  const total = s.competencies.reduce((a, c) => a + c.weight, 0);
  const setComp = (id: string, p: Partial<Subject['competencies'][number]>) =>
    onChange({ competencies: s.competencies.map((c) => (c.id === id ? { ...c, ...p } : c)) });
  return (
    <section className="card">
      <div className="card-head wrap">
        <input className="title-input" value={s.name} onChange={(e) => onChange({ name: e.target.value })} aria-label="Nom de la matière" />
        <select value={s.mode} onChange={(e) => onChange({ mode: e.target.value as GradingMode })} aria-label="Mode d’évaluation">
          {Object.entries(MODE_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <button className="icon-btn" disabled={first} onClick={() => onMove(-1)} aria-label="Monter">
          <Icon name="up" />
        </button>
        <button className="icon-btn" disabled={last} onClick={() => onMove(1)} aria-label="Descendre">
          <Icon name="down" />
        </button>
        <button className="icon-btn danger" onClick={onDelete} aria-label="Supprimer">
          <Icon name="trash" />
        </button>
      </div>
      <div className="comp-list">
        {s.competencies.map((c) => (
          <div className="comp-row" key={c.id}>
            <input value={c.name} onChange={(e) => setComp(c.id, { name: e.target.value })} aria-label="Compétence" />
            <div className="input-suffix">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={c.weight}
                onChange={(e) => setComp(c.id, { weight: parseFloat(e.target.value) || 0 })}
                aria-label="Pondération"
              />
              <span>%</span>
            </div>
            <button
              className="icon-btn"
              aria-label="Retirer la compétence"
              onClick={() => onChange({ competencies: s.competencies.filter((x) => x.id !== c.id) })}
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        ))}
        <div className="comp-foot">
          <button className="link" onClick={() => onChange({ competencies: [...s.competencies, { id: uid(), name: 'Compétence', weight: 0 }] })}>
            + Ajouter une compétence
          </button>
          {s.competencies.length > 0 && <span className={total === 100 ? 'muted' : 'warn'}>Total : {total} %</span>}
        </div>
      </div>
    </section>
  );
}

function GroupInfoTab() {
  const group = useActiveGroup()!;
  const data = useStore((s) => s.data);
  const groups = data.groups;
  const updateGroup = useStore((s) => s.updateGroup);
  const deleteGroup = useStore((s) => s.deleteGroup);
  const setUI = useStore((s) => s.setUI);
  const addGroup = useStore((s) => s.addGroup);
  const addSubject = useStore((s) => s.addSubject);
  return (
    <>
      <section className="card form">
        <div className="form-row">
          <label>
            Nom du groupe
            <input value={group.name} onChange={(e) => updateGroup(group.id, { name: e.target.value })} />
          </label>
          <label>
            Numéro de groupe
            <input value={group.number ?? ''} onChange={(e) => updateGroup(group.id, { number: e.target.value })} placeholder="ex. 301" />
          </label>
          <label>
            Niveau
            <input value={group.level} onChange={(e) => updateGroup(group.id, { level: e.target.value })} placeholder="ex. 4e année" />
          </label>
          <label>
            Année scolaire
            <input value={group.schoolYear ?? ''} onChange={(e) => updateGroup(group.id, { schoolYear: e.target.value })} placeholder={data.settings.schoolYear} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Enseignant(e)
            <input value={group.teacherName ?? ''} onChange={(e) => updateGroup(group.id, { teacherName: e.target.value })} placeholder={data.settings.teacherName || 'Nom de l’enseignant(e)'} />
          </label>
          <label>
            École
            <input value={group.schoolName ?? ''} onChange={(e) => updateGroup(group.id, { schoolName: e.target.value })} placeholder={data.settings.schoolName || 'Nom de l’école'} />
          </label>
        </div>
        <small className="hint">Laissés vides, l’enseignant(e), l’école et l’année reprennent les valeurs des Réglages.</small>
        <div className="actions">
          <button
            className="btn btn-danger-ghost"
            onClick={() => confirm(`Supprimer le groupe « ${group.name} », ses élèves et toutes ses notes ?`) && deleteGroup(group.id)}
          >
            Supprimer ce groupe
          </button>
        </div>
      </section>
      <section className="card">
        <h2>Tous les groupes ({groups.length})</h2>
        {groupsByYear(data).map(({ year, groups: gs }) => (
          <div key={year} className="year-block">
            <div className="year-title">{year}</div>
            <div className="card-list">
              {gs.map((g) => (
                <button
                  key={g.id}
                  className={`card-item ${g.id === group.id ? 'current' : ''}`}
                  onClick={() => setUI({ groupId: g.id, subjectFilter: null })}
                >
                  <span className="ci-title">{groupLabel(g)}</span>
                  <span className="ci-meta">
                    {[g.level, groupTeacher(g, data), groupSchool(g, data), `${data.students.filter((x) => x.groupId === g.id && x.active).length} élèves`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          className="btn"
          onClick={() => {
            const name = prompt('Nom du nouveau groupe', `Groupe ${groups.length + 1}`);
            if (!name) return;
            const id = addGroup({
              name,
              level: '',
              schoolYear: currentSchoolYear(),
              teacherName: groupTeacher(group, data),
              schoolName: groupSchool(group, data),
            });
            QC_SUBJECTS.slice(0, 3).forEach((t, i) => addSubject(subjectFromTemplate(t, id, i)));
            navigate('groupe/eleves');
          }}
        >
          <Icon name="plus" size={18} /> Nouveau groupe
        </button>
      </section>
    </>
  );
}

function SupportForm({ student, onClose, onSave }: { student: Student; onClose: () => void; onSave: (s: StudentSupport) => void }) {
  const [f, setF] = useState<StudentSupport>(() => ({ ...emptySupport(), ...student.support }));
  const [tag, setTag] = useState('');
  const addTag = (t: string) => {
    const v = t.trim();
    if (v && !f.tags.includes(v)) setF({ ...f, tags: [...f.tags, v] });
    setTag('');
  };
  return (
    <Modal
      title={`Interventions — ${student.firstName} ${student.lastName}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-danger-ghost" onClick={() => onSave(emptySupport())}>
            Tout retirer
          </button>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => onSave(f)}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="form">
        <label className="toggle">
          <input type="checkbox" checked={f.hasPlan} onChange={(e) => setF({ ...f, hasPlan: e.target.checked })} />
          Plan d’intervention (PI)
        </label>
        <label className="toggle">
          <input type="checkbox" checked={f.adaptation} onChange={(e) => setF({ ...f, adaptation: e.target.checked })} />
          Mesures d’adaptation <span className="muted">(exigences inchangées)</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={f.modification} onChange={(e) => setF({ ...f, modification: e.target.checked })} />
          Mesures de modification <span className="muted">(exigences modifiées — mentionné au bulletin)</span>
        </label>
        <div>
          <div className="b-label">Difficultés et dispositions</div>
          <div className="tag-list">
            {f.tags.map((t) => (
              <span key={t} className="tag">
                {t}
                <button aria-label={`Retirer ${t}`} onClick={() => setF({ ...f, tags: f.tags.filter((x) => x !== t) })}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="comp-row">
            <input
              list="support-suggestions"
              value={tag}
              placeholder="Ajouter (ex. Temps supplémentaire)"
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag(tag);
                }
              }}
            />
            <button className="btn" onClick={() => addTag(tag)} disabled={!tag.trim()}>
              Ajouter
            </button>
          </div>
          <datalist id="support-suggestions">
            {SUPPORT_SUGGESTIONS.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <div className="tag-suggest">
            {SUPPORT_SUGGESTIONS.filter((x) => !f.tags.includes(x))
              .slice(0, 8)
              .map((x) => (
                <button key={x} className="chip" onClick={() => addTag(x)}>
                  + {x}
                </button>
              ))}
          </div>
        </div>
        <label>
          Notes (interventions, suivis, rencontres)
          <textarea rows={4} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </label>
      </div>
    </Modal>
  );
}
