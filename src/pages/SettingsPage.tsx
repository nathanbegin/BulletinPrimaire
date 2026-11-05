import { useRef, useState } from 'react';
import { useStore } from '../store';
import { DEFAULT_LETTER_SCALE, demoData, emptyData, uid } from '../lib/defaults';
import { sortedScale } from '../lib/grading';
import { Icon } from '../components/Icon';
import type { AppData, LetterGrade } from '../types';
import { AI_MODEL, loadAIConfig, saveAIConfig } from '../lib/aiConfig';

export default function SettingsPage() {
  const data = useStore((s) => s.data);
  const updateSettings = useStore((s) => s.updateSettings);
  const setTerms = useStore((s) => s.setTerms);
  const replaceData = useStore((s) => s.replaceData);
  const { settings, terms } = data;
  const fileRef = useRef<HTMLInputElement>(null);
  const scale = settings.letterScale;
  const termTotal = terms.reduce((a, t) => a + t.weight, 0);

  const setScale = (s: LetterGrade[]) => updateSettings({ letterScale: s });
  const setGrade = (i: number, p: Partial<LetterGrade>) => setScale(scale.map((g, k) => (k === i ? { ...g, ...p } : g)));

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bulletin-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importData = async (f: File) => {
    try {
      const d = JSON.parse(await f.text()) as AppData;
      if (!d || !Array.isArray(d.groups) || !Array.isArray(d.students) || !d.settings) throw new Error('format');
      if (confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) replaceData({ ...emptyData(), ...d });
    } catch {
      alert('Fichier de sauvegarde invalide.');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Réglages</h1>
      </div>

      <section className="card form">
        <h2>École</h2>
        <div className="form-row">
          <label>
            Nom de l’école
            <input value={settings.schoolName} onChange={(e) => updateSettings({ schoolName: e.target.value })} />
          </label>
          <label>
            Enseignant(e)
            <input value={settings.teacherName} onChange={(e) => updateSettings({ teacherName: e.target.value })} />
          </label>
          <label>
            Année scolaire
            <input value={settings.schoolYear} onChange={(e) => updateSettings({ schoolYear: e.target.value })} placeholder="2026-2027" />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Étapes</h2>
          <span className={`badge ${termTotal === 100 ? '' : 'warn'}`}>Total {termTotal} %</span>
        </div>
        <div className="table-scroll">
          <table className="list-table editable">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Pondération</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.id}>
                  <td>
                    <input value={t.name} onChange={(e) => setTerms(terms.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))} aria-label="Nom de l’étape" />
                  </td>
                  <td>
                    <input type="date" value={t.start} onChange={(e) => setTerms(terms.map((x) => (x.id === t.id ? { ...x, start: e.target.value } : x)))} aria-label="Début" />
                  </td>
                  <td>
                    <input type="date" value={t.end} onChange={(e) => setTerms(terms.map((x) => (x.id === t.id ? { ...x, end: e.target.value } : x)))} aria-label="Fin" />
                  </td>
                  <td>
                    <div className="input-suffix">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={t.weight}
                        onChange={(e) => setTerms(terms.map((x) => (x.id === t.id ? { ...x, weight: parseFloat(e.target.value) || 0 } : x)))}
                        aria-label="Pondération"
                      />
                      <span>%</span>
                    </div>
                  </td>
                  <td className="row-actions">
                    <button
                      className="icon-btn danger"
                      disabled={terms.length <= 1 || data.evaluations.some((e) => e.termId === t.id)}
                      title={data.evaluations.some((e) => e.termId === t.id) ? 'Des évaluations utilisent cette étape' : 'Supprimer'}
                      onClick={() => setTerms(terms.filter((x) => x.id !== t.id))}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          className="link"
          onClick={() => {
            const last = terms[terms.length - 1];
            setTerms([...terms, { id: uid(), name: `Étape ${terms.length + 1}`, start: last?.end ?? '', end: last?.end ?? '', weight: 0 }]);
          }}
        >
          + Ajouter une étape
        </button>
        <p className="hint">Au Québec, les trois étapes comptent habituellement pour 20 %, 20 % et 60 % du résultat final.</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Échelle des cotes</h2>
          <span className="spacer" />
          <button className="btn btn-sm" onClick={() => setScale(DEFAULT_LETTER_SCALE.map((g) => ({ ...g })))}>
            Par défaut
          </button>
        </div>
        <p className="muted">
          Pour les matières notées par cote : le <strong>seuil</strong> convertit un pourcentage en cote, la <strong>valeur</strong> est le
          pourcentage utilisé pour calculer moyennes et statistiques à partir d’une cote.
        </p>
        <div className="table-scroll">
          <table className="list-table editable">
            <thead>
              <tr>
                <th>Cote</th>
                <th>Seuil (≥ %)</th>
                <th>Valeur (%)</th>
                <th>Description</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {scale.map((g, i) => (
                <tr key={i}>
                  <td>
                    <input className="w-sm" value={g.code} maxLength={3} onChange={(e) => setGrade(i, { code: e.target.value.toUpperCase() })} aria-label="Cote" />
                  </td>
                  <td>
                    <input className="w-sm" type="number" inputMode="decimal" value={g.min} onChange={(e) => setGrade(i, { min: parseFloat(e.target.value) || 0 })} aria-label="Seuil" />
                  </td>
                  <td>
                    <input className="w-sm" type="number" inputMode="decimal" value={g.value} onChange={(e) => setGrade(i, { value: parseFloat(e.target.value) || 0 })} aria-label="Valeur" />
                  </td>
                  <td>
                    <input value={g.label ?? ''} onChange={(e) => setGrade(i, { label: e.target.value })} aria-label="Description" />
                  </td>
                  <td className="row-actions">
                    <button className="icon-btn danger" disabled={scale.length <= 2} onClick={() => setScale(scale.filter((_, k) => k !== i))} aria-label="Retirer">
                      <Icon name="trash" size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="comp-foot">
          <button className="link" onClick={() => setScale([...scale, { code: '?', min: 0, value: 0 }])}>
            + Ajouter une cote
          </button>
          <button className="link" onClick={() => setScale(sortedScale(scale))}>
            Trier par seuil
          </button>
        </div>
      </section>

      <section className="card form">
        <h2>Calculs et bulletin</h2>
        <label>
          Seuil de réussite (%)
          <input
            className="w-sm"
            type="number"
            inputMode="decimal"
            value={settings.passThreshold}
            onChange={(e) => updateSettings({ passThreshold: parseFloat(e.target.value) || 0 })}
          />
          <small className="hint">Utilisé pour le taux de réussite, la mise en évidence des échecs et la conversion Succès/Échec.</small>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.roundResults} onChange={(e) => updateSettings({ roundResults: e.target.checked })} />
          Arrondir les résultats à l’unité
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.showGroupAverage} onChange={(e) => updateSettings({ showGroupAverage: e.target.checked })} />
          Afficher la moyenne du groupe au bulletin
        </label>
      </section>

      <AISettings />

      <section className="card">
        <h2>Données</h2>
        <p className="muted">
          Les données sont enregistrées uniquement sur cet appareil (navigateur). Exportez régulièrement une sauvegarde pour la conserver ou la
          transférer vers un autre appareil.
        </p>
        <div className="actions">
          <button className="btn btn-primary" onClick={exportData}>
            Exporter une sauvegarde
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Importer une sauvegarde
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          <button className="btn" onClick={() => confirm('Remplacer les données par un exemple de démonstration ?') && replaceData(demoData())}>
            Charger la démo
          </button>
          <button className="btn btn-danger-ghost" onClick={() => confirm('Effacer définitivement toutes les données ?') && replaceData(emptyData())}>
            Tout effacer
          </button>
        </div>
      </section>
    </div>
  );
}

function AISettings() {
  const [cfg, setCfg] = useState(loadAIConfig);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const update = (p: Partial<typeof cfg>) => {
    setCfg({ ...cfg, ...p });
    setSaved(false);
  };
  return (
    <section className="card form">
      <h2>Intelligence artificielle (numérisation)</h2>
      <p className="muted">
        La fonction « Numériser » lit les photos de relevés papier avec Claude ({AI_MODEL}). Elle nécessite une clé API Anthropic
        (console.anthropic.com) ; l’utilisation est facturée à ce compte.
      </p>
      <label>
        Clé API
        <div className="comp-row">
          <input
            type={show ? 'text' : 'password'}
            autoComplete="off"
            value={cfg.apiKey}
            placeholder="sk-ant-…"
            onChange={(e) => update({ apiKey: e.target.value })}
          />
          <button type="button" className="btn" onClick={() => setShow(!show)}>
            {show ? 'Masquer' : 'Afficher'}
          </button>
        </div>
      </label>
      <label>
        Serveur relais (facultatif)
        <input value={cfg.baseURL} placeholder="https://… (laisser vide pour l’API Anthropic)" onChange={(e) => update({ baseURL: e.target.value })} />
        <small className="hint">Pour un établissement qui fournit son propre relais : la clé reste alors sur le serveur.</small>
      </label>
      <div className="actions left">
        <button
          className="btn btn-primary"
          onClick={() => {
            saveAIConfig({ apiKey: cfg.apiKey.trim(), baseURL: cfg.baseURL.trim() });
            setSaved(true);
          }}
        >
          Enregistrer
        </button>
        <button className="btn btn-danger-ghost" onClick={() => { saveAIConfig({ apiKey: '', baseURL: '' }); setCfg({ apiKey: '', baseURL: '' }); }}>
          Retirer la clé
        </button>
        {saved && <span className="muted">Enregistré ✓</span>}
      </div>
      <small className="hint">
        La clé est conservée seulement dans ce navigateur, n’est jamais incluse dans les sauvegardes exportées et n’est envoyée qu’à
        Anthropic. Utilisez une clé dédiée avec une limite de dépenses, et retirez-la d’un appareil partagé.
      </small>
    </section>
  );
}
