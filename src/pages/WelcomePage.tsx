import { useState } from 'react';
import { useStore } from '../store';
import { currentSchoolYear, demoData, QC_SUBJECTS, subjectFromTemplate } from '../lib/defaults';
import { navigate } from '../router';

export default function WelcomePage() {
  const addGroup = useStore((s) => s.addGroup);
  const addSubject = useStore((s) => s.addSubject);
  const replaceData = useStore((s) => s.replaceData);
  const [name, setName] = useState('Mon groupe');
  const [level, setLevel] = useState('');
  const [number, setNumber] = useState('');
  const [year, setYear] = useState(currentSchoolYear());
  const [teacher, setTeacher] = useState('');
  const [school, setSchool] = useState('');
  const updateSettings = useStore((s) => s.updateSettings);
  return (
    <div className="page welcome">
      <h1>Bienvenue dans Bulletin</h1>
      <p className="lead">
        Votre carnet de notes pour le primaire : saisie rapide des évaluations, résultats par compétence, statistiques et bulletins par étape.
      </p>
      <section className="card form">
        <h2>Créer votre groupe</h2>
        <div className="form-row">
          <label>
            Nom du groupe
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Numéro de groupe
            <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="ex. 301" />
          </label>
          <label>
            Niveau
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">—</option>
              {['1re année', '2e année', '3e année', '4e année', '5e année', '6e année'].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Année scolaire
            <input value={year} onChange={(e) => setYear(e.target.value)} />
          </label>
          <label>
            Enseignant(e)
            <input value={teacher} onChange={(e) => setTeacher(e.target.value)} />
          </label>
          <label>
            École
            <input value={school} onChange={(e) => setSchool(e.target.value)} />
          </label>
        </div>
        <p className="muted">Les matières du programme québécois (avec leurs compétences et pondérations) seront ajoutées automatiquement ; vous pourrez les modifier.</p>
        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              updateSettings({ teacherName: teacher, schoolName: school, schoolYear: year });
              const id = addGroup({ name: name.trim() || 'Mon groupe', number, level, schoolYear: year, teacherName: teacher, schoolName: school });
              const firstCycle = level.startsWith('1') || level.startsWith('2');
              QC_SUBJECTS.filter((t) => !(firstCycle && (t.name.startsWith('Science') || t.name.startsWith('Géographie'))))
                .slice(0, 9)
                .forEach((t, i) => addSubject(subjectFromTemplate(t, id, i)));
              navigate('groupe/eleves');
            }}
          >
            Créer le groupe
          </button>
          <button className="btn" onClick={() => { replaceData(demoData()); navigate('notes'); }}>
            Essayer avec des données de démonstration
          </button>
        </div>
      </section>
    </div>
  );
}
